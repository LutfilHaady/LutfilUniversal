'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import type { SubBatch } from '@/lib/types'

export interface SubBatchDetail extends SubBatch {
  material: { name: string; code: string } | null
  parent_batch: { id: string; batch_number: string } | null
}

async function fetchBatch(id: string): Promise<SubBatchDetail> {
  const { data, error } = await supabase
    .from('batches')
    .select(`
      *,
      material:materials(name, code, type),
      parent_batch:batches!parent_batch_id(id, batch_number)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as SubBatchDetail
}

export function useBatch(id: string) {
  const { data, isLoading, error } = useSWR(
    id ? ['batch', id] : null,
    ([, batchId]) => fetchBatch(batchId)
  )
  return {
    batch: data ?? null,
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
