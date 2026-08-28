'use client'

import { useState, useEffect } from 'react'
import { X, Search, CheckCircle, AlertCircle, TrendingUp, User, CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ReplacementBuyer {
  buyerId: string
  businessName: string
  creditScore: number
  riskLevel: string
  businessTypes: string[]
  averagePurchaseVolume?: string
  orderFrequency?: string
  preferredPaymentTerm?: string
  yearsInOperation?: number
  address?: string
  similarityScore: number
  relevanceScore: number
  matchDetails: {
    businessTypeMatch: number
    volumeMatch: number
    frequencyMatch: number
  }
}

interface ReplaceBuyerModalProps {
  isOpen: boolean
  onClose: () => void
  buyerId: string
  buyerName: string
  onReplace: (replacementBuyerId: string, originalBuyerId: string) => void
}

export default function ReplaceBuyerModal({
  isOpen,
  onClose,
  buyerId,
  buyerName,
  onReplace,
}: ReplaceBuyerModalProps) {
  const [recommendations, setRecommendations] = useState<ReplacementBuyer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBuyer, setSelectedBuyer] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && buyerId) {
      fetchRecommendations()
    }
  }, [isOpen, buyerId])

  const fetchRecommendations = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/suppliers/replacements/${buyerId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations')
      }
      const data = await response.json()
      if (data.success) {
        setRecommendations(data.recommendations || [])
      } else {
        setError(data.error || 'Failed to load recommendations')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReplace = () => {
    if (selectedBuyer) {
      onReplace(selectedBuyer, buyerId)
      onClose()
    }
  }

  const getRiskColor = (riskLevel: string): string => {
    if (riskLevel === 'Low Risk') return '#3C7F58'
    if (riskLevel === 'Medium Risk') return '#C69F33'
    return '#B44A4A'
  }

  const getRiskBadge = (riskLevel: string) => {
    const color = getRiskColor(riskLevel)
    const bgColor =
      riskLevel === 'Low Risk'
        ? 'bg-status-success/10'
        : riskLevel === 'Medium Risk'
          ? 'bg-status-warning/10'
          : 'bg-status-error/10'
    const textColor =
      riskLevel === 'Low Risk'
        ? 'text-status-success'
        : riskLevel === 'Medium Risk'
          ? 'text-status-warning'
          : 'text-status-error'

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
      >
        {riskLevel}
      </span>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cream-grey">
          <div>
            <h2 className="text-2xl font-bold text-text-dark">Replace Buyer</h2>
            <p className="text-sm text-text-dark/60 mt-1">
              Find alternative buyers for <span className="font-semibold">{buyerName}</span> with
              better credit profiles
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cream-grey rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-dark" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
              <span className="ml-3 text-text-dark">Loading recommendations...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-status-error mb-4" />
              <p className="text-text-dark font-medium">{error}</p>
              <button
                onClick={fetchRecommendations}
                className="mt-4 px-4 py-2 bg-primary-green text-white rounded-lg hover:bg-primary-olive transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="w-12 h-12 text-text-dark/40 mb-4" />
              <p className="text-text-dark font-medium">No replacement buyers found</p>
              <p className="text-sm text-text-dark/60 mt-2">
                Try searching for buyers manually or adjust your criteria
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((recommendation) => (
                <div
                  key={recommendation.buyerId}
                  className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                    selectedBuyer === recommendation.buyerId
                      ? 'border-primary-green bg-primary-green/5'
                      : 'border-cream-grey hover:border-primary-green/50 hover:bg-cream-beige/30'
                  }`}
                  onClick={() => setSelectedBuyer(recommendation.buyerId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-text-dark">
                          {recommendation.businessName}
                        </h3>
                        {getRiskBadge(recommendation.riskLevel)}
                        {selectedBuyer === recommendation.buyerId && (
                          <CheckCircle className="w-5 h-5 text-primary-green" />
                        )}
                      </div>
                      <p className="text-sm text-text-dark/60 mb-3">
                        {recommendation.buyerId} • {recommendation.address || 'No address'}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-text-dark/60 mb-1">Credit Score</p>
                          <div className="flex items-center gap-2">
                            <TrendingUp
                              className="w-4 h-4"
                              style={{ color: getRiskColor(recommendation.riskLevel) }}
                            />
                            <span
                              className="font-semibold"
                              style={{ color: getRiskColor(recommendation.riskLevel) }}
                            >
                              {recommendation.creditScore}/100
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-text-dark/60 mb-1">Match Score</p>
                          <p className="font-semibold text-text-dark">
                            {recommendation.similarityScore}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-dark/60 mb-1">Business Type</p>
                          <p className="font-semibold text-text-dark text-sm">
                            {recommendation.businessTypes.join(', ') || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-text-dark/60 mb-1">Volume</p>
                          <p className="font-semibold text-text-dark text-sm">
                            {recommendation.averagePurchaseVolume || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Match Details */}
                      <div className="flex items-center gap-4 text-xs text-text-dark/60">
                        <span>Type: {recommendation.matchDetails.businessTypeMatch}%</span>
                        <span>Volume: {recommendation.matchDetails.volumeMatch}%</span>
                        <span>Frequency: {recommendation.matchDetails.frequencyMatch}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-cream-grey">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-dark hover:bg-cream-grey rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReplace}
            disabled={!selectedBuyer || isLoading}
            className="px-6 py-2 bg-primary-green text-white rounded-lg hover:bg-primary-olive transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Replace Buyer
          </button>
        </div>
      </div>
    </div>
  )
}

