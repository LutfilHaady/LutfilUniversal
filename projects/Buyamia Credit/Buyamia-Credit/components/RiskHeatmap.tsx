'use client'

import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { MapPin, AlertCircle, TrendingUp, CloudRain, DollarSign, Building2, Users } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'
import L from 'leaflet'

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

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

interface RiskHeatmapProps {
  suppliers?: SupplierRiskData[]
  onSupplierClick?: (supplierId: string) => void
}

function getRiskColor(risk: number): string {
  if (risk >= 70) return '#B44A4A' // Red - Critical
  if (risk >= 50) return '#C69F33' // Orange - High
  if (risk >= 30) return '#FCD34D' // Yellow - Medium
  return '#3C7F58' // Green - Low
}

function getRiskLabel(risk: number): string {
  if (risk >= 70) return 'Critical'
  if (risk >= 50) return 'High'
  if (risk >= 30) return 'Medium'
  return 'Low'
}

// Custom marker icon with risk-based color
function createRiskIcon(color: string, isSupplier: boolean = false) {
  const iconSize = isSupplier ? 28 : 24
  const icon = isSupplier ? 'building' : 'pin'
  
  return L.divIcon({
    className: 'custom-risk-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${iconSize}px;
        height: ${iconSize}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${isSupplier ? `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm4 8H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2z"/>
          </svg>
        ` : `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        `}
      </div>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
  })
}

// Component to handle map view updates and prevent zoom on popup
function MapViewUpdater({ center, zoom, initialOnly = false }: { center: [number, number]; zoom: number; initialOnly?: boolean }) {
  const map = useMap()
  const [hasSetInitial, setHasSetInitial] = useState(false)
  
  useEffect(() => {
    // Set initial view only once
    if (!hasSetInitial) {
      map.setView(center, zoom, { animate: false })
      setHasSetInitial(true)
    }
    
    // Prevent zoom on popup open
    const handlePopupOpen = () => {
      const currentZoom = map.getZoom()
      const currentCenter = map.getCenter()
      // Force keep current view after popup opens
      setTimeout(() => {
        if (map.getZoom() !== currentZoom) {
          map.setView(currentCenter, currentZoom, { animate: false })
        }
      }, 10)
    }
    
    map.on('popupopen', handlePopupOpen)
    
    return () => {
      map.off('popupopen', handlePopupOpen)
    }
  }, [map, center, zoom, hasSetInitial])
  
  return null
}

