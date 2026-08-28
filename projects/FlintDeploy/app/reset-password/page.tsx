'use client'

import { useState, useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabase'

type SvgProps = React.SVGProps<SVGSVGElement> & { className?: string }

function IconEye({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" className={className ?? 'w-4 h-4'}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" className={className ?? 'w-4 h-4'}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17.7 17.7 0 0 1-3.2 3.9" />
      <path d="M6.2 7.2A17.6 17.6 0 0 0 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

function IconCheck({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className ?? 'w-5 h-5'}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-9 h-9 rounded-[6px] bg-[#0f1623] border border-[#1f2937] flex items-center justify-center">
        <div
          className="w-4 h-4 bg-[#22c55e]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 30%, 30% 30%, 30% 100%, 0 100%)' }}
        />
      </div>
      <div className="leading-tight">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[20px] font-bold tracking-[0.14em] text-[#f5f5f5]">FLINT</span>
          <span className="text-[13px] font-semibold tracking-[0.06em] text-[#22c55e] uppercase">Traceability</span>
        </div>
        <div className="text-[10.5px] text-[#6b7280] tracking-wider uppercase mt-0.5">
          by Flint Labs · Singapore
        </div>
      </div>
    </div>
  )
}

const inputBase =
  'w-full rounded-md px-3 py-2.5 text-[14px] text-[#f5f5f5] placeholder-[#4b5563] bg-[#0f1623] outline-none transition-[border-color] duration-100'
const inputNormal = 'border border-[#1f2937] hover:border-[#2a3445] focus:border-[#22c55e]'
const inputInvalid = 'border border-rose-500 focus:border-rose-500'

const INSTANCE_ID = process.env.NEXT_PUBLIC_INSTANCE_ID ?? 'SG-PROD-01'

export default function ResetPasswordPage() {
  const router = useRouter()
  const pwId = useId()
  const confirmId = useId()

  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Supabase sends a PASSWORD_RECOVERY event when the magic link is opened.
  // The session is established automatically from the URL hash.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // Also check if the user already has a recovery session (page refresh case)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  function validate(): boolean {
    let valid = true
    if (password.length < 8) {
      setPwError('Password must be at least 8 characters')
      valid = false
    } else {
      setPwError(null)
    }
    if (password !== confirm) {
      setConfirmError('Passwords do not match')
      valid = false
    } else {
      setConfirmError(null)
    }
    return valid
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) { setError(updateError.message); return }
    setDone(true)
    setTimeout(() => router.replace('/login'), 3000)
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans text-[#f5f5f5] antialiased"
      style={{
        backgroundColor: '#111827',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        backgroundPosition: '-1px -1px',
      }}
    >
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px] rounded-xl bg-[#161e2e] border border-[#1f2937] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
          <div className="h-[3px] w-full rounded-t-xl bg-gradient-to-r from-[#22c55e]/0 via-[#22c55e] to-[#22c55e]/0 opacity-60" />

          <div className="px-8 pt-8 pb-7">
            <Logo />

            <div className="mt-8">
              <h1 className="text-[20px] font-semibold leading-tight">Set a new password</h1>
              <p className="mt-1 text-[13px] text-[#9ca3af]">
                Choose a password with at least 8 characters.
              </p>
            </div>

            {done ? (
              <div className="mt-6 flex flex-col items-center gap-3 py-4">
                <div className="w-12 h-12 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center">
                  <IconCheck className="w-6 h-6 text-[#22c55e]" />
                </div>
                <p className="text-[14px] text-[#f5f5f5] font-medium">Password updated</p>
                <p className="text-[12px] text-[#9ca3af]">Redirecting to sign in…</p>
              </div>
            ) : !ready ? (
              <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
                <p className="text-[13px] text-amber-300 leading-snug">
                  This link has expired or is invalid. Request a new reset link from the login page.
                </p>
                <button
                  onClick={() => router.replace('/login')}
                  className="mt-3 text-[12px] text-[#9ca3af] hover:text-[#f5f5f5] underline underline-offset-2 transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2.5">
                    <p className="text-[13px] text-rose-300">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor={pwId}>
                    <span className="block text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#9ca3af] mb-1.5">
                      New Password
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      id={pwId}
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (pwError) setPwError(null) }}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      aria-invalid={!!pwError}
                      className={`${inputBase} pr-10 ${pwError ? inputInvalid : inputNormal}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6b7280] hover:text-[#d1d5db] transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22c55e]"
                    >
                      {showPw ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                  {pwError && <p className="mt-1 text-[12px] text-rose-400">{pwError}</p>}
                </div>

                <div>
                  <label htmlFor={confirmId}>
                    <span className="block text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#9ca3af] mb-1.5">
                      Confirm Password
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      id={confirmId}
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value); if (confirmError) setConfirmError(null) }}
                      placeholder="Repeat your new password"
                      autoComplete="new-password"
                      aria-invalid={!!confirmError}
                      className={`${inputBase} pr-10 ${confirmError ? inputInvalid : inputNormal}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6b7280] hover:text-[#d1d5db] transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22c55e]"
                    >
                      {showConfirm ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                  {confirmError && <p className="mt-1 text-[12px] text-rose-400">{confirmError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md py-2.5 mt-2 text-[14px] font-semibold tracking-[0.01em] bg-[#22c55e] text-[#07120c] hover:bg-[#1cb353] active:translate-y-px transition-[background-color,transform] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22c55e] focus-visible:outline-offset-2"
                >
                  {submitting ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="pb-6 px-6">
        <div className="max-w-[440px] mx-auto flex items-center justify-between text-[10.5px] font-mono tracking-[0.14em] uppercase text-[#6b7280]">
          <span>FLINT-TRACE · v2.4.1</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            {INSTANCE_ID}
          </span>
        </div>
      </footer>
    </div>
  )
}
