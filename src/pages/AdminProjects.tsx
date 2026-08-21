import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  filterProjects,
  loadAdminProjectIndex,
  paginate,
  projectReviewSummary,
  projectStats,
  projectStatusLabel,
  projectsPageSize,
  uniqueProjectSkills,
  uniqueProjectValues,
  type AdminProjectIndex,
  type AdminProjectRow,
  type BuildFilter,
  type ProjectQuery,
  type ProjectSort,
  type ProjectTab,
  type ReviewFilter,
} from '../lib/adminProjects'
import './admin-control.css'

const TABS: { id: ProjectTab; label: string }[] = [
  { id: 'all', label: 'All Projects' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Draft' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'review', label: 'Needs Review' },
]

export default function AdminProjects() {
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminProjectIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ProjectTab>('all')
  const [q, setQ] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [skill, setSkill] = useState('')
  const [build, setBuild] = useState<BuildFilter>('all')
  const [review, setReview] = useState<ReviewFilter>('all')
  const [sort, setSort] = useState<ProjectSort>('recommended')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminProjectIndex()
      .then(setIndex)
      .catch(() => setError("Projects couldn't be loaded right now."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [tab, q, difficulty, skill, build, review, sort])
  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen])

  const rows = index?.catalog ?? []
  const buildsAvailable = index?.buildsAvailable ?? false
  const query: ProjectQuery = useMemo(
    () => ({ tab, q, difficulty, skill, build, review, sort }),
    [tab, q, difficulty, skill, build, review, sort],
  )
  const filtered = useMemo(() => filterProjects(rows, query, buildsAvailable), [rows, query, buildsAvailable])
  const pager = paginate(filtered, page)
  const stats = index ? projectStats(index) : null
  const diffs = uniqueProjectValues(rows, 'difficulty')
  const skills = uniqueProjectSkills(rows)
  const hasDemo = rows.some(r => r.demo) || (index?.builds.some(b => b.demo) ?? false)
  const needsReview = stats ? Number(stats.needsReview) : 0
  const showQueue = Boolean(buildsAvailable && Number.isFinite(needsReview) && needsReview > 0)
  const unsupportedPublish = tab === 'published' || tab === 'draft'
  const unsupportedBuilds = (tab === 'active' || tab === 'completed' || tab === 'review') && !buildsAvailable

  const emptyCopy = () => {
    if (unsupportedPublish) return `${tab === 'published' ? 'Published' : 'Draft'} project status is not available on catalog records.`
    if (unsupportedBuilds) return 'Student project activity unavailable. This tab will populate when student project records can be loaded.'
    if (tab === 'review') return 'No projects currently need tutor review.'
    if (tab === 'active') return 'No active student builds yet.'
    if (tab === 'completed') return 'No completed project reviews yet.'
    if (q.trim()) return 'No projects match your search.'
    return 'No projects yet.'
  }

  const filters = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {diffs.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Difficulty
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
            <option value="">All</option>
            {diffs.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {skills.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Skills
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={skill} onChange={e => setSkill(e.target.value)}>
            <option value="">All</option>
            {skills.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {buildsAvailable && (
        <>
          <label className="text-[11px] font-semibold text-muted">
            Build status
            <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={build} onChange={e => setBuild(e.target.value as BuildFilter)}>
              <option value="all">All</option>
              <option value="active">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="text-[11px] font-semibold text-muted">
            Review status
            <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={review} onChange={e => setReview(e.target.value as ReviewFilter)}>
              <option value="all">All</option>
              <option value="not_submitted">Not Submitted</option>
              <option value="needs_review">Needs Review</option>
              <option value="approved">Approved</option>
            </select>
          </label>
        </>
      )}
      <label className="text-[11px] font-semibold text-muted">
        Sort
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={sort} onChange={e => setSort(e.target.value as ProjectSort)}>
          <option value="recommended">Recommended</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title_asc">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
          {diffs.length > 0 && <option value="difficulty">Difficulty</option>}
          {buildsAvailable && <option value="builds">Builds</option>}
        </select>
      </label>
    </div>
  )

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Project Management</h1>
            <p className="text-[13px] text-muted">Monitor project content, submissions, reviews, and platform activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFiltersOpen(true)}>Filters</button>
            {showQueue && <button type="button" className="btn-primary text-xs" onClick={() => setTab('review')}>Review Queue →</button>}
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
          <div className="glass rounded-2xl p-3 mb-4 text-sm ac-warn">Demo Project Data — Not Production Data. Demo records are excluded from counts, submissions, and reviews.</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          {[
            ['Catalog Projects', loading ? null : stats?.total],
            ['Published', loading ? null : stats?.published],
            ['Draft', loading ? null : stats?.draft],
            ['Active Builds', loading ? null : stats?.activeBuilds],
            ['Submissions', loading ? null : stats?.submissions],
            ['Needs Review', loading ? null : stats?.needsReview],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink">{v}</strong>}
            </div>
          ))}
        </div>

        <div className="flex flex-nowrap gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Project status">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <label className="sr-only" htmlFor="project-search">Search projects</label>
          <input id="project-search" className="field flex-1 min-w-[12rem] px-3 py-1.5 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects..." />
          {q && <button type="button" className="btn-glass text-xs" onClick={() => setQ('')}>Clear Search</button>}
        </div>
        <div className="hidden lg:block mb-3">{filters}</div>

        {loading && (
          <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading projects">
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
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Creator</th>
                  <th className="px-3 py-2">Difficulty</th>
                  <th className="px-3 py-2">Skills</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Builds</th>
                  <th className="px-3 py-2">Submissions</th>
                  <th className="px-3 py-2">Review</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pager.slice.map((p: AdminProjectRow) => (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{p.title}{p.demo ? ' · Demo' : ''}</div>
                      <div className="text-[11px] text-muted">{p.id}</div>
                    </td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">{p.difficulty || '—'}</td>
                    <td className="px-3 py-2">{p.skills.length ? p.skills.slice(0, 3).join(', ') : '—'}</td>
                    <td className="px-3 py-2">{projectStatusLabel()}</td>
                    <td className="px-3 py-2">{buildsAvailable ? p.buildCount : '—'}</td>
                    <td className="px-3 py-2">{buildsAvailable ? p.submissionCount : '—'}</td>
                    <td className="px-3 py-2">{projectReviewSummary(p, buildsAvailable)}</td>
                    <td className="px-3 py-2">—</td>
                    <td className="px-3 py-2">
                      <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/projects/${p.id}`)}>Review →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <div className="ac-mobile-cards space-y-2 mb-3">
            {pager.slice.map((p: AdminProjectRow) => (
              <article key={p.id} className="glass rounded-2xl p-3">
                <div className="font-semibold text-ink">{p.title}</div>
                <p className="text-[12px] text-muted">Creator — · {p.difficulty || '—'} · {projectStatusLabel()}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-muted">
                  <span>Skills {p.skills.length ? p.skills.slice(0, 3).join(', ') : '—'}</span>
                  <span>Builds {buildsAvailable ? p.buildCount : '—'}</span>
                  <span>Submissions {buildsAvailable ? p.submissionCount : '—'}</span>
                </div>
                <button type="button" className="btn-primary text-xs mt-2" onClick={() => navigate(`/admin/projects/${p.id}`)}>Review →</button>
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
        <p className="text-[11px] text-muted mt-2">Page size {projectsPageSize()}. Tutors continue to review student work in their own workspace.</p>
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
