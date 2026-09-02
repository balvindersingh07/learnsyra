import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useNav } from '../lib/useNav'
import { pagePath, type Page } from '../lib/paths'
import { useAuth } from '../context/AuthContext'
import { planLabel, unreadNotificationCount } from '../lib/api'
import BrandMark from './BrandMark'
import GlobalSearch from './GlobalSearch'
import TutorNav from './TutorNav'
import AdminNav from './AdminNav'

const links: { label: string; page: Page }[] = [
  { label: 'Explore Courses', page: 'courses' },
  { label: 'Find Tutors', page: 'tutors' },
  { label: 'AI Learning', page: 'ai-learning' },
  { label: 'Projects', page: 'projects' },
  { label: 'Live', page: 'live' },
  { label: 'Career', page: 'career' },
  { label: 'Pricing', page: 'pricing' },
]

export default function Nav() {
  const nav = useNav()
  const location = useLocation()
  const { session, profile, loading, signOut } = useAuth()
  const [unread, setUnread] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!session) {
      setUnread(0)
      return
    }
    unreadNotificationCount().then(setUnread).catch(() => setUnread(0))
  }, [session, location.pathname])

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  if (session && (loading || !profile)) {
    return (
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
          boxShadow: '0 8px 24px rgba(23,32,51,0.04)',
        }}
      >
        <div className="flex items-center gap-2">
          <BrandMark size={40} />
          <span className="text-ink font-bold text-lg hidden sm:block" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}>
            Learn<span className="gradient-text">Syra</span>
          </span>
        </div>
        <div className="text-sm text-muted">Loading your workspace...</div>
      </nav>
    )
  }

  if (profile?.role === 'tutor') return <TutorNav />
  if (profile?.role === 'admin') return <AdminNav />

  const isActive = (page: Page) =>
    page === 'courses'
      ? location.pathname.startsWith('/courses')
      : page === 'live'
        ? location.pathname.startsWith('/live')
        : page === 'career'
          ? location.pathname.startsWith('/career')
          : location.pathname === pagePath[page]

  const go = (page: Page) => {
    setDrawerOpen(false)
    nav(page)
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(99,102,241,0.12)',
        boxShadow: '0 8px 24px rgba(23,32,51,0.04)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          className="lg:hidden w-8 h-8 rounded-lg cursor-pointer"
          aria-label="Open student menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
        >
          ☰
        </button>
        <button
          type="button"
          onClick={() => go('home')}
          className="flex items-center gap-2 cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
        <BrandMark size={40} />
        <span
          className="text-ink font-bold text-lg hidden sm:block"
          style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
        >
          Learn<span className="gradient-text">Syra</span>
        </span>
        </button>
      </div>

      <div className="hidden lg:flex items-center gap-1">
        {links.map(l => (
          <button
            key={l.page}
            type="button"
            onClick={() => go(l.page)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer"
            style={{
              fontFamily: 'Plus Jakarta Sans,sans-serif',
              background: isActive(l.page) ? 'rgba(108,92,231,0.1)' : 'transparent',
              color: isActive(l.page) ? '#6C5CE7' : '#667085',
              border: 'none',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <GlobalSearch role={profile?.role ?? null} />
        {session && (
          <button
            onClick={() => nav('notifications')}
            aria-label="Notifications"
            className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg cursor-pointer relative"
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: '#f43f5e' }} />
            )}
          </button>
        )}

        {session ? (
          <>
            <button
              onClick={() => nav('dashboard')}
              className="px-3 py-1.5 rounded-lg text-sm cursor-pointer"
              style={{
                background:
                  location.pathname === '/dashboard'
                    ? 'rgba(108,92,231,0.1)'
                    : 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(99,102,241,0.12)',
                color:
                  location.pathname === '/dashboard'
                    ? '#6C5CE7'
                    : '#667085',
                fontFamily: 'Plus Jakarta Sans,sans-serif',
                fontWeight: 600,
              }}
            >
              Dashboard
            </button>

            <button
              onClick={() => nav('profile')}
              className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)' }}
            >
              <div
                className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-xs text-white font-bold"
                style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (profile?.full_name || session.user.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-xs text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                {profile?.full_name === 'Super Admin'
                  ? 'Admin'
                  : (profile?.full_name || session.user.email)}
              </span>
              <span className="badge badge-primary text-[10px]">{planLabel(profile?.plan)}</span>
            </button>

            <button
              onClick={async () => {
                await signOut()
                nav('home')
              }}
              className="px-3 py-1.5 rounded-lg text-sm cursor-pointer"
              style={{
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.18)',
                color: '#E11D48',
                fontFamily: 'Plus Jakarta Sans,sans-serif',
                fontWeight: 600,
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => nav('login')}
              className="px-3 py-1.5 rounded-lg text-sm cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(99,102,241,0.12)',
                color: '#667085',
                fontFamily: 'Plus Jakarta Sans,sans-serif',
                fontWeight: 600,
              }}
            >
              Log in
            </button>
            <button onClick={() => nav('signup')} className="btn-primary text-sm">
              Get Started
            </button>
          </>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setDrawerOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Student menu" className="absolute left-0 top-0 bottom-0 w-72 glass p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="text-xs font-semibold uppercase text-muted mb-2 px-1">LearnSyra</p>
            {links.map(l => (
              <button
                key={l.page}
                type="button"
                className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold mb-0.5"
                style={{
                  background: isActive(l.page) ? 'rgba(108,92,231,0.12)' : 'transparent',
                  color: isActive(l.page) ? '#6C5CE7' : '#172033',
                  border: 'none',
                }}
                onClick={() => go(l.page)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
