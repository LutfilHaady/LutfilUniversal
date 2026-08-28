'use client'

import { useState, useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'
import supabase from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

// --- Inline icons (login-page only, not added to /components/icons.tsx) ---
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

function IconAlertTriangle({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" className={className ?? 'w-4 h-4'}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

// --- Sub-components ---

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

function AuthErrorBanner({ type }: { type: 'credentials' | 'network' }) {
  const msg =
    type === 'network'
      ? { title: 'Could not connect.', body: 'Check your internet connection and try again.' }
      : { title: 'Invalid email or password.', body: 'Please try again.' }
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2.5"
    >
      <IconAlertTriangle className="w-4 h-4 mt-[1px] shrink-0 text-rose-400" />
      <div className="text-[13px] leading-snug">
        <span className="font-medium text-rose-200">{msg.title}</span>{' '}
        <span className="text-rose-300/85">{msg.body}</span>
      </div>
    </div>
  )
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} role="alert" className="mt-1 text-[12px] text-rose-400">
      {message}
    </p>
  )
}

// Input class helpers — auth errors never add red borders
const inputBase =
  'w-full rounded-md px-3 py-2.5 text-[14px] text-[#f5f5f5] placeholder-[#4b5563] bg-[#0f1623] outline-none transition-[border-color] duration-100'
const inputNormal =
  'border border-[#1f2937] hover:border-[#2a3445] focus:border-[#22c55e]'
const inputInvalid =
  'border border-rose-500 focus:border-rose-500'

// --- Page ---

const INSTANCE_ID = process.env.NEXT_PUBLIC_INSTANCE_ID ?? 'SG-PROD-01'

export default function LoginPage() {
  const router = useRouter()
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Client-side validation errors — shown as red field borders + helper text
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Auth failure — banner only, no field borders
  const [authError, setAuthError] = useState<'credentials' | 'network' | null>(null)

  const emailErrId = useId()
  const passwordErrId = useId()

  // Already authenticated → skip login
  useEffect(() => {
    if (user) {
      // Force a hard navigation so the server proxy can detect mobile devices
      // and securely route to /batches or /dashboard based on User-Agent.
      window.location.href = '/'
    }
  }, [user])

  function validate(): boolean {
    let valid = true

    if (!email.trim()) {
      setEmailError('Email is required')
      valid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address')
      valid = false
    } else {
      setEmailError(null)
    }

    if (!password) {
      setPasswordError('Password is required')
      valid = false
    } else {
      setPasswordError(null)
    }

    return valid
  }

  async function handleForgotSubmit() {
    if (!forgotEmail.trim()) return
    setForgotSubmitting(true)
    setForgotError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setForgotSubmitting(false)
    if (error) { setForgotError('Could not send reset email. Check the address and try again.'); return }
    setForgotSent(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAuthError(null)
    if (!validate()) return

    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)

    if (error) {
      const isNetwork = error.message === 'Failed to fetch' || error.status === 0
      setAuthError(isNetwork ? 'network' : 'credentials')
      return
    }

    // Redirect is handled by the useEffect watching user — avoids navigating
    // before the session cookie is fully written by createBrowserClient.
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
          {/* Green hairline accent */}
          <div className="h-[3px] w-full rounded-t-xl bg-gradient-to-r from-[#22c55e]/0 via-[#22c55e] to-[#22c55e]/0 opacity-60" />

          <div className="px-8 pt-8 pb-7">
            <Logo />

            <div className="mt-8">
              <h1 className="text-[20px] font-semibold leading-tight">Sign in to your account</h1>
              <p className="mt-1 text-[13px] text-[#9ca3af]">
                Production traceability for battery component manufacturing.
              </p>
            </div>

            {authError && (
              <div className="mt-5">
                <AuthErrorBanner type={authError} />
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email">
                  <span className="block text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#9ca3af] mb-1.5">
                    Email
                  </span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(null)
                    if (authError) setAuthError(null)
                  }}
                  placeholder="name@flintlabs.sg"
                  aria-describedby={emailError ? emailErrId : undefined}
                  aria-invalid={!!emailError}
                  className={`${inputBase} ${emailError ? inputInvalid : inputNormal}`}
                />
                {emailError && <FieldError id={emailErrId} message={emailError} />}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password">
                  <span className="block text-[11.5px] font-medium tracking-[0.08em] uppercase text-[#9ca3af] mb-1.5">
                    Password
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (passwordError) setPasswordError(null)
                      if (authError) setAuthError(null)
                    }}
                    placeholder="Enter your password"
                    aria-describedby={passwordError ? passwordErrId : undefined}
                    aria-invalid={!!passwordError}
                    className={`${inputBase} pr-10 ${passwordError ? inputInvalid : inputNormal}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6b7280] hover:text-[#d1d5db] transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22c55e] focus-visible:outline-offset-1"
                  >
                    {showPw ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {passwordError && <FieldError id={passwordErrId} message={passwordError} />}
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="sr-only"
                  />
                  {/* Custom checkbox visual */}
                  <span
                    aria-hidden
                    className={`inline-grid place-content-center w-4 h-4 rounded-[3px] border transition-colors duration-100 ${
                      remember
                        ? 'bg-[#22c55e] border-[#22c55e]'
                        : 'bg-[#0f1623] border-[#374151] hover:border-[#4b5563]'
                    }`}
                  >
                    {remember && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="4"
                           strokeLinecap="round" strokeLinejoin="round" className="w-[9px] h-[9px]">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[13px] text-[#f5f5f5]/90">Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => { setShowForgot(v => !v); setForgotSent(false); setForgotError(null); }}
                  className="text-[13px] text-[#9ca3af] hover:text-[#f5f5f5] transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {showForgot && (
                <div className="rounded-lg border border-[#1f2937] bg-[#0f1623] px-4 py-4 flex flex-col gap-3">
                  {forgotSent ? (
                    <p className="text-[13px] text-[#22c55e] leading-snug">
                      Reset link sent — check your inbox and follow the link to set a new password.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-[12px] text-[#9ca3af] leading-snug">
                        Enter your account email and we'll send a reset link.
                      </p>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="name@flintlabs.sg"
                        autoComplete="email"
                        className={`${inputBase} ${inputNormal}`}
                      />
                      {forgotError && (
                        <p className="text-[12px] text-rose-400">{forgotError}</p>
                      )}
                      <button
                        type="button"
                        onClick={handleForgotSubmit}
                        disabled={forgotSubmitting || !forgotEmail.trim()}
                        className="w-full rounded-md py-2 text-[13px] font-semibold bg-[#1f2937] text-[#f5f5f5] hover:bg-[#2a3445] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {forgotSubmitting ? 'Sending…' : 'Send reset link'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md py-2.5 mt-2 text-[14px] font-semibold tracking-[0.01em] bg-[#22c55e] text-[#07120c] hover:bg-[#1cb353] active:translate-y-px transition-[background-color,transform] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22c55e] focus-visible:outline-offset-2"
              >
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 border-t border-[#1f2937]" />

            <p className="mt-4 text-[11.5px] leading-relaxed text-[#6b7280]">
              Access is managed by your administrator. Contact your admin if you need an account.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom meta — factory-floor feel */}
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
