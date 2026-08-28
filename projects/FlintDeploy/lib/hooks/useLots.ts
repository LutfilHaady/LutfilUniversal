'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import type { Lot } from '@/lib/types'

async function fetchLots() {
  const { data, error } = await supabase
    .from('lots')
    .select('*, lot_sub_batches(sub_batch_id)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Lot[]
}

export function useLots() {
  const { data, isLoading, error } = useSWR('lots', fetchLots)
  return {
    lots: data ?? [],
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
