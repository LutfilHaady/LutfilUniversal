import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          error:
            'DATABASE_URL is not set. Add it to your project .env (not .env.example) and restart the dev server.',
        },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const userType = searchParams.get('userType')

    if (!userId || !userType) {
      return NextResponse.json(
        { error: 'userId and userType are required' },
        { status: 400 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/dashboard/route.ts:27',message:'Database query starting',data:{userId,userType,hasDatabaseUrl:!!process.env.DATABASE_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion
    
    // Check if prisma is properly initialized
    if (!prisma || !prisma.user) {
      console.error('[Dashboard] Prisma client not properly initialized')
      return NextResponse.json(
        { error: 'Database connection failed. Prisma client not initialized.' },
        { status: 500 }
      )
    }
    
    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        invoicesAsBuyer: {
          include: {
            supplier: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        invoicesAsSupplier: {
          include: {
            buyer: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (userType === 'SUPPLIER') {
      const invoices = user.invoicesAsSupplier
      
      // Filter out placeholder invoices for all calculations
      const realInvoices = invoices.filter(
        inv => !inv.invoiceNumber.startsWith('PLACEHOLDER-')
      )

      const buyers = await prisma.user.findMany({
        where: {
          id: {
            in: Array.from(new Set(invoices.map(inv => inv.buyerId))),
          },
        },
        include: {
          invoicesAsBuyer: {
            where: {
              supplierId: user.id,
            },
          },
        },
      })

      // Get blacklisted buyer IDs for this supplier from database
      let blacklistedBuyerIds = new Set<string>()
      try {
        if (prisma && 'supplierBlacklist' in prisma && (prisma as any).supplierBlacklist) {
          const blacklistEntries = await (prisma as any).supplierBlacklist.findMany({
            where: { supplierId: user.id },
            select: { buyerId: true },
          })
          blacklistedBuyerIds = new Set(blacklistEntries.map((e: any) => e.buyerId))
        }
      } catch (error) {
        console.error('[Dashboard] Error fetching blacklist:', error)
        // Continue with empty set if blacklist can't be fetched
      }

      const buyersData = buyers
        .filter(buyer => !blacklistedBuyerIds.has(buyer.id)) // Filter out blacklisted buyers by default
        .map(buyer => {
          const buyerInvoices = buyer.invoicesAsBuyer
          const totalOutstanding = buyerInvoices
            .filter(inv => inv.status !== 'PAID')
            .reduce((sum, inv) => sum + Number(inv.amount), 0)
          const paidInvoices = buyerInvoices.filter(inv => inv.status === 'PAID').length
          const lastPayment = buyerInvoices
            .filter(inv => inv.paidAt)
            .sort((a, b) => (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0))[0]

          let status = 'Low Risk'
          if (buyer.creditScore < 50) status = 'High Risk'
          else if (buyer.creditScore < 70) status = 'Medium Risk'

          return {
            buyerId: buyer.userId,
            businessName: buyer.businessName,
            creditScore: buyer.creditScore,
            totalOutstanding,
            status,
            lastPaymentDate: lastPayment?.paidAt?.toISOString() || null,
            totalInvoices: buyerInvoices.length,
            paidInvoices,
            preferredPaymentTerm: buyer.preferredPaymentTerm || 'NET14',
            isBlacklisted: false, // Already filtered out blacklisted buyers
          }
        })

      // Get count of blacklisted buyers for summary
      const blacklistedCount = blacklistedBuyerIds.size

      const ongoingOrders = invoices
        .filter(inv => inv.status !== 'PAID' && !inv.invoiceNumber.startsWith('PLACEHOLDER-'))
        .slice(0, 10)
        .map(inv => {
          const dueDate = new Date(inv.dueDate)
          const now = new Date()
          const diffTime = dueDate.getTime() - now.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          let status = 'PENDING'
          let daysUntilDue: number | undefined = diffDays
          let daysOverdue: number | undefined = undefined

          if (diffDays < 0) {
            status = 'OVERDUE'
            daysOverdue = Math.abs(diffDays)
            daysUntilDue = undefined
          } else if (diffDays <= 3) {
            status = 'DUE_SOON'
          }

          return {
            invoiceNumber: inv.invoiceNumber,
            buyerId: inv.buyer.userId,
            buyerName: inv.buyer.businessName,
            amount: inv.amount,
            dueDate: inv.dueDate.toISOString(),
            status,
            daysUntilDue,
            daysOverdue,
            orderId: inv.orderId || `ORD${Math.floor(Math.random() * 10000)}`,
            paymentTerm: inv.buyer.preferredPaymentTerm || 'NET14',
          }
        })

      const totalInvoices = invoices.length
      const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length
      const onTimeDelivery = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0

      // Calculate issue resolution rate from actual issues
      let allIssues: any[] = []
      try {
        // Check if prisma.issue exists before using it
        if (prisma && 'issue' in prisma && prisma.issue) {
          allIssues = await (prisma.issue as any).findMany({
            where: { supplierId: user.id },
          })
        } else {
          console.warn('[Dashboard] prisma.issue not available, using empty array')
          allIssues = []
        }
      } catch (error) {
        console.error('[Dashboard] Error fetching issues:', error)
        // Continue with empty array if issues can't be fetched
        allIssues = []
      }
      const resolvedIssues = allIssues.filter(issue => issue.status === 'RESOLVED' || issue.status === 'CLOSED')
      const issueResolutionRate = allIssues.length > 0
        ? Math.round((resolvedIssues.length / allIssues.length) * 100)
        : 0

      // Calculate order accuracy (based on wrong items issues)
      const wrongItemsIssues = allIssues.filter(issue => issue.type === 'WRONG_ITEMS').length
      const orderAccuracy = totalInvoices > 0
        ? Math.round(((totalInvoices - wrongItemsIssues) / totalInvoices) * 100)
        : 0

      // Average delivery time (simplified: based on invoice creation to payment time)
      // In production, this would use actual delivery dates from orders
      // Filter out placeholder invoices and ensure paidAt is after createdAt
      const paidInvoicesWithDates = realInvoices.filter(
        inv => inv.status === 'PAID' && inv.paidAt && inv.createdAt && inv.paidAt >= inv.createdAt
      )
      const totalDeliveryDays = paidInvoicesWithDates.reduce((sum, inv) => {
        if (inv.paidAt && inv.createdAt) {
          const diffTime = inv.paidAt.getTime() - inv.createdAt.getTime()
          const diffDays = diffTime / (1000 * 60 * 60 * 24)
          // Only count positive values (payment should be after invoice creation)
          return sum + Math.max(0, diffDays)
        }
        return sum
      }, 0)
      const averageDeliveryTime = paidInvoicesWithDates.length > 0
        ? Number((totalDeliveryDays / paidInvoicesWithDates.length).toFixed(1))
        : 0

      // Calculate Financial Dashboard Metrics
      const now = new Date()
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      
      // Total Receivables (sum of all unpaid invoices, excluding placeholders)
      const unpaidInvoices = realInvoices.filter(
        inv => inv.status !== 'PAID'
      )
      const totalReceivables = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)
      
      // Total Receivables from last month (for comparison)
      const lastMonthInvoices = realInvoices.filter(
        inv => inv.createdAt <= oneMonthAgo && inv.status !== 'PAID'
      )
      const lastMonthReceivables = lastMonthInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)
      const receivablesChange = lastMonthReceivables > 0 
        ? Math.round(((totalReceivables - lastMonthReceivables) / lastMonthReceivables) * 100)
        : 0
      
      // Overdue Amount (invoices past due date and not paid)
      const overdueInvoices = unpaidInvoices.filter(inv => {
        const dueDate = new Date(inv.dueDate)
        return dueDate < now
      })
      const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)
      
      // Active Buyers (buyers with at least one unpaid invoice, excluding blacklisted)
      const activeBuyers = buyersData.filter(buyer => buyer.totalOutstanding > 0).length
      
      // Calculate Days Sales Outstanding (DSO) - Average days from due date to payment
      // Positive = paid after due date (late), Negative = paid before due date (early)
      const paidInvoicesForDSO = realInvoices.filter(
        inv => inv.status === 'PAID' && inv.paidAt && inv.dueDate
      )
      const totalDSODays = paidInvoicesForDSO.reduce((sum, inv) => {
        if (inv.paidAt && inv.dueDate) {
          // Calculate days from due date to payment date
          // Negative = paid early (good), Positive = paid late (bad)
          const days = Math.floor((inv.paidAt.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }
        return sum
      }, 0)
      const avgDaysSalesOutstanding = paidInvoicesForDSO.length > 0
        ? Math.round(totalDSODays / paidInvoicesForDSO.length)
        : 0
      
      // Invoice Aging Report
      const agingData = {
        current: 0,      // Not overdue
        days1to30: 0,    // 1-30 days overdue
        days31to60: 0,  // 31-60 days overdue
        days60Plus: 0,  // 60+ days overdue
      }
      
      unpaidInvoices.forEach(inv => {
        const dueDate = new Date(inv.dueDate)
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        const amount = Number(inv.amount)
        
        if (daysOverdue < 0) {
          agingData.current += amount
        } else if (daysOverdue <= 30) {
          agingData.days1to30 += amount
        } else if (daysOverdue <= 60) {
          agingData.days31to60 += amount
        } else {
          agingData.days60Plus += amount
        }
      })
      
      // Portfolio Risk Distribution
      const riskDistribution = {
        high: 0,
        medium: 0,
        low: 0,
      }
      
      buyersData.forEach(buyer => {
        if (buyer.status === 'High Risk') riskDistribution.high++
        else if (buyer.status === 'Medium Risk') riskDistribution.medium++
        else riskDistribution.low++
      })
      
      const totalBuyersForRisk = riskDistribution.high + riskDistribution.medium + riskDistribution.low

      return NextResponse.json({
        userId: user.userId,
        userType: 'SUPPLIER',
        businessName: user.businessName,
        reliabilityScore: user.creditScore,
        buyers: buyersData,
        ongoingOrders,
        reliabilityMetrics: {
          onTimeDelivery,
          issueResolutionRate,
          orderAccuracy,
          averageDeliveryTime,
        },
        paymentMetrics: {
          blacklistedBuyersCount: blacklistedCount,
        },
        financialMetrics: {
          totalReceivables,
          receivablesChange,
          overdueAmount,
          activeBuyers,
          avgDaysSalesOutstanding,
          invoiceAging: agingData,
          riskDistribution: totalBuyersForRisk > 0 ? {
            high: Math.round((riskDistribution.high / totalBuyersForRisk) * 100),
            medium: Math.round((riskDistribution.medium / totalBuyersForRisk) * 100),
            low: Math.round((riskDistribution.low / totalBuyersForRisk) * 100),
          } : { high: 0, medium: 0, low: 0 },
        },
      })
    } else {
      const invoices = user.invoicesAsBuyer

      const suppliers = await prisma.user.findMany({
        where: {
          id: {
            in: Array.from(new Set(invoices.map(inv => inv.supplierId))),
          },
        },
        include: {
          invoicesAsSupplier: {
            where: {
              buyerId: user.id,
            },
          },
        },
      })

      const suppliersData = suppliers.map(supplier => {
        const supplierInvoices = supplier.invoicesAsSupplier
        const completedOrders = supplierInvoices.filter(inv => inv.status === 'PAID').length
        const onTimeDelivery = supplierInvoices.length > 0
          ? Math.round((completedOrders / supplierInvoices.length) * 100)
          : 0
        const lastOrder = supplierInvoices
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]

        let status = 'High Reliability'
        if (supplier.creditScore < 60) status = 'Low Reliability'
        else if (supplier.creditScore < 75) status = 'Medium Reliability'

        return {
          supplierId: supplier.userId,
          businessName: supplier.businessName,
          reliabilityScore: supplier.creditScore,
          totalOrders: supplierInvoices.length,
          completedOrders,
          onTimeDelivery,
          status,
          lastOrderDate: lastOrder?.createdAt.toISOString() || null,
        }
      })

      const ongoingOrders = invoices
        .filter(inv => inv.status !== 'PAID' && !inv.invoiceNumber.startsWith('PLACEHOLDER-'))
        .slice(0, 10)
        .map(inv => {
          const dueDate = new Date(inv.dueDate)
          const now = new Date()
          const diffTime = dueDate.getTime() - now.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

          let status = 'PENDING'
          let daysUntilDue: number | undefined = diffDays
          let daysOverdue: number | undefined = undefined

          if (diffDays < 0) {
            status = 'OVERDUE'
            daysOverdue = Math.abs(diffDays)
            daysUntilDue = undefined
          } else if (diffDays <= 3) {
            status = 'DUE_SOON'
          }

          return {
            invoiceNumber: inv.invoiceNumber,
            supplierId: inv.supplier.userId,
            supplierName: inv.supplier.businessName,
            amount: inv.amount,
            dueDate: inv.dueDate.toISOString(),
            status,
            daysUntilDue,
            daysOverdue,
            orderId: inv.orderId || `ORD${Math.floor(Math.random() * 10000)}`,
            paymentTerm: user.preferredPaymentTerm || 'NET14',
          }
        })

      const totalPayments = invoices.length
      const onTimePayments = invoices.filter(
        inv => inv.status === 'PAID' && inv.paidAt && inv.paidAt <= inv.dueDate
      ).length
      const latePayments = invoices.filter(
        inv => inv.status === 'PAID' && inv.paidAt && inv.paidAt > inv.dueDate
      ).length
      const defaultedPayments = invoices.filter(inv => inv.status === 'DEFAULTED').length

      const onTimePaymentRate = totalPayments > 0 ? Math.round((onTimePayments / totalPayments) * 100) : 0
      const latePaymentRate = totalPayments > 0 ? Math.round((latePayments / totalPayments) * 100) : 0

      // Calculate average payment delay from actual late payments
      const latePaymentsWithDates = invoices.filter(
        inv => inv.status === 'PAID' && inv.paidAt && inv.paidAt > inv.dueDate
      )
      const totalDelayDays = latePaymentsWithDates.reduce((sum, inv) => {
        if (inv.paidAt && inv.dueDate) {
          const diffTime = inv.paidAt.getTime() - inv.dueDate.getTime()
          const diffDays = diffTime / (1000 * 60 * 60 * 24)
          return sum + diffDays
        }
        return sum
      }, 0)
      const averagePaymentDelay = latePaymentsWithDates.length > 0
        ? Number((totalDelayDays / latePaymentsWithDates.length).toFixed(1))
        : 0

      return NextResponse.json({
        userId: user.userId,
        userType: 'BUYER',
        businessName: user.businessName,
        creditScore: user.creditScore,
        paymentMetrics: {
          onTimePaymentRate,
          latePaymentRate,
          averagePaymentDelay,
          totalPayments,
          onTimePayments,
          latePayments,
          defaultedPayments,
        },
        suppliers: suppliersData,
        ongoingOrders,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const name = error instanceof Error ? error.name : 'UnknownError'

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/dashboard/route.ts:325',message:'Database error caught',data:{errorName:name,errorMessage:message,hasDatabaseUrl:!!process.env.DATABASE_URL,dbUrlPrefix:process.env.DATABASE_URL?.substring(0,25)||'MISSING',isPrismaInitError:name.includes('PrismaClientInitializationError')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D'})}).catch(()=>{});
    // #endregion

    console.error('Dashboard API Error:', {
      name,
      message,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      databaseUrlStartsWith: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.slice(0, 16)
        : null,
    })

    if (
      name === 'PrismaClientInitializationError' ||
      message.toLowerCase().includes('prismaclientinitializationerror')
    ) {
      return NextResponse.json(
        {
          error:
            'Database connection failed (PrismaClientInitializationError). Verify DATABASE_URL, ensure Postgres is reachable, and run prisma migrations.',
          details: message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}
