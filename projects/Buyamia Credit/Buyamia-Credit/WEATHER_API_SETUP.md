# Weather API Setup - Phase 0.5

## ✅ What's Implemented

Phase 0.5 (Product Search Weather Awareness) is complete:

- ✅ Weather API service (`lib/weather/client.ts`)
- ✅ Weather API route (`app/api/weather/route.ts`) - server-side to protect API key
- ✅ Weather status indicators on supplier cards
- ✅ Weather filter (show only suppliers with no weather issues)
- ✅ Translations (English & Indonesian)
- ✅ Mock data fallback (works without API key)

## 🔑 Setup Instructions

### 1. Get OpenWeatherMap API Key

1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Go to API Keys section
3. Copy your API key

### 2. Add to Environment Variables

Create `.env.local` file in project root (if it doesn't exist):

```env
# Weather API (OpenWeatherMap)
OPENWEATHER_API_KEY=your_api_key_here
```

**Important:** 
- Never commit `.env.local` to git (it's in `.gitignore`)
- The API key is used server-side only (in `/api/weather` route)
- Free tier: 1,000 calls/day (sufficient for MVP)

### 3. Test the Integration

1. Start your dev server: `npm run dev`
2. Go to Search page
3. Search by category (e.g., select "Fresh Food")
4. You should see weather status for each region:
   - ✅ Normal conditions
   - ⚠️ May experience delays (heavy rain)
   - 🔴 Severe weather

## 📍 Supported Cities

The following Indonesian cities are mapped:

- Jakarta
- Bandung
- Surabaya
- Yogyakarta
- Tangerang
- Bali (Denpasar)
- Medan
- Semarang
- Makassar

To add more cities, update `CITY_MAPPING` in `lib/weather/client.ts`.

## 🎯 Features

### Weather Status Indicators

Each supplier's regions show:
- **✅ Normal** - No weather issues
- **⚠️ Affected** - Heavy rain forecast, may cause 1-2 day delays
- **🔴 Severe** - Severe weather, may cause significant delays

### Weather Filter

- **Show All** - Display all suppliers
- **No Weather Issues** - Filter to show only suppliers with no weather problems

## 🔄 How It Works

1. User searches for suppliers by category
2. System extracts all regions from supplier list
3. Fetches weather data for all regions (batch API call)
4. Displays weather status for each region on supplier cards
5. Weather data is cached (update every 6-12 hours in production)

## 🛠️ Technical Details

### API Endpoint

```
GET /api/weather?regions=Jakarta,Bandung,Surabaya
```

Response:
```json
{
  "success": true,
  "data": {
    "Jakarta": {
      "region": "Jakarta",
      "status": "normal",
      "forecast": "Normal conditions",
      ...
    },
    "Bandung": {
      "region": "Bandung",
      "status": "heavy_rain",
      "forecast": "Heavy rain forecast - may cause 1-2 day delivery delays",
      ...
    }
  }
}
```

### Weather Status Logic

- **Normal**: No rain or light drizzle (< 0.5mm)
- **Light Rain**: 0.5-2.5mm rain
- **Heavy Rain**: 2.5-10mm rain or forecast
- **Severe**: > 10mm rain or extreme weather

### Fallback Behavior

If API key is not set or API fails:
- Uses mock weather data
- Bandung shows as "heavy_rain" (for demo)
- Other cities show as "normal"

## 🚀 Next Steps

After Phase 0.5 is tested:

1. **Phase 1**: Invoice weather awareness (dashboard widget)
2. **Phase 2**: Invoice-level context (weather on individual invoices)
3. **Phase 3**: Risk adjustment (internal risk scoring)
4. **Phase 4**: Risk heatmap table

## 📝 Notes

- Weather data updates in real-time when suppliers are searched
- API calls are batched (all regions in one request)
- Free tier rate limit: 60 calls/minute (sufficient for MVP)
- In production, add caching layer (Redis/database) to reduce API calls

