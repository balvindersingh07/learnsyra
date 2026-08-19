import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from './BrandMark'
import { useAuth } from '../context/AuthContext'
import { unreadNotificationCount } from '../lib/api'
import { displayInitials, TUTOR_HOME, TUTOR_LINKS, tutorLinkActive } from '../lib/roleAccess'

export default function TutorNav() {
  const { session, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const name = profile?.full_name || session?.user.email || 'Tutor'

  useEffect(() => {
    if (!session) {
      setUnread(0)
      return
    }
    unreadNotificationCount().then(setUnread).catch(() => setUnread(0))
  }, [session, location.pathname])

  useEffect(() => {
    setDrawerOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setDrawerOpen(false)
      }
    }
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [])

  const go = (to: string) => {
    navigate(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const logout = async () => {
    await signOut()
    navigate('/home')
  }

  const navBtn = (label: string, to: string) => {
    const on = tutorLinkActive(location.pathname, to)
    return (
      <button
        key={to}
        type="button"
        onClick={() => go(to)}
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer"
        style={{
          fontFamily: 'Plus Jakarta Sans,sans-serif',
          background: on ? 'rgba(108,92,231,0.1)' : 'transparent',
          color: on ? '#6C5CE7' : '#667085',
          border: 'none',
        }}
      >
        {label}
      </button>
    )
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
          className="xl:hidden w-8 h-8 rounded-lg cursor-pointer"
          aria-label="Open tutor menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
        >
          ☰
        </button>
        <button
          type="button"
          onClick={() => go(TUTOR_HOME)}
          className="flex items-center gap-2 cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          <BrandMark size={40} />
          <span className="text-ink font-bold text-lg hidden sm:block" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}>
            Learn<span className="gradient-text">Syra</span>
          </span>
        </button>
      </div>

      <div className="hidden xl:flex items-center gap-1 overflow-x-auto">
        {TUTOR_LINKS.map(l => navBtn(l.label, l.to))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go('/tutor/courses')}
          aria-label="Search"
          className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
        <button
          type="button"
          onClick={() => go('/notifications')}
          aria-label="Notifications"
          className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg cursor-pointer relative"
          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
          </svg>
          {unread > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: '#f43f5e' }} />}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)' }}
          >
            <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] text-white font-bold" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}>
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : displayInitials(name)}
            </div>
            <span className="text-xs text-ink max-w-[9rem] truncate" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{name}</span>
            <span className="badge badge-primary text-[10px]">Tutor</span>
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-52 glass rounded-2xl p-2 z-[70]" style={{ boxShadow: '0 16px 40px rgba(23,32,51,0.12)' }}>
              {[
                ['My Tutor Profile', '/tutor/profile'],
                ['Availability', '/tutor/profile#availability'],
                ['Pricing', '/tutor/profile#pricing'],
                ['Earnings', '/tutor/earnings'],
                ['Settings', '/tutor/settings'],
              ].map(([label, href]) => (
                <Link key={href} role="menuitem" to={href} className="block px-3 py-2 rounded-xl text-sm text-ink" style={{ textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>
                  {label}
                </Link>
              ))}
              <button type="button" role="menuitem" className="w-full text-left px-3 py-2 rounded-xl text-sm" style={{ background: 'none', border: 'none', color: '#E11D48' }} onClick={logout}>
                Log out
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
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
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[80] xl:hidden" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setDrawerOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Tutor menu" className="absolute left-0 top-0 bottom-0 w-72 glass p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="text-xs font-semibold uppercase text-muted mb-3">Tutor</p>
            {TUTOR_LINKS.map(l => (
              <button
                key={l.to}
                type="button"
                className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold mb-1"
                style={{
                  background: tutorLinkActive(location.pathname, l.to) ? 'rgba(108,92,231,0.12)' : 'transparent',
                  color: tutorLinkActive(location.pathname, l.to) ? '#6C5CE7' : '#172033',
                  border: 'none',
                }}
                onClick={() => go(l.to)}
              >
                {l.label}
              </button>
            ))}
            <button type="button" className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'none', border: 'none' }} onClick={() => go('/tutor/profile')}>Profile</button>
            <button type="button" className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'none', border: 'none', color: '#E11D48' }} onClick={logout}>Log out</button>
          </div>
        </div>
      )}
    </nav>
  )
}
