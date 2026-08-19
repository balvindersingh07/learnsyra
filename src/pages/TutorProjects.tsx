import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReviewCard from '../components/tutor-projects/ReviewCard'
import { useAuth } from '../context/AuthContext'
import { getProjects, getReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents } from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import { tutorProjectPath } from '../lib/paths'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import {
  EMPTY_EXTRAS,
  REVIEW_PAGE_SIZE,
  REVIEW_SKILLS,
  aiQueueBreakdown,
  availableFiles,
  buildAiPreReview,
  buildReviews,
  loadReviewExtras,
  loadReviewFilters,
  matchesQuery,
  matchesReviewFilters,
  reviewStats,
  saveReviewExtras,
  saveReviewFilters,
  sortReviews,
  type DateFilter,
  type ReviewSort,
  type ReviewTab,
  type TutorProjectReview,
} from '../lib/tutorProjects'
import { loadAllProgress } from '../lib/projectWorkspace'
import { buildTutorRoster } from '../lib/tutorStudents'
import './tutor-projects.css'

const TABS: { id: ReviewTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs_review', label: 'Needs Review' },
  { id: 'in_review', label: 'In Review' },
  { id: 'changes', label: 'Changes Requested' },
  { id: 'approved', label: 'Approved' },
  { id: 'portfolio', label: 'Portfolio Ready' },
]

const SORTS: { id: ReviewSort; label: string }[] = [
  { id: 'priority', label: 'Priority' },
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'low', label: 'Lowest Score' },
  { id: 'high', label: 'Highest Score' },
  { id: 'updated', label: 'Recently Updated' },
]

const DATES: { id: DateFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'older', label: 'Older' },
]

