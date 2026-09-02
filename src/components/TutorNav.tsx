import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BrandMark from './BrandMark'
import GlobalSearch from './GlobalSearch'
import { useAuth } from '../context/AuthContext'
import { unreadNotificationCount } from '../lib/api'
import { displayInitials, TUTOR_HOME, TUTOR_LINKS, tutorLinkActive } from '../lib/roleAccess'

const DESKTOP_MQ = '(min-width: 1024px)'
const SIDEBAR_WIDTH = '18rem'
const HEADER_OFFSET = '4.5rem'

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return desktop
}

export default function TutorNav() {
  const { session, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : false,
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const desktopRef = useRef(desktop)
  desktopRef.current = desktop
  const name = profile?.full_name || session?.user.email || 'Tutor'

  useEffect(() => {
    if (!session) {
      setUnread(0)
      return
    }
    unreadNotificationCount().then(setUnread).catch(() => setUnread(0))
  }, [session, location.pathname])

  useEffect(() => {
    setMenuOpen(false)
    if (!desktopRef.current) setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!desktop) setSidebarOpen(false)
  }, [desktop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setSidebarOpen(false)
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

  useEffect(() => {
    const body = document.body
    const prevOverflow = body.style.overflow
    body.style.transition = 'padding-left 0.2s ease'
    if (desktop && sidebarOpen) {
      body.style.paddingLeft = SIDEBAR_WIDTH
      body.style.overflow = ''
    } else {
      body.style.paddingLeft = ''
      body.style.overflow = !desktop && sidebarOpen ? 'hidden' : ''
    }
    return () => {
      body.style.paddingLeft = ''
      body.style.overflow = prevOverflow
    }
  }, [desktop, sidebarOpen])

  const go = (to: string) => {
    navigate(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (!desktop) setSidebarOpen(false)
  }

  const logout = async () => {
    await signOut()
    setSidebarOpen(false)
    navigate('/home')
  }

  const sideLinks = (
    <>
      <p className="text-xs font-semibold uppercase text-muted mb-3">Tutor</p>
      {TUTOR_LINKS.map(l => (
        <button
          key={l.to}
          type="button"
          className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold mb-1 cursor-pointer"
          style={{
            background: tutorLinkActive(location.pathname, l.to) ? 'rgba(108,92,231,0.12)' : 'transparent',
            color: tutorLinkActive(location.pathname, l.to) ? '#6C5CE7' : '#172033',
            border: 'none',
            fontFamily: 'Plus Jakarta Sans,sans-serif',
          }}
          onClick={() => go(l.to)}
        >
          {l.label}
        </button>
      ))}
      <button
        type="button"
        className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
        style={{
          background: tutorLinkActive(location.pathname, '/tutor/profile') ? 'rgba(108,92,231,0.12)' : 'transparent',
          color: tutorLinkActive(location.pathname, '/tutor/profile') ? '#6C5CE7' : '#172033',
          border: 'none',
          fontFamily: 'Plus Jakarta Sans,sans-serif',
        }}
        onClick={() => go('/tutor/profile')}
      >
        Profile
      </button>
      <button
        type="button"
        className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
        style={{ background: 'none', border: 'none', color: '#E11D48', fontFamily: 'Plus Jakarta Sans,sans-serif' }}
        onClick={logout}
      >
        Log out
      </button>
    </>
  )

  const sidebar = (
    <>
      {!desktop && sidebarOpen && (
        <div
          className="fixed inset-0"
          style={{ background: 'rgba(23,32,51,0.45)', zIndex: 80 }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        id="tutor-sidebar"
        role={desktop ? 'navigation' : 'dialog'}
        aria-modal={desktop ? undefined : true}
        aria-label="Tutor menu"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className="fixed left-0 top-0 w-72 glass overflow-y-auto"
        style={{
          height: '100vh',
          width: SIDEBAR_WIDTH,
          zIndex: desktop ? 40 : 90,
          padding: desktop ? `${HEADER_OFFSET} 1.25rem 1.25rem` : '1.25rem',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          borderRadius: 0,
          borderTop: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
        }}
      >
        {sideLinks}
      </aside>
    </>
  )

  return (
    <>
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
            className="w-8 h-8 rounded-lg cursor-pointer"
            aria-label={sidebarOpen ? 'Collapse tutor menu' : 'Open tutor menu'}
            aria-expanded={sidebarOpen}
            aria-controls="tutor-sidebar"
            onClick={() => setSidebarOpen(o => !o)}
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
          >
            {sidebarOpen ? '✕' : '☰'}
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

        <div className="flex items-center gap-2">
          <GlobalSearch role="tutor" />
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
      </nav>
      {createPortal(sidebar, document.body)}
    </>
  )
}
