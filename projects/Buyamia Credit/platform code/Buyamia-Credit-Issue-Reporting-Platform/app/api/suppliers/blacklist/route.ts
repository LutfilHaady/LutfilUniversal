import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/suppliers/blacklist
 * Get all blacklisted buyers for the current supplier
 */
export async function GET(request: NextRequest) {
  try {
    // Get supplier from session
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    let supplier: any = null

    if (sessionToken) {
      const { getSessionByToken } = await import('@/lib/auth')
      const session = await getSessionByToken(sessionToken)
      if (session?.user && session.user.type === 'SUPPLIER') {
        supplier = session.user
      }
    }

    // Fallback: try to get from query params (for dev mode)
    if (!supplier) {
      const supplierId = request.nextUrl.searchParams.get('supplierId')
      if (supplierId) {
        supplier = await prisma.user.findUnique({
          where: { userId: supplierId.toUpperCase() },
        })
      }
    }

    if (!supplier || supplier.type !== 'SUPPLIER') {
      return NextResponse.json(
        { error: 'Supplier not found or not authenticated' },
        { status: 401 }
      )
    }

    // Get blacklisted buyers from database
    const blacklistEntries = await prisma.supplierBlacklist.findMany({
      where: { supplierId: supplier.id },
      include: {
        buyer: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get invoice data for blacklisted buyers to enrich the response
    const blacklistedBuyers = await Promise.all(
      blacklistEntries.map(async (entry) => {
        const buyer = entry.buyer
        
        // Get invoice stats
        const invoices = await prisma.invoice.findMany({
          where: {
            buyerId: buyer.id,
            supplierId: supplier.id,
          },
        })

        const totalOutstanding = invoices
          .filter(inv => inv.status !== 'PAID')
          .reduce((sum, inv) => sum + Number(inv.amount), 0)

        const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length
        const lastPayment = invoices
          .filter(inv => inv.paidAt)
          .sort((a, b) => (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0))[0]

        let riskLevel = 'Low Risk'
        if (buyer.creditScore < 50) riskLevel = 'High Risk'
        else if (buyer.creditScore < 70) riskLevel = 'Medium Risk'

        return {
          id: entry.id,
          buyerId: buyer.userId,
          businessName: buyer.businessName,
          creditScore: buyer.creditScore,
          riskLevel,
          totalOutstanding,
          lastPaymentDate: lastPayment?.paidAt?.toISOString() || null,
          totalInvoices: invoices.length,
          paidInvoices,
          preferredPaymentTerm: buyer.preferredPaymentTerm || 'NET14',
          blacklistedAt: entry.createdAt.toISOString(),
          reason: entry.reason || null,
          replacedBy: entry.replacedBy || null,
        }
      })
    )

    return NextResponse.json({
      success: true,
      blacklistedBuyers,
      count: blacklistedBuyers.length,
    })
  } catch (error) {
    console.error('[API] Blacklist GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blacklist' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/suppliers/blacklist
 * Add a buyer to blacklist
 */
export async function POST(request: NextRequest) {
  try {
    // Get supplier from session
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    let supplier: any = null

    if (sessionToken) {
      const { getSessionByToken } = await import('@/lib/auth')
      const session = await getSessionByToken(sessionToken)
      if (session?.user && session.user.type === 'SUPPLIER') {
        supplier = session.user
      }
    }

    // Fallback: try to get from body (for dev mode)
    const body = await request.json()
    const { buyerId, reason, replacedBy, supplierId: devSupplierId } = body as {
      buyerId: string
      reason?: string
      replacedBy?: string
      supplierId?: string
    }

    if (!supplier && devSupplierId) {
      supplier = await prisma.user.findUnique({
        where: { userId: devSupplierId.toUpperCase() },
      })
    }

    if (!supplier || supplier.type !== 'SUPPLIER') {
      return NextResponse.json(
        { error: 'Supplier not found or not authenticated' },
        { status: 401 }
      )
    }

    if (!buyerId) {
      return NextResponse.json(
        { error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Find buyer
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerId.toUpperCase() },
    })

    if (!buyer || buyer.type !== 'BUYER') {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Check if already blacklisted
    const existing = await prisma.supplierBlacklist.findUnique({
      where: {
        supplierId_buyerId: {
          supplierId: supplier.id,
          buyerId: buyer.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Buyer is already blacklisted',
        blacklist: existing,
      })
    }

    // Create blacklist entry
    try {
      const blacklistEntry = await prisma.supplierBlacklist.create({
        data: {
          supplierId: supplier.id,
          buyerId: buyer.id,
          reason: reason || null,
          replacedBy: replacedBy || null,
        },
      })

      console.log('[API] Blacklist entry created:', blacklistEntry.id)

      return NextResponse.json({
        success: true,
        message: 'Buyer added to blacklist',
        blacklist: blacklistEntry,
      })
    } catch (createError) {
      console.error('[API] Error creating blacklist entry:', createError)
      // Re-throw to be caught by outer catch
      throw createError
    }
  } catch (error) {
    console.error('[API] Blacklist POST error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to add buyer to blacklist',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
