'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import type { Lot } from '@/lib/types'

async function fetchLot(id: string): Promise<Lot> {
  const { data, error } = await supabase
    .from('lots')
    .select('*, lot_sub_batches(sub_batch_id), units(serial, lot_id, sub_batch_id, created_at)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Lot
}

export function useLot(id: string) {
  const { data, isLoading, error } = useSWR(
    id ? ['lot', id] : null,
    ([, lotId]) => fetchLot(lotId)
  )
  return {
    lot: data ?? null,
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
