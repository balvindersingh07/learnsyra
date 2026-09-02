import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  completeLesson,
  enrollInCourse,
  getCompletedLessonIds,
  getCourse,
  getCourseCurriculum,
  getCourses,
  getLesson,
  getMyEnrollments,
  getStudentStats,
  type CourseLesson,
  type CourseModule,
  type CourseRow,
} from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import { loadSavedLessons, saveLesson } from '../lib/aiLearning'
import { loadLocalEnroll } from '../lib/courseDetail'
import {
  buildWorkspaceSnapshot,
  formatClock,
  getLessonWorkspace,
  isSectionLocked,
  loadLocalDone,
  loadWorkspaceSnapshot,
  mockModulesFromPack,
  nameDemoLessons,
  resolveWorkspaceCourse,
  saveLocalDone,
  saveWorkspaceSnapshot,
  sectionProgress,
  type LessonWorkspaceSnapshot,
} from '../lib/lessonWorkspace'
import { lessonPath } from '../lib/paths'
import './lesson-player.css'

type Tab = 'overview' | 'notes' | 'practice' | 'quiz'
type WorkspaceSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

function MockPlayer({
  duration,
  time,
  playing,
  setPlaying,
  speed,
  onSeek,
  onWatch,
}: {
  duration: number
  time: number
  playing: boolean
  setPlaying: (v: boolean) => void
  speed: number
  onSeek: (n: number) => void
  onWatch: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const timeRef = useRef(time)
  const seekRef = useRef(onSeek)
  const watchRef = useRef(onWatch)
  timeRef.current = time
  seekRef.current = onSeek
  watchRef.current = onWatch

  useEffect(() => {
    if (!playing) return
    watchRef.current()
    const t = window.setInterval(() => {
      seekRef.current(Math.min(duration, timeRef.current + speed))
    }, 1000)
    return () => window.clearInterval(t)
  }, [playing, speed, duration])

  return (
    <div ref={box} className="rounded-2xl overflow-hidden" style={{ background: '#172033' }}>
      <button
        type="button"
        className="aspect-video w-full flex items-center justify-center text-white cursor-pointer"
        style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)', border: 'none' }}
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        <span className="text-5xl">{playing ? '❚❚' : '▶'}</span>
      </button>
      <div className="px-3 py-2 flex flex-wrap items-center gap-2 text-xs text-white/90">
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} className="cursor-pointer" style={{ background: 'none', border: 'none', color: '#fff' }} onClick={() => setPlaying(!playing)}>
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="font-mono">{formatClock(time)} / {formatClock(duration)}</span>
        <input
          className="lp-range flex-1 min-w-[80px]"
          type="range"
          min={0}
          max={duration}
          value={time}
          aria-label="Timeline"
          onChange={e => onSeek(Number(e.target.value))}
        />
        <span aria-hidden>🔊</span>
        <button type="button" className="cursor-pointer" style={{ background: 'none', border: 'none', color: '#fff' }} aria-label="Settings">⚙</button>
        <button
          type="button"
          className="cursor-pointer"
          style={{ background: 'none', border: 'none', color: '#fff' }}
          aria-label="Fullscreen"
          onClick={() => box.current?.requestFullscreen?.()}
        >
          ⛶
        </button>
      </div>
    </div>
  )
}

