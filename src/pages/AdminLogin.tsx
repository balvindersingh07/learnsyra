import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import BrandMark from '../components/BrandMark'
import PasswordField from '../components/PasswordField'
import { useAuth } from '../context/AuthContext'
import { normalizeEmail } from '../lib/authValidation'
import { ADMIN_HOME } from '../lib/roleAccess'

const ADMIN_ACCESS_ERROR =
  'Admin access required. This account does not have administrator privileges.'

export default function AdminLogin() {
  const {
    session,
    profile,
    loading: authLoading,
    isEmailVerified,
    signIn,
    signOut,
    resetPassword,
    configured,
  } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? ADMIN_HOME
  const loginNotice = (location.state as { notice?: string } | null)?.notice
  const accessDenied = loginNotice === 'Admin access required.'
  const rejectingRef = useRef(false)
  const [rejecting, setRejecting] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(accessDenied ? ADMIN_ACCESS_ERROR : null)
  const [notice, setNotice] = useState<string | null>(accessDenied ? null : loginNotice ?? null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authLoading || rejectingRef.current || !session || !profile) return
    if (profile.role === 'admin') return

    rejectingRef.current = true
    setRejecting(true)
    signOut().finally(() => {
      rejectingRef.current = false
      setRejecting(false)
      setError(ADMIN_ACCESS_ERROR)
    })
  }, [authLoading, session, profile, signOut])

  if (session && (authLoading || !profile || rejecting)) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading…</div>
      </div>
    )
  }

  if (session && profile?.role === 'admin') {
    if (import.meta.env.PROD && !isEmailVerified) {
      return <Navigate to="/verify-email" state={{ from }} replace />
    }
    const dest = from.startsWith('/admin') ? from : ADMIN_HOME
    return <Navigate to={dest} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(normalizeEmail(email), password)
    setSubmitting(false)
    if (signInError) setError(signInError)
  }

  const forgot = async () => {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Enter your email first, then tap Forgot password.')
      return
    }
    const { error: resetError } = await resetPassword(normalizeEmail(email))
    if (resetError) setError(resetError)
    else setNotice('Password reset email sent if that account exists.')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <div className="w-full max-w-md">
        <div className="glass rounded-3xl p-8 sm:p-10" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="flex flex-col items-center text-center mb-8">
            <BrandMark size={48} withWordmark wordmarkClass="text-xl" />
            <div
              className="mt-4 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(108,92,231,0.1)',
                color: '#6C5CE7',
                fontFamily: 'Plus Jakarta Sans,sans-serif',
              }}
            >
              Admin workspace
            </div>
            <h1
              className="mt-4 text-2xl font-black text-ink"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
            >
              Sign in to Admin
            </h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Authorized LearnSyra administrators only. Use your admin email and password.
            </p>
          </div>

          {!configured && (
            <div className="badge badge-amber mb-4 w-full justify-center py-2">
              Supabase not configured — see SETUP.md
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Admin email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-xl px-4 py-3.5 text-ink text-sm outline-none field"
            />
            <PasswordField
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-xl px-4 py-3.5 text-ink text-sm outline-none field"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={forgot}
                className="text-xs font-semibold cursor-pointer"
                style={{ background: 'none', border: 'none', color: '#6C5CE7' }}
              >
                Forgot password?
              </button>
            </div>

            {error && <div className="text-sm text-rose-500">{error}</div>}
            {notice && <div className="text-sm text-success">{notice}</div>}

            <button type="submit" disabled={submitting} className="btn-primary py-3.5 text-base mt-1">
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted leading-relaxed">
            Student and tutor accounts cannot access this workspace. Contact your platform owner if you
            need admin access.
          </p>
        </div>
      </div>
    </div>
  )
}
