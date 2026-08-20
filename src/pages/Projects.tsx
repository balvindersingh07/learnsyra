import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProjectCard from '../components/projects/ProjectCard'
import ProjectFilters, {
  EMPTY_PROJECT_FILTERS,
  type ProjectFiltersState,
} from '../components/projects/ProjectFilters'
import {
  getMyStudentProjects,
  getProjects,
  startProject,
  type ProjectRow,
  type StudentProjectRow,
} from '../lib/api'
import {
  buildProjectCatalog,
  formatDuration,
  loadAllProgress,
  loadProjectWishlist,
  mergeApiStatus,
  progressPct,
  recommendProject,
  saveAllProgress,
  saveProjectWishlist,
  timeBucket,
  PROJECT_CATEGORIES,
  type CatalogProject,
  type ProjectProgress,
} from '../lib/projectWorkspace'
import { projectPath, projectWorkspacePath } from '../lib/paths'
import './projects-workspace.css'

const SORTS = ['Recommended', 'Popular', 'Newest', 'Difficulty', 'Shortest Time'] as const
const MINE_TABS = ['All', 'In Progress', 'Completed', 'Saved'] as const
const SEARCH_EXAMPLES = ['React', 'Python', 'Data Analytics', 'AI', 'Finance']

function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="dash-skel h-32 w-full mb-3" />
      <div className="dash-skel h-4 w-3/4 mb-2" />
      <div className="dash-skel h-3 w-1/2 mb-4" />
      <div className="dash-skel h-8 w-full" />
    </div>
  )
}

function statusOf(p: CatalogProject, map: Record<string, ProjectProgress>) {
  return map[p.id]?.status ?? 'not-started'
}

