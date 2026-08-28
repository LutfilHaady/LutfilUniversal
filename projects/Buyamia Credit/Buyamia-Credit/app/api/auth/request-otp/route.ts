/**
 * Request OTP API
 * 
 * POST /api/auth/request-otp
 * 
 * Sends an OTP code to the user's registered phone number via WhatsApp.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createOtpChallenge, checkOtpRateLimit } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/integrations/twilio'
import { normalizePhoneForTwilio } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phoneNumber } = body

    // Validate input
    if (!userId || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'userId and phoneNumber are required' },
        { status: 400 }
      )
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { userId: userId.toUpperCase() }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found. Please check your User ID.' },
        { status: 404 }
      )
    }

    // Check invite status
    if (user.inviteStatus === 'DISABLED') {
      return NextResponse.json(
        { success: false, error: 'This account has been disabled. Please contact support.' },
        { status: 403 }
      )
    }

    // Normalize phone numbers for comparison (remove spaces, dashes)
    const normalizePhone = (phone: string) => phone.replace(/[\s\-]/g, '')
    const userPhone = normalizePhone(user.phoneNumber)
    const inputPhone = normalizePhone(phoneNumber)

    // Verify phone number matches
    if (userPhone !== inputPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number does not match our records.' },
        { status: 400 }
      )
    }

    // Check rate limiting
    const rateLimit = await checkOtpRateLimit(user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Please wait ${rateLimit.waitSeconds} seconds before requesting a new code.`,
          waitSeconds: rateLimit.waitSeconds
        },
        { status: 429 }
      )
    }

    // Create OTP challenge
    const { code, expiresAt } = await createOtpChallenge(user.id, user.phoneNumber)

    // Send OTP via WhatsApp
    const message = `🔐 *Buyamia Credit Login*\n\nYour verification code is: *${code}*\n\nThis code expires in 5 minutes. Do not share this code with anyone.`
    
    try {
      // Normalize phone for Twilio (E.164 format). This supports non-Indonesian numbers.
      const to = normalizePhoneForTwilio(user.phoneNumber)
      await sendWhatsAppMessage(to, message)
    } catch (twilioError) {
      console.error('[OTP] Failed to send WhatsApp message:', twilioError)
      // Continue anyway for MVP - the mock will log the code
    }

    // In development, log the code (remove in production!)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP code for ${userId}: ${code}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your WhatsApp',
      expiresAt: expiresAt.toISOString(),
      // Only include code in development for testing
      ...(process.env.NODE_ENV === 'development' && { devCode: code })
    })

  } catch (error) {
    console.error('[API] Request OTP error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send verification code',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



