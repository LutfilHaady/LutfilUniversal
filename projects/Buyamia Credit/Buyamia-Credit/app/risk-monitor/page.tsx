'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import { getUserTypeFromUserId } from '@/lib/utils'
import { CloudRain, MapPin, AlertCircle, CheckCircle, Cloud, Shield, Package, Clock, RefreshCw, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { parseRegions, getWeatherStatus, type WeatherData } from '@/lib/weather/client'
import { calculateWeatherCorrelation, type HistoricalInvoice } from '@/lib/utils/invoice-weather'
import RiskHeatmap, { type SupplierRiskData } from '@/components/RiskHeatmap'

interface WeatherImpactedRegion {
  region: string
  status: 'heavy_rain' | 'severe'
  forecast: string
  weatherType: string
  lastUpdated: string
  severity: 'affected' | 'severe'
}

interface WeatherImpactedData {
  impactedRegions: WeatherImpactedRegion[]
  totalAffected: number
  totalChecked: number
  timestamp: string
}

type SupplierData = {
  supplierId: string
  businessName: string
  regionsServed: string
  reliabilityScore: number
  onTimeDelivery?: number
}

export default function RiskMonitorPage() {
  const { language } = useLanguage()
  const t = translations[language].riskMonitor
  const tSearch = translations[language].searchPage
  
  const [userId, setUserId] = useState<string>('')
  const [weatherData, setWeatherData] = useState<WeatherImpactedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRegion, setUserRegion] = useState<string>('Jakarta') // Mock - would come from user profile
  const [buyerRegionWeather, setBuyerRegionWeather] = useState<WeatherData | null>(null)
  const [supplierWeatherData, setSupplierWeatherData] = useState<Record<string, Record<string, WeatherData>>>({})
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString())
  const [supplierRiskData, setSupplierRiskData] = useState<SupplierRiskData[]>([])
  const [supplierRegions, setSupplierRegions] = useState<string[]>([])
  const [primaryBase, setPrimaryBase] = useState<string>('')
  const [primaryBaseWeather, setPrimaryBaseWeather] = useState<WeatherData | null>(null)
  const [deliveryRegionsWeather, setDeliveryRegionsWeather] = useState<Record<string, WeatherData>>({})
  const [suppliers, setSuppliers] = useState<SupplierData[]>([])
  const [historicalInvoices, setHistoricalInvoices] = useState<HistoricalInvoice[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      } else {
        // Default fallback to buyer
        const defaultUserId = 'BJ1045'
        localStorage.setItem('userId', defaultUserId)
        setUserId(defaultUserId)
      }
    }
  }, [])

  const userType = getUserTypeFromUserId(userId)
  const isSupplier = userType === 'SUPPLIER'
  const isBuyer = userType === 'BUYER'

  useEffect(() => {
    if (!userId) return // Wait for userId to be set
    fetchWeatherImpacted()
    if (isBuyer) {
      fetchBuyerProfile()
      // fetchBuyerSuppliers() - No longer needed, suppliers come from fetchSupplierRisks()
      fetchHistoricalInvoices()
      fetchSupplierRisks() // This will also populate suppliers list
      // fetchBuyerWeatherData() will be called after suppliers are loaded
    }
  }, [userId, isBuyer])

  useEffect(() => {
    if (isBuyer && suppliers.length > 0) {
      fetchBuyerWeatherData()
    }
  }, [isBuyer, suppliers])

  const fetchWeatherImpacted = async () => {
    setLoading(true)
    try {
      // For suppliers: fetch their delivery regions and check weather for those regions only
      if (isSupplier && userId) {
        // Fetch supplier profile to get regionsServed
        const supplierResponse = await fetch(`/api/users/search?q=${userId}&type=SUPPLIER`)
        if (supplierResponse.ok) {
          const supplierData = await supplierResponse.json()
          if (supplierData.success && supplierData.users && supplierData.users.length > 0) {
            const supplier = supplierData.users[0]
            const regionsServed = supplier.regionsServed || supplier.address || ''
            
            if (regionsServed) {
              // Parse regions
              const { parseRegions } = await import('@/lib/weather/client')
              const regions = parseRegions(regionsServed)
              setSupplierRegions(regions)
              
              // Set primary base (first region)
              if (regions.length > 0) {
                setPrimaryBase(regions[0])
              }
              
              // Fetch weather for all supplier's regions
              const weatherResponse = await fetch(`/api/weather?regions=${regions.join(',')}`)
              if (weatherResponse.ok) {
                const weatherResult = await weatherResponse.json()
                if (weatherResult.success && weatherResult.data) {
                  // Set primary base weather
                  if (regions.length > 0 && weatherResult.data[regions[0]]) {
                    setPrimaryBaseWeather(weatherResult.data[regions[0]])
                  }
                  
                  // Set delivery regions weather (all except primary)
                  const deliveryWeather: Record<string, WeatherData> = {}
                  regions.slice(1).forEach(region => {
                    if (weatherResult.data[region]) {
                      deliveryWeather[region] = weatherResult.data[region]
                    }
                  })
                  setDeliveryRegionsWeather(deliveryWeather)
                  
                  // Also set impacted regions for compatibility
                  const { getWeatherStatus } = await import('@/lib/weather/client')
                  const impactedRegions = Object.values(weatherResult.data)
                    .filter((weather: any) => {
                      const status = getWeatherStatus(weather)
                      return status.status !== 'normal'
                    })
                    .map((weather: any) => ({
                      region: weather.region,
                      status: weather.status,
                      forecast: weather.forecast,
                      weatherType: weather.weatherType,
                      lastUpdated: weather.lastUpdated,
                      severity: (weather.status === 'severe' ? 'severe' : 'affected') as 'severe' | 'affected',
                    }))
                  
                  setWeatherData({
                    impactedRegions,
                    totalAffected: impactedRegions.length,
                    totalChecked: regions.length,
                    timestamp: new Date().toISOString(),
                  })
                  setLoading(false)
                  return
                }
              }
            }
          }
        }
      }
      
      // Fallback: fetch all impacted regions (for buyers or if supplier fetch fails)
      const response = await fetch('/api/weather/impacted')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setWeatherData(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching weather impacted regions:', error)
    } finally {
      setLoading(false)
    }
  }


  const fetchBuyerProfile = async () => {
    try {
      const response = await fetch(`/api/profile?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        // Extract region from buyer's address
        if (data.address) {
          const { extractRegionFromAddress } = await import('@/lib/utils/region-extraction')
          const region = extractRegionFromAddress(data.address)
          if (region) {
            setUserRegion(region)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching buyer profile:', error)
    }
  }

  const fetchBuyerSuppliers = async () => {
    try {
      console.log('[Risk Monitor] Fetching suppliers for buyer:', userId)
      
      // Fetch invoices to get suppliers
      const invoicesResponse = await fetch(`/api/invoices?userId=${userId}&userType=BUYER`)
      if (!invoicesResponse.ok) {
        console.error('[Risk Monitor] Failed to fetch invoices:', invoicesResponse.status, invoicesResponse.statusText)
        setSuppliers([])
        return
      }
      
      const invoices = await invoicesResponse.json()
      console.log('[Risk Monitor] Invoices response:', Array.isArray(invoices) ? `${invoices.length} invoices` : 'Not an array', invoices)
      
      // Handle both array and object responses
      const invoicesArray = Array.isArray(invoices) ? invoices : (invoices.invoices || [])
      
      if (invoicesArray.length === 0) {
        console.log('[Risk Monitor] No invoices found for buyer')
        setSuppliers([])
        return
      }
      
      // Get unique supplier IDs (supplierId is the userId from invoices API)
      const supplierIds = Array.from(new Set(
        invoicesArray
          .map((inv: any) => inv.supplierId)
          .filter((id: any) => id && typeof id === 'string') // Filter out null/undefined
      ))
      
      console.log('[Risk Monitor] Found supplier IDs:', supplierIds)
      
      if (supplierIds.length === 0) {
        console.log('[Risk Monitor] No supplier IDs found in invoices')
        setSuppliers([])
        return
      }
      
      // Fetch supplier details
      const suppliersData: SupplierData[] = []
      for (const supplierId of supplierIds) {
        try {
          console.log('[Risk Monitor] Fetching supplier:', supplierId)
          const supplierResponse = await fetch(`/api/users/search?q=${supplierId}&type=SUPPLIER`)
          if (!supplierResponse.ok) {
            console.error(`[Risk Monitor] Failed to fetch supplier ${supplierId}:`, supplierResponse.status)
            continue
          }
          
          const supplierData = await supplierResponse.json()
          console.log('[Risk Monitor] Supplier data response:', supplierData)
          
          if (supplierData.success && supplierData.users && supplierData.users.length > 0) {
            const supplier = supplierData.users[0]
            
            // Calculate on-time delivery from invoices
            const supplierInvoices = invoicesArray.filter((inv: any) => inv.supplierId === supplierId)
            const paidInvoices = supplierInvoices.filter((inv: any) => inv.status === 'PAID').length
            const onTimeDelivery = supplierInvoices.length > 0
              ? Math.round((paidInvoices / supplierInvoices.length) * 100)
              : 0
            
            suppliersData.push({
              supplierId: supplier.userId,
              businessName: supplier.businessName || supplierId,
              regionsServed: supplier.regionsServed || supplier.address || '',
              reliabilityScore: supplier.creditScore || supplier.reliabilityScore || 50,
              onTimeDelivery,
            })
            
            console.log('[Risk Monitor] Added supplier:', supplier.userId, supplier.businessName)
          } else {
            console.warn(`[Risk Monitor] Supplier ${supplierId} not found or invalid response:`, supplierData)
          }
        } catch (supplierError) {
          console.error(`[Risk Monitor] Error fetching supplier ${supplierId}:`, supplierError)
        }
      }
      
      console.log('[Risk Monitor] Final suppliers list:', suppliersData.length, suppliersData)
      setSuppliers(suppliersData)
    } catch (error) {
      console.error('[Risk Monitor] Error fetching buyer suppliers:', error)
      setSuppliers([])
    }
  }

  const fetchHistoricalInvoices = async () => {
    try {
      const response = await fetch(`/api/invoices?userId=${userId}&userType=BUYER`)
      if (response.ok) {
        const invoices = await response.json()
        
        // Get buyer profile for address
        const profileResponse = await fetch(`/api/profile?userId=${userId}`)
        let buyerAddress = ''
        if (profileResponse.ok) {
          const profile = await profileResponse.json()
          buyerAddress = profile.address || ''
        }
        
        // Extract region from address
        const { extractRegionFromAddress } = await import('@/lib/utils/region-extraction')
        const defaultRegion = extractRegionFromAddress(buyerAddress) || userRegion || 'Jakarta'
        
        // Convert to HistoricalInvoice format
        const historical: HistoricalInvoice[] = invoices.map((inv: any) => {
          // Use buyer's region as delivery region (in production, this would come from order/delivery data)
          const deliveryRegion = defaultRegion
          
          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            buyerId: inv.buyerId,
            supplierId: inv.supplierId,
            dueDate: inv.dueDate,
            status: inv.status,
            paidAt: inv.status === 'PAID' ? inv.dueDate : undefined,
            daysOverdue: inv.daysOverdue,
            deliveryRegion,
          }
        })
        
        setHistoricalInvoices(historical)
      }
    } catch (error) {
      console.error('Error fetching historical invoices:', error)
    }
  }

  const fetchSupplierRisks = async () => {
    try {
      const response = await fetch(`/api/risk/suppliers?buyerId=${userId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setSupplierRiskData(result.data)
          
          // Also populate suppliers list from risk data (more reliable than separate fetch)
          // The risk API already fetches suppliers correctly from database
          const suppliersFromRisk: SupplierData[] = result.data.map((risk: SupplierRiskData) => ({
            supplierId: risk.supplierId,
            businessName: risk.businessName,
            regionsServed: Array.isArray(risk.regionsServed) 
              ? risk.regionsServed.join(', ') 
              : (risk.regionsServed || ''), // Convert array to string or use string directly
            reliabilityScore: risk.reliabilityScore,
            onTimeDelivery: risk.onTimeDelivery,
          }))
          
          console.log('[Risk Monitor] Suppliers from risk API:', suppliersFromRisk.length, suppliersFromRisk)
          setSuppliers(suppliersFromRisk)
        }
      }
    } catch (error) {
      console.error('Error fetching supplier risks:', error)
    }
  }

  const fetchBuyerWeatherData = async () => {
    setLoading(true)
    try {
      // Fetch buyer's region weather
      const buyerResponse = await fetch(`/api/weather?regions=${userRegion}`)
      if (buyerResponse.ok) {
        const buyerResult = await buyerResponse.json()
        if (buyerResult.success && buyerResult.data[userRegion]) {
          setBuyerRegionWeather(buyerResult.data[userRegion])
        }
      }

      // Fetch weather for all supplier regions
      const allRegions = new Set<string>()
      suppliers.forEach(supplier => {
        const regions = parseRegions(supplier.regionsServed)
        regions.forEach(region => allRegions.add(region))
      })

      if (allRegions.size > 0) {
        const regionsArray = Array.from(allRegions)
        const supplierResponse = await fetch(`/api/weather?regions=${regionsArray.join(',')}`)
        if (supplierResponse.ok) {
          const supplierResult = await supplierResponse.json()
          if (supplierResult.success) {
            // Organize by supplier
            const organized: Record<string, Record<string, WeatherData>> = {}
            suppliers.forEach(supplier => {
              organized[supplier.supplierId] = {}
              const regions = parseRegions(supplier.regionsServed)
              regions.forEach(region => {
                if (supplierResult.data[region]) {
                  organized[supplier.supplierId][region] = supplierResult.data[region]
                }
              })
            })
            setSupplierWeatherData(organized)
          }
        }
      }

      setLastUpdated(new Date().toISOString())
    } catch (error) {
      console.error('Error fetching buyer weather data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (severity: string) => {
    if (severity === 'severe') return <AlertCircle className="w-5 h-5 text-status-error" />
    return <CloudRain className="w-5 h-5 text-status-warning" />
  }

  const getStatusBadge = (severity: string) => {
    if (severity === 'severe') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-error/10 text-status-error">
          Severe
        </span>
      )
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-warning/10 text-status-warning">
        Affected
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-green/20 to-primary-olive/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-green" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-dark">{t.title}</h1>
              <p className="text-text-dark/60">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Supplier View */}
        {isSupplier && (
          <div className="space-y-6">
            {/* Primary Operating Base */}
            <div className="card-elevated">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-primary-green" />
                  <div>
                    <h2 className="text-xl font-bold text-text-dark">Primary Operating Base</h2>
                    <p className="text-sm text-text-dark/60">Current weather conditions at your main operations center</p>
                  </div>
                </div>
                <button
                  onClick={fetchWeatherImpacted}
                  className="text-sm text-primary-green hover:text-primary-olive transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
                  <p className="text-text-dark/60 mt-4">{tSearch.loadingWeather}</p>
                </div>
              ) : primaryBase && primaryBaseWeather ? (
                <div>
                  {(() => {
                    const status = getWeatherStatus(primaryBaseWeather)
                    const isAffected = status.status !== 'normal'
                    
                    return (
                      <div className={`p-6 rounded-xl border-2 ${
                        isAffected 
                          ? status.status === 'severe' 
                            ? 'border-status-error/50 bg-status-error/5' 
                            : 'border-status-warning/50 bg-status-warning/5'
                          : 'border-primary-green bg-primary-green/10'
                      }`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {isAffected ? (
                              status.status === 'severe' ? (
                                <AlertCircle className="w-8 h-8 text-status-error" />
                              ) : (
                                <CloudRain className="w-8 h-8 text-status-warning" />
                              )
                            ) : (
                              <CheckCircle className="w-8 h-8 text-primary-green" />
                            )}
                            <div>
                              <h3 className="text-2xl font-bold text-text-dark">{primaryBase}</h3>
                              <p className="text-sm text-text-dark/60 mt-1">Your primary operations location</p>
                            </div>
                          </div>
                          {isAffected ? (
                            status.status === 'severe' ? (
                              <span className="px-4 py-2 rounded-full text-sm font-medium bg-status-error/10 text-status-error">
                                Severe Weather
                              </span>
                            ) : (
                              <span className="px-4 py-2 rounded-full text-sm font-medium bg-status-warning/10 text-status-warning">
                                Weather Alert
                              </span>
                            )
                          ) : (
                            <span className="px-4 py-2 rounded-full text-sm font-medium bg-primary-green text-white font-semibold">
                              Normal Conditions
                            </span>
                          )}
                        </div>
                        <p className="text-base text-text-dark/80 mb-3">{primaryBaseWeather.forecast}</p>
                        <div className="flex items-center gap-4 text-sm text-text-dark/60">
                          <div className="flex items-center gap-2">
                            <Cloud className="w-4 h-4" />
                            <span>{primaryBaseWeather.weatherType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Updated: {formatDate(primaryBaseWeather.lastUpdated, language)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ) : primaryBase ? (
                <div className="text-center py-12">
                  <p className="text-text-dark/60">Loading weather data for {primaryBase}...</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-text-dark/60">No primary base location found</p>
                </div>
              )}
            </div>

            {/* Delivery Regions */}
            <div className="card-elevated">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Package className="w-6 h-6 text-primary-olive" />
                  <div>
                    <h2 className="text-xl font-bold text-text-dark">Delivery Regions</h2>
                    <p className="text-sm text-text-dark/60">Weather impact on your service areas</p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
                  <p className="text-text-dark/60 mt-4">{tSearch.loadingWeather}</p>
                </div>
              ) : supplierRegions.length > 1 ? (
                <div className="space-y-4">
                  {supplierRegions.slice(1).map((region, idx) => {
                    const weather = deliveryRegionsWeather[region]
                    if (!weather) {
                      return (
                        <div key={idx} className="p-4 rounded-xl border-2 border-cream-grey">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-text-dark">{region}</h3>
                              <p className="text-sm text-text-dark/60">Loading weather data...</p>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    
                    const status = getWeatherStatus(weather)
                    const isAffected = status.status !== 'normal'
                    
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border-2 transition-colors ${
                          isAffected 
                            ? status.status === 'severe' 
                              ? 'border-status-error/50 bg-status-error/5 hover:border-status-error' 
                              : 'border-status-warning/50 bg-status-warning/5 hover:border-status-warning'
                            : 'border-primary-green bg-primary-green/10 hover:border-primary-olive'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {isAffected ? (
                              status.status === 'severe' ? (
                                <AlertCircle className="w-5 h-5 text-status-error" />
                              ) : (
                                <CloudRain className="w-5 h-5 text-status-warning" />
                              )
                            ) : (
                              <CheckCircle className="w-5 h-5 text-primary-green" />
                            )}
                            <div>
                              <h3 className="font-semibold text-text-dark">{region}</h3>
                              <p className="text-xs text-text-dark/60">Delivery destination</p>
                            </div>
                          </div>
                          {isAffected ? (
                            status.status === 'severe' ? (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-error/10 text-status-error">
                                Severe
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-warning/10 text-status-warning">
                                Affected
                              </span>
                            )
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-green text-white font-semibold">
                              Normal
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-text-dark/70 mb-2">{weather.forecast}</p>
                        <div className="flex items-center gap-4 text-xs text-text-dark/50">
                          <div className="flex items-center gap-1">
                            <Cloud className="w-3 h-3" />
                            <span>{weather.weatherType}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Updated: {formatDate(weather.lastUpdated, language)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : supplierRegions.length === 1 ? (
                <div className="text-center py-12">
                  <p className="text-text-dark/60">No additional delivery regions configured</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-text-dark/60">No delivery regions found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buyer View */}
        {isBuyer && (
          <div className="space-y-6">
            {/* Risk Heatmap */}
            <RiskHeatmap
              suppliers={supplierRiskData}
              onSupplierClick={(supplierId) => {
                console.log('Supplier clicked:', supplierId)
                // Could navigate to supplier details or show more info
              }}
            />

            {/* Summary Overview Card */}
            {(() => {
              const totalSuppliers = suppliers.length
              const suppliersWithIssues = suppliers.filter(supplier => {
                const regions = parseRegions(supplier.regionsServed)
                return regions.some(region => {
                  const weather = supplierWeatherData[supplier.supplierId]?.[region]
                  if (!weather) return false
                  const status = getWeatherStatus(weather)
                  return status.status !== 'normal'
                })
              }).length
              
              const totalAffectedRegions = Object.values(supplierWeatherData).reduce((acc, regions) => {
                return acc + Object.values(regions).filter(weather => {
                  const status = getWeatherStatus(weather)
                  return status.status !== 'normal'
                }).length
              }, 0)

              const buyerRegionStatus = buyerRegionWeather ? getWeatherStatus(buyerRegionWeather) : null
              const overallRisk = buyerRegionStatus?.status !== 'normal' || suppliersWithIssues > 0 ? 'elevated' : 'low'

              return (
                <div className="card-elevated">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-green/20 to-primary-olive/20 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-primary-green" />
                      </div>
                      <h2 className="text-xl font-bold text-text-dark">Risk Overview</h2>
                    </div>
                    <button
                      onClick={fetchBuyerWeatherData}
                      className="btn-secondary text-sm flex items-center gap-2"
                      disabled={loading}
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-gradient-to-br from-primary-green/5 to-primary-green/0 rounded-xl border border-primary-green/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-primary-green" />
                        <p className="text-xs font-medium text-text-dark/60">Suppliers Monitored</p>
                      </div>
                      <p className="text-2xl font-bold text-text-dark">{totalSuppliers}</p>
                    </div>

                    <div className={`p-4 rounded-xl border ${
                      suppliersWithIssues > 0 
                        ? 'bg-gradient-to-br from-status-warning/5 to-status-warning/0 border-status-warning/20' 
                        : 'bg-gradient-to-br from-status-success/5 to-status-success/0 border-status-success/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className={`w-4 h-4 ${suppliersWithIssues > 0 ? 'text-status-warning' : 'text-status-success'}`} />
                        <p className="text-xs font-medium text-text-dark/60">Suppliers Affected</p>
                      </div>
                      <p className={`text-2xl font-bold ${suppliersWithIssues > 0 ? 'text-status-warning' : 'text-status-success'}`}>
                        {suppliersWithIssues}
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${
                      totalAffectedRegions > 0 
                        ? 'bg-gradient-to-br from-status-warning/5 to-status-warning/0 border-status-warning/20' 
                        : 'bg-gradient-to-br from-status-success/5 to-status-success/0 border-status-success/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className={`w-4 h-4 ${totalAffectedRegions > 0 ? 'text-status-warning' : 'text-status-success'}`} />
                        <p className="text-xs font-medium text-text-dark/60">Regions Affected</p>
                      </div>
                      <p className={`text-2xl font-bold ${totalAffectedRegions > 0 ? 'text-status-warning' : 'text-status-success'}`}>
                        {totalAffectedRegions}
                      </p>
                    </div>

                    <div className={`p-4 rounded-xl border ${
                      overallRisk === 'elevated'
                        ? 'bg-gradient-to-br from-status-warning/5 to-status-warning/0 border-status-warning/20' 
                        : 'bg-gradient-to-br from-status-success/5 to-status-success/0 border-status-success/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className={`w-4 h-4 ${overallRisk === 'elevated' ? 'text-status-warning' : 'text-status-success'}`} />
                        <p className="text-xs font-medium text-text-dark/60">Overall Risk</p>
                      </div>
                      <p className={`text-lg font-bold ${overallRisk === 'elevated' ? 'text-status-warning' : 'text-status-success'}`}>
                        {overallRisk === 'elevated' ? 'Elevated' : 'Low'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-cream-grey/30">
                    <p className="text-xs text-text-dark/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t.lastUpdated}: {formatDate(lastUpdated, language)}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Your Region Weather Status */}
            <div className="card-elevated">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-primary-green" />
                  <h2 className="text-xl font-bold text-text-dark">{t.yourRegion}</h2>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
                  <p className="text-text-dark/60 mt-4">{tSearch.loadingWeather}</p>
                </div>
              ) : buyerRegionWeather ? (
                (() => {
                  const status = getWeatherStatus(buyerRegionWeather)
                  return (
                    <div className={`p-6 rounded-xl border-2 ${
                      status.status === 'normal' 
                        ? 'bg-gradient-to-br from-primary-green/5 to-primary-olive/5 border-primary-green/20' 
                        : status.status === 'affected'
                        ? 'bg-gradient-to-br from-status-warning/5 to-status-warning/0 border-status-warning/20'
                        : 'bg-gradient-to-br from-status-error/5 to-status-error/0 border-status-error/20'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-text-dark">{userRegion}</h3>
                          {buyerRegionWeather.temperature && (
                            <p className="text-sm text-text-dark/60 mt-1">
                              {Math.round(buyerRegionWeather.temperature)}°C • {buyerRegionWeather.humidity}% humidity
                            </p>
                          )}
                        </div>
                        <div className="text-3xl">{status.icon}</div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-medium ${
                          status.status === 'normal' ? 'text-status-success' :
                          status.status === 'affected' ? 'text-status-warning' :
                          'text-status-error'
                        }`}>
                          {status.status === 'normal' ? tSearch.normalConditions :
                           status.status === 'affected' ? tSearch.mayExperienceDelays :
                           tSearch.severeWeather}
                        </span>
                      </div>
                      <p className="text-sm text-text-dark/70">{buyerRegionWeather.description}</p>
                      {buyerRegionWeather.forecast && (
                        <p className="text-xs text-text-dark/60 mt-2">{buyerRegionWeather.forecast}</p>
                      )}
                    </div>
                  )
                })()
              ) : (
                <div className="p-6 bg-gradient-to-br from-cream-beige/20 to-cream-white rounded-xl border border-cream-grey/30">
                  <p className="text-text-dark/60">Unable to fetch weather data</p>
                </div>
              )}
            </div>

            {/* Suppliers You Work With */}
            <div className="card-elevated">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Package className="w-6 h-6 text-primary-olive" />
                  <h2 className="text-xl font-bold text-text-dark">{t.suppliersYouWorkWith}</h2>
                </div>
                <span className="text-xs text-text-dark/50">{suppliers.length} suppliers</span>
              </div>

              <div className="space-y-4">
                {suppliers.length === 0 ? (
                  <p className="text-text-dark/60 text-center py-8">No suppliers found</p>
                ) : (
                  suppliers.map((supplier) => {
                  const regions = parseRegions(supplier.regionsServed)
                  const supplierRegions = supplierWeatherData[supplier.supplierId] || {}
                  
                  // Group regions by status
                  const normalRegions = regions.filter(region => {
                    const weather = supplierRegions[region]
                    if (!weather) return false
                    const status = getWeatherStatus(weather)
                    return status.status === 'normal'
                  })
                  
                  const affectedRegions = regions.filter(region => {
                    const weather = supplierRegions[region]
                    if (!weather) return false
                    const status = getWeatherStatus(weather)
                    return status.status !== 'normal'
                  })

                  const hasIssues = affectedRegions.length > 0

                  return (
                    <div
                      key={supplier.supplierId}
                      className={`p-5 rounded-xl border-2 transition-all ${
                        hasIssues 
                          ? 'bg-gradient-to-br from-status-warning/5 to-status-warning/0 border-status-warning/30 hover:border-status-warning/50' 
                          : 'bg-white border-cream-grey/30 hover:border-primary-green/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-text-dark">{supplier.businessName}</h3>
                            {hasIssues && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-status-warning/20 text-status-warning border border-status-warning/30">
                                Weather Impact
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-text-dark/60 mt-2">
                            <span>Reliability: {supplier.reliabilityScore}%</span>
                            <span>•</span>
                            <span>On-Time: {supplier.onTimeDelivery}%</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs font-medium text-text-dark/60 mb-3">{tSearch.regionsServed}</p>
                      
                      <div className="space-y-2">
                        {/* Normal regions */}
                        {normalRegions.length > 0 && normalRegions.map((region, idx) => {
                          const weather = supplierRegions[region]
                          const status = weather ? getWeatherStatus(weather) : null
                          const isBuyerRegion = region === userRegion
                          
                          return (
                            <div 
                              key={`normal-${idx}`} 
                              className="flex items-center justify-between p-2.5 rounded-lg bg-status-success/5 border border-status-success/20"
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-status-success" />
                                <span className="font-medium text-sm text-text-dark">{region}</span>
                                {isBuyerRegion && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-green/20 text-primary-green border border-primary-green/30">
                                    Your Region
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{status?.icon || '✅'}</span>
                                <span className="text-xs font-medium text-status-success">{tSearch.normalConditions}</span>
                              </div>
                            </div>
                          )
                        })}

                        {/* Divider if both normal and affected */}
                        {normalRegions.length > 0 && affectedRegions.length > 0 && (
                          <div className="my-2 border-t border-cream-grey/30"></div>
                        )}

                        {/* Affected regions */}
                        {affectedRegions.length > 0 && affectedRegions.map((region, idx) => {
                          const weather = supplierRegions[region]
                          const status = weather ? getWeatherStatus(weather) : null
                          const isBuyerRegion = region === userRegion
                          
                          return (
                            <div 
                              key={`affected-${idx}`} 
                              className={`flex items-center justify-between p-2.5 rounded-lg border-2 ${
                                status?.status === 'severe'
                                  ? 'bg-status-error/5 border-status-error/30'
                                  : 'bg-status-warning/5 border-status-warning/30'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className={`w-3.5 h-3.5 ${
                                  status?.status === 'severe' ? 'text-status-error' : 'text-status-warning'
                                }`} />
                                <span className="font-medium text-sm text-text-dark">{region}</span>
                                {isBuyerRegion && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-green/20 text-primary-green border border-primary-green/30">
                                    Your Region
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{status?.icon || '⚠️'}</span>
                                <span className={`text-xs font-medium ${
                                  status?.status === 'severe' ? 'text-status-error' : 'text-status-warning'
                                }`}>
                                  {status?.status === 'affected' ? tSearch.mayExperienceDelays : tSearch.severeWeather}
                                </span>
                              </div>
                            </div>
                          )
                        })}

                        {/* Loading state */}
                        {regions.length > 0 && Object.keys(supplierRegions).length === 0 && loading && (
                          <div className="text-center py-2 text-xs text-text-dark/40">
                            {tSearch.loadingWeather}...
                          </div>
                        )}
                      </div>
                    </div>
                  )
                  })
                )}
              </div>
            </div>

            {/* Operational Advisories */}
            <div className="card-elevated">
              <div className="flex items-center gap-3 mb-6">
                <AlertCircle className="w-6 h-6 text-status-warning" />
                <h2 className="text-xl font-bold text-text-dark">{t.operationalAdvisories}</h2>
              </div>

              {(() => {
                const buyerRegionStatus = buyerRegionWeather ? getWeatherStatus(buyerRegionWeather) : null
                const affectedSuppliers = suppliers.filter(supplier => {
                  const regions = parseRegions(supplier.regionsServed)
                  return regions.some(region => {
                    const weather = supplierWeatherData[supplier.supplierId]?.[region]
                    if (!weather) return false
                    const status = getWeatherStatus(weather)
                    return status.status !== 'normal'
                  })
                })

                const advisories: Array<{ type: 'warning' | 'info' | 'success', message: string, icon: JSX.Element, historicalContext?: string }> = []

                // Buyer region advisory
                if (buyerRegionStatus && buyerRegionStatus.status !== 'normal') {
                  advisories.push({
                    type: buyerRegionStatus.status === 'severe' ? 'warning' : 'warning',
                    message: `Your region (${userRegion}) is experiencing ${buyerRegionStatus.status === 'severe' ? 'severe weather' : 'weather delays'}. Consider adjusting delivery expectations.`,
                    icon: <AlertCircle className="w-5 h-5" />
                  })
                }

                // Supplier advisories
                affectedSuppliers.forEach(supplier => {
                  const regions = parseRegions(supplier.regionsServed)
                  const affectedRegions = regions.filter(region => {
                    const weather = supplierWeatherData[supplier.supplierId]?.[region]
                    if (!weather) return false
                    const status = getWeatherStatus(weather)
                    return status.status !== 'normal'
                  })

                  if (affectedRegions.length > 0) {
                    advisories.push({
                      type: 'warning',
                      message: `${supplier.businessName} has ${affectedRegions.length} affected region${affectedRegions.length > 1 ? 's' : ''} (${affectedRegions.join(', ')}). Monitor delivery timelines.`,
                      icon: <Package className="w-5 h-5" />
                    })
                  }
                })

                // Multiple suppliers affected
                if (affectedSuppliers.length > 1) {
                  advisories.push({
                    type: 'warning',
                    message: `${affectedSuppliers.length} suppliers are experiencing weather impacts. Consider diversifying orders or adjusting timelines.`,
                    icon: <Activity className="w-5 h-5" />
                  })
                }

                if (advisories.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-status-success mx-auto mb-3 opacity-50" />
                      <p className="text-text-dark/60">{t.noAdvisories}</p>
                      <p className="text-xs text-text-dark/40 mt-2">All regions are operating under normal conditions</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-3">
                    {advisories.map((advisory, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border-2 flex items-start gap-3 ${
                          advisory.type === 'warning'
                            ? 'bg-status-warning/5 border-status-warning/30'
                            : advisory.type === 'info'
                            ? 'bg-primary-green/5 border-primary-green/30'
                            : 'bg-status-success/5 border-status-success/30'
                        }`}
                      >
                        <div className={`mt-0.5 ${
                          advisory.type === 'warning' ? 'text-status-warning' :
                          advisory.type === 'info' ? 'text-primary-green' :
                          'text-status-success'
                        }`}>
                          {advisory.icon}
                        </div>
                        <p className={`text-sm flex-1 ${
                          advisory.type === 'warning' ? 'text-status-warning' : 'text-text-dark'
                        }`}>
                          {advisory.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Historical Patterns Subsection */}
            {isBuyer && (() => {
              // Get buyer's historical patterns
              const buyerHistoricalInvoices = historicalInvoices.filter(inv => 
                inv.buyerId === userId
              )
              
              const buyerRegionStatus = buyerRegionWeather ? getWeatherStatus(buyerRegionWeather) : null
              const hasWeatherRisk = buyerRegionStatus && buyerRegionStatus.status !== 'normal'
              
              // Get affected suppliers (same logic as advisories)
              const affectedSuppliersForPatterns = suppliers.filter(supplier => {
                const regions = parseRegions(supplier.regionsServed)
                return regions.some(region => {
                  const weather = supplierWeatherData[supplier.supplierId]?.[region]
                  if (!weather) return false
                  const status = getWeatherStatus(weather)
                  return status.status !== 'normal'
                })
              })
              
              // Get supplier historical patterns
              const supplierPatterns: Array<{
                supplierName: string
                region: string
                pattern: string
                avgDelay: number
              }> = []
              
              affectedSuppliersForPatterns.forEach(supplier => {
                const regions = parseRegions(supplier.regionsServed)
                const affectedRegions = regions.filter(region => {
                  const weather = supplierWeatherData[supplier.supplierId]?.[region]
                  if (!weather) return false
                  const status = getWeatherStatus(weather)
                  return status.status !== 'normal'
                })
                
                affectedRegions.forEach(region => {
                  const supplierInvoices = historicalInvoices.filter(inv => 
                    inv.supplierId === supplier.supplierId && inv.deliveryRegion === region
                  )
                  
                  if (supplierInvoices.length > 0) {
                    const overdueInvoices = supplierInvoices.filter(inv => 
                      inv.status === 'OVERDUE' && inv.daysOverdue && inv.daysOverdue > 0
                    )
                    
                    if (overdueInvoices.length > 0) {
                      const avgDelay = Math.round(
                        overdueInvoices.reduce((sum, inv) => sum + (inv.daysOverdue || 0), 0) / overdueInvoices.length
                      )
                      
                      supplierPatterns.push({
                        supplierName: supplier.businessName,
                        region: region,
                        pattern: `${overdueInvoices.length} out of ${supplierInvoices.length} past deliveries to ${region} were delayed`,
                        avgDelay: avgDelay,
                      })
                    }
                  }
                })
              })
              
              // Calculate buyer's own pattern
              let buyerPattern: { pattern: string; avgDelay: number } | null = null
              if (hasWeatherRisk && buyerHistoricalInvoices.length > 0) {
                const currentInvoice: HistoricalInvoice = {
                  id: 'current',
                  invoiceNumber: 'CURRENT',
                  buyerId: userId,
                  supplierId: 'SP0023',
                  dueDate: new Date().toISOString(),
                  status: 'PENDING',
                  deliveryRegion: userRegion,
                }
                
                const correlation = calculateWeatherCorrelation(
                  currentInvoice,
                  buyerHistoricalInvoices,
                  buyerRegionStatus!.status === 'severe' ? 'severe' : 'affected',
                  userRegion
                )
                
                if (correlation && correlation.pattern) {
                  buyerPattern = {
                    pattern: correlation.pattern,
                    avgDelay: correlation.averageDelayDays,
                  }
                }
              }
              
              // Only show if there are patterns to display
              if (!buyerPattern && supplierPatterns.length === 0) {
                return null
              }
              
              return (
                <div className="card-elevated mt-6">
                  <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="w-6 h-6 text-primary-green" />
                    <h2 className="text-xl font-bold text-text-dark">{t.historicalPatterns}</h2>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Buyer's own pattern */}
                    {buyerPattern && (
                      <div className="p-4 bg-primary-green/5 rounded-xl border border-primary-green/20">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-green/20 flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-4 h-4 text-primary-green" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-text-dark mb-1">{t.yourPaymentPattern}</h3>
                            <p className="text-sm text-text-dark/70 mb-2">{buyerPattern.pattern}</p>
                            {buyerPattern.avgDelay > 0 && (
                              <p className="text-xs text-text-dark/60">
                                {t.averageDelay}: <span className="font-medium">{buyerPattern.avgDelay}-{buyerPattern.avgDelay + 1} {t.days}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Supplier patterns */}
                    {supplierPatterns.map((pattern, idx) => (
                      <div key={idx} className="p-4 bg-status-warning/5 rounded-xl border border-status-warning/20">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-status-warning/20 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-status-warning" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-text-dark mb-1">{pattern.supplierName} - {pattern.region}</h3>
                            <p className="text-sm text-text-dark/70 mb-2">{pattern.pattern}</p>
                            {pattern.avgDelay > 0 && (
                              <p className="text-xs text-text-dark/60">
                                {t.averageDelay}: <span className="font-medium">{pattern.avgDelay}-{pattern.avgDelay + 1} {t.days}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Empty State - No user type detected */}
        {!isSupplier && !isBuyer && (
          <div className="card-elevated text-center py-12">
            <Shield className="w-16 h-16 text-cream-grey mx-auto mb-4" />
            <p className="text-text-dark/60">Please log in to view risk monitoring</p>
          </div>
        )}
      </div>
    </div>
  )
}