export default function Projects() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<(typeof PROJECT_CATEGORIES)[number]>('All')
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Recommended')
  const [filters, setFilters] = useState<ProjectFiltersState>(EMPTY_PROJECT_FILTERS)
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [mine, setMine] = useState<Record<string, StudentProjectRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wish, setWish] = useState<Set<string>>(() => new Set(loadProjectWishlist()))
  const [progressMap, setProgressMap] = useState<Record<string, ProjectProgress>>(() => loadAllProgress())
  const [toast, setToast] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [mineTab, setMineTab] = useState<(typeof MINE_TABS)[number]>('All')
  const [busyId, setBusyId] = useState<string | null>(null)

  const catalog = useMemo(() => buildProjectCatalog(rows), [rows])

  useEffect(() => {
    Promise.all([
      getProjects(),
      session ? getMyStudentProjects() : Promise.resolve([] as StudentProjectRow[]),
    ])
      .then(([list, mineRows]) => {
        setRows(list)
        const map: Record<string, StudentProjectRow> = {}
        mineRows.forEach(r => {
          map[r.project_id] = r
        })
        setMine(map)
        setProgressMap(prev => {
          const next = { ...prev }
          mineRows.forEach(r => {
            const existing = next[r.project_id]
            if (existing) next[r.project_id] = mergeApiStatus(existing, r)
          })
          saveAllProgress(next)
          return next
        })
      })
      .catch(e => setError(e.message ?? 'Failed to load projects'))
      .finally(() => setLoading(false))
  }, [session])

  const ping = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  const completedIds = catalog
    .filter(p => {
      const st = progressMap[p.id]?.status
      return st === 'completed' || st === 'submitted' || mine[p.id]?.status === 'completed' || mine[p.id]?.status === 'submitted'
    })
    .map(p => p.id)

  const rec = useMemo(() => recommendProject(catalog, completedIds), [catalog, completedIds.join('|')])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = catalog.filter(p => {
      if (cat !== 'All' && p.category !== cat) return false
      if (filters.difficulty.length && !filters.difficulty.includes(p.difficulty)) return false
      if (filters.time && timeBucket(p.estimatedMinutes) !== filters.time) return false
      if (filters.skills.length && !filters.skills.some(s => p.skills.some(ps => ps.toLowerCase().includes(s.toLowerCase())))) {
        return false
      }
      if (filters.support.includes('ai') && !p.aiSupport) return false
      if (filters.support.includes('tutor') && !p.tutorSupport) return false
      if (filters.career.includes('portfolio') && !p.portfolioReady) return false
      if (filters.career.includes('interview') && !p.interviewPractice) return false
      if (filters.career.includes('job') && !p.careerRelevant) return false
      if (
        q &&
        !`${p.title} ${p.skills.join(' ')} ${p.category} ${p.description} ${p.tagline}`.toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
    const rank = { Beginner: 0, Intermediate: 1, Advanced: 2 }
    list = [...list].sort((a, b) => {
      if (sort === 'Popular') return Number(b.popular) - Number(a.popular) || b.skillMatch - a.skillMatch
      if (sort === 'Newest') return +new Date(b.createdAt) - +new Date(a.createdAt)
      if (sort === 'Difficulty') return rank[a.difficulty] - rank[b.difficulty]
      if (sort === 'Shortest Time') return a.estimatedMinutes - b.estimatedMinutes
      const ar = a.aiRecommended ? 1 : 0
      const br = b.aiRecommended ? 1 : 0
      if (br !== ar) return br - ar
      return b.skillMatch - a.skillMatch
    })
    return list
  }, [catalog, cat, filters, search, sort])

  const mineList = useMemo(() => {
    return catalog.filter(p => {
      const st = statusOf(p, progressMap)
      const saved = wish.has(p.id)
      if (mineTab === 'Saved') return saved
      if (mineTab === 'In Progress') return st === 'in-progress'
      if (mineTab === 'Completed') return st === 'completed' || st === 'submitted'
      return st !== 'not-started' || saved
    })
  }, [catalog, progressMap, wish, mineTab])

  const toggleWish = (id: string) => {
    setWish(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveProjectWishlist([...next])
      return next
    })
    ping(wish.has(id) ? 'Removed from saved' : 'Saved to wishlist')
  }

  const begin = async (project: CatalogProject, toWorkspace: boolean) => {
    setBusyId(project.id)
    setProgressMap(prev => {
      const current = prev[project.id]
      const next = {
        ...prev,
        [project.id]: {
          ...(current ?? {
            status: 'in-progress' as const,
            tasks: {},
            files: Object.fromEntries(project.files.map(f => [f.path, f.content])),
            ranSuccessfully: false,
            readmeAdded: false,
            codeReviewed: false,
            testsCompleted: false,
          }),
          status: (current?.status === 'completed' || current?.status === 'submitted'
            ? current.status
            : 'in-progress') as ProjectProgress['status'],
        },
      }
      saveAllProgress(next)
      return next
    })
    if (session && !project.id.startsWith('catalog-')) {
      const { error: err } = await startProject(project.id)
      if (err) setError(err)
    }
    setBusyId(null)
    navigate(toWorkspace ? projectWorkspacePath(project.id) : projectPath(project.id))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="pt-20 px-6 pb-28 max-w-7xl mx-auto overflow-x-hidden">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-2 text-sm font-semibold text-ink">
          {toast}
        </div>
      )}

      <section className="mb-10">
        <h1
          className="text-3xl md:text-4xl font-black text-ink mb-3"
          style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
        >
          Build Real Skills Through Real Projects
        </h1>
        <p className="text-muted text-base md:text-lg max-w-3xl leading-relaxed mb-6">
          Apply what you learn, build portfolio-ready work, and prove your skills.
        </p>
        <form
          className="flex items-center gap-3 rounded-2xl p-3 mb-3"
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(99,102,241,0.14)',
            boxShadow: '0 12px 32px rgba(23,32,51,0.05)',
          }}
          onSubmit={e => {
            e.preventDefault()
          }}
        >
          <label className="sr-only" htmlFor="project-search">
            Search projects
          </label>
          <input
            id="project-search"
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects, skills, or career goals..."
            className="field flex-1 px-4 py-2.5 text-sm"
          />
        </form>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          {SEARCH_EXAMPLES.map(ex => (
            <button
              key={ex}
              type="button"
              className="px-3 py-1.5 rounded-full cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(99,102,241,0.12)' }}
              onClick={() => setSearch(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      </section>

      {rec && (
        <section className="glass rounded-3xl p-5 md:p-7 mb-10" style={{ borderColor: 'rgba(108,92,231,0.22)' }}>
          <div className="text-sm font-semibold text-primary mb-2">Explore Projects</div>
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                {rec.title}
              </h2>
              <p className="text-sm text-muted leading-relaxed mb-4">
                Available project — catalog recommendation, not your assigned project.
              </p>
              {rec.aiReason && rec.skillMatch === 0 && (
                <p className="text-sm text-muted leading-relaxed mb-4">{rec.aiReason}</p>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
                {rec.skillMatch > 0 && (
                  <span className="badge badge-primary">{rec.skillMatch}% Skill Match</span>
                )}
                <span className="badge badge-amber">{rec.difficulty}</span>
                <span className="badge">{formatDuration(rec.estimatedMinutes)}</span>
                {rec.badges.slice(0, 3).map(b => (
                  <span key={b} className="badge badge-primary">
                    {b}
                  </span>
                ))}
              </div>
              <div className="text-sm text-muted mb-5">{rec.skills.join(' · ')}</div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === rec.id}
                  onClick={() => begin(rec, true)}
                >
                  Start Project →
                </button>
                <button type="button" className="btn-glass" onClick={() => navigate(projectPath(rec.id))}>
                  View Details
                </button>
              </div>
            </div>
            <div
              className="w-full lg:w-56 h-36 lg:h-auto rounded-2xl flex items-center justify-center text-4xl text-white font-black"
              style={{ background: `linear-gradient(135deg, ${rec.visual.color}, #22C7D6)` }}
            >
              {rec.visual.icon}
            </div>
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-xl font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          My Projects
        </h2>
        <div className="flex gap-2 mb-4" role="tablist" aria-label="My projects">
          {MINE_TABS.map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={mineTab === t}
              className="pw-tab px-3 py-1.5 rounded-xl text-sm font-semibold cursor-pointer"
              data-active={mineTab === t}
              style={{
                border: '1px solid rgba(99,102,241,0.14)',
                background: mineTab === t ? undefined : 'rgba(255,255,255,0.9)',
                color: mineTab === t ? undefined : '#667085',
              }}
              onClick={() => setMineTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {mineList.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-sm text-muted">
            No projects here yet. Start one from the marketplace below.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mineList.slice(0, 6).map(p => {
              const prog = progressMap[p.id]
              const pct = prog ? progressPct(p, prog) : 0
              return (
                <button
                  key={p.id}
                  type="button"
                  className="glass rounded-2xl p-4 text-left cursor-pointer card-hover"
                  onClick={() => navigate(projectPath(p.id))}
                >
                  <div className="text-sm font-bold text-ink mb-1">{p.title}</div>
                  <div className="text-xs text-muted mb-2">
                    {p.skills.slice(0, 3).join(' · ')}
                    {prog?.score ? ` · ${prog.score} / 100` : ''}
                    {prog?.completedAt ? ` · ${new Date(prog.completedAt).toLocaleDateString()}` : ''}
                    {prog?.inPortfolio ? ' · In portfolio' : ''}
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill pw-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-muted mt-1">{pct}% · {statusOf(p, progressMap).replace('-', ' ')}</div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Project categories">
          {PROJECT_CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              className="pw-pill px-4 py-2 rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap"
              data-active={cat === c}
              style={{
                background: cat === c ? undefined : 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(99,102,241,0.12)',
                color: cat === c ? undefined : '#667085',
              }}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button type="button" className="lg:hidden btn-glass text-sm py-2 flex-shrink-0" onClick={() => setFilterOpen(true)}>
          Filters
        </button>
      </div>

      <div className="flex gap-6">
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="glass rounded-2xl p-4 sticky top-24">
            <ProjectFilters value={filters} onChange={setFilters} onClear={() => setFilters(EMPTY_PROJECT_FILTERS)} />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm text-muted">
              <span className="font-semibold text-ink">{filtered.length} Projects</span>
            </div>
            <label className="text-sm text-muted">
              Sort
              <select
                className="field ml-2 text-sm py-1.5 px-2"
                value={sort}
                onChange={e => setSort(e.target.value as (typeof SORTS)[number])}
              >
                {SORTS.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading && (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}
          {error && !loading && <div className="glass rounded-2xl p-8 text-center text-rose-400">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center text-muted">No projects match those filters.</div>
          )}
          {!loading && (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  progress={progressMap[p.id]}
                  wished={wish.has(p.id)}
                  onOpen={() => navigate(projectPath(p.id))}
                  onStart={() => begin(p, true)}
                  onWish={() => toggleWish(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Filters">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: 'rgba(23,32,51,0.35)', border: 'none' }}
            aria-label="Close filters"
            onClick={() => setFilterOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[min(100%,20rem)] pw-drawer bg-white p-5 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-ink">Filters</span>
              <button type="button" className="btn-glass text-sm py-1.5" onClick={() => setFilterOpen(false)}>
                Done
              </button>
            </div>
            <ProjectFilters value={filters} onChange={setFilters} onClear={() => setFilters(EMPTY_PROJECT_FILTERS)} />
          </div>
        </div>
      )}
    </div>
  )
}
