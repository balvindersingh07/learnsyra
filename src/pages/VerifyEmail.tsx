import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postLoginPath } from '../lib/roleAccess'
import BrandMark from '../components/BrandMark'

const RESEND_COOLDOWN_SEC = 60

export default function VerifyEmail() {
  const { session, profile, loading, isEmailVerified, resendVerificationEmail, configured } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setInterval(() => {
      setCooldown(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldown])

  if (loading || (session && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading…</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (isEmailVerified && profile) {
    return <Navigate to={postLoginPath(from, profile.role)} replace />
  }

  const email = session.user.email ?? 'your email'

  const resend = async () => {
    if (cooldown > 0 || busy) return
    setError(null)
    setNotice(null)
    setBusy(true)
    const { error: err } = await resendVerificationEmail()
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setNotice('If your account needs verification, we sent a new email.')
    setCooldown(RESEND_COOLDOWN_SEC)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="glass rounded-3xl p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <BrandMark size={44} withWordmark wordmarkClass="text-lg" />
        </div>

        <h1 className="text-2xl font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Verify your email
        </h1>
        <p className="text-muted text-sm mb-4">
          We sent a confirmation link to:
        </p>
        <p className="text-ink font-semibold text-sm mb-6 break-all">{email}</p>
        <p className="text-muted text-sm mb-6">
          Open the link in your inbox to activate your account. After confirming, return here or sign in again.
        </p>

        {!configured && (
          <div className="badge badge-amber mb-4 w-full justify-center py-2">
            Supabase not configured — see SETUP.md
          </div>
        )}

        {error && <div className="text-sm text-rose-400 mb-3">{error}</div>}
        {notice && <div className="text-sm text-success mb-3">{notice}</div>}

        <button
          type="button"
          disabled={busy || cooldown > 0}
          onClick={resend}
          className="btn-primary w-full py-3 mb-3"
        >
          {busy ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </button>

        <p className="text-muted text-sm text-center">
          Wrong address?{' '}
          <Link to="/signup" className="gradient-text font-semibold">
            Create a different account
          </Link>
          {' · '}
          <Link to="/login" className="gradient-text font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
