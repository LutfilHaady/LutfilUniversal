/**
 * Weather API Route
 * 
 * GET /api/weather?regions=Jakarta,Bandung,Surabaya
 * 
 * Fetches weather data for multiple regions
 * Server-side route to protect API key
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWeatherForRegions, parseRegions } from '@/lib/weather/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const regionsParam = searchParams.get('regions')

    if (!regionsParam) {
      return NextResponse.json(
        { success: false, error: 'regions parameter is required' },
        { status: 400 }
      )
    }

    // Parse regions string
    const regions = parseRegions(regionsParam)

    if (regions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid regions provided' },
        { status: 400 }
      )
    }

    // Fetch weather for all regions
    const weatherData = await getWeatherForRegions(regions)

    return NextResponse.json({
      success: true,
      data: weatherData,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[API] Weather fetch error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's an API key issue
    if (errorMessage.includes('OPENWEATHER_API_KEY')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Weather API not configured',
          message: 'OPENWEATHER_API_KEY is missing. Please add it to .env.local and restart the server.',
          details: errorMessage
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch weather data',
        message: errorMessage,
        hint: 'Check server logs for details. Make sure OPENWEATHER_API_KEY is set and valid.'
      },
      { status: 500 }
    )
  }
}

