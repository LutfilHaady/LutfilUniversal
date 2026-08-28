'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

/**
 * A process run the current operator has open (status = 'InProgress').
 *
 * Powers the active-run drawer on the process log page (§8) and the compact
 * active-run chip on the dashboard. Timers derive purely from the DB
 * start_date/start_time so they survive navigation — no client-only timer state.
 */
export interface ActiveRun {
  id: string
  processId: string
  processName: string
  processCode: string
  batchId: string | null
  batchNumber: string | null
  /** ISO timestamp the run started — the timer counts up from here. */
  startedAt: string
}

interface DbInputBatch { id: string; batch_number: string }

interface DbProcessRun {
  id: string
  process_id: string
  start_date: string | null
  start_time: string | null
  process: { name: string; code: string } | { name: string; code: string }[] | null
  process_run_inputs: { input_batch: DbInputBatch | DbInputBatch[] | null }[] | null
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function startedAtIso(date: string | null, time: string | null): string {
  if (!date) {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }
  return `${date}T${time ?? '00:00:00'}`
}

function mapRun(row: DbProcessRun): ActiveRun {
  const proc = one(row.process)
  const firstInput = (row.process_run_inputs ?? [])[0]
  const inputBatch = firstInput ? one(firstInput.input_batch) : null
  return {
    id: row.id,
    processId: row.process_id,
    processName: proc?.name ?? 'Process',
    processCode: proc?.code ?? '',
    batchId: inputBatch?.id ?? null,
    batchNumber: inputBatch?.batch_number ?? null,
    startedAt: startedAtIso(row.start_date, row.start_time),
  }
}

async function fetchActiveRuns(operatorId: string): Promise<ActiveRun[]> {
  const { data, error } = await supabase
    .from('process_runs')
    .select(`
      id,
      process_id,
      start_date,
      start_time,
      process:processes(name, code),
      process_run_inputs(input_batch:batches(id, batch_number))
    `)
    .eq('operator_id', operatorId)
    .eq('status', 'InProgress')
    .order('start_date', { ascending: false })
    .order('start_time', { ascending: false })

  if (error) throw error
  return (data as DbProcessRun[] | null ?? []).map(mapRun)
}

/**
 * Active (InProgress) process runs for the signed-in operator.
 *
 * Gated on auth resolving so we never fire with an undefined user id (which both
 * wastes a request and would return everyone's runs under a permissive policy).
 */
export function useActiveRuns() {
  const { user, loading: authLoading } = useAuth()
  const operatorId = user?.id ?? null

  const { data, isLoading, error, mutate } = useSWR(
    authLoading || !operatorId ? null : ['active-runs', operatorId],
    () => fetchActiveRuns(operatorId as string),
  )

  return {
    activeRuns: data ?? [],
    loading: authLoading || isLoading,
    error: (error as Error | null)?.message ?? null,
    refresh: mutate,
  }
}
