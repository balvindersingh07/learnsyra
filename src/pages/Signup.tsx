import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validateSignupInput } from '../lib/authValidation'
import {
  authLoginPath,
  parseAuthRole,
  roleEmoji,
  roleLabel,
  type SignupAuthRole,
} from '../lib/authFlow'
import AuthStoryPanel from '../components/AuthStoryPanel'
import PasswordField from '../components/PasswordField'

export default function Signup() {
  const { signUp, configured } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const role = parseAuthRole(searchParams.toString())

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!role) {
    return <Navigate to="/" replace />
  }

  const lockedRole = role as SignupAuthRole

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const validation = validateSignupInput(email, password, fullName)
    if (validation) {
      setError(validation)
      return
    }
    setLoading(true)
    const { error: err, needsVerification } = await signUp(email, password, fullName, lockedRole)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    if (needsVerification || import.meta.env.PROD) {
      navigate('/verify-email')
      return
    }
    setNotice('Account created. You can sign in now.')
    setTimeout(() => navigate(authLoginPath(lockedRole)), 1500)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ fontFamily: 'Inter, sans-serif' }}>
      <AuthStoryPanel />

      <section className="bg-white flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-5"
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

          <h1
            className="text-3xl font-black text-ink mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
          >
            Create your account
          </h1>
          <p className="text-muted text-sm mb-6">
            {lockedRole === 'tutor'
              ? 'Set up your tutor profile and start teaching on LearnSyra.'
              : 'Start learning with AI, tutors, and real-world projects.'}
          </p>

          {!configured && (
            <div className="badge badge-amber mb-4 w-full justify-center py-2">
              Supabase not configured — see supabase/schema.sql &amp; .env.example
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="text"
              required
              placeholder="Full name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="rounded-xl px-4 py-3.5 text-ink text-sm outline-none field"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-xl px-4 py-3.5 text-ink text-sm outline-none field"
            />
            <PasswordField
              required
              minLength={8}
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-xl px-4 py-3.5 text-ink text-sm outline-none field"
            />

            {error && <div className="text-sm text-rose-500">{error}</div>}
            {notice && <div className="text-sm text-success">{notice}</div>}

            <button type="submit" disabled={loading} className="btn-primary py-3.5 text-base mt-1">
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="text-muted text-sm mt-8 text-center">
            Already have an account?{' '}
            <Link to={authLoginPath(lockedRole)} className="gradient-text font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
