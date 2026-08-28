import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/collections/history
 * Get collection history for an invoice or supplier
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const invoiceId = searchParams.get('invoiceId')
    const userId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    
    if (!invoiceId && !userId) {
      return NextResponse.json(
        { error: 'invoiceId or userId is required' },
        { status: 400 }
      )
    }
    
    let where: any = {}
    
    if (invoiceId) {
      where.invoiceId = invoiceId
    } else if (userId) {
      // Get user first
      const user = await prisma.user.findUnique({
        where: { userId },
      })
      
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      
      // Get all invoices for this supplier
      const invoices = await prisma.invoice.findMany({
        where: { supplierId: user.id },
        select: { id: true },
      })
      
      // Return empty results if no invoices found
      if (invoices.length === 0) {
        return NextResponse.json({
          attempts: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        })
      }
      
      where.invoiceId = {
        in: invoices.map((inv) => inv.id),
      }
    }
    
    // Get collection attempts
    const [attempts, total] = await Promise.all([
      prisma.collectionAttempt.findMany({
        where,
        include: {
          call: true,
          invoice: {
            include: {
              buyer: {
                select: {
                  userId: true,
                  businessName: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.collectionAttempt.count({ where }),
    ])
    
    // Format and return attempts (even if empty)
    const formattedAttempts = attempts.map((attempt) => ({
      id: attempt.id,
      invoiceId: attempt.invoiceId,
      attemptType: attempt.attemptType,
      toneLevel: attempt.toneLevel,
      status: attempt.status,
      messageId: attempt.messageId,
      messageContent: attempt.messageContent,
      callId: attempt.callId,
      response: attempt.response,
      createdAt: attempt.createdAt.toISOString(),
      call: attempt.call
        ? {
            id: attempt.call.id,
            callSid: attempt.call.callSid,
            status: attempt.call.status,
            duration: attempt.call.duration,
            recordingUrl: attempt.call.recordingUrl,
            transcript: attempt.call.transcript,
            startedAt: attempt.call.startedAt?.toISOString(),
            endedAt: attempt.call.endedAt?.toISOString(),
          }
        : null,
      invoice: {
        invoiceNumber: attempt.invoice.invoiceNumber,
        amount: attempt.invoice.amount,
        dueDate: attempt.invoice.dueDate.toISOString(),
        buyer: attempt.invoice.buyer,
      },
    }))
    
    return NextResponse.json({
      attempts: formattedAttempts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Collection history error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch collection history',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

