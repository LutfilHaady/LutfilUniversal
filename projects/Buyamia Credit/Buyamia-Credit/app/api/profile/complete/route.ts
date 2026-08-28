/**
 * Complete Profile API
 * 
 * POST /api/profile/complete
 * 
 * Saves the required platform fields and marks profileCompleted=true.
 * Called after first login to collect Buyamia Credit-specific data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get session and user
    const session = await getSessionByToken(sessionToken)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session expired' },
        { status: 401 }
      )
    }

    const user = session.user
    const body = await request.json()

    // Validate based on user type
    if (user.type === 'BUYER') {
      // Required fields for buyers
      const {
        businessTypes,
        ownerName,
        averagePurchaseVolume,
        orderFrequency,
        preferredPaymentTerm,
        yearsInOperation,
        contactPersonName,
        contactPersonPhone,
        // Optional fields
        businessRegistrationNumber,
        contactPersonEmail,
        address
      } = body

      // Validate required fields
      const errors: string[] = []
      if (!businessTypes || (Array.isArray(businessTypes) && businessTypes.length === 0)) {
        errors.push('Business types is required')
      }
      if (!ownerName?.trim()) errors.push('Owner name is required')
      if (!averagePurchaseVolume) errors.push('Average purchase volume is required')
      if (!orderFrequency) errors.push('Order frequency is required')
      if (!preferredPaymentTerm) errors.push('Preferred payment term is required')
      if (yearsInOperation === undefined || yearsInOperation === null) {
        errors.push('Years in operation is required')
      }
      if (!contactPersonName?.trim()) errors.push('Contact person name is required')
      if (!contactPersonPhone?.trim()) errors.push('Contact person phone is required')

      if (errors.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', errors },
          { status: 400 }
        )
      }

      // Update user profile
      await prisma.user.update({
        where: { id: user.id },
        data: {
          businessTypes: JSON.stringify(Array.isArray(businessTypes) ? businessTypes : [businessTypes]),
          ownerName: ownerName.trim(),
          averagePurchaseVolume,
          orderFrequency,
          preferredPaymentTerm,
          yearsInOperation: parseInt(yearsInOperation, 10),
          contactPersonName: contactPersonName.trim(),
          contactPersonPhone: contactPersonPhone.trim(),
          // Optional
          businessRegistrationNumber: businessRegistrationNumber?.trim() || null,
          contactPersonEmail: contactPersonEmail?.trim() || null,
          address: address?.trim() || user.address,
          profileCompleted: true,
        } as any
      })

    } else if (user.type === 'SUPPLIER') {
      // Required fields for suppliers
      const {
        categories,
        regionsServed,
        averageSupplyCapacity,
        creditTermsOffered,
        yearsInOperation,
        // Optional
        address
      } = body

      // Validate required fields
      const errors: string[] = []
      if (!categories || (Array.isArray(categories) && categories.length === 0)) {
        errors.push('Categories is required')
      }
      if (!regionsServed?.trim()) errors.push('Regions served is required')
      if (!averageSupplyCapacity) errors.push('Average supply capacity is required')
      if (!creditTermsOffered || (Array.isArray(creditTermsOffered) && creditTermsOffered.length === 0)) {
        errors.push('Credit terms offered is required')
      }
      if (yearsInOperation === undefined || yearsInOperation === null) {
        errors.push('Years in operation is required')
      }

      if (errors.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', errors },
          { status: 400 }
        )
      }

      // Update user profile
      await prisma.user.update({
        where: { id: user.id },
        data: {
          categories: JSON.stringify(Array.isArray(categories) ? categories : [categories]),
          regionsServed: regionsServed.trim(),
          averageSupplyCapacity,
          creditTermsOffered: JSON.stringify(Array.isArray(creditTermsOffered) ? creditTermsOffered : [creditTermsOffered]),
          yearsInOperation: parseInt(yearsInOperation, 10),
          address: address?.trim() || user.address,
          profileCompleted: true,
        } as any
      })
    }

    // Fetch updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Profile completed successfully',
      user: {
        id: updatedUser!.id,
        userId: updatedUser!.userId,
        type: updatedUser!.type,
        businessName: updatedUser!.businessName,
        profileCompleted: updatedUser!.profileCompleted,
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



