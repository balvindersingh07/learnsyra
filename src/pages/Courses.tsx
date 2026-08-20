import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Page } from '../App'
import { useAuth } from '../context/AuthContext'
import CourseCard from '../components/courses/CourseCard'
import CourseFilters, { EMPTY_FILTERS, type MarketFilters } from '../components/courses/CourseFilters'
import {
  getBookmarks,
  getCareerProfile,
  getCourses,
  getMyEnrolledCourses,
  toggleBookmark,
  type CourseRow,
} from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import {
  buildCatalog,
  CAREER_PATHS,
  durationBucket,
  findByTitle,
  FRONTEND_PATH,
  formatInr,
  formatStudents,
  loadLocalWishlist,
  MARKET_CATEGORIES,
  matchesCategory,
  POPULAR_SEARCHES,
  priceBucket,
  recommendForStudent,
  relatedSearch,
  saveLocalWishlist,
  SKILL_GAPS,
  type CatalogCourse,
} from '../lib/courseCatalog'
import './courses-market.css'

interface Props {
  onNav: (p: Page, extra?: string) => void
}

const SORTS = [
  'Recommended',
  'Most Popular',
  'Highest Rated',
  'Newest',
  'Price: Low to High',
  'Price: High to Low',
] as const

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

export default function Courses({ onNav }: Props) {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [cat, setCat] = useState('All')
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Recommended')
  const [filters, setFilters] = useState<MarketFilters>(EMPTY_FILTERS)
  const [rows, setRows] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrolled, setEnrolled] = useState<(CourseRow & { progress: number; last_lesson_id: string | null })[]>([])
  const [careerGoal, setCareerGoal] = useState('')
  const [wish, setWish] = useState<Set<string>>(() => new Set(loadLocalWishlist()))
  const [toast, setToast] = useState<string | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [pathOpen, setPathOpen] = useState(false)
  const [pathGoal, setPathGoal] = useState('I want to become a frontend developer.')
  const [showCompare, setShowCompare] = useState(false)

  const catalog = useMemo(() => buildCatalog(rows), [rows])

  useEffect(() => {
    const q = params.get('q')
    if (q) setSearch(q)
  }, [params])

  useEffect(() => {
    getCourses()
      .then(setRows)
      .catch(e => setError(e.message ?? 'Failed to load courses'))
      .finally(() => setLoading(false))
    getMyEnrolledCourses().then(setEnrolled).catch(() => setEnrolled([]))
    getCareerProfile()
      .then(p => {
        if (p?.target_role) setCareerGoal(p.target_role)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!session) return
    getBookmarks()
      .then(ids => {
        setWish(prev => {
          const next = new Set([...prev, ...ids])
          saveLocalWishlist([...next])
          return next
        })
      })
      .catch(() => {})
  }, [session])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ping = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  const applySearch = (q: string) => {
    setSearch(q)
    setParams(q ? { q } : {})
  }

  const rec = useMemo(() => recommendForStudent(catalog), [catalog])
  const recCourse = catalog.find(c => c.id === rec?.courseId)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = catalog.filter(c => {
      if (!matchesCategory(c, cat)) return false
      if (filters.levels.length && !filters.levels.includes(c.level)) return false
      if (filters.duration && durationBucket(c.durationHours) !== filters.duration) return false
      if (filters.price && priceBucket(c.price) !== filters.price) return false
      if (filters.rating != null && (c.rating <= 0 || c.rating < filters.rating)) return false
      if (filters.support.includes('AI Tutor') && !c.aiSupport) return false
      if (filters.support.includes('Human Tutor') && !c.tutorSupport) return false
      if (filters.support.includes('Projects') && !c.projects) return false
      if (filters.support.includes('Certificate') && !c.certificate) return false
      if (
        q &&
        !`${c.title} ${c.skills.join(' ')} ${c.category} ${c.instructor} ${c.description}`.toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (Boolean(a.demo) !== Boolean(b.demo)) return a.demo ? 1 : -1
      if (sort === 'Most Popular') return (b.students ?? -1) - (a.students ?? -1)
      if (sort === 'Highest Rated') return b.rating - a.rating
      if (sort === 'Newest') return +new Date(b.createdAt) - +new Date(a.createdAt)
      if (sort === 'Price: Low to High') return a.price - b.price
      if (sort === 'Price: High to Low') return b.price - a.price
      const ar = a.aiRecommended ? 1 : 0
      const br = b.aiRecommended ? 1 : 0
      if (br !== ar) return br - ar
      return b.rating - a.rating
    })
    return list
  }, [catalog, cat, filters, search, sort])

  const popular = catalog.filter(c =>
    ['Full Stack Web Development', 'Data Analytics with Python', 'AI & Machine Learning', 'Business Analytics'].includes(c.title),
  )
  const newest = [...catalog].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).filter(c => c.badges.includes('New')).slice(0, 4)
  const free = catalog.filter(c => c.price === 0).slice(0, 4)
  const compareRows = catalog.filter(c => compare.includes(c.id))

  const openCourse = (c: CatalogCourse) => onNav('course-detail', c.id)

  const toggleWish = async (id: string) => {
    const on = !wish.has(id)
    setWish(prev => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      saveLocalWishlist([...next])
      return next
    })
    ping(on ? 'Saved to wishlist' : 'Removed from wishlist')
    if (session && !id.startsWith('catalog-')) {
      try {
        await toggleBookmark(id)
      } catch {
        /* local state already updated */
      }
    }
  }

  const toggleCompare = (id: string) => {
    setCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 3) {
        ping('Compare up to 3 courses')
        return prev
      }
      return [...prev, id]
    })
  }

  const goAi = (prompt: string) => {
    setPendingAiPrompt(prompt)
    onNav('ai-learning')
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setCat('All')
  }

  const cardProps = (c: CatalogCourse) => ({
    course: c,
    wished: wish.has(c.id),
    comparing: compare.includes(c.id),
    onOpen: () => openCourse(c),
    onWish: () => toggleWish(c.id),
    onToggleCompare: () => toggleCompare(c.id),
  })

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
          Learn Skills That Move Your Career Forward.
        </h1>
        <p className="text-muted text-base md:text-lg max-w-3xl leading-relaxed mb-6">
          Explore AI-powered courses, learn from expert instructors, build real projects, and prepare for your next career step.
        </p>
        {catalog.some(c => c.demo) && (
          <p className="text-sm text-muted mb-4">Sample catalog cards are labeled Demo Course — Not Production Data and are not used as live ratings or enrollment counts.</p>
        )}
        <form
          className="flex items-center gap-3 rounded-2xl p-3 mb-3"
          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.14)', boxShadow: '0 12px 32px rgba(23,32,51,0.05)' }}
          onSubmit={e => {
            e.preventDefault()
            applySearch(search)
          }}
        >
          <svg className="w-5 h-5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => applySearch(e.target.value)}
            placeholder="Search courses, skills, or topics..."
            aria-label="Search courses, skills, or topics"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder-muted"
          />
          <kbd className="hidden sm:inline text-[11px] text-subtle px-2 py-1 rounded-lg" style={{ border: '1px solid rgba(99,102,241,0.16)' }}>/</kbd>
          <button type="submit" className="btn-primary text-sm py-2 px-4">Search</button>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>Popular:</span>
          {POPULAR_SEARCHES.map(p => (
            <button
              key={p}
              type="button"
              className="text-primary font-medium cursor-pointer"
              style={{ background: 'none', border: 'none' }}
              onClick={() => applySearch(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="glass rounded-2xl p-5 mb-8"><div className="dash-skel h-24 w-full" /></div>
      ) : rec && recCourse ? (
        <section className="glass rounded-2xl p-5 md:p-6 mb-8 dash-elevate">
          <div className="text-sm font-semibold text-primary mb-1">Explore Courses</div>
          <p className="text-sm text-muted mb-4">Recommended catalog course — not a personal learning-path match.</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                {recCourse.title}
              </h2>
              {rec.match > 0 && (
                <div className="text-sm font-semibold text-primary mb-3">{rec.match}% match for your learning path</div>
              )}
              <ul className="text-sm text-muted space-y-1 mb-3">
                {rec.reasons.map(r => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {rec.badges.map(b => (
                  <span key={b} className="badge badge-primary">{b}</span>
                ))}
              </div>
              <button type="button" className="btn-primary text-sm" onClick={() => openCourse(recCourse)}>
                View Course →
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="glass rounded-2xl p-5 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            {careerGoal ? 'Your Career Goal' : 'Choose your career goal'}
          </div>
          <div className="text-lg font-black text-ink mt-0.5">{careerGoal || 'Not set'}</div>
          <p className="text-sm text-muted">
            {careerGoal ? 'These courses can help you reach your goal faster.' : 'Start your learning journey — explore available courses below.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-glass text-sm" onClick={() => onNav('career')}>
            {careerGoal ? 'Update Career Goal' : 'Set Career Goal'}
          </button>
        </div>
      </section>

      {enrolled.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>📚 Continue Learning</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {enrolled.slice(0, 2).map(c => (
              <div key={c.id} className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-ink">{c.title}</div>
                  <div className="text-sm text-muted">{c.progress}% complete</div>
                  {c.last_lesson_id ? (
                    <div className="text-xs text-muted mt-1">Continue where you left off</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary text-sm" onClick={() => onNav('course-detail', c.id)}>
                    Continue Learning →
                  </button>
                  <button
                    type="button"
                    className="btn-glass text-sm"
                    onClick={() => goAi(`Help me continue ${c.title}.`)}
                  >
                    Resume with AI →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Start your learning journey</h2>
        {SKILL_GAPS.length === 0 ? (
          <div className="glass rounded-2xl p-5 text-sm text-muted">
            Skill gaps appear after you set a career goal and add skills. Explore available courses below.
          </div>
        ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {SKILL_GAPS.map(g => {
            const recC = findByTitle(catalog, g.courseTitle)
            return (
              <div key={g.skill} className="glass rounded-2xl p-4">
                {loading ? <div className="dash-skel h-16 w-full" /> : (
                  <>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-bold text-ink">{g.skill}</span>
                      <span className="text-muted">{g.score}% proficiency</span>
                    </div>
                    <div className="progress-bar-soft mb-3">
                      <div className="progress-fill" style={{ width: `${g.score}%` }} />
                    </div>
                    <div className="text-sm text-muted mb-3">Recommended course: <span className="font-semibold text-ink">{g.courseTitle}</span></div>
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => (recC ? openCourse(recC) : applySearch(g.skill))}
                    >
                      Improve Skills →
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Career paths</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {CAREER_PATHS.map(p => (
            <div key={p.id} className="glass rounded-2xl p-4">
              <div className="text-sm font-bold text-ink mb-2">{p.icon} {p.title}</div>
              <div className="text-xs text-muted leading-relaxed mb-3">{p.steps.join(' → ')}</div>
              <button
                type="button"
                className="text-sm font-semibold text-primary cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0 }}
                onClick={() => {
                  setPathGoal(`I want to ${p.title.replace('Become ', 'become ').toLowerCase()}.`)
                  setPathOpen(true)
                }}
              >
                View Learning Path →
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>🔥 Popular Right Now</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading
            ? [1, 2, 3, 4].map(i => <SkeletonCard key={i} />)
            : popular.map(c => <CourseCard key={c.id} {...cardProps(c)} />)}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>✨ New on LearnSyra</h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading
            ? [1, 2, 3, 4].map(i => <SkeletonCard key={i} />)
            : newest.map(c => <CourseCard key={c.id} {...cardProps(c)} />)}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>🎁 Start Learning for Free</h2>
          <button type="button" className="text-sm font-semibold text-primary" style={{ background: 'none', border: 'none' }} onClick={() => { setFilters({ ...EMPTY_FILTERS, price: 'free' }); setCat('All') }}>
            Explore Free Courses →
          </button>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {free.map(c => <CourseCard key={c.id} {...cardProps(c)} />)}
        </div>
      </section>

      <section className="glass rounded-2xl p-5 mb-10">
        <h2 className="text-base font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>✨ Not sure what to learn?</h2>
        <p className="text-sm text-muted mb-3">Tell LearnSyra your goal and we will recommend a learning path.</p>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            value={pathGoal}
            onChange={e => setPathGoal(e.target.value)}
            className="field flex-1 px-3 py-2 text-sm"
            aria-label="Your learning goal"
          />
          <button type="button" className="btn-primary text-sm" onClick={() => setPathOpen(true)}>
            Build My Learning Path →
          </button>
        </div>
        {pathOpen && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(108,92,231,0.06)' }}>
            <div className="text-sm font-bold text-ink mb-2">Explore this path</div>
            <ol className="text-sm text-muted space-y-1 mb-4">
              {FRONTEND_PATH.map((s, i) => (
                <li key={s.title}>
                  <span className="font-semibold text-ink">{i + 1}. {s.title}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => goAi(`Build a learning path for this goal: ${pathGoal}`)}
            >
              Start Learning Path →
            </button>
          </div>
        )}
      </section>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-5" style={{ scrollbarWidth: 'thin' }}>
        {MARKET_CATEGORIES.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className="px-4 py-1.5 rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap flex-shrink-0"
            style={{
              fontFamily: 'Plus Jakarta Sans,sans-serif',
              background: cat === c ? 'rgba(108,92,231,0.16)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${cat === c ? 'rgba(108,92,231,0.4)' : 'rgba(99,102,241,0.12)'}`,
              color: cat === c ? '#6C5CE7' : '#667085',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-6">
        <aside className="hidden lg:block w-56 flex-shrink-0 glass rounded-2xl p-4 sticky top-24">
          <CourseFilters
            value={filters}
            category={cat}
            onCategory={setCat}
            onChange={setFilters}
            onClear={clearFilters}
          />
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm font-semibold text-ink">{filtered.length} courses</div>
            <div className="flex items-center gap-2">
              <button type="button" className="lg:hidden btn-glass text-sm py-2" onClick={() => setFilterOpen(true)}>
                Filters
              </button>
              <label className="text-sm text-muted flex items-center gap-2">
                Sort
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as (typeof SORTS)[number])}
                  className="field text-sm px-2 py-1.5"
                >
                  {SORTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              {compare.length > 0 && (
                <button type="button" className="btn-primary text-sm py-2" onClick={() => setShowCompare(true)}>
                  Compare Courses ({compare.length})
                </button>
              )}
            </div>
          </div>

          {error && <div className="glass rounded-2xl p-4 text-sm text-rose-500 mb-4">{error}</div>}

          {loading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <h3 className="text-lg font-bold text-ink mb-2">🔍 No exact match</h3>
              <p className="text-sm text-muted mb-4">We could not find that course, but LearnSyra can help you find an alternative.</p>
              <button type="button" className="btn-primary text-sm mb-5" onClick={() => goAi(`I searched for "${search}" on LearnSyra. Suggest the closest courses and a learning path.`)}>
                Ask LearnSyra
              </button>
              <div className="flex flex-wrap justify-center gap-2">
                {relatedSearch(search).map(t => (
                  <button
                    key={t}
                    type="button"
                    className="btn-glass text-sm"
                    onClick={() => {
                      const hit = findByTitle(catalog, t)
                      if (hit) openCourse(hit)
                      else applySearch(t)
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(c => <CourseCard key={c.id} {...cardProps(c)} />)}
            </div>
          )}
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" style={{ background: 'rgba(23,32,51,0.32)' }} onClick={() => setFilterOpen(false)} role="presentation">
          <div className="w-[min(100%,320px)] h-full overflow-y-auto p-5" style={{ background: '#F7F9FC' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-ink">Filters</span>
              <button type="button" className="btn-glass text-sm py-1.5" aria-label="Close filters" onClick={() => setFilterOpen(false)}>✕</button>
            </div>
            <CourseFilters value={filters} category={cat} onCategory={setCat} onChange={setFilters} onClear={clearFilters} />
          </div>
        </div>
      )}

      {showCompare && compareRows.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.32)' }} onClick={() => setShowCompare(false)} role="presentation">
          <div className="glass rounded-2xl p-5 w-full max-w-4xl overflow-x-auto" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="compare-title">
            <div className="flex items-center justify-between mb-3">
              <h3 id="compare-title" className="text-lg font-bold text-ink">Compare Courses</h3>
              <button type="button" className="btn-glass text-sm" onClick={() => setShowCompare(false)}>Close</button>
            </div>
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr>
                  <th className="text-left py-2 text-muted font-medium"> </th>
                  {compareRows.map(c => (
                    <th key={c.id} className="text-left py-2 px-2 text-ink">{c.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-muted">
                {[
                  ['Duration', (c: CatalogCourse) => `${c.durationHours} hours`],
                  ['Level', (c: CatalogCourse) => c.level],
                  ['Rating', (c: CatalogCourse) => (c.rating > 0 ? String(c.rating) : '—')],
                  ['Students', (c: CatalogCourse) => formatStudents(c.students)],
                  ['Projects', (c: CatalogCourse) => (c.projects ? 'Yes' : 'No')],
                  ['AI Support', (c: CatalogCourse) => (c.aiSupport ? 'Yes' : 'No')],
                  ['Tutor Support', (c: CatalogCourse) => (c.tutorSupport ? 'Yes' : 'No')],
                  ['Certificate', (c: CatalogCourse) => (c.certificate ? 'Yes' : 'No')],
                  ['Price', (c: CatalogCourse) => formatInr(c.price)],
                ].map(([label, fn]) => (
                  <tr key={String(label)} style={{ borderTop: '1px solid rgba(99,102,241,0.1)' }}>
                    <td className="py-2 font-medium text-ink">{label as string}</td>
                    {compareRows.map(c => (
                      <td key={c.id} className="py-2 px-2">{(fn as (c: CatalogCourse) => string)(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
