import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BrandMark from './BrandMark'
import { useAuth } from '../context/AuthContext'
import { unreadNotificationCount } from '../lib/api'
import {
  ADMIN_HOME,
  ADMIN_LINKS,
  ADMIN_SYSTEM_LINKS,
  ADMIN_TRUST_LINKS,
  adminLinkActive,
} from '../lib/roleAccess'

export default function AdminNav() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (to: string) => {
    navigate(to)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const logout = async () => {
    await signOut()
    navigate('/home')
  }

  const sideLinks = (
    <>
      <p className="text-xs font-semibold uppercase text-muted mb-1 px-1">Admin</p>
      {ADMIN_LINKS.map(l => (
        <button
          key={l.to}
          type="button"
          className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold mb-0.5"
          style={{
            background: adminLinkActive(location.pathname, l.to) ? 'rgba(108,92,231,0.12)' : 'transparent',
            color: adminLinkActive(location.pathname, l.to) ? '#6C5CE7' : '#172033',
            border: 'none',
          }}
          onClick={() => go(l.to)}
        >
          {l.label}
        </button>
      ))}
      <p className="text-xs font-semibold uppercase text-muted mt-3 mb-1 px-1">Trust & Verification</p>
      {ADMIN_TRUST_LINKS.map(l => (
        <button
          key={l.to + l.label}
          type="button"
          className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold mb-0.5"
          style={{
            background: adminLinkActive(location.pathname, l.to) ? 'rgba(108,92,231,0.12)' : 'transparent',
            color: adminLinkActive(location.pathname, l.to) ? '#6C5CE7' : '#172033',
            border: 'none',
          }}
          onClick={() => go(l.to)}
        >
          {l.label}
        </button>
      ))}
      <p className="text-xs font-semibold uppercase text-muted mt-3 mb-1 px-1">System</p>
      {ADMIN_SYSTEM_LINKS.map(l => (
        <button key={l.to} type="button" className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold mb-0.5" style={{
          background: adminLinkActive(location.pathname, l.to) ? 'rgba(108,92,231,0.12)' : 'transparent',
          color: adminLinkActive(location.pathname, l.to) ? '#6C5CE7' : '#172033',
          border: 'none',
        }} onClick={() => go(l.to)}>
          {l.label}
        </button>
      ))}
      <p className="text-xs font-semibold uppercase text-muted mt-3 mb-1 px-1">Account</p>
      <button type="button" className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: adminLinkActive(location.pathname, '/admin/profile') ? 'rgba(108,92,231,0.12)' : 'none', color: adminLinkActive(location.pathname, '/admin/profile') ? '#6C5CE7' : '#172033', border: 'none' }} onClick={() => go('/admin/profile')}>Admin Profile</button>
    </>
  )

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-2"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(99,102,241,0.12)',
        boxShadow: '0 6px 18px rgba(23,32,51,0.03)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          className="lg:hidden w-8 h-8 rounded-lg cursor-pointer"
          aria-label="Open admin menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
        >
          ☰
        </button>
        <button type="button" onClick={() => go(ADMIN_HOME)} className="flex items-center gap-2 cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }}>
          <BrandMark size={36} />
          <span className="text-ink font-bold text-lg hidden sm:block" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}>
            Learn<span className="gradient-text">Syra</span>
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go('/admin/users')}
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

        <button
          type="button"
          onClick={() => go(ADMIN_HOME)}
          className="px-3 py-1.5 rounded-lg text-sm cursor-pointer"
          style={{
            background: location.pathname === '/admin' ? 'rgba(108,92,231,0.1)' : 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(99,102,241,0.12)',
            color: location.pathname === '/admin' ? '#6C5CE7' : '#667085',
            fontFamily: 'Plus Jakarta Sans,sans-serif',
            fontWeight: 600,
          }}
        >
          Dashboard
        </button>

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
        <div className="fixed inset-0 z-[80] lg:hidden" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setDrawerOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Admin menu" className="absolute left-0 top-0 bottom-0 w-72 glass p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
            {sideLinks}
          </div>
        </div>
      )}
    </nav>
  )
}
