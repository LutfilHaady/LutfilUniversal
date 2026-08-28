import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/suppliers/buyers
 * Add a buyer to supplier's buyer list by creating a placeholder invoice
 * This establishes the relationship between supplier and buyer
 */
export async function POST(request: NextRequest) {
  try {
    // Get supplier from session
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
    let supplier: any = null

    if (sessionToken) {
      const session = await getSessionByToken(sessionToken)
      if (session?.user && session.user.type === 'SUPPLIER') {
        supplier = session.user
      }
    }

    const body = await request.json()
    const { buyerId, supplierId: devSupplierId } = body as {
      buyerId: string
      supplierId?: string
    }

    // Fallback: try to get from body (for dev mode)
    if (!supplier && devSupplierId) {
      supplier = await prisma.user.findUnique({
        where: { userId: devSupplierId.toUpperCase() },
      })
    }

    if (!supplier || supplier.type !== 'SUPPLIER') {
      return NextResponse.json(
        { success: false, error: 'Supplier not found or not authenticated' },
        { status: 401 }
      )
    }

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

    // Check if relationship already exists (has invoice)
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        supplierId: supplier.id,
        buyerId: buyer.id,
      },
    })

    if (existingInvoice) {
      return NextResponse.json({
        success: true,
        message: 'Buyer already in your list',
        invoiceId: existingInvoice.id,
      })
    }

    // Create placeholder invoice to establish relationship
    // Use a special invoice number to indicate it's a placeholder
    const invoiceNumber = `PLACEHOLDER-${Date.now()}-${buyer.userId}`
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        supplierId: supplier.id,
        buyerId: buyer.id,
        amount: 0,
        dueDate: new Date(),
        status: 'PENDING',
        notes: 'Initial relationship invoice - created when buyer was added',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Buyer ${buyerId} added successfully`,
      invoiceId: invoice.id,
    })
  } catch (error) {
    console.error('Error adding buyer:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add buyer' },
      { status: 500 }
    )
  }
}

