/**
 * Register with Buyamia Account API
 * 
 * POST /api/auth/register-buyamia
 * 
 * Creates a new Credit Platform user linked to an existing Buyamia account.
 * Sends OTP to the user's phone for verification.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createOtpChallenge, SESSION_COOKIE_NAME } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/integrations/twilio'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      type,           // 'BUYER' | 'SUPPLIER'
      externalId,     // Buyamia buyer/seller ID
      externalUserId, // Buyamia user ID
      name,
      email,
      phone,
      businessName,
      address,
    } = body

    // Validate required fields
    if (!type || !phone || !businessName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, phone, businessName' },
        { status: 400 }
      )
    }

    // Check if user already exists with this phone
    let existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: phone },
        ]
      }
    })

    let user = existingUser

    // If user exists but profile not completed, allow them to continue registration
    if (existingUser) {
      if (existingUser.profileCompleted) {
        // Fully registered user - redirect to login
        return NextResponse.json(
          { 
            success: false, 
            error: 'An account with this phone number already exists. Please login instead.',
            existingUserId: existingUser.userId
          },
          { status: 409 }
        )
      }
      // Profile not completed - resend OTP and continue
      console.log(`[API] Existing incomplete user ${existingUser.userId}, resending OTP`)
    } else {
      // New user - create account
      // Generate user ID (BJ#### for buyers, SP#### for suppliers)
      const prefix = type === 'BUYER' ? 'BJ' : 'SP'
      const count = await prisma.user.count({ where: { type } })
      const newUserId = `${prefix}${String(count + 1).padStart(4, '0')}`

      // Create the user
      user = await prisma.user.create({
        data: {
          type,
          userId: newUserId,
          businessName,
          phoneNumber: phone,
          address: address ? (typeof address === 'string' ? address : `${address.line1}, ${address.city}`) : null,
          ownerName: name || null,
          creditScore: 50, // Starting score
          profileCompleted: false, // Will complete profile in next step
          inviteStatus: 'ACTIVE',
          invitedAt: new Date(),
        }
      })
    }

    // Generate OTP for verification (createOtpChallenge returns the generated code)
    const { code: otp } = await createOtpChallenge(user!.id, phone)

    // Send OTP via WhatsApp
    const message = `🔐 *Buyamia Credit Registration*\n\nYour verification code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share this code with anyone.`
    
    try {
      await sendWhatsAppMessage(phone, message)
    } catch (whatsappError) {
      console.error('[API] WhatsApp send error:', whatsappError)
      // Continue anyway - OTP is logged in dev mode
    }

    // Log OTP in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP code for ${user!.userId}: ${otp}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Account created! Please verify with OTP sent to your phone.',
      data: {
        userId: user!.userId,
        type: user!.type,
        businessName: user!.businessName,
        phoneNumber: user!.phoneNumber,
      },
      // For client to proceed to OTP verification
      requiresOtp: true,
      otpSentTo: phone,
    })

  } catch (error) {
    console.error('[API] Register Buyamia error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create account',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



