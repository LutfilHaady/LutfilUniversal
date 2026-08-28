/**
 * Admin Invite API
 * 
 * POST /api/admin/invites - Invite a Buyamia user to Buyamia Credit
 * 
 * Creates a local user record linked to the external Buyamia buyer/seller,
 * with status "INVITED". User will complete profile on first login.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { externalDb } from '@/lib/external-db'
import { generateUserId } from '@/lib/auth'

// Simple admin secret for MVP - should be replaced with proper admin auth later
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'buyamia-credit-admin-secret'

export async function POST(request: NextRequest) {
  try {
    // Verify admin secret
    const adminSecret = request.headers.get('X-Admin-Secret')
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, buyamiaId } = body

    // Validate input
    if (!type || !['BUYER', 'SUPPLIER'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be BUYER or SUPPLIER.' },
        { status: 400 }
      )
    }

    if (!buyamiaId) {
      return NextResponse.json(
        { success: false, error: 'buyamiaId is required' },
        { status: 400 }
      )
    }

    // Note: existingUser check moved after fetching external user to get phone number

    // Fetch external user data
    let externalUser: any = null
    let businessName = ''
    let phoneNumber = ''
    let address = ''
    let buyamiaUserId: string | null = null

    if (type === 'BUYER') {
      externalUser = await externalDb.buyers.getBuyerById(buyamiaId)
      if (!externalUser) {
        return NextResponse.json(
          { success: false, error: 'Buyer not found in Buyamia database' },
          { status: 404 }
        )
      }
      businessName = externalUser.businessName || externalUser.name || 'Unknown Business'
      phoneNumber = externalUser.phone || ''
      buyamiaUserId = externalUser.userId
      
      // Build address from external data
      if (externalUser.address) {
        const addr = externalUser.address
        address = [addr.line1, addr.line2, addr.city, addr.state, addr.country]
          .filter(Boolean)
          .join(', ')
      }
    } else {
      externalUser = await externalDb.sellers.getSellerById(buyamiaId)
      if (!externalUser) {
        return NextResponse.json(
          { success: false, error: 'Seller not found in Buyamia database' },
          { status: 404 }
        )
      }
      businessName = externalUser.name || 'Unknown Business'
      phoneNumber = externalUser.phone || ''
      // Sellers don't have userId in the same way
    }

    // Validate phone number exists
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'External user has no phone number. Cannot invite.' },
        { status: 400 }
      )
    }

    // Check if phone number already exists locally
    const existingPhone = await prisma.user.findUnique({
      where: { phoneNumber }
    })

    if (existingPhone) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Phone number already registered',
          existingUserId: existingPhone.userId
        },
        { status: 409 }
      )
    }

    // Generate local user ID
    const userId = await generateUserId(type)

    // Create local user
    const newUser = await prisma.user.create({
      data: {
        type,
        userId,
        businessName,
        phoneNumber,
        address: address || null,
        creditScore: 50, // Default starting score
        profileCompleted: false,
        inviteStatus: 'INVITED',
        invitedAt: new Date(),
      } as any
    })

    return NextResponse.json({
      success: true,
      message: 'User invited successfully',
      data: {
        id: newUser.id,
        userId: newUser.userId,
        type: newUser.type,
        businessName: newUser.businessName,
        phoneNumber: newUser.phoneNumber,
        inviteStatus: newUser.inviteStatus,
        invitedAt: newUser.invitedAt,
      }
    })

  } catch (error) {
    console.error('[API] Admin invite error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to invite user',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/invites - List all invited users
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin secret
    const adminSecret = request.headers.get('X-Admin-Secret')
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // INVITED, ACTIVE, DISABLED
    const type = searchParams.get('type') // BUYER, SUPPLIER

    const where: any = {}
    if (status) where.inviteStatus = status
    if (type) where.type = type

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        userId: true,
        type: true,
        businessName: true,
        phoneNumber: true,
        inviteStatus: true,
        invitedAt: true,
        profileCompleted: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: users,
      count: users.length
    })

  } catch (error) {
    console.error('[API] List invites error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to list invites',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}



