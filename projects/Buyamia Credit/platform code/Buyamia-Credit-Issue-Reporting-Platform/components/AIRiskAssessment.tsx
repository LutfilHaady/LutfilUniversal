'use client'

import { Brain, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'
import { translations } from '@/lib/translations'

interface FlaggedFactor {
  id: string
  label: string
  checked: boolean
}

interface AIRiskAssessmentProps {
  riskLevel: 'Critical Risk' | 'High Risk' | 'Medium Risk' | 'Low Risk'
  aiScore: number
  description: string
  flaggedFactors: FlaggedFactor[]
  recommendedCreditLimit: number
}

export default function AIRiskAssessment({
  riskLevel,
  aiScore,
  description,
  flaggedFactors,
  recommendedCreditLimit,
}: AIRiskAssessmentProps) {
  const { language } = useLanguage()
  const t = translations[language].buyerRegistry || {
    title: 'AI Risk Assessment',
    generateReport: 'Generate Report',
  }

  const getRiskColor = (level: string) => {
    if (level === 'Critical Risk') return 'text-status-error'
    if (level === 'High Risk') return 'text-status-error'
    if (level === 'Medium Risk') return 'text-status-warning'
    return 'text-status-success'
  }

  const getRiskBgColor = (level: string) => {
    if (level === 'Critical Risk') return 'bg-status-error/10 border-status-error/20'
    if (level === 'High Risk') return 'bg-status-error/10 border-status-error/20'
    if (level === 'Medium Risk') return 'bg-status-warning/10 border-status-warning/20'
    return 'bg-status-success/10 border-status-success/20'
  }

  return (
    <div className={`p-6 rounded-xl border-2 ${getRiskBgColor(riskLevel)}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-green/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-green" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-dark">AI Risk Assessment</h3>
            <p className={`text-sm font-semibold ${getRiskColor(riskLevel)}`}>
              {riskLevel}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-dark/60 mb-1">AI Score</p>
          <p className={`text-2xl font-bold ${getRiskColor(riskLevel)}`}>{aiScore}</p>
        </div>
      </div>

      <p className="text-sm text-text-dark/70 mb-6 leading-relaxed">
        {description}
      </p>

      <div className="mb-6">
        <h4 className="text-sm font-semibold text-text-dark mb-3">FLAGGED FACTORS</h4>
        <div className="space-y-2">
          {flaggedFactors.map((factor) => (
            <div key={factor.id} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                factor.checked 
                  ? 'bg-status-error border-status-error' 
                  : 'bg-white border-cream-grey'
              }`}>
                {factor.checked && (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                )}
              </div>
              <span className={`text-sm ${
                factor.checked ? 'text-text-dark font-medium' : 'text-text-dark/60'
              }`}>
                {factor.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-cream-grey/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-dark">Recommended Credit Limit</span>
          <span className={`text-lg font-bold ${
            recommendedCreditLimit === 0 ? 'text-status-error' : 'text-primary-green'
          }`}>
            {formatCurrency(recommendedCreditLimit)}
          </span>
        </div>
      </div>
    </div>
  )
}

