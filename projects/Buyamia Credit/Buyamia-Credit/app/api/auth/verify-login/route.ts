/**
 * Verify Login OTP API
 * 
 * POST /api/auth/verify-login
 * 
 * Verifies the OTP and creates a session for the user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyOtp, createSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, code } = body

    // Validate required fields
    if (!userId || !code) {
      return NextResponse.json(
        { success: false, error: 'User ID and OTP code are required' },
        { status: 400 }
      )
    }

    // Find user by userId
    const user = await prisma.user.findFirst({
      where: { userId: userId.toUpperCase() }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify OTP
    const otpResult = await verifyOtp(user.id, code)

    if (!otpResult.success) {
      return NextResponse.json(
        { success: false, error: otpResult.error },
        { status: 401 }
      )
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Create session
    const sessionToken = await createSession(user.id)

    // Set session cookie
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.userId,
        type: user.type,
        businessName: user.businessName,
      }
    })

  } catch (error) {
    console.error('[API] Verify login error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


