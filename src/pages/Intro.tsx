import { useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth, consumeAuthReturnPath } from '../context/AuthContext'
import { postLoginPath } from '../lib/roleAccess'
import { normalizeEmail } from '../lib/authValidation'
import {
  authSignupPath,
  parseAuthRole,
  roleEmoji,
  roleLabel,
  type SignupAuthRole,
} from '../lib/authFlow'
import AuthStoryPanel from '../components/AuthStoryPanel'
import PasswordField from '../components/PasswordField'

export default function Intro() {
  const {
    session,
    profile,
    loading: authLoading,
    isEmailVerified,
    signIn,
    signInWithGoogle,
    resetPassword,
    configured,
  } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const role = parseAuthRole(searchParams.toString())

  const storedReturn = useState(() => consumeAuthReturnPath())[0]
  const from =
    storedReturn ??
    (location.state as { from?: string } | null)?.from ??
    '/dashboard'
  const loginNotice = (location.state as { notice?: string } | null)?.notice

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(loginNotice ?? null)
  const [loading, setLoading] = useState(false)

  if (!role) {
    return <Navigate to="/" replace />
  }

  if (session && (authLoading || !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading…</div>
      </div>
    )
  }

  if (session && profile) {
    if (import.meta.env.PROD && !isEmailVerified) {
      return <Navigate to="/verify-email" state={{ from }} replace />
    }
    return <Navigate to={postLoginPath(from, profile.role)} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    const { error: signInError } = await signIn(normalizeEmail(email), password)
    setLoading(false)
    if (signInError) {
      setError(signInError)
    }
  }

  const google = async () => {
    setError(null)
    const { error: googleError } = await signInWithGoogle(from, role)
    if (googleError) setError(googleError)
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

  const lockedRole = role as SignupAuthRole

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ fontFamily: 'Inter, sans-serif' }}>
      <AuthStoryPanel />

      <section className="bg-white flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-5">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: 'rgba(108,92,231,0.08)',
              border: '1px solid rgba(108,92,231,0.2)',
            }}
          >
            <span className="text-base">{roleEmoji(lockedRole)}</span>
            <span className="text-xs font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {roleLabel(lockedRole)} profile
            </span>
            <Link
              to="/"
              className="text-xs font-semibold ml-1"
              style={{ color: '#6C5CE7', textDecoration: 'none' }}
            >
              Change
            </Link>
          </div>
          </div>

          <h1
            className="text-3xl font-black text-ink text-center mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
          >
            Sign in to LearnSyra ✨
          </h1>
          <p className="text-muted text-center text-sm mb-8">
            {lockedRole === 'tutor'
              ? 'Access your tutor workspace, sessions, and earnings.'
              : 'Build real skills with AI + expert tutors — and get career-ready.'}
          </p>

          {!configured && (
            <div className="badge badge-amber mb-4 w-full justify-center py-2">
              Supabase not configured — see SETUP.md
            </div>
          )}

          <button
            type="button"
            onClick={google}
            className="w-full rounded-xl py-3.5 font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
            style={{
              background: '#4F8CFF',
              border: 'none',
              fontFamily: 'Plus Jakarta Sans,sans-serif',
              boxShadow: '0 10px 24px rgba(79,140,255,0.28)',
            }}
          >
            <span className="w-6 h-6 rounded-full bg-white text-[#4F8CFF] text-sm font-black flex items-center justify-center">
              G
            </span>
            Continue with Gmail
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.12)' }} />
            <span className="text-xs text-muted">or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.12)' }} />
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Your Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-xl px-4 py-3.5 text-ink text-sm outline-none field"
            />
            <PasswordField
              required
              placeholder="Your Password"
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
                Forgot Password?
              </button>
            </div>

            {error && <div className="text-sm text-rose-500">{error}</div>}
            {notice && <div className="text-sm text-success">{notice}</div>}

            <button type="submit" disabled={loading} className="btn-primary py-3.5 text-base mt-1">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-muted text-sm mb-3">Don't have an account?</p>
            <Link
              to={authSignupPath(lockedRole)}
              className="inline-flex items-center justify-center w-full rounded-xl py-3 font-semibold"
              style={{
                border: '1.5px solid #6C5CE7',
                color: '#6C5CE7',
                fontFamily: 'Plus Jakarta Sans,sans-serif',
                textDecoration: 'none',
              }}
            >
              Sign Up
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
