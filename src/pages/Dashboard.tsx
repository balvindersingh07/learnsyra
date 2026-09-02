import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Page } from '../App'
import { useAuth } from '../context/AuthContext'
import TutorHandoff from '../components/TutorHandoff'
import {
  categoryStyle,
  getCareerProfile,
  getCertificates,
  getLiveClasses,
  getMyBookings,
  getMyEnrolledCourses,
  getMyStudentProjects,
  getStudentStats,
  askAiTutor,
  type BookingRow,
  type CareerProfile,
  type CertificateRow,
  type CourseRow,
  type LiveClass,
} from '../lib/api'
import {
  buildDashboardIntel,
  formatActivityLabel,
  formatSessionWhen,
  loadMissionActive,
  loadMissionDone,
  saveMissionActive,
  saveMissionDone,
  setPendingAiPrompt,
  type MissionTask,
} from '../lib/dashboardIntel'
import { lessonPath, liveClassPath } from '../lib/paths'

interface Props {
  onNav: (p: Page, extra?: string) => void
}

function TutorAvatar({ name, imageKey }: { name: string; imageKey?: string | null }) {
  const [broken, setBroken] = useState(false)
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const src = imageKey
    ? imageKey.startsWith('http')
      ? imageKey
      : `https://images.unsplash.com/${imageKey}?w=96&h=96&fit=crop&auto=format&dpr=2`
    : null
  if (!src || broken) {
    return (
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}
        title={name}
      >
        {initials || 'T'}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setBroken(true)}
      className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
    />
  )
}

