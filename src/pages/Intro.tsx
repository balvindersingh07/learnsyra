import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postLoginPath } from '../lib/roleAccess'
import { BlobField, Orb3D } from '../components/Soft3D'
import BrandMark from '../components/BrandMark'

const stories = [
  {
    name: 'Priya Sharma',
    path: 'Non-tech background → Frontend Dev @ Google',
    img: 'photo-1488426862026-3ee34a7d66df',
    company: 'Google',
    text: 'LearnSyra helped me go from zero to a Google offer in 8 months. The AI tutor explained concepts better than any YouTube video, and mock interviews gave me real confidence.',
  },
  {
    name: 'Marcus Johnson',
    path: 'Career switch → Data Analyst @ Meta',
    img: 'photo-1506794778202-cad84cf45f1d',
    company: 'Meta',
    text: 'AI learning plus human tutors is unmatched. My tutor helped me land 3 interviews in one week. The projects on my portfolio did the rest.',
  },
  {
    name: 'Elena Vasquez',
    path: 'Self-taught → Product Manager @ Stripe',
    img: 'photo-1438761681033-6461ffad8d80',
    company: 'Stripe',
    text: 'The career center and mock interviews gave me the confidence I needed. I got my PM role after 6 months on LearnSyra.',
  },
]

export default function Intro() {
  const { session, profile, loading: authLoading, signIn, signInWithGoogle, resetPassword, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [story] = useState(() => stories[Math.floor(Math.random() * stories.length)])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session && (authLoading || !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading…</div>
      </div>
    )
  }

  if (session && profile) {
    return <Navigate to={postLoginPath(from, profile.role)} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }
  }

  const google = async () => {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) setError(error)
  }

  const forgot = async () => {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Enter your email first, then tap Forgot password.')
      return
    }
    const { error } = await resetPassword(email.trim())
    if (error) setError(error)
    else setNotice('Password reset email sent if that account exists.')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Left — social proof */}
      <section
        className="relative overflow-hidden flex flex-col px-8 lg:px-14 py-10"
        style={{
          background:
            'linear-gradient(165deg, #EEF3FA 0%, #F7F9FC 42%, #EDE8FF 100%)',
        }}
      >
        <BlobField />
        <div className="relative z-10 flex items-center gap-2 mb-10">
          <BrandMark size={48} withWordmark wordmarkClass="text-xl" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
          <div className="flex items-center gap-3 mb-6">
            <Orb3D emoji="🎓" size={52} />
            <Orb3D emoji="🧠" size={44} className="float" />
            <Orb3D emoji="💼" size={40} className="float2" />
          </div>

          <div className="glass rounded-3xl p-6 card-hover" style={{ boxShadow: '0 24px 60px rgba(108,92,231,0.12)' }}>
            <div className="flex items-start gap-3 mb-4">
              <img
                src={`https://images.unsplash.com/${story.img}?w=72&h=72&fit=crop&auto=format`}
                alt={story.name}
                className="w-14 h-14 rounded-2xl object-cover -mt-8 shadow-lg"
                style={{ border: '3px solid #fff' }}
              />
              <div className="pt-1">
                <div className="text-base font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                  {story.name}
                </div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: '#6C5CE7' }}>
                  {story.path}
                </div>
                <div className="badge badge-green mt-2">{story.company} · Hired</div>
              </div>
            </div>
            <p className="text-muted text-sm leading-relaxed">“{story.text}”</p>
          </div>

          <p
            className="text-ink font-bold text-2xl lg:text-3xl leading-snug mt-8"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
          >
            Take a moonshot at your career.{' '}
            <span className="gradient-text">Learn. Build. Get Ready for the Future.</span>
          </p>
          <p className="text-muted mt-3 text-sm">
            AI-powered learning + expert tutors + real projects + career preparation — all in one platform.
          </p>
        </div>

        <div className="relative z-10 mt-10">
          <button
            onClick={() => navigate('/courses')}
            className="text-sm font-semibold cursor-pointer"
            style={{ background: 'none', border: 'none', color: '#6C5CE7', fontFamily: 'Plus Jakarta Sans,sans-serif' }}
          >
            Skip for now · Explore courses →
          </button>
        </div>
      </section>

      {/* Right — sign in */}
      <section className="bg-white flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          <h1
            className="text-3xl font-black text-ink text-center mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
          >
            Sign in to LearnSyra ✨
          </h1>
          <p className="text-muted text-center text-sm mb-8">
            Build real skills with AI + expert tutors — and get career-ready.
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
            <span className="w-6 h-6 rounded-full bg-white text-[#4F8CFF] text-sm font-black flex items-center justify-center">G</span>
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
            <input
              type="password"
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
              to="/signup"
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
