import { NextRequest, NextResponse } from 'next/server'
import { getWeatherForCity, getWeatherStatus, type WeatherData } from '@/lib/weather/client'
import { extractRegionFromAddress } from '@/lib/utils/region-extraction'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/invoices/weather
 * 
 * Get weather data for invoice delivery regions
 * Query params:
 * - regions: comma-separated list of regions (e.g., "Jakarta,Bandung")
 * - buyerIds: comma-separated list of buyer IDs (optional, will map to regions from database)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const regionsParam = searchParams.get('regions')
    const buyerIdsParam = searchParams.get('buyerIds')

    let regions: string[] = []

    if (regionsParam) {
      regions = regionsParam.split(',').map(r => r.trim()).filter(r => r.length > 0)
    } else if (buyerIdsParam) {
      // Map buyer IDs to regions from database
      const buyerIds = buyerIdsParam.split(',').map(id => id.trim())
      
      // Fetch buyers from database
      const buyers = await prisma.user.findMany({
        where: {
          userId: { in: buyerIds },
          type: 'BUYER',
        },
        select: {
          userId: true,
          address: true,
          businessName: true,
        },
      })

      // Extract regions from buyer addresses
      buyers.forEach(buyer => {
        const region = extractRegionFromAddress(buyer.address || buyer.businessName)
        if (region) {
          regions.push(region)
        }
      })
      
      // Remove duplicates
      regions = Array.from(new Set(regions))
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing regions or buyerIds parameter' },
        { status: 400 }
      )
    }

    if (regions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid regions found' },
        { status: 400 }
      )
    }

    // Fetch weather for all regions
    const weatherResults: Record<string, WeatherData> = {}
    const statusResults: Record<string, ReturnType<typeof getWeatherStatus>> = {}

    for (const region of regions) {
      try {
        const weather = await getWeatherForCity(region)
        if (weather) {
          weatherResults[region] = weather
          statusResults[region] = getWeatherStatus(weather)
        }
      } catch (error) {
        console.error(`[Invoice Weather] Failed to fetch weather for ${region}:`, error)
        // Continue with other regions
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return NextResponse.json({
      success: true,
      data: {
        weather: weatherResults,
        status: statusResults,
      },
    })
  } catch (error) {
    console.error('[Invoice Weather] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}

