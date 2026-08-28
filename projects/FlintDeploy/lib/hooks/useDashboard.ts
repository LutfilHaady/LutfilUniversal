'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { SubBatch } from '@/lib/types'

export interface DbAlert {
  id: string
  severity: string
  message: string
  batch_id: string | null
  resolved_at: string | null
  created_at: string
}

/**
 * Calculate 7-day rolling QC pass rate (0-100 percentage).
 */
async function fetchQCPassRate(): Promise<number> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data } = await supabase
    .from('qc_check_results')
    .select('passed')
    .gte('created_at', sevenDaysAgo.toISOString())

  if (!data?.length) return 0
  return Math.round((data.filter((r: any) => r.passed).length / data.length) * 100)
}

// First-pass yield: % of process runs in the last 7 days where all QC checks passed
async function fetchFirstPassYield(): Promise<number | null> {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const { data } = await supabase
    .from('qc_check_results')
    .select('process_run_id, passed, created_at')
    .gte('created_at', since.toISOString())
  if (!data?.length) return null
  const byRun: Record<string, boolean> = {}
  for (const r of data as Array<{ process_run_id: string; passed: boolean }>) {
    byRun[r.process_run_id] = (byRun[r.process_run_id] ?? true) && r.passed
  }
  const runs = Object.values(byRun)
  return Math.round((runs.filter(Boolean).length / runs.length) * 100)
}

// Top defect: most common failed QC item name in the last 7 days
async function fetchTopDefect(): Promise<string | null> {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const { data } = await supabase
    .from('qc_check_results')
    .select('passed, qc_check_definitions(qc_item_name)')
    .eq('passed', false)
    .gte('created_at', since.toISOString())
  if (!data?.length) return null
  const counts: Record<string, number> = {}
  for (const r of data as Array<{ qc_check_definitions: Array<{ qc_item_name: string }> | { qc_item_name: string } | null }>) {
    const def = Array.isArray(r.qc_check_definitions) ? r.qc_check_definitions[0] : r.qc_check_definitions
    const name = def?.qc_item_name ?? 'Unknown'
    counts[name] = (counts[name] ?? 0) + 1
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? null
}

async function fetchDashboard(role: string | undefined) {
  let batchQuery = supabase
    .from('batches')
    .select('id, batch_number, parent_batch_id, material_id, status, current_quantity, original_quantity, unit, current_location, created_at, updated_at, material:materials(name, code, type)')
    .not('parent_batch_id', 'is', null)

  if (role === 'Operator') {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    batchQuery = batchQuery.gte('created_at', sevenDaysAgo.toISOString())
  }

  const [batchRes, alertRes, qcRate, firstPassYield, topDefect] = await Promise.all([
    batchQuery,
    supabase
      .from('alerts')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    fetchQCPassRate(),
    fetchFirstPassYield(),
    fetchTopDefect(),
  ])
  if (batchRes.error) throw batchRes.error
  if (alertRes.error) throw alertRes.error

  // Normalize material join: Supabase returns an array for the joined 'materials' row
  const subBatches = (batchRes.data ?? []).map((b: any) => ({
    ...b,
    material: Array.isArray(b.material) ? b.material[0] ?? null : b.material ?? null,
  })) as SubBatch[]

  const activeAlertCount = (alertRes.data ?? []).length

  return {
    subBatches,
    alerts: alertRes.data as DbAlert[],
    qcPassRateSevenDay: qcRate,
    firstPassYield,
    topDefect,
    activeAlertCount,
  }
}

export function useDashboard() {
  const { user, loading: authLoading } = useAuth()
  const role = user?.role
  // Hold the query until auth has resolved — fetching with an undefined role
  // both wastes a request and piles onto the cold-load auth-lock contention.
  const { data, isLoading, error } = useSWR(
    authLoading ? null : ['dashboard', role],
    () => fetchDashboard(role)
  )
  return {
    subBatches: data?.subBatches ?? [],
    alerts: data?.alerts ?? [],
    qcPassRateSevenDay: data?.qcPassRateSevenDay ?? 0,
    firstPassYield: data?.firstPassYield ?? null,
    topDefect: data?.topDefect ?? null,
    activeAlertCount: data?.activeAlertCount ?? 0,
    loading: authLoading || isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
