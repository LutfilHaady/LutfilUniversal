'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { MainBatch } from '@/lib/types'

/**
 * Fetch batches with optional deep history expansion.
 * 
 * Parent batches are master records that may be old but still active.
 * The date window (7 or 30 days) applies to sub-batch activity, not to
 * the parent's own created_at — so a parent created 3 weeks ago still
 * appears if one of its sub-batches was updated recently.
 *
 * - Operator: Always limited to last 7 days of sub-batch activity
 * - Engineer/Admin with deepHistory=false: Last 7 days
 * - Engineer/Admin with deepHistory=true: Last 30 days
 */
async function fetchBatches(role: string | undefined, deepHistory = false) {
  const { data, error } = await supabase
    .from('batches')
    .select(`
      *,
      material:materials(name, code, type),
      intake:batch_raw_material_intake(supplier_name, date_received),
      sub_batches:batches!parent_batch_id(
        id, batch_number, parent_batch_id, material_id, status,
        current_quantity, original_quantity, unit, current_location,
        created_at, updated_at
      )
    `)
    .is('parent_batch_id', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  const cutoffDate = new Date()
  if (role === 'Operator') {
    cutoffDate.setDate(cutoffDate.getDate() - 7)
  } else if (deepHistory) {
    cutoffDate.setDate(cutoffDate.getDate() - 30)
  } else {
    cutoffDate.setDate(cutoffDate.getDate() - 7)
  }
  const cutoffISO = cutoffDate.toISOString()

  // Filter sub-batches by date window, then keep parent batches that
  // either have recent sub-batches or were themselves recently created
  return ((data ?? []) as MainBatch[])
    .map(batch => ({
      ...batch,
      sub_batches: batch.sub_batches.filter(
        sb => sb.created_at >= cutoffISO || sb.updated_at >= cutoffISO
      ),
    }))
    .filter(batch =>
      batch.sub_batches.length > 0 || batch.created_at >= cutoffISO
    )
}

export function useBatches(deepHistory = false) {
  const { user, loading: authLoading } = useAuth()
  const role = user?.role
  // Hold the query until auth has resolved — fetching with an undefined role
  // both wastes a request and piles onto the cold-load auth-lock contention.
  const { data, isLoading, error } = useSWR(
    authLoading ? null : ['batches', role, deepHistory],
    () => fetchBatches(role, deepHistory)
  )
  return {
    batches: data ?? [],
    loading: authLoading || isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
