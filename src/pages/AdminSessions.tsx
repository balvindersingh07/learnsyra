import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  bookingStatusLabel,
  filterSessions,
  hasDuration,
  liveStateLabel,
  loadAdminSessionIndex,
  paginate,
  sessionStats,
  sessionsPageSize,
  uniqueSessionCourses,
  uniqueSessionStudents,
  uniqueSessionTutors,
  whenLabel,
  type AdminSessionIndex,
  type AdminSessionRow,
  type BookingStatusFilter,
  type DateFilter,
  type SessionKindFilter,
  type SessionQuery,
  type SessionSort,
  type SessionTab,
} from '../lib/adminSessions'
import './admin-control.css'

const TABS: { id: SessionTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'live', label: 'Live' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'attention', label: 'Needs Attention' },
]

export default function AdminSessions() {
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminSessionIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<SessionTab>('all')
  const [q, setQ] = useState('')
  const [date, setDate] = useState<DateFilter>('any')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [status, setStatus] = useState<BookingStatusFilter>('all')
  const [tutorId, setTutorId] = useState('')
  const [kind, setKind] = useState<SessionKindFilter>('all')
  const [courseId, setCourseId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [sort, setSort] = useState<SessionSort>('recommended')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminSessionIndex()
      .then(setIndex)
      .catch(() => setError("Sessions couldn't be loaded right now."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [tab, q, date, customFrom, customTo, status, tutorId, kind, courseId, studentId, sort])
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  const rows = index?.rows ?? []
  const query: SessionQuery = useMemo(() => ({
    tab, q, date, customFrom, customTo, status, tutorId, kind, courseId, studentId, sort,
  }), [tab, q, date, customFrom, customTo, status, tutorId, kind, courseId, studentId, sort])
  const filtered = useMemo(
    () => filterSessions(rows, query, { bookingsAvailable: index?.bookingsAvailable ?? false, liveAvailable: index?.liveAvailable ?? false }),
    [rows, query, index],
  )
  const pager = paginate(filtered, page)
  const stats = index ? sessionStats(index) : null
  const tutors = uniqueSessionTutors(rows)
  const students = uniqueSessionStudents(rows)
  const courses = uniqueSessionCourses(rows)
  const durationSort = hasDuration(rows)
  const hasDemo = rows.some(r => r.demo)
  const liveUnavailable = tab === 'live' && index && !index.liveAvailable
  const upcomingUnavailable = tab === 'upcoming' && index && !index.liveAvailable
  const cancelledUnavailable = tab === 'cancelled' && index && !index.bookingsAvailable
  const attentionUnavailable = tab === 'attention' && index && !index.bookingsAvailable

  const emptyCopy = () => {
    if (liveUnavailable) return 'Live session status unavailable.'
    if (upcomingUnavailable) return 'Upcoming live class times are unavailable. Booking records do not include a session start time.'
    if (cancelledUnavailable) return 'Cancelled booking status is unavailable.'
    if (attentionUnavailable) return 'Needs Attention is unavailable because booking records could not be loaded.'
    if (tab === 'live') return 'No live sessions right now.'
    if (tab === 'upcoming') return 'No upcoming live classes.'
    if (tab === 'completed') return 'No completed sessions yet.'
    if (tab === 'cancelled') return 'No cancelled bookings.'
    if (tab === 'attention') return 'Nothing needs attention.'
    if (q.trim()) return 'No sessions match your search.'
    return 'No session data yet.'
  }

  const filters = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      <label className="text-[11px] font-semibold text-muted">
        Date
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={date} onChange={e => setDate(e.target.value as DateFilter)}>
          <option value="any">All dates</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="week">This week</option>
          <option value="next7">Next 7 days</option>
          <option value="past7">Past 7 days</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {index?.bookingsAvailable && (
        <label className="text-[11px] font-semibold text-muted">
          Status
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={status} onChange={e => setStatus(e.target.value as BookingStatusFilter)}>
            <option value="all">All</option>
            <option value="pending">Booked</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      )}
      {tutors.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Tutor
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={tutorId} onChange={e => setTutorId(e.target.value)}>
            <option value="">All</option>
            {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
      <label className="text-[11px] font-semibold text-muted">
        Session type
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={kind} onChange={e => setKind(e.target.value as SessionKindFilter)}>
          <option value="all">All</option>
          <option value="booking">Tutor booking</option>
          <option value="live-class">Live class</option>
        </select>
      </label>
      {courses.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Course
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={courseId} onChange={e => setCourseId(e.target.value)}>
            <option value="">All</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      )}
      {students.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Student
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">All</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      <label className="text-[11px] font-semibold text-muted">
        Sort
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={sort} onChange={e => setSort(e.target.value as SessionSort)}>
          <option value="recommended">Recommended</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="soonest">Soonest</option>
          <option value="latest">Latest</option>
          {durationSort && <option value="longest">Longest</option>}
          {durationSort && <option value="shortest">Shortest</option>}
        </select>
      </label>
    </div>
  )

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Session Management</h1>
            <p className="text-[13px] text-muted">Monitor tutoring sessions, bookings, attendance, and session outcomes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFiltersOpen(true)}>Filters</button>
            <button type="button" className="btn-glass text-xs" onClick={() => setDate('today')}>Today</button>
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
          <div className="glass rounded-2xl p-3 mb-4 text-sm ac-warn">Demo Session — Not a Real Booking. Demo records are excluded from counts.</div>
        )}
        <p className="text-[11px] text-muted mb-3">Date filters use live class start times when present, otherwise booking created time. Bookings do not store a session start.</p>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          {[
            ['Total Sessions', loading ? null : stats?.total],
            ['Upcoming', loading ? null : stats?.upcoming],
            ['Live Now', loading ? null : stats?.liveNow],
            ['Completed', loading ? null : stats?.completed],
            ['Cancelled', loading ? null : stats?.cancelled],
            ['Needs Attention', loading ? null : stats?.needsAttention],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink">{v}</strong>}
            </div>
          ))}
        </div>

        <div className="flex flex-nowrap gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Session status">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <label className="sr-only" htmlFor="session-search">Search sessions</label>
          <input id="session-search" className="field flex-1 min-w-[12rem] px-3 py-1.5 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search sessions..." />
          {q && <button type="button" className="btn-glass text-xs" onClick={() => setQ('')}>Clear Search</button>}
        </div>
        {date === 'custom' && (
          <div className="flex flex-wrap gap-2 mb-3">
            <label className="text-[11px] font-semibold text-muted">From<input type="date" className="field ml-2 px-2 py-1.5 text-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label>
            <label className="text-[11px] font-semibold text-muted">To<input type="date" className="field ml-2 px-2 py-1.5 text-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label>
          </div>
        )}
        <div className="hidden lg:block mb-3">{filters}</div>

        {loading && (
          <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading sessions">
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
                  <th className="px-3 py-2">Date/Time</th>
                  <th className="px-3 py-2">Session</th>
                  <th className="px-3 py-2">Tutor</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Rating</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((s: AdminSessionRow) => (
                  <tr key={s.routeId} style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                    <td className="px-3 py-2">{whenLabel(s)}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{s.title}{s.demo ? ' · Demo' : ''}</div>
                      <div className="text-[11px] text-muted">{s.sourceId}</div>
                    </td>
                    <td className="px-3 py-2">{s.tutorName}</td>
                    <td className="px-3 py-2">{s.studentName || '—'}</td>
                    <td className="px-3 py-2">{s.typeLabel}</td>
                    <td className="px-3 py-2">{s.kind === 'live-class' ? liveStateLabel(s.liveStatus) : bookingStatusLabel(s.bookingStatus)}</td>
                    <td className="px-3 py-2">{s.durationMin != null ? `${s.durationMin} min` : '—'}</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">
                      <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/sessions/${s.routeId}`)}>View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="ac-mobile-cards space-y-2 mb-3">
            {pager.slice.map((s: AdminSessionRow) => (
              <article key={s.routeId} className="glass rounded-2xl p-3">
                <div className="font-semibold text-ink">{whenLabel(s)}</div>
                <p className="text-[12px] text-muted">{s.typeLabel} · {s.tutorName} · {s.studentName || '—'} · {s.kind === 'live-class' ? liveStateLabel(s.liveStatus) : bookingStatusLabel(s.bookingStatus)}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted">
                  <span>Duration {s.durationMin != null ? `${s.durationMin} min` : '—'}</span>
                  <span>Rating —</span>
                </div>
                <button type="button" className="btn-primary text-xs mt-2" onClick={() => navigate(`/admin/sessions/${s.routeId}`)}>View →</button>
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
        <p className="text-[11px] text-muted mt-2">Page size {sessionsPageSize()}. Tutors continue to run sessions from their own workspace.</p>
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
    </AdminShell>
  )
}
