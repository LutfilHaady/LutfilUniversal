import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalculateSupplierReliabilityScore } from '@/lib/utils/score-recalculation'

/**
 * GET /api/issues/[id]
 * Get a single issue by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: params.id },
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

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
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
      status: issue.status,
      resolvedAt: issue.resolvedAt?.toISOString() || null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Issue Detail API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issue' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/issues/[id]
 * Update an issue (e.g., resolve it)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      )
    }

    const updateData: any = { status }
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date()
    }

    // Get issue first to get supplier ID before update
    const existingIssue = await prisma.issue.findUnique({
      where: { id: params.id },
      include: {
        supplier: true,
      },
    })

    if (!existingIssue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    const issue = await prisma.issue.update({
      where: { id: params.id },
      data: updateData,
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

    // Recalculate supplier's reliability score when issue status changes
    // (especially when resolved)
    try {
      await recalculateSupplierReliabilityScore(existingIssue.supplierId)
      console.log(`[API] Updated reliability score for supplier after issue ${status} status`)
    } catch (error) {
      console.error(`[API] Failed to update reliability score:`, error)
      // Don't fail the request if score update fails
    }

    return NextResponse.json({
      success: true,
      issue: {
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
        status: issue.status,
        resolvedAt: issue.resolvedAt?.toISOString() || null,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Issue Update Error:', error)
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 }
    )
  }
}

