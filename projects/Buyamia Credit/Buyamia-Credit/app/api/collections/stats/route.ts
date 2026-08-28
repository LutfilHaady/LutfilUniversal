import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

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
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const invoices = await prisma.invoice.findMany({
      where: { supplierId: user.id },
      include: {
        collectionAttempts: true,
      },
    })

    // Return default stats if no invoices found
    if (invoices.length === 0) {
      return NextResponse.json({
        activeCollections: 0,
        totalAttempts: 0,
        responseRate: 0,
        paymentRate: 0,
        averageTimeToPayment: 0,
        totalOutstanding: 0,
        buyersNotResponding: 0,
      })
    }

    const activeCollections = invoices.filter(
      inv => inv.collectionStatus === 'IN_PROGRESS' || inv.collectionStatus === 'ESCALATED'
    ).length

    const totalAttempts = await prisma.collectionAttempt.count({
      where: {
        invoice: {
          supplierId: user.id,
        },
      },
    })

    const attemptsWithResponse = await prisma.collectionAttempt.count({
      where: {
        invoice: {
          supplierId: user.id,
        },
        response: {
          not: null,
        },
      },
    })

    const responseRate = totalAttempts > 0
      ? Math.round((attemptsWithResponse / totalAttempts) * 100)
      : 0

    const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length
    const paymentRate = invoices.length > 0
      ? Math.round((paidInvoices / invoices.length) * 100)
      : 0

    const paidInvoicesWithAttempts = invoices.filter(
      inv => inv.status === 'PAID' && inv.lastCollectionAttempt
    )
    const totalDaysToPayment = paidInvoicesWithAttempts.reduce((sum, inv) => {
      if (inv.lastCollectionAttempt && inv.paidAt) {
        const diffTime = inv.paidAt.getTime() - inv.lastCollectionAttempt.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return sum + diffDays
      }
      return sum
    }, 0)
    const averageTimeToPayment = paidInvoicesWithAttempts.length > 0
      ? Math.round(totalDaysToPayment / paidInvoicesWithAttempts.length)
      : 0

    const totalOutstanding = invoices
      .filter(inv => inv.status !== 'PAID')
      .reduce((sum, inv) => sum + Number(inv.amount), 0)

    const buyersNotResponding = await prisma.invoice.groupBy({
      by: ['buyerId'],
      where: {
        supplierId: user.id,
        status: {
          in: ['OVERDUE_3', 'OVERDUE_7', 'DEFAULTED'],
        },
        collectionAttempts: {
          some: {
            response: null,
          },
        },
      },
    })

    return NextResponse.json({
      activeCollections,
      totalAttempts,
      responseRate,
      paymentRate,
      averageTimeToPayment,
      totalOutstanding,
      buyersNotResponding: buyersNotResponding.length,
    })
  } catch (error) {
    console.error('Collections Stats API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collection statistics' },
      { status: 500 }
    )
  }
}
