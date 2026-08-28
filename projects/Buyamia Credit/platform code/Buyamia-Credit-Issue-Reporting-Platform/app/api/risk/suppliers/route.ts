import { NextRequest, NextResponse } from 'next/server'
import { getWeatherForRegions, getWeatherStatus } from '@/lib/weather/client'
import { parseRegions } from '@/lib/weather/client'
import { calculateWeatherCorrelation } from '@/lib/utils/invoice-weather'
import { extractRegionFromAddress } from '@/lib/utils/region-extraction'
import type { HistoricalInvoice } from '@/lib/utils/invoice-weather'
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

export interface SupplierRiskData {
  supplierId: string
  businessName: string
  primaryRegion: string
  coordinates: { lat: number; lng: number }
  weatherRisk: number // 0-100
  paymentRisk: number // 0-100
  combinedRisk: number // 0-100
  weatherStatus: 'normal' | 'affected' | 'severe'
  delayProbability: 'low' | 'medium' | 'high'
  historicalCorrelation: {
    similarWeatherDelays: number
    totalSimilarWeather: number
    averageDelayDays: number
    pattern: string
    correlationInsight: string
  } | null
  regionsServed: string[]
  reliabilityScore: number
  onTimeDelivery: number
}

/**
 * GET /api/risk/suppliers
 * 
 * Get risk data for suppliers that the buyer works with
 * Returns weather risk, payment risk, and historical correlation
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
            id: true,
            userId: true,
            businessName: true,
            address: true,
            regionsServed: true,
            creditScore: true,
          },
        },
        buyer: {
          select: {
            address: true,
          },
        },
      },
    })

    // Get unique suppliers from invoices
    const supplierMap = new Map<string, typeof invoices[0]['supplier']>()
    invoices.forEach(inv => {
      if (inv.supplier && !supplierMap.has(inv.supplier.userId)) {
        supplierMap.set(inv.supplier.userId, inv.supplier)
      }
    })

    const suppliersToUse = Array.from(supplierMap.values()).map(supplier => {
      // Calculate on-time delivery for this supplier
      const supplierInvoices = invoices.filter(inv => inv.supplierId === supplier.id)
      const paidInvoices = supplierInvoices.filter(inv => inv.status === 'PAID').length
      const onTimeDelivery = supplierInvoices.length > 0
        ? Math.round((paidInvoices / supplierInvoices.length) * 100)
        : 0

      return {
        supplierId: supplier.userId,
        businessName: supplier.businessName,
        regionsServed: supplier.regionsServed || supplier.address || '',
        address: supplier.address || '', // Include address for primary region detection
        reliabilityScore: supplier.creditScore,
        onTimeDelivery,
        supplierDbId: supplier.id,
      }
    })

    // Get all unique regions from suppliers
    const allRegions = new Set<string>()
    suppliersToUse.forEach(supplier => {
      const regions = parseRegions(supplier.regionsServed)
      regions.forEach(region => allRegions.add(region))
    })

    // Fetch weather for all supplier regions
    const regionsArray = Array.from(allRegions)
    const weatherData = await getWeatherForRegions(regionsArray)

    // Convert invoices to HistoricalInvoice format for correlation
    const historicalInvoices: HistoricalInvoice[] = invoices.map(inv => {
      const deliveryRegion = extractRegionFromAddress(inv.buyer.address || '') || buyerRegion
      
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        buyerId: buyerUserId,
        supplierId: inv.supplier.userId,
        dueDate: inv.dueDate.toISOString().split('T')[0],
        status: inv.status,
        paidAt: inv.paidAt ? inv.paidAt.toISOString().split('T')[0] : undefined,
        daysOverdue: inv.daysOverdue || 0,
        deliveryRegion,
      }
    })

    // Calculate risk for each supplier
    const supplierRiskData: SupplierRiskData[] = []
    
    // Track suppliers per region to add offset for overlapping positions
    const suppliersPerRegion: Record<string, number> = {}

    for (const supplier of suppliersToUse) {
      const regions = parseRegions(supplier.regionsServed)
      
      // Determine primary region using smart logic:
      // 1. Try to extract from supplier's address (most accurate)
      // 2. Use region with most invoice activity (if available)
      // 3. Fall back to first region in list
      let primaryRegion: string | null = null
      
      // First, try to get primary region from supplier's address
      if (supplier.address) {
        const addressRegion = extractRegionFromAddress(supplier.address)
        if (addressRegion && regions.includes(addressRegion)) {
          primaryRegion = addressRegion
        }
      }
      
      // If address didn't work, find region with most invoice activity
      if (!primaryRegion && invoices.length > 0) {
        const supplierInvoices = invoices.filter(inv => inv.supplierId === supplier.supplierDbId)
        const regionActivity: Record<string, number> = {}
        
        supplierInvoices.forEach(inv => {
          const deliveryRegion = extractRegionFromAddress(inv.buyer.address || '') || buyerRegion
          if (regions.includes(deliveryRegion)) {
            regionActivity[deliveryRegion] = (regionActivity[deliveryRegion] || 0) + 1
          }
        })
        
        // Find region with most activity
        const mostActiveRegion = Object.entries(regionActivity)
          .sort(([, a], [, b]) => b - a)[0]?.[0]
        
        if (mostActiveRegion) {
          primaryRegion = mostActiveRegion
        }
      }
      
      // Final fallback: use first region in list
      if (!primaryRegion) {
        primaryRegion = regions[0] || buyerRegion
      }
      
      if (!primaryRegion || !REGION_COORDINATES[primaryRegion]) {
        continue // Skip if region not found
      }

      // Count suppliers in this region for offset calculation
      suppliersPerRegion[primaryRegion] = (suppliersPerRegion[primaryRegion] || 0) + 1
      const supplierIndex = suppliersPerRegion[primaryRegion] - 1

      // Get weather for primary region
      const primaryWeather = weatherData[primaryRegion]
      if (!primaryWeather) {
        continue
      }

      const weatherStatus = getWeatherStatus(primaryWeather)
      
      // Calculate weather risk (0-100)
      let weatherRisk = 0
      if (weatherStatus.status === 'severe') {
        weatherRisk = 80
      } else if (weatherStatus.status === 'affected') {
        weatherRisk = 50
      }

      // Calculate payment risk based on overdue invoices for this supplier
      const supplierInvoices = historicalInvoices.filter(
        inv => inv.supplierId === supplier.supplierId && inv.buyerId === buyerUserId
      )
      const overdueInvoices = supplierInvoices.filter(inv => inv.status === 'OVERDUE' || inv.status.startsWith('OVERDUE'))
      const paymentRisk = supplierInvoices.length > 0
        ? Math.min(100, (overdueInvoices.length / supplierInvoices.length) * 100)
        : 0

      // Combined risk (weather 40% + payment 60%)
      const combinedRisk = Math.round(weatherRisk * 0.4 + paymentRisk * 0.6)

      // Determine delay probability
      let delayProbability: 'low' | 'medium' | 'high' = 'low'
      if (combinedRisk >= 70) {
        delayProbability = 'high'
      } else if (combinedRisk >= 40) {
        delayProbability = 'medium'
      }

      // Calculate historical correlation
      const currentInvoice: HistoricalInvoice = {
        id: 'CURRENT',
        invoiceNumber: 'CURRENT',
        buyerId: buyerUserId,
        supplierId: supplier.supplierId,
        dueDate: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        deliveryRegion: primaryRegion,
      }

      const correlation = calculateWeatherCorrelation(
        currentInvoice,
        historicalInvoices,
        weatherStatus.status,
        primaryRegion
      )

      // Add small offset for suppliers in the same region (so they don't overlap)
      const baseCoordinates = REGION_COORDINATES[primaryRegion]
      const offset = 0.01 // ~1km offset
      const angle = (supplierIndex * (360 / suppliersPerRegion[primaryRegion])) * (Math.PI / 180)
      const offsetLat = baseCoordinates.lat + (offset * Math.cos(angle))
      const offsetLng = baseCoordinates.lng + (offset * Math.sin(angle))

      supplierRiskData.push({
        supplierId: supplier.supplierId,
        businessName: supplier.businessName,
        primaryRegion,
        coordinates: { lat: offsetLat, lng: offsetLng },
        weatherRisk,
        paymentRisk,
        combinedRisk,
        weatherStatus: weatherStatus.status,
        delayProbability,
        historicalCorrelation: correlation,
        regionsServed: regions,
        reliabilityScore: supplier.reliabilityScore,
        onTimeDelivery: supplier.onTimeDelivery,
      })
    }

    return NextResponse.json({
      success: true,
      data: supplierRiskData,
    })
  } catch (error) {
    console.error('Error fetching supplier risk data:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch supplier risk data',
      },
      { status: 500 }
    )
  }
}

