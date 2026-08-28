/**
 * Complete Profile API
 * 
 * POST /api/auth/complete-profile
 * 
 * Updates the user's profile with Credit-specific information
 * after they've verified their Buyamia account via OTP.
 * Handles both BUYER and SUPPLIER specific fields.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      externalId,
      type,
      businessName,
      ownerName,
      phoneNumber,
      address,
      // BUYER fields
      businessTypes,
      averagePurchaseVolume,
      orderFrequency,
      preferredPaymentTerm,
      yearsInOperation,
      businessRegistrationNumber,
      // SUPPLIER fields
      categories,
      regionsServed,
      averageSupplyCapacity,
      creditTermsOffered,
      deliveryMethods,
      returnPolicy,
      // Common contact fields
      contactPersonName,
      contactPersonPhone,
      contactPersonEmail,
    } = body

    // Find user by phone number (they were created during register-buyamia)
    const user = await prisma.user.findFirst({
      where: {
        phoneNumber: phoneNumber,
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found. Please start registration again.' },
        { status: 404 }
      )
    }

    // Build update data based on user type
    const isBuyer = user.type === 'BUYER'
    
    // Common data for both types
    const updateData: Record<string, any> = {
      businessName,
      ownerName,
      address,
      contactPersonName,
      contactPersonPhone,
      contactPersonEmail: contactPersonEmail || null,
      profileCompleted: true,
      inviteStatus: 'ACTIVE',
      lastLoginAt: new Date(),
    }
    
    if (isBuyer) {
      // BUYER specific fields
      updateData.businessTypes = Array.isArray(businessTypes) ? businessTypes.join(',') : businessTypes || ''
      updateData.averagePurchaseVolume = averagePurchaseVolume || null
      updateData.orderFrequency = orderFrequency || null
      updateData.preferredPaymentTerm = preferredPaymentTerm || null
      updateData.yearsInOperation = yearsInOperation || null
      updateData.businessRegistrationNumber = businessRegistrationNumber || null
    } else {
      // SUPPLIER specific fields
      updateData.categories = Array.isArray(categories) ? categories.join(',') : categories || ''
      updateData.regionsServed = Array.isArray(regionsServed) ? regionsServed.join(',') : regionsServed || null
      updateData.averageSupplyCapacity = averageSupplyCapacity || null
      updateData.creditTermsOffered = Array.isArray(creditTermsOffered) ? creditTermsOffered.join(',') : creditTermsOffered || ''
      updateData.deliveryMethods = Array.isArray(deliveryMethods) ? deliveryMethods.join(',') : deliveryMethods || null
      updateData.returnPolicy = returnPolicy || null
    }

    // Update user with complete profile data
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData
    })

    // Create a session for the user (returns token string)
    const sessionToken = await createSession(user.id)

    // Set the session cookie (expires in 7 days as per SESSION_EXPIRY_DAYS)
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
      message: 'Profile completed successfully!',
      data: {
        userId: updatedUser.userId,
        businessName: updatedUser.businessName,
        type: updatedUser.type,
      }
    })

  } catch (error) {
    console.error('[API] Complete profile error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to complete profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}


