import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postLoginPath } from '../lib/roleAccess'
import { validatePasswordMatch } from '../lib/authValidation'
import BrandMark from '../components/BrandMark'
import PasswordField from '../components/PasswordField'

export default function ResetPassword() {
  const { session, profile, loading, recoveryMode, updatePassword, configured } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [hashRecovery, setHashRecovery] = useState(false)

  useEffect(() => {
    setHashRecovery(window.location.hash.includes('type=recovery'))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading…</div>
      </div>
    )
  }

  const hasRecoverySession = Boolean(session && (recoveryMode || hashRecovery))

  if (!hasRecoverySession && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 pt-16">
        <div className="glass rounded-3xl p-8 w-full max-w-md text-center">
          <BrandMark size={44} withWordmark wordmarkClass="text-lg" />
          <h1 className="text-2xl font-black text-ink mt-6 mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            Reset link expired
          </h1>
          <p className="text-muted text-sm mb-6">
            Request a new password reset email from the sign-in page.
          </p>
          <Link to="/login" className="btn-primary inline-flex px-6 py-3">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  if (done && profile) {
    return <Navigate to={postLoginPath(undefined, profile.role)} replace />
  }

  if (done) {
    return <Navigate to="/login" replace state={{ notice: 'Password updated. Sign in with your new password.' }} />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const validation = validatePasswordMatch(password, confirm)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    const { error: err } = await updatePassword(password)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setNotice('Password updated successfully.')
    setDone(true)
    window.setTimeout(() => {
      if (profile) navigate(postLoginPath(undefined, profile.role), { replace: true })
      else navigate('/login', { replace: true, state: { notice: 'Password updated. Sign in with your new password.' } })
    }, 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="glass rounded-3xl p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <BrandMark size={44} withWordmark wordmarkClass="text-lg" />
        </div>

        <h1 className="text-2xl font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Set a new password
        </h1>
        <p className="text-muted text-sm mb-6">Choose a strong password for your LearnSyra account.</p>

        {!configured && (
          <div className="badge badge-amber mb-4 w-full justify-center py-2">
            Supabase not configured — see SETUP.md
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <PasswordField
            required
            minLength={8}
            placeholder="New password (min 8 chars)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="glass rounded-xl px-4 py-3 text-ink text-sm outline-none"
            style={{ border: '1px solid rgba(99,102,241,0.12)' }}
          />
          <PasswordField
            required
            minLength={8}
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="glass rounded-xl px-4 py-3 text-ink text-sm outline-none"
            style={{ border: '1px solid rgba(99,102,241,0.12)' }}
          />

          {error && <div className="text-sm text-rose-400">{error}</div>}
          {notice && <div className="text-sm text-success">{notice}</div>}

          <button type="submit" disabled={busy} className="btn-primary mt-2 py-3">
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>

        <p className="text-muted text-sm mt-5 text-center">
          <Link to="/login" className="gradient-text font-semibold">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
