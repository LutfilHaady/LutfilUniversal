/**
 * Score Recalculation Utilities
 * 
 * Recalculates credit scores and reliability scores based on all historical data
 */

import { prisma } from '@/lib/prisma'
import { calculateCreditScore, calculateReliabilityScore } from './score-calculation'

/**
 * Recalculate buyer's credit score based on all payment history
 */
export async function recalculateBuyerCreditScore(buyerId: string): Promise<number> {
  // Get buyer
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
  })

  if (!buyer) {
    throw new Error('Buyer not found')
  }

  // Get all invoices for this buyer
  const invoices = await prisma.invoice.findMany({
    where: { buyerId },
    orderBy: { createdAt: 'asc' },
  })

  // Calculate metrics
  const totalInvoices = invoices.length
  const paidInvoices = invoices.filter(inv => inv.status === 'PAID').length
  const overdueInvoices = invoices.filter(
    inv => inv.status === 'OVERDUE_3' || inv.status === 'OVERDUE_7'
  ).length
  const defaultedInvoices = invoices.filter(inv => inv.status === 'DEFAULTED').length

  // Calculate on-time vs late payments
  const paidInvoicesWithDates = invoices.filter(
    inv => inv.status === 'PAID' && inv.paidAt && inv.dueDate
  )
  const onTimePayments = paidInvoicesWithDates.filter(
    inv => inv.paidAt! <= inv.dueDate
  ).length
  const latePayments = paidInvoicesWithDates.filter(
    inv => inv.paidAt! > inv.dueDate
  ).length

  // Calculate average payment delay (for late payments only)
  const latePaymentsWithDates = paidInvoicesWithDates.filter(
    inv => inv.paidAt! > inv.dueDate
  )
  const totalDelayDays = latePaymentsWithDates.reduce((sum, inv) => {
    if (inv.paidAt && inv.dueDate) {
      const diffTime = inv.paidAt.getTime() - inv.dueDate.getTime()
      const diffDays = diffTime / (1000 * 60 * 60 * 24)
      return sum + diffDays
    }
    return sum
  }, 0)
  const averagePaymentDelayDays = latePaymentsWithDates.length > 0
    ? totalDelayDays / latePaymentsWithDates.length
    : 0

  // Calculate days since first invoice
  const firstInvoice = invoices[0]
  const daysSinceFirstInvoice = firstInvoice
    ? Math.floor((Date.now() - firstInvoice.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : undefined

  // Calculate new score
  const newScore = calculateCreditScore({
    totalInvoices,
    paidInvoices,
    onTimePayments,
    latePayments,
    overdueInvoices,
    defaultedInvoices,
    averagePaymentDelayDays,
    currentScore: buyer.creditScore,
    daysSinceFirstInvoice,
  })

  // Update buyer's credit score
  await prisma.user.update({
    where: { id: buyerId },
    data: { creditScore: newScore },
  })

  return newScore
}

/**
 * Recalculate supplier's reliability score based on all order and issue history
 */
export async function recalculateSupplierReliabilityScore(supplierId: string): Promise<number> {
  // Get supplier
  const supplier = await prisma.user.findUnique({
    where: { id: supplierId },
  })

  if (!supplier) {
    throw new Error('Supplier not found')
  }

  // Get all invoices (orders) for this supplier
  const invoices = await prisma.invoice.findMany({
    where: { supplierId },
    orderBy: { createdAt: 'asc' },
  })

  // Get all issues for this supplier
  const issues = await prisma.issue.findMany({
    where: { supplierId },
  })

  // Calculate order metrics
  const totalOrders = invoices.length
  const completedOrders = invoices.filter(inv => inv.status === 'PAID').length

  // Calculate on-time deliveries (simplified: invoices without delay issues)
  // In production, this would use actual delivery dates
  const invoicesWithDelayIssues = invoices.filter(inv => {
    return issues.some(
      issue => issue.orderId === inv.orderId && issue.type === 'DELAYED'
    )
  })
  const onTimeDeliveries = completedOrders - invoicesWithDelayIssues.length

  // Calculate issue metrics
  const totalIssues = issues.length
  const resolvedIssues = issues.filter(
    issue => issue.status === 'RESOLVED' || issue.status === 'CLOSED'
  ).length
  const openIssues = issues.filter(issue => issue.status === 'OPEN').length
  const wrongItemsIssues = issues.filter(issue => issue.type === 'WRONG_ITEMS').length
  const delayedIssues = issues.filter(issue => issue.type === 'DELAYED').length
  const damagedIssues = issues.filter(issue => issue.type === 'DAMAGED').length

  // Calculate average delivery time (simplified: invoice creation to payment time)
  const paidInvoicesWithDates = invoices.filter(
    inv => inv.status === 'PAID' && inv.paidAt && inv.createdAt
  )
  const totalDeliveryDays = paidInvoicesWithDates.reduce((sum, inv) => {
    if (inv.paidAt && inv.createdAt) {
      const diffTime = inv.paidAt.getTime() - inv.createdAt.getTime()
      const diffDays = diffTime / (1000 * 60 * 60 * 24)
      return sum + diffDays
    }
    return sum
  }, 0)
  const averageDeliveryTimeDays = paidInvoicesWithDates.length > 0
    ? totalDeliveryDays / paidInvoicesWithDates.length
    : 0

  // Calculate days since first order
  const firstOrder = invoices[0]
  const daysSinceFirstOrder = firstOrder
    ? Math.floor((Date.now() - firstOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : undefined

  // Calculate new score
  const newScore = calculateReliabilityScore({
    totalOrders,
    completedOrders,
    onTimeDeliveries,
    totalIssues,
    resolvedIssues,
    openIssues,
    wrongItemsIssues,
    delayedIssues,
    damagedIssues,
    averageDeliveryTimeDays,
    currentScore: supplier.creditScore, // Suppliers use creditScore field for reliability
    daysSinceFirstOrder,
  })

  // Update supplier's reliability score (stored in creditScore field)
  await prisma.user.update({
    where: { id: supplierId },
    data: { creditScore: newScore },
  })

  return newScore
}

/**
 * Recalculate all buyer credit scores
 * Useful for periodic maintenance or data migration
 */
export async function recalculateAllBuyerCreditScores(): Promise<{
  processed: number
  updated: number
  errors: number
}> {
  const buyers = await prisma.user.findMany({
    where: { type: 'BUYER' },
  })

  let processed = 0
  let updated = 0
  let errors = 0

  for (const buyer of buyers) {
    processed++
    try {
      await recalculateBuyerCreditScore(buyer.id)
      updated++
    } catch (error) {
      console.error(`Error recalculating credit score for buyer ${buyer.userId}:`, error)
      errors++
    }
  }

  return { processed, updated, errors }
}

/**
 * Recalculate all supplier reliability scores
 * Useful for periodic maintenance or data migration
 */
export async function recalculateAllSupplierReliabilityScores(): Promise<{
  processed: number
  updated: number
  errors: number
}> {
  const suppliers = await prisma.user.findMany({
    where: { type: 'SUPPLIER' },
  })

  let processed = 0
  let updated = 0
  let errors = 0

  for (const supplier of suppliers) {
    processed++
    try {
      await recalculateSupplierReliabilityScore(supplier.id)
      updated++
    } catch (error) {
      console.error(`Error recalculating reliability score for supplier ${supplier.userId}:`, error)
      errors++
    }
  }

  return { processed, updated, errors }
}

