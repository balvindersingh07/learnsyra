import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postLoginPath } from '../lib/roleAccess'
import { ROLE_OPTIONS, authLoginPath } from '../lib/authFlow'
import { BlobField, Orb3D } from '../components/Soft3D'
import BrandMark from '../components/BrandMark'

export default function AuthRoleSelect() {
  const { session, profile, loading: authLoading, isEmailVerified } = useAuth()

  if (session && (authLoading || !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading…</div>
      </div>
    )
  }

  if (session && profile) {
    if (import.meta.env.PROD && !isEmailVerified) {
      return <Navigate to="/verify-email" replace />
    }
    return <Navigate to={postLoginPath('/dashboard', profile.role)} replace />
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: 'linear-gradient(165deg, #EEF3FA 0%, #F7F9FC 45%, #EDE8FF 100%)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <BlobField />
      <div className="relative z-10 w-full max-w-3xl">
        <div className="flex justify-center mb-8">
          <BrandMark size={52} withWordmark wordmarkClass="text-2xl" />
        </div>

        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-5">
            <Orb3D emoji="🎓" size={48} />
            <Orb3D emoji="👨‍🏫" size={44} className="float" />
            <Orb3D emoji="✨" size={40} className="float2" />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-black text-ink mb-3"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
          >
            Welcome to LearnSyra
          </h1>
          <p className="text-muted text-base sm:text-lg max-w-lg mx-auto">
            Choose how you want to use the platform. Your profile type is set once and keeps your experience tailored.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {ROLE_OPTIONS.map(option => (
            <Link
              key={option.id}
              to={authLoginPath(option.id)}
              className="glass rounded-3xl p-6 sm:p-7 card-hover text-left group"
              style={{
                boxShadow: '0 20px 50px rgba(108,92,231,0.1)',
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.65)',
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(108,92,231,0.18), rgba(79,140,255,0.12))',
                  boxShadow: '0 8px 24px rgba(108,92,231,0.15)',
                }}
              >
                {option.emoji}
              </div>
              <h2
                className="text-xl font-black text-ink mb-1"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
              >
                {option.label}
              </h2>
              <p className="text-sm font-semibold mb-2" style={{ color: '#6C5CE7' }}>
                {option.headline}
              </p>
              <p className="text-sm text-muted leading-relaxed mb-4">{option.description}</p>
              <span
                className="inline-flex items-center gap-1 text-sm font-bold"
                style={{ color: '#6C5CE7', fontFamily: 'Plus Jakarta Sans,sans-serif' }}
              >
                Continue as {option.label}
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          ))}
        </div>

        <p className="text-center text-sm text-muted mt-8">
          Already know your path?{' '}
          <Link to="/home" className="gradient-text font-semibold" style={{ textDecoration: 'none' }}>
            Explore LearnSyra
          </Link>
        </p>
      </div>
    </div>
  )
}
