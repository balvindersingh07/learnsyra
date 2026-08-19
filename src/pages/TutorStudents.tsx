import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StudentCard from '../components/tutor-students/StudentCard'
import { useAuth } from '../context/AuthContext'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import { getReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents } from '../lib/api'
import { tutorStudentPath } from '../lib/paths'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import {
  PAGE_SIZE,
  aiSummary,
  buildTutorRoster,
  courseAverageInsight,
  inProgressBand,
  matchesActivity,
  matchesQuery,
  matchesSession,
  rosterStats,
  sortStudents,
  type ActivityFilter,
  type ProgressBand,
  type SessionFilter,
  type SortKey,
  type StudentStatus,
  type TutorStudent,
} from '../lib/tutorStudents'
import './tutor-students.css'

const STATUSES: Array<StudentStatus | 'all'> = ['all', 'active', 'attention', 'completed', 'inactive']
const PROGRESS: Array<ProgressBand | 'all'> = ['all', '0-25', '26-50', '51-75', '76-100']
const ACTIVITY: Array<ActivityFilter | 'all'> = ['all', 'today', 'week', 'month', 'none']
const SESSIONS: Array<SessionFilter | 'all'> = ['all', 'upcoming', 'completed', 'none']
const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'recent', label: 'Recently Active' },
  { id: 'attention', label: 'Needs Attention' },
  { id: 'high', label: 'Highest Progress' },
  { id: 'low', label: 'Lowest Progress' },
  { id: 'newest', label: 'Newest Student' },
  { id: 'lastSession', label: 'Last Session' },
]

function labelOf(v: string) {
  if (v === 'all') return 'All'
  if (v === 'attention') return 'Needs Attention'
  if (v === 'none') return 'No recent activity'
  if (v === 'week') return 'This week'
  if (v === 'month') return 'This month'
  if (v === 'today') return 'Today'
  if (v === 'upcoming') return 'Upcoming'
  if (v === 'completed') return 'Completed'
  if (v === 'active') return 'Active'
  if (v === 'inactive') return 'Inactive'
  return v
}

