import { NextRequest, NextResponse } from 'next/server'
import { getWeatherForRegions } from '@/lib/weather/client'
import { parseRegions } from '@/lib/weather/client'
import { calculateRegionsRisk, type RegionRiskInput } from '@/lib/utils/risk-calculation'
import { extractRegionFromAddress } from '@/lib/utils/region-extraction'
import type { RegionRiskData } from '@/components/RiskHeatmap'
import { prisma } from '@/lib/prisma'

// Region coordinates for Leaflet map (lat/lng)
const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Jakarta': { lat: -6.2088, lng: 106.8456 },
  'Bandung': { lat: -6.9175, lng: 107.6191 },
  'Surabaya': { lat: -7.2575, lng: 112.7521 },
  'Yogyakarta': { lat: -7.7956, lng: 110.3695 },
  'Tangerang': { lat: -6.1783, lng: 106.6319 },
  'Bali': { lat: -8.3405, lng: 115.0920 },
  'Medan': { lat: 3.5952, lng: 98.6722 },
  'Semarang': { lat: -6.9667, lng: 110.4167 },
  'Makassar': { lat: -5.1477, lng: 119.4327 },
  'Palembang': { lat: -2.9761, lng: 104.7754 },
  'Denpasar': { lat: -8.6705, lng: 115.2126 },
}

/**
 * GET /api/risk/regions
 * 
 * Get combined risk data for relevant regions only:
 * - Buyer's own region
 * - Regions where their suppliers deliver to
 * Returns weather risk + payment risk + combined risk for each region
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const buyerUserId = searchParams.get('buyerId')
    
    if (!buyerUserId) {
      return NextResponse.json(
        { success: false, error: 'buyerId is required' },
        { status: 400 }
      )
    }

    // Fetch buyer from database
    const buyer = await prisma.user.findUnique({
      where: { userId: buyerUserId },
    })

    if (!buyer || buyer.type !== 'BUYER') {
      return NextResponse.json(
        { success: false, error: 'Buyer not found' },
        { status: 404 }
      )
    }

    // Get buyer's region from address
    const buyerRegion = extractRegionFromAddress(buyer.address || buyer.businessName) || 'Jakarta'

    // Fetch all invoices for this buyer
    const invoices = await prisma.invoice.findMany({
      where: { buyerId: buyer.id },
      include: {
        supplier: {
          select: {
            userId: true,
            businessName: true,
            regionsServed: true,
            address: true,
          },
        },
      },
    })

    // Get all unique regions: buyer's region + supplier delivery regions
    const relevantRegions = new Set<string>()
    
    // Add buyer's own region
    relevantRegions.add(buyerRegion)
    
    // Add regions where suppliers deliver
    invoices.forEach(inv => {
      if (inv.supplier) {
        const regions = parseRegions(inv.supplier.regionsServed || inv.supplier.address || '')
        regions.forEach(region => relevantRegions.add(region))
      }
      
      // Also extract delivery region from buyer address for each invoice
      const deliveryRegion = extractRegionFromAddress(buyer.address || '') || buyerRegion
      relevantRegions.add(deliveryRegion)
    })

    const regions = Array.from(relevantRegions)

    // Fetch weather for all regions
    const weatherData = await getWeatherForRegions(regions)

    // Calculate payment data from invoices by region
    const paymentData: Record<string, { overdue: number; total: number; creditScores: number[] }> = {}
    
    invoices.forEach(inv => {
      const deliveryRegion = extractRegionFromAddress(buyer.address || '') || buyerRegion
      
      if (!paymentData[deliveryRegion]) {
        paymentData[deliveryRegion] = { overdue: 0, total: 0, creditScores: [] }
      }
      
      paymentData[deliveryRegion].total++
      
      if (inv.status === 'OVERDUE' || inv.status.startsWith('OVERDUE') || inv.status === 'DEFAULTED') {
        paymentData[deliveryRegion].overdue++
      }
      
      if (buyer.creditScore) {
        paymentData[deliveryRegion].creditScores.push(buyer.creditScore)
      }
    })

    // Calculate risks for each region
    const riskInputs: RegionRiskInput[] = regions.map(region => {
      const data = paymentData[region] || { overdue: 0, total: 0, creditScores: [] }
      const avgCreditScore = data.creditScores.length > 0
        ? Math.round(data.creditScores.reduce((a, b) => a + b, 0) / data.creditScores.length)
        : undefined

      return {
        region,
        weatherData: weatherData[region],
        overdueInvoices: data.overdue,
        totalInvoices: data.total,
        averageCreditScore: avgCreditScore,
      }
    })

    const riskOutputs = calculateRegionsRisk(riskInputs)

    // Add coordinates to each region
    const riskDataWithCoordinates: RegionRiskData[] = riskOutputs.map(risk => ({
      ...risk,
      coordinates: REGION_COORDINATES[risk.region] || { lat: -2.5489, lng: 118.0149 }, // Default to Indonesia center
    }))

    return NextResponse.json({
      success: true,
      data: riskDataWithCoordinates,
    })
  } catch (error) {
    console.error('[Risk Regions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to calculate region risks' },
      { status: 500 }
    )
  }
}

