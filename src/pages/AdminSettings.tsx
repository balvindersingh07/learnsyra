import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import BrandMark from '../components/BrandMark'
import {
  badgeLabel,
  loadAdminSettings,
  parseSettingsCategory,
  SETTINGS_NAV,
  type AdminSettingsPack,
  type SettingBadge,
  type SettingRow,
  type SettingsCategory,
} from '../lib/adminSettings'
import './admin-control.css'

export default function AdminSettings() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const section = parseSettingsCategory(params.get('section'))
  const [pack, setPack] = useState<AdminSettingsPack | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminSettings()
      .then(setPack)
      .catch(() => setError("Platform settings couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const goSection = (id: SettingsCategory) => {
    setParams({ section: id }, { replace: false })
    setNavOpen(false)
  }

  const panel = useMemo(() => pack?.panels.find(p => p.id === section) ?? null, [pack, section])

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Platform Settings</h1>
            <p className="text-[13px] text-muted">Manage platform-wide configuration and operational preferences.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setNavOpen(true)}>Categories</button>
            <button type="button" className="btn-glass text-xs" onClick={load}>Refresh</button>
          </div>
        </div>

        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}

        <label className="lg:hidden block text-[11px] font-semibold text-muted mb-3">
          Settings category
          <select className="field mt-1 w-full px-3 py-2 text-sm" value={section} onChange={e => goSection(e.target.value as SettingsCategory)} aria-label="Settings category">
            {SETTINGS_NAV.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        </label>

        <div className="grid lg:grid-cols-[12rem_minmax(0,40rem)] gap-3 items-start">
          <nav className="hidden lg:block glass rounded-2xl p-2 sticky top-[4.75rem]" aria-label="Settings categories">
            {SETTINGS_NAV.map(n => (
              <button
                key={n.id}
                type="button"
                className="ac-nav w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] font-semibold"
                data-on={section === n.id}
                aria-current={section === n.id ? 'page' : undefined}
                onClick={() => goSection(n.id)}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {loading && !pack && (
              <div className="glass rounded-2xl p-4" aria-busy="true" aria-label="Loading settings">
                <div className="ac-skel mb-2" />
                <div className="ac-skel h-20" />
              </div>
            )}
            {panel && (
              <section className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <h2 className="font-black text-ink mb-0">{panel.title}</h2>
                  {!pack?.writable && <Badge badge="read-only" />}
                </div>
                <p className="text-[13px] text-muted mb-3">{panel.intro}</p>
                {panel.failed && <p className="text-[13px] mb-3" style={{ color: '#e11d48' }}>Settings unavailable.</p>}
                {section === 'branding' && (
                  <div className="flex items-center gap-3 mb-3">
                    <BrandMark size={40} />
                    <p className="text-[12px] text-muted">Current LearnSyra mark. Read only.</p>
                  </div>
                )}
                {panel.rows.length === 0 && !panel.failed && <p className="text-[13px] text-muted">No settings in this category.</p>}
                <dl>
                  {panel.rows.map(row => <SettingLine key={row.key} row={row} />)}
                </dl>
                <p className="text-[12px] text-muted mt-3">{panel.note}</p>
                {pack && !pack.auditAvailable && section === 'maintenance' && (
                  <p className="text-[12px] text-muted mt-2">Audit persistence is unavailable. Settings changes are not claimed as audited.</p>
                )}
                {panel.links.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {panel.links.map(l => (
                      <button key={l.href + l.label} type="button" className="btn-glass text-xs" onClick={() => navigate(l.href)}>{l.label}</button>
                    ))}
                  </div>
                )}
              </section>
            )}
            <p className="text-[11px] text-muted mt-3">Platform Settings configure LearnSyra. Account identity stays on Admin Profile. Tutor Settings and Student Profile are unchanged.</p>
          </div>
        </div>
      </div>

      {navOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Settings categories">
          <div className="glass w-72 max-w-[90vw] h-full p-4 overflow-y-auto">
            <h2 className="text-lg font-black text-ink mb-3">Categories</h2>
            {SETTINGS_NAV.map(n => (
              <button key={n.id} type="button" className="ac-nav w-full text-left px-2.5 py-2 rounded-lg text-sm font-semibold" data-on={section === n.id} onClick={() => goSection(n.id)}>{n.label}</button>
            ))}
          </div>
          <button type="button" className="flex-1" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setNavOpen(false)} />
        </div>
      )}
    </AdminShell>
  )
}

function SettingLine({ row }: { row: SettingRow }) {
  return (
    <div className="ac-health gap-3">
      <div className="min-w-0">
        <dt className="text-[13px] font-semibold text-ink">{row.label}</dt>
        {row.description && <p className="text-[11px] text-muted">{row.description}</p>}
        <p className="text-[10px] text-muted">Source: {row.source}</p>
      </div>
      <dd className="text-right shrink-0">
        <div className="text-[13px] font-medium text-ink">{row.value}</div>
        <Badge badge={row.badge} />
      </dd>
    </div>
  )
}

function Badge({ badge }: { badge: SettingBadge }) {
  return (
    <span className="ac-chip inline-block rounded-full px-2 py-0.5 text-[10px] font-bold mt-0.5" data-on={badge === 'connected' || badge === 'configured'}>
      {badgeLabel(badge)}
    </span>
  )
}
