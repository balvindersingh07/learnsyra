import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SessionCard from '../components/tutor-sessions/SessionCard'
import { useAuth } from '../context/AuthContext'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import { getTutorLiveClasses, getTutorReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents } from '../lib/api'
import { formatClock } from '../lib/liveSession'
import { tutorSessionPath, tutorStudentPath } from '../lib/paths'
import { loadTutorHub, selfTutorId } from '../lib/tutorProfile'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import { buildTutorRoster, type TutorStudent } from '../lib/tutorStudents'
import {
  SESSION_PAGE_SIZE,
  buildTutorSessions,
  formatTime,
  formatWhen,
  isToday,
  liveElapsed,
  loadSessionExtras,
  matchesFilters,
  matchesQuery,
  needsFollowUp,
  preparePrompt,
  previousSession,
  sessionStats,
  sortSessions,
  type DateFilter,
  type SessionKind,
  type SortKey,
  type StatusFilter,
  type TutorSessionView,
} from '../lib/tutorSessions'
import './tutor-sessions.css'

const KINDS: Array<SessionKind | 'all'> = ['all', '1on1', 'project', 'interview', 'career', 'group']
const STATUSES: StatusFilter[] = ['all', 'upcoming', 'today', 'in_progress', 'completed', 'cancelled', 'followup']
const DATES: DateFilter[] = ['all', 'today', 'tomorrow', 'week', 'next', 'custom']
const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'booked', label: 'Recently Booked' },
  { id: 'prep', label: 'Needs Preparation' },
  { id: 'followup', label: 'Needs Follow-up' },
  { id: 'completed', label: 'Recently Completed' },
]

function kindName(k: SessionKind | 'all') {
  if (k === 'all') return 'All'
  if (k === '1on1') return '1-on-1'
  if (k === 'project') return 'Project Help'
  if (k === 'interview') return 'Interview Prep'
  if (k === 'career') return 'Career Guidance'
  return 'Group'
}

function statusName(s: StatusFilter) {
  if (s === 'all') return 'All'
  if (s === 'today') return 'Today'
  if (s === 'in_progress') return 'In Progress'
  if (s === 'completed') return 'Completed'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'followup') return 'Needs Follow-up'
  return 'Upcoming'
}

function dateName(d: DateFilter) {
  if (d === 'all') return 'All'
  if (d === 'today') return 'Today'
  if (d === 'tomorrow') return 'Tomorrow'
  if (d === 'week') return 'This Week'
  if (d === 'next') return 'Next Week'
  return 'Custom'
}

