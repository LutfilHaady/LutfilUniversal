'use client'

import { getScoreColor, getScoreLabel } from '@/lib/utils'

interface CreditScoreWidgetProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export default function CreditScoreWidget({ score, size = 'lg' }: CreditScoreWidgetProps) {
  const { label, color } = getScoreLabel(score)
  const colorValue = getScoreColor(score)
  
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
  }
  
  const textSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  }
  
  // Calculate circumference and offset for circular progress
  const radius = size === 'lg' ? 70 : size === 'md' ? 56 : 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  
  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${sizeClasses[size]}`}>
        <svg className="transform -rotate-90" width={size === 'lg' ? 160 : size === 'md' ? 128 : 96} height={size === 'lg' ? 160 : size === 'md' ? 128 : 96}>
          {/* Background circle */}
          <circle
            cx={size === 'lg' ? 80 : size === 'md' ? 64 : 48}
            cy={size === 'lg' ? 80 : size === 'md' ? 64 : 48}
            r={radius}
            stroke="#E8E3D9"
            strokeWidth="8"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size === 'lg' ? 80 : size === 'md' ? 64 : 48}
            cy={size === 'lg' ? 80 : size === 'md' ? 64 : 48}
            r={radius}
            stroke={colorValue}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${textSizes[size]} ${color}`}>
            {score}
          </span>
        </div>
      </div>
      <p className={`mt-2 font-medium ${color}`}>{label}</p>
    </div>
  )
}

