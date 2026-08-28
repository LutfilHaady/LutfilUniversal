/**
 * Comprehensive Score Calculation Utilities
 * 
 * Calculates credit scores (buyers) and reliability scores (suppliers)
 * based on multiple factors and metrics
 */

export interface CreditScoreInput {
  // Payment history
  totalInvoices: number
  paidInvoices: number
  onTimePayments: number
  latePayments: number
  overdueInvoices: number
  defaultedInvoices: number
  
  // Payment timing
  averagePaymentDelayDays: number
  
  // Historical data
  currentScore: number
  daysSinceFirstInvoice?: number
}

export interface ReliabilityScoreInput {
  // Order fulfillment
  totalOrders: number
  completedOrders: number
  onTimeDeliveries: number
  
  // Issue metrics
  totalIssues: number
  resolvedIssues: number
  openIssues: number
  wrongItemsIssues: number
  delayedIssues: number
  damagedIssues: number
  
  // Delivery performance
  averageDeliveryTimeDays: number
  
  // Historical data
  currentScore: number
  daysSinceFirstOrder?: number
}

/**
 * Calculate comprehensive credit score for buyers (0-100)
 * 
 * Formula:
 * - Base score: 50 (starting point)
 * - Payment history (40%): on-time rate, late rate, overdue rate
 * - Payment behavior (30%): average delay, consistency
 * - Risk factors (30%): defaulted invoices, overdue severity
 */
export function calculateCreditScore(input: CreditScoreInput): number {
  const {
    totalInvoices,
    paidInvoices,
    onTimePayments,
    latePayments,
    overdueInvoices,
    defaultedInvoices,
    averagePaymentDelayDays,
    currentScore,
  } = input

  // If no invoices, return current score (or default 50)
  if (totalInvoices === 0) {
    return Math.max(0, Math.min(100, currentScore))
  }

  // Base score starts from current score (or 50 if not set)
  let score = currentScore || 50

  // 1. Payment History Component (40% weight)
  const paymentHistoryScore = calculatePaymentHistoryScore({
    totalInvoices,
    paidInvoices,
    onTimePayments,
    latePayments,
    overdueInvoices,
    defaultedInvoices,
  })

  // 2. Payment Behavior Component (30% weight)
  const paymentBehaviorScore = calculatePaymentBehaviorScore({
    averagePaymentDelayDays,
    latePayments,
    paidInvoices,
  })

  // 3. Risk Factors Component (30% weight)
  const riskFactorsScore = calculateRiskFactorsScore({
    defaultedInvoices,
    overdueInvoices,
    totalInvoices,
  })

  // Weighted combination
  const calculatedScore = 
    (paymentHistoryScore * 0.4) +
    (paymentBehaviorScore * 0.3) +
    (riskFactorsScore * 0.3)

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(calculatedScore)))
}

/**
 * Calculate payment history score (0-100)
 */
function calculatePaymentHistoryScore(input: {
  totalInvoices: number
  paidInvoices: number
  onTimePayments: number
  latePayments: number
  overdueInvoices: number
  defaultedInvoices: number
}): number {
  const { totalInvoices, paidInvoices, onTimePayments, latePayments, overdueInvoices, defaultedInvoices } = input

  if (totalInvoices === 0) return 50

  // On-time payment rate (positive)
  const onTimeRate = totalInvoices > 0 ? (onTimePayments / totalInvoices) * 100 : 0
  
  // Late payment rate (negative, but less severe than overdue)
  const lateRate = totalInvoices > 0 ? (latePayments / totalInvoices) * 100 : 0
  
  // Overdue rate (negative, more severe)
  const overdueRate = totalInvoices > 0 ? (overdueInvoices / totalInvoices) * 100 : 0
  
  // Defaulted rate (very negative)
  const defaultedRate = totalInvoices > 0 ? (defaultedInvoices / totalInvoices) * 100 : 0

  // Calculate score: start at 50, add bonuses/penalties
  let score = 50
  
  // Bonus for on-time payments
  score += onTimeRate * 0.5  // Up to +50 points
  
  // Penalty for late payments (less severe)
  score -= lateRate * 0.3  // Up to -30 points
  
  // Penalty for overdue (more severe)
  score -= overdueRate * 0.5  // Up to -50 points
  
  // Heavy penalty for defaulted
  score -= defaultedRate * 1.0  // Up to -100 points

  return Math.max(0, Math.min(100, score))
}

