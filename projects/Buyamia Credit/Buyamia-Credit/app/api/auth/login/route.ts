/**
 * Login API
 * 
 * POST /api/auth/login
 * 
 * Verifies user credentials and sends OTP for authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createOtpChallenge } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/integrations/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phoneNumber } = body

    // Validate required fields
    if (!userId || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'User ID and phone number are required' },
        { status: 400 }
      )
    }

    // Normalize userId to uppercase
    const normalizedUserId = userId.toUpperCase()

    // Find user by userId and phoneNumber
    const user = await prisma.user.findFirst({
      where: {
        userId: normalizedUserId,
        phoneNumber: phoneNumber.replace(/[\s-]/g, ''), // Remove spaces and dashes for comparison
      }
    })

    if (!user) {
      // Try finding by userId only to give better error message
      const userByIdOnly = await prisma.user.findFirst({
        where: { userId: normalizedUserId }
      })
      
      if (userByIdOnly) {
        return NextResponse.json(
          { success: false, error: 'Phone number does not match this User ID' },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { success: false, error: 'User ID not found. Please check your credentials or register.' },
        { status: 404 }
      )
    }

    // Check if profile is completed
    if (!user.profileCompleted) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Your registration is incomplete. Please complete your profile.',
          incompleteProfile: true
        },
        { status: 403 }
      )
    }

    // Check if account is active
    if (user.inviteStatus === 'DISABLED') {
      return NextResponse.json(
        { success: false, error: 'Your account has been disabled. Please contact support.' },
        { status: 403 }
      )
    }

    // Generate and send OTP
    const { code: otp } = await createOtpChallenge(user.id, user.phoneNumber)

    // Send OTP via WhatsApp
    const message = `🔐 *Buyamia Credit Login*\n\nYour verification code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share this code with anyone.`
    
    try {
      await sendWhatsAppMessage(user.phoneNumber, message)
    } catch (whatsappError) {
      console.error('[API] WhatsApp send error:', whatsappError)
      // Continue anyway - OTP is logged in dev mode
    }

    // Log OTP in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Login OTP code for ${user.userId}: ${otp}`)
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your phone',
      data: {
        userId: user.userId,
        type: user.type,
        businessName: user.businessName,
      },
      requiresOtp: true,
      otpSentTo: user.phoneNumber,
    })

  } catch (error) {
    console.error('[API] Login error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


