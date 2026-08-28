/**
 * Search Buyamia Account API
 * 
 * POST /api/auth/search-buyamia
 * 
 * Searches the external Buyamia database for an existing account
 * by email or phone number.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBuyerByEmail, getBuyerByPhone } from '@/lib/external-db/adapters/buyers'
import { getSellerByEmail, getSellerByPhone } from '@/lib/external-db/adapters/sellers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, phone } = body

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone number is required' },
        { status: 400 }
      )
    }

    let buyerAccount = null
    let sellerAccount = null

    // Search by email
    if (email) {
      buyerAccount = await getBuyerByEmail(email)
      sellerAccount = await getSellerByEmail(email)
    }

    // Search by phone if no results from email
    if (!buyerAccount && !sellerAccount && phone) {
      buyerAccount = await getBuyerByPhone(phone)
      sellerAccount = await getSellerByPhone(phone)
    }

    // Determine which account to return
    const accounts = []
    
    if (buyerAccount) {
      accounts.push({
        type: 'BUYER' as const,
        externalId: buyerAccount.externalId,
        userId: buyerAccount.userId,
        name: buyerAccount.name,
        email: buyerAccount.email,
        phone: buyerAccount.phone,
        businessName: buyerAccount.businessName,
        address: buyerAccount.address ? {
          line1: buyerAccount.address.line1,
          line2: buyerAccount.address.line2,
          city: buyerAccount.address.city,
          state: buyerAccount.address.state,
          country: buyerAccount.address.country,
          zipCode: buyerAccount.address.zipCode,
        } : null,
        creditLimit: buyerAccount.creditLimit,
      })
    }

    if (sellerAccount) {
      accounts.push({
        type: 'SUPPLIER' as const,
        externalId: sellerAccount.externalId,
        name: sellerAccount.name,
        email: sellerAccount.email,
        phone: sellerAccount.phone,
        businessName: sellerAccount.name,
        address: null, // Sellers address would need to be fetched separately if needed
      })
    }

    if (accounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Buyamia account found with this email or phone number',
        accounts: []
      })
    }

    return NextResponse.json({
      success: true,
      message: `Found ${accounts.length} Buyamia account(s)`,
      accounts
    })

  } catch (error) {
    console.error('[API] Search Buyamia error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to search Buyamia accounts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



