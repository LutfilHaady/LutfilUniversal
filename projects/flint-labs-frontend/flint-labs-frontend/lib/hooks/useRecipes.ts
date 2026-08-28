'use client'

import useSWR from 'swr'
import supabase from '@/lib/supabase'
import type { Recipe } from '@/lib/types'

const EMPTY: Recipe[] = []

async function fetchRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, process:processes(name, code), creator:users(full_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Recipe[]
}

export function useRecipes() {
  const { data, isLoading, error } = useSWR('recipes', fetchRecipes)
  return {
    recipes: data ?? EMPTY,
    loading: isLoading,
    error: (error as Error | null)?.message ?? null,
  }
}