function AIPanel({
  onNav,
  firstName,
  topic,
}: {
  onNav: (p: Page) => void
  firstName: string
  topic: string
}) {
  const personalized = Boolean(topic)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastPrompt, setLastPrompt] = useState<string | null>(null)
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: personalized
        ? `Hey ${firstName} 👋 You're learning ${topic}. Ask me anything — I can explain, quiz you, or suggest a project.`
        : `Hi ${firstName}! I'm LearnSyra AI. Choose a course or tell me what you want to learn, and I'll help you get started.`,
    },
  ])

  const send = async (preset?: string, isRetry = false) => {
    const q = (preset ?? input).trim()
    if (!q || busy) return
    if (!isRetry) setInput('')
    setError(null)
    setLastPrompt(q)
    const nextMessages = isRetry
      ? messages
      : [...messages, { role: 'user' as const, text: q }]
    if (!isRetry) setMessages(nextMessages)
    setBusy(true)
    const history = nextMessages
      .slice(1)
      .slice(0, -1)
      .map(m => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }))
    const res = await askAiTutor(history, q)
    setBusy(false)
    if ('error' in res) {
      setError(res.error)
      if (!isRetry) {
        setMessages(m => m.slice(0, -1))
      }
      return
    }
    if (isRetry) {
      setMessages(m => [...m, { role: 'user' as const, text: q }, { role: 'ai', text: res.reply }])
      return
    }
    setMessages(m => [...m, { role: 'ai', text: res.reply }])
  }

  const chips = personalized
    ? [
        { label: 'Explain Again', prompt: `Explain ${topic} in simpler words.` },
        { label: 'Quiz Me', prompt: `Quiz me on ${topic}.` },
        { label: 'Practice', prompt: `Give me a short practice drill for ${topic}.` },
        { label: 'Give Me a Project', prompt: `Give me a small project to practice ${topic}.` },
      ]
    : [
        { label: 'What should I learn?', prompt: 'What should I learn first on LearnSyra?' },
        { label: 'Choose a course', prompt: 'Help me pick a first course.' },
        { label: 'Explore projects', prompt: 'What kind of beginner project should I try?' },
      ]

  return (
    <div
      id="ai-tutor-panel"
      className="glass rounded-2xl flex flex-col"
      style={{ height: 420 }}
    >
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}
        >
          ✨
        </div>
        <div>
          <div className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            AI Tutor
          </div>
          <div className="text-xs text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block pulse-glow" />
            Online · Always here
          </div>
        </div>
        <button
          type="button"
          className="ml-auto btn-primary text-xs px-3 py-1.5"
          onClick={() => onNav('ai-learning')}
          aria-label="Open full AI Tutor chat"
        >
          Full Chat →
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {error && (
          <div className="rounded-xl px-3 py-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 flex flex-wrap items-center gap-2">
            <span>{error}</span>
            {lastPrompt && (
              <button type="button" className="btn-glass text-xs" disabled={busy} onClick={() => void send(lastPrompt, true)}>
                Retry
              </button>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="rounded-xl px-3 py-2 text-sm max-w-xs"
              style={{
                background: m.role === 'user'
                  ? 'linear-gradient(135deg,#6C5CE7,#8B5CF6)'
                  : 'rgba(255,255,255,0.92)',
                border: m.role === 'ai' ? '1px solid rgba(99,102,241,0.12)' : 'none',
                color: m.role === 'user' ? '#ffffff' : '#172033',
                lineHeight: 1.5,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 pt-0">
        <div className="flex gap-1 mb-2 flex-wrap">
          {chips.map(s => (
            <button
              key={s.label}
              onClick={() => send(s.prompt)}
              className="text-xs px-2 py-1 rounded-lg cursor-pointer transition-colors"
              style={{
                background: 'rgba(108,92,231,0.12)',
                border: '1px solid rgba(108,92,231,0.25)',
                color: '#6C5CE7',
              }}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => onNav('tutors')}
            className="text-xs px-2 py-1 rounded-lg cursor-pointer transition-colors"
            style={{
              background: 'rgba(108,92,231,0.12)',
              border: '1px solid rgba(108,92,231,0.25)',
              color: '#6C5CE7',
            }}
          >
            Ask a Tutor
          </button>
        </div>
        <div
          className="flex gap-2 rounded-xl p-2"
          style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(99,102,241,0.12)' }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !busy && send()}
            placeholder={busy ? 'Thinking…' : 'Ask anything about your subject...'}
            disabled={busy}
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder-muted"
          />
          <button
            type="button"
            aria-label="Send message"
            onClick={() => send()}
            disabled={busy}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function MissionTaskCard({
  task,
  done,
  active,
  onStart,
  onToggle,
}: {
  task: MissionTask
  done: boolean
  active: boolean
  onStart: () => void
  onToggle: () => void
}) {
  const inProgress = active && !done
  return (
    <div
      className={`rounded-xl px-3 py-2.5 card-hover ${done ? 'mission-done' : ''}`}
      style={{
        background: done ? 'rgba(32,201,151,0.12)' : inProgress ? 'rgba(108,92,231,0.08)' : 'rgba(255,255,255,0.92)',
        border: `1px solid ${done ? 'rgba(32,201,151,0.28)' : inProgress ? 'rgba(108,92,231,0.28)' : 'rgba(99,102,241,0.12)'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="text-left flex-1 cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0 }}
          onClick={onStart}
          aria-label={`Start ${task.title}`}
        >
          <div className="text-sm font-semibold text-ink leading-snug">
            {task.icon} {task.title}
          </div>
          <div className="text-xs text-muted mt-0.5">{task.minutes} min</div>
          <div
            className="text-xs mt-1 font-medium"
            style={{ color: done ? '#0F8A68' : inProgress ? '#6C5CE7' : '#98A2B3' }}
          >
            {done ? '✓ Completed' : inProgress ? 'In progress' : 'Pending'}
          </div>
        </button>
        <button
          type="button"
          aria-label={done ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
          aria-pressed={done}
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 cursor-pointer mt-0.5"
          style={{
            background: done ? '#20C997' : 'transparent',
            border: done ? 'none' : '1.5px solid rgba(152,162,179,0.7)',
            color: done ? '#fff' : 'transparent',
            boxShadow: done ? '0 0 10px rgba(32,201,151,0.45)' : 'none',
          }}
          onClick={onToggle}
        >
          {done ? '✓' : inProgress ? <span className="dash-spin" aria-hidden /> : null}
        </button>
      </div>
    </div>
  )
}

const EMPTY_STATS = {
  streak: 0,
  level: 1,
  weekHours: 0,
  careerScore: 0,
  completedLessons: 0,
  weekDays: [
    { label: 'Monday', hours: 0 },
    { label: 'Tuesday', hours: 0 },
    { label: 'Wednesday', hours: 0 },
    { label: 'Thursday', hours: 0 },
    { label: 'Friday', hours: 0 },
    { label: 'Saturday', hours: 0 },
    { label: 'Sunday', hours: 0 },
  ],
}

export default function Dashboard({ onNav }: Props) {
  const { profile, session } = useAuth()
  const uid = session?.user.id ?? null
  const navigate = useNavigate()
  const [enrolled, setEnrolled] = useState<(CourseRow & { progress: number; last_lesson_id: string | null })[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [certs, setCerts] = useState<CertificateRow[]>([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [liveNow, setLiveNow] = useState<LiveClass[]>([])
  const [career, setCareer] = useState<CareerProfile | null>(null)
  const [submittedCount, setSubmittedCount] = useState(0)
  const [missionDone, setMissionDone] = useState<string[]>([])
  const [missionActive, setMissionActive] = useState<string | null>(null)
  const [missionOpen, setMissionOpen] = useState(false)
  const [prepOpen, setPrepOpen] = useState(false)
  const [prepBooking, setPrepBooking] = useState<BookingRow | null>(null)
  const [hoverDay, setHoverDay] = useState<string | null>(null)
  const [matchSeen, setMatchSeen] = useState(false)
  const matchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setEnrolled([])
    setBookings([])
    setCerts([])
    setStats(EMPTY_STATS)
    setCareer(null)
    setSubmittedCount(0)
    setLiveNow([])
    setLoadingCourses(true)

    if (!uid) {
      setLoadingCourses(false)
      return
    }

    Promise.all([
      getMyEnrolledCourses().catch(() => []),
      getMyBookings().catch(() => []),
      getCertificates().catch(() => []),
      getStudentStats().catch(() => EMPTY_STATS),
      getLiveClasses().catch(() => []),
      getCareerProfile().catch(() => null),
      getMyStudentProjects().catch(() => []),
    ]).then(([courses, books, certificates, studentStats, lives, careerRow, projects]) => {
      if (cancelled) return
      setEnrolled(courses)
      setBookings(books)
      setCerts(certificates)
      setStats(studentStats)
      setLiveNow(lives.filter(c => c.status === 'live'))
      setCareer(careerRow)
      setSubmittedCount(projects.filter(p => p.status !== 'started').length)
    }).finally(() => {
      if (!cancelled) setLoadingCourses(false)
    })

    return () => {
      cancelled = true
    }
  }, [uid])

  useEffect(() => {
    setMissionDone(loadMissionDone(uid))
    setMissionActive(loadMissionActive(uid))
  }, [uid])

  useEffect(() => {
    const el = matchRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setMatchSeen(true)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPrepOpen(false)
      setPrepBooking(null)
      setMissionOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const firstName = (profile?.full_name || session?.user.email || 'there').split(' ')[0]
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const intel = useMemo(
    () =>
      buildDashboardIntel({
        firstName,
        enrolled,
        stats,
        career,
        submittedCount,
      }),
    [firstName, enrolled, stats, career, submittedCount],
  )
  const roadmapSteps = intel.roadmap
  const maxActivity = Math.max(...intel.activity.days.map(d => d.hours), 0.1)

  const toggleMission = (id: string) => {
    const next = missionDone.includes(id) ? missionDone.filter(x => x !== id) : [...missionDone, id]
    setMissionDone(next)
    saveMissionDone(next, uid)
    if (!missionDone.includes(id) && missionActive === id) {
      setMissionActive(null)
      saveMissionActive(null, uid)
    }
  }

  const startMissionTask = (t: MissionTask) => {
    if (!missionDone.includes(t.id)) {
      setMissionActive(t.id)
      saveMissionActive(t.id, uid)
    }
    setMissionOpen(false)
    if (t.page === 'ai-learning') setPendingAiPrompt(`${t.title} — ${t.minutes} min`, uid)
    onNav(t.page)
  }

  return (
    <div className="pt-20 px-6 pb-28 max-w-7xl mx-auto overflow-x-hidden">
      {/* Welcome */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1
            className="text-3xl md:text-[2.1rem] font-black text-ink mb-1"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
          >
            {hello}, {firstName} 👋
          </h1>
          <p className="text-sm md:text-[0.95rem] text-muted leading-relaxed">
            {enrolled.length > 0
              ? `You're enrolled in ${enrolled.length} course${enrolled.length > 1 ? 's' : ''}. Keep it up!`
              : "Let's get you started — browse the catalog below."}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { v: `🔥 ${stats.streak}`, l: 'Day Streak', c: '#f59e0b' },
            { v: `Lv ${stats.level}`, l: 'Current Level', c: '#6C5CE7' },
            { v: `${stats.weekHours}h`, l: 'This Week', c: '#22C7D6' },
            { v: `${intel.careerScore}%`, l: 'Career Ready', c: '#20C997' },
          ].map(s => (
            <div
              key={s.l}
              className="glass rounded-xl px-4 py-3 text-center"
              style={{ minWidth: 80 }}
            >
              <div
                className="text-xl font-black mb-0.5"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', color: s.c }}
              >
                {s.v}
              </div>
              <div className="text-xs text-muted">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {liveNow.length > 0 && (
        <div className="glass rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'rgba(32,201,151,0.35)', borderWidth: 1 }}>
          <div>
            <div className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              ● {liveNow[0].title} is live
            </div>
            <div className="text-xs text-muted">{liveNow[0].tutor?.full_name || 'A tutor'} is teaching now</div>
          </div>
          <button className="btn-primary text-sm" onClick={() => navigate(liveClassPath(liveNow[0].id))}>
            Join class →
          </button>
        </div>
      )}

      <div className="glass rounded-2xl p-5 md:p-6 mb-8 dash-elevate">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {intel.mission.personalized ? '✨ Your AI Mission Today' : '✨ Start your learning journey'}
            </h2>
            <p className="text-sm text-muted leading-relaxed mt-0.5">{intel.mission.subtitle}</p>
            <p className="text-sm font-semibold text-ink mt-1">{intel.mission.focus}</p>
          </div>
          <div className="text-right min-w-[150px]">
            <div className="text-sm font-semibold text-ink mb-1" aria-live="polite">
              {missionDone.length} / {intel.mission.tasks.length} completed
            </div>
            <div className="progress-bar mb-3">
              <div
                className="progress-fill"
                style={{ width: `${(missionDone.length / intel.mission.tasks.length) * 100}%` }}
              />
            </div>
            <button
              type="button"
              className="btn-primary btn-mission text-sm"
              onClick={() => setMissionOpen(true)}
            >
              Start Mission →
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {intel.mission.tasks.map(t => (
            <MissionTaskCard
              key={t.id}
              task={t}
              done={missionDone.includes(t.id)}
              active={missionActive === t.id}
              onStart={() => startMissionTask(t)}
              onToggle={() => toggleMission(t.id)}
            />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left - 2/3 */}
        <div className="lg:col-span-2 space-y-7">
          {/* Continue Learning */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xl font-bold text-ink"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
              >
                Continue Learning
              </h2>
              <button
                onClick={() => onNav('courses')}
                className="text-sm text-primary hover:text-primary transition-colors cursor-pointer"
              >
                Browse all courses →
              </button>
            </div>
            {loadingCourses ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="glass rounded-2xl p-4">
                    <div className="dash-skel h-12 w-12 mb-3" />
                    <div className="dash-skel h-4 w-3/4 mb-2" />
                    <div className="dash-skel h-3 w-1/2 mb-4" />
                    <div className="dash-skel h-8 w-full" />
                  </div>
                ))}
              </div>
            ) : enrolled.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-muted mb-4">You haven't enrolled in any courses yet.</p>
                <button className="btn-primary text-sm" onClick={() => onNav('courses')}>
                  Browse courses →
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {enrolled.map(c => {
                  const { icon, color } = categoryStyle(c.category)
                  return (
                    <div
                      key={c.id}
                      className="glass rounded-2xl p-4 card-hover cursor-pointer"
                      style={{ borderColor: `${color}22`, borderWidth: 1 }}
                      onClick={() => onNav('course-detail', c.id)}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ background: `${color}18` }}
                        >
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-sm font-bold text-ink truncate mb-0.5"
                            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                          >
                            {c.title}
                          </div>
                          <div className="text-xs text-muted">LearnSyra</div>
                          {c.category && <div className="text-xs mt-0.5" style={{ color }}>{c.category}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="progress-bar flex-1">
                          <div className="progress-fill" style={{ width: `${c.progress}%`, background: `linear-gradient(90deg,${color},${color}aa)` }} />
                        </div>
                        <span className="text-xs font-bold text-muted">{c.progress}%</span>
                      </div>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (c.last_lesson_id) navigate(lessonPath(c.id, c.last_lesson_id))
                          else onNav('course-detail', c.id)
                        }}
                        className="w-full text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer"
                        style={{
                          background: `${color}15`,
                          border: `1px solid ${color}30`,
                          color,
                          fontFamily: 'Plus Jakarta Sans,sans-serif',
                        }}
                      >
                        {c.progress >= 100 ? 'Review →' : 'Continue →'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Skill Roadmap */}
          <div>
            <h2
              className="text-lg font-bold text-ink mb-4"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
            >
              Your Skill Roadmap
            </h2>
            <div className="glass rounded-2xl p-6 overflow-x-auto">
              <div className="flex items-start justify-between gap-1 min-w-[640px] lg:min-w-0">
                {roadmapSteps.map((s, i) => (
                  <div key={s.label} className="flex items-start gap-1.5 flex-1">
                    <button
                      type="button"
                      className="dash-tip flex flex-col items-center cursor-pointer mx-auto"
                      style={{ background: 'none', border: 'none', opacity: s.locked ? 0.42 : 1 }}
                      onClick={() => onNav(s.page)}
                      aria-label={`${s.label}. ${s.hint}`}
                    >
                      <span className="dash-tip-box text-left">
                        <strong style={{ color: '#172033' }}>{s.label}</strong>
                        <br />
                        {s.hint}
                      </span>
                      <div
                        className="rounded-full flex items-center justify-center text-xl mb-1.5 transition-all"
                        style={{
                          width: s.current ? 52 : 48,
                          height: s.current ? 52 : 48,
                          background: s.done
                            ? 'linear-gradient(135deg,#6C5CE7,#22C7D6)'
                            : s.current
                            ? 'rgba(108,92,231,0.22)'
                            : 'rgba(255,255,255,0.55)',
                          border: s.current
                            ? '2px solid #6C5CE7'
                            : s.done
                            ? 'none'
                            : '1px solid rgba(99,102,241,0.12)',
                          boxShadow: s.done
                            ? '0 0 16px rgba(108,92,231,0.32)'
                            : s.current
                            ? '0 0 22px rgba(79,140,255,0.45), 0 0 18px rgba(108,92,231,0.4)'
                            : 'none',
                          color: s.done ? '#fff' : undefined,
                        }}
                      >
                        {s.done ? '✓' : s.locked ? '🔒' : s.icon}
                      </div>
                      <div
                        className="text-xs font-semibold text-center leading-tight"
                        style={{
                          fontFamily: 'Plus Jakarta Sans,sans-serif',
                          color: s.done || s.current ? '#6C5CE7' : '#667085',
                          maxWidth: 76,
                        }}
                      >
                        {s.label}
                      </div>
                      {s.current && s.pct > 0 && (
                        <div className="text-xs font-bold text-primary mt-0.5">{s.pct}%</div>
                      )}
                    </button>
                    {i < roadmapSteps.length - 1 && (
                      <div
                        className="h-px flex-1 min-w-[12px] mt-[25px] hidden sm:block"
                        style={{
                          background: s.done
                            ? 'linear-gradient(90deg,#6C5CE7,#22C7D6)'
                            : 'rgba(99,102,241,0.16)',
                          opacity: s.locked ? 0.45 : 0.85,
                        }}
                        aria-hidden
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                🧬 Your Skill DNA
              </h3>
              <button
                type="button"
                className="text-sm text-primary font-semibold cursor-pointer"
                style={{ background: 'none', border: 'none' }}
                onClick={() => onNav('career')}
              >
                View Skill Analysis →
              </button>
            </div>
            {intel.skillDna.length === 0 ? (
              <p className="text-sm text-muted leading-relaxed">{intel.skillInsight}</p>
            ) : (
              <>
                <div className="space-y-3.5">
                  {intel.skillDna.map(sk => (
                    <div key={sk.name}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-ink font-medium">{sk.name}</span>
                        {sk.score > 0 ? (
                          <span className="text-muted">{sk.score}%</span>
                        ) : (
                          <span className="text-muted">Not started</span>
                        )}
                      </div>
                      {sk.score > 0 && (
                        <div className="progress-bar-soft">
                          <div className="progress-fill" style={{ width: `${sk.score}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted mt-4 leading-relaxed">
                  {intel.strongest ? (
                    <>
                      <span className="text-ink font-semibold">Strongest skill: {intel.strongest}</span>
                      {intel.weakest ? (
                        <>
                          <span className="mx-2 text-subtle">·</span>
                          <span>Needs attention: {intel.weakest}</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    intel.skillInsight
                  )}
                </p>
              </>
            )}
          </div>

          <div className="glass rounded-2xl p-4 card-hover dash-elevate">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="text-base font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                ✨ Your Next Best Action
              </h3>
              {intel.live ? (
                <span className="badge badge-primary">Continue learning</span>
              ) : (
                <span className="badge badge-primary">Get started</span>
              )}
            </div>
            <div className="text-base font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {intel.nextAction.title}
            </div>
            <p className="text-sm text-muted leading-relaxed mb-2">{intel.nextAction.body}</p>
            <div className="text-xs text-muted mb-3">{intel.nextAction.minutes} min</div>
            <button type="button" className="btn-primary text-sm" onClick={() => onNav(intel.nextAction.page)}>
              {intel.live ? 'Continue →' : 'Browse courses →'}
            </button>
          </div>

          <div className="glass rounded-2xl p-5 card-hover">
            <h3 className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {intel.project.catalog ? '🚀 Explore Projects' : '🚀 Build Your Next Project'}
            </h3>
            <div className="text-base font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {intel.project.title}
            </div>
            {intel.project.catalog && (
              <p className="text-sm text-muted leading-relaxed mb-3">
                Catalog projects you can try. This is not a project you have started.
              </p>
            )}
            {(intel.project.difficulty || intel.project.time) && (
              <div className="flex flex-wrap gap-2 mb-3 text-xs text-muted">
                {intel.project.difficulty ? <span>Difficulty: {intel.project.difficulty}</span> : null}
                {intel.project.time ? <span>Estimated time: {intel.project.time}</span> : null}
              </div>
            )}
            {intel.project.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {intel.project.skills.map(s => (
                  <span key={s} className="badge badge-primary">{s}</span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1 mb-4">
              {intel.project.badges.map(b => (
                <span key={b} className="badge badge-green">{b}</span>
              ))}
            </div>
            <button className="btn-primary text-sm" onClick={() => onNav('projects')}>
              {intel.project.catalog ? 'Explore Projects →' : 'Start Building →'}
            </button>
          </div>

          {/* Upcoming Sessions */}
          <div>
            <h2
              className="text-lg font-bold text-ink mb-3"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
            >
              Upcoming Sessions
            </h2>
            <div className="space-y-3">
              {bookings.length === 0 && (
                <div className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                      Book your first tutor session
                    </div>
                    <div className="text-sm text-muted leading-relaxed mt-0.5">
                      No upcoming sessions yet. Browse tutors when you want live help.
                    </div>
                  </div>
                  <button type="button" className="btn-primary text-sm py-2 px-3 flex-shrink-0" onClick={() => onNav('tutors')}>
                    Find a tutor →
                  </button>
                </div>
              )}
              {bookings.slice(0, 4).map(s => {
                const tutorName = s.listing?.name || 'Tutor'
                const expertise = s.listing?.expertise || ''
                return (
                <div
                  key={s.id}
                  className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <TutorAvatar name={tutorName} imageKey={s.listing?.image_key} />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-bold text-ink truncate"
                      style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                    >
                      {tutorName}
                    </div>
                    {expertise ? (
                      <div className="text-sm text-muted truncate leading-relaxed">{expertise}</div>
                    ) : null}
                    <div className="text-xs text-muted mt-0.5">{formatSessionWhen(s.created_at)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <span className={`badge capitalize ${s.status === 'confirmed' ? 'badge-green' : 'badge-amber'}`}>{s.status}</span>
                    <button
                      type="button"
                      className="btn-glass text-sm py-2 px-3"
                      onClick={() => {
                        setPrepBooking(s)
                        setPrepOpen(true)
                      }}
                    >
                      Prepare with AI
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-sm py-2 px-3"
                      onClick={() => onNav('live')}
                    >
                      Join Session
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-base font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              🧠 Your Learning Insights
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {intel.insights.map(item => (
                <div
                  key={item.label}
                  className="rounded-xl px-3 py-3"
                  style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(99,102,241,0.1)' }}
                >
                  <div className="text-xs text-muted mb-1.5 leading-relaxed">{item.label}</div>
                  <div className="text-base font-bold text-ink leading-snug" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right - 1/3 */}
        <div className="space-y-7">
          <AIPanel key={uid ?? 'guest'} onNav={onNav} firstName={firstName} topic={intel.tutor.currentLesson} />

          <TutorHandoff topic={intel.tutor.topic} onFindTutor={() => onNav('tutors')} />

          {/* Career Score */}
          <div
            className="glass rounded-2xl p-5 cursor-pointer card-hover"
            onClick={() => onNav('career')}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="text-base font-bold text-ink"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
              >
                Career Readiness
              </div>
              <span className="badge badge-green">{intel.careerScore}% ready</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90" aria-hidden>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(108,92,231,0.15)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="url(#grad)" strokeWidth="3"
                    strokeDasharray={`${intel.careerScore} ${100 - intel.careerScore}`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6C5CE7" />
                      <stop offset="100%" stopColor="#20C997" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-lg font-black text-ink"
                    style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                  >
                    {intel.careerScore}%
                  </span>
                </div>
              </div>
              <div className="space-y-2.5 flex-1">
                {[
                  { label: 'Skills', v: intel.breakdown.skills },
                  { label: 'Projects', v: intel.breakdown.projects },
                  { label: 'Resume', v: intel.breakdown.resume },
                  { label: 'Interview', v: intel.breakdown.interview },
                  { label: 'Communication', v: intel.breakdown.communication },
                ].map(i => (
                  <div key={i.label}>
                    <div className="flex justify-between text-[13px] mb-1 leading-relaxed">
                      <span className="text-muted">{i.label}</span>
                      <span className="text-muted font-medium">{i.v}%</span>
                    </div>
                    <div className="progress-bar-thin">
                      <div className="progress-fill" style={{ width: `${i.v}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-xl px-3 py-2.5 text-sm text-muted leading-relaxed" style={{ background: 'rgba(108,92,231,0.08)' }}>
              <span className="font-semibold text-ink">{intel.live ? 'Next step ' : 'Get started '}</span>
              {intel.careerTip}
            </div>
            <button
              type="button"
              className="mt-3 w-full btn-primary text-sm"
              onClick={e => {
                e.stopPropagation()
                onNav('career')
              }}
            >
              Improve My Score →
            </button>
            <div className="mt-3 text-xs text-center text-primary font-semibold" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              View Career Center →
            </div>
          </div>

          <div ref={matchRef} className="glass rounded-2xl p-5">
            <h3 className="text-base font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              💼 Career Match
            </h3>
            {intel.careerMatch.role ? (
              <>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                    {intel.careerMatch.role}
                  </div>
                  {intel.careerMatch.match > 0 ? (
                    <span className={`badge badge-green ${matchSeen ? 'match-in' : ''}`}>
                      {intel.careerMatch.match}% Match
                    </span>
                  ) : (
                    <span className="badge">Career goal</span>
                  )}
                </div>
                {intel.careerMatch.have.length > 0 && (
                  <>
                    <div className="text-sm text-muted mb-1">Skills on your profile:</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                      {intel.careerMatch.have.map(s => (
                        <span key={s} className="text-sm text-success">✓ {s}</span>
                      ))}
                    </div>
                  </>
                )}
                {intel.careerMatch.improve.length > 0 && (
                  <>
                    <div className="text-sm text-muted mb-1">Skills to improve:</div>
                    <ul className="text-sm text-muted mb-3 space-y-1 leading-relaxed">
                      {intel.careerMatch.improve.map(s => (
                        <li key={s}>⚠ {s}</li>
                      ))}
                    </ul>
                  </>
                )}
                <button type="button" className="btn-primary text-sm w-full" onClick={() => onNav('career')}>
                  Open Career Center →
                </button>
              </>
            ) : (
              <>
                <div className="text-sm font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                  Choose a career goal
                </div>
                <p className="text-sm text-muted leading-relaxed mb-3">
                  Career options live in Career Center. No match score until you set a goal and build real activity.
                </p>
                <button type="button" className="btn-primary text-sm w-full" onClick={() => onNav('career')}>
                  Choose a career goal →
                </button>
              </>
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-base font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              📊 Your Learning Activity
            </h3>
            <div className="flex items-end gap-1.5 h-24 mb-3">
              {intel.activity.days.map(d => (
                <button
                  key={d.label}
                  type="button"
                  className="dash-tip flex-1 flex flex-col items-center gap-1 h-full justify-end cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0 }}
                  onMouseEnter={() => setHoverDay(d.label)}
                  onMouseLeave={() => setHoverDay(null)}
                  onFocus={() => setHoverDay(d.label)}
                  onBlur={() => setHoverDay(null)}
                  aria-label={`${d.label} — ${formatActivityLabel(d.hours)}`}
                >
                  <span className="dash-tip-box">{d.label} — {formatActivityLabel(d.hours)}</span>
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: d.hours > 0 ? `${(d.hours / maxActivity) * 100}%` : '0%',
                      background: hoverDay === d.label ? 'linear-gradient(180deg,#6C5CE7,#22C7D6)' : 'linear-gradient(180deg,#8B5CF6,#6C5CE7)',
                      opacity: 0.9,
                    }}
                  />
                  <span className="text-[10px] text-muted">{d.label.slice(0, 2)}</span>
                </button>
              ))}
            </div>
            <div className="text-sm font-bold text-ink">{intel.activity.weekHours} hours this week</div>
            {intel.activity.deltaPct !== 0 && (
              <div className="text-sm text-success">+{intel.activity.deltaPct}% vs last week</div>
            )}
          </div>

          {/* Achievements */}
          <div className="glass rounded-2xl p-5">
            <div
              className="text-base font-bold text-ink mb-2"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
            >
              Recent Achievements
            </div>
            <div className="text-sm font-semibold text-ink mb-1">{intel.levelLabel}</div>
            <div className="flex justify-between text-sm text-muted mb-1">
              <span>XP</span>
              <span>{intel.xp} / {intel.xpTarget} XP</span>
            </div>
            <div className="progress-bar mb-4">
              <div className="progress-fill" style={{ width: `${(intel.xp / intel.xpTarget) * 100}%` }} />
            </div>
            <div className="flex gap-2 mb-4">
              {intel.badges.map(b => (
                <div
                  key={b.label}
                  className="dash-tip flex-1 rounded-xl px-2 py-2 text-center"
                  style={{
                    background: b.earned ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.55)',
                    border: b.earned ? '1px solid rgba(245,158,11,0.28)' : '1px solid rgba(99,102,241,0.1)',
                    opacity: b.earned ? 1 : 0.55,
                    boxShadow: b.earned ? '0 0 12px rgba(245,158,11,0.22)' : 'none',
                    backdropFilter: b.earned ? undefined : 'blur(8px)',
                  }}
                  tabIndex={0}
                  aria-label={`${b.label}. ${b.hint}`}
                >
                  <span className="dash-tip-box text-left">
                    <strong style={{ color: '#172033' }}>{b.label}</strong>
                    <br />
                    {b.hint}
                  </span>
                  <div className="text-base">{b.icon}</div>
                  <div className="text-xs text-ink font-medium leading-tight mt-1">{b.label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {certs.length === 0 && (
                <p className="text-xs text-muted">Finish every lesson in a course to earn a certificate.</p>
              )}
              {certs.slice(0, 4).map(a => (
                <div key={a.id} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}
                  >
                    🏆
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink font-medium truncate" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                      {a.title}
                    </div>
                    <div className="text-xs text-muted">{new Date(a.issued_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {missionOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(23,32,51,0.32)' }}
          onClick={() => setMissionOpen(false)}
          role="presentation"
        >
          <div
            className="glass rounded-2xl p-6 w-full max-w-md dash-elevate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mission-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 id="mission-modal-title" className="text-lg font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                Today's Learning Mission
              </h3>
              <button
                type="button"
                className="btn-glass text-sm py-1.5 px-2.5"
                aria-label="Close mission panel"
                onClick={() => setMissionOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-muted mb-4 leading-relaxed">{intel.mission.focus}</p>
            <div className="text-sm font-semibold text-ink mb-3">
              {missionDone.length} / {intel.mission.tasks.length} completed
            </div>
            <div className="space-y-2 mb-4">
              {intel.mission.tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <MissionTaskCard
                      task={t}
                      done={missionDone.includes(t.id)}
                      active={missionActive === t.id}
                      onStart={() => startMissionTask(t)}
                      onToggle={() => toggleMission(t.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn-glass text-sm w-full" onClick={() => setMissionOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {prepOpen && prepBooking && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(23,32,51,0.32)' }}
          onClick={() => {
            setPrepOpen(false)
            setPrepBooking(null)
          }}
          role="presentation"
        >
          <div
            className="glass rounded-2xl p-6 w-full max-w-md dash-elevate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prep-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 id="prep-modal-title" className="text-lg font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                Prepare for your session
              </h3>
              <button
                type="button"
                className="btn-glass text-sm py-1.5 px-2.5"
                aria-label="Close preparation panel"
                onClick={() => {
                  setPrepOpen(false)
                  setPrepBooking(null)
                }}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-muted mb-4 leading-relaxed">
              A short warm-up
              {prepBooking.listing?.expertise ? ` for ${prepBooking.listing.expertise}` : ''}
              {prepBooking.listing?.name ? ` with ${prepBooking.listing.name}` : ''}.
            </p>
            {prepBooking.listing?.expertise ? (
              <>
                <div className="text-sm font-semibold text-ink mb-2">Topics to Review</div>
                <p className="text-sm text-muted mb-4 leading-relaxed">{prepBooking.listing.expertise}</p>
              </>
            ) : (
              <p className="text-sm text-muted mb-4 leading-relaxed">
                Review your goals for this session, then try a short quiz.
              </p>
            )}
            <div className="text-sm font-semibold text-ink mb-1">Quick Practice</div>
            <p className="text-sm text-muted mb-4">5-minute AI quiz</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-glass text-sm"
                onClick={() => {
                  setPrepOpen(false)
                  setPrepBooking(null)
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => {
                  const name = prepBooking.listing?.name || 'your tutor'
                  const topic = prepBooking.listing?.expertise || 'this tutoring session'
                  setPrepOpen(false)
                  setPrepBooking(null)
                  setPendingAiPrompt(`Give me a 5-minute quiz to prepare for my session with ${name}. Focus on ${topic}.`, uid)
                  onNav('ai-learning')
                }}
              >
                Start Preparation →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
