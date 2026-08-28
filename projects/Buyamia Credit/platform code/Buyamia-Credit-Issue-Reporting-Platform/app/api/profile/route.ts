import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/profile
 * Get user profile with score history and stats
 */
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

    // Get user
    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        scoreHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const isBuyer = user.type === 'BUYER'

    // Get score history formatted
    const scoreHistory = user.scoreHistory.map((entry) => ({
      date: entry.createdAt.toISOString().split('T')[0],
      score: entry.score,
    }))

    // For buyers: calculate payment stats
    let paymentStats = null
    if (isBuyer) {
      const invoices = await prisma.invoice.findMany({
        where: { buyerId: user.id },
      })

      const paidInvoices = invoices.filter(inv => inv.status === 'PAID')
      const overdueInvoices = invoices.filter(
        inv => inv.status === 'OVERDUE_3' || inv.status === 'OVERDUE_7' || inv.status === 'DEFAULTED'
      )

      // Calculate on-time payment percentage
      const onTimePaid = paidInvoices.filter(
        inv => inv.paidAt && inv.paidAt <= inv.dueDate
      ).length
      const onTimePercent = paidInvoices.length > 0
        ? Math.round((onTimePaid / paidInvoices.length) * 100)
        : 0

      // Calculate average delay days
      const latePaid = paidInvoices.filter(
        inv => inv.paidAt && inv.paidAt > inv.dueDate
      )
      const totalDelayDays = latePaid.reduce((sum, inv) => {
        if (inv.paidAt && inv.dueDate) {
          const diffTime = inv.paidAt.getTime() - inv.dueDate.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          return sum + diffDays
        }
        return sum
      }, 0)
      const avgDelayDays = latePaid.length > 0
        ? Number((totalDelayDays / latePaid.length).toFixed(1))
        : 0

      paymentStats = {
        onTimePercent,
        avgDelayDays,
        totalOverdue: overdueInvoices.length,
        totalPaid: paidInvoices.length,
      }
    }

    // For suppliers: calculate reliability metrics
    let reliabilityMetrics = null
    if (!isBuyer) {
      const invoices = await prisma.invoice.findMany({
        where: { supplierId: user.id },
      })

      // Get all issues for this supplier
      const allIssues = await prisma.issue.findMany({
        where: { supplierId: user.id },
      })

      // Calculate on-time delivery (simplified: based on invoices without delays)
      // In production, this would use actual delivery dates from orders
      const totalInvoices = invoices.length
      const invoicesWithIssues = invoices.filter(inv => {
        return allIssues.some(issue => issue.orderId === inv.orderId)
      })
      const onTimeDelivery = totalInvoices > 0
        ? Math.round(((totalInvoices - invoicesWithIssues.length) / totalInvoices) * 100)
        : 0

      // Calculate issue resolution rate
      const resolvedIssues = allIssues.filter(issue => issue.status === 'RESOLVED' || issue.status === 'CLOSED')
      const issueResolutionRate = allIssues.length > 0
        ? Math.round((resolvedIssues.length / allIssues.length) * 100)
        : 0

      // Order accuracy (simplified: based on issues)
      const wrongItemsIssues = allIssues.filter(issue => issue.type === 'WRONG_ITEMS').length
      const orderAccuracy = totalInvoices > 0
        ? Math.round(((totalInvoices - wrongItemsIssues) / totalInvoices) * 100)
        : 0

      reliabilityMetrics = {
        onTimeDelivery,
        issueResolutionRate,
        orderAccuracy,
        totalOrders: totalInvoices,
        completedOrders: invoices.filter(inv => inv.status === 'PAID').length,
      }
    }

    // Format response
    const profile = {
      userId: user.userId,
      type: user.type,
      businessName: user.businessName,
      phoneNumber: user.phoneNumber,
      address: user.address || '',
      creditScore: user.creditScore,
      scoreHistory,
      ...(isBuyer && paymentStats ? { paymentStats } : {}),
      ...(!isBuyer && reliabilityMetrics ? { reliabilityScore: user.creditScore, reliabilityMetrics } : {}),
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Profile API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

