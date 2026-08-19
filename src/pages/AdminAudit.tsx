import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  auditPageSize,
  auditStats,
  filterAudit,
  formatWhen,
  isAuditExportAvailable,
  isAuditRealtimeAvailable,
  loadAdminAuditIndex,
  paginate,
  uniqueAuditActors,
  uniqueAuditValues,
  type AdminAuditEvent,
  type AdminAuditIndex,
  type AuditDateFilter,
  type AuditQuery,
  type AuditSort,
} from '../lib/adminAudit'
import './admin-control.css'

export default function AdminAudit() {
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminAuditIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [entity, setEntity] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState<AuditDateFilter>('any')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sort, setSort] = useState<AuditSort>('newest')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminAuditIndex()
      .then(setIndex)
      .catch(() => setError("Audit logs couldn't be loaded right now."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [q, actor, action, entity, status, date, customFrom, customTo, sort])
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  const available = index?.available ?? false
  const rows = index?.rows ?? []
  const query: AuditQuery = useMemo(() => ({ q, actor, action, entity, status, date, customFrom, customTo, sort }), [q, actor, action, entity, status, date, customFrom, customTo, sort])
  const filtered = useMemo(() => (available ? filterAudit(rows, query) : []), [available, rows, query])
  const pager = paginate(filtered, page)
  const stats = index ? auditStats(index) : null
  const actors = uniqueAuditActors(rows)
  const actions = uniqueAuditValues(rows, 'action')
  const entities = uniqueAuditValues(rows, 'entityType')
  const statuses = uniqueAuditValues(rows, 'status')
  const hasTimestamps = rows.some(r => r.createdAt)
  const hasDemo = rows.some(r => r.demo)

  const filters = available && (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {hasTimestamps && (
        <label className="text-[11px] font-semibold text-muted">
          Date
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={date} onChange={e => setDate(e.target.value as AuditDateFilter)}>
            <option value="any">All dates</option>
            <option value="today">Today</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="3m">3 Months</option>
            <option value="6m">6 Months</option>
            <option value="1y">1 Year</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      )}
      {hasTimestamps && date === 'custom' && (
        <>
          <label className="text-[11px] font-semibold text-muted">From<input type="date" className="field mt-1 w-full px-2 py-1.5 text-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label>
          <label className="text-[11px] font-semibold text-muted">To<input type="date" className="field mt-1 w-full px-2 py-1.5 text-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label>
        </>
      )}
      {actors.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Actor
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={actor} onChange={e => setActor(e.target.value)}>
            <option value="">All</option>
            {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}
      {actions.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Action
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={action} onChange={e => setAction(e.target.value)}>
            <option value="">All</option>
            {actions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {entities.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Entity
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={entity} onChange={e => setEntity(e.target.value)}>
            <option value="">All</option>
            {entities.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {statuses.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Status
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All</option>
            {statuses.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {(hasTimestamps || actions.length > 0 || actors.length > 0 || entities.length > 0) && (
        <label className="text-[11px] font-semibold text-muted">
          Sort
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={sort} onChange={e => setSort(e.target.value as AuditSort)}>
            {hasTimestamps && <option value="newest">Newest</option>}
            {hasTimestamps && <option value="oldest">Oldest</option>}
            {actions.length > 0 && <option value="action">Action</option>}
            {actors.length > 0 && <option value="actor">Actor</option>}
            {entities.length > 0 && <option value="entity">Entity</option>}
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
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Audit Logs</h1>
            <p className="text-[13px] text-muted">Track administrative actions and platform activity.</p>
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
        {hasDemo && <div className="glass rounded-2xl p-3 mb-4 text-sm ac-warn">Demo Audit Data — Not Production Activity. Demo records are excluded from counts.</div>}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          {[
            ['Total Events', loading ? null : stats?.total],
            ['Today', loading ? null : stats?.today],
            ['Admin Actions', loading ? null : stats?.admin],
            ['User Actions', loading ? null : stats?.user],
            ['Security Events', loading ? null : stats?.security],
            ['Failed Actions', loading ? null : stats?.failed],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink">{v}</strong>}
            </div>
          ))}
        </div>

        {loading && <div className="ac-skel h-20 mb-3" aria-busy="true" aria-label="Loading audit logs" />}

        {!loading && !available && (
          <section className="glass rounded-2xl p-5 mb-4 text-center">
            <h2 className="font-black text-ink">Audit infrastructure unavailable</h2>
            <p className="text-[13px] text-muted max-w-xl mx-auto">Administrative activity logs will appear here when audit persistence is connected.</p>
            <p className="text-[12px] text-muted mt-2">No persisted audit events are available from the current backend.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              <button type="button" className="btn-primary text-xs" onClick={load}>Refresh</button>
              <button type="button" className="btn-glass text-xs" onClick={() => navigate('/admin/settings')}>Platform Settings →</button>
            </div>
            <p className="text-[11px] text-muted mt-3">Current users, courses, payments, reports, and settings screens are not converted into audit history.</p>
          </section>
        )}

        {available && (
          <>
            {!hasTimestamps && <p className="text-[12px] text-muted mb-2">Date filtering unavailable.</p>}
            <div className="flex flex-wrap gap-2 mb-3">
              <label className="sr-only" htmlFor="audit-search">Search audit logs</label>
              <input id="audit-search" className="field flex-1 min-w-[12rem] px-3 py-1.5 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search audit logs..." />
              {q && <button type="button" className="btn-glass text-xs" onClick={() => setQ('')}>Clear Search</button>}
            </div>
            <div className="hidden lg:block mb-3">{filters}</div>
            {!loading && pager.total === 0 && <p className="text-[13px] text-muted mb-3">{q.trim() ? 'No audit events match your search.' : 'No audit activity yet. Audit events will appear here when administrative activity is recorded.'}</p>}
            {pager.total > 0 && (
              <div className="ac-desktop-table glass rounded-2xl ac-table mb-3">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] text-muted">
                      <th className="px-3 py-2">Date/Time</th>
                      <th className="px-3 py-2">Actor</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Entity</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Event ID</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.slice.map((r: AdminAuditEvent) => (
                      <tr key={r.id} style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                        <td className="px-3 py-2">{r.createdAt ? formatWhen(r.createdAt) : '—'}</td>
                        <td className="px-3 py-2">{r.actorName || 'Actor unavailable'}</td>
                        <td className="px-3 py-2 font-semibold">{r.action || '—'}</td>
                        <td className="px-3 py-2">{r.entityName || r.entityType || r.entityId || '—'}</td>
                        <td className="px-3 py-2">{r.status || '—'}</td>
                        <td className="px-3 py-2 break-all">{r.id}</td>
                        <td className="px-3 py-2">
                          <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/audit/${r.id}`)}>View →</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="ac-mobile-cards space-y-2 mb-3">
              {pager.slice.map((r: AdminAuditEvent) => (
                <article key={r.id} className="glass rounded-2xl p-3">
                  <div className="font-semibold text-ink">{r.action || 'Event'}</div>
                  <p className="text-[12px] text-muted">{r.actorName || 'Actor unavailable'} · {r.entityName || r.entityType || '—'}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted">
                    <span>{r.createdAt ? formatWhen(r.createdAt) : '—'}</span>
                    <span>{r.status || '—'}</span>
                  </div>
                  <button type="button" className="btn-primary text-xs mt-2" onClick={() => navigate(`/admin/audit/${r.id}`)}>View →</button>
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
            <p className="text-[11px] text-muted mt-2">
              Page size {auditPageSize()}. Audit events are read-only.
              {isAuditRealtimeAvailable() ? ' Live updates are connected.' : ' Refresh reloads persisted records. Real-time updates are not connected.'}
              {' '}{isAuditExportAvailable() ? '' : 'Audit export will be available when reporting is connected.'}
            </p>
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
