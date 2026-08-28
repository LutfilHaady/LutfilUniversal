'use client'

import { Ban } from 'lucide-react'

interface BuyerBlacklistBadgeProps {
  isBlacklisted?: boolean
  className?: string
}

export default function BuyerBlacklistBadge({
  isBlacklisted = false,
  className = '',
}: BuyerBlacklistBadgeProps) {
  if (!isBlacklisted) return null

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-status-error/10 text-status-error ${className}`}
      title="This buyer is blacklisted"
    >
      <Ban className="w-3 h-3" />
      Blacklisted
    </span>
  )
}

