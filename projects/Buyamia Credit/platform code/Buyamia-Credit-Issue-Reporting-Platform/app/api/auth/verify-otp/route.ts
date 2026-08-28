/**
 * Verify OTP API
 * 
 * POST /api/auth/verify-otp
 * 
 * Verifies the OTP code and creates a session for the user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyOtp, createSession, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phoneNumber, code } = body

    // Validate input - need either userId or phoneNumber
    if ((!userId && !phoneNumber) || !code) {
      return NextResponse.json(
        { success: false, error: 'userId or phoneNumber, and code are required' },
        { status: 400 }
      )
    }

    // Find the user by userId or phoneNumber
    let user = null
    if (userId) {
      user = await prisma.user.findUnique({
        where: { userId: userId.toUpperCase() }
      })
    } else if (phoneNumber) {
      user = await prisma.user.findFirst({
        where: { phoneNumber: phoneNumber }
      })
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check invite status
    if (user.inviteStatus === 'DISABLED') {
      return NextResponse.json(
        { success: false, error: 'This account has been disabled.' },
        { status: 403 }
      )
    }

    // Verify the OTP
    const verification = await verifyOtp(user.id, code)
    
    if (!verification.success) {
      return NextResponse.json(
        { success: false, error: verification.error },
        { status: 400 }
      )
    }

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0].trim() || 
                      request.headers.get('x-real-ip') || 
                      undefined

    // Create session
    const sessionToken = await createSession(user.id, userAgent, ipAddress)

    // Update user status and last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        inviteStatus: 'ACTIVE',
        lastLoginAt: new Date()
      }
    })

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        userId: user.userId,
        type: user.type,
        businessName: user.businessName,
        profileCompleted: user.profileCompleted,
      },
      requiresOnboarding: !user.profileCompleted
    })

    // Set HTTP-only session cookie
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    })

    return response

  } catch (error) {
    console.error('[API] Verify OTP error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to verify code',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



