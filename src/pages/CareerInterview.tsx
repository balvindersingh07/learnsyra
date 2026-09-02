import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CareerHubNav from '../components/career/CareerHubNav'
import InterviewResults from '../components/career/InterviewResults'
import InterviewSession, { ContextBody } from '../components/career/InterviewSession'
import { getCareerProfile } from '../lib/api'
import { getCareerSnapshot, loadWeeklyActions, saveWeeklyActions } from '../lib/careerCenter'
import { careerSummaryText, hydrateCareerData } from '../lib/careerPersistence'
import {
  applyInterviewOverlay,
  appendHistory,
  defaultDifficulty,
  finalizeInterview,
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_DURATIONS,
  INTERVIEW_KINDS,
  INTERVIEW_ROLES,
  kindLabel,
  liveHint,
  loadHistory,
  loadLive,
  mixCounts,
  PROJECT_PRACTICE,
  questionCountFor,
  relativeWhen,
  saveLive,
  startLive,
  TS_COURSE_ID,
  type AnswerMode,
  type InterviewDifficulty,
  type InterviewKind,
  type InterviewRecord,
  type InterviewRole,
  type InterviewSetup,
  type LiveInterview,
} from '../lib/interviewStudio'
import { coursePath } from '../lib/paths'
import { useAuth } from '../context/AuthContext'
import './career-center.css'
import './interview-studio.css'

const RING = 339.292

type Phase = 'setup' | 'session' | 'complete' | 'results'

