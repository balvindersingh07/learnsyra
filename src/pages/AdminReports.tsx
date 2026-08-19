import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  filterReports,
  formatWhen,
  loadAdminReportIndex,
  paginate,
  reportStats,
  reportsPageSize,
  uniqueReportEntities,
  uniqueReportValues,
  type AdminReportIndex,
  type AdminReportRow,
  type ReportDateFilter,
  type ReportQuery,
  type ReportSort,
  type ReportTab,
} from '../lib/adminReports'
import './admin-control.css'

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'all', label: 'All' },
  { id: 'investigating', label: 'Investigating' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
]

export default function AdminReports() {
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminReportIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ReportTab>('open')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [entity, setEntity] = useState('')
  const [date, setDate] = useState<ReportDateFilter>('any')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sort, setSort] = useState<ReportSort>('newest')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminReportIndex()
      .then(setIndex)
      .catch(() => setError("Reports couldn't be loaded right now."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [tab, q, status, priority, type, entity, date, customFrom, customTo, sort])
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  const available = index?.available ?? false
  const rows = index?.rows ?? []
  const query: ReportQuery = useMemo(() => ({ tab, q, status, priority, type, entity, date, customFrom, customTo, sort }), [tab, q, status, priority, type, entity, date, customFrom, customTo, sort])
  const filtered = useMemo(() => (available ? filterReports(rows, query) : []), [available, rows, query])
  const pager = paginate(filtered, page)
  const stats = index ? reportStats(index) : null
  const statuses = uniqueReportValues(rows, 'status')
  const priorities = uniqueReportValues(rows, 'priority')
  const types = uniqueReportValues(rows, 'type')
  const entities = uniqueReportEntities(rows)
  const hasTimestamps = rows.some(r => r.createdAt)
  const hasDemo = rows.some(r => r.demo)

  const filters = available && (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {statuses.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Status
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All</option>
            {statuses.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {priorities.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Priority
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="">All</option>
            {priorities.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {types.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Type
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={type} onChange={e => setType(e.target.value)}>
            <option value="">All</option>
            {types.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {entities.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Reported Entity
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={entity} onChange={e => setEntity(e.target.value)}>
            <option value="">All</option>
            {entities.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
      )}
      {hasTimestamps && (
        <label className="text-[11px] font-semibold text-muted">
          Date
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={date} onChange={e => setDate(e.target.value as ReportDateFilter)}>
            <option value="any">All dates</option>
            <option value="today">Today</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="3m">3 months</option>
            <option value="6m">6 months</option>
            <option value="1y">1 year</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      )}
      {hasTimestamps && date === 'custom' && (
        <>
          <label className="text-[11px] font-semibold text-muted">
            From
            <input type="date" className="field mt-1 w-full px-2 py-1.5 text-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
          </label>
          <label className="text-[11px] font-semibold text-muted">
            To
            <input type="date" className="field mt-1 w-full px-2 py-1.5 text-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
          </label>
        </>
      )}
      {(hasTimestamps || priorities.length > 0 || statuses.length > 0) && (
        <label className="text-[11px] font-semibold text-muted">
          Sort
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={sort} onChange={e => setSort(e.target.value as ReportSort)}>
            {hasTimestamps && <option value="newest">Newest</option>}
            {hasTimestamps && <option value="oldest">Oldest</option>}
            {priorities.length > 0 && <option value="priority">Priority</option>}
            {statuses.length > 0 && <option value="status">Status</option>}
          </select>
        </label>
      )}
    </div>
  )

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Reports & Moderation</h1>
            <p className="text-[13px] text-muted">Review reported platform issues and moderation activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {available && <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFiltersOpen(true)}>Filters</button>}
            <button type="button" className="btn-glass text-xs" onClick={load}>Refresh</button>
          </div>
        </div>

        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {hasDemo && (
          <div className="glass rounded-2xl p-3 mb-4 text-sm ac-warn">Demo Report Data — Not Production Data. Demo records are excluded from counts.</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          {[
            ['Total Reports', loading ? null : stats?.total],
            ['Open', loading ? null : stats?.open],
            ['Investigating', loading ? null : stats?.investigating],
            ['Resolved', loading ? null : stats?.resolved],
            ['Dismissed', loading ? null : stats?.dismissed],
            ['High Priority', loading ? null : stats?.high],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink">{v}</strong>}
            </div>
          ))}
        </div>

        {loading && (
          <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading reports">
            <div className="ac-skel h-20" />
          </div>
        )}

        {!loading && !available && (
          <section className="glass rounded-2xl p-5 mb-4 text-center">
            <div className="text-3xl mb-2" aria-hidden>🛡️</div>
            <h2 className="font-black text-ink">Reporting infrastructure unavailable</h2>
            <p className="text-[13px] text-muted max-w-xl mx-auto">Reports will appear here when LearnSyra's reporting system is connected.</p>
            <p className="text-[12px] text-muted mt-2">No report records are available from the current platform backend.</p>
            <button type="button" className="btn-primary text-xs mt-3" onClick={load}>Refresh</button>
            <p className="text-[11px] text-muted mt-3">Reviews, ratings, and tutor notes are not treated as reports.</p>
          </section>
        )}

        {available && (
          <>
            <div className="flex flex-nowrap gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Report status">
              {TABS.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <label className="sr-only" htmlFor="report-search">Search reports</label>
              <input id="report-search" className="field flex-1 min-w-[12rem] px-3 py-1.5 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search reports..." />
              {q && <button type="button" className="btn-glass text-xs" onClick={() => setQ('')}>Clear Search</button>}
            </div>
            <div className="hidden lg:block mb-3">{filters}</div>
            {!loading && pager.total === 0 && <p className="text-[13px] text-muted mb-3">{q.trim() ? 'No reports match your search.' : 'No reports yet.'}</p>}
            {pager.total > 0 && (
              <div className="ac-desktop-table glass rounded-2xl ac-table mb-3">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] text-muted">
                      <th className="px-3 py-2">Report</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Reported Entity</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.slice.map((r: AdminReportRow) => (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                        <td className="px-3 py-2 font-semibold">{r.id}{r.demo ? ' · Demo' : ''}</td>
                        <td className="px-3 py-2">{r.type || '—'}</td>
                        <td className="px-3 py-2">{r.entityName || r.entityId || '—'}</td>
                        <td className="px-3 py-2">{r.reason || '—'}</td>
                        <td className="px-3 py-2">{r.priority || '—'}</td>
                        <td className="px-3 py-2">{r.status || '—'}</td>
                        <td className="px-3 py-2">{r.createdAt ? formatWhen(r.createdAt) : '—'}</td>
                        <td className="px-3 py-2">
                          <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/reports/${r.id}`)}>Review →</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="ac-mobile-cards space-y-2 mb-3">
              {pager.slice.map((r: AdminReportRow) => (
                <article key={r.id} className="glass rounded-2xl p-3">
                  <div className="font-semibold text-ink">{r.id}</div>
                  <p className="text-[12px] text-muted">{r.type || '—'} · {r.entityName || r.entityId || '—'} · {r.reason || '—'}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted">
                    <span>Priority {r.priority || '—'}</span>
                    <span>{r.status || '—'}</span>
                    <span>{r.createdAt ? formatWhen(r.createdAt) : '—'}</span>
                  </div>
                  <button type="button" className="btn-primary text-xs mt-2" onClick={() => navigate(`/admin/reports/${r.id}`)}>Review →</button>
                </article>
              ))}
            </div>
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
            <p className="text-[11px] text-muted mt-2">Page size {reportsPageSize()}. Moderation actions stay disabled until a reporting backend can persist them.</p>
          </>
        )}
      </div>

      {filtersOpen && available && (
        <div className="ac-drawer fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="glass w-80 max-w-[90vw] h-full p-5 overflow-y-auto">
            <h2 className="text-lg font-black text-ink mb-3">Filters</h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setFiltersOpen(false)}>Apply</button>
          </div>
          <button type="button" className="flex-1" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setFiltersOpen(false)} />
        </div>
      )}
    </AdminShell>
  )
}
