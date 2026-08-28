/**
 * Weather Impacted Regions API Route
 * 
 * GET /api/weather/impacted
 * 
 * Returns list of regions currently affected by weather (heavy rain, severe weather)
 * Used for Risk Monitor dashboard widget
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWeatherForRegions, parseRegions, getWeatherStatus } from '@/lib/weather/client'

// Common Indonesian regions to check
const COMMON_REGIONS = [
  'Jakarta',
  'Bandung',
  'Surabaya',
  'Yogyakarta',
  'Tangerang',
  'Bali',
  'Medan',
  'Semarang',
  'Makassar',
]

export async function GET(request: NextRequest) {
  try {
    // Get weather for all common regions
    const weatherData = await getWeatherForRegions(COMMON_REGIONS)

    // Filter to only affected regions (heavy_rain or severe)
    const impactedRegions = Object.values(weatherData)
      .filter(weather => weather.status === 'heavy_rain' || weather.status === 'severe')
      .map(weather => ({
        region: weather.region,
        status: weather.status,
        forecast: weather.forecast,
        weatherType: weather.weatherType,
        lastUpdated: weather.lastUpdated,
        severity: weather.status === 'severe' ? 'severe' : 'affected',
      }))

    return NextResponse.json({
      success: true,
      data: {
        impactedRegions,
        totalAffected: impactedRegions.length,
        totalChecked: COMMON_REGIONS.length,
        timestamp: new Date().toISOString(),
      },
    })

  } catch (error) {
    console.error('[API] Weather impacted regions error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch weather impacted regions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

