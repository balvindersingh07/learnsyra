import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getTutorListings, type TutorListing } from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import {
  buildTutorCatalog,
  formatHourly,
  formatStudentsPlus,
  loadTutorWishlist,
  matchesCategory,
  POPULAR_TUTOR_SEARCHES,
  priceBucket,
  recommendTutor,
  saveTutorWishlist,
  TUTOR_CATEGORIES,
  type CatalogTutor,
} from '../lib/tutorMarketplace'
import TutorCard from '../components/tutors/TutorCard'
import TutorAvatar from '../components/tutors/TutorAvatar'
import TutorFilters, { EMPTY_TUTOR_FILTERS, type TutorFiltersState } from '../components/tutors/TutorFilters'
import { tutorBookPath, tutorPath } from '../lib/paths'
import './tutor-market.css'

const SORTS = [
  'Recommended',
  'Highest Rated',
  'Most Experienced',
  'Lowest Price',
  'Most Students',
  'Available Soon',
] as const

export default function TutorMarketplace() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const recRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<TutorListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [need, setNeed] = useState(params.get('need') ?? 'I need help with React Hooks and my project.')
  const [cat, setCat] = useState<(typeof TUTOR_CATEGORIES)[number]>('All Tutors')
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Recommended')
  const [filters, setFilters] = useState<TutorFiltersState>(EMPTY_TUTOR_FILTERS)
  const [wish, setWish] = useState<Set<string>>(() => new Set(loadTutorWishlist()))
  const [filterOpen, setFilterOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const catalog = useMemo(() => buildTutorCatalog(rows), [rows])

  useEffect(() => {
    getTutorListings()
      .then(setRows)
      .catch(e => setError(e.message ?? 'Failed to load tutors'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const q = params.get('q')
    if (q) setSearch(q)
  }, [params])

  const ping = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  const recQuery = search || need
  const rec = useMemo(() => recommendTutor(catalog, recQuery), [catalog, recQuery])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = catalog.filter(t => {
      if (!matchesCategory(t, cat)) return false
      if (filters.subject && t.subject !== filters.subject) return false
      if (filters.skills.length && !filters.skills.some(s => t.skills.some(ts => ts.toLowerCase() === s.toLowerCase()))) {
        return false
      }
      if (filters.experience === '1to3' && (t.experienceYears < 1 || t.experienceYears > 3)) return false
      if (filters.experience === '3to5' && (t.experienceYears < 4 || t.experienceYears > 5)) return false
      if (filters.experience === '5to10' && (t.experienceYears < 6 || t.experienceYears > 10)) return false
      if (filters.experience === '10plus' && t.experienceYears < 10) return false
      if (filters.price && priceBucket(t.hourlyRate) !== filters.price) return false
      if (filters.rating != null && (t.rating <= 0 || t.rating < filters.rating)) return false
      if (filters.availability.includes('today') && !t.availability.today) return false
      if (filters.availability.includes('week') && !t.availability.thisWeek) return false
      if (filters.availability.includes('now') && !t.availability.onlineNow) return false
      if (filters.support.length && !filters.support.every(s => t.support.includes(s as CatalogTutor['support'][number]))) {
        return false
      }
      if (
        q &&
        !`${t.name} ${t.title} ${t.skills.join(' ')} ${t.expertise.join(' ')} ${t.subject} ${t.careerSpecialties.join(' ')} ${t.intro}`.toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      if (Boolean(a.demo) !== Boolean(b.demo)) return a.demo ? 1 : -1
      if (sort === 'Highest Rated') return b.rating - a.rating
      if (sort === 'Most Experienced') return b.experienceYears - a.experienceYears
      if (sort === 'Lowest Price') return a.hourlyRate - b.hourlyRate
      if (sort === 'Most Students') return b.students - a.students
      if (sort === 'Available Soon') return Number(b.availability.today) - Number(a.availability.today) || Number(b.availability.onlineNow) - Number(a.availability.onlineNow)
      const ar = a.fromTutorHub ? 1 : 0
      const br = b.fromTutorHub ? 1 : 0
      if (br !== ar) return br - ar
      return b.rating - a.rating
    })
    return list
  }, [catalog, cat, filters, search, sort])

  const top = catalog.filter(t => ['Dr. Sarah Kim', 'Rahul Mehta', 'Priya Sharma', 'Arjun Kapoor'].includes(t.name))
  const today = catalog.filter(t => t.availability.today && t.availability.slotsToday.length).slice(0, 4)
  const specialists = catalog.filter(t => t.support.includes('project')).slice(0, 4)
  const mentors = catalog.filter(t => t.support.includes('career') && t.careerSpecialties.length).slice(0, 4)

  const toggleWish = (id: string) => {
    setWish(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveTutorWishlist([...next])
      return next
    })
    ping(wish.has(id) ? 'Removed from saved' : 'Tutor saved')
  }

  const findTutor = () => {
    setSearch(need)
    setParams(need ? { q: need } : {})
    recRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cardProps = (t: CatalogTutor) => ({
    tutor: t,
    wished: wish.has(t.id),
    showMatch: t.aiMatch >= 80,
    onProfile: () => navigate(tutorPath(t.id)),
    onBook: () => navigate(tutorBookPath(t.id)),
    onWish: () => toggleWish(t.id),
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
          Learn From Experts. Build With Confidence.
        </h1>
        <p className="text-muted text-base md:text-lg max-w-3xl leading-relaxed mb-6">
          Connect with experienced tutors who can help you understand difficult concepts, review projects, prepare for interviews, and reach your career goals.
        </p>
        {catalog.some(t => t.demo) && (
          <p className="text-sm text-muted mb-4">Sample tutor cards are labeled Demo Tutor — Not Production Data and are excluded from live ratings and student counts.</p>
        )}
        <form
          className="flex items-center gap-3 rounded-2xl p-3 mb-3"
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(99,102,241,0.14)',
            boxShadow: '0 12px 32px rgba(23,32,51,0.05)',
          }}
          onSubmit={e => {
            e.preventDefault()
            setParams(search ? { q: search } : {})
          }}
        >
          <label className="sr-only" htmlFor="tutor-search">
            Search tutors
          </label>
          <input
            id="tutor-search"
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tutors, skills, or subjects..."
            className="field flex-1 px-4 py-2.5 text-sm"
          />
        </form>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>Popular:</span>
          {POPULAR_TUTOR_SEARCHES.map(p => (
            <button
              key={p}
              type="button"
              className="text-primary font-medium cursor-pointer"
              style={{ background: 'none', border: 'none' }}
              onClick={() => {
                setSearch(p)
                setParams({ q: p })
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {rec && (
        <section ref={recRef} className="glass rounded-3xl p-5 md:p-7 mb-8 tm-match" style={{ borderColor: 'rgba(108,92,231,0.22)' }}>
          <div className="text-sm font-semibold text-primary mb-1">✨ Best Tutor For You</div>
          <p className="text-sm text-muted mb-4">Based on your current course, skills, project and learning progress.</p>
          <div className="flex flex-col md:flex-row gap-5">
            <TutorAvatar name={rec.name} size={88} />
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                {rec.name}
              </h2>
              {rec.demo && <div className="badge badge-amber mb-2">Demo Tutor — Not Production Data</div>}
              <div className="text-sm text-muted mb-2">{rec.expertise.join(' · ')}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mb-3">
                {rec.rating > 0 ? <span className="font-semibold text-ink">⭐ {rec.rating.toFixed(1)}</span> : <span>—</span>}
                {rec.students > 0 ? <span>{formatStudentsPlus(rec.students)}</span> : <span>No student data yet.</span>}
                {rec.hourlyRate > 0 ? <span className="font-bold text-ink">{formatHourly(rec.hourlyRate)}</span> : null}
              </div>
              {rec.aiMatch > 0 && <div className="text-sm font-bold text-primary mb-2">{rec.aiMatch}% Match</div>}
              {rec.matchReasons.length > 0 && (
              <ul className="text-sm text-muted space-y-1 mb-3">
                {rec.matchReasons.map(r => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              )}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {rec.badges.slice(0, 3).map(b => (
                  <span key={b} className="badge badge-primary">
                    {b}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" onClick={() => navigate(tutorPath(rec.id))}>
                  View Profile →
                </button>
                <button type="button" className="btn-glass" onClick={() => navigate(tutorBookPath(rec.id))}>
                  Book Session →
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="glass rounded-2xl p-5 mb-8 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-ink mb-1">🤖 Not sure who to choose?</h2>
          <p className="text-sm text-muted mb-3">Tell LearnSyra what you&apos;re struggling with and we&apos;ll find the right tutor.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={need}
              onChange={e => setNeed(e.target.value)}
              className="field flex-1 px-4 py-2.5 text-sm"
              aria-label="What you need help with"
            />
            <button type="button" className="btn-primary text-sm" onClick={findTutor}>
              Find My Tutor →
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn-glass text-sm"
          onClick={() => {
            setPendingAiPrompt(need || 'Help me choose a tutor for React Hooks and my current project.')
            navigate('/ai-learning')
          }}
        >
          Ask LearnSyra
        </button>
      </section>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Tutor categories">
          {TUTOR_CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              className="tm-pill px-4 py-2 rounded-xl text-sm font-medium cursor-pointer whitespace-nowrap"
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

      <div className="flex gap-6 mb-12">
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="glass rounded-2xl p-4 sticky top-24">
            <TutorFilters
              value={filters}
              onChange={setFilters}
              onClear={() => {
                setFilters(EMPTY_TUTOR_FILTERS)
                setCat('All Tutors')
              }}
            />
          </div>
        </aside>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-sm text-muted">
              <span className="font-semibold text-ink">{filtered.length} tutors</span>
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
          {loading && <div className="glass rounded-2xl p-8 text-center text-muted">Loading tutors…</div>}
          {error && <div className="glass rounded-2xl p-4 mb-4 text-rose-500 text-sm">{error}</div>}
          {!loading && filtered.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center text-muted">No tutors match those filters.</div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map(t => (
              <TutorCard key={t.id} {...cardProps(t)} />
            ))}
          </div>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-xl font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          ⭐ Top Tutors
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {top.map(t => (
            <button
              key={t.id}
              type="button"
              className="glass rounded-2xl p-4 text-left card-hover cursor-pointer"
              onClick={() => navigate(tutorPath(t.id))}
            >
              <div className="flex items-center gap-3 mb-2">
                <TutorAvatar name={t.name} size={44} />
                <div className="min-w-0">
                  <div className="font-bold text-ink text-sm truncate">{t.name}</div>
                  <div className="text-xs text-muted truncate">{t.expertise.join(' · ')}</div>
                </div>
              </div>
              <div className="text-xs text-muted">⭐ {t.rating.toFixed(1)} · {formatHourly(t.hourlyRate)}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🟢 Available Today
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {today.map(t => (
            <div key={t.id} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <TutorAvatar name={t.name} size={44} />
                <div>
                  <div className="font-bold text-ink text-sm">{t.name}</div>
                  <div className="text-xs text-muted">Today</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {t.availability.slotsToday.map(slot => (
                  <span key={slot} className="badge badge-primary">
                    {slot}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => navigate(`${tutorBookPath(t.id)}?time=${encodeURIComponent(t.availability.slotsToday[0] ?? '')}`)}
              >
                Book {t.availability.slotsToday[0]} →
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🚀 Project Specialists
        </h2>
        <p className="text-sm text-muted mb-4">Get help building your real-world projects.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {specialists.map(t => (
            <div key={t.id} className="glass rounded-2xl p-4">
              <div className="font-bold text-ink mb-1">{t.name}</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {['Project Help', 'Code Review', 'Architecture', 'Debugging'].map(b => (
                  <span key={b} className="badge">{b}</span>
                ))}
              </div>
              <div className="text-xs text-muted mb-1">Specialties: {t.expertise.join(' · ')}</div>
              <div className="text-xs text-muted mb-3">
                Best for: {t.projects[0]?.title ?? 'Portfolio projects'}
              </div>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => navigate(`${tutorBookPath(t.id)}?type=project`)}
              >
                Get Project Help →
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xl font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          💼 Career Mentors
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {mentors.map(t => (
            <div key={t.id} className="glass rounded-2xl p-4">
              <div className="font-bold text-ink text-sm">{t.name}</div>
              <div className="text-xs text-muted mb-2">{t.expertise.join(' · ')}</div>
              <div className="text-xs text-muted mb-3">⭐ {t.rating.toFixed(1)} · {formatHourly(t.hourlyRate)}</div>
              <button type="button" className="btn-primary text-sm w-full" onClick={() => navigate(tutorPath(t.id))}>
                View Profile →
              </button>
            </div>
          ))}
        </div>
      </section>

      {filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Filters">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: 'rgba(23,32,51,0.35)', border: 'none' }}
            aria-label="Close filters"
            onClick={() => setFilterOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[min(100%,20rem)] tm-drawer bg-white p-5 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-ink">Filters</span>
              <button type="button" className="btn-glass text-sm py-1.5" onClick={() => setFilterOpen(false)}>
                Done
              </button>
            </div>
            <TutorFilters
              value={filters}
              onChange={setFilters}
              onClear={() => {
                setFilters(EMPTY_TUTOR_FILTERS)
                setCat('All Tutors')
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
