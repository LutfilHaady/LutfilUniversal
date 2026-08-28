/**
 * Weather API Client
 * 
 * Handles weather data fetching from OpenWeatherMap API
 * Used for risk heatmap feature - Phase 0.5
 */

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY
const OPENWEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5'

// Indonesian city name to OpenWeatherMap city mapping
const CITY_MAPPING: Record<string, { name: string; country: string }> = {
  'Jakarta': { name: 'Jakarta', country: 'ID' },
  'Bandung': { name: 'Bandung', country: 'ID' },
  'Surabaya': { name: 'Surabaya', country: 'ID' },
  'Yogyakarta': { name: 'Yogyakarta', country: 'ID' },
  'Tangerang': { name: 'Tangerang', country: 'ID' },
  'Bali': { name: 'Denpasar', country: 'ID' }, // Bali's main city
  'Denpasar': { name: 'Denpasar', country: 'ID' },
  'Medan': { name: 'Medan', country: 'ID' },
  'Semarang': { name: 'Semarang', country: 'ID' },
  'Makassar': { name: 'Makassar', country: 'ID' },
}

export interface WeatherData {
  region: string
  status: 'normal' | 'light_rain' | 'heavy_rain' | 'severe'
  weatherType: string
  description: string
  forecast: string
  temperature?: number
  humidity?: number
  precipitation?: number // mm
  lastUpdated: string
}

export interface WeatherStatus {
  region: string
  status: 'normal' | 'affected' | 'severe'
  message: string
  icon: '✅' | '⚠️' | '🔴'
}

/**
 * Parse regions string (e.g., "Jakarta, Bandung, Surabaya") into array
 */
export function parseRegions(regionsString: string): string[] {
  if (!regionsString) return []
  return regionsString
    .split(',')
    .map(r => r.trim())
    .filter(r => r.length > 0)
}

/**
 * Check if region is "All Indonesia" (not a specific city)
 */
export function isIndonesiaWide(region: string): boolean {
  if (!region) return false
  const lower = region.toLowerCase()
  return lower.includes('all indonesia') || lower === 'indonesia'
}

/**
 * Get weather data for a single city
 */
export async function getWeatherForCity(cityName: string): Promise<WeatherData | null> {
  if (!OPENWEATHER_API_KEY) {
    console.error('[Weather] OPENWEATHER_API_KEY not set - API calls will fail')
    throw new Error('OPENWEATHER_API_KEY is not configured. Please add it to .env.local')
  }

  // Skip "All Indonesia" - it's not a valid city name
  if (isIndonesiaWide(cityName)) {
    console.warn(`[Weather] Skipping "All Indonesia" - not a valid city name for weather API`)
    return null
  }

  const cityInfo = CITY_MAPPING[cityName] || { name: cityName, country: 'ID' }
  
  try {
    // Get current weather
    const currentUrl = `${OPENWEATHER_API_BASE}/weather?q=${cityInfo.name},${cityInfo.country}&appid=${OPENWEATHER_API_KEY}&units=metric`
    const currentResponse = await fetch(currentUrl)
    
    if (!currentResponse.ok) {
      const errorText = await currentResponse.text()
      console.error(`[Weather] Failed to fetch weather for ${cityName}:`, currentResponse.status, errorText)
      throw new Error(`Weather API failed for ${cityName}: ${currentResponse.status} ${errorText}`)
    }

    const currentData = await currentResponse.json()

    // Get forecast (5-day, 3-hour intervals)
    const forecastUrl = `${OPENWEATHER_API_BASE}/forecast?q=${cityInfo.name},${cityInfo.country}&appid=${OPENWEATHER_API_KEY}&units=metric`
    const forecastResponse = await fetch(forecastUrl)
    
    let forecastData = null
    if (forecastResponse.ok) {
      forecastData = await forecastResponse.json()
    } else {
      console.warn(`[Weather] Forecast fetch failed for ${cityName}, continuing with current weather only`)
    }

    return parseWeatherResponse(cityName, currentData, forecastData)
  } catch (error) {
    console.error(`[Weather] Error fetching weather for ${cityName}:`, error)
    throw error // Re-throw instead of returning mock data
  }
}

/**
 * Get weather data for multiple cities (batch)
 */
