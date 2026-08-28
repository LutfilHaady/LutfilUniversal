'use client'

import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase'
import type { SubBatch } from '@/lib/types'

/**
 * Hook to look up a batch by globally-unique batch_number.
 * 
 * Returns { batch, loading, error } where:
 * - batch: The found SubBatch, or null if not found/loading/error
 * - loading: true while query is in-flight
 * - error: 'not_found' if no match, or error message string for other errors
 */
export function useBatchByNumber(batchNumber: string | null) {
  const [batch, setBatch] = useState<SubBatch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Early exit if input is empty
    if (!batchNumber?.trim()) {
      setBatch(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setBatch(null)

    const trimmed = batchNumber.trim()
    let isMounted = true  // Track if component is still mounted

    const fetchBatch = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('batches')
          .select('*')
          .eq('batch_number', trimmed)
          .single()  // Safe because batch_number is globally unique

        if (!isMounted) return  // Don't update if component unmounted

        if (queryError) {
          // PGRST116 = "No rows found" (not an actual error, just no match)
          if (queryError.code === 'PGRST116') {
            setError('not_found')
          } else {
            setError(queryError.message || 'Unknown error')
          }
          setBatch(null)
        } else {
          setBatch((data as SubBatch) || null)
          setError(null)
        }
      } catch (err) {
        if (!isMounted) return
        const errorMsg = err instanceof Error ? err.message : 'Network error'
        setError(errorMsg)
        setBatch(null)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchBatch()

    // Cleanup: mark as unmounted when effect reruns or component unmounts
    return () => {
      isMounted = false
    }
  }, [batchNumber])

  return { batch, loading, error }
}
