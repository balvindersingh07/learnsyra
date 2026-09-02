import { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CareerHubNav from '../components/career/CareerHubNav'
import { useAuth } from '../context/AuthContext'
import {
  computeReadiness,
  getCareerProfile,
  getCertificates,
  getMyEnrollments,
  getMyStudentProjects,
  getProjects,
} from '../lib/api'
import {
  emptyCareerSnapshot,
  getCareerSnapshot,
  loadWeeklyActions,
  saveWeeklyActions,
  statusFor,
  type CareerMatch,
  type CareerSnapshot,
} from '../lib/careerCenter'
import { careerSummaryText, hydrateCareerData, parseCareerBlob } from '../lib/careerPersistence'
import { tutorBookPath } from '../lib/paths'
import './career-center.css'

const RING = 339.292

function useCountUp(to: number) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 800)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return n
}

function Heading({ children }: { children: string }) {
  return (
    <h2 className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
      {children}
    </h2>
  )
}

function MiniBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">{label}</span>
          <span className="font-bold text-ink career-count">{value}%</span>
        </div>
      )}
      <div className="progress-bar" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function CareerCenter() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const uid = session?.user.id ?? null
  const ringId = useId()
  const [data, setData] = useState<CareerSnapshot>(() => emptyCareerSnapshot())
  const [week, setWeek] = useState(() => emptyCareerSnapshot().weeklyActions)
  const [openMatch, setOpenMatch] = useState<CareerMatch | null>(null)
  const [certNote, setCertNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const shown = useCountUp(data.readinessScore)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setSyncError(null)
    const load = async () => {
      await hydrateCareerData(uid).catch(() => {
        if (alive) setSyncError('Could not sync career data. Showing local data.')
      })
      if (!alive) return
      const [profile, certs, mine, catalog, enrollments] = await Promise.all([
        getCareerProfile().catch(() => null),
        getCertificates().catch(() => []),
        getMyStudentProjects().catch(() => []),
        getProjects().catch(() => []),
        getMyEnrollments().catch(() => []),
      ])
      if (!alive) return
      const titleById = new Map(catalog.map(p => [p.id, p.title]))
      const portfolio = mine.map(row => ({
        id: row.id,
        title: titleById.get(row.project_id) || 'Project',
        score: 0,
        skills: catalog.find(p => p.id === row.project_id)?.skills ?? [],
        status: (row.status === 'completed' ? 'Portfolio Ready' : 'Needs Review') as 'Portfolio Ready' | 'Needs Review',
        href: `/projects/${row.project_id}`,
      }))
      const certificates = certs.map(r => ({
        title: r.title,
        completed: new Date(r.issued_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        official: true,
      }))
      const hasActivity =
        Boolean(profile?.target_role?.trim()) ||
        (profile?.skills?.length ?? 0) > 0 ||
        certs.length > 0 ||
        mine.length > 0 ||
        enrollments.length > 0
      const resumeSummary = careerSummaryText(parseCareerBlob(profile?.resume_text), profile?.resume_text)
      const readiness = hasActivity
        ? computeReadiness({
            enrolledCount: enrollments.length,
            avgProgress:
              enrollments.length > 0
                ? enrollments.reduce((s, e) => s + (e.progress ?? 0), 0) / enrollments.length
                : 0,
            submittedProjects: mine.filter(p => p.status === 'submitted' || p.status === 'completed').length,
            resumeLength: resumeSummary.length,
            targetRole: profile?.target_role ?? '',
          })
        : 0
      const snap = getCareerSnapshot({
        userId: uid,
        targetRole: profile?.target_role,
        readiness: hasActivity ? readiness : undefined,
        skills: profile?.skills,
        certificates,
        portfolio,
      })
      setData(snap)
      setWeek(loadWeeklyActions(snap.weeklyActions, uid))
      setLoading(false)
    }
    load().catch(() => {
      if (!alive) return
      setSyncError('Could not load career data.')
      const snap = getCareerSnapshot({ userId: uid })
      setData(snap)
      setWeek(loadWeeklyActions(snap.weeklyActions, uid))
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [uid])

  useEffect(() => {
    if (!openMatch) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMatch(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openMatch])

  const breakdown = useMemo(
    () => [
      { label: 'Skills', score: data.skillScore },
      { label: 'Projects', score: data.projectScore },
      { label: 'Resume', score: data.resumeScore },
      { label: 'Interview', score: data.interviewScore },
      { label: 'Communication', score: data.communicationScore },
    ],
    [data],
  )

  const doneWeek = week.filter(w => w.done).length
  const nextWeek = week.find(w => !w.done)
  const strong = data.skills.filter(s => s.status === 'strong')
  const improve = data.skills.filter(s => s.status === 'improve')
  const xpPct = Math.round((data.xp.intoLevel / data.xp.levelNeed) * 100)

  const hasLiveActivity = Boolean(
    data.targetRole ||
      data.haveSkills.length ||
      data.portfolio.length ||
      data.certificates.length ||
      data.activity.length ||
      data.readinessScore > 0 ||
      data.interview.overall > 0 ||
      data.resume.score > 0 ||
      data.resume.checks.length,
  )

  const toggleWeek = (id: string) => {
    const next = week.map(w => (w.id === id ? { ...w, done: !w.done } : w))
    setWeek(next)
    saveWeeklyActions(next, uid)
  }

  if (loading) {
    return (
      <div className="pt-20 px-4 sm:px-6 pb-16 max-w-7xl mx-auto overflow-x-hidden">
        <CareerHubNav />
        <p className="text-muted text-sm mt-6">Loading career data…</p>
      </div>
    )
  }

  return (
    <div className="pt-20 px-4 sm:px-6 pb-16 max-w-7xl mx-auto overflow-x-hidden">
      {syncError && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-4" role="alert">
          {syncError}
        </p>
      )}
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Career Center</p>
        <h1
          className="text-3xl sm:text-5xl font-black text-ink mb-3"
          style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
        >
          Turn Your Skills Into Your <span className="gradient-text">Career.</span>
          </h1>
        <p className="text-muted text-base sm:text-lg max-w-2xl leading-relaxed">
          Learn, build real projects, prepare for interviews, and become job-ready with an AI-guided career plan.
        </p>
      </header>

      <CareerHubNav />

      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-5 mb-6">
        <section
          className="glass rounded-3xl p-6 sm:p-8 career-card"
          style={{ boxShadow: '0 0 48px rgba(108,92,231,0.14)' }}
          aria-labelledby="readiness-heading"
        >
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 mx-auto sm:mx-0 flex-shrink-0">
              <svg
                viewBox="0 0 120 120"
                className="w-full h-full career-ring"
                role="img"
                aria-label={`Career readiness ${data.readinessScore} percent`}
                style={{ ['--career-circ' as string]: RING, ['--career-pct' as string]: data.readinessScore }}
              >
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(108,92,231,0.12)" strokeWidth="10" />
              <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke={`url(#${ringId})`}
                  strokeWidth="10"
                  strokeLinecap="round"
                  className="career-ring-fill"
              />
              <defs>
                  <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6C5CE7" />
                    <stop offset="100%" stopColor="#22C7D6" />
                </linearGradient>
              </defs>
            </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl sm:text-5xl font-black text-ink career-count" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                  {shown}%
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-[16rem]">
              <h2 id="readiness-heading" className="text-2xl font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                🎯 Career Readiness
              </h2>
              <p className="text-sm font-semibold text-success mb-2">
                {data.readinessDelta > 0 ? `+${data.readinessDelta}% this month` : 'Getting Started'}
              </p>
              <p className="text-sm text-muted leading-relaxed mb-3">{data.readinessNote}</p>
              {hasLiveActivity && (
                <div className="flex flex-wrap gap-2">
                  <span className="badge badge-primary">✨ Built from your activity</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="glass rounded-3xl p-6 career-card" aria-labelledby="target-heading">
          <h2 id="target-heading" className="text-lg font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            💼 Your Target Role
          </h2>
          <div className="flex items-end justify-between gap-3 mb-2">
            <div className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {data.targetRole || 'Set your target role'}
            </div>
            <div className="text-lg font-black text-primary career-count">
              {data.targetMatch > 0 ? `${data.targetMatch}% Match` : 'Not personalized yet'}
            </div>
          </div>
          <p className="text-sm text-muted mb-4 leading-relaxed">
            {data.targetRole
              ? 'Based on your skills, projects, learning activity and career preferences.'
              : 'Set a target role to see personalized recommendations.'}
          </p>
          {data.haveSkills.length === 0 && data.needSkills.length === 0 ? (
            <p className="text-sm text-muted mb-5">No skills on your profile yet. Add a target role or complete a course to start your skill map.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-2">
                {data.haveSkills.map(s => (
                  <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(32,201,151,0.12)', color: '#0F8A68' }}>
                    ✓ {s}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {data.needSkills.map(s => (
                  <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>
                    ⚠ {s}
                  </span>
                ))}
              </div>
            </>
          )}
          <button type="button" className="btn-primary text-sm" onClick={() => document.getElementById('skill-gaps')?.scrollIntoView({ behavior: 'smooth' })}>
            Improve My Match →
          </button>
        </section>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {breakdown.map(item => (
          <article key={item.label} className="glass rounded-2xl p-4 career-card">
            <div className="text-xs font-semibold text-muted mb-1">{item.label}</div>
            <div className="text-2xl font-black text-ink career-count mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {item.score}%
        </div>
            <MiniBar value={item.score} />
            <div className="text-xs text-muted mt-2">{statusFor(item.score)}</div>
          </article>
        ))}
      </div>

      <section className="glass rounded-3xl p-6 mb-6" style={{ borderColor: 'rgba(108,92,231,0.28)' }} aria-labelledby="coach-heading">
        <h2 id="coach-heading" className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          ✨ Your AI Career Coach
        </h2>
        <blockquote className="text-sm sm:text-base text-ink leading-relaxed mb-5 pl-4" style={{ borderLeft: '3px solid #6C5CE7' }}>
          {data.coachQuote}
        </blockquote>
        <h3 className="text-sm font-bold text-ink mb-3">Recommended Next Actions</h3>
        <ol className="space-y-2 mb-5">
          {data.nextActions.map((a, i) => (
            <li key={a.title}>
              <button
                type="button"
                className="w-full text-left glass rounded-xl px-4 py-3 career-card flex items-center justify-between gap-3"
                onClick={() => navigate(a.href)}
              >
                <span className="text-sm font-semibold text-ink">
                  {i + 1}. {a.title}
                </span>
                <span className="text-xs text-muted flex-shrink-0">{a.minutes} min</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="btn-primary" onClick={() => navigate(data.nextActions[0].href)}>
          Start Recommended Action →
        </button>
      </section>

      <section className="glass rounded-3xl p-6 mb-6" aria-labelledby="roadmap-heading">
        <h2 id="roadmap-heading" className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🗺️ Your Career Roadmap
        </h2>
        <p className="text-sm text-muted mb-4">Learn → Practice → Build → Prepare → Interview → Get Hired</p>
        <div className="career-road flex gap-3 overflow-x-auto pb-2 snap-x" role="list">
          {data.roadmap.map(step => (
            <article
              key={step.id}
              role="listitem"
              className="glass rounded-2xl p-4 career-card min-w-[16.5rem] snap-start flex-shrink-0"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                  {step.label}
                </div>
                <span className="text-xs font-semibold text-primary">{step.status}</span>
              </div>
              <div className="text-2xl font-black text-ink career-count mb-2">{step.progress}%</div>
              <MiniBar value={step.progress} />
              <p className="text-xs text-muted mt-3 mb-4 min-h-[2.5rem]">{step.detail}</p>
              <button type="button" className="btn-glass text-xs w-full py-2" onClick={() => navigate(step.href)}>
                {step.cta}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="skill-gaps" className="glass rounded-3xl p-6 mb-6" aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="text-lg font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🧬 Skills You Need
        </h2>
        <p className="text-sm text-muted mb-5">
          {data.targetRole ? `Target: ${data.targetRole}` : 'Set a target role to see personalized recommendations.'}
        </p>
        {data.skills.length === 0 ? (
          <p className="text-sm text-muted">No skills tracked yet. Enroll in a course or save skills on your career profile.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-ink mb-3">Strong Skills</h3>
              <div className="space-y-4">
                {strong.map(s => (
                  <SkillRow key={s.name} skill={s} onImprove={() => navigate(`/courses?q=${encodeURIComponent(s.courseQuery)}`)} />
                ))}
                {strong.length === 0 && <p className="text-sm text-muted">None marked strong yet.</p>}
                    </div>
                  </div>
            <div>
              <h3 className="text-sm font-bold text-ink mb-3">Skills To Improve</h3>
              <div className="space-y-4">
                {improve.map(s => (
                  <SkillRow key={s.name} skill={s} onImprove={() => navigate(`/courses?q=${encodeURIComponent(s.courseQuery)}`)} />
                ))}
                {improve.length === 0 && <p className="text-sm text-muted">None listed yet.</p>}
                </div>
            </div>
          </div>
        )}
      </section>

      <section className="mb-6" aria-labelledby="matches-heading">
        <Heading>🎯 Career Matches</Heading>
        <p className="text-sm text-muted mb-4">
          Suggested paths to explore — not a personalized score until you add real skills and projects.
        </p>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {data.careerMatches.map(m => (
            <article key={m.id} className="glass rounded-2xl p-5 career-card flex flex-col">
              <div className="text-base font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                {m.title}
              </div>
              <div className="text-2xl font-black text-primary career-count my-2">
                {m.match > 0 ? `${m.match}% Match` : 'Explore this path'}
                  </div>
              {m.strong.length > 0 && <p className="text-xs text-muted mb-2">Strong: {m.strong.join(' · ')}</p>}
              <p className="text-xs text-muted mb-2">Missing: {m.missing.join(' · ')}</p>
              <p className="text-xs text-ink mb-4 flex-1">{m.nextStep}</p>
              <button type="button" className="btn-glass text-xs py-2" onClick={() => setOpenMatch(m)}>
                View Career →
              </button>
            </article>
          ))}
                    </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <section className="glass rounded-3xl p-6" aria-labelledby="portfolio-heading">
          <h2 id="portfolio-heading" className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            💼 Your Portfolio
          </h2>
          <p className="text-sm text-muted mb-4">
            {data.portfolioStats.projects} Projects · {data.portfolioStats.certificates} Certificates · {data.portfolioStats.verified} Skills Verified
          </p>
          {data.portfolio.length === 0 ? (
            <p className="text-sm text-muted mb-4">Complete a project to add it to your portfolio.</p>
          ) : (
            <div className="space-y-3 mb-4">
            {data.portfolio.map(p => (
              <article key={p.id} className="rounded-xl px-4 py-3 career-card" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(99,102,241,0.12)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-ink">{p.title}</div>
                    <div className="text-xs text-muted">{p.skills.join(' · ') || 'Skills update as you build'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-ink career-count">{p.score > 0 ? `${p.score} / 100` : p.status}</div>
                    {p.score > 0 && (
                      <div className="text-xs" style={{ color: p.status === 'Portfolio Ready' ? '#0F8A68' : '#B45309' }}>
                        {p.status}
                    </div>
                    )}
                  </div>
                </div>
                <button type="button" className="text-xs font-semibold text-primary mt-2" onClick={() => navigate(p.href)}>
                  View Project →
                </button>
              </article>
              ))}
        </div>
      )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass text-sm" onClick={() => navigate('/profile')}>
              View Portfolio
            </button>
            <button type="button" className="btn-primary text-sm" onClick={() => navigate('/projects')}>
              Add Project
            </button>
          </div>
        </section>

        <section className="glass rounded-3xl p-6" aria-labelledby="certs-heading">
          <h2 id="certs-heading" className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            🏆 Your Certificates
          </h2>
          {data.certificates.length === 0 ? (
            <p className="text-sm text-muted mb-3">Complete your first course to start building your career profile.</p>
          ) : (
          <div className="space-y-3 mb-3">
            {data.certificates.map(c => (
              <article key={c.title} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(99,102,241,0.12)' }}>
                <div className="text-sm font-bold text-ink">{c.title}</div>
                <div className="text-xs text-muted">Completed: {c.completed}</div>
                {!c.official && <div className="text-xs text-muted mt-1">Course record — not an official credential</div>}
                <div className="flex gap-2 mt-2">
                  <button type="button" className="btn-glass text-xs py-1.5" onClick={() => setCertNote(`${c.title} · ${c.completed}${c.official ? '' : ' · Local course record'}`)}>
                    View Certificate
                  </button>
                  <button type="button" className="btn-glass text-xs py-1.5" onClick={() => setCertNote("Certificate file isn't available yet.")}>
                    Download
                  </button>
                </div>
              </article>
            ))}
          </div>
          )}
          {certNote && <p className="text-sm text-muted">{certNote}</p>}
        </section>
        </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <section className="glass rounded-3xl p-6" aria-labelledby="impact-heading">
          <h2 id="impact-heading" className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            🚀 Projects That Strengthen Your Career
          </h2>
          {data.projectImpact.length === 0 ? (
            <p className="text-sm text-muted">Complete a project to add it to your portfolio.</p>
          ) : (
          data.projectImpact.map(p => (
            <article key={p.title}>
              <div className="text-base font-bold text-ink mb-2">{p.title}</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {p.deltas.map(d => (
                  <span key={d.skill} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(108,92,231,0.1)', color: '#5B4BD6' }}>
                    {d.skill} +{d.delta}%
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted mb-4">
                Career Match <span className="font-bold text-ink">{p.from}%</span> → <span className="font-bold text-primary">{p.to}%</span>
              </p>
              <button type="button" className="btn-primary text-sm" onClick={() => navigate(p.href)}>
                View Project →
              </button>
            </article>
          ))
          )}
        </section>

        <section className="glass rounded-3xl p-6" aria-labelledby="tutor-heading">
          <h2 id="tutor-heading" className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            👨‍🏫 Expert Guidance
          </h2>
          {data.tutorImpact.name ? (
            <>
          <div className="text-base font-bold text-ink">{data.tutorImpact.name}</div>
          <div className="text-sm text-muted mb-3">Session: {data.tutorImpact.session}</div>
          <blockquote className="text-sm text-ink leading-relaxed mb-4 pl-4" style={{ borderLeft: '3px solid #22C7D6' }}>
            {data.tutorImpact.feedback}
          </blockquote>
          <div className="flex flex-wrap gap-2 mb-4">
            {data.tutorImpact.deltas.map(d => (
              <span key={d.skill} className="text-xs font-semibold" style={{ color: '#0F8A68' }}>
                {d.skill} +{d.delta}%
              </span>
          ))}
        </div>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate(tutorBookPath(data.tutorImpact.tutorId))}>
            Book Follow-up →
          </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted mb-4">No tutor sessions yet. Book a mentor when you want expert feedback.</p>
              <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutors')}>
                Browse Tutors →
              </button>
            </>
          )}
        </section>
            </div>

      <div className="grid md:grid-cols-3 gap-5 mb-6">
        <section className="glass rounded-3xl p-6" aria-labelledby="iv-heading">
          <h2 id="iv-heading" className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            🎤 Interview Readiness
          </h2>
          <div className="text-3xl font-black text-ink career-count mb-4">
            {data.interview.overall > 0 ? `${data.interview.overall} / 100` : 'Not started'}
          </div>
          <div className="space-y-2 mb-4">
            {[
              ['Technical', data.interview.technical],
              ['Problem Solving', data.interview.problem],
              ['Communication', data.interview.communication],
              ['Confidence', data.interview.confidence],
            ].map(([l, v]) => (
              <MiniBar key={String(l)} label={String(l)} value={Number(v)} />
            ))}
                </div>
          <p className="text-sm text-muted mb-4">
            <span className="font-bold text-ink">AI Recommendation</span>
            <br />
            {data.interview.overall > 0 ? data.interview.rec : 'Complete an interview to track interview readiness.'}
          </p>
          <button type="button" className="btn-primary text-sm w-full" onClick={() => navigate('/career/interview')}>
            Start AI Interview →
          </button>
        </section>

        <section className="glass rounded-3xl p-6" aria-labelledby="resume-heading">
          <h2 id="resume-heading" className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            📄 Resume Readiness
          </h2>
          <div className="text-3xl font-black text-ink career-count mb-4">
            {data.resume.score > 0 || data.resume.checks.length > 0 ? `${data.resume.score}%` : 'Not created'}
                      </div>
          {data.resume.checks.length === 0 ? (
            <p className="text-sm text-muted mb-5">No resume on file yet. Create one to see completeness checks.</p>
          ) : (
            <ul className="space-y-2 mb-5">
              {data.resume.checks.map(c => (
                <li key={c.label} className="text-sm">
                  <span style={{ color: c.ok ? '#0F8A68' : '#B45309' }}>{c.ok ? '✓' : '⚠'}</span> {c.label}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn-primary text-sm w-full" onClick={() => navigate('/career/resume')}>
            Improve Resume →
          </button>
        </section>

        <section className="glass rounded-3xl p-6" aria-labelledby="jobs-heading">
          <h2 id="jobs-heading" className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            💼 Job Opportunities
          </h2>
          <p className="text-sm text-muted mb-4">
            {data.jobMatches.length > 0 ? `${data.jobMatches.length} matches from the catalog` : 'Set a target role to see personalized recommendations.'}
          </p>
          {data.jobMatches.length === 0 ? (
            <p className="text-sm text-muted mb-4">No personalized job matches yet.</p>
          ) : (
          <div className="space-y-3 mb-4">
            {data.jobMatches.map(j => (
              <article key={j.title}>
                <div className="flex justify-between gap-2">
                  <div className="text-sm font-bold text-ink">{j.title}</div>
                  <div className="text-xs font-black text-primary">{j.match}% Match</div>
                </div>
                <div className="text-xs text-muted">{j.skills.join(' · ')}</div>
              </article>
            ))}
                  </div>
          )}
          <button type="button" className="btn-primary text-sm w-full" onClick={() => navigate('/career/jobs')}>
            View Job Matches →
          </button>
        </section>
                </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <section className="glass rounded-3xl p-6" aria-labelledby="week-heading">
          <h2 id="week-heading" className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            📅 This Week
          </h2>
          <p className="text-sm text-muted mb-3">
            {doneWeek} / {week.length} completed
          </p>
          <ul className="space-y-2 mb-4">
            {week.map(item => (
              <li key={item.id}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="career-check"
                    checked={item.done}
                    onChange={() => toggleWeek(item.id)}
                    aria-label={item.label}
                  />
                  <span className={item.done ? 'text-muted line-through' : 'text-ink'}>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary text-sm w-full" onClick={() => navigate(nextWeek?.href ?? '/courses')}>
            Continue Plan →
          </button>
        </section>

        <section className="glass rounded-3xl p-6" aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            Career Activity
          </h2>
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted mb-4">No career activity yet. Completing lessons, projects, or interviews will show up here.</p>
          ) : (
            <ol className="space-y-3 mb-4">
              {data.activity.map(a => (
                <li key={a.when} className="text-sm">
                  <div className="text-xs font-semibold text-primary">{a.when}</div>
                  <div className="text-ink">{a.text}</div>
                </li>
              ))}
            </ol>
          )}
          {data.xp.total > 0 && <div className="text-sm font-bold text-ink">+{Math.min(120, data.xp.total)} Career XP</div>}
        </section>

        <section className="glass rounded-3xl p-6 career-xp" aria-labelledby="xp-heading">
          <h2 id="xp-heading" className="text-lg font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            ⭐ Career XP
          </h2>
          <div className="text-3xl font-black text-ink career-count">{data.xp.total.toLocaleString()} XP</div>
          <p className="text-sm text-muted mb-3">
            {data.xp.levelName} — Level {data.xp.level}
          </p>
          <MiniBar value={xpPct} label={`${data.xp.intoLevel} / ${data.xp.levelNeed} XP`} />
          <p className="text-xs text-muted mt-3">Next milestone: {data.xp.next}</p>
        </section>
      </div>

      <section className="glass rounded-3xl p-6 mb-6" aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          ✨ Your 30-Day Career Plan
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {data.aiPlan.map(w => (
            <article key={w.week} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(99,102,241,0.12)' }}>
              <div className="text-sm font-black text-ink">{w.week}</div>
              <div className="text-sm text-muted mb-3">{w.focus}</div>
              <MiniBar value={w.progress} />
              {w.week === 'Week 1' && <p className="text-xs text-muted mt-2">Week 1 — {w.progress}% complete</p>}
            </article>
          ))}
        </div>
        <button type="button" className="btn-glass text-sm" onClick={() => document.getElementById('plan-heading')?.scrollIntoView({ behavior: 'smooth' })}>
          View Full Plan →
        </button>
      </section>

      <section className="glass rounded-3xl p-6 text-center" aria-labelledby="path-heading">
        <h2 id="path-heading" className="text-lg font-black text-ink mb-5" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Career Success Path
        </h2>
        <ol className="max-w-xs mx-auto">
          {['Current Skills', 'Skill Gaps', 'Courses', 'Projects', 'Portfolio', 'AI Interview', 'Job Matches'].map(step => (
            <li key={step} className="career-path-step text-sm font-semibold text-ink">
              {step}
            </li>
          ))}
          <li className="text-base font-black text-primary pt-1">🎯 Get Hired</li>
        </ol>
      </section>

      {openMatch && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(23,32,51,0.45)' }}
          onClick={() => setOpenMatch(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-title"
            className="glass rounded-3xl p-6 w-full max-w-lg career-modal-in"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="role-title" className="text-2xl font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {openMatch.title}
            </h2>
            <p className="text-sm text-muted mb-4">
              {openMatch.match > 0 ? `Match ${openMatch.match}%` : 'Not a personalized match yet — this is a career path to explore.'}
            </p>
            <h3 className="text-sm font-bold text-ink mb-2">Required Skills</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {openMatch.strong.map(s => (
                <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(32,201,151,0.12)', color: '#0F8A68' }}>
                  {s} ✓
                </span>
              ))}
              {openMatch.missing.map(s => (
                <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>
                  {s} ⚠
                </span>
              ))}
            </div>
            {openMatch.projects.length > 0 && (
              <p className="text-sm text-muted mb-1">
                <span className="font-bold text-ink">Recommended Projects</span> — {openMatch.projects.join(', ')}
              </p>
            )}
            <p className="text-sm text-muted mb-1">
              <span className="font-bold text-ink">Recommended Courses</span> — {openMatch.courses.join(', ')}
            </p>
            <p className="text-sm text-muted mb-5">
              {openMatch.interview > 0 ? `Interview Readiness ${openMatch.interview}%` : 'Complete an interview to track interview readiness.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => { setOpenMatch(null); navigate('/career/interview') }}>
                Prepare for This Role →
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => setOpenMatch(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SkillRow({
  skill,
  onImprove,
}: {
  skill: CareerSnapshot['skills'][number]
  onImprove: () => void
}) {
  const gap = skill.target - skill.score
  return (
    <article className="career-card rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(99,102,241,0.1)' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-bold text-ink">{skill.name}</div>
        <div className="text-xs font-semibold text-muted career-count">
          {skill.score}% → {skill.target}%
        </div>
      </div>
      <MiniBar value={skill.score} />
      <p className="text-xs text-muted mt-2 mb-2">Gap: {gap} points · Recommended: {skill.recommended}</p>
      {skill.status === 'improve' && (
        <button type="button" className="btn-glass text-xs py-1.5" onClick={onImprove}>
          Improve Skill →
        </button>
      )}
    </article>
  )
}
