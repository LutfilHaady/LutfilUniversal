import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalculateSupplierReliabilityScore } from '@/lib/utils/score-recalculation'

/**
 * GET /api/issues
 * Get issues for a user (buyer or supplier)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const userType = searchParams.get('userType')

    if (!userId || !userType) {
      return NextResponse.json(
        { error: 'userId and userType are required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    let issues
    if (userType === 'SUPPLIER') {
      // Suppliers see issues created about them (where supplierId matches)
      issues = await prisma.issue.findMany({
        where: { supplierId: user.id },
        include: {
          buyer: {
            select: {
              userId: true,
              businessName: true,
            },
          },
          supplier: {
            select: {
              userId: true,
              businessName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    } else {
      // Buyers see BOTH:
      // 1. Issues they created (where buyerId matches AND createdBy = 'BUYER')
      // 2. Issues suppliers created about them (where buyerId matches AND createdBy = 'SUPPLIER')
      // Fetch all issues where buyerId matches (both types)
      issues = await prisma.issue.findMany({
        where: { buyerId: user.id },
        include: {
          buyer: {
            select: {
              userId: true,
              businessName: true,
            },
          },
          supplier: {
            select: {
              userId: true,
              businessName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    const formattedIssues = issues.map(issue => ({
      id: issue.id,
      issueNumber: issue.issueNumber,
      orderId: issue.orderId,
      buyerId: issue.buyer.userId,
      supplierId: issue.supplier.userId,
      buyerName: issue.buyer.businessName,
      supplierName: issue.supplier.businessName,
      type: issue.type,
      description: issue.description,
      transcript: issue.transcript,
      audioUrl: issue.audioUrl,
      imageUrl: (issue as any).imageUrl,
      status: issue.status,
      resolvedAt: issue.resolvedAt?.toISOString() || null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
      createdBy: (issue as any).createdBy || 'BUYER', // Use createdBy field from database
    }))

    return NextResponse.json(formattedIssues)
  } catch (error) {
    console.error('Issues API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/issues
 * Create a new issue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, buyerId, supplierId, type, description, transcript, audioUrl, imageUrl, createdBy } = body

    console.log('[API] Creating issue with data:', { orderId, buyerId, supplierId, type, createdBy })

    // Validate required fields (orderId is optional - just a reference text)
    if (!buyerId || !supplierId || !type) {
      console.error('[API] Missing required fields:', { buyerId, supplierId, type })
      return NextResponse.json(
        { error: 'buyerId, supplierId, and type are required' },
        { status: 400 }
      )
    }

    // Get buyer and supplier
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerId },
    })

    const supplier = await prisma.user.findUnique({
      where: { userId: supplierId },
    })

    console.log('[API] Found users:', { buyer: buyer ? buyer.userId : null, supplier: supplier ? supplier.userId : null })

    if (!buyer) {
      console.error('[API] Buyer not found:', buyerId)
      return NextResponse.json(
        { error: `Buyer not found: ${buyerId}` },
        { status: 404 }
      )
    }

    if (!supplier) {
      console.error('[API] Supplier not found:', supplierId)
      return NextResponse.json(
        { error: `Supplier not found: ${supplierId}` },
        { status: 404 }
      )
    }

    // Generate issue number
    const issueNumber = `ISS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    // Determine who created the issue (default to BUYER if not specified)
    const issueCreatedBy = createdBy || 'BUYER'

    // Create issue
    console.log('[API] Attempting to create issue with:', {
      issueNumber,
      orderId,
      buyerId: buyer.id,
      supplierId: supplier.id,
      createdBy: issueCreatedBy,
      type,
      hasDescription: !!description,
      hasImageUrl: !!imageUrl,
    })
    
    const issue = await prisma.issue.create({
      data: {
        issueNumber,
        orderId: orderId || null, // Optional - can be null
        buyerId: buyer.id,
        supplierId: supplier.id,
        createdBy: issueCreatedBy,
        type,
        description: description || null,
        transcript: transcript || null,
        audioUrl: audioUrl || null,
        imageUrl: imageUrl || null,
        status: 'OPEN',
      } as any, // Type assertion needed - Prisma Client types will update after TypeScript server restart
      include: {
        buyer: {
          select: {
            userId: true,
            businessName: true,
          },
        },
        supplier: {
          select: {
            userId: true,
            businessName: true,
          },
        },
      },
    })

    console.log('[API] Issue created successfully:', issue.id)
    
    // Recalculate supplier's reliability score when issue is created
    try {
      await recalculateSupplierReliabilityScore(supplier.id)
      console.log(`[API] Updated reliability score for supplier ${supplier.userId} after issue creation`)
    } catch (error) {
      console.error(`[API] Failed to update reliability score:`, error)
      // Don't fail the request if score update fails
    }
    
    // Type assertion for accessing relations and new fields
    const issueWithRelations = issue as typeof issue & {
      buyer: { userId: string; businessName: string }
      supplier: { userId: string; businessName: string }
      imageUrl: string | null
      createdBy: string
    }

    return NextResponse.json({
      success: true,
      issue: {
        id: issueWithRelations.id,
        issueNumber: issueWithRelations.issueNumber,
        orderId: issueWithRelations.orderId,
        buyerId: issueWithRelations.buyer.userId,
        supplierId: issueWithRelations.supplier.userId,
        buyerName: issueWithRelations.buyer.businessName,
        supplierName: issueWithRelations.supplier.businessName,
        type: issueWithRelations.type,
        description: issueWithRelations.description,
        transcript: issueWithRelations.transcript,
        audioUrl: issueWithRelations.audioUrl,
        imageUrl: issueWithRelations.imageUrl || null,
        status: issueWithRelations.status,
        createdBy: issueWithRelations.createdBy || 'BUYER',
        createdAt: issueWithRelations.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Issue Creation Error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'UnknownError',
    })
    return NextResponse.json(
      { 
        error: 'Failed to create issue',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

