'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import supabase from '@/lib/supabase'

export type UserRole = 'Operator' | 'Engineer' | 'Admin'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
})

function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0]
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
}

async function resolveUser(session: Session): Promise<AuthUser> {
  const { data } = await supabase
    .from('users')
    .select('full_name, role_id, roles(name)')
    .eq('id', session.user.id)
    .single()

  const roleName = (data?.roles as { name?: string } | null)?.name ?? 'Operator'
  const role = (['Operator', 'Engineer', 'Admin'].includes(roleName)
    ? roleName
    : 'Operator') as UserRole

  // Prefer public.users.full_name → user_metadata fallback → email derivation
  const name =
    (data?.full_name as string | undefined)?.trim() ||
    (session.user.user_metadata?.full_name as string | undefined) ||
    deriveNameFromEmail(session.user.email ?? '')

  return { id: session.user.id, email: session.user.email ?? '', name, role }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Resolve the profile for a session. MUST run outside the auth-js
    // LockManager context: calling an awaited supabase.from() query directly
    // inside onAuthStateChange (or synchronously within the lock) deadlocks
    // auth-js on a cold page load — the callback awaits a query that is queued
    // behind the very lock the callback holds, so the session never resolves
    // and every concurrent SWR query hangs, leaving the UI stuck on loading.
    async function applySession(session: Session | null) {
      if (!active) return
      if (session) {
        const resolved = await resolveUser(session)
        if (active) setUser(resolved)
      } else if (active) {
        setUser(null)
      }
    }

    // Initial load: getSession acquires and releases the lock before the .then
    // runs, so resolveUser here is a fresh, sequential lock acquisition — safe.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        await applySession(session)
      } finally {
        if (active) setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is already handled by getSession above — skip it to
      // avoid a duplicate profile fetch (and the cold-load deadlock) on mount.
      if (event === 'INITIAL_SESSION') return
      // Defer out of the lock-holding callback before touching supabase again.
      setTimeout(() => { void applySession(session) }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
