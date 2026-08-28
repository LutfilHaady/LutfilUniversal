'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import type { ProcessRunTimeline } from '@/lib/types'

/**
 * Deduplicates timeline entries by roll_id + process_id + type.
 * Prevents showing the same process run twice (once as input, once as process).
 */
function deduplicateTimeline(entries: ProcessRunTimeline[]): ProcessRunTimeline[] {
  const seen = new Set<string>()

  return entries.filter(entry => {
    const key = `${entry.type}-${entry.id}`

    if (seen.has(key)) return false  // Skip duplicate
    seen.add(key)
    return true
  })
}

/**
 * Fetches process runs for a sub-batch and transforms to timeline format.
 */
async function fetchProcessRuns(
  subBatchId: string
): Promise<ProcessRunTimeline[]> {
  const selectFields = `
      id,
      output_batch_id,
      process_id,
      status,
      start_date,
      start_time,
      end_date,
      end_time,
      process:processes(name, code),
      operator:users(full_name),
      equipment:equipment(name, equipment_code),
      process_run_parameters(parameter_key, parameter_value)
  `

  // Fetch runs where this sub-batch was produced (output)
  const outPromise = supabase
    .from('process_runs')
    .select(`${selectFields}, process_run_inputs(quantity_consumed, input_batch_id)`)
    .eq('output_batch_id', subBatchId)

  // Fetch runs where this sub-batch was consumed (input)
  const inPromise = supabase
    .from('process_runs')
    .select(`${selectFields}, process_run_inputs!inner(quantity_consumed, input_batch_id)`)
    .eq('process_run_inputs.input_batch_id', subBatchId)

  const [outRes, inRes] = await Promise.all([outPromise, inPromise])

  if (outRes.error) throw outRes.error
  if (inRes.error) throw inRes.error

  // Combine and deduplicate just in case
  const combined = [...(outRes.data ?? []), ...(inRes.data ?? [])]
  const unique = Array.from(new Map(combined.map(r => [r.id, r])).values())

  return unique.map((run: any) => {
    const localNow = (() => {
      const d = new Date(); const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    })()
    const started_at = run.start_date ? `${run.start_date}T${run.start_time ?? '00:00:00'}` : localNow
    const completed_at = run.end_date ? `${run.end_date}T${run.end_time ?? '00:00:00'}` : null
    
    return {
      id: run.id,
      sub_batch_id: subBatchId,
      process_id: run.process_id,
      roll_id: null,
      type: 'process' as const,
      step_name: run.process?.name ?? 'Unknown Process',
      operator_id: run.operator?.id,
      operator_name: run.operator?.full_name ?? 'Unknown',
      status: run.status,
      started_at,
      completed_at,
      duration_minutes: completed_at
        ? Math.round(
            (new Date(completed_at).getTime() - new Date(started_at).getTime()) / 60000
          )
        : null,
      params: extractParams(run),
    }
  })
}

function extractParams(run: any): Array<{ key: string; value: string }> {
  const extractedParams: Array<{ key: string; value: string }> = []
  
  // 1. Add quantity consumed
  const inputs = run.process_run_inputs || []
  const consumed = inputs.reduce((sum: number, input: any) => sum + (input.quantity_consumed || 0), 0)
  if (consumed > 0) {
    extractedParams.push({ key: 'Qty Consumed', value: `${consumed}` })
  }

  // 2. Add process parameters
  const params = run.process_run_parameters || []
  for (const p of params) {
    extractedParams.push({ key: p.parameter_key, value: `${p.parameter_value}` })
  }

  return extractedParams
}

/**
 * Fetches QC check results for a sub-batch and transforms to timeline format.
 * Computes passed/failed by comparing result values against acceptance criteria.
 */
async function fetchQCResults(
  processRuns: ProcessRunTimeline[]
): Promise<ProcessRunTimeline[]> {
  if (processRuns.length === 0) return []
  const runIds = processRuns.map(r => r.id)

  const { data, error } = await supabase
    .from('qc_check_results')
    .select(`
      id,
      process_run_id,
      result_value_numeric,
      result_value_boolean,
      result_text,
      notes,
      created_at,
      performed_by:users(full_name),
      qc_check_definitions(acceptance_criteria_text, qc_item_name)
    `)
    .in('process_run_id', runIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((qc: any) => {
    // Compute passed by comparing numeric result against acceptance criteria
    // Criteria format: "value must be between X and Y" or similar
    const passed = computeQCPassed(
      qc.result_value_numeric,
      qc.result_value_boolean,
      qc.result_text,
      qc.qc_check_definitions?.acceptance_criteria_text
    )

    const parentRun = processRuns.find(r => r.id === qc.process_run_id)

    return {
      id: qc.id,
      sub_batch_id: parentRun?.sub_batch_id ?? '',
      roll_id: null,  // QC checks don't have roll_id
      type: 'qc' as const,
      step_name: qc.qc_check_definitions?.qc_item_name ?? 'QC Check',
      operator_id: undefined,
      operator_name: qc.performed_by?.full_name ?? 'Unknown',
      status: passed ? 'Passed' : 'Failed',
      started_at: qc.created_at,
      completed_at: qc.created_at,
      duration_minutes: 0,
      params: [],
      qc_result: {
        passed,
        notes: qc.notes,
      },
    }
  })
}

/**
 * Computes QC pass/fail by comparing numeric result against acceptance criteria.
 * Criteria format examples:
 *   "20-25" → checks if result is between 20 and 25
 *   "≥18" → checks if result is >= 18
 *   etc.
 */
function computeQCPassed(
  numericValue: number | null,
  booleanValue: boolean | null,
  textValue: string | null,
  criteria: string | null
): boolean {
  // If boolean field is set, use it directly
  if (booleanValue !== null) {
    return booleanValue
  }

  // If numeric field is set, parse criteria and compare
  if (numericValue !== null && criteria) {
    // Simple parsing for common formats: "X-Y", "≥X", "≤X", "X"
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
 * Hook to fetch process timeline (process runs + QC checks) for a sub-batch.
 * Merges both tables, deduplicates, and sorts chronologically.
 */
export function useProcessTimeline(subBatchId: string | null) {
  async function fetchTimeline(): Promise<ProcessRunTimeline[]> {
    if (!subBatchId) return []

    const processRuns = await fetchProcessRuns(subBatchId)
    const qcResults = await fetchQCResults(processRuns)

    // Merge and dedup
    const merged = [...processRuns, ...qcResults]
    const deduped = deduplicateTimeline(merged)

    // Sort by started_at descending (newest first)
    return deduped.sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )
  }

  const { data, isLoading, error } = useSWR(
    subBatchId ? ['process-timeline', subBatchId] : null,
    () => fetchTimeline()
  )

  return {
    timeline: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
