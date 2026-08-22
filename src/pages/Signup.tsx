import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../lib/supabase'
import { validateSignupInput } from '../lib/authValidation'
import BrandMark from '../components/BrandMark'
import PasswordField from '../components/PasswordField'

const roles: { id: UserRole; label: string; icon: string }[] = [
  { id: 'student', label: 'Student', icon: '🎓' },
  { id: 'tutor', label: 'Tutor', icon: '🧑‍🏫' },
]

export default function Signup() {
  const { signUp, configured } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    const { error: err, needsVerification } = await signUp(email, password, fullName, role)
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
    setTimeout(() => navigate('/login'), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pt-16">
      <div className="glass rounded-3xl p-8 w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <BrandMark size={44} withWordmark wordmarkClass="text-lg" />
        </div>

        <h1 className="text-2xl font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Create your account
        </h1>
        <p className="text-muted text-sm mb-6">Start learning in minutes.</p>

        {!configured && (
          <div className="badge badge-amber mb-4 w-full justify-center py-2">
            Supabase not configured — see supabase/schema.sql &amp; .env.example
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            {roles.map(r => (
              <button
                type="button"
                key={r.id}
                onClick={() => setRole(r.id)}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
                style={{
                  fontFamily: 'Plus Jakarta Sans,sans-serif',
                  background: role === r.id ? 'rgba(108,92,231,0.2)' : 'rgba(255,255,255,0.9)',
                  border: `1px solid ${role === r.id ? 'rgba(108,92,231,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  color: role === r.id ? '#6C5CE7' : '#667085',
                }}
              >
                {r.icon} {r.label}
              </button>
            ))}
          </div>

          {role === 'tutor' && (
            <p className="text-xs text-muted leading-relaxed">
              Tutor accounts use email/password signup so your role is set securely at registration.
              Google sign-in creates a student account.
            </p>
          )}

          <input
            type="text"
            required
            placeholder="Full name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="glass rounded-xl px-4 py-3 text-ink text-sm outline-none"
            style={{ border: '1px solid rgba(99,102,241,0.12)' }}
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="glass rounded-xl px-4 py-3 text-ink text-sm outline-none"
            style={{ border: '1px solid rgba(99,102,241,0.12)' }}
          />
          <PasswordField
            required
            minLength={8}
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="glass rounded-xl px-4 py-3 text-ink text-sm outline-none"
            style={{ border: '1px solid rgba(99,102,241,0.12)' }}
          />

          {error && <div className="text-sm text-rose-400">{error}</div>}
          {notice && <div className="text-sm text-success">{notice}</div>}

          <button type="submit" disabled={loading} className="btn-primary mt-2 py-3">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="text-muted text-sm mt-5 text-center">
          Already have an account?{' '}
          <Link to="/login" className="gradient-text font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