/**
 * Calculate payment behavior score (0-100)
 */
function calculatePaymentBehaviorScore(input: {
  averagePaymentDelayDays: number
  latePayments: number
  paidInvoices: number
}): number {
  const { averagePaymentDelayDays, latePayments, paidInvoices } = input

  if (paidInvoices === 0) return 50

  // Calculate consistency: lower late payment rate = better
  const latePaymentRate = (latePayments / paidInvoices) * 100
  
  // Score based on delay: 0 days = 100, 30+ days = 0
  const delayScore = Math.max(0, 100 - (averagePaymentDelayDays * 3))
  
  // Consistency score: 0% late = 100, 100% late = 0
  const consistencyScore = 100 - latePaymentRate

  // Average of delay and consistency
  return Math.max(0, Math.min(100, (delayScore + consistencyScore) / 2))
}

/**
 * Calculate risk factors score (0-100)
 */
function calculateRiskFactorsScore(input: {
  defaultedInvoices: number
  overdueInvoices: number
  totalInvoices: number
}): number {
  const { defaultedInvoices, overdueInvoices, totalInvoices } = input

  if (totalInvoices === 0) return 50

  // Start with perfect score
  let score = 100

  // Heavy penalty for defaults
  const defaultedRate = (defaultedInvoices / totalInvoices) * 100
  score -= defaultedRate * 2.0  // Each default is very bad

  // Penalty for overdue
  const overdueRate = (overdueInvoices / totalInvoices) * 100
  score -= overdueRate * 1.0  // Each overdue is bad

  return Math.max(0, Math.min(100, score))
}

/**
 * Calculate comprehensive reliability score for suppliers (0-100)
 * 
 * Formula:
 * - Order fulfillment (40%): completion rate, on-time delivery
 * - Issue management (35%): issue rate, resolution rate, issue types
 * - Delivery performance (25%): average delivery time, consistency
 */
export function calculateReliabilityScore(input: ReliabilityScoreInput): number {
  const {
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
    currentScore,
  } = input

  // If no orders, return current score (or default 50)
  if (totalOrders === 0) {
    return Math.max(0, Math.min(100, currentScore))
  }

  // 1. Order Fulfillment Component (40% weight)
  const fulfillmentScore = calculateFulfillmentScore({
    totalOrders,
    completedOrders,
    onTimeDeliveries,
  })

  // 2. Issue Management Component (35% weight)
  const issueManagementScore = calculateIssueManagementScore({
    totalOrders,
    totalIssues,
    resolvedIssues,
    openIssues,
    wrongItemsIssues,
    delayedIssues,
    damagedIssues,
  })

  // 3. Delivery Performance Component (25% weight)
  const deliveryPerformanceScore = calculateDeliveryPerformanceScore({
    averageDeliveryTimeDays,
    onTimeDeliveries,
    completedOrders,
  })

  // Weighted combination
  const calculatedScore = 
    (fulfillmentScore * 0.4) +
    (issueManagementScore * 0.35) +
    (deliveryPerformanceScore * 0.25)

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(calculatedScore)))
}

/**
 * Calculate order fulfillment score (0-100)
 */
function calculateFulfillmentScore(input: {
  totalOrders: number
  completedOrders: number
  onTimeDeliveries: number
}): number {
  const { totalOrders, completedOrders, onTimeDeliveries } = input

  if (totalOrders === 0) return 50

  // Completion rate
  const completionRate = (completedOrders / totalOrders) * 100
  
  // On-time delivery rate (of completed orders)
  const onTimeRate = completedOrders > 0 
    ? (onTimeDeliveries / completedOrders) * 100 
    : 0

  // Score: 60% completion rate, 40% on-time rate
  const score = (completionRate * 0.6) + (onTimeRate * 0.4)

  return Math.max(0, Math.min(100, score))
}

