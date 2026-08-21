import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCourseReviews, getTutorLiveClasses, getProjects, getTutorReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents, type CourseReview } from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import {
  analyticsWindow,
  availabilityInsights,
  buildInsights,
  completedSessions,
  contentInsights,
  courseFunnel,
  coursePerformance,
  coverageLabel,
  growthBuckets,
  learningSignal,
  loadAnalyticsFilters,
  loadDismissed,
  inRange,
  periodStudentCounts,
  previousWindow,
  projectOutcomes,
  ratingStats,
  realSessions,
  realStudents,
  repeatBookings,
  saveAnalyticsFilters,
  saveDismissed,
  sessionBreakdown,
  studentProgress,
  teachingHours,
  type AnalyticsRange,
  type GrowthInsight,
} from '../lib/tutorAnalytics'
import { buildTransactions, earningsTotals, formatEarnOrZero, monthCompare, sessionPerformance as earnSessionPerf } from '../lib/tutorEarnings'
import { tutorCoursePath, tutorStudentPath } from '../lib/paths'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import { loadTutorHub, selfTutorId } from '../lib/tutorProfile'
import { mergeTutorCourses } from '../lib/tutorCourses'
import { buildReviews, loadReviewExtras } from '../lib/tutorProjects'
import { buildTutorSessions } from '../lib/tutorSessions'
import { buildTutorRoster, type TutorStudent } from '../lib/tutorStudents'
import './tutor-analytics.css'

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
  { id: 'custom', label: 'Custom' },
]

