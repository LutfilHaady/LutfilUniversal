'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'

export interface Material {
  id: string
  code: string
  name: string
  suffix: string | null
  type: string | null
  min_storage_threshold: number | null
  shelf_life_days: number | null
  first_process_id: string | null
  total_stock: number
}

async function fetchMaterials(): Promise<Material[]> {
  const [{ data: mats, error: matsErr }, stockResult] = await Promise.all([
    supabase.from('materials').select('*').order('code'),
    supabase.from('material_stock_totals').select('material_id, total_stock'),
  ])
  if (matsErr) throw matsErr
  // stock view may not exist pre-migration — ignore errors and default stock to 0
  const stocks = stockResult.error ? [] : (stockResult.data ?? [])
  const stockMap = new Map(
    stocks.map(s => [(s as { material_id: string }).material_id, (s as { total_stock: number }).total_stock])
  )
  return (mats ?? []).map(m => ({
    ...(m as Omit<Material, 'total_stock'>),
    total_stock: stockMap.get((m as { id: string }).id) ?? 0,
  }))
}

export function useMaterials() {
  const { data, isLoading, error, mutate } = useSWR('materials', fetchMaterials)
  return {
    materials: data ?? [] as Material[],
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
    mutate,
  }
}
