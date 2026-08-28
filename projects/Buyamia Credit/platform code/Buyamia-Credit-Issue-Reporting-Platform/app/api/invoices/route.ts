import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractRegionFromBuyer } from '@/lib/utils/region-extraction'
import { parseRegions } from '@/lib/weather/client'
import { recalculateBuyerCreditScore, recalculateSupplierReliabilityScore } from '@/lib/utils/score-recalculation'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const userType = searchParams.get('userType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50') // Default 50 per page
    const skip = (page - 1) * limit

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { userId },
    })

    if (!user) {
      console.error(`[API] User not found: ${userId}`)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    console.log(`[API] Found user: ${user.userId} (${user.type}), ID: ${user.id}`)

    // Build the where clause
    const whereClause: any = {
      NOT: {
        invoiceNumber: {
          startsWith: 'PLACEHOLDER-',
        },
      },
    }

    if (userType === 'SUPPLIER') {
      whereClause.supplierId = user.id
    } else {
      whereClause.buyerId = user.id
    }

    // Get total count for pagination
    const totalCount = await prisma.invoice.count({
      where: whereClause,
    })

    console.log(`[API] Query: ${JSON.stringify(whereClause)}`)
    console.log(`[API] Total invoices found: ${totalCount}`)

    // Get invoices with pagination
    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        buyer: true,
        supplier: true,
        collectionAttempts: {
          orderBy: { createdAt: 'desc' },
          include: {
            call: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    console.log(`[API] Fetched ${invoices.length} invoices for ${userType} ${userId} (page ${page}, total: ${totalCount})`)
    if (invoices.length > 0) {
      console.log(`[API] Sample invoice: ${invoices[0].invoiceNumber}, buyer: ${invoices[0].buyer.userId}, supplier: ${invoices[0].supplier.userId}`)
      console.log(`[API] First 5 invoice numbers:`, invoices.slice(0, 5).map(inv => inv.invoiceNumber))
    } else {
      console.log(`[API] No invoices found for ${userType} ${userId} with query:`, JSON.stringify(whereClause))
    }

    const now = new Date()
    
    const formattedInvoices = invoices.map(inv => {
      const dueDate = new Date(inv.dueDate)
      const diffTime = dueDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Calculate days overdue
      let daysOverdue: number | undefined = undefined
      if (diffDays < 0 && inv.status !== 'PAID') {
        daysOverdue = Math.abs(diffDays)
      }

      // Calculate days until due
      let daysUntilDue: number | undefined = undefined
      if (diffDays > 0 && inv.status !== 'PAID') {
        daysUntilDue = diffDays
      }

      // Map database status to frontend status
      // Database: "PENDING" | "PAID" | "DUE_SOON" | "OVERDUE_3" | "OVERDUE_7" | "DEFAULTED"
      // Frontend: 'PENDING' | 'PAID' | 'DUE_SOON' | 'OVERDUE'
      let frontendStatus: 'PENDING' | 'PAID' | 'DUE_SOON' | 'OVERDUE' = 'PENDING'
      
      if (inv.status === 'PAID') {
        frontendStatus = 'PAID'
      } else if (inv.status === 'DUE_SOON' || (inv.status === 'PENDING' && diffDays > 0 && diffDays <= 3)) {
        // Due within 3 days and still pending
        frontendStatus = 'DUE_SOON'
      } else if (inv.status === 'OVERDUE_3' || inv.status === 'OVERDUE_7' || inv.status === 'DEFAULTED' || (diffDays < 0 && inv.status !== 'PAID')) {
        // Overdue (past due date and not paid)
        frontendStatus = 'OVERDUE'
      } else {
        // Default to PENDING for any other status
        frontendStatus = 'PENDING'
      }

      // Calculate issue date (typically 14 days before due date, or use createdAt)
      const issueDate = new Date(inv.createdAt)

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        buyerId: inv.buyer.userId,
        buyerName: inv.buyer.businessName,
        supplierId: inv.supplier.userId,
        supplierName: inv.supplier.businessName,
        amount: Number(inv.amount),
        dueDate: inv.dueDate.toISOString(),
        status: frontendStatus,
        orderId: inv.orderId || null,
        issueDate: issueDate.toISOString(),
        items: inv.notes || 'Various items',
        daysOverdue,
        daysUntilDue,
        collectionStatus: inv.collectionStatus as any || null,
        lastCollectionAttempt: inv.lastCollectionAttempt?.toISOString() || null,
        collectionAttempts: inv.collectionAttempts.map(attempt => ({
          id: attempt.id,
          attemptType: attempt.attemptType,
          toneLevel: attempt.toneLevel,
          status: attempt.status,
          messageId: attempt.messageId,
          response: attempt.response,
          createdAt: attempt.createdAt.toISOString(),
          call: attempt.call ? {
            id: attempt.call.id,
            status: attempt.call.status,
            duration: attempt.call.duration,
            recordingUrl: attempt.call.recordingUrl,
            transcript: attempt.call.transcript,
            aiResponse: attempt.call.aiResponse,
            callSid: attempt.call.callSid,
          } : null,
        })),
      }
    })

    return NextResponse.json({
      invoices: formattedInvoices,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
    })
  } catch (error) {
    console.error('Invoices API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

/**
 * Update supplier's regionsServed when they deliver to a new region
 */
async function updateSupplierRegionsServed(
  supplierId: string,
  newRegion: string
): Promise<void> {
  try {
    const supplier = await prisma.user.findUnique({
      where: { id: supplierId },
      select: { regionsServed: true },
    })

    if (!supplier) return

    const currentRegions = parseRegions(supplier.regionsServed || '')
    
    // Check if region already exists (case-insensitive)
    const regionExists = currentRegions.some(
      region => region.toLowerCase() === newRegion.toLowerCase()
    )

    if (!regionExists) {
      // Add new region to the list
      const updatedRegions = supplier.regionsServed
        ? `${supplier.regionsServed}, ${newRegion}`
        : newRegion

      await prisma.user.update({
        where: { id: supplierId },
        data: { regionsServed: updatedRegions },
      })

      console.log(`[API] Updated supplier ${supplierId} regionsServed: Added ${newRegion}`)
    }
  } catch (error) {
    console.error('[API] Error updating supplier regionsServed:', error)
    // Don't throw - this is a side effect, shouldn't fail invoice creation
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { buyerId, amount, dueDate, orderId, notes, supplierId } = body

    // Validate required fields
    if (!buyerId || !amount || !dueDate) {
      return NextResponse.json(
        { error: 'buyerId, amount, and dueDate are required' },
        { status: 400 }
      )
    }

    // Get buyer and supplier
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerId },
    })

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Get supplier (from session or request body)
    let supplier
    if (supplierId) {
      supplier = await prisma.user.findUnique({
        where: { userId: supplierId },
      })
    } else {
      // TODO: Get from session/auth context
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      )
    }

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Extract delivery region from buyer's address
    const deliveryRegion = extractRegionFromBuyer({
      address: buyer.address,
      city: null, // TODO: Add city field to User model if needed
    })

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        buyerId: buyer.id,
        supplierId: supplier.id,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        orderId: orderId || null,
        notes: notes || null,
        status: 'PENDING',
      },
    })

    // Auto-update supplier's regionsServed if delivery region is found
    if (deliveryRegion && supplier.type === 'SUPPLIER') {
      await updateSupplierRegionsServed(supplier.id, deliveryRegion)
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        buyerId: buyer.userId,
        supplierId: supplier.userId,
        amount: invoice.amount,
        dueDate: invoice.dueDate.toISOString(),
        status: invoice.status,
      },
    })
  } catch (error) {
    console.error('Invoice Creation Error:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId, status } = body

    if (!invoiceId || !status) {
      return NextResponse.json(
        { error: 'invoiceId and status are required' },
        { status: 400 }
      )
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : null,
        collectionStatus: status === 'PAID' ? 'PAID' : undefined,
      },
    })

    if (status === 'PAID') {
      // Recalculate buyer's credit score based on all payment history
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { buyer: true },
      })

      if (invoice && invoice.buyer) {
        const newScore = await recalculateBuyerCreditScore(invoice.buyerId)
        
        // Log score change
        await prisma.scoreHistory.create({
          data: {
            userId: invoice.buyerId,
            score: newScore,
            reason: invoice.paidAt && invoice.paidAt <= invoice.dueDate ? 'on_time_payment' : 'late_payment',
            relatedId: invoice.id,
          },
        })
      }
    } else if (status === 'DEFAULTED') {
      // Recalculate buyer's credit score when invoice is defaulted
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { buyer: true },
      })

      if (invoice && invoice.buyer) {
        const newScore = await recalculateBuyerCreditScore(invoice.buyerId)
        
        await prisma.scoreHistory.create({
          data: {
            userId: invoice.buyerId,
            score: newScore,
            reason: 'defaulted',
            relatedId: invoice.id,
          },
        })
      }
    }

    return NextResponse.json(updatedInvoice)
  } catch (error) {
    console.error('Invoice Update Error:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}
