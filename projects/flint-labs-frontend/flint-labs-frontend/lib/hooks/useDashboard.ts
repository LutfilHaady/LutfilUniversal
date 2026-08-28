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
 * Compute QC pass/fail by comparing numeric result against acceptance criteria.
 * Criteria format examples:
 *   "20-25" → checks if result is between 20 and 25
 *   "≥18" → checks if result is >= 18
 *   etc.
 */
function computeQCPassed(
  numericValue: number | null,
  booleanValue: boolean | null,
  criteria: string | null
): boolean {
  // If boolean field is set, use it directly
  if (booleanValue !== null) {
    return booleanValue
  }

  // If numeric field is set, parse criteria and compare
  if (numericValue !== null && criteria) {
    const trimmed = criteria.trim()

    // Range format: "X-Y"
    if (trimmed.includes('-') && !trimmed.startsWith('-')) {
      const parts = trimmed.split('-')
      if (parts.length === 2) {
        const min = parseFloat(parts[0])
        const max = parseFloat(parts[1])
        if (!isNaN(min) && !isNaN(max)) {
          return numericValue >= min && numericValue <= max
        }
      }
    }

    // Greater than or equal: "≥X" or ">=X"
    if (trimmed.includes('≥') || trimmed.includes('>=')) {
      const value = parseFloat(trimmed.replace('≥', '').replace('>=', ''))
      if (!isNaN(value)) {
        return numericValue >= value
      }
    }

    // Less than or equal: "≤X" or "<=X"
    if (trimmed.includes('≤') || trimmed.includes('<=')) {
      const value = parseFloat(trimmed.replace('≤', '').replace('<=', ''))
      if (!isNaN(value)) {
        return numericValue <= value
      }
    }

    // Exact value: "X"
    const exact = parseFloat(trimmed)
    if (!isNaN(exact)) {
      return numericValue === exact
    }
  }

  // Default: if we can't parse criteria, assume failed
  return false
}

/**
 * Calculate 7-day rolling QC pass rate (0-100 percentage).
 */
async function fetchQCPassRate(): Promise<number> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data, error } = await supabase
    .from('qc_check_results')
    .select(`
      id,
      result_value_numeric,
      result_value_boolean,
      qc_check_definitions(acceptance_criteria_text)
    `)
    .gte('created_at', sevenDaysAgo.toISOString())

  if (error) throw error
  if (!data || data.length === 0) return 0

  const passed = data.filter((qc: any) => {
    return computeQCPassed(
      qc.result_value_numeric,
      qc.result_value_boolean,
      qc.qc_check_definitions?.acceptance_criteria_text
    )
  }).length

  return Math.round((passed / data.length) * 100)
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
    .select('id, batch_number, parent_batch_id, material_id, status, current_quantity, original_quantity, unit, current_location, created_at, updated_at, material:materials(name, code)')
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
