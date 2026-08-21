import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  courseStats,
  courseStatusLabel,
  coursesPageSize,
  filterCourses,
  formatWhen,
  loadAdminCourseIndex,
  paginate,
  uniqueCourseValues,
  uniqueTutors,
  type AdminCourseIndex,
  type AdminCourseRow,
  type CourseQuery,
  type CourseSort,
  type CourseTab,
  type PriceFilter,
  type PublishFilter,
} from '../lib/adminCourses'
import './admin-control.css'

const TABS: { id: CourseTab; label: string }[] = [
  { id: 'all', label: 'All Courses' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Draft' },
  { id: 'review', label: 'Under Review' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'paused', label: 'Paused' },
]

export default function AdminCourses() {
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminCourseIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CourseTab>('all')
  const [q, setQ] = useState('')
  const [publish, setPublish] = useState<PublishFilter>('all')
  const [category, setCategory] = useState('')
  const [tutorId, setTutorId] = useState('')
  const [level, setLevel] = useState('')
  const [price, setPrice] = useState<PriceFilter>('all')
  const [sort, setSort] = useState<CourseSort>('recommended')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminCourseIndex()
      .then(setIndex)
      .catch(() => setError("Courses couldn't be loaded right now."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [tab, q, publish, category, tutorId, level, price, sort])
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  const rows = index?.courseRows ?? []
  const query: CourseQuery = useMemo(() => ({ tab, q, publish, category, tutorId, level, price, sort }), [tab, q, publish, category, tutorId, level, price, sort])
  const filtered = useMemo(() => filterCourses(rows, query), [rows, query])
  const pager = paginate(filtered, page)
  const stats = courseStats(rows)
  const cats = uniqueCourseValues(rows, 'category')
  const levels = uniqueCourseValues(rows, 'level')
  const tutors = uniqueTutors(rows)
  const hasDemo = rows.some(r => r.demo)
  const unsupported = tab === 'review' || tab === 'flagged' || tab === 'paused'

  const emptyCopy = () => {
    if (unsupported) return tab === 'review'
      ? 'Course moderation backend unavailable. Under Review applications will appear when a moderation service is connected.'
      : `${tab === 'flagged' ? 'Flagged' : 'Paused'} course status is not available on catalog records.`
    if (q.trim()) return 'No courses match your search.'
    return 'No courses yet.'
  }

  const filters = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      <label className="text-[11px] font-semibold text-muted">
        Published
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={publish} onChange={e => setPublish(e.target.value as PublishFilter)}>
          <option value="all">All</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>
      </label>
      {cats.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Category
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All</option>
            {cats.map(v => <option key={v} value={v}>{v}</option>)}
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
      {levels.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Difficulty
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">All</option>
            {levels.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      <label className="text-[11px] font-semibold text-muted">
        Price
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={price} onChange={e => setPrice(e.target.value as PriceFilter)}>
          <option value="all">All</option>
          <option value="free">Free / unset</option>
          <option value="paid">Paid</option>
        </select>
      </label>
      <label className="text-[11px] font-semibold text-muted">
        Sort
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={sort} onChange={e => setSort(e.target.value as CourseSort)}>
          <option value="recommended">Recommended</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title_asc">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
          <option value="students">Students</option>
        </select>
      </label>
    </div>
  )

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Course Moderation</h1>
            <p className="text-[13px] text-muted">Review course quality, publishing status, and platform content.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFiltersOpen(true)}>Filters</button>
            <button type="button" className="btn-primary text-xs" onClick={() => setTab('draft')}>Review Pending →</button>
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
          <div className="glass rounded-2xl p-3 mb-4 text-sm ac-warn">Demo Course Data — Not Production Data. Demo records are excluded from counts.</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          {[
            ['Total Courses', loading ? null : stats.total],
            ['Published', loading ? null : stats.published],
            ['Draft', loading ? null : stats.draft],
            ['Under Review', loading ? null : stats.underReview],
            ['Flagged', loading ? null : stats.flagged],
            ['Paused', loading ? null : stats.paused],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink">{v}</strong>}
            </div>
          ))}
        </div>

        <div className="flex flex-nowrap gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Course status">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <label className="sr-only" htmlFor="course-search">Search courses</label>
          <input id="course-search" className="field flex-1 min-w-[12rem] px-3 py-1.5 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search courses..." />
          {q && <button type="button" className="btn-glass text-xs" onClick={() => setQ('')}>Clear Search</button>}
        </div>
        <div className="hidden lg:block mb-3">{filters}</div>

        {loading && (
          <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading courses">
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
                  <th className="px-3 py-2">Course</th>
                  <th className="px-3 py-2">Tutor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Moderation</th>
                  <th className="px-3 py-2">Students</th>
                  <th className="px-3 py-2">Rating</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((c: AdminCourseRow) => (
                  <tr key={c.id} style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{c.title}{c.demo ? ' · Demo' : c.catalog ? ' · Catalog' : ''}</div>
                      <div className="text-[11px] text-muted">{c.category || '—'}</div>
                    </td>
                    <td className="px-3 py-2">{c.tutorName}</td>
                    <td className="px-3 py-2">{courseStatusLabel(c.published)}</td>
                    <td className="px-3 py-2 text-muted">Unavailable</td>
                    <td className="px-3 py-2">{c.studentCount}</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">{formatWhen(c.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/courses/${c.id}`)}>Review →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="ac-mobile-cards space-y-2 mb-3">
            {pager.slice.map((c: AdminCourseRow) => (
              <article key={c.id} className="glass rounded-2xl p-3">
                <div className="font-semibold text-ink">{c.title}{c.demo ? ' · Demo' : c.catalog ? ' · Catalog' : ''}</div>
                <p className="text-[12px] text-muted">{c.tutorName} · {courseStatusLabel(c.published)} · Moderation: Unavailable</p>
                <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted">
                  <span>Students {c.studentCount}</span>
                  <span>Rating —</span>
                  <span>Updated —</span>
                  <span>Created {formatWhen(c.createdAt)}</span>
                </div>
                <button type="button" className="btn-primary text-xs mt-2" onClick={() => navigate(`/admin/courses/${c.id}`)}>Review →</button>
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
        <p className="text-[11px] text-muted mt-2">Page size {coursesPageSize()}. Catalog publish/unpublish is available on the course detail page.</p>
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