export default function TutorSessions() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || null
  const scopedId = tutorId || ''
  const publicId = tutorId ? (loadTutorHub(tutorId)?.publicId || selfTutorId(tutorId)) : ''
  const [rows, setRows] = useState<TutorSessionView[]>([])
  const [roster, setRoster] = useState<TutorStudent[]>([])
  const [source, setSource] = useState<'live' | 'demo'>('live')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<SessionKind | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [date, setDate] = useState<DateFilter>('all')
  const [custom, setCustom] = useState('')
  const [student, setStudent] = useState('')
  const [sort, setSort] = useState<SortKey>('upcoming')
  const [page, setPage] = useState(1)
  const [histSort, setHistSort] = useState<'newest' | 'oldest' | 'rating'>('newest')
  const [histKind, setHistKind] = useState<SessionKind | 'all'>('all')
  const [histStudent, setHistStudent] = useState('')
  const [drawer, setDrawer] = useState(false)
  const [calMode, setCalMode] = useState<'week' | 'day'>('week')
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = window.setInterval(() => setTick(n => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!tutorId) return
    let alive = true
    Promise.all([getTutorStudents(), getTutorBookings(), getTutorReviewQueue(), getTutorCourses(), getTutorLiveClasses()])
      .then(([enrollments, bookings, reviews, apiCourses, liveClasses]) => {
        if (!alive) return
        const rosterBuilt = buildTutorRoster({ enrollments, bookings, reviews, localBookings: loadTutorBookings(), apiCourses })
        setRoster(rosterBuilt.students)
        const built = buildTutorSessions({
          local: loadTutorBookings(),
          api: bookings,
          liveClasses,
          roster: rosterBuilt.students,
          tutorUserId: tutorId,
          tutorPublicId: publicId,
        })
        setRows(built.sessions)
        setSource(built.source)
      })
      .catch(() => {
        if (!alive) return
        const rosterBuilt = buildTutorRoster({ enrollments: [], bookings: [], reviews: [], localBookings: [], apiCourses: [] })
        setRoster(rosterBuilt.students)
        const built = buildTutorSessions({
          local: loadTutorBookings(),
          api: [],
          liveClasses: [],
          roster: rosterBuilt.students,
          tutorUserId: tutorId,
          tutorPublicId: publicId,
        })
        setRows(built.sessions)
        setSource(built.source)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [tutorId, publicId, profile?.id])

  const filtered = useMemo(() => {
    const list = rows.filter(s => matchesQuery(s, query) && matchesFilters(s, { kind, status, date, custom, student, tutorId: scopedId }))
    return sortSessions(list, sort, scopedId)
  }, [rows, query, kind, status, date, custom, student, sort, scopedId])

  useEffect(() => {
    setPage(1)
  }, [query, kind, status, date, custom, student, sort, histSort, histKind, histStudent])

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  const stats = sessionStats(rows, scopedId)
  const today = rows.filter(s => isToday(s.scheduledAt) && s.status !== 'cancelled').sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
  const liveNow = rows.filter(s => s.status === 'in_progress')
  const upcoming = rows.filter(s => +new Date(s.scheduledAt) >= Date.now() && s.status !== 'completed' && s.status !== 'cancelled' && !isToday(s.scheduledAt))
  const follow = rows.filter(s => needsFollowUp(s, loadSessionExtras(scopedId, s.id)))
  const history = sortSessions(rows.filter(s => s.status === 'completed'), 'completed', scopedId)
    .filter(s => (histKind === 'all' || s.kind === histKind) && (!histStudent || s.studentName.toLowerCase().includes(histStudent.toLowerCase())))
    .sort((a, b) => {
      if (histSort === 'oldest') return +new Date(a.scheduledAt) - +new Date(b.scheduledAt)
      if (histSort === 'rating') return (b.rating ?? -1) - (a.rating ?? -1)
      return +new Date(b.scheduledAt) - +new Date(a.scheduledAt)
    })
  const histPages = Math.max(1, Math.ceil(history.length / SESSION_PAGE_SIZE))
  const histSlice = history.slice((page - 1) * SESSION_PAGE_SIZE, page * SESSION_PAGE_SIZE)

  const prepare = (s: TutorSessionView) => {
    const student = roster.find(r => r.id === s.studentId)
    const prev = previousSession(rows, s)
    setPendingAiPrompt(preparePrompt(s, student, prev))
    navigate('/tutor/ai')
  }

  const weekStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
    return d
  }, [])
  const calDays = calMode === 'day' ? [new Date()] : Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const filters = (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Session type</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(k => (
            <button key={k} type="button" className="tx-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={kind === k} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {kindName(k)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Status</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button key={s} type="button" className="tx-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={status === s} aria-pressed={status === s} onClick={() => setStatus(s)}>
              {statusName(s)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Date</legend>
        <div className="flex flex-wrap gap-2">
          {DATES.map(d => (
            <button key={d} type="button" className="tx-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={date === d} aria-pressed={date === d} onClick={() => setDate(d)}>
              {dateName(d)}
            </button>
          ))}
        </div>
        {date === 'custom' && (
          <label className="block text-xs font-semibold text-muted mt-2">
            Custom date
            <input type="date" className="field w-full mt-1 px-3 py-2 text-sm" value={custom} onChange={e => setCustom(e.target.value)} />
          </label>
        )}
      </fieldset>
      <label className="block text-xs font-semibold text-muted">
        Student
        <input className="field w-full mt-1 px-3 py-2 text-sm" value={student} onChange={e => setStudent(e.target.value)} placeholder="Search by student name" />
      </label>
    </div>
  )

  return (
    <div className="tx-page pt-20 px-4 sm:px-6 pb-16 max-w-7xl mx-auto overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            Sessions
          </h1>
          <p className="text-muted">Manage your upcoming sessions, prepare with context, and help students keep moving forward.</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => document.getElementById('calendar')?.scrollIntoView({ behavior: 'smooth' })}>
          View Calendar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Today', value: stats.today },
          { label: 'Upcoming', value: stats.upcoming },
          { label: 'Completed', value: stats.completed },
          { label: 'Needs Follow-up', value: stats.followup },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {loading ? '—' : s.value}
            </div>
          </div>
        ))}
      </div>

      {!loading && rows.length === 0 && (
        <div className="glass rounded-2xl p-8 mb-5">
          <h2 className="text-xl font-black text-ink mb-2">No sessions yet</h2>
          <p className="text-sm text-muted">Your real bookings and sessions will appear here.</p>
        </div>
      )}

      {liveNow.map(s => {
        const elapsed = liveElapsed(s.id) ?? 0
        void tick
        return (
          <section key={s.id} className="tx-live glass rounded-3xl p-5 mb-6">
            <h2 className="text-lg font-black text-ink mb-1">🔴 Live Now</h2>
            <div className="font-semibold text-ink">{s.topic}</div>
            <div className="text-sm text-muted">{s.studentName} · Started {formatTime(s.scheduledAt)}</div>
            <div className="text-2xl font-black text-ink my-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {formatClock(elapsed)}
            </div>
            <button type="button" className="btn-primary text-sm" onClick={() => navigate(s.kind === 'group' ? s.joinHref : `${s.joinHref}&join=1`)}>
              Join Session →
            </button>
          </section>
        )
      })}

      <section className="mb-8">
        <h2 className="text-2xl font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Today&apos;s Sessions
        </h2>
        {today.length === 0 && (
          <div className="glass rounded-2xl p-6 text-sm text-muted">No sessions on the calendar for today.</div>
        )}
        <div className="space-y-4">
          {today.map(s => (
            <div key={s.id} className="grid md:grid-cols-[5.5rem_minmax(0,1fr)] gap-3 items-start">
              <div className="text-sm font-black text-ink pt-4">{formatTime(s.scheduledAt)}</div>
              <SessionCard session={s} onPrepare={() => prepare(s)} />
            </div>
          ))}
        </div>
      </section>

      {follow.length > 0 && (
        <section className="glass rounded-2xl p-5 mb-8">
          <h2 className="text-lg font-black text-ink mb-3">⚡ Needs Follow-up</h2>
          <div className="space-y-3">
            {follow.slice(0, 6).map(s => {
              const extras = loadSessionExtras(scopedId, s.id)
              const open = extras.actionItems.find(a => !a.done)
              return (
                <div key={s.id} className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{s.studentName}</div>
                    <div className="text-xs text-muted">{s.topic}</div>
                    {open && <div className="text-xs text-muted">Action item incomplete: {open.label}</div>}
                    <div className="text-xs text-primary font-semibold">Recommended: Schedule follow-up</div>
                  </div>
                  <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorSessionPath(s.id))}>
                    View Session
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          className="field flex-1 px-3 py-2.5 text-sm"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search student, course, project, or session topic..."
          aria-label="Search sessions"
        />
        <label className="text-xs font-semibold text-muted">
          Sort
          <select className="field ml-2 px-3 py-2 text-sm" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            {SORTS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-glass text-sm lg:hidden" onClick={() => setDrawer(true)}>
          Filters
        </button>
      </div>

      <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)] gap-6 mb-10">
        <aside className="tx-filters-desktop glass rounded-2xl p-4 h-fit sticky top-24">{filters}</aside>
        <div>
          <h2 className="text-xl font-black text-ink mb-3">Upcoming</h2>
          {upcoming.length === 0 && filtered.filter(s => +new Date(s.scheduledAt) >= Date.now() && s.status !== 'completed').length === 0 && (
            <div className="glass rounded-2xl p-6 mb-4">
              <h3 className="text-lg font-black text-ink mb-1">No Upcoming Sessions</h3>
              <p className="text-sm text-muted mb-3">Your next booked session will appear here.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-xs" onClick={() => navigate('/tutor/profile')}>Complete Tutor Profile</button>
                <button type="button" className="btn-glass text-xs" onClick={() => navigate('/tutor/students')}>View Students</button>
                <button type="button" className="btn-glass text-xs" onClick={() => navigate('/tutor/profile#availability')}>Manage Availability</button>
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.filter(s => s.status !== 'completed' && s.status !== 'cancelled').map(s => (
              <SessionCard key={s.id} session={s} onPrepare={() => prepare(s)} />
            ))}
          </div>
        </div>
      </div>

      <section id="calendar" className="glass rounded-2xl p-5 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-black text-ink">Calendar</h2>
          <div className="hidden sm:flex gap-2">
            <button type="button" className="tx-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={calMode === 'day'} onClick={() => setCalMode('day')}>Day</button>
            <button type="button" className="tx-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={calMode === 'week'} onClick={() => setCalMode('week')}>Week</button>
          </div>
        </div>
        <p className="text-xs text-muted mb-3 sm:hidden">Agenda view — sessions from your bookings, not a second booking calendar.</p>
        <div className="tx-cal max-sm:grid-cols-1">
          {calDays.map(day => {
            const items = rows.filter(s => {
              const d = new Date(s.scheduledAt)
              return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate() && s.status !== 'cancelled'
            })
            return (
              <div key={day.toISOString()} className="glass rounded-xl p-3 min-h-[7rem]">
                <div className="text-[11px] font-semibold text-muted mb-2">
                  {day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                </div>
                {items.length === 0 && <div className="text-[11px] text-subtle">Free</div>}
                {items.map(s => (
                  <button key={s.id} type="button" className="tx-block mb-1" onClick={() => navigate(tutorSessionPath(s.id))}>
                    {formatTime(s.scheduledAt)} · {s.studentName}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-black text-ink mb-3">Session History</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <label className="text-xs font-semibold text-muted">
            Student
            <input className="field ml-2 px-3 py-2 text-sm" value={histStudent} onChange={e => setHistStudent(e.target.value)} placeholder="Filter by student" />
          </label>
          <label className="text-xs font-semibold text-muted">
            Session type
            <select className="field ml-2 px-3 py-2 text-sm" value={histKind} onChange={e => setHistKind(e.target.value as SessionKind | 'all')}>
              {KINDS.map(k => (
                <option key={k} value={k}>{kindName(k)}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Sort
            <select className="field ml-2 px-3 py-2 text-sm" value={histSort} onChange={e => setHistSort(e.target.value as 'newest' | 'oldest' | 'rating')}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="rating">Highest Rating</option>
            </select>
          </label>
        </div>
        {history.length === 0 && !histStudent && histKind === 'all' ? (
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-black text-ink mb-1">No Completed Sessions Yet</h3>
            <p className="text-sm text-muted">Completed sessions will appear here.</p>
          </div>
        ) : history.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted">No matching completed sessions.</div>
        ) : (
          <div className="space-y-3">
            {histSlice.map(s => {
              const extras = loadSessionExtras(scopedId, s.id)
              return (
                <article key={s.id} className="glass rounded-2xl p-4 flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="font-bold text-ink">{s.topic}</div>
                    <div className="text-sm text-muted">{s.studentName} · {formatWhen(s.scheduledAt)}{s.duration ? ` · ${s.duration} min` : ''} · {s.kindLabel}</div>
                    <div className="text-xs text-muted mt-1">
                      ✓ Completed
                      {s.rating != null ? ` · Rating: ${s.rating} / 5` : ''}
                      {extras.nextTopic ? ` · Follow-up: ${extras.nextTopic}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorSessionPath(s.id))}>View Summary</button>
                    {s.studentId && <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorStudentPath(s.studentId!))}>View Student</button>}
                  </div>
                </article>
              )
            })}
            {histPages > 1 && (
              <nav className="flex gap-2" aria-label="History pagination">
                <button type="button" className="btn-glass text-xs" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
                {Array.from({ length: histPages }, (_, i) => i + 1).slice(0, 7).map(n => (
                  <button key={n} type="button" className="tx-chip rounded-lg px-3 py-1.5 text-xs" data-on={page === n} onClick={() => setPage(n)}>{n}</button>
                ))}
                <button type="button" className="btn-glass text-xs" disabled={page === histPages} onClick={() => setPage(p => Math.min(histPages, p + 1))}>Next</button>
              </nav>
            )}
          </div>
        )}
      </section>

      {drawer && (
        <div className="tx-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="tx-filters">
          <button type="button" className="absolute inset-0" aria-label="Close filters" style={{ background: 'transparent', border: 'none' }} onClick={() => setDrawer(false)} />
          <div className="glass rounded-3xl p-5 relative z-10 w-full max-w-md max-h-[85vh] overflow-auto">
            <h2 id="tx-filters" className="text-lg font-black text-ink mb-3">Filters</h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setDrawer(false)}>Show results</button>
          </div>
        </div>
      )}
    </div>
  )
}
