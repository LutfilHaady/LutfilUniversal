import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/suppliers/potential-buyers
 * Get list of potential buyers (buyers with placeholder invoices - no real invoices yet)
 * POST /api/suppliers/potential-buyers
 * Add a buyer to potential buyers list (creates placeholder invoice)
 * DELETE /api/suppliers/potential-buyers?buyerId=XXX
 * Remove a buyer from potential buyers list (deletes placeholder invoice)
 * 
 * Uses placeholder invoices (amount = 0, invoiceNumber starts with "PLACEHOLDER-")
 * to track potential buyers without creating real invoice relationships.
 */

async function getSupplier(request: NextRequest, body?: any): Promise<any | null> {
  // Get supplier from session
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  let supplier: any = null

  if (sessionToken) {
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

  // Fallback: try to get from request body (for dev mode POST requests)
  if (!supplier && body?.supplierId) {
    supplier = await prisma.user.findUnique({
      where: { userId: body.supplierId.toUpperCase() },
    })
  }

  return supplier
}

export async function GET(request: NextRequest) {
  try {
    const supplier = await getSupplier(request)

    if (!supplier || supplier.type !== 'SUPPLIER') {
      return NextResponse.json(
        { success: false, error: 'Supplier not found or not authenticated' },
        { status: 401 }
      )
    }

    // Get potential buyers (buyers with placeholder invoices only)
    const placeholderInvoices = await prisma.invoice.findMany({
      where: {
        supplierId: supplier.id,
        invoiceNumber: {
          startsWith: 'PLACEHOLDER-',
        },
      },
      include: {
        buyer: true,
      },
      distinct: ['buyerId'],
    })

    // Get buyer IDs that only have placeholder invoices (no real invoices)
    const buyerIds: string[] = []
    for (const invoice of placeholderInvoices) {
      const realInvoices = await prisma.invoice.findFirst({
        where: {
          supplierId: supplier.id,
          buyerId: invoice.buyerId,
          NOT: {
            invoiceNumber: {
              startsWith: 'PLACEHOLDER-',
            },
          },
        },
      })

      // Only include if no real invoices exist
      if (!realInvoices) {
        buyerIds.push(invoice.buyer.userId)
      }
    }
    
    return NextResponse.json({
      success: true,
      buyerIds: buyerIds,
    })
  } catch (error) {
    console.error('Error fetching potential buyers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch potential buyers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supplier = await getSupplier(request, body)

    if (!supplier || supplier.type !== 'SUPPLIER') {
      return NextResponse.json(
        { success: false, error: 'Supplier not found or not authenticated' },
        { status: 401 }
      )
    }

    const { buyerId } = body

    if (!buyerId) {
      return NextResponse.json(
        { success: false, error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Find buyer
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerId.toUpperCase() },
    })

    if (!buyer || buyer.type !== 'BUYER') {
      return NextResponse.json(
        { success: false, error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Check if already has placeholder invoice
    const existingPlaceholder = await prisma.invoice.findFirst({
      where: {
        supplierId: supplier.id,
        buyerId: buyer.id,
        invoiceNumber: {
          startsWith: 'PLACEHOLDER-',
        },
      },
    })

    if (existingPlaceholder) {
      return NextResponse.json({
        success: true,
        message: 'Buyer already in potential buyers list',
      })
    }

    // Check if has real invoices (if so, they're not a potential buyer)
    const realInvoice = await prisma.invoice.findFirst({
      where: {
        supplierId: supplier.id,
        buyerId: buyer.id,
        NOT: {
          invoiceNumber: {
            startsWith: 'PLACEHOLDER-',
          },
        },
      },
    })

    if (realInvoice) {
      return NextResponse.json({
        success: false,
        error: 'Buyer already has invoices with this supplier',
      })
    }

    // Create placeholder invoice
    const invoiceNumber = `PLACEHOLDER-${Date.now()}-${buyer.userId}`
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        supplierId: supplier.id,
        buyerId: buyer.id,
        amount: 0,
        dueDate: new Date(),
        status: 'PENDING',
        notes: 'Potential buyer - added from search',
      },
    })
    
    return NextResponse.json({
      success: true,
      message: `Buyer ${buyerId} added to potential buyers`,
    })
  } catch (error) {
    console.error('Error adding potential buyer:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add potential buyer' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supplier = await getSupplier(request)

    if (!supplier || supplier.type !== 'SUPPLIER') {
      return NextResponse.json(
        { success: false, error: 'Supplier not found or not authenticated' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const buyerId = searchParams.get('buyerId')

    if (!buyerId) {
      return NextResponse.json(
        { success: false, error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Find buyer
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerId.toUpperCase() },
    })

    if (!buyer) {
      return NextResponse.json(
        { success: false, error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Delete placeholder invoices for this buyer
    await prisma.invoice.deleteMany({
      where: {
        supplierId: supplier.id,
        buyerId: buyer.id,
        invoiceNumber: {
          startsWith: 'PLACEHOLDER-',
        },
      },
    })
    
    return NextResponse.json({
      success: true,
      message: `Buyer ${buyerId} removed from potential buyers`,
    })
  } catch (error) {
    console.error('Error removing potential buyer:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove potential buyer' },
      { status: 500 }
    )
  }
}
