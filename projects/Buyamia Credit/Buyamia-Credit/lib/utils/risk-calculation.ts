/**
 * Risk Calculation Utilities
 * 
 * Functions for calculating combined risk scores for regions
 */

import { getWeatherStatus, type WeatherData } from '@/lib/weather/client'

export interface RegionRiskInput {
  region: string
  weatherData?: WeatherData
  overdueInvoices: number
  totalInvoices: number
  averageCreditScore?: number // Average credit score of buyers in this region
}

export interface RegionRiskOutput {
  region: string
  weatherRisk: number // 0-100
  paymentRisk: number // 0-100
  combinedRisk: number // 0-100
  weatherStatus: 'normal' | 'affected' | 'severe'
  overdueInvoices: number
  totalInvoices: number
}

/**
 * Calculate weather risk score (0-100)
 */
export function calculateWeatherRisk(weatherData?: WeatherData): { risk: number; status: 'normal' | 'affected' | 'severe' } {
  if (!weatherData) {
    return { risk: 0, status: 'normal' }
  }

  const status = getWeatherStatus(weatherData)
  
  if (status.status === 'severe') {
    return { risk: 85, status: 'severe' }
  } else if (status.status === 'affected') {
    return { risk: 60, status: 'affected' }
  } else {
    return { risk: 10, status: 'normal' }
  }
}

/**
 * Calculate payment risk score (0-100)
 */
export function calculatePaymentRisk(
  overdueInvoices: number,
  totalInvoices: number,
  averageCreditScore?: number
): number {
  if (totalInvoices === 0) {
    return 0
  }

  // Overdue rate (0-100)
  const overdueRate = (overdueInvoices / totalInvoices) * 100

  // Credit score factor (0-100, inverted: lower score = higher risk)
  const creditScoreFactor = averageCreditScore ? (100 - averageCreditScore) : 0

  // Weighted calculation
  // 70% overdue rate, 30% credit score
  const paymentRisk = (overdueRate * 0.7) + (creditScoreFactor * 0.3)

  return Math.min(100, Math.max(0, Math.round(paymentRisk)))
}

/**
 * Calculate combined risk score
 * 
 * Formula: Weather (30%) + Payment (40%) + Credit Score (20%) + Supplier Reliability (10%)
 * For now, we'll use: Weather (40%) + Payment (60%)
 */
export function calculateCombinedRisk(
  weatherRisk: number,
  paymentRisk: number
): number {
  // Weighted combination
  const combined = (weatherRisk * 0.4) + (paymentRisk * 0.6)
  return Math.min(100, Math.max(0, Math.round(combined)))
}

/**
 * Calculate risk for a single region
 */
export function calculateRegionRisk(input: RegionRiskInput): RegionRiskOutput {
  const weatherResult = calculateWeatherRisk(input.weatherData)
  const paymentRisk = calculatePaymentRisk(
    input.overdueInvoices,
    input.totalInvoices,
    input.averageCreditScore
  )
  const combinedRisk = calculateCombinedRisk(weatherResult.risk, paymentRisk)

  return {
    region: input.region,
    weatherRisk: weatherResult.risk,
    paymentRisk,
    combinedRisk,
    weatherStatus: weatherResult.status,
    overdueInvoices: input.overdueInvoices,
    totalInvoices: input.totalInvoices,
  }
}

/**
 * Calculate risks for multiple regions
 */
export function calculateRegionsRisk(inputs: RegionRiskInput[]): RegionRiskOutput[] {
  return inputs.map(calculateRegionRisk)
}

