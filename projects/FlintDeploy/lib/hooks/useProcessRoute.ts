'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'

export interface ProcessStep {
  process_id: string
  code: string
  name: string
  sequence_hint: number
  requires_calibration: boolean
}

async function fetchProcessRoute(materialId: string): Promise<ProcessStep[]> {
  const { data, error } = await supabase.rpc('get_process_route', {
    p_material_id: materialId,
  })
  if (error) throw error
  return (data ?? []) as ProcessStep[]
}

export function useProcessRoute(materialId: string | null) {
  const { data, isLoading, error } = useSWR(
    materialId ? ['process-route', materialId] : null,
    ([, id]) => fetchProcessRoute(id)
  )
  return {
    steps: data ?? [],
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