export default function TutorAnalytics() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || null
  const publicId = tutorId ? (loadTutorHub(tutorId)?.publicId || selfTutorId(tutorId)) : ''
  const saved = loadAnalyticsFilters(tutorId)
  const [students, setStudents] = useState<TutorStudent[]>([])
  const [studentSource, setStudentSource] = useState<'live' | 'demo'>('live')
  const [sessions, setSessions] = useState<ReturnType<typeof buildTutorSessions>['sessions']>([])
  const [courses, setCourses] = useState<ReturnType<typeof mergeTutorCourses>['courses']>([])
  const [reviews, setReviews] = useState<CourseReview[]>([])
  const [projects, setProjects] = useState<ReturnType<typeof buildReviews>['reviews']>([])
  const [earnRows, setEarnRows] = useState(buildTransactions({ sessions: [], local: [], api: [], tutorPublicId: publicId }))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<AnalyticsRange>(saved.range || '30d')
  const [from, setFrom] = useState(saved.from || '')
  const [to, setTo] = useState(saved.to || '')
  const [drawer, setDrawer] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])

  const load = () => {
    if (!tutorId) {
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    setDismissed(loadDismissed(tutorId))
    Promise.all([
      getTutorStudents().catch(() => []),
      getTutorBookings().catch(() => []),
      getTutorCourses().catch(() => []),
      getTutorLiveClasses().catch(() => []),
      getTutorReviewQueue().catch(() => []),
      getProjects().catch(() => []),
    ]).then(async ([enrollments, bookings, apiCourses, liveClasses, queue, apiProjects]) => {
      const roster = buildTutorRoster({ enrollments, bookings, reviews: queue, localBookings: loadTutorBookings(), apiCourses })
      const studio = mergeTutorCourses(apiCourses, tutorId)
      const builtSessions = buildTutorSessions({
        local: loadTutorBookings(),
        api: bookings,
        liveClasses,
        roster: roster.students,
        tutorUserId: tutorId,
        tutorPublicId: publicId,
      })
      const builtReviews = buildReviews({ queue, roster: roster.students, apiProjects, tutorId })
      const published = studio.courses.filter(c => !c.demo && c.status === 'published')
      const reviewLists = await Promise.all(published.map(c => getCourseReviews(c.apiId || c.id).catch(() => [] as CourseReview[])))
      setStudents(roster.students)
      setStudentSource(roster.source)
      setCourses(studio.courses)
      setSessions(builtSessions.sessions)
      setProjects(builtReviews.reviews)
      setReviews(reviewLists.flat())
      setEarnRows(buildTransactions({ sessions: builtSessions.sessions, local: loadTutorBookings(), api: bookings, tutorPublicId: publicId }))
    }).catch(() => {
      setError("Analytics couldn't be loaded right now.")
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tutorId, publicId, profile?.id])
  useEffect(() => { saveAnalyticsFilters({ range, from, to }, tutorId) }, [range, from, to, tutorId])
  useEffect(() => {
    if (!drawer && !exportOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawer(false); setExportOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, exportOpen])

  const win = analyticsWindow(range, { from, to })
  const prev = previousWindow(win.from, win.to)
  const demo = false
  const roster = realStudents(students, studentSource)
  const sess = realSessions(sessions)
  const done = completedSessions(sessions)
  const inPeriod = (iso: string | null | undefined) => inRange(iso, win.from, win.to)
  const hours = teachingHours(done.filter(s => inPeriod(s.scheduledAt) || inPeriod(s.createdAt)))
  const periodDone = done.filter(s => inPeriod(s.scheduledAt) || inPeriod(s.createdAt))
  const prevDone = done.filter(s => inRange(s.scheduledAt, prev.from, prev.to) || inRange(s.createdAt, prev.from, prev.to))
  const ratings = ratingStats(sess, reviews)
  const progress = studentProgress(roster)
  const funnel = courseFunnel(roster)
  const monthly = range === '3m' || range === '6m' || range === '1y'
  const growth = growthBuckets(roster, win.from, win.to, monthly)
  const counts = periodStudentCounts(roster, win.from, win.to)
  const types = sessionBreakdown(periodDone)
  const repeats = repeatBookings(periodDone)
  const hub = tutorId ? loadTutorHub(tutorId) : null
  const avail = availabilityInsights(sess, hub)
  const extras = Object.fromEntries(projects.map(p => [p.id, loadReviewExtras(tutorId || '', p.id)]))
  const outcomes = projectOutcomes(projects, extras)
  const revenueMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of earnRows) {
      if (t.courseId && t.grossAmount) map[t.courseId] = (map[t.courseId] ?? 0) + t.grossAmount
    }
    return map
  }, [earnRows])
  const courseRows = coursePerformance(courses, roster, reviews, revenueMap)
  const contents = contentInsights(roster, courses)
  const signal = learningSignal(roster)
  const attention = roster.filter(s => s.status === 'attention').slice(0, 5)
  const allInsights = buildInsights({ students: roster, sessions: sess, courses, attention, avail, reviews })
  const insights = allInsights.filter(i => !dismissed.includes(i.id))
  const coverage = coverageLabel({
    students: demo ? 0 : roster.length,
    sessions: periodDone.length,
    courses: courses.filter(c => !c.demo && c.status === 'published').length,
    demo,
  })
  const earnMonth = monthCompare(earnRows)
  const earnAll = earningsTotals(earnRows)
  const earnTypes = earnSessionPerf(earnRows)
  const publishedCount = courses.filter(c => !c.demo && c.status === 'published').length
  const maxGrowth = Math.max(...growth.map(g => g.n), 0)
  const maxFunnel = Math.max(...funnel.map(f => f.count), 1)
  const sessionDelta = prevDone.length > 0 ? ((periodDone.length - prevDone.length) / prevDone.length) * 100 : null
  const careerProjects = roster.reduce((s, r) => s + r.projects.filter(p => /complete|approved|portfolio/i.test(p.status)).length, 0)
  const interviewSessions = done.filter(s => s.kind === 'interview').length

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    if (tutorId) saveDismissed(tutorId, next)
  }

  const take = (row: GrowthInsight) => {
    if (row.href.startsWith('/tutor/ai')) {
      setPendingAiPrompt(`${row.observation} ${row.recommendation} Do not invent student or financial data.`)
    }
    navigate(row.href)
  }

  const filters = (
    <div className="flex flex-wrap gap-2">
      {RANGES.map(r => (
        <button key={r.id} type="button" className="ta-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={range === r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
      ))}
    </div>
  )

  return (
    <div className="ta-page pt-20 px-4 sm:px-6 pb-16 max-w-6xl mx-auto overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Analytics</h1>
          <p className="text-muted">Understand your teaching performance, student progress, and opportunities to grow.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm lg:hidden" onClick={() => setDrawer(true)}>Date range</button>
          <button type="button" className="btn-glass text-sm" onClick={() => setExportOpen(true)}>Export Report</button>
        </div>
      </div>
      <div className="hidden lg:block mb-4">{filters}</div>
      {range === 'custom' && (
        <div className="flex flex-wrap gap-3 mb-4">
          <label className="text-xs font-semibold text-muted">From<input type="date" className="field ml-2 px-3 py-2 text-sm" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="text-xs font-semibold text-muted">To<input type="date" className="field ml-2 px-3 py-2 text-sm" value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
      )}
      {error && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm" style={{ color: '#e11d48' }}>
          {error}
          <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          <button type="button" className="btn-glass text-xs ml-2" onClick={() => setError(null)}>Continue with available data</button>
        </div>
      )}

      <p className="text-xs text-muted mb-3">Selected period · Lifetime totals are labeled separately.</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Active Students', value: loading ? null : String(counts.active || roster.filter(s => s.status === 'active' || s.status === 'attention').length || 0), note: 'Current roster' },
          { label: 'Sessions Completed', value: loading ? null : String(periodDone.length), note: 'Selected period' },
          { label: 'Course Students', value: loading ? null : publishedCount === 0 && roster.every(s => !s.courses.length) ? 'No data yet' : String(roster.filter(s => s.courses.length).length), note: 'Current roster' },
          { label: 'Average Rating', value: loading ? null : ratings.average != null ? String(ratings.average) : '—', note: ratings.average != null ? 'Lifetime recorded' : undefined },
          { label: 'Profile Views', value: loading ? null : 'Not available' },
          { label: 'Teaching Hours', value: loading ? null : hours == null ? 'Not available' : String(hours), note: hours != null ? 'Selected period' : undefined },
        ].map(s => (
          <div key={s.label} className="ta-card glass rounded-2xl p-4">
            <div className="text-xs text-muted">{s.label}</div>
            {s.value == null ? <div className="ta-skel mt-2" /> : <div className="text-2xl font-black text-ink mt-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{s.value}</div>}
            {'note' in s && s.note && <div className="text-[11px] text-subtle">{s.note}</div>}
          </div>
        ))}
      </div>
      {sessionDelta != null && (
        <p className="text-xs text-muted mb-6">Compared with previous period: {periodDone.length} vs {prevDone.length} completed sessions ({sessionDelta >= 0 ? '+' : ''}{sessionDelta.toFixed(1)}%).</p>
      )}

      <section className="ta-hero glass rounded-3xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">✨ AI Tutor Growth Insights</h2>
        <p className="text-xs text-muted mb-4">Recommendations only. Nothing is changed automatically.</p>
        {insights.length === 0 && <p className="text-sm text-muted">Not enough activity data for a recommendation.</p>}
        {insights.map(row => (
          <div key={row.id} className="glass rounded-2xl p-4 mb-3">
            <p className="text-sm text-ink">{row.observation}</p>
            <p className="text-sm font-semibold mt-2">{row.recommendation}</p>
            <p className="text-xs text-muted mt-1">Based on: {row.basedOn}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" className="btn-glass text-xs" onClick={() => navigate(row.href)}>View Details</button>
              <button type="button" className="btn-primary text-xs" onClick={() => take(row)}>Take Action</button>
              <button type="button" className="btn-glass text-xs" onClick={() => dismiss(row.id)}>Dismiss</button>
            </div>
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Student Growth</h2>
        <p className="text-xs text-muted mb-3">New {counts.newStudents} · Active {counts.active} · Returning {counts.returning} · Completed {counts.completed}</p>
        {growth.length === 0 ? <p className="text-sm text-muted">No student growth history yet.</p> : (
          <>
            <p className="text-xs text-muted mb-2">
              New students recorded in the selected period: {growth.map(g => `${g.label} ${g.n}`).join(', ')}.
            </p>
            <div className="ta-bar" role="img" aria-label={`Student growth chart. ${growth.map(g => `${g.label}: ${g.n}`).join(', ')}`}>
              {growth.map(g => <span key={g.label} style={{ height: `${Math.max(8, (g.n / (maxGrowth || 1)) * 120)}px` }} title={`${g.label}: ${g.n}`} />)}
            </div>
          </>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Student Learning Progress</h2>
        {roster.length === 0 && <p className="text-sm text-muted">Student analytics will appear after students start learning with you.</p>}
        <dl className="grid sm:grid-cols-2 gap-2 text-sm">
          <KV k="Course Progress" v={progress.avgCourse != null ? `${progress.avgCourse}%` : 'Data unavailable'} />
          <KV k="Course completion" v={progress.completedCourse != null ? `${progress.completedCourse}%` : 'Data unavailable'} />
          <KV k="Project completion" v={progress.projectDone != null ? `${progress.projectDone}%` : 'Data unavailable'} />
          <KV k="Practice completion" v="Data unavailable" />
          <KV k="Quiz performance" v="Data unavailable" />
          <KV k="Session activity" v={String(progress.sessionActivity)} />
        </dl>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">⚡ Students Needing Attention</h2>
        {attention.length === 0 && <p className="text-sm text-muted">No attention signals in the current roster.</p>}
        {attention.map(s => (
          <div key={s.id} className="flex flex-wrap justify-between gap-3 mb-3">
            <div>
              <div className="font-semibold text-ink">{s.name}</div>
              <div className="text-xs text-muted">{s.projects[0]?.title || s.courses[0]?.title || 'No project on file'} · {s.attentionReasons[0] || 'Needs attention'}</div>
              <div className="text-xs text-muted">Recommended: {s.recommendedAction}</div>
            </div>
            <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorStudentPath(s.id))}>View Student →</button>
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Course Performance</h2>
        {courseRows.length === 0 && <p className="text-sm text-muted mb-3">{publishedCount === 0 ? 'Course analytics will appear after you publish a course.' : 'No course performance data yet.'}</p>}
        {courseRows.map(c => (
          <div key={c.id} className="glass rounded-xl p-4 mb-2 flex flex-wrap justify-between gap-2">
            <div>
              <div className="font-semibold">{c.title}</div>
              <div className="text-xs text-muted">
                {c.enrollments} students
                {c.completionPct != null ? ` · ${c.completionPct}% completion` : ''}
                {c.rating != null ? ` · ${c.rating} rating` : ''}
                {c.projectCompletionPct != null ? ` · ${c.projectCompletionPct}% project completion` : ''}
                {c.revenue != null ? ` · ${formatEarnOrZero(c.revenue)} recorded gross` : ''}
              </div>
            </div>
            <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorCoursePath(c.id))}>Open Course</button>
          </div>
        ))}
        <button type="button" className="btn-primary text-sm mt-2" onClick={() => navigate('/tutor/courses')}>Manage Courses →</button>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Course Learning Funnel</h2>
        <p className="text-xs text-muted mb-3">Enrollment is not a purchase. Revenue is only from the Earnings system.</p>
        {funnel.length === 0 ? <p className="text-sm text-muted">No course progress on file.</p> : (
          <div className="ta-funnel">
            {funnel.map(s => (
              <div key={s.label} style={{ width: `${Math.max(28, (s.count / maxFunnel) * 100)}%` }}>
                <span className="text-xs font-semibold">{s.label}</span> <span className="text-xs text-muted">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Lesson Engagement</h2>
        {contents.length === 0 ? <p className="text-sm text-muted">Lesson-level engagement data is not available yet.</p> : (
          <>
            <p className="text-xs text-muted mb-2">Last recorded lesson on file — not a drop-off rate.</p>
            {contents.map(c => <div key={c.title} className="text-sm mb-1">{c.title} · {c.count} student{c.count === 1 ? '' : 's'}</div>)}
          </>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Session Performance</h2>
        {periodDone.length === 0 && done.length === 0 && <p className="text-sm text-muted">Session analytics will appear after completed sessions.</p>}
        <dl className="grid sm:grid-cols-2 gap-2 text-sm mb-3">
          <KV k="Sessions completed (period)" v={String(periodDone.length)} />
          <KV k="Teaching hours" v={hours == null ? 'Not available' : String(hours)} />
          <KV k="Average session rating" v={ratings.average != null ? `${ratings.average} (lifetime recorded)` : 'No data yet'} />
          <KV k="Repeat bookings (period)" v={repeats.students ? `${repeats.repeat} of ${repeats.students} students` : 'No data yet'} />
        </dl>
        {types.map(t => <div key={t.kind} className="text-sm">{t.label} · {t.count}</div>)}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Student Feedback</h2>
        {ratings.count === 0 ? <p className="text-sm text-muted">No student reviews yet.</p> : (
          <>
            <p className="text-sm mb-3">Average rating {ratings.average} from {ratings.count} recorded rating{ratings.count === 1 ? '' : 's'}.</p>
            {[5, 4, 3, 2, 1].map((star, i) => (
              <div key={star} className="flex items-center gap-2 mb-1">
                <span className="text-xs w-8">{star} ★</span>
                <div className="ta-star flex-1"><span style={{ width: `${(ratings.dist[4 - i] / ratings.count) * 100}%` }} /></div>
                <span className="text-xs text-muted w-6">{ratings.dist[4 - i]}</span>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Teaching Effectiveness</h2>
        <p className="text-xs text-muted mb-2">LearnSyra Learning Signal — observed association, not a teaching quality score.</p>
        {signal ? (
          <p className="text-sm">Students with recorded project work have {signal.avgWith}% average course progress; students without recorded projects have {signal.avgWithout}%. This is an observed association.</p>
        ) : (
          <p className="text-sm text-muted">Not enough paired progress data for a learning signal.</p>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Project Outcomes</h2>
        {outcomes.assigned === 0 ? (
          <p className="text-sm text-muted">No project review data yet.</p>
        ) : (
          <p className="text-sm">{outcomes.assigned} assigned · {outcomes.started} started · {outcomes.submitted} submitted · {outcomes.approved} approved · {outcomes.portfolio} portfolio-ready · {outcomes.pending} pending</p>
        )}
        <p className="text-xs text-muted mt-2">{outcomes.avgHours != null ? `Average review time: ${outcomes.avgHours} hours` : 'No review timing data yet.'}</p>
        {outcomes.fastestHours != null && <p className="text-xs text-muted">Fastest review: {outcomes.fastestHours} hours</p>}
        <button type="button" className="btn-primary text-sm mt-3" onClick={() => navigate('/tutor/projects')}>Review Projects →</button>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Tutor Profile Performance</h2>
        <p className="text-sm text-muted">Profile performance data isn&apos;t available yet.</p>
        <p className="text-xs text-muted mt-1">Bookings on file: {sess.length}. Conversion is not shown without profile views.</p>
        <button type="button" className="btn-glass text-sm mt-3" onClick={() => navigate('/tutor/profile')}>Improve Profile →</button>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Availability Insights</h2>
        {avail ? (
          <>
            <p className="text-sm">Highest demand: {avail.topDay} · {avail.topHour}</p>
            <p className="text-sm mt-1">Consider adding availability during this period.</p>
            <p className="text-xs text-muted mt-1">{avail.booked} booked sessions on file. Availability is not changed automatically.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Not enough booking timestamps for demand insights.</p>
        )}
        <button type="button" className="btn-glass text-sm mt-3" onClick={() => navigate('/tutor/profile#availability')}>Manage Availability</button>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Earnings Snapshot</h2>
        <p className="text-xs text-muted mb-2">From the existing Earnings system. Not a second ledger.</p>
        {!earnAll.hasAnyAmount ? <p className="text-sm text-muted">No earnings yet</p> : (
          <dl className="grid sm:grid-cols-2 gap-2 text-sm">
            <KV k="This Month (gross recorded)" v={formatEarnOrZero(earnMonth.current)} />
            <KV k="Pending" v={formatEarnOrZero(earnAll.pendingGross)} />
            <KV k="Available" v={formatEarnOrZero(earnAll.available)} />
            <KV k="Course revenue" v={formatEarnOrZero(earnTypes.filter(t => t.kind === 'course').reduce((s, t) => s + t.gross, 0))} />
            <KV k="Session revenue" v={formatEarnOrZero(earnTypes.filter(t => t.kind === 'session').reduce((s, t) => s + t.gross, 0))} />
            <KV k="Project revenue" v={formatEarnOrZero(earnTypes.filter(t => t.kind === 'project').reduce((s, t) => s + t.gross, 0))} />
          </dl>
        )}
        <button type="button" className="btn-primary text-sm mt-3" onClick={() => navigate('/tutor/earnings')}>View Earnings →</button>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Teaching Activity vs Earnings</h2>
        <p className="text-xs text-muted mb-2">Activity and earnings overview. This does not mean more hours equal more money.</p>
        <p className="text-sm">Completed sessions (period): {periodDone.length} · Hours: {hours ?? 'Not available'} · Recorded gross this month: {earnAll.hasAnyAmount ? formatEarnOrZero(earnMonth.current) : 'No earnings yet'}</p>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Student Career Impact</h2>
        <p className="text-sm">Projects with completion/approval on file: {careerProjects}</p>
        <p className="text-sm">Interview-prep sessions completed: {interviewSessions}</p>
        <p className="text-sm">Portfolio-ready projects: {outcomes.portfolio}</p>
        <p className="text-xs text-muted mt-2">LearnSyra does not currently have verified hiring outcome data.</p>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Content Insights</h2>
        {contents.length === 0 ? <p className="text-sm text-muted">Content insights will appear as students progress.</p> : contents.map(c => (
          <div key={c.title} className="text-sm mb-1">Most recently recorded: {c.title} ({c.count})</div>
        ))}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-1">Analytics Data Coverage</h2>
        <p className="text-sm font-semibold">{coverage.level}</p>
        <p className="text-xs text-muted">{coverage.text}</p>
      </section>

      {drawer && (
        <div className="ta-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setDrawer(false)} />
          <div className="glass rounded-3xl p-5 relative z-10 w-full max-w-md">
            <h2 className="text-lg font-black text-ink mb-3">Date range</h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setDrawer(false)}>Apply</button>
          </div>
        </div>
      )}
      {exportOpen && (
        <div className="ta-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExportOpen(false)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 className="text-lg font-black text-ink mb-2">Export Report</h2>
            <p className="text-sm text-muted mb-4">Analytics export will be available when reporting is connected.</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setExportOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
}