export async function getWeatherForRegions(regions: string[]): Promise<Record<string, WeatherData>> {
  const results: Record<string, WeatherData> = {}
  
  // Filter out "All Indonesia" and other invalid regions before fetching
  const validRegions = regions.filter(region => {
    if (isIndonesiaWide(region)) {
      console.warn(`[Weather] Skipping "All Indonesia" - not a valid city name`)
      return false
    }
    return true
  })
  
  // Fetch weather for each valid region (OpenWeatherMap free tier doesn't support batch, so we do sequential)
  // In production, you might want to add rate limiting or caching
  for (const region of validRegions) {
    try {
      const weather = await getWeatherForCity(region)
      if (weather) {
        results[region] = weather
      }
    } catch (error) {
      // Log error but continue with other regions
      console.error(`[Weather] Failed to get weather for ${region}, skipping:`, error)
      // Don't add this region to results - it will show as missing/error
    }
    // Small delay to avoid rate limiting (free tier: 60 calls/minute)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return results
}

/**
 * Parse OpenWeatherMap API response
 */
function parseWeatherResponse(
  cityName: string,
  currentData: any,
  forecastData: any
): WeatherData {
  const weatherMain = currentData.weather?.[0]?.main || 'Clear'
  const weatherDesc = currentData.weather?.[0]?.description || 'Clear sky'
  const rain = currentData.rain?.['1h'] || currentData.rain?.['3h'] || 0
  const temp = currentData.main?.temp
  const humidity = currentData.main?.humidity

  // Determine status based on weather conditions
  let status: WeatherData['status'] = 'normal'
  let forecast = 'Normal conditions'

  if (rain > 10 || weatherMain === 'Heavy Rain' || weatherMain === 'Extreme') {
    status = 'severe'
    forecast = 'Heavy rain - may cause significant delays'
  } else if (rain > 2.5 || weatherMain === 'Rain' || weatherMain === 'Thunderstorm') {
    status = 'heavy_rain'
    forecast = 'Heavy rain forecast - may cause 1-2 day delivery delays'
  } else if (rain > 0.5 || weatherMain === 'Drizzle') {
    status = 'light_rain'
    forecast = 'Light rain - minimal impact expected'
  }

  // Check forecast for next 24 hours
  if (forecastData?.list) {
    const next24Hours = forecastData.list.slice(0, 8) // Next 24 hours (3-hour intervals)
    const maxRain = Math.max(...next24Hours.map((item: any) => 
      item.rain?.['3h'] || item.rain?.['1h'] || 0
    ))

    if (maxRain > 10) {
      status = 'severe'
      forecast = 'Heavy rain expected in next 24 hours - may cause significant delays'
    } else if (maxRain > 2.5) {
      status = status === 'normal' ? 'heavy_rain' : status
      forecast = 'Heavy rain forecast in next 24 hours - may cause 1-2 day delivery delays'
    }
  }

  return {
    region: cityName,
    status,
    weatherType: weatherMain,
    description: weatherDesc,
    forecast,
    temperature: temp,
    humidity,
    precipitation: rain,
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Get weather status for display (simplified)
 */
export function getWeatherStatus(weather: WeatherData): WeatherStatus {
  if (weather.status === 'severe') {
    return {
      region: weather.region,
      status: 'severe',
      message: weather.forecast,
      icon: '🔴',
    }
  } else if (weather.status === 'heavy_rain') {
    return {
      region: weather.region,
      status: 'affected',
      message: weather.forecast,
      icon: '⚠️',
    }
  } else {
    return {
      region: weather.region,
      status: 'normal',
      message: 'Normal conditions',
      icon: '✅',
    }
  }
}

/**
 * Mock weather data (fallback when API key not set or API fails)
 */
function getMockWeatherData(cityName: string): WeatherData {
  // Mock data - simulate some regions with weather issues
  const mockStatuses: Record<string, WeatherData['status']> = {
    'Jakarta': 'normal',
    'Bandung': 'heavy_rain', // Simulate weather issue
    'Surabaya': 'normal',
    'Yogyakarta': 'normal',
    'Tangerang': 'normal',
    'Bali': 'normal',
  }

  const status = mockStatuses[cityName] || 'normal'
  
  const forecasts: Record<string, string> = {
    'normal': 'Normal conditions',
    'light_rain': 'Light rain - minimal impact expected',
    'heavy_rain': 'Heavy rain forecast - may cause 1-2 day delivery delays',
    'severe': 'Heavy rain - may cause significant delays',
  }

  return {
    region: cityName,
    status,
    weatherType: status === 'normal' ? 'Clear' : 'Rain',
    description: status === 'normal' ? 'Clear sky' : 'Heavy rain',
    forecast: forecasts[status],
    temperature: 28,
    humidity: 75,
    precipitation: status === 'heavy_rain' ? 5 : status === 'severe' ? 15 : 0,
    lastUpdated: new Date().toISOString(),
  }
}

