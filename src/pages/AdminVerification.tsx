import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { displayInitials } from '../lib/roleAccess'
import {
  filterVerificationTutors,
  loadVerificationCenter,
  tutorVerificationStatus,
  verificationStats,
  verificationStatusLabel,
  type VerificationCenter,
  type VerificationTab,
} from '../lib/adminVerification'
import './admin-control.css'

const TABS: VerificationTab[] = ['All', 'Pending Review', 'Needs Changes', 'Approved', 'Rejected', 'Not Submitted']

export default function AdminVerification() {
  const navigate = useNavigate()
  const [data, setData] = useState<VerificationCenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<VerificationTab>('Pending Review')
  const [q, setQ] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadVerificationCenter()
      .then(setData)
      .catch(() => setError('Verification data could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  const stats = data ? verificationStats(data.index) : null
  const rows = useMemo(
    () => (data ? filterVerificationTutors(data.index, tab, q) : []),
    [data, tab, q],
  )

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Tutor Verification</h1>
            <p className="text-[13px] text-muted">Review tutor marketplace listings using existing listing availability and profile data.</p>
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
            ['Total Tutors', loading ? null : stats?.totalTutors],
            ['Pending Review', loading ? null : stats?.pending],
            ['Needs Changes', loading ? null : stats?.needsChanges],
            ['Verified', loading ? null : stats?.verified],
            ['Rejected', loading ? null : stats?.rejected],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink">{v}</strong>}
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
        </div>

        {loading && (
          <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading verification">
            <div className="ac-skel h-12" />
            <div className="ac-skel h-12" />
          </div>
        )}

        {!loading && rows.length === 0 && (
          <section className="glass rounded-2xl p-5 text-center">
            <p className="text-[13px] text-muted">{q.trim() ? 'No tutors match your search.' : `No tutors in ${tab.toLowerCase()}.`}</p>
          </section>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-2">
            {rows.map(tutor => {
              const status = data ? tutorVerificationStatus(tutor, data.index.listings.find(l => l.profile_id === tutor.id) ?? null) : 'pending'
              return (
                <button
                  key={tutor.id}
                  type="button"
                  className="glass rounded-2xl p-3.5 w-full text-left flex flex-wrap items-center justify-between gap-3"
                  onClick={() => navigate(`/admin/verification/${tutor.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-black shrink-0" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}>
                      {tutor.avatarUrl ? <img src={tutor.avatarUrl} alt="" className="w-full h-full object-cover" /> : displayInitials(tutor.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate">{tutor.name}</div>
                      <div className="text-[12px] text-muted truncate">{tutor.headline || 'No headline'}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="ac-chip rounded-full px-2 py-0.5" data-on={status === 'approved'}>{verificationStatusLabel(status)}</span>
                    <span className="text-muted">{tutor.listingAvailable === true ? 'Listing live' : tutor.listingId ? 'Listing hidden' : 'No listing'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <p className="text-[12px] text-muted mt-4">Identity documents and verification submissions are not stored server-side yet. Moderation uses marketplace listing availability.</p>
      </div>

      {filtersOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="glass w-80 max-w-[90vw] h-full p-5 overflow-y-auto">
            <h2 className="text-lg font-black text-ink mb-2">Filters</h2>
            <p className="text-sm text-muted mb-4">Use the status tabs above to filter verification queue.</p>
            <button type="button" className="btn-primary w-full text-sm" onClick={() => setFiltersOpen(false)}>Close</button>
          </div>
          <button type="button" className="flex-1" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setFiltersOpen(false)} />
        </div>
      )}
    </AdminShell>
  )
}
