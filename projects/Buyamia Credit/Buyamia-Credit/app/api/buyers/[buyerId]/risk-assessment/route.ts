import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRiskLevel } from '@/lib/utils/buyer-credit'

/**
 * GET /api/buyers/[buyerId]/risk-assessment
 * Calculate AI risk assessment based on real buyer data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { buyerId: string } }
) {
  try {
    const buyerId = params.buyerId?.toUpperCase()

    if (!buyerId) {
      return NextResponse.json(
        { error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Get supplier from query params (for supplier-specific assessment)
    const supplierId = request.nextUrl.searchParams.get('supplierId')

    // Find supplier if supplierId provided
    let supplier: any = null
    if (supplierId) {
      supplier = await prisma.user.findUnique({
        where: { userId: supplierId.toUpperCase() },
      })
    }

    // Find buyer
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerId },
    })

    if (!buyer || buyer.type !== 'BUYER') {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Get invoices and issues (filtered by supplier if provided)
    const invoiceWhere = supplier ? { buyerId: buyer.id, supplierId: supplier.id } : { buyerId: buyer.id }
    const issueWhere = supplier ? { buyerId: buyer.id, supplierId: supplier.id } : { buyerId: buyer.id }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
    })

    const issues = await prisma.issue.findMany({
      where: issueWhere,
    })

    // Calculate metrics from real data

    const now = new Date()
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID')
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'PAID')
    const overdueInvoices = invoices.filter(inv => {
      const dueDate = new Date(inv.dueDate)
      return dueDate < now && inv.status !== 'PAID'
    })
    const disputedIssues = issues.filter(issue => issue.status === 'OPEN' || issue.status === 'RESOLVED')
    const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)

    // Calculate flagged factors
    const hasNoPaidInvoices = paidInvoices.length === 0
    const hasOverdueInvoices = overdueInvoices.length > 0
    const hasDisputedInvoices = disputedIssues.length > 0
    const hasHighHistoricalRisk = buyer.creditScore < 50
    const hasOutstandingDebt = totalOutstanding > 0

    // Calculate AI Score (0-100)
    // Aligned with credit score calculation: credit score already considers payment history, 
    // payment behavior, and risk factors, so it should be the primary component
    
    // Base: Start with credit score (65% weight) - this already includes payment history/behavior
    let aiScore = buyer.creditScore * 0.65
    
    // Adjustments for recent/specific factors not fully captured in credit score (35% adjustment range)
    let adjustment = 0
    
    // For buyers with invoices: add small adjustments
    if (invoices.length > 0) {
      const paymentRate = paidInvoices.length / invoices.length
      const overdueRate = overdueInvoices.length / invoices.length
      const issueRate = disputedIssues.length / invoices.length
      
      // Payment rate bonus (0-15 points): Reward good payment rates
      // If payment rate is 100%, give +15. If 0%, give 0.
      adjustment += paymentRate * 15
      
      // Overdue penalty (0 to -10 points): Penalize overdue, but less harshly
      // If all overdue, -10 max. Scale linearly.
      adjustment -= overdueRate * 10
      
      // Issues penalty (0 to -5 points): Small penalty for disputes
      // Cap at -5 to prevent too much impact
      adjustment -= Math.min(issueRate * 5, 5)
      
      // Outstanding debt penalty (0 to -5 points): Penalize large outstanding relative to total
      if (totalOutstanding > 0 && invoices.length > 0) {
        const avgInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0) / invoices.length
        if (avgInvoiceAmount > 0) {
          const outstandingRatio = Math.min(totalOutstanding / (avgInvoiceAmount * invoices.length), 1)
          adjustment -= outstandingRatio * 5
        }
      }
    } else {
      // No invoice history: give baseline based on credit score
      // Buyers with no history get 70% of their credit score as baseline
      adjustment = (buyer.creditScore * 0.70) - aiScore
    }
    
    // Apply adjustment and ensure score is between 0-100
    aiScore = Math.max(0, Math.min(100, Math.round(aiScore + adjustment)))

    // Determine risk level - aligned with credit score thresholds
    // Credit score already considers payment behavior, so AI score is close to credit score
    // Use AI score but keep credit score as strong indicator
    let riskLevel: 'Critical Risk' | 'High Risk' | 'Medium Risk' | 'Low Risk'
    
    // Critical Risk: Very low credit score (< 30) with severe issues
    if (buyer.creditScore < 30 && hasOverdueInvoices && hasNoPaidInvoices) {
      riskLevel = 'Critical Risk'
    }
    // High Risk: Credit score < 50 or AI score < 50 (with some exceptions)
    else if (buyer.creditScore < 50 || aiScore < 50) {
      riskLevel = 'High Risk'
    }
    // Medium Risk: Credit score < 70 or AI score < 70
    else if (buyer.creditScore < 70 || aiScore < 70) {
      riskLevel = 'Medium Risk'
    }
    // Low Risk: Good credit score and AI score
    else {
      riskLevel = 'Low Risk'
    }

    // Generate description based on actual data
    let description = ''
    if (riskLevel === 'Critical Risk') {
      description = `The buyer presents critical credit risk due to ${hasNoPaidInvoices ? 'zero paid invoices' : 'poor payment history'}, ${hasOverdueInvoices ? 'overdue invoices' : ''}, ${hasDisputedInvoices ? 'disputed invoices' : ''}, and a credit score of ${buyer.creditScore}. The current outstanding of ${totalOutstanding.toLocaleString('id-ID')} further highlights financial instability.`
    } else if (riskLevel === 'High Risk') {
      description = `The buyer shows high credit risk with a credit score of ${buyer.creditScore}${hasOverdueInvoices ? ', overdue invoices' : ''}${hasDisputedInvoices ? ', and disputed issues' : ''}. Payment history shows ${paidInvoices.length} paid out of ${invoices.length} total invoices.`
    } else if (riskLevel === 'Medium Risk') {
      description = `The buyer shows moderate payment behavior with ${paidInvoices.length} paid invoices out of ${invoices.length} total${hasOverdueInvoices ? ' and some overdue payments' : ''}. Credit score of ${buyer.creditScore} indicates acceptable but not excellent standing.`
    } else {
      description = `The buyer demonstrates ${paidInvoices.length > 0 ? 'excellent' : 'good'} payment behavior with ${paidInvoices.length} paid invoices out of ${invoices.length} total${paidInvoices.length === invoices.length ? ' (100% payment rate)' : ''} and a strong credit score of ${buyer.creditScore}.`
    }

    // Calculate recommended credit limit
    // Base on credit score and payment history
    let recommendedCreditLimit = 0
    if (riskLevel === 'Low Risk') {
      recommendedCreditLimit = Math.max(50000000, buyer.creditScore * 1000000) // 50M minimum for low risk
    } else if (riskLevel === 'Medium Risk') {
      recommendedCreditLimit = Math.max(20000000, buyer.creditScore * 500000) // 20M minimum for medium risk
    } else if (riskLevel === 'High Risk') {
      recommendedCreditLimit = Math.max(5000000, buyer.creditScore * 200000) // 5M minimum for high risk
    }
    // Critical Risk gets 0

    const flaggedFactors = [
      { id: '1', label: 'No record of paid invoices', checked: hasNoPaidInvoices },
      { id: '2', label: 'Overdue invoices', checked: hasOverdueInvoices },
      { id: '3', label: 'Disputed invoices', checked: hasDisputedInvoices },
      { id: '4', label: 'High historical risk', checked: hasHighHistoricalRisk },
      { id: '5', label: 'Existing outstanding debt', checked: hasOutstandingDebt },
    ]

    return NextResponse.json({
      success: true,
      riskLevel,
      aiScore,
      description,
      flaggedFactors,
      recommendedCreditLimit,
      metrics: {
        creditScore: buyer.creditScore,
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        unpaidInvoices: unpaidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        disputedIssues: disputedIssues.length,
        totalOutstanding,
        paymentRate: invoices.length > 0 ? Math.round((paidInvoices.length / invoices.length) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('[API] Risk Assessment error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate risk assessment' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/buyers/[buyerId]/risk-assessment
 * Calculate and persist risk assessment to database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { buyerId: string } }
) {
  try {
    const buyerId = params.buyerId?.toUpperCase()

    if (!buyerId) {
      return NextResponse.json(
        { error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Get supplier from query params (for supplier-specific assessment)
    const supplierId = request.nextUrl.searchParams.get('supplierId')

    // Find supplier if supplierId provided
    let supplier: any = null
    if (supplierId) {
      supplier = await prisma.user.findUnique({
        where: { userId: supplierId.toUpperCase() },
      })
    }

    // Find buyer
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerId },
    })

    if (!buyer || buyer.type !== 'BUYER') {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Get invoices and issues (filtered by supplier if provided)
    const invoiceWhere = supplier ? { buyerId: buyer.id, supplierId: supplier.id } : { buyerId: buyer.id }
    const issueWhere = supplier ? { buyerId: buyer.id, supplierId: supplier.id } : { buyerId: buyer.id }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
    })

    const issues = await prisma.issue.findMany({
      where: issueWhere,
    })

    // Calculate metrics from real data
    const now = new Date()
    const paidInvoices = invoices.filter(inv => inv.status === 'PAID')
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'PAID')
    const overdueInvoices = invoices.filter(inv => {
      const dueDate = new Date(inv.dueDate)
      return dueDate < now && inv.status !== 'PAID'
    })
    const disputedIssues = issues.filter(issue => issue.status === 'OPEN' || issue.status === 'RESOLVED')
    const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)

    // Calculate flagged factors
    const hasNoPaidInvoices = paidInvoices.length === 0
    const hasOverdueInvoices = overdueInvoices.length > 0
    const hasDisputedInvoices = disputedIssues.length > 0
    const hasHighHistoricalRisk = buyer.creditScore < 50
    const hasOutstandingDebt = totalOutstanding > 0

    // Calculate AI Score (0-100)
    // Aligned with credit score calculation: credit score already considers payment history, 
    // payment behavior, and risk factors, so it should be the primary component
    
    // Base: Start with credit score (65% weight) - this already includes payment history/behavior
    let aiScore = buyer.creditScore * 0.65
    
    // Adjustments for recent/specific factors not fully captured in credit score (35% adjustment range)
    let adjustment = 0
    
    // For buyers with invoices: add small adjustments
    if (invoices.length > 0) {
      const paymentRate = paidInvoices.length / invoices.length
      const overdueRate = overdueInvoices.length / invoices.length
      const issueRate = disputedIssues.length / invoices.length
      
      // Payment rate bonus (0-15 points): Reward good payment rates
      // If payment rate is 100%, give +15. If 0%, give 0.
      adjustment += paymentRate * 15
      
      // Overdue penalty (0 to -10 points): Penalize overdue, but less harshly
      // If all overdue, -10 max. Scale linearly.
      adjustment -= overdueRate * 10
      
      // Issues penalty (0 to -5 points): Small penalty for disputes
      // Cap at -5 to prevent too much impact
      adjustment -= Math.min(issueRate * 5, 5)
      
      // Outstanding debt penalty (0 to -5 points): Penalize large outstanding relative to total
      if (totalOutstanding > 0 && invoices.length > 0) {
        const avgInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0) / invoices.length
        if (avgInvoiceAmount > 0) {
          const outstandingRatio = Math.min(totalOutstanding / (avgInvoiceAmount * invoices.length), 1)
          adjustment -= outstandingRatio * 5
        }
      }
    } else {
      // No invoice history: give baseline based on credit score
      // Buyers with no history get 70% of their credit score as baseline
      adjustment = (buyer.creditScore * 0.70) - aiScore
    }
    
    // Apply adjustment and ensure score is between 0-100
    aiScore = Math.max(0, Math.min(100, Math.round(aiScore + adjustment)))

    // Determine risk level - aligned with credit score thresholds
    // Credit score already considers payment behavior, so AI score is close to credit score
    // Use AI score but keep credit score as strong indicator
    let riskLevel: 'Critical Risk' | 'High Risk' | 'Medium Risk' | 'Low Risk'
    
    // Critical Risk: Very low credit score (< 30) with severe issues
    if (buyer.creditScore < 30 && hasOverdueInvoices && hasNoPaidInvoices) {
      riskLevel = 'Critical Risk'
    }
    // High Risk: Credit score < 50 or AI score < 50 (with some exceptions)
    else if (buyer.creditScore < 50 || aiScore < 50) {
      riskLevel = 'High Risk'
    }
    // Medium Risk: Credit score < 70 or AI score < 70
    else if (buyer.creditScore < 70 || aiScore < 70) {
      riskLevel = 'Medium Risk'
    }
    // Low Risk: Good credit score and AI score
    else {
      riskLevel = 'Low Risk'
    }

    // Persist riskLevel to database
    await prisma.user.update({
      where: { id: buyer.id },
      data: { riskLevel },
    })

    return NextResponse.json({
      success: true,
      message: 'Risk assessment calculated and persisted',
      riskLevel,
      aiScore,
    })
  } catch (error) {
    console.error('[API] Risk Assessment error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate risk assessment' },
      { status: 500 }
    )
  }
}