export default function TutorProjects() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || 'local-tutor'
  const saved = loadReviewFilters()
  const [rows, setRows] = useState<TutorProjectReview[]>([])
  const [source, setSource] = useState<'live' | 'demo'>('demo')
  const [tab, setTab] = useState<ReviewTab>(saved.tab || 'needs_review')
  const [query, setQuery] = useState(saved.query || '')
  const [sort, setSort] = useState<ReviewSort>(saved.sort || 'priority')
  const [skill, setSkill] = useState(saved.skill || '')
  const [course, setCourse] = useState(saved.course || '')
  const [difficulty, setDifficulty] = useState(saved.difficulty || '')
  const [date, setDate] = useState<DateFilter>(saved.date || 'all')
  const [page, setPage] = useState(1)
  const [drawer, setDrawer] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getTutorStudents().catch(() => []),
      getTutorBookings().catch(() => []),
      getReviewQueue().catch(() => []),
      getTutorCourses().catch(() => []),
      getProjects().catch(() => []),
    ]).then(([enrollments, bookings, queue, apiCourses, apiProjects]) => {
      const roster = buildTutorRoster({ enrollments, bookings, reviews: queue, localBookings: loadTutorBookings(), apiCourses })
      const built = buildReviews({ queue, roster: roster.students, apiProjects, tutorId })
      if (built.source === 'demo') {
        const meera = loadReviewExtras(tutorId, 'review-demo-meera')
        if (!meera.actionItems.length) {
          saveReviewExtras(tutorId, 'review-demo-meera', {
            ...EMPTY_EXTRAS,
            ...meera,
            status: 'changes',
            improve: 'Add error handling and tests before the next review.',
            actionItems: ['Add API error handling', 'Write a README with setup steps'],
            history: [{ at: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'changes', summary: 'Changes requested', score: null }],
          })
        }
      }
      setRows(built.reviews)
      setSource(built.source)
    }).finally(() => setLoading(false))
  }, [tutorId])

  useEffect(() => {
    saveReviewFilters({ tab, query, sort, skill, course, difficulty, date })
    setPage(1)
  }, [tab, query, sort, skill, course, difficulty, date])

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  const courses = useMemo(() => Array.from(new Set(rows.map(r => r.courseTitle).filter(Boolean))) as string[], [rows])
  const filtered = useMemo(() => {
    const list = rows.filter(r => matchesQuery(r, query) && matchesReviewFilters(r, { tab, skill, course, difficulty, date }))
    return sortReviews(list, sort, tutorId)
  }, [rows, query, tab, skill, course, difficulty, date, sort, tutorId])

  const stats = reviewStats(rows)
  const queueAi = aiQueueBreakdown(rows)
  const pages = Math.max(1, Math.ceil(filtered.length / REVIEW_PAGE_SIZE))
  const slice = filtered.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE)
  const priority = rows.filter(r => r.priorityReason && (r.status === 'needs_review' || r.status === 'in_review'))
  const waiting = rows.filter(r => r.status === 'needs_review')

  const aiLine = (row: TutorProjectReview) => {
    const files = availableFiles(row.catalog, loadAllProgress()[row.projectId] ?? null)
    const ai = buildAiPreReview(files.files, files.source, loadAllProgress()[row.projectId]?.ranSuccessfully ?? null)
    return ai.findings.find(f => f.tone === 'improve')?.evidence || ai.summary
  }

  const goAi = (row: TutorProjectReview) => {
    setPendingAiPrompt(
      `Prepare a project review for ${row.title} by ${row.studentName}. Skills: ${row.skills.join(', ') || 'not listed'}. Do not invent test results, execution, or vulnerabilities. Suggest questions the tutor can ask.`,
    )
    navigate('/tutor/ai')
  }

  const filters = (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Status</legend>
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t.id} type="button" className="tp-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={tab === t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Difficulty</legend>
        <div className="flex flex-wrap gap-2">
          {['', 'Beginner', 'Intermediate', 'Advanced'].map(d => (
            <button key={d || 'all'} type="button" className="tp-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={difficulty === d} onClick={() => setDifficulty(d)}>{d || 'All'}</button>
          ))}
        </div>
      </fieldset>
      <label className="block text-xs font-semibold text-muted">
        Course
        <select className="field w-full mt-1 px-3 py-2 text-sm" value={course} onChange={e => setCourse(e.target.value)}>
          <option value="">All courses</option>
          {courses.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Skill</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="tp-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={!skill} onClick={() => setSkill('')}>All</button>
          {REVIEW_SKILLS.map(s => (
            <button key={s} type="button" className="tp-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={skill === s} onClick={() => setSkill(s)}>{s}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Submission date</legend>
        <div className="flex flex-wrap gap-2">
          {DATES.map(d => (
            <button key={d.id} type="button" className="tp-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={date === d.id} onClick={() => setDate(d.id)}>{d.label}</button>
          ))}
        </div>
      </fieldset>
    </div>
  )

  return (
    <div className="tp-page pt-20 px-4 sm:px-6 pb-16 max-w-7xl mx-auto overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Project Reviews</h1>
        <p className="text-muted">Review student projects, give actionable feedback, and help turn learning into portfolio-ready work.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Needs Review', value: stats.usingDemo ? '—' : stats.needs },
          { label: 'In Review', value: stats.usingDemo ? '—' : stats.inReview },
          { label: 'Changes Requested', value: stats.usingDemo ? '—' : stats.changes },
          { label: 'Approved', value: stats.usingDemo ? '—' : stats.approved },
          { label: 'Portfolio Ready', value: stats.usingDemo ? '—' : stats.portfolio },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {source === 'demo' && !loading && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm text-muted">
          No live submissions for your students yet. Cards below are a <span className="font-semibold text-ink">labeled sample review environment</span> — not real student work.
        </div>
      )}

      {queueAi.waiting > 0 && (
        <section className="tp-hero glass rounded-3xl p-5 mb-6">
          <h2 className="text-lg font-black text-ink mb-1">✨ AI Review Queue</h2>
          <p className="text-sm text-ink mb-3">{queueAi.waiting} submission{queueAi.waiting === 1 ? '' : 's'} {source === 'demo' ? 'in this sample queue' : 'are waiting for your review'}.</p>
          <ul className="text-sm text-muted mb-4 space-y-1">
            <li>🔴 {queueAi.quality} need code-quality review</li>
            <li>🟡 {queueAi.testing} need testing feedback</li>
            <li>🟢 {queueAi.ready} appear ready for approval</li>
          </ul>
          <p className="text-xs text-subtle mb-3">AI is a pre-review assistant only. It never approves, rejects, or assigns a final score.</p>
          <button type="button" className="btn-primary text-sm" onClick={() => { setTab('needs_review'); setSort('priority') }}>
            Review Priority Projects →
          </button>
        </section>
      )}

      {priority.length > 0 && (
        <section className="glass rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-black text-ink mb-3">⚡ Priority Reviews</h2>
          <div className="space-y-3">
            {priority.slice(0, 4).map(r => (
              <div key={r.id} className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">{r.title}</div>
                  <div className="text-xs text-muted">{r.studentName} · {r.priorityReason}</div>
                </div>
                <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorProjectPath(r.id))}>Review Submission</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input className="field flex-1 px-3 py-2.5 text-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects, students, skills..." aria-label="Search project reviews" />
        <label className="text-xs font-semibold text-muted">
          Sort
          <select className="field ml-2 px-3 py-2 text-sm" value={sort} onChange={e => setSort(e.target.value as ReviewSort)}>
            {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn-glass text-sm lg:hidden" onClick={() => setDrawer(true)}>Filters</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 lg:hidden" role="tablist">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" className="tp-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)] gap-6">
        <aside className="tp-filters-desktop glass rounded-2xl p-4 h-fit sticky top-24">{filters}</aside>
        <div>
          {loading ? (
            <div className="text-sm text-muted">Loading reviews…</div>
          ) : slice.length === 0 && waiting.length === 0 && tab === 'needs_review' && !query ? (
            <div className="glass rounded-2xl p-8">
              <h2 className="text-xl font-black text-ink mb-2">You&apos;re All Caught Up 🎉</h2>
              <p className="text-sm text-muted mb-4">No project submissions currently need your attention.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/students')}>View Students</button>
                <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutor/courses')}>View Courses</button>
              </div>
            </div>
          ) : slice.length === 0 && !query && tab === 'all' && rows.length === 0 ? (
            <div className="glass rounded-2xl p-8">
              <h2 className="text-xl font-black text-ink mb-2">No Project Submissions Yet</h2>
              <p className="text-sm text-muted mb-4">Student submissions will appear here when they request a review.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/students')}>View Students</button>
                <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutor/courses')}>View Courses</button>
              </div>
            </div>
          ) : slice.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-sm text-muted">No matching submissions.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {slice.map(row => (
                <ReviewCard key={row.id} row={row} aiSummary={aiLine(row)} onAi={() => goAi(row)} />
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav className="flex gap-2 mt-4" aria-label="Review pagination">
              <button type="button" className="btn-glass text-xs" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
              {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 7).map(n => (
                <button key={n} type="button" className="tp-chip rounded-lg px-3 py-1.5 text-xs" data-on={page === n} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button type="button" className="btn-glass text-xs" disabled={page === pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>Next</button>
            </nav>
          )}
        </div>
      </div>

      {drawer && (
        <div className="tp-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="tp-filters">
          <button type="button" className="absolute inset-0" aria-label="Close filters" style={{ background: 'transparent', border: 'none' }} onClick={() => setDrawer(false)} />
          <div className="glass rounded-3xl p-5 relative z-10 w-full max-w-md max-h-[85vh] overflow-auto">
            <h2 id="tp-filters" className="text-lg font-black text-ink mb-3">Filters</h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setDrawer(false)}>Show results</button>
          </div>
        </div>
      )}
    </div>
  )
}