export default function RiskHeatmap({ suppliers = [], onSupplierClick }: RiskHeatmapProps) {
  const { language } = useLanguage()
  const t = translations[language].riskMonitor
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Handle client-side mounting for Leaflet
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSupplierClick = (supplierId: string) => {
    setSelectedSupplier(selectedSupplier === supplierId ? null : supplierId)
    onSupplierClick?.(supplierId)
  }

  // Show all suppliers (no filtering)
  const filteredSuppliers = suppliers

  // Center map on Jakarta (where most suppliers are) with closer zoom
  // Always center on Jakarta for better visibility of suppliers
  const mapCenter: [number, number] = [-6.2088, 106.8456] // Jakarta coordinates
  const mapZoom = 11 // Zoom level 11 for city-level view (shows Jakarta area clearly)

  if (!mounted) {
    return (
      <div className="card-elevated">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-primary-green" />
            <h2 className="text-xl font-bold text-text-dark">Risk Heatmap</h2>
          </div>
        </div>
        <div className="h-[500px] bg-cream-beige/30 rounded-xl flex items-center justify-center">
          <p className="text-text-dark/60">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card-elevated">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6 text-primary-green" />
          <h2 className="text-xl font-bold text-text-dark">Risk Heatmap</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Suppliers only - no toggle needed */}
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="relative rounded-xl overflow-hidden border-2 border-cream-grey" style={{ height: '500px' }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <MapViewUpdater center={mapCenter} zoom={mapZoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Supplier Markers */}
          {filteredSuppliers.map((supplier) => {
            const risk = supplier.combinedRisk

            const riskColor = getRiskColor(risk)
            const riskIcon = createRiskIcon(riskColor, true)

            return (
              <Marker
                key={`supplier-${supplier.supplierId}`}
                position={[supplier.coordinates.lat, supplier.coordinates.lng]}
                icon={riskIcon}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation()
                    // Prevent any map zoom/pan
                    const map = e.target._map
                    if (map) {
                      map.dragging.disable()
                      setTimeout(() => map.dragging.enable(), 100)
                    }
                    handleSupplierClick(supplier.supplierId)
                  },
                }}
              >
                <Popup 
                  autoPan={false} 
                  closeOnClick={false}
                  autoClose={false}
                  keepInView={false}
                >
                  <div className="p-3 min-w-[280px]">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-text-dark text-sm mb-1">{supplier.businessName}</h3>
                        <p className="text-xs text-text-dark/60">{supplier.primaryRegion}</p>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        supplier.delayProbability === 'high' ? 'bg-status-error/10 text-status-error' :
                        supplier.delayProbability === 'medium' ? 'bg-status-warning/10 text-status-warning' :
                        'bg-status-success/10 text-status-success'
                      }`}>
                        {supplier.delayProbability === 'high' ? 'High Delay Risk' :
                         supplier.delayProbability === 'medium' ? 'Moderate Risk' :
                         'Low Risk'}
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-text-dark/60">Weather Risk:</span>
                        <span className={`font-medium ${
                          supplier.weatherRisk >= 70 ? 'text-status-error' :
                          supplier.weatherRisk >= 50 ? 'text-status-warning' :
                          supplier.weatherRisk >= 30 ? 'text-yellow-600' :
                          'text-status-success'
                        }`}>
                          {supplier.weatherRisk}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-dark/60">Payment Risk:</span>
                        <span className={`font-medium ${
                          supplier.paymentRisk >= 70 ? 'text-status-error' :
                          supplier.paymentRisk >= 50 ? 'text-status-warning' :
                          supplier.paymentRisk >= 30 ? 'text-yellow-600' :
                          'text-status-success'
                        }`}>
                          {supplier.paymentRisk}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-dark/60">Combined Risk:</span>
                        <span className={`font-medium ${
                          supplier.combinedRisk >= 70 ? 'text-status-error' :
                          supplier.combinedRisk >= 50 ? 'text-status-warning' :
                          supplier.combinedRisk >= 30 ? 'text-yellow-600' :
                          'text-status-success'
                        }`}>
                          {supplier.combinedRisk}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-cream-grey">
                        <span className="text-text-dark/60">Reliability:</span>
                        <span className="font-medium text-text-dark">
                          {supplier.reliabilityScore}%
                        </span>
                      </div>
                    </div>

                    {/* Historical Correlation */}
                    {supplier.historicalCorrelation && (
                      <div className="mt-3 pt-3 border-t border-cream-grey">
                        <p className="text-xs font-semibold text-text-dark mb-1">Historical Pattern</p>
                        <p className="text-xs text-text-dark/70 mb-1">{supplier.historicalCorrelation.pattern}</p>
                        {supplier.historicalCorrelation.correlationInsight && (
                          <p className="text-xs text-text-dark/60 italic">
                            {supplier.historicalCorrelation.correlationInsight}
                          </p>
                        )}
                        {supplier.historicalCorrelation.averageDelayDays > 0 && (
                          <p className="text-xs text-text-dark/60 mt-1">
                            Avg delay: {supplier.historicalCorrelation.averageDelayDays} days
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}

        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 border border-cream-grey shadow-lg z-[1000]">
          <p className="text-xs font-semibold text-text-dark mb-2">Risk Levels</p>
          <div className="flex flex-col gap-1.5">
            {[
              { label: 'Low', color: '#3C7F58', risk: '0-29' },
              { label: 'Medium', color: '#FCD34D', risk: '30-49' },
              { label: 'High', color: '#C69F33', risk: '50-69' },
              { label: 'Critical', color: '#B44A4A', risk: '70-100' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full`} style={{ backgroundColor: item.color }}></div>
                <span className="text-xs text-text-dark">{item.label} ({item.risk})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
