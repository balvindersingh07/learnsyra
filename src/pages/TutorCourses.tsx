import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StudioCourseCard from '../components/tutor-courses/StudioCourseCard'
import { useAuth } from '../context/AuthContext'
import { getTutorCourses, getTutorStudents } from '../lib/api'
import {
  deleteStudioCourse,
  duplicateCourse,
  matchesStudioQuery,
  matchesStudioTab,
  mergeTutorCourses,
  saveStudioCourse,
  sortStudio,
  studioStats,
  suggestOutline,
  type StudioCourse,
  type StudioSort,
  type StudioTab,
} from '../lib/tutorCourses'
import './tutor-courses.css'

const TABS: { id: StudioTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
  { id: 'review', label: 'Under Review' },
  { id: 'archived', label: 'Archived' },
]

const SORTS: { id: StudioSort; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'updated', label: 'Recently Updated' },
  { id: 'students', label: 'Most Students' },
  { id: 'rated', label: 'Highest Rated' },
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
]

export default function TutorCourses() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || 'local-tutor'
  const [rows, setRows] = useState<StudioCourse[]>([])
  const [source, setSource] = useState<'live' | 'demo'>('demo')
  const [students, setStudents] = useState<Record<string, number>>({})
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<StudioTab>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<StudioSort>('recommended')
  const [copilot, setCopilot] = useState(false)
  const [idea, setIdea] = useState('')
  const [outline, setOutline] = useState<string[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = () => {
    Promise.all([getTutorCourses().catch(() => []), getTutorStudents().catch(() => [])])
      .then(([apiCourses, enrollments]) => {
        const merged = mergeTutorCourses(apiCourses, tutorId)
        setRows(merged.courses)
        setSource(merged.source)
        const map: Record<string, number> = {}
        for (const row of apiCourses) map[row.id] = row.students ?? 0
        setStudents(map)
        const rate: Record<string, number> = {}
        for (const row of apiCourses) {
          if (row.rating > 0 && row.students > 0) rate[row.id] = row.rating
        }
        setRatings(rate)
        void enrollments
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [tutorId])

  const filtered = useMemo(() => {
    const list = rows.filter(c => matchesStudioQuery(c, query) && matchesStudioTab(c, tab))
    return sortStudio(list, sort, students, ratings)
  }, [rows, query, tab, sort, students, ratings])

  const stats = studioStats(rows, students, ratings)

  const patch = (id: string, next: Partial<StudioCourse>) => {
    const course = rows.find(c => c.id === id)
    if (!course || course.demo) return
    const saved = saveStudioCourse({ ...course, ...next })
    setRows(prev => prev.map(c => (c.id === id ? saved : c)))
  }

  return (
    <div className="tc-page pt-20 px-4 sm:px-6 pb-16 max-w-7xl mx-auto overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            My Courses
          </h1>
          <p className="text-muted">Create practical courses that help students build real skills.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm" onClick={() => setCopilot(true)}>
            AI Course Copilot
          </button>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/courses/new')}>
            + Create Course
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Courses', value: loading ? '—' : String(stats.total) },
          { label: 'Published', value: loading ? '—' : String(stats.published) },
          { label: 'Drafts', value: loading ? '—' : String(stats.drafts) },
          { label: 'Under Review', value: loading ? '—' : String(stats.review) },
          { label: 'Total Students', value: loading ? '—' : stats.students ? String(stats.students) : '—' },
          { label: 'Average Rating', value: loading ? '—' : stats.rating ? stats.rating.toFixed(1) : '—' },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {source === 'demo' && !loading && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm text-muted">
          You have no courses yet. The card below is a <span className="font-semibold text-ink">labeled sample</span> so you can explore Course Studio. It is not published and has no real students or revenue.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Course status">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="tc-chip rounded-full px-3 py-1.5 text-xs font-semibold"
            data-on={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          className="field flex-1 px-3 py-2.5 text-sm"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search courses..."
          aria-label="Search courses"
        />
        <label className="text-xs font-semibold text-muted">
          Sort
          <select className="field ml-2 px-3 py-2 text-sm" value={sort} onChange={e => setSort(e.target.value as StudioSort)}>
            {SORTS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-8 max-w-xl">
          <h2 className="text-xl font-black text-ink mb-2">No courses yet</h2>
          <p className="text-sm text-muted mb-4">Your next course will appear here. Start from a blank studio or generate an outline to edit.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/courses/new')}>+ Create Course</button>
            <button type="button" className="btn-glass text-sm" onClick={() => setCopilot(true)}>AI Course Copilot</button>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(course => (
            <StudioCourseCard
              key={course.id}
              course={course}
              students={students[course.apiId || course.id] ?? null}
              rating={ratings[course.apiId || course.id] ?? null}
              onEdit={() => {
                if (course.demo) {
                  const copy = duplicateCourse(course, tutorId)
                  navigate(`/tutor/courses/${copy.id}`)
                  return
                }
                navigate(`/tutor/courses/${course.id}`)
              }}
              onDuplicate={() => {
                if (course.demo) return
                const copy = duplicateCourse(course, tutorId)
                navigate(`/tutor/courses/${copy.id}`)
              }}
              onPause={() => patch(course.id, { status: 'paused' })}
              onArchive={() => patch(course.id, { status: 'archived' })}
              onDelete={() => setConfirmId(course.id)}
            />
          ))}
        </div>
      )}

      {copilot && (
        <div className="tc-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="copilot-title">
          <button type="button" className="absolute inset-0" aria-label="Close copilot" style={{ background: 'transparent', border: 'none' }} onClick={() => setCopilot(false)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-lg max-h-[85vh] overflow-auto">
            <h2 id="copilot-title" className="text-xl font-black text-ink mb-2">✨ AI Course Copilot</h2>
            <p className="text-sm text-muted mb-3">Structured outline help only. It will not publish, invent credentials, salaries, or student numbers.</p>
            <label className="block text-xs font-semibold text-muted mb-3">
              What do you want to teach?
              <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={3} value={idea} onChange={e => setIdea(e.target.value)} placeholder="I want to teach React from beginner to job-ready." />
            </label>
            <button
              type="button"
              className="btn-primary text-sm mb-4"
              onClick={() => setOutline(suggestOutline(idea, rows[0] ?? { title: idea, category: 'Programming' } as StudioCourse))}
            >
              Generate Course Outline
            </button>
            {outline.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-bold text-ink mb-2">AI Suggested</h3>
                <ol className="text-sm text-muted list-decimal pl-5 mb-3">
                  {outline.map((t, i) => (
                    <li key={`${t}-${i}`} className="mb-1">
                      <input className="field w-full px-2 py-1 text-sm" value={t} aria-label={`Module ${i + 1}`} onChange={e => setOutline(outline.map((x, j) => (j === i ? e.target.value : x)))} />
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={() => {
                      sessionStorage.setItem('learnsyra_studio_outline', JSON.stringify({ idea, outline: outline.filter(Boolean) }))
                      setCopilot(false)
                      navigate('/tutor/courses/new')
                    }}
                  >
                    Accept
                  </button>
                  <button type="button" className="btn-glass text-sm" onClick={() => setOutline([])}>Reject</button>
                </div>
              </div>
            )}
            <p className="text-xs text-subtle">You approve every change. Nothing is published automatically.</p>
          </div>
        </div>
      )}

      {confirmId && (
        <div className="tc-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <button type="button" className="absolute inset-0" aria-label="Cancel" style={{ background: 'transparent', border: 'none' }} onClick={() => setConfirmId(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-sm">
            <h2 id="del-title" className="text-lg font-black text-ink mb-2">Delete this draft?</h2>
            <p className="text-sm text-muted mb-4">This cannot be undone. Published courses cannot be hard-deleted.</p>
            <div className="flex gap-2">
              <button type="button" className="btn-glass text-sm" onClick={() => setConfirmId(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => {
                  deleteStudioCourse(confirmId, tutorId)
                  setConfirmId(null)
                  reload()
                }}
              >
                Delete Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
