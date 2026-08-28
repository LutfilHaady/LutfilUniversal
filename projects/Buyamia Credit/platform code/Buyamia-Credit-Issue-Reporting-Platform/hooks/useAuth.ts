/**
 * Auth Hook
 * 
 * Client-side hook for authentication state management.
 * Fetches current user from /api/auth/me and provides auth utilities.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export interface AuthUser {
  id: string
  userId: string
  type: 'BUYER' | 'SUPPLIER'
  businessName: string
  phoneNumber: string
  address: string | null
  creditScore: number
  profileCompleted: boolean
  inviteStatus: string
  lastLoginAt: string | null
  // Buyer fields
  businessTypes: string
  ownerName: string | null
  averagePurchaseVolume: string | null
  orderFrequency: string | null
  preferredPaymentTerm: string | null
  yearsInOperation: number | null
  contactPersonName: string | null
  contactPersonPhone: string | null
  contactPersonEmail: string | null
  // Supplier fields
  categories: string
  regionsServed: string | null
  averageSupplyCapacity: string | null
  creditTermsOffered: string
}

interface UseAuthReturn {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  refetch: () => Promise<void>
  logout: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })

      if (response.status === 401) {
        setUser(null)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch user')
      }

      const data = await response.json()
      
      if (data.success && data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Auth fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to authenticate')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      setUser(null)
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('session')
        sessionStorage.clear()
      }
      // Redirect to login, not register
      window.location.href = '/login'
    }
  }, [router])

  // Fetch user on mount and when pathname changes
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Handle profile completion redirect
  useEffect(() => {
    if (!isLoading && user && !user.profileCompleted) {
      // If user hasn't completed profile and isn't on the complete page, redirect
      if (pathname !== '/register/complete' && !pathname.startsWith('/api/')) {
        router.push('/register/complete')
      }
    }
  }, [isLoading, user, pathname, router])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    refetch: fetchUser,
    logout,
  }
}

/**
 * Hook for requiring authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(): UseAuthReturn {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`
      router.push(loginUrl)
    }
  }, [auth.isLoading, auth.isAuthenticated, pathname, router])

  return auth
}



