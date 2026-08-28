'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'

export interface YieldPoint {
  day: string   // "May 22"
  yield: number // percentage, e.g. 94.6
}

function formatDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' })
}

function buildYieldPoints(rows: { created_at: string; status: string }[]): YieldPoint[] {
  const byDay = new Map<string, { released: number; completed: number }>()
  for (const row of rows) {
    const day = row.created_at.slice(0, 10)
    const entry = byDay.get(day) ?? { released: 0, completed: 0 }
    entry.completed++
    if (row.status === 'Released') entry.released++
    byDay.set(day, entry)
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, { released, completed }]) => ({
      day: formatDay(day),
      yield: completed > 0 ? Math.round((released / completed) * 1000) / 10 : 0,
    }))
}

async function fetchYieldTrend(period: '7d' | '14d' | '30d'): Promise<YieldPoint[]> {
  const daysBack = period === '7d' ? 7 : period === '14d' ? 14 : 30
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('batches')
    .select('created_at, status')
    .not('parent_batch_id', 'is', null)
    .in('status', ['Released', 'Scrapped', 'Quarantine'])
    .gte('created_at', since)
    .order('created_at', { ascending: true })
  if (error) throw error
  return buildYieldPoints(data ?? [])
}

export function useYieldTrend(period: '7d' | '14d' | '30d') {
  const { data, isLoading, error } = useSWR(
    ['yield-trend', period],
    ([, p]) => fetchYieldTrend(p)
  )
  return {
    points: data ?? [],
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
