'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutate } from 'swr'
import supabase from '@/lib/supabase'
import { useActiveRuns, type ActiveRun } from '@/lib/hooks/useActiveRuns'
import { formatElapsed } from '@/lib/format-elapsed'

/**
 * Persistent bar pinned to the bottom of the process log page (§8). Appears
 * whenever the signed-in operator has an active (InProgress) process run, so an
 * operator can leave the page and resume — the timer rehydrates from the DB
 * start timestamp, never from client-only state.
 *
 * Scoped to the process log page only (not global); the dashboard gets a
 * separate compact chip.
 */
export function ActiveRunDrawer() {
  const router = useRouter()
  const { activeRuns, refresh } = useActiveRuns()
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [completing, setCompleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Single shared 1s tick drives every run's elapsed display.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (activeRuns.length === 0) return null

  async function handleComplete(run: ActiveRun) {
    setCompleting(run.id)
    setError(null)
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const endDate = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`
    const endTime = `${p(d.getHours())}:${p(d.getMinutes())}`

    const { error: err } = await supabase
      .from('process_runs')
      .update({ end_date: endDate, end_time: endTime, status: 'AwaitingQC' })
      .eq('id', run.id)

    if (err) {
      setError(err.message)
      setCompleting(null)
      return
    }

    const isMixing = run.processCode === 'MIXC' || run.processCode === 'MIXE'
    if (isMixing && run.batchId) {
      await supabase
        .from('mixing_steps')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('batch_id', run.batchId)
        .eq('status', 'in_progress')
    }

    if (run.batchId) mutate(['process-timeline', run.batchId])
    await refresh()
    setCompleting(null)
    if (isMixing && run.batchNumber) {
      router.push(`/log/qc?runId=${encodeURIComponent(run.id)}&batchNumber=${encodeURIComponent(run.batchNumber)}`)
    } else if (run.batchNumber) {
      router.push(`/log?batchNumber=${encodeURIComponent(run.batchNumber)}`)
    }
  }

  const primary = activeRuns[0]
  const elapsed = (startedAt: string) => formatElapsed(now - new Date(startedAt).getTime())

  return (
    <div
      data-testid="active-run-drawer"
      className="shrink-0 border-t border-[#1f2a1f] bg-[#0c130c]"
    >
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-60 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-[#f5f5f5] font-medium truncate">
            {activeRuns.length > 1 ? `${activeRuns.length} active runs` : primary.processName}
          </div>
          {primary.batchNumber && (
            <div className="text-[11px] font-mono text-[#86efac] truncate">{primary.batchNumber}</div>
          )}
        </div>
        <span className="text-[15px] font-mono font-semibold text-[#22c55e] tabular-nums">
          {elapsed(primary.startedAt)}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#5a5a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={'shrink-0 transition-transform ' + (expanded ? 'rotate-180' : '')}
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4 flex flex-col gap-3">
          {error && (
            <div className="rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.07)] px-3 py-2 text-[11.5px] text-[#fca5a5]">
              {error}
            </div>
          )}
          {activeRuns.map((run) => (
            <div
              key={run.id}
              data-testid="active-run-row"
              className="rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-[13px] text-[#f5f5f5] font-medium truncate">{run.processName}</div>
                {run.batchNumber && (
                  <div className="text-[11px] font-mono text-[#888888] truncate">{run.batchNumber}</div>
                )}
                <div className="text-[22px] font-mono font-semibold text-[#22c55e] tabular-nums mt-1">
                  {elapsed(run.startedAt)}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => handleComplete(run)}
                  disabled={completing === run.id}
                  className="h-10 px-4 rounded-xl bg-[#22c55e] text-black font-semibold text-[13px] hover:bg-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {completing === run.id ? 'Completing…' : 'Complete run'}
                </button>
                {run.batchNumber && (
                  <button
                    onClick={() => {
                      const isMixing = run.processCode === 'MIXC' || run.processCode === 'MIXE';
                      const path = isMixing
                        ? `/log/mixing/${encodeURIComponent(run.batchNumber!)}`
                        : `/log?batchNumber=${encodeURIComponent(run.batchNumber!)}`;
                      router.push(path);
                    }}
                    className="h-8 px-3 rounded-lg border border-[#2a2a2a] text-[11px] text-[#86efac] hover:border-[#22c55e] transition-colors"
                  >
                    View log
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