export default function CareerInterview() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [params] = useSearchParams()
  const ringId = useId()
  const [career, setCareer] = useState(() => getCareerSnapshot())
  const ending = useRef(false)
  const autoPractice = useRef(false)
  const [phase, setPhase] = useState<Phase>('setup')
  const [role, setRole] = useState<InterviewRole | ''>(
    INTERVIEW_ROLES.includes(career.targetRole as InterviewRole) ? (career.targetRole as InterviewRole) : '',
  )
  const [kind, setKind] = useState<InterviewKind>('mixed')
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>(() => defaultDifficulty(career.readinessScore))
  const [duration, setDuration] = useState<10 | 20 | 30>(20)
  const [useResume, setUseResume] = useState(false)
  const [useProjects, setUseProjects] = useState(true)
  const [roleOpen, setRoleOpen] = useState(false)
  const [hasResume, setHasResume] = useState(false)
  const [live, setLive] = useState<LiveInterview | null>(null)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [history, setHistory] = useState<InterviewRecord[]>([])
  const [result, setResult] = useState<InterviewRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const shown = career.interview.overall

  useEffect(() => {
    let alive = true
    setLoading(true)
    setSyncError(null)
    hydrateCareerData(session?.user.id ?? null)
      .then(() => {
        if (!alive) return
        setCareer(getCareerSnapshot({ userId: session?.user.id ?? null }))
        setHistory(loadHistory())
        return getCareerProfile()
      })
      .then(p => {
        if (!alive || !p) return
        if (p.target_role && INTERVIEW_ROLES.includes(p.target_role as InterviewRole)) {
          setRole(p.target_role as InterviewRole)
        }
        const summary = careerSummaryText(null, p.resume_text)
        if (summary.length > 20) {
          setHasResume(true)
          setUseResume(true)
        }
      })
      .catch(() => {
        if (!alive) return
        setSyncError('Could not sync interview history. Showing local data.')
        setHistory(loadHistory())
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    const existing = loadLive()
    if (existing && existing.questions.length) {
      setLive(existing)
      setPhase(existing.index >= existing.questions.length ? 'complete' : 'session')
    }
    return () => {
      alive = false
    }
  }, [session?.user.id])

  useEffect(() => {
    const practice = params.get('practice')
    if (!practice || autoPractice.current) return
    if (loadLive()) return
    const map: Record<string, { kind: InterviewKind; duration: 10 | 20 | 30; difficulty: InterviewDifficulty; projects?: boolean }> = {
      typescript: { kind: 'technical', duration: 10, difficulty: 'Intermediate' },
      'system-design': { kind: 'system-design', duration: 10, difficulty: 'Intermediate' },
      confidence: { kind: 'behavioral', duration: 10, difficulty: 'Beginner' },
      project: { kind: 'project', duration: 10, difficulty: 'Intermediate', projects: true },
    }
    const spec = map[practice]
    if (!spec || !role) return
    autoPractice.current = true
    ending.current = false
    const created = startLive(
      {
        role,
        kind: spec.kind,
        difficulty: spec.difficulty,
        duration: spec.duration,
        useResume,
        useProjects: spec.projects ?? useProjects,
      },
      5,
    )
    setLive(created)
    saveLive(created)
    setPhase('session')
  }, [params, role, useResume, useProjects])

  useEffect(() => {
    if (phase !== 'session' || !live) return
    const t = window.setInterval(() => {
      setLive(cur => {
        if (!cur) return cur
        const remainingSec = Math.max(0, cur.remainingSec - 1)
        const next = { ...cur, remainingSec }
        if (remainingSec % 10 === 0) saveLive(next)
        return next
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [phase, live?.id])

  useEffect(() => {
    if (!roleOpen && !ctxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleOpen(false)
        setCtxOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [roleOpen, ctxOpen])

  const setup: InterviewSetup | null = role
    ? { role, kind, difficulty, duration, useResume, useProjects }
    : null
  const lastScore = history[0]?.score ?? career.interview.overall

  function persistLive(next: LiveInterview) {
    setLive(next)
    saveLive(next)
  }

  function begin(nextSetup = setup, count?: number) {
    if (!nextSetup) {
      setRoleOpen(true)
      return
    }
    ending.current = false
    const created = startLive(nextSetup, count ?? questionCountFor(nextSetup.duration))
    persistLive(created)
    setPhase('session')
    setCtxOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function patchAnswer(text: string, mode: AnswerMode) {
    if (!live) return
    const answers = live.answers.slice()
    const current = answers[live.index] ?? {
      questionId: live.questions[live.index].id,
      text: '',
      skipped: false,
      mode,
      askedAt: new Date().toISOString(),
      submittedAt: '',
    }
    answers[live.index] = { ...current, text, mode, skipped: false }
    persistLive({ ...live, answers, hint: null })
  }

  function commit(skipped: boolean) {
    if (!live) return
    const q = live.questions[live.index]
    const existing = live.answers[live.index]
    const text = existing?.text ?? ''
    if (!skipped && !text.trim()) return
    const answers = live.answers.slice()
    answers[live.index] = {
      questionId: q.id,
      text,
      skipped,
      mode: existing?.mode ?? 'text',
      askedAt: existing?.askedAt ?? new Date().toISOString(),
      submittedAt: new Date().toISOString(),
    }
    const hint = liveHint(text, skipped)
    persistLive({ ...live, answers, hint })
    const nextIndex = live.index + 1
    window.setTimeout(() => {
      if (nextIndex >= live.questions.length) {
        finish({ ...live, answers, index: nextIndex, hint })
      } else {
        persistLive({ ...live, answers, index: nextIndex, hint: null })
      }
    }, 550)
  }

  function finish(session: LiveInterview) {
    if (ending.current) return
    ending.current = true
    const filled = {
      ...session,
      answers: session.questions.map((q, i) =>
        session.answers[i] ?? {
          questionId: q.id,
          text: '',
          skipped: true,
          mode: 'text' as const,
          askedAt: session.startedAt,
          submittedAt: new Date().toISOString(),
        },
      ),
    }
    const record = finalizeInterview(filled, lastScore, career.readinessScore)
    appendHistory(record)
    applyInterviewOverlay(record)
    const week = loadWeeklyActions(getCareerSnapshot().weeklyActions)
    saveWeeklyActions(week.map(w => (w.id === 'w3' ? { ...w, done: true } : w)))
    setHistory(loadHistory())
    setResult(record)
    setCareer(getCareerSnapshot())
    setLive(null)
    saveLive(null)
    setPhase('complete')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (phase === 'session' && live && live.remainingSec === 0) finish(live)
  }, [phase, live?.remainingSec])

  function startPractice(id: string) {
    if (!setup) {
      setRoleOpen(true)
      return
    }
    const map: Record<string, InterviewSetup> = {
      typescript: { ...setup, kind: 'technical', duration: 10, difficulty: 'Intermediate' },
      'system-design': { ...setup, kind: 'system-design', duration: 10, difficulty: 'Intermediate' },
      confidence: { ...setup, kind: 'behavioral', duration: 10, difficulty: 'Beginner' },
      project: { ...setup, kind: 'project', duration: 10, useProjects: true },
    }
    begin(map[id] ?? { ...setup, duration: 10 }, 5)
  }

  if (phase === 'session' && live) {
    const mix = mixCounts(live.questions, live.index)
    const pct = Math.round((live.index / Math.max(1, live.questions.length)) * 100)
    return (
      <div className="pt-20 overflow-x-hidden">
        <InterviewSession
          live={live}
          onChange={patchAnswer}
          onSubmit={() => commit(false)}
          onSkip={() => commit(true)}
          onClarify={() => {}}
          onOpenContext={() => setCtxOpen(true)}
        />
        {ctxOpen && (
          <div className="fixed inset-0 z-[60] flex items-end lg:hidden" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setCtxOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Interview context"
              className="iv-drawer glass rounded-t-3xl p-5 w-full career-modal-in"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-base font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                🎯 Interview Context
              </h2>
              <ContextBody live={live} pct={pct} mix={mix} />
              <button type="button" className="btn-glass text-sm mt-4 w-full" onClick={() => setCtxOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'complete' && result) {
    return (
      <div className="pt-20 px-4 sm:px-6 pb-16 max-w-2xl mx-auto text-center overflow-x-hidden">
        <div className="glass rounded-3xl p-8 career-modal-in">
          <h1 className="text-4xl font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            🎉 Interview Complete
          </h1>
          <p className="text-muted mb-6">Great work. Your AI evaluation is ready.</p>
          <button type="button" className="btn-primary" onClick={() => setPhase('results')}>
            View My Results →
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'results' && result) {
    return (
      <div className="pt-20 overflow-x-hidden">
        <div className="px-4 sm:px-6 max-w-5xl mx-auto">
          <CareerHubNav />
        </div>
        <InterviewResults
          record={result}
          history={history}
          onRetake={() => {
            ending.current = false
            setCareer(getCareerSnapshot())
            setResult(null)
            setPhase('setup')
          }}
          onPractice={startPractice}
          onReview={id => {
            const found = history.find(h => h.id === id)
            if (found) setResult(found)
          }}
        />
      </div>
    )
  }

  const qHint = INTERVIEW_DURATIONS.find(d => d.min === duration)?.questions

  if (loading) {
    return (
      <div className="pt-20 px-4 sm:px-6 pb-16 max-w-6xl mx-auto overflow-x-hidden">
        <CareerHubNav />
        <p className="text-muted text-sm mt-6">Loading interview data…</p>
      </div>
    )
  }

  return (
    <div className="pt-20 px-4 sm:px-6 pb-16 max-w-6xl mx-auto overflow-x-hidden">
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
          🎤 AI Interview <span className="gradient-text">Studio</span>
        </h1>
        <p className="text-muted text-base sm:text-lg max-w-2xl leading-relaxed">
          Practice realistic interviews, get instant feedback, and build the confidence to perform in your next real interview.
        </p>
      </header>
      <CareerHubNav />

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <section className="glass rounded-3xl p-6" aria-labelledby="target-heading">
          <h2 id="target-heading" className="text-sm font-semibold text-muted mb-1">🎯 Target Role</h2>
          <div className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            {role || 'Choose a target role'}
          </div>
          <p className="text-sm font-bold text-primary mb-4">{career.targetMatch}% Career Match</p>
          <button type="button" className="btn-glass text-sm" onClick={() => setRoleOpen(true)}>
            Change Role
          </button>
        </section>

        <section className="glass rounded-3xl p-6" style={{ boxShadow: '0 0 40px rgba(108,92,231,0.12)' }} aria-labelledby="ready-heading">
          <div className="flex items-center gap-5">
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg
                viewBox="0 0 120 120"
                className="w-full h-full career-ring"
                role="img"
                aria-label={`Interview readiness ${shown} out of 100`}
                style={{ ['--career-circ' as string]: RING, ['--career-pct' as string]: shown }}
              >
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(108,92,231,0.12)" strokeWidth="10" />
                <circle cx="60" cy="60" r="54" fill="none" stroke={`url(#${ringId})`} strokeWidth="10" strokeLinecap="round" className="career-ring-fill" />
                <defs>
                  <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#6C5CE7" />
                    <stop offset="100%" stopColor="#22C7D6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-ink career-count">{shown}</span>
              </div>
            </div>
            <div className="min-w-0">
              <h2 id="ready-heading" className="text-lg font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                Your Interview Readiness
              </h2>
              <p className="text-2xl font-black text-ink career-count">{shown} / 100</p>
              <p className="text-sm font-semibold text-muted">
                {history.length > 1
                  ? `Latest score ${lastScore} / 100`
                  : 'Complete an interview to see readiness change.'}
              </p>
              <span className="badge badge-primary mt-2 inline-block">✨ AI assessed</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {[
              ['Technical Knowledge', career.interview.technical],
              ['Problem Solving', career.interview.problem],
              ['Communication', career.interview.communication],
              ['Confidence', career.interview.confidence],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">{label}</span>
                  <span className="font-bold text-ink">{value}</span>
                </div>
                <div className="progress-bar" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${Number(value)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">Simulated local snapshot, ready for a future evaluation API.</p>
        </section>
      </div>

      <section id="interview-setup" className="glass rounded-3xl p-6 mb-6" aria-labelledby="start-heading">
        <h2 id="start-heading" className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Start a New Interview
        </h2>
        <fieldset className="mb-5">
          <legend className="text-sm font-bold text-ink mb-2">Role</legend>
          <div className="flex flex-wrap gap-2">
            {INTERVIEW_ROLES.map(r => (
              <button
                key={r}
                type="button"
                className="iv-choice px-3 py-2 rounded-xl text-xs font-semibold border career-card"
                data-on={role === r}
                aria-pressed={role === r}
                onClick={() => setRole(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="text-sm font-bold text-ink mb-2">Interview type</legend>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INTERVIEW_KINDS.map(k => (
              <button
                key={k.id}
                type="button"
                className="iv-choice text-left rounded-2xl p-4 border career-card"
                data-on={kind === k.id}
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
              >
                <div className="text-sm font-black text-ink">
                  {k.title} {k.recommended ? <span className="text-xs font-semibold text-primary">Recommended</span> : null}
                </div>
                <div className="text-xs text-muted mt-1">{k.desc}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <fieldset>
            <legend className="text-sm font-bold text-ink mb-2">Difficulty</legend>
            <div className="flex flex-wrap gap-2">
              {INTERVIEW_DIFFICULTIES.map(d => (
                <button key={d} type="button" className="iv-choice px-3 py-2 rounded-xl text-xs font-semibold border" data-on={difficulty === d} aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-bold text-ink mb-2">Interview length</legend>
            <div className="flex flex-wrap gap-2">
              {INTERVIEW_DURATIONS.map(d => (
                <button key={d.min} type="button" className="iv-choice px-3 py-2 rounded-xl text-xs font-semibold border" data-on={duration === d.min} aria-pressed={duration === d.min} onClick={() => setDuration(d.min)}>
                  {d.min} min
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">{qHint}</p>
          </fieldset>
        </div>

        <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.16)' }}>
          <h3 className="text-sm font-black text-ink mb-2">✨ AI Interview Context</h3>
          <p className="text-sm text-muted mb-3">
            The interview can use your target role, current skills, completed courses, projects, resume profile, and previous interview scores.
          </p>
          <p className="text-sm text-ink">
            <span className="font-bold">Current focus</span> —{' '}
            {career.haveSkills.length ? career.haveSkills.slice(0, 4).join(' · ') : 'Add skills to personalize this interview'}
          </p>
          <p className="text-sm text-ink">
            <span className="font-bold">Needs practice</span> —{' '}
            {career.needSkills.length ? career.needSkills.slice(0, 4).join(' · ') : 'Not set yet'}
          </p>
        </div>

        <h3 className="text-sm font-black text-ink mb-3">Get Ready</h3>
        <ul className="text-sm mb-4 space-y-1">
          <li>{role ? '✓ Target role selected' : '○ Choose a target role'}</li>
          <li>✓ Interview type selected</li>
          <li>{career.haveSkills.length ? '✓ Current skills loaded' : '○ Skills not set yet'}</li>
          <li>{career.portfolio.length ? '✓ Project context loaded' : '○ No projects yet'}</li>
        </ul>
        <div className="flex flex-wrap gap-5 mb-5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="iv-toggle" checked={useResume} onChange={e => setUseResume(e.target.checked)} />
            Use my resume
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="iv-toggle" checked={useProjects} onChange={e => setUseProjects(e.target.checked)} />
            Use my projects
          </label>
        </div>
        {!hasResume && <p className="text-xs text-muted mb-4">Resume context is optional and will connect to the Resume Builder when it is ready.</p>}
        <button type="button" className="btn-primary" onClick={() => begin()} disabled={!role}>
          {role ? 'Start Interview →' : 'Choose a target role'}
        </button>
      </section>

      <section className="glass rounded-3xl p-6 mb-6">
        <h2 className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>🚀 Practice Questions From Your Projects</h2>
        <div className="text-base font-bold text-ink mb-2">{PROJECT_PRACTICE.title}</div>
        <ul className="text-sm text-muted mb-4 space-y-1">
          {PROJECT_PRACTICE.questions.map(item => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
        <button type="button" className="btn-primary text-sm" onClick={() => startPractice('project')}>
          Practice Project Interview →
        </button>
      </section>

      <section className="glass rounded-3xl p-6 mb-6">
        <h2 className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>📄 Resume-Based Interview</h2>
        <p className="text-sm text-muted mb-3">Practice questions based on your actual resume.</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
          <input type="checkbox" className="iv-toggle" checked={useResume} onChange={e => setUseResume(e.target.checked)} />
          Use Resume Context
        </label>
        <p className="text-xs text-muted">You can start without a resume.</p>
      </section>

      <section className="glass rounded-3xl p-6 mb-6">
        <h2 className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>📊 Interview History</h2>
        <div className="space-y-3">
          {history.map(h => (
            <article key={h.id} className="rounded-xl px-4 py-3 career-card flex flex-wrap items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(99,102,241,0.12)' }}>
              <div>
                <div className="text-sm font-bold text-ink">{h.role}</div>
                <div className="text-xs text-muted">{kindLabel(h.type)} · {relativeWhen(h.completedAt)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-lg font-black text-ink career-count">{h.score} / 100</div>
                <button
                  type="button"
                  className="btn-glass text-xs py-1.5"
                  onClick={() => {
                    setResult(h)
                    setPhase('results')
                  }}
                >
                  Review
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">
          Interview Score {history.slice().reverse().map(h => h.score).join(' → ')}
          {history.length >= 2 ? ` · +${Math.max(0, history[0].score - history[history.length - 1].score)} points over ${history.length} interviews` : ''}
        </p>
        <button type="button" className="btn-glass text-sm mt-4" onClick={() => navigate(coursePath(TS_COURSE_ID))}>
          Continue Learning →
        </button>
      </section>

      {roleOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setRoleOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="role-picker" className="glass rounded-3xl p-6 w-full max-w-md career-modal-in" onClick={e => e.stopPropagation()}>
            <h2 id="role-picker" className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              Change Role
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {INTERVIEW_ROLES.map(r => (
                <button key={r} type="button" className="iv-choice px-3 py-2 rounded-xl text-xs font-semibold border" data-on={role === r} onClick={() => setRole(r)}>
                  {r}
                </button>
              ))}
            </div>
            <button type="button" className="btn-primary text-sm" onClick={() => setRoleOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
