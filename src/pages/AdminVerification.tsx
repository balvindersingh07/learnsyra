import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  loadVerificationCenter,
  verificationStats,
  type VerificationCenter,
} from '../lib/adminVerification'
import './admin-control.css'

const TABS = ['All', 'Pending Review', 'Needs Changes', 'Approved', 'Rejected', 'Not Submitted'] as const

export default function AdminVerification() {
  const navigate = useNavigate()
  const [data, setData] = useState<VerificationCenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Pending Review')
  const [q, setQ] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadVerificationCenter()
      .then(setData)
      .catch(() => setError('Verification service unavailable'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  const stats = verificationStats({ backend: data?.backend ?? false, tutorCount: data?.tutorCount ?? 0 })
  const backend = data?.backend ?? false

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Tutor Verification</h1>
            <p className="text-[13px] text-muted">Review tutor verification status and platform trust requirements.</p>
          </div>
          <button type="button" className="btn-glass text-xs" onClick={load}>Refresh</button>
        </div>

        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
          {[
            ['Total Tutors', loading ? null : stats.totalTutors],
            ['Pending Review', loading ? null : stats.pending],
            ['Needs Changes', loading ? null : stats.needsChanges],
            ['Verified', loading ? null : stats.verified],
            ['Rejected', loading ? null : stats.rejected],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink" style={String(v).length > 8 ? { fontSize: '1rem' } : undefined}>{v}</strong>}
            </div>
          ))}
        </div>

        <div className="flex flex-nowrap gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Verification status">
          {TABS.map(t => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <label className="sr-only" htmlFor="verify-search">Search tutors</label>
          <input id="verify-search" className="field flex-1 min-w-[12rem] px-3 py-1.5 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search tutors..." />
          {q && <button type="button" className="btn-glass text-xs" onClick={() => setQ('')}>Clear Search</button>}
          <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFiltersOpen(true)}>Filters</button>
        </div>
        <div className="hidden lg:block mb-3 text-[12px] text-muted">Verification Status, submission dates, and review history filters appear when the verification service is connected.</div>

        {loading && (
          <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading verification">
            <div className="ac-skel h-12" />
            <div className="ac-skel h-12" />
          </div>
        )}

        {!loading && (
          <section className="glass rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2" aria-hidden>🔒</p>
            <h2 className="font-black text-ink mb-1">Verification service unavailable</h2>
            <p className="text-[13px] text-muted max-w-xl mx-auto">
              LearnSyra's verification infrastructure is not connected yet. Tutor verification review will appear here once the verification service is available.
            </p>
            <p className="text-[12px] text-muted mt-2">
              Verification actions will be available when verification services are connected. Tutor profiles and marketplace information remain available in Tutor Management.
            </p>
            {q && <p className="text-[13px] text-muted mt-3">No tutors match your search.</p>}
            {!backend && tab !== 'Pending Review' && (
              <p className="text-[12px] text-muted mt-2">No verification applications in {tab.toLowerCase()}.</p>
            )}
            <button type="button" className="btn-primary text-sm mt-4" onClick={() => navigate('/admin/tutors')}>View Tutor Management →</button>
          </section>
        )}
      </div>

      {filtersOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="glass w-80 max-w-[90vw] h-full p-5 overflow-y-auto">
            <h2 className="text-lg font-black text-ink mb-2">Filters</h2>
            <p className="text-sm text-muted mb-4">Verification filters will appear when the verification service is connected.</p>
            <button type="button" className="btn-primary w-full text-sm" onClick={() => setFiltersOpen(false)}>Close</button>
          </div>
          <button type="button" className="flex-1" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setFiltersOpen(false)} />
        </div>
      )}
    </AdminShell>
  )
}