export default function LessonPlayer() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [courseTitle, setCourseTitle] = useState('Full Stack Web Development')
  const [modules, setModules] = useState<CourseModule[]>([])
  const [lesson, setLesson] = useState<CourseLesson | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [enrolled, setEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [workspaceSaveStatus, setWorkspaceSaveStatus] = useState<WorkspaceSaveStatus>('idle')
  const [workspaceSaveError, setWorkspaceSaveError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(1)
  const [navOpen, setNavOpen] = useState(false)
  const [assistOpen, setAssistOpen] = useState(false)
  const [more, setMore] = useState(false)
  const [saved, setSaved] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [chapter, setChapter] = useState(0)
  const [watched, setWatched] = useState(false)
  const [code, setCode] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [practiceOut, setPracticeOut] = useState<string | null>(null)
  const [practiceDone, setPracticeDone] = useState(false)
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [lockedQ, setLockedQ] = useState(false)
  const [qScore, setQScore] = useState(0)
  const [quizDone, setQuizDone] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [aiClicks, setAiClicks] = useState(0)
  const [streak, setStreak] = useState(7)
  const [toast, setToast] = useState<string | null>(null)
  const [showNext, setShowNext] = useState(false)
  const mockRef = useRef(false)
  const workspaceHydratedRef = useRef(false)
  const skipWorkspaceAutosaveRef = useRef(false)

  const allLessons = useMemo(() => modules.flatMap(m => m.lessons), [modules])
  const lessonIndex = Math.max(0, allLessons.findIndex(l => l.id === lesson?.id))
  const ws = lesson ? getLessonWorkspace(lesson, lessonIndex) : null
  const duration = (lesson?.duration_min || 18) * 60
  const pct = allLessons.length ? Math.round((completed.size / allLessons.length) * 100) : 67
  const nextLesson = allLessons[lessonIndex + 1]
  const canComplete = watched && notesSaved && practiceDone && quizDone
  const lockedLesson = Boolean(lesson && !lesson.is_free && !enrolled && !session)

  const ping = (m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(null), 1600)
  }

  const workspacePatch = (): Omit<LessonWorkspaceSnapshot, 'v'> => ({
    notes,
    watched,
    practiceDone,
    practiceCode: code,
    quizDone,
    qScore,
  })

  const persistWorkspace = (patch?: Partial<LessonWorkspaceSnapshot>, opts?: { silent?: boolean }) => {
    if (!id || !lesson) return { ok: false as const, error: 'Lesson not loaded' }
    if (!opts?.silent) {
      setWorkspaceSaveStatus('saving')
      setWorkspaceSaveError(null)
    }
    const result = saveWorkspaceSnapshot(
      id,
      lesson.id,
      patch ?? workspacePatch(),
      session?.user.id,
    )
    if (result.ok) {
      if (!opts?.silent) setWorkspaceSaveStatus('saved')
      if (patch?.notes !== undefined || patch === undefined) {
        setNotesSaved((patch?.notes ?? notes).trim().length > 0)
      }
    } else if (!opts?.silent) {
      setWorkspaceSaveStatus('error')
      setWorkspaceSaveError(result.error)
    }
    return result
  }

  const goAi = (prompt: string) => {
    const n = aiClicks + 1
    setAiClicks(n)
    if (n >= 2) setStuck(true)
    setPendingAiPrompt(prompt)
    navigate('/ai-learning')
  }

  useEffect(() => {
    if (!id || !lessonId) return
    let alive = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const [c, curr, l, all] = await Promise.all([
          getCourse(id).catch(() => null),
          getCourseCurriculum(id).catch(() => [] as CourseModule[]),
          getLesson(lessonId).catch(() => null),
          getCourses().catch(() => [] as CourseRow[]),
        ])
        if (!alive) return
        const resolved = resolveWorkspaceCourse(id, c, all)
        setCourseTitle(resolved.title)
        let mods = curr
        mockRef.current = curr.length === 0
        if (!mods.length && resolved.pack) {
          mods = nameDemoLessons(mockModulesFromPack(id, resolved.pack))
        }
        if (l && !mods.some(m => m.lessons.some(x => x.id === l.id))) {
          mods = [{ id: 'current-mod', course_id: id, title: 'Current section', sort_order: -1, lessons: [l] }, ...mods]
        }
        setModules(mods)
        const flat = mods.flatMap(m => m.lessons)
        const found =
          (l && (flat.some(x => x.id === l.id) || curr.length > 0) ? l : null) ||
          flat.find(x => x.id === lessonId) ||
          flat[0]
        setLesson(found ?? null)
        if (!l && found && found.id !== lessonId) navigate(lessonPath(id, found.id), { replace: true })

        const localDone = loadLocalDone(id, session?.user.id)
        let doneIds = localDone
        if (session && c) {
          const [apiDone, ens] = await Promise.all([
            getCompletedLessonIds(id).catch(() => [] as string[]),
            getMyEnrollments().catch(() => []),
          ])
          doneIds = [...new Set([...apiDone, ...localDone])]
          setEnrolled(ens.some(e => e.course_id === id) || loadLocalEnroll().includes(id))
        } else {
          setEnrolled(loadLocalEnroll().includes(id) || mockRef.current)
        }
        setCompleted(new Set(doneIds))
        if (found) {
          workspaceHydratedRef.current = false
          setWorkspaceSaveStatus('loading')
          setWorkspaceSaveError(null)
          const snap = loadWorkspaceSnapshot(id, found.id, session?.user.id)
          setNotes(snap.notes)
          setNotesSaved(snap.notes.trim().length > 0)
          setWatched(snap.watched)
          setPracticeDone(snap.practiceDone)
          setQuizDone(snap.quizDone)
          setQScore(snap.qScore)
          setCode(snap.practiceCode)
          setTab('overview')
          setQi(0)
          setPicked(null)
          setLockedQ(false)
          setHint(null)
          setPracticeOut(null)
          setShowNext(false)
          setTime(0)
          setPlaying(false)
          setWorkspaceSaveStatus('saved')
          skipWorkspaceAutosaveRef.current = true
          workspaceHydratedRef.current = true
        }
        setSaved(loadSavedLessons().some(s => s.title === (found?.title ?? '')))
        getStudentStats().then(s => setStreak(s.streak ?? 0)).catch(() => {})
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load lesson')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => { alive = false }
  }, [id, lessonId, session?.user.id, navigate])

  useEffect(() => {
    if (!ws) return
    setCode(prev => (prev.trim() ? prev : ws.practice.starter))
  }, [ws?.practice.starter])

  useEffect(() => {
    if (!workspaceHydratedRef.current || !id || !lesson) return
    if (skipWorkspaceAutosaveRef.current) {
      skipWorkspaceAutosaveRef.current = false
      return
    }
    setWorkspaceSaveStatus('saving')
    setWorkspaceSaveError(null)
    const timer = window.setTimeout(() => {
      const result = saveWorkspaceSnapshot(
        id,
        lesson.id,
        { notes, watched, practiceDone, practiceCode: code, quizDone, qScore },
        session?.user.id,
      )
      if (result.ok) {
        setNotesSaved(notes.trim().length > 0)
        setWorkspaceSaveStatus('saved')
      } else {
        setWorkspaceSaveStatus('error')
        setWorkspaceSaveError(result.error)
      }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [notes, watched, practiceDone, code, quizDone, qScore, id, lesson?.id, session?.user.id])

  const markWatched = () => {
    if (!id || !lesson || watched) return
    setWatched(true)
    persistWorkspace({ watched: true })
  }

  const saveNote = () => {
    if (!id || !lesson) return
    const result = persistWorkspace({ notes })
    if (result.ok) ping('Note saved')
    else ping(result.error)
  }

  const retryWorkspaceSave = () => {
    const result = persistWorkspace()
    if (result.ok) ping('Progress saved')
    else ping(result.error)
  }

  const toggleSave = () => {
    if (!lesson) return
    if (saved) {
      ping('Already in Saved Lessons')
      return
    }
    saveLesson({
      title: lesson.title,
      body: ws?.takeaway || lesson.title,
      tags: ['React', 'Hooks', 'Lesson'],
    })
    setSaved(true)
    ping('Saved to AI Learning')
  }

  const finishLesson = async () => {
    if (!id || !lesson || !canComplete) return
    if (!session) {
      const next = [...completed, lesson.id]
      saveLocalDone(id, [...next])
      setCompleted(new Set(next))
      setShowNext(true)
      return
    }
    setBusy(true)
    await enrollInCourse(id)
    const result = await completeLesson(id, lesson.id)
    setBusy(false)
    if (result.error) {
      saveLocalDone(id, [...completed, lesson.id], session?.user.id)
      setCompleted(prev => new Set([...prev, lesson.id]))
      ping('Saved locally')
    } else {
      setCompleted(prev => new Set([...prev, lesson.id]))
    }
    setShowNext(true)
  }

  const openLesson = (l: CourseLesson, mi: number) => {
    if (!id) return
    if (isSectionLocked(modules, mi, completed) && !l.is_free) {
      ping('Finish the previous section first')
      return
    }
    navigate(lessonPath(id, l.id))
    setNavOpen(false)
  }

  if (loading) {
    return (
      <div className="pt-24 px-6">
        <div className="dash-skel h-8 w-64 mb-4" />
        <div className="dash-skel h-48 w-full" />
      </div>
    )
  }

  if (!lesson || !ws) {
    return (
      <div className="pt-24 px-6 text-center">
        <p className="text-muted mb-4">{error ?? 'Lesson not found.'}</p>
        <button type="button" className="btn-primary" onClick={() => navigate(id ? `/courses/${id}` : '/courses')}>Back to course</button>
      </div>
    )
  }

  const quizQ = ws.quiz[qi]

  return (
    <div className="pt-16 lp-workspace flex overflow-hidden">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-2 text-sm font-semibold text-ink">{toast}</div>
      )}

      {(navOpen) && (
        <button type="button" className="fixed inset-0 z-30 lg:hidden" style={{ background: 'rgba(23,32,51,0.3)' }} aria-label="Close curriculum" onClick={() => setNavOpen(false)} />
      )}

      <aside
        className={`${navOpen ? 'fixed z-40 inset-y-0 left-0 pt-16 flex' : 'hidden lg:flex'} flex-col w-[270px] flex-shrink-0 overflow-y-auto lg:static`}
        style={{ background: 'rgba(255,255,255,0.86)', borderRight: '1px solid rgba(99,102,241,0.12)' }}
      >
        <div className="p-4">
          <div className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{courseTitle}</div>
          <div className="text-xs text-muted mb-2">{pct}% complete</div>
          <div className="progress-bar mb-3">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="px-2 pb-6">
          {modules.map((m, mi) => {
            const sp = sectionProgress(m, completed)
            const locked = isSectionLocked(modules, mi, completed)
            return (
              <div key={m.id} className="mb-2">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-xl cursor-pointer"
                  style={{ background: 'none', border: 'none' }}
                  onClick={() => setExpanded(expanded === mi ? null : mi)}
                  aria-expanded={expanded === mi}
                >
                  <div className="text-xs font-bold text-ink">
                    {String(mi + 1).padStart(2, '0')} — {m.title}
                  </div>
                  <div className="text-[11px] text-muted">
                    {sp.n} / {sp.total} {sp.all ? 'complete ✓' : locked ? '🔒 Locked until previous section is completed.' : ''}
                  </div>
                </button>
                {expanded === mi && (
                  <div className="pl-2">
                    {m.lessons.map(l => {
                      const current = l.id === lesson.id
                      const done = completed.has(l.id)
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className="lp-lesson w-full text-left px-3 py-1.5 rounded-lg text-sm mb-0.5 cursor-pointer"
                          data-current={current}
                          style={{ border: 'none', background: current ? undefined : 'transparent', color: done ? '#0F8A68' : '#172033' }}
                          onClick={() => openLesson(l, mi)}
                        >
                          {done ? '✓ ' : locked && !l.is_free ? '🔒 ' : current ? '▶ ' : '○ '}
                          {l.title}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="min-w-0">
            <button type="button" className="text-sm text-muted cursor-pointer mb-1" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => navigate(`/courses/${id}`)}>
              ← Back to Course
            </button>
            <div className="text-sm font-bold text-ink truncate">{courseTitle}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted">{pct}% Complete</span>
              <div className="progress-bar w-28">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="lg:hidden btn-glass text-sm py-1.5" onClick={() => setNavOpen(true)}>Curriculum</button>
            <button type="button" className="xl:hidden btn-glass text-sm py-1.5" onClick={() => setAssistOpen(true)}>Learning Assistant</button>
            <div className="text-xs text-muted hidden sm:block">
              Course Progress<br />
              <span className="font-semibold text-ink">{completed.size} / {allLessons.length || 86} lessons</span>
            </div>
            <button type="button" className="btn-glass text-sm py-1.5" aria-label="Bookmark lesson" onClick={toggleSave}>{saved ? '🔖 Saved' : '🔖 Save Lesson'}</button>
            <div className="relative">
              <button type="button" className="btn-glass text-sm py-1.5" aria-label="More options" onClick={() => setMore(v => !v)}>⋯</button>
              {more && (
                <div className="absolute right-0 mt-1 glass rounded-xl p-2 z-20 w-44">
                  <button type="button" className="w-full text-left text-sm px-2 py-1.5 cursor-pointer" style={{ background: 'none', border: 'none' }} onClick={() => { setMore(false); navigate(`/courses/${id}`) }}>Course details</button>
                  <button type="button" className="w-full text-left text-sm px-2 py-1.5 cursor-pointer" style={{ background: 'none', border: 'none' }} onClick={() => { setMore(false); navigate('/projects') }}>Open projects</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 max-w-4xl w-full mx-auto pb-24">
          {error && <p className="text-sm text-rose-500 mb-3">{error}</p>}
          <div className="mb-3">
            <h1 className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{lesson.title}</h1>
            <p className="text-sm text-muted">{ws.subtitle}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted">
              <span>Lesson {String(ws.lessonNo).padStart(2, '0')} · {ws.durationLabel}</span>
              <span className="badge badge-primary">{ws.level}</span>
              <span className="badge badge-accent">AI Assisted</span>
            </div>
          </div>

          {lockedLesson ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-muted mb-4">Enroll to unlock this lesson.</p>
              <button type="button" className="btn-primary" disabled={busy} onClick={async () => {
                if (!session) { navigate('/'); return }
                setBusy(true)
                const { error: err } = await enrollInCourse(id!)
                setBusy(false)
                if (err) setError(err)
                else setEnrolled(true)
              }}>Enroll to continue</button>
            </div>
          ) : (
            <>
              {lesson.video_url ? (
                <div className="glass rounded-2xl overflow-hidden mb-4">
                  <div className="aspect-video bg-black">
                    <iframe title={lesson.title} src={lesson.video_url} className="w-full h-full" allowFullScreen />
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <MockPlayer
                    duration={duration}
                    time={time}
                    playing={playing}
                    setPlaying={v => { setPlaying(v); if (v) markWatched() }}
                    speed={speed}
                    onSeek={n => { setTime(n); markWatched() }}
                    onWatch={markWatched}
                  />
                  <div className="flex justify-end mt-2">
                    <label className="text-xs text-muted">
                      Speed
                      <select className="field ml-2 text-xs py-1" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
                        <option value={1}>1x</option>
                        <option value={1.25}>1.25x</option>
                        <option value={1.5}>1.5x</option>
                        <option value={2}>2x</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}

              <div className="glass rounded-2xl p-4 mb-4">
                <div className="text-sm font-bold text-ink mb-2">Lesson Chapters</div>
                <div className="grid sm:grid-cols-2 gap-1">
                  {ws.chapters.map((c, i) => (
                    <button
                      key={c.label}
                      type="button"
                      className="lp-chapter text-left text-sm px-2 py-1.5 rounded-lg cursor-pointer"
                      data-active={chapter === i}
                      style={{ border: 'none', background: chapter === i ? undefined : 'transparent' }}
                      onClick={() => { setChapter(i); setTime(c.t); markWatched() }}
                    >
                      {formatClock(c.t)} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mb-4" role="tablist" aria-label="Lesson tabs">
                {(['overview', 'notes', 'practice', 'quiz'] as Tab[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    className="lp-tab px-3 py-1.5 rounded-xl text-sm font-semibold capitalize cursor-pointer"
                    data-active={tab === t}
                    style={{ border: '1px solid rgba(99,102,241,0.14)', background: tab === t ? undefined : 'rgba(255,255,255,0.9)', color: tab === t ? undefined : '#667085' }}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {tab === 'overview' && (
                <div className="space-y-4">
                  <div className="glass rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-ink mb-2">What You&apos;ll Learn</h3>
                    <p className="text-sm text-muted mb-2">By the end of this lesson you will understand:</p>
                    <ul className="text-sm text-ink space-y-1">
                      {ws.objectives.map(o => <li key={o}>✓ {o}</li>)}
                    </ul>
                  </div>
                  <div className="glass rounded-2xl p-5" style={{ borderColor: 'rgba(108,92,231,0.22)' }}>
                    <div className="text-sm font-bold text-ink mb-2">Key Takeaway</div>
                    <p className="text-sm text-muted leading-relaxed mb-3">{ws.takeaway}</p>
                    <button type="button" className="btn-primary text-sm" onClick={() => goAi(`Explain this lesson simply: ${lesson.title}. ${ws.takeaway}`)}>
                      Explain This With AI →
                    </button>
                  </div>
                </div>
              )}

              {tab === 'notes' && (
                <div className="glass rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-ink">My Notes</h3>
                    <div className="text-xs">
                      {workspaceSaveStatus === 'loading' && <span className="text-muted">Loading…</span>}
                      {workspaceSaveStatus === 'saving' && <span className="text-muted">Saving…</span>}
                      {workspaceSaveStatus === 'saved' && <span className="text-success font-semibold">Saved</span>}
                      {workspaceSaveStatus === 'error' && (
                        <span className="text-rose-500">
                          Save failed{workspaceSaveError ? `: ${workspaceSaveError}` : ''}.{' '}
                          <button
                            type="button"
                            className="underline font-semibold cursor-pointer"
                            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit' }}
                            onClick={retryWorkspaceSave}
                          >
                            Retry
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={notes}
                    onChange={e => {
                      setNotes(e.target.value)
                      setNotesSaved(false)
                      if (workspaceSaveStatus === 'saved') setWorkspaceSaveStatus('idle')
                    }}
                    placeholder="Write your notes for this lesson..."
                    className="field w-full p-3 text-sm mb-3"
                    style={{ minHeight: 160 }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary text-sm" onClick={saveNote} disabled={workspaceSaveStatus === 'saving'}>
                      Save Note
                    </button>
                    <button type="button" className="btn-glass text-sm" onClick={() => goAi(`Summarize my notes for ${lesson.title}: ${notes || '(empty)'}`)}>Ask AI to Summarize</button>
                    <button type="button" className="btn-glass text-sm" onClick={() => goAi(`Generate study notes for ${lesson.title}. Include key takeaways and common mistakes.`)}>Generate Study Notes</button>
                  </div>
                </div>
              )}

              {tab === 'practice' && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-ink mb-1">🧠 Practice What You Learned</h3>
                  <p className="text-sm font-semibold text-ink mb-1">{ws.practice.title}</p>
                  <div className="flex gap-2 mb-2">
                    <span className="badge badge-primary">{ws.practice.difficulty}</span>
                    <span className="badge badge-accent">{ws.practice.minutes} minutes</span>
                  </div>
                  <p className="text-sm text-muted mb-3">{ws.practice.description}</p>
                  <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck={false} className="field w-full p-3 text-sm mb-3" style={{ minHeight: 200, fontFamily: 'JetBrains Mono,monospace' }} />
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button type="button" className="btn-primary text-sm" onClick={() => setPracticeOut('document.title updated (mock run)')}>Run Code</button>
                    <button type="button" className="btn-glass text-sm" onClick={() => setHint(ws.practice.hint)}>Get AI Hint</button>
                    <button type="button" className="btn-glass text-sm" onClick={() => { setPracticeDone(true); setPracticeOut('submitted'); persistWorkspace({ practiceDone: true, practiceCode: code }) }}>Submit Solution</button>
                  </div>
                  {hint && (
                    <div className="rounded-xl px-3 py-2 text-sm text-muted mb-3" style={{ background: 'rgba(108,92,231,0.08)' }}>
                      💡 <span className="font-semibold text-ink">Hint </span>{hint}
                    </div>
                  )}
                  {practiceDone && (
                    <div className="rounded-xl p-4" style={{ background: 'rgba(32,201,151,0.1)' }}>
                      <div className="text-sm font-bold text-ink mb-1">🎉 Nice work!</div>
                      <div className="text-sm text-muted mb-2">Your solution correctly uses:</div>
                      {ws.practice.successChecks.map(c => <div key={c} className="text-sm text-success">✓ {c}</div>)}
                      <p className="text-sm text-muted mt-2 mb-3">"{ws.practice.feedback}"</p>
                      <button type="button" className="btn-primary text-sm" onClick={() => { setPracticeDone(false); setCode(ws.practice.starter); setHint(null) }}>Try Another Challenge →</button>
                    </div>
                  )}
                  {practiceOut && !practiceDone && <pre className="text-xs text-muted mt-2">{practiceOut}</pre>}
                </div>
              )}

              {tab === 'quiz' && (
                <div className="glass rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-ink mb-3">🎯 Quick Knowledge Check</h3>
                  {quizDone ? (
                    <div className="text-center">
                      <div className="text-sm text-muted">Your Score</div>
                      <div className="text-3xl font-black gradient-text">{qScore} / {ws.quiz.length}</div>
                      <div className="text-lg font-bold text-ink mb-2">{Math.round((qScore / ws.quiz.length) * 100)}%</div>
                      <p className="text-sm text-muted mb-4">{ws.quizFeedback}</p>
                      <button type="button" className="btn-primary text-sm" onClick={() => { setTab('practice'); setHint(ws.practice.hint) }}>Review Weak Area →</button>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-muted mb-2">Question {qi + 1} / {ws.quiz.length}</div>
                      <div className="progress-bar mb-4"><div className="progress-fill" style={{ width: `${((qi + (lockedQ ? 1 : 0)) / ws.quiz.length) * 100}%` }} /></div>
                      <p className="text-sm font-semibold text-ink mb-3">{quizQ.q}</p>
                      <div className="space-y-2 mb-3">
                        {quizQ.options.map((opt, oi) => {
                          let state = 'idle'
                          if (lockedQ && oi === quizQ.answer) state = 'correct'
                          else if (lockedQ && oi === picked) state = 'wrong'
                          else if (picked === oi) state = 'selected'
                          return (
                            <button
                              key={opt}
                              type="button"
                              className="w-full text-left rounded-xl px-3 py-2.5 text-sm cursor-pointer"
                              style={{
                                border: `1px solid ${state === 'correct' ? '#20C997' : state === 'wrong' ? '#f43f5e' : state === 'selected' ? '#6C5CE7' : 'rgba(99,102,241,0.14)'}`,
                                background: state === 'correct' ? 'rgba(32,201,151,0.12)' : state === 'wrong' ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.9)',
                              }}
                              onClick={() => {
                                if (lockedQ) return
                                setPicked(oi)
                                setLockedQ(true)
                                if (oi === quizQ.answer) setQScore(s => s + 1)
                              }}
                            >
                              {String.fromCharCode(65 + oi)}. {opt}
                            </button>
                          )
                        })}
                      </div>
                      {lockedQ && <p className="text-sm text-muted mb-3">{quizQ.explain}</p>}
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        disabled={!lockedQ}
                        onClick={() => {
                          if (qi + 1 >= ws.quiz.length) {
                            const finalScore = qScore
                            setQuizDone(true)
                            persistWorkspace(buildWorkspaceSnapshot({
                              notes,
                              watched,
                              practiceDone,
                              practiceCode: code,
                              quizDone: true,
                              qScore: finalScore,
                            }))
                          } else {
                            setQi(qi + 1)
                            setPicked(null)
                            setLockedQ(false)
                          }
                        }}
                      >
                        {qi + 1 >= ws.quiz.length ? 'See score' : 'Next'}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="glass rounded-2xl p-5 mt-4">
                <div className="text-sm font-bold text-ink mb-2">Lesson Progress</div>
                <div className="text-xs text-muted mb-2">{[watched, notesSaved, practiceDone, quizDone].filter(Boolean).length * 25}% complete</div>
                <ul className="text-sm space-y-1 mb-3">
                  <li className={watched ? 'text-success' : 'text-muted'}>{watched ? '✓' : '○'} Watch lesson</li>
                  <li className={notesSaved ? 'text-success' : 'text-muted'}>{notesSaved ? '✓' : '○'} Complete notes</li>
                  <li className={practiceDone ? 'text-success' : 'text-muted'}>{practiceDone ? '✓' : '○'} Practice challenge</li>
                  <li className={quizDone ? 'text-success' : 'text-muted'}>{quizDone ? '✓' : '○'} Quick quiz</li>
                </ul>
                <button type="button" className="btn-primary text-sm" disabled={!canComplete || busy} onClick={finishLesson}>
                  {completed.has(lesson.id) ? 'Completed' : 'Complete Lesson →'}
                </button>
              </div>

              {(showNext || completed.has(lesson.id)) && nextLesson && (
                <div className="glass rounded-2xl p-5 mt-4">
                  <div className="text-sm font-bold text-ink mb-1">🎯 Up Next</div>
                  <div className="text-base font-bold text-ink">{ws.nextTitle !== 'Next lesson' ? ws.nextTitle : nextLesson.title}</div>
                  <div className="text-xs text-muted mb-2">{ws.nextMinutes} min · {ws.nextSkills.join(' · ')}</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary text-sm" onClick={() => navigate(lessonPath(id!, nextLesson.id))}>Start Next Lesson →</button>
                    <button type="button" className="btn-glass text-sm" onClick={() => { setShowNext(false); setTab('overview') }}>Review Lesson</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <aside
        className={`${assistOpen ? 'fixed z-40 inset-y-0 right-0 pt-16 w-[300px] block' : 'hidden'} xl:static xl:block w-[300px] flex-shrink-0 overflow-y-auto p-4`}
        style={{ borderLeft: '1px solid rgba(99,102,241,0.12)', background: 'rgba(255,255,255,0.5)' }}
      >
        {assistOpen && (
          <button type="button" className="xl:hidden btn-glass text-sm mb-3" onClick={() => setAssistOpen(false)}>Close</button>
        )}
        <div className="glass rounded-2xl p-4 mb-3">
          <div className="text-sm font-bold text-ink">✨ LearnSyra AI</div>
          <div className="text-xs text-success mb-3">Learning Assistant</div>
          <div className="text-xs text-muted">Current Lesson</div>
          <div className="text-sm font-semibold text-ink mb-2">{lesson.title}</div>
          <div className="text-xs text-muted">Lesson Progress</div>
          <div className="text-sm font-semibold text-ink mb-2">{pct}%</div>
          <div className="text-xs text-muted">Skill</div>
          <div className="text-sm font-semibold text-ink">{ws.skill}</div>
        </div>
        <div className="glass rounded-2xl p-4 mb-3">
          <div className="text-xs font-semibold text-muted mb-2">AI QUICK ACTIONS</div>
          <div className="flex flex-col gap-1.5">
            {[
              ['Explain This Lesson', `Explain ${lesson.title} in this course.`],
              ['Simplify', `Explain ${lesson.title} even more simply.`],
              ['Quiz Me', `Quiz me on ${lesson.title}.`],
              ['Give Practice', `Give me a practice task for ${lesson.title}.`],
              ['Summarize', `Summarize ${lesson.title}.`],
            ].map(([l, p]) => (
              <button key={l} type="button" className="btn-glass text-sm py-2" onClick={() => goAi(p)}>{l}</button>
            ))}
            <button type="button" className="btn-glass text-sm py-2" onClick={() => navigate('/tutors')}>Ask a Tutor</button>
          </div>
        </div>
        {ws.insight ? (
        <div className="glass rounded-2xl p-4 mb-3">
          <div className="text-sm font-bold text-ink mb-1">AI Insight</div>
          <p className="text-sm text-muted leading-relaxed mb-3">"{ws.insight}"</p>
          <button type="button" className="btn-primary text-sm w-full" onClick={() => setTab('practice')}>Practice This →</button>
        </div>
        ) : null}
        <div className="glass rounded-2xl p-4 mb-3">
          <div className="text-sm font-bold text-ink mb-1">Need Help?</div>
          <p className="text-xs text-muted mb-3">Get one-on-one help with this lesson.</p>
          <button type="button" className="btn-primary text-sm w-full mb-2" onClick={() => navigate('/tutors')}>Find a Tutor →</button>
        </div>
        {stuck && (
          <div className="glass rounded-2xl p-4 mb-3" style={{ borderColor: 'rgba(108,92,231,0.28)' }}>
            <div className="text-sm font-bold text-ink">Still stuck?</div>
            <p className="text-sm text-muted mb-3">A human tutor can help you work through this concept.</p>
            <button type="button" className="btn-primary text-sm w-full" onClick={() => navigate('/tutors')}>Book Session →</button>
          </div>
        )}
        <div className="glass rounded-2xl p-4 mb-3">
          <div className="text-sm font-semibold text-ink">
            {streak > 0 ? `${streak} Day Learning Streak` : 'Start a learning streak'}
          </div>
          <p className="text-xs text-muted mt-1">
            {streak > 0 ? 'You are on track. Keep learning today.' : 'Complete a lesson to start your streak.'}
          </p>
        </div>
        <div className="text-xs text-muted px-1">
          {ws.nextTitle && ws.nextTitle !== 'Next lesson' ? `Next: ${ws.nextTitle}` : 'Keep going — pick another lesson when you are ready.'}
        </div>
      </aside>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-4 py-3 flex justify-end" style={{ background: 'rgba(255,255,255,0.94)', borderTop: '1px solid rgba(99,102,241,0.12)' }}>
        <button type="button" className="btn-primary text-sm" disabled={!canComplete || busy} onClick={finishLesson}>Complete Lesson</button>
      </div>
    </div>
  )
}
