import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/suppliers/blacklist/[buyerId]
 * Remove a buyer from blacklist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { buyerId: string } }
) {
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

    const buyerId = params.buyerId?.toUpperCase()

    if (!buyerId) {
      return NextResponse.json(
        { error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Find buyer
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerId },
    })

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Delete blacklist entry
    await prisma.supplierBlacklist.deleteMany({
      where: {
        supplierId: supplier.id,
        buyerId: buyer.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Buyer removed from blacklist',
    })
  } catch (error) {
    console.error('[API] Blacklist DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to remove buyer from blacklist' },
      { status: 500 }
    )
  }
}
