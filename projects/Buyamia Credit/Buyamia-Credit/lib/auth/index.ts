/**
 * Auth utilities for Buyamia Credit
 * 
 * Handles OTP generation, session management, and user ID generation
 */

import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// ============================================
// CONSTANTS
// ============================================

export const OTP_EXPIRY_MINUTES = 5
export const OTP_MAX_ATTEMPTS = 3
export const SESSION_EXPIRY_DAYS = 7
export const SESSION_COOKIE_NAME = 'buyamia_credit_session'

// ============================================
// OTP UTILITIES
// ============================================

/**
 * Generate a 6-digit OTP code
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Hash an OTP code for storage
 */
export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Verify an OTP code against a hash
 */
export function verifyOtpHash(code: string, hash: string): boolean {
  return hashOtp(code) === hash
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// ============================================
// USER ID GENERATION
// ============================================

/**
 * Generate the next available user ID (BJ#### for buyers, SP#### for suppliers)
 */
export async function generateUserId(type: 'BUYER' | 'SUPPLIER'): Promise<string> {
  const prefix = type === 'BUYER' ? 'BJ' : 'SP'
  
  // Find the highest existing ID for this type
  const lastUser = await prisma.user.findFirst({
    where: {
      userId: {
        startsWith: prefix
      }
    },
    orderBy: {
      userId: 'desc'
    },
    select: {
      userId: true
    }
  })
  
  let nextNumber = 1001 // Start from 1001
  
  if (lastUser) {
    const currentNumber = parseInt(lastUser.userId.substring(2), 10)
    if (!isNaN(currentNumber)) {
      nextNumber = currentNumber + 1
    }
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)
  
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent,
      ipAddress,
    }
  })
  
  return token
}

/**
 * Get session from token
 */
export async function getSessionByToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: true
    }
  })
  
  if (!session) return null
  
  // Check if expired
  if (new Date() > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } })
    return null
  }
  
  // Update last active
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() }
  })
  
  return session
}

/**
 * Get current user from session cookie
 */
export async function getCurrentUser() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value
  
  if (!sessionToken) return null
  
  const session = await getSessionByToken(sessionToken)
  return session?.user || null
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  await prisma.session.delete({
    where: { token }
  }).catch(() => {
    // Session may already be deleted
  })
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId }
  })
}

// ============================================
// OTP CHALLENGE MANAGEMENT
// ============================================

/**
 * Create an OTP challenge for a user
 */
export async function createOtpChallenge(
  userId: string,
  phoneNumber: string
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateOtpCode()
  const codeHash = hashOtp(code)
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES)
  
  // Invalidate any existing unconsumed challenges for this user
  await prisma.otpChallenge.updateMany({
    where: {
      userId,
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    data: {
      expiresAt: new Date() // Expire them immediately
    }
  })
  
  // Create new challenge
  await prisma.otpChallenge.create({
    data: {
      userId,
      codeHash,
      sentTo: phoneNumber,
      expiresAt,
    }
  })
  
  return { code, expiresAt }
}

/**
 * Verify an OTP code for a user
 */
export async function verifyOtp(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  // Find the latest unconsumed challenge
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      userId,
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
  
  if (!challenge) {
    return { success: false, error: 'No valid OTP found. Please request a new code.' }
  }
  
  // Check max attempts
  if (challenge.attemptCount >= OTP_MAX_ATTEMPTS) {
    return { success: false, error: 'Too many attempts. Please request a new code.' }
  }
  
  // Verify the code
  if (!verifyOtpHash(code, challenge.codeHash)) {
    // Increment attempt count
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attemptCount: challenge.attemptCount + 1 }
    })
    
    const remainingAttempts = OTP_MAX_ATTEMPTS - challenge.attemptCount - 1
    return { 
      success: false, 
      error: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.` 
    }
  }
  
  // Mark as consumed
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() }
  })
  
  return { success: true }
}

/**
 * Check rate limiting for OTP requests
 */
export async function checkOtpRateLimit(userId: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const oneMinuteAgo = new Date()
  oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1)
  
  const recentChallenges = await prisma.otpChallenge.count({
    where: {
      userId,
      createdAt: { gt: oneMinuteAgo }
    }
  })
  
  if (recentChallenges >= 1) {
    // Find the most recent challenge to calculate wait time
    const mostRecent = await prisma.otpChallenge.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
    
    if (mostRecent) {
      const waitUntil = new Date(mostRecent.createdAt.getTime() + 60000) // 1 minute
      const waitSeconds = Math.ceil((waitUntil.getTime() - Date.now()) / 1000)
      return { allowed: false, waitSeconds: Math.max(0, waitSeconds) }
    }
  }
  
  return { allowed: true }
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export type InviteStatus = 'INVITED' | 'ACTIVE' | 'DISABLED'
export type UserType = 'BUYER' | 'SUPPLIER'



