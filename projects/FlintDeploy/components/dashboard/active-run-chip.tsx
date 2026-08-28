'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useActiveRuns } from '@/lib/hooks/useActiveRuns'
import { formatElapsed } from '@/lib/format-elapsed'

/**
 * Compact dashboard chip (§8) — a single row, deliberately not a full timer
 * widget, that surfaces the operator's open runs and links to /log where the
 * active-run drawer takes over. Renders nothing when there are no active runs.
 */
export function ActiveRunChip() {
  const { activeRuns } = useActiveRuns()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (activeRuns.length === 0) return null

  const elapsed = (startedAt: string) => formatElapsed(now - new Date(startedAt).getTime())
  const multiple = activeRuns.length > 1
  const first = activeRuns[0]

  const chipHref = (!multiple && first && (first.processCode === 'MIXC' || first.processCode === 'MIXE') && first.batchNumber)
    ? `/log/mixing/${encodeURIComponent(first.batchNumber)}`
    : '/log'

  return (
    <Link
      href={chipHref}
      data-testid="active-run-chip"
      className="flex items-center gap-3 rounded-xl border border-[#1f2a1f] bg-[#0c130c] px-4 py-2.5 hover:border-[#22c55e]/50 transition-colors"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-60 animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
      </span>
      <span className="text-[12px] font-semibold text-[#86efac] shrink-0">
        {multiple ? `${activeRuns.length} active runs` : '1 active run'}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-3 overflow-x-auto">
        {multiple ? (
          activeRuns.map((run) => (
            <span key={run.id} className="text-[12px] text-[#888888] whitespace-nowrap">
              <span className="font-mono text-[#f5f5f5]">{run.batchNumber ?? '—'}</span>{' '}
              <span className="font-mono text-[#22c55e] tabular-nums">{elapsed(run.startedAt)}</span>
            </span>
          ))
        ) : (
          <span className="text-[12px] text-[#888888] truncate">
            <span className="font-mono text-[#f5f5f5]">{first.batchNumber ?? '—'}</span>
            {' — '}
            <span>{first.processName}</span>{' '}
            <span className="font-mono text-[#22c55e] tabular-nums">{elapsed(first.startedAt)}</span>
          </span>
        )}
      </div>
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="#5a5a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  )
}
