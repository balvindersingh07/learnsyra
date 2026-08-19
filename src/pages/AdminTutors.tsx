import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { displayInitials } from '../lib/roleAccess'
import {
  filterTutors,
  formatWhen,
  loadAdminTutorIndex,
  marketLabel,
  paginate,
  tutorStats,
  tutorsPageSize,
  uniqueValues,
  type AdminTutorIndex,
  type AdminTutorRow,
  type MarketFilter,
  type TutorAccountFilter,
  type TutorQuery,
  type TutorSort,
  type TutorTab,
} from '../lib/adminTutors'
import './admin-control.css'

const TABS: { id: TutorTab; label: string }[] = [
  { id: 'all', label: 'All Tutors' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Draft' },
  { id: 'paused', label: 'Paused' },
  { id: 'review', label: 'Needs Review' },
  { id: 'suspended', label: 'Suspended' },
]

export default function AdminTutors() {
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminTutorIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TutorTab>('all')
  const [q, setQ] = useState('')
  const [account, setAccount] = useState<TutorAccountFilter>('all')
  const [market, setMarket] = useState<MarketFilter>('all')
  const [expertise, setExpertise] = useState('')
  const [style, setStyle] = useState('')
  const [session, setSession] = useState('')
  const [joined, setJoined] = useState<TutorQuery['joined']>('any')
  const [sort, setSort] = useState<TutorSort>('recommended')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminTutorIndex()
      .then(setIndex)
      .catch(() => setError("Tutors couldn't be loaded right now."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [tab, q, account, market, expertise, style, session, joined, sort])
  useEffect(() => {
    if (!filtersOpen && !exportOpen && !menuId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltersOpen(false)
        setExportOpen(false)
        setMenuId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen, exportOpen, menuId])

  const rows = index?.tutors ?? []
  const query: TutorQuery = useMemo(() => ({
    tab, q, account, market, expertise, style, session, joined, sort,
  }), [tab, q, account, market, expertise, style, session, joined, sort])
  const filtered = useMemo(() => filterTutors(rows, query), [rows, query])
  const pager = paginate(filtered, page)
  const stats = tutorStats(rows)
  const hasRating = rows.some(r => r.rating != null)
  const hasSessions = rows.some(r => r.sessionCount > 0)
  const hasStudents = rows.some(r => r.studentCount > 0)
  const expertises = uniqueValues(rows, 'expertise')
  const styles = uniqueValues(rows, 'teachingStyles')
  const sessions = uniqueValues(rows, 'sessionTypes')
  const hasDemo = rows.some(r => r.demo)
  const hasSuspended = rows.some(r => r.accountStatus === 'suspended')
  const tabs = hasSuspended ? TABS : TABS.filter(t => t.id !== 'suspended')

  const emptyCopy = () => {
    if (q.trim()) return 'No tutors match your search.'
    return 'No tutors yet.'
  }

  const filters = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      <label className="text-[11px] font-semibold text-muted">
        Status
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={account} onChange={e => setAccount(e.target.value as TutorAccountFilter)}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </label>
      <label className="text-[11px] font-semibold text-muted">
        Marketplace visibility
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={market} onChange={e => setMarket(e.target.value as MarketFilter)}>
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="paused">Paused</option>
          {rows.some(r => r.market == null) && <option value="unknown">No hub yet</option>}
        </select>
      </label>
      {expertises.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Expertise
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={expertise} onChange={e => setExpertise(e.target.value)}>
            <option value="">All</option>
            {expertises.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {styles.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Teaching style
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={style} onChange={e => setStyle(e.target.value)}>
            <option value="">All</option>
            {styles.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {sessions.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Session type
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={session} onChange={e => setSession(e.target.value)}>
            <option value="">All</option>
            {sessions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      <label className="text-[11px] font-semibold text-muted">
        Joined
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={joined} onChange={e => setJoined(e.target.value as TutorQuery['joined'])}>
          <option value="any">Any time</option>
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
          <option value="3m">3 Months</option>
          <option value="1y">1 Year</option>
        </select>
      </label>
      <label className="text-[11px] font-semibold text-muted">
        Sort
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={sort} onChange={e => setSort(e.target.value as TutorSort)}>
          <option value="recommended">Recommended</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          {hasStudents && <option value="students">Students</option>}
          {hasRating && <option value="rating">Rating</option>}
          {hasSessions && <option value="sessions">Sessions</option>}
        </select>
      </label>
    </div>
  )

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Tutor Management</h1>
            <p className="text-[13px] text-muted">Review and manage tutors across the LearnSyra platform.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFiltersOpen(true)}>Filters</button>
            <button type="button" className="btn-primary text-xs" onClick={() => navigate('/admin/verification')}>Review Verification →</button>
            <button type="button" className="btn-glass text-xs" onClick={() => setExportOpen(true)}>Export Tutors</button>
          </div>
        </div>

        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {hasDemo && (
          <div className="glass rounded-2xl p-3 mb-4 text-sm ac-warn">Demo Tutor Data — Not Production Data. Demo records are excluded from verification, ratings, and financial metrics.</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          {[
            ['Total Tutors', loading ? null : String(stats.total)],
            ['Published', loading ? null : String(stats.published)],
            ['Draft', loading ? null : String(stats.draft)],
            ['Paused', loading ? null : String(stats.paused)],
            ['Pending Review', loading ? null : String(stats.pendingReview)],
            ['Verified', loading ? null : 'Data unavailable'],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink" style={String(v).length > 8 ? { fontSize: '1rem' } : undefined}>{v}</strong>}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Tutor status">
          {tabs.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <label className="sr-only" htmlFor="tutor-search">Search tutors</label>
          <input id="tutor-search" className="field flex-1 min-w-[12rem] px-3 py-1.5 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search tutors..." />
          {q && <button type="button" className="btn-glass text-xs" onClick={() => setQ('')}>Clear Search</button>}
        </div>
        <div className="hidden lg:block mb-3">{filters}</div>

        {loading && (
          <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading tutors">
            <div className="ac-skel h-12" />
            <div className="ac-skel h-12" />
            <div className="ac-skel h-12" />
          </div>
        )}
        {!loading && pager.total === 0 && !error && <p className="text-[13px] text-muted mb-3">{emptyCopy()}</p>}

        {!loading && pager.total > 0 && (
          <div className="ac-desktop-table glass rounded-2xl ac-table mb-3">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-muted">
                  <th className="px-3 py-2">Tutor</th>
                  <th className="px-3 py-2">Expertise</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Verification</th>
                  <th className="px-3 py-2">Courses</th>
                  {hasStudents && <th className="px-3 py-2">Students</th>}
                  {hasSessions && <th className="px-3 py-2">Sessions</th>}
                  {hasRating && <th className="px-3 py-2">Rating</th>}
                  <th className="px-3 py-2">Marketplace</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                    <td className="px-3 py-2"><TutorId tutor={t} /></td>
                    <td className="px-3 py-2 text-muted">{t.expertise.slice(0, 2).join(', ') || '—'}</td>
                    <td className="px-3 py-2">{t.accountStatus === 'suspended' ? 'Suspended' : 'Active'}</td>
                    <td className="px-3 py-2 text-muted">Not Available</td>
                    <td className="px-3 py-2">{t.courseCount}</td>
                    {hasStudents && <td className="px-3 py-2">{t.studentCount}</td>}
                    {hasSessions && <td className="px-3 py-2">{t.sessionCount}</td>}
                    {hasRating && <td className="px-3 py-2">{t.rating == null ? '—' : t.rating.toFixed(1)}</td>}
                    <td className="px-3 py-2">{marketLabel(t.market)}</td>
                    <td className="px-3 py-2 relative">
                      <button type="button" className="btn-glass text-xs mr-1" onClick={() => navigate(`/admin/tutors/${t.id}`)}>View</button>
                      <button type="button" className="btn-glass text-xs" aria-haspopup="menu" aria-expanded={menuId === t.id} onClick={() => setMenuId(menuId === t.id ? null : t.id)}>More</button>
                      {menuId === t.id && (
                        <div role="menu" className="glass rounded-xl p-1.5 mt-1 absolute z-10 right-2">
                          <button type="button" role="menuitem" className="block w-full text-left text-xs px-2 py-1" style={{ background: 'none', border: 'none' }} onClick={() => { setMenuId(null); navigate(`/admin/tutors/${t.id}`) }}>Open tutor</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="ac-mobile-cards space-y-2 mb-3">
            {pager.slice.map(t => (
              <article key={t.id} className="glass rounded-2xl p-3">
                <TutorId tutor={t} />
                <div className="flex flex-wrap gap-1.5 mt-2 text-[11px] text-muted">
                  <span>{t.accountStatus === 'suspended' ? 'Suspended' : 'Active'}</span>
                  <span>Verification: Not Available</span>
                  <span>{marketLabel(t.market)}</span>
                </div>
                {t.expertise.length > 0 && <p className="text-[11px] text-muted mt-1">{t.expertise.slice(0, 3).join(' · ')}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted">
                  <span>Courses {t.courseCount}</span>
                  <span>Students {t.studentCount}</span>
                  <span>Sessions {t.sessionCount}</span>
                  <span>Rating {t.rating == null ? '—' : t.rating.toFixed(1)}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" className="btn-primary text-xs" onClick={() => navigate(`/admin/tutors/${t.id}`)}>View</button>
                  <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/tutors/${t.id}`)}>More</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {pager.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <p className="text-muted">Showing {pager.from}–{pager.to} of {pager.total}</p>
            <div className="flex gap-2">
              <button type="button" className="btn-glass text-xs" disabled={pager.page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span className="text-xs py-2">Page {pager.page} of {pager.pages}</span>
              <button type="button" className="btn-glass text-xs" disabled={pager.page >= pager.pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted mt-2">Page size {tutorsPageSize()}.</p>
      </div>

      {filtersOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="glass w-80 max-w-[90vw] h-full p-5 overflow-y-auto">
            <h2 className="text-lg font-black text-ink mb-3">Filters</h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setFiltersOpen(false)}>Apply</button>
          </div>
          <button type="button" className="flex-1" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setFiltersOpen(false)} />
        </div>
      )}
      {exportOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="export-tutors">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExportOpen(false)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="export-tutors" className="text-lg font-black text-ink mb-2">Export Tutors</h2>
            <p className="text-sm text-muted mb-4">Export will be available when reporting is connected.</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setExportOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function TutorId({ tutor }: { tutor: AdminTutorRow }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[10px] text-white font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}>
        {tutor.avatarUrl ? <img src={tutor.avatarUrl} alt="" className="w-full h-full object-cover" /> : displayInitials(tutor.name)}
      </div>
      <div className="min-w-0">
        <div className="font-semibold truncate">{tutor.name}{tutor.demo ? ' · Demo' : ''}</div>
        <div className="text-[11px] text-muted truncate">{tutor.headline || 'No headline'}</div>
      </div>
    </div>
  )
}
