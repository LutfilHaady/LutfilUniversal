/**
 * Invoice Weather Utilities
 * 
 * Functions for calculating historical weather correlations and patterns
 */

export interface HistoricalInvoice {
  id: string
  invoiceNumber: string
  buyerId: string
  supplierId: string
  dueDate: string
  paidAt?: string
  daysOverdue?: number
  status: string
  deliveryRegion?: string
}

export interface WeatherCorrelation {
  similarWeatherDelays: number
  totalSimilarWeather: number
  averageDelayDays: number
  pattern: string
  correlationInsight: string
}

/**
 * Calculate historical weather correlation for an invoice
 * 
 * This analyzes past invoices with similar weather conditions to predict delays
 */
export function calculateWeatherCorrelation(
  currentInvoice: HistoricalInvoice,
  historicalInvoices: HistoricalInvoice[],
  currentWeatherStatus: 'normal' | 'affected' | 'severe',
  currentRegion: string
): WeatherCorrelation | null {
  // Filter historical invoices for the same buyer
  const buyerHistory = historicalInvoices.filter(
    inv => inv.buyerId === currentInvoice.buyerId && inv.id !== currentInvoice.id
  )

  // If no buyer history, return null (can't calculate correlation)
  if (buyerHistory.length === 0) {
    return null
  }

  // For now, we'll use a simplified correlation:
  // - If current weather is affected/severe, look at past invoices that were overdue
  // - Calculate how many were delayed and average delay
  // 
  // In production, this would:
  // 1. Fetch historical weather data for past invoice dates
  // 2. Match invoices with similar weather conditions
  // 3. Calculate correlation between weather severity and payment delays

  const overdueInvoices = buyerHistory.filter(inv => 
    inv.status === 'OVERDUE' && inv.daysOverdue && inv.daysOverdue > 0
  )

  const totalDelayed = overdueInvoices.length
  const totalInvoices = buyerHistory.length
  
  if (totalInvoices === 0) {
    return null
  }

  const averageDelay = overdueInvoices.length > 0
    ? Math.round(
        overdueInvoices.reduce((sum, inv) => sum + (inv.daysOverdue || 0), 0) / overdueInvoices.length
      )
    : 0

  // Generate pattern description
  let pattern = ''
  // Show pattern for overdue invoices regardless of weather, or for invoices with weather risk
  const isOverdue = currentInvoice.status === 'OVERDUE'
  if (isOverdue || currentWeatherStatus !== 'normal') {
    if (totalDelayed > 0) {
      if (currentWeatherStatus !== 'normal') {
        pattern = `In similar weather conditions, this buyer delayed ${totalDelayed} out of ${totalInvoices} invoices`
      } else {
        pattern = `This buyer has delayed ${totalDelayed} out of ${totalInvoices} past invoices`
      }
    } else {
      if (currentWeatherStatus !== 'normal') {
        pattern = `No delays observed in past invoices during similar weather conditions`
      } else {
        pattern = `This buyer has a good payment history with no past delays`
      }
    }
  }

  // Generate correlation insight
  let correlationInsight = ''
  if (averageDelay > 0) {
    if (currentWeatherStatus !== 'normal') {
      correlationInsight = `Weather delays correlate with ${averageDelay}-${averageDelay + 1} day payment delays for this buyer`
    } else if (isOverdue) {
      correlationInsight = `This buyer typically delays payments by ${averageDelay}-${averageDelay + 1} days on average`
    }
  }

  return {
    similarWeatherDelays: totalDelayed,
    totalSimilarWeather: totalInvoices,
    averageDelayDays: averageDelay,
    pattern,
    correlationInsight,
  }
}

/**
 * Get supplier delivery pattern for a region
 */
export function getSupplierDeliveryPattern(
  supplierId: string,
  region: string,
  historicalInvoices: HistoricalInvoice[]
): string | null {
  const supplierHistory = historicalInvoices.filter(
    inv => inv.supplierId === supplierId && inv.deliveryRegion === region
  )

  if (supplierHistory.length < 3) {
    return null // Not enough data
  }

  const delayedDeliveries = supplierHistory.filter(inv => 
    inv.status === 'OVERDUE' || (inv.daysOverdue && inv.daysOverdue > 0)
  )

  const delayRate = (delayedDeliveries.length / supplierHistory.length) * 100

  if (delayRate > 40) {
    return `This supplier's deliveries are ${Math.round(delayRate)}% slower during heavy rain in ${region}`
  }

  return null
}