export default function TutorStudents() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [rows, setRows] = useState<TutorStudent[]>([])
  const [source, setSource] = useState<'live' | 'demo'>('demo')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StudentStatus | 'all'>('all')
  const [course, setCourse] = useState('all')
  const [skill, setSkill] = useState('all')
  const [progress, setProgress] = useState<ProgressBand | 'all'>('all')
  const [activity, setActivity] = useState<ActivityFilter | 'all'>('all')
  const [sessionFilter, setSessionFilter] = useState<SessionFilter | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('recommended')
  const [page, setPage] = useState(1)
  const [drawer, setDrawer] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([getTutorStudents(), getTutorBookings(), getReviewQueue(), getTutorCourses()])
      .then(([enrollments, bookings, reviews, apiCourses]) => {
        if (!alive) return
        const built = buildTutorRoster({
          enrollments,
          bookings,
          reviews,
          localBookings: loadTutorBookings(),
          apiCourses,
        })
        setRows(built.students)
        setSource(built.source)
      })
      .catch(() => {
        if (!alive) return
        const built = buildTutorRoster({ enrollments: [], bookings: [], reviews: [], localBookings: loadTutorBookings(), apiCourses: [] })
        setRows(built.students)
        setSource(built.source)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [session?.user.id])

  const courses = useMemo(() => [...new Set(rows.flatMap(s => s.courses.map(c => c.title)))], [rows])
  const skills = useMemo(() => [...new Set(rows.flatMap(s => s.skills.map(c => c.name)))], [rows])
  const filtered = useMemo(() => {
    const list = rows.filter(s => {
      if (!matchesQuery(s, query)) return false
      if (status !== 'all' && s.status !== status) return false
      if (course !== 'all' && !s.courses.some(c => c.title === course)) return false
      if (skill !== 'all' && !s.skills.some(sk => sk.name === skill)) return false
      if (!inProgressBand(s.overallProgress, progress)) return false
      if (!matchesActivity(s, activity)) return false
      if (!matchesSession(s, sessionFilter)) return false
      return true
    })
    return sortStudents(list, sort)
  }, [rows, query, status, course, skill, progress, activity, sessionFilter, sort])

  useEffect(() => {
    setPage(1)
  }, [query, status, course, skill, progress, activity, sessionFilter, sort])

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  const stats = rosterStats(rows)
  const summary = aiSummary(rows, source)
  const aggregate = courseAverageInsight(rows)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const priority = rows.filter(s => s.status === 'attention').slice(0, 5)

  const prepare = (student: TutorStudent) => {
    setPendingAiPrompt(
      `Prepare a tutoring session for ${student.name}. Course: ${student.courses[0]?.title ?? 'n/a'}. Focus: ${student.currentFocus ?? 'general'}. Gaps: ${student.focusSkills.join(', ') || 'none listed'}. Do not invent extra student history.`,
    )
    navigate('/tutor/ai')
  }

  const filters = (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Status</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button key={s} type="button" className="ts-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={status === s} aria-pressed={status === s} onClick={() => setStatus(s)}>
              {labelOf(s)}
            </button>
          ))}
        </div>
      </fieldset>
      {courses.length > 0 && (
        <label className="block text-xs font-semibold text-muted">
          Course
          <select className="field w-full mt-1 px-3 py-2 text-sm" value={course} onChange={e => setCourse(e.target.value)}>
            <option value="all">All courses</option>
            {courses.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      {skills.length > 0 && (
        <label className="block text-xs font-semibold text-muted">
          Skill
          <select className="field w-full mt-1 px-3 py-2 text-sm" value={skill} onChange={e => setSkill(e.target.value)}>
            <option value="all">All skills</option>
            {skills.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Progress</legend>
        <div className="flex flex-wrap gap-2">
          {PROGRESS.map(s => (
            <button key={s} type="button" className="ts-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={progress === s} aria-pressed={progress === s} onClick={() => setProgress(s)}>
              {s === 'all' ? 'All' : `${s}%`}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Last activity</legend>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY.map(s => (
            <button key={s} type="button" className="ts-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={activity === s} aria-pressed={activity === s} onClick={() => setActivity(s)}>
              {labelOf(s)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Session status</legend>
        <div className="flex flex-wrap gap-2">
          {SESSIONS.map(s => (
            <button key={s} type="button" className="ts-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={sessionFilter === s} aria-pressed={sessionFilter === s} onClick={() => setSessionFilter(s)}>
              {s === 'none' ? 'No upcoming session' : labelOf(s)}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )

  return (
    <div className="ts-page pt-20 px-4 sm:px-6 pb-16 max-w-7xl mx-auto overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            My Students
          </h1>
          <p className="text-muted">Track progress, understand learning gaps, and help every student move forward.</p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/profile')}>
          + Find Students
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Students', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: 'Needs Attention', value: stats.attention },
          { label: 'Completed', value: stats.completed },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {loading ? '—' : s.value}
            </div>
          </div>
        ))}
      </div>

      {source === 'demo' && !loading && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm text-muted">
          You have no enrolled students yet. The roster below is <span className="font-semibold text-ink">demo data</span> so you can explore the Success Center.
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className="btn-primary text-xs" onClick={() => navigate('/tutor/profile')}>
              Complete Tutor Profile
            </button>
            <button type="button" className="btn-glass text-xs" onClick={() => navigate('/tutor/profile')}>
              Explore how students find you
            </button>
          </div>
        </div>
      )}

      <section className="ts-hero glass rounded-3xl p-5 md:p-6 mb-6">
        <h2 className="text-lg font-black text-ink mb-1">✨ AI Student Insights</h2>
        <p className="text-sm text-ink mb-3">{summary.headline}</p>
        <ul className="text-sm text-muted space-y-1 mb-4">
          <li>🔴 {summary.stalled} students have stalled progress</li>
          <li>🟡 {summary.skillGaps} students have skill gaps</li>
          <li>🟢 {summary.nextProject} students are ready for their next project</li>
        </ul>
        {aggregate && <p className="text-xs text-subtle mb-3">{aggregate}</p>}
        <button type="button" className="btn-glass text-sm" onClick={() => setStatus('attention')}>
          View Priority Students →
        </button>
      </section>

      {priority.length > 0 && (
        <section className="glass rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-black text-ink mb-3">⚡ Needs Your Attention</h2>
          <div className="space-y-3">
            {priority.map(s => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">{s.name}</div>
                  <div className="text-xs text-muted">{s.attentionReasons[0] || 'Needs a check-in'}</div>
                  <div className="text-xs text-primary font-semibold">{s.recommendedAction}</div>
                </div>
                <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorStudentPath(s.id))}>
                  View Student →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="flex-1 text-xs font-semibold text-muted">
          <span className="sr-only">Search students</span>
          <input
            className="field w-full px-3 py-2.5 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search students by name, course, skill, or project..."
          />
        </label>
        <label className="text-xs font-semibold text-muted">
          Sort
          <select className="field ml-2 px-3 py-2 text-sm" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            {SORTS.map(s => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-glass text-sm lg:hidden" onClick={() => setDrawer(true)}>
          Filters
        </button>
      </div>

      <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)] gap-6">
        <aside className="ts-filters-desktop glass rounded-2xl p-4 h-fit sticky top-24">{filters}</aside>
        <div>
          {loading && <p className="text-sm text-muted mb-4">Loading students…</p>}
          {!loading && slice.length === 0 && (
            <div className="glass rounded-3xl p-8 text-center">
              <h2 className="text-2xl font-black text-ink mb-2">{rows.length === 0 ? 'Start Building Your Student Community' : 'No matching students'}</h2>
              <p className="text-muted mb-4">
                {rows.length === 0
                  ? "Once students book a session or enroll in your course, they'll appear here."
                  : 'Try a different search or filter.'}
              </p>
              {rows.length === 0 && (
                <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/profile')}>
                  Complete Tutor Profile
                </button>
              )}
            </div>
          )}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {slice.map(s => (
              <StudentCard key={s.id} student={s} onPrepare={() => prepare(s)} />
            ))}
          </div>
          {pages > 1 && (
            <nav className="flex flex-wrap items-center gap-2 mt-6" aria-label="Pagination">
              <button type="button" className="btn-glass text-xs" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                Previous
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 7).map(n => (
                <button key={n} type="button" className="ts-chip rounded-lg px-3 py-1.5 text-xs font-semibold" data-on={page === n} aria-current={page === n ? 'page' : undefined} onClick={() => setPage(n)}>
                  {n}
                </button>
              ))}
              <button type="button" className="btn-glass text-xs" disabled={page === pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                Next
              </button>
            </nav>
          )}
        </div>
      </div>

      {drawer && (
        <div className="ts-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="filter-title">
          <button type="button" className="absolute inset-0" aria-label="Close filters" style={{ background: 'transparent', border: 'none' }} onClick={() => setDrawer(false)} />
          <div className="glass rounded-3xl p-5 relative z-10 w-full max-w-md max-h-[85vh] overflow-auto">
            <h2 id="filter-title" className="text-lg font-black text-ink mb-3">
              Filters
            </h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setDrawer(false)}>
              Show results
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
