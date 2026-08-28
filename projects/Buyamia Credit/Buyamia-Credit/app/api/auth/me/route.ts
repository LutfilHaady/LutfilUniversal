/**
 * Current User API
 * 
 * GET /api/auth/me
 * 
 * Returns the currently authenticated user from the session cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated', user: null },
        { status: 401 }
      )
    }

    // Get session and user
    const session = await getSessionByToken(sessionToken)

    if (!session) {
      // Session expired or invalid - clear the cookie
      const response = NextResponse.json(
        { success: false, error: 'Session expired', user: null },
        { status: 401 }
      )
      response.cookies.delete(SESSION_COOKIE_NAME)
      return response
    }

    const user = session.user

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        userId: user.userId,
        type: user.type,
        businessName: user.businessName,
        phoneNumber: user.phoneNumber,
        address: user.address,
        creditScore: user.creditScore,
        profileCompleted: user.profileCompleted,
        inviteStatus: user.inviteStatus,
        lastLoginAt: user.lastLoginAt,
        // Buyer fields
        businessTypes: user.businessTypes,
        ownerName: user.ownerName,
        averagePurchaseVolume: user.averagePurchaseVolume,
        orderFrequency: user.orderFrequency,
        preferredPaymentTerm: user.preferredPaymentTerm,
        yearsInOperation: user.yearsInOperation,
        contactPersonName: user.contactPersonName,
        contactPersonPhone: user.contactPersonPhone,
        contactPersonEmail: user.contactPersonEmail,
        // Supplier fields
        categories: user.categories,
        regionsServed: user.regionsServed,
        averageSupplyCapacity: user.averageSupplyCapacity,
        creditTermsOffered: user.creditTermsOffered,
      },
      session: {
        expiresAt: session.expiresAt,
        lastActiveAt: session.lastActiveAt
      }
    })

  } catch (error) {
    console.error('[API] Get current user error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get user',
        user: null
      },
      { status: 500 }
    )
  }
}


