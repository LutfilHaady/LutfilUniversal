/**
 * Development Authorization API
 * 
 * POST /api/auth/dev-authorize
 * 
 * Creates a session for a user (development/testing only)
 * Body: { userId: "SP0023" | "BJ0045" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Normalize userId to uppercase
    const normalizedUserId = userId.toUpperCase()

    // Find user
    const user = await prisma.user.findUnique({
      where: { userId: normalizedUserId }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: `User ${normalizedUserId} not found` },
        { status: 404 }
      )
    }

    // Check if profile is completed
    if (!user.profileCompleted) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'User profile is not completed',
          incompleteProfile: true
        },
        { status: 403 }
      )
    }

    // Get user agent and IP from request
    const userAgent = request.headers.get('user-agent') || undefined
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     undefined

    // Create session
    const sessionToken = await createSession(user.id, userAgent, ipAddress)

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      message: `User ${user.userId} authorized successfully`,
      user: {
        id: user.id,
        userId: user.userId,
        type: user.type,
        businessName: user.businessName,
      }
    })

    // Set session cookie
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response

  } catch (error) {
    console.error('[API] Dev authorize error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Authorization failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



