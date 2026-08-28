'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import type { Machine, MaintenanceEntry } from '@/components/machines/types'

async function fetchMachines() {
  const { data, error } = await supabase
    .from('equipment')
    .select('*, process:processes(name, code), equipment_maintenance(*)')
    .order('equipment_code')
  if (error) throw error
  return (data ?? []).map((m: Machine) => ({
    ...m,
    equipment_maintenance: [...m.equipment_maintenance].sort(
      (a: MaintenanceEntry, b: MaintenanceEntry) =>
        new Date(b.maintenance_date).getTime() - new Date(a.maintenance_date).getTime()
    ),
  })) as Machine[]
}

export function useMachines() {
  const { data, isLoading, error } = useSWR('machines', fetchMachines)
  return {
    machines: data ?? [],
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
