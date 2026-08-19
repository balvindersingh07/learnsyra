import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ADMIN_LINKS, ADMIN_SYSTEM_LINKS, ADMIN_TRUST_LINKS, adminLinkActive } from '../lib/roleAccess'

export default function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const go = (to: string) => navigate(to)

  return (
    <div className="ac-page pt-[4.25rem] px-4 sm:px-5 pb-10 max-w-7xl mx-auto overflow-x-hidden">
      <div className="grid lg:grid-cols-[13.25rem_1fr] gap-4">
        <aside className="hidden lg:block glass rounded-2xl p-2.5 h-fit sticky top-[4.75rem]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted px-2.5 mb-1">Admin</p>
          {ADMIN_LINKS.map(l => (
            <button
              key={l.to}
              type="button"
              className="ac-nav w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] font-semibold"
              data-on={adminLinkActive(location.pathname, l.to)}
              onClick={() => go(l.to)}
            >
              {l.label}
            </button>
          ))}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted px-2.5 mt-2.5 mb-1">Trust & Verification</p>
          {ADMIN_TRUST_LINKS.map(l => (
            <button key={l.label} type="button" className="ac-nav w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] font-semibold" data-on={adminLinkActive(location.pathname, l.to)} onClick={() => go(l.to)}>
              {l.label}
            </button>
          ))}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted px-2.5 mt-2.5 mb-1">System</p>
          {ADMIN_SYSTEM_LINKS.map(l => (
            <button key={l.to} type="button" className="ac-nav w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] font-semibold" data-on={adminLinkActive(location.pathname, l.to)} onClick={() => go(l.to)}>
              {l.label}
            </button>
          ))}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted px-2.5 mt-2.5 mb-1">Account</p>
          <button type="button" className="ac-nav w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] font-semibold" data-on={adminLinkActive(location.pathname, '/admin/profile')} onClick={() => go('/admin/profile')}>
            Admin Profile
          </button>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