/**
 * Calculate issue management score (0-100)
 */
function calculateIssueManagementScore(input: {
  totalOrders: number
  totalIssues: number
  resolvedIssues: number
  openIssues: number
  wrongItemsIssues: number
  delayedIssues: number
  damagedIssues: number
}): number {
  const { totalOrders, totalIssues, resolvedIssues, openIssues, wrongItemsIssues, delayedIssues, damagedIssues } = input

  if (totalOrders === 0) return 50

  // Start with perfect score
  let score = 100

  // Issue rate penalty (fewer issues = better)
  const issueRate = (totalIssues / totalOrders) * 100
  score -= issueRate * 0.5  // Each 1% issue rate = -0.5 points

  // Resolution rate bonus (more resolved = better)
  const resolutionRate = totalIssues > 0 
    ? (resolvedIssues / totalIssues) * 100 
    : 100
  score += (resolutionRate - 50) * 0.3  // Bonus for high resolution rate

  // Penalty for open issues (unresolved problems)
  const openIssueRate = (openIssues / totalOrders) * 100
  score -= openIssueRate * 1.0  // Each open issue is bad

  // Penalty for specific issue types (more severe issues = worse)
  const wrongItemsRate = (wrongItemsIssues / totalOrders) * 100
  score -= wrongItemsRate * 1.5  // Wrong items is very bad

  const delayedRate = (delayedIssues / totalOrders) * 100
  score -= delayedRate * 1.0  // Delays are bad

  const damagedRate = (damagedIssues / totalOrders) * 100
  score -= damagedRate * 1.2  // Damaged items are bad

  return Math.max(0, Math.min(100, score))
}

/**
 * Calculate delivery performance score (0-100)
 */
function calculateDeliveryPerformanceScore(input: {
  averageDeliveryTimeDays: number
  onTimeDeliveries: number
  completedOrders: number
}): number {
  const { averageDeliveryTimeDays, onTimeDeliveries, completedOrders } = input

  if (completedOrders === 0) return 50

  // On-time rate
  const onTimeRate = (onTimeDeliveries / completedOrders) * 100

  // Speed score: faster delivery = better (assuming 7 days is average, 0 days is perfect)
  // 0 days = 100, 7 days = 50, 14+ days = 0
  const speedScore = Math.max(0, Math.min(100, 100 - (averageDeliveryTimeDays * 5)))

  // Combine: 60% on-time rate, 40% speed
  const score = (onTimeRate * 0.6) + (speedScore * 0.4)

  return Math.max(0, Math.min(100, score))
}

/**
 * Calculate score change from a single event
 * Used for incremental updates
 */
export function calculateCreditScoreChange(event: {
  type: 'on_time_payment' | 'late_payment' | 'overdue' | 'defaulted'
  severity?: 'low' | 'medium' | 'high'
}): number {
  const { type, severity = 'medium' } = event

  const severityMultiplier = {
    low: 0.5,
    medium: 1.0,
    high: 1.5,
  }[severity]

  const baseChanges = {
    on_time_payment: 5,
    late_payment: -2,
    overdue: -5,
    defaulted: -15,
  }

  return Math.round(baseChanges[type] * severityMultiplier)
}

/**
 * Calculate reliability score change from a single event
 * Used for incremental updates
 */
export function calculateReliabilityScoreChange(event: {
  type: 'order_completed' | 'order_on_time' | 'issue_created' | 'issue_resolved' | 'wrong_items' | 'delayed' | 'damaged'
  severity?: 'low' | 'medium' | 'high'
}): number {
  const { type, severity = 'medium' } = event

  const severityMultiplier = {
    low: 0.5,
    medium: 1.0,
    high: 1.5,
  }[severity]

  const baseChanges = {
    order_completed: 2,
    order_on_time: 3,
    issue_created: -3,
    issue_resolved: 2,
    wrong_items: -5,
    delayed: -4,
    damaged: -5,
  }

  return Math.round(baseChanges[type] * severityMultiplier)
}

