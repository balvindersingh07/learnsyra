import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTutorLiveClasses, getProjects, getTutorReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents } from '../lib/api'
import { buildCatalog } from '../lib/courseCatalog'
import { displayInitials } from '../lib/roleAccess'
import { tutorCoursePath, tutorProjectPath, tutorSessionPath, tutorStudentPath } from '../lib/paths'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import { loadTutorHub, selfTutorId } from '../lib/tutorProfile'
import { mergeTutorCourses, type StudioCourse } from '../lib/tutorCourses'
import { buildReviews, type TutorProjectReview } from '../lib/tutorProjects'
import {
  buildTutorSessions,
  loadSessionExtras,
  previousSession,
  type TutorSessionView,
} from '../lib/tutorSessions'
import { buildTutorRoster, formatWhen, learningJourney, type TutorStudent } from '../lib/tutorStudents'
import {
  EMPTY_SELECTION,
  buildExplain,
  buildLessonPlan,
  buildPractice,
  buildQuestions,
  buildQuiz,
  buildSessionPrep,
  buildTeachingPlan,
  confidence,
  confidenceLabel,
  contextLabel,
  courseInsights,
  historyGroupLabel,
  insightForStudent,
  loadHistory,
  loadResources,
  loadSelection,
  parseIncomingPrompt,
  parseResource,
  previousSessionNote,
  projectCoachCopy,
  pushHistory,
  resourceBody,
  saveResources,
  saveSelection,
  skillDisplay,
  skillGapRows,
  takeHandoffPrompt,
  teachingBrief,
  topicOf,
  uid,
  type CopilotAction,
  type CopilotSelection,
  type Difficulty,
  type ExplainDoc,
  type HistoryItem,
  type LessonPlanDoc,
  type PracticeDoc,
  type QuizDoc,
  type ResourceKind,
  type SavedTab,
  type SessionPrepDoc,
  type TeachingPlan,
  type TeachingQuestion,
  type TeachingResource,
} from '../lib/tutorAi'
import './tutor-ai.css'

type Panel = 'home' | CopilotAction | 'saved'

const ACTIONS: { id: CopilotAction; title: string; body: string }[] = [
  { id: 'lesson', title: 'Lesson Plan', body: 'Generate a structured lesson.' },
  { id: 'practice', title: 'Practice', body: 'Create a hands-on exercise.' },
  { id: 'quiz', title: 'Quiz', body: 'Generate assessment questions.' },
  { id: 'explain', title: 'Explain', body: 'Simplify a difficult concept.' },
  { id: 'questions', title: 'Questions', body: 'Generate tutor questions.' },
  { id: 'project', title: 'Project Help', body: 'Create project guidance.' },
  { id: 'interview', title: 'Interview Prep', body: 'Generate interview questions.' },
  { id: 'session', title: 'Session Prep', body: 'Prepare for an upcoming session.' },
]

const TABS: { id: SavedTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lesson', label: 'Lesson Plans' },
  { id: 'practice', label: 'Practice' },
  { id: 'quiz', label: 'Quizzes' },
  { id: 'questions', label: 'Questions' },
  { id: 'explanation', label: 'Explanations' },
  { id: 'session', label: 'Session Plans' },
]

export default function TutorAiTeaching() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || null
  const publicId = tutorId ? (loadTutorHub(tutorId)?.publicId || selfTutorId(tutorId)) : ''
  const [students, setStudents] = useState<TutorStudent[]>([])
  const [source, setSource] = useState<'live' | 'demo'>('live')
  const [sessions, setSessions] = useState<TutorSessionView[]>([])
  const [projects, setProjects] = useState<TutorProjectReview[]>([])
  const [courses, setCourses] = useState<StudioCourse[]>([])
  const [catalog, setCatalog] = useState(buildCatalog([]))
  const [sel, setSel] = useState<CopilotSelection>(EMPTY_SELECTION)
  const [panel, setPanel] = useState<Panel>('home')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [tab, setTab] = useState<SavedTab>('all')
  const [resources, setResources] = useState<TeachingResource[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'assign' | 'send' | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('Intermediate')
  const [duration, setDuration] = useState(20)
  const [quizCount, setQuizCount] = useState<5 | 10 | 15>(5)
  const [plan, setPlan] = useState<TeachingPlan | null>(null)
  const [lesson, setLesson] = useState<LessonPlanDoc | null>(null)
  const [explain, setExplain] = useState<ExplainDoc | null>(null)
  const [practice, setPractice] = useState<PracticeDoc | null>(null)
  const [quiz, setQuiz] = useState<QuizDoc | null>(null)
  const [questions, setQuestions] = useState<TeachingQuestion[] | null>(null)
  const [prep, setPrep] = useState<SessionPrepDoc | null>(null)
  const genRef = useRef(0)

  const student = students.find(s => s.id === sel.studentId)
  const course = courses.find(c => c.id === sel.courseId || c.apiId === sel.courseId)
  const sessionRow = sessions.find(s => s.id === sel.sessionId)
  const project = projects.find(p => p.id === sel.projectId || p.projectId === sel.projectId) || projects.find(p => p.studentId === sel.studentId)
  const journey = student ? learningJourney(student, catalog) : null
  const topic = topicOf(sel, student, sessionRow, project, course)
  const level = confidence(sel, student)
  const brief = teachingBrief(students, source)
  const insight = insightForStudent(student)
  const gaps = skillGapRows(student, course, project)
  const studioNotes = courseInsights(course)
  const prev = sessionRow ? previousSession(sessions, sessionRow) : null
  const prevNote = previousSessionNote(prev, prev && tutorId ? loadSessionExtras(tutorId, prev.id) : null)
  const coach = projectCoachCopy(project, student)
  const next = student?.nextSession

  useEffect(() => {
    if (!tutorId) return
    setSel(loadSelection(tutorId))
    setResources(loadResources(tutorId))
    setHistory(loadHistory(tutorId))
    Promise.all([
      getTutorStudents().catch(() => []),
      getTutorBookings().catch(() => []),
      getTutorReviewQueue().catch(() => []),
      getTutorCourses().catch(() => []),
      getProjects().catch(() => []),
      getTutorLiveClasses().catch(() => []),
    ]).then(([enrollments, bookings, queue, apiCourses, apiProjects, liveClasses]) => {
      const roster = buildTutorRoster({ enrollments, bookings, reviews: queue, localBookings: loadTutorBookings(), apiCourses })
      const studio = mergeTutorCourses(apiCourses, tutorId)
      const builtSessions = buildTutorSessions({
        local: loadTutorBookings(),
        api: bookings,
        liveClasses,
        roster: roster.students,
        tutorUserId: tutorId,
        tutorPublicId: publicId,
      })
      const reviews = buildReviews({ queue, roster: roster.students, apiProjects, tutorId })
      setStudents(roster.students)
      setSource(roster.source)
      setCourses(studio.courses)
      setSessions(builtSessions.sessions)
      setProjects(reviews.reviews)
      setCatalog(buildCatalog(apiCourses))
      const saved = loadSelection(tutorId)
      const prompt = takeHandoffPrompt()
      const qStudent = params.get('student') || ''
      const qCourse = params.get('course') || ''
      const qLesson = params.get('lesson') || ''
      const qProject = params.get('project') || ''
      const qSession = params.get('session') || ''
      const qAction = params.get('action') as CopilotAction | null
      let nextSel = { ...saved }
      let nextAction: CopilotAction | null = qAction
      if (prompt) {
        const parsed = parseIncomingPrompt(prompt, { students: roster.students, sessions: builtSessions.sessions, projects: reviews.reviews, courses: studio.courses })
        nextSel = { ...nextSel, ...parsed.selection }
        nextAction = parsed.action || nextAction
      }
      if (qStudent) nextSel.studentId = qStudent
      if (qCourse) nextSel.courseId = qCourse
      if (qLesson) nextSel.lessonTitle = qLesson
      if (qProject) nextSel.projectId = qProject
      if (qSession) nextSel.sessionId = qSession
      if (!nextSel.studentId && roster.students[0]) nextSel.studentId = roster.students[0].id
      const st = roster.students.find(s => s.id === nextSel.studentId)
      if (st && !nextSel.courseId) nextSel.courseId = st.courses[0]?.id || studio.courses[0]?.id || ''
      if (st && !nextSel.focus) nextSel.focus = st.currentFocus || st.focusSkills[0] || ''
      if (st && !nextSel.sessionId) nextSel.sessionId = st.nextSession?.id || builtSessions.sessions.find(s => s.studentId === st.id)?.id || ''
      if (st && !nextSel.projectId) nextSel.projectId = reviews.reviews.find(r => r.studentId === st.id)?.id || st.projects[0]?.id || ''
      setSel(nextSel)
      if (nextAction) setPanel(nextAction)
    }).finally(() => setLoading(false))
  }, [tutorId, publicId, profile?.id, params])

  useEffect(() => {
    if (!tutorId) return
    saveSelection(tutorId, sel)
  }, [sel, tutorId])

  useEffect(() => {
    if (!ctxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctxOpen])

  const patch = (part: Partial<CopilotSelection>) => setSel(s => ({ ...s, ...part }))
  const clear = () => setSel(EMPTY_SELECTION)

  const run = (fn: () => void, title: string) => {
    const token = ++genRef.current
    setBusy(true)
    setError(null)
    window.setTimeout(() => {
      if (token !== genRef.current) return
      try {
        fn()
        setHistory(pushHistory(tutorId || '', title))
      } catch {
        setError('AI teaching assistance is temporarily unavailable.')
      } finally {
        if (token === genRef.current) setBusy(false)
      }
    }, 420)
  }

  const cancel = () => {
    genRef.current += 1
    setBusy(false)
  }

  const generate = (action: CopilotAction) => {
    setPanel(action)
    const t = topic
    if (action === 'plan' || action === 'project') {
      run(() => setPlan(buildTeachingPlan(t, student?.name ?? null)), `Generated ${t} teaching plan`)
    }
    if (action === 'lesson') run(() => setLesson(buildLessonPlan(t, student?.name ?? null)), `Generated ${t} lesson plan`)
    if (action === 'explain') run(() => setExplain(buildExplain(t, difficulty)), `Generated ${t} explanation`)
    if (action === 'practice') {
      run(() => setPractice(buildPractice(t, difficulty, duration, student?.skills.map(s => s.name).join(', ') || t, project?.title || course?.title || '')), `Created ${t} practice`)
    }
    if (action === 'quiz') run(() => setQuiz(buildQuiz(t, quizCount)), `Created ${t} quiz`)
    if (action === 'questions' || action === 'interview') run(() => setQuestions(buildQuestions(t)), `Generated ${t} questions`)
    if (action === 'session') {
      run(() => setPrep(buildSessionPrep({
        duration: sessionRow?.duration ?? next?.duration ?? 60,
        topic: t,
        gap: student?.focusSkills[0] || null,
        prevTopic: prev?.topic ?? null,
      })), `Prepared ${sessionRow?.topic || t} session`)
    }
  }

  useEffect(() => {
    if (loading) return
    if (panel === 'plan' || panel === 'lesson' || panel === 'explain' || panel === 'practice' || panel === 'quiz' || panel === 'questions' || panel === 'interview' || panel === 'session' || panel === 'project') {
      if (panel === 'plan' && plan) return
      if (panel === 'lesson' && lesson) return
      if (panel === 'explain' && explain) return
      if (panel === 'practice' && practice) return
      if (panel === 'quiz' && quiz) return
      if ((panel === 'questions' || panel === 'interview') && questions) return
      if (panel === 'session' && prep) return
      if (panel === 'project' && plan) return
      generate(panel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const saveCurrent = (kind: ResourceKind, title: string, payload: unknown) => {
    const row: TeachingResource = {
      id: uid('res'),
      kind,
      title,
      createdAt: new Date().toISOString(),
      contextLabel: contextLabel(sel, student, course, sessionRow, project),
      studentId: sel.studentId || null,
      courseId: sel.courseId || null,
      sessionId: sel.sessionId || null,
      projectId: sel.projectId || null,
      body: resourceBody(kind, payload),
    }
    const nextRows = [row, ...resources]
    setResources(nextRows)
    saveResources(tutorId || '', nextRows)
    setHistory(pushHistory(tutorId || '', `Saved ${title}`))
    setNotice('Saved as a teaching resource. Nothing was assigned to the student.')
  }

  const openSaved = (row: TeachingResource) => {
    const payload = parseResource<unknown>(row)
    if (row.kind === 'plan') { setPlan(payload as TeachingPlan); setPanel('plan') }
    if (row.kind === 'lesson') { setLesson(payload as LessonPlanDoc); setPanel('lesson') }
    if (row.kind === 'explanation') { setExplain(payload as ExplainDoc); setPanel('explain') }
    if (row.kind === 'practice') { setPractice(payload as PracticeDoc); setPanel('practice') }
    if (row.kind === 'quiz') { setQuiz(payload as QuizDoc); setPanel('quiz') }
    if (row.kind === 'questions') { setQuestions(payload as TeachingQuestion[]); setPanel('questions') }
    if (row.kind === 'session') { setPrep(payload as SessionPrepDoc); setPanel('session') }
    if (row.studentId || row.courseId || row.sessionId || row.projectId) {
      patch({ studentId: row.studentId || sel.studentId, courseId: row.courseId || sel.courseId, sessionId: row.sessionId || sel.sessionId, projectId: row.projectId || sel.projectId })
    }
  }

  const removeSaved = (id: string) => {
    const nextRows = resources.filter(r => r.id !== id)
    setResources(nextRows)
    saveResources(tutorId || '', nextRows)
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Copied. Review before using with a student.')
    } catch {
      setNotice('Copy is unavailable in this browser.')
    }
  }

  const lessons = useMemo(() => {
    const fromStudio = course?.modules.flatMap(m => m.lessons.map(l => l.title)) ?? []
    const extra = [journey?.currentLesson, journey?.nextLesson, sel.lessonTitle].filter(Boolean) as string[]
    return Array.from(new Set([...fromStudio, ...extra]))
  }, [course, journey, sel.lessonTitle])

  const studentProjects: { id: string; title: string }[] = student
    ? [
        ...projects.filter(p => p.studentId === student.id).map(p => ({ id: p.id, title: p.title })),
        ...student.projects.filter(p => !projects.some(r => r.projectId === p.id || r.id === p.id)).map(p => ({ id: p.id, title: p.title })),
      ]
    : projects.map(p => ({ id: p.id, title: p.title }))

  const studentSessions = student ? sessions.filter(s => s.studentId === student.id) : sessions
  const savedFiltered = resources.filter(r => tab === 'all' || r.kind === tab || (tab === 'lesson' && r.kind === 'plan'))
  const groupedHistory = history.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    const key = historyGroupLabel(item.at)
    acc[key] = acc[key] || []
    acc[key].push(item)
    return acc
  }, {})

  const toolbar = (opts: { copy: string; onSave: () => void; onRegen: () => void }) => (
    <div className="flex flex-wrap gap-2 mb-4">
      <button type="button" className="btn-glass text-xs" onClick={() => copyText(opts.copy)}>Copy</button>
      <button type="button" className="btn-glass text-xs" onClick={opts.onSave}>Save</button>
      <button type="button" className="btn-glass text-xs" onClick={opts.onRegen}>Regenerate</button>
      <button type="button" className="btn-glass text-xs" onClick={() => { setPanel('home'); setNotice(null) }}>Discard</button>
    </div>
  )

  const selectors = (
    <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
      <label className="text-xs font-semibold text-muted">Student
        <select className="field w-full mt-1 px-3 py-2 text-sm" value={sel.studentId} onChange={e => {
          const id = e.target.value
          const st = students.find(s => s.id === id)
          patch({ studentId: id, courseId: st?.courses[0]?.id || sel.courseId, focus: st?.currentFocus || st?.focusSkills[0] || sel.focus, sessionId: st?.nextSession?.id || '', projectId: projects.find(p => p.studentId === id)?.id || st?.projects[0]?.id || '' })
        }}>
          <option value="">Select student</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">Course
        <select className="field w-full mt-1 px-3 py-2 text-sm" value={sel.courseId} onChange={e => patch({ courseId: e.target.value })}>
          <option value="">Select course</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          {student?.courses.filter(c => !courses.some(x => x.id === c.id || x.title === c.title)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">Lesson
        <select className="field w-full mt-1 px-3 py-2 text-sm" value={sel.lessonTitle} onChange={e => patch({ lessonTitle: e.target.value, focus: e.target.value || sel.focus })}>
          <option value="">Current lesson</option>
          {lessons.map(l => <option key={l}>{l}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">Project
        <select className="field w-full mt-1 px-3 py-2 text-sm" value={sel.projectId} onChange={e => patch({ projectId: e.target.value })}>
          <option value="">Select project</option>
          {studentProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">Session
        <select className="field w-full mt-1 px-3 py-2 text-sm" value={sel.sessionId} onChange={e => patch({ sessionId: e.target.value })}>
          <option value="">Select session</option>
          {studentSessions.map(s => <option key={s.id} value={s.id}>{s.topic} · {s.studentName}</option>)}
        </select>
      </label>
    </div>
  )

  const contextPanel = (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">{confidenceLabel(level)}</div>
      {student && (
        <section className="glass rounded-2xl p-4">
          <h2 className="text-base font-black text-ink mb-2">Student Context</h2>
          <p className="font-semibold text-ink">{student.name}</p>
          <p className="text-xs text-muted">Target: {student.career.target || student.headline || 'Data unavailable.'}</p>
          <p className="text-xs text-muted mt-1">Course progress: {student.overallProgress}%</p>
          <h3 className="text-xs font-bold text-ink mt-3 mb-1">Skill Snapshot</h3>
          {student.skills.length === 0 && <p className="text-xs text-muted">Data unavailable.</p>}
          {student.skills.map(s => (
            <div key={s.name} className="flex justify-between text-xs mb-1"><span>{s.name}</span><span>{skillDisplay(s.score)}</span></div>
          ))}
          <p className="text-xs text-muted mt-2">Current project: {student.projects[0]?.title || 'None on file'}</p>
          <p className="text-xs text-muted">Next session: {next ? `${formatWhen(next.when)}` : 'None on file'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorStudentPath(student.id))}>View Student</button>
            {next && <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorSessionPath(next.id))}>View Session</button>}
            {project && <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorProjectPath(project.id))}>Review Project</button>}
          </div>
        </section>
      )}
      {student && (
        <section className="glass rounded-2xl p-4">
          <h2 className="text-base font-black text-ink mb-2">Learning Progress</h2>
          <p className="text-xs text-muted">Course: {student.courses[0] ? `${student.courses[0].progress}%` : 'Data unavailable.'}</p>
          <p className="text-xs text-muted">Project: {project?.progress != null ? `${project.progress}%` : student.projects[0]?.progress != null ? `${student.projects[0].progress}%` : 'Data unavailable.'}</p>
          {student.skills.filter(s => s.score != null).slice(0, 4).map(s => <p key={s.name} className="text-xs text-muted">{s.name}: {s.score}%</p>)}
          <p className="text-xs text-muted mt-2">Practice completion: Data unavailable.</p>
          <p className="text-xs text-muted">Session activity: {student.sessions.length ? `${student.sessions.length} on file` : 'Data unavailable.'}</p>
          <p className="text-sm font-semibold text-ink mt-2">Teaching Priority: {student.focusSkills[0] || sel.focus || 'Not listed'}</p>
        </section>
      )}
      <section className="glass rounded-2xl p-4">
        <h2 className="text-base font-black text-ink mb-2">Skill Gap Analysis</h2>
        {gaps.length === 0 && <p className="text-xs text-muted">Not enough learning data to make a recommendation.</p>}
        {gaps.map(g => <div key={g.name} className="text-sm">{g.name} {g.mark === 'have' ? '✓' : g.mark === 'gap' ? '⚠' : '· Data unavailable'}</div>)}
        <p className="text-xs text-muted mt-2">{gaps.some(g => g.mark === 'gap') ? `Prioritize ${gaps.find(g => g.mark === 'gap')?.name} before advanced work.` : insight.enough ? insight.text : 'Not enough learning data to make a recommendation.'}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className="btn-primary text-xs" onClick={() => generate('plan')}>Create Learning Plan</button>
          <button type="button" className="btn-glass text-xs" onClick={() => generate('practice')}>Create Practice</button>
          {sel.courseId && <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorCoursePath(sel.courseId))}>Assign Course Lesson</button>}
        </div>
      </section>
      {student?.career.target && (
        <section className="glass rounded-2xl p-4">
          <h2 className="text-base font-black text-ink mb-2">🎯 Career Context</h2>
          <p className="text-sm">Target: {student.career.target}</p>
          <p className="text-xs text-muted">Career Match: {student.career.overall != null ? `${student.career.overall}%` : 'Data unavailable.'}</p>
          <p className="text-xs text-muted mt-2">Supports career preparation. This is not a hiring guarantee.</p>
        </section>
      )}
      {course && (
        <section className="glass rounded-2xl p-4">
          <h2 className="text-base font-black text-ink mb-2">Course</h2>
          <p className="text-sm font-semibold text-ink">{course.title}</p>
          <p className="text-xs text-muted">Current module: {course.modules[0]?.title || 'Data unavailable.'}</p>
          <p className="text-xs text-muted">Current lesson: {sel.lessonTitle || journey?.currentLesson || 'Data unavailable.'}</p>
          <p className="text-xs text-muted">Upcoming lesson: {journey?.nextLesson || 'Data unavailable.'}</p>
          <p className="text-xs text-muted">Skills: {course.primarySkills.join(' · ') || 'Data unavailable.'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorCoursePath(course.id))}>Open Course</button>
            <button type="button" className="btn-glass text-xs" onClick={() => generate('lesson')}>Create Lesson Plan</button>
            <button type="button" className="btn-glass text-xs" onClick={() => generate('quiz')}>Create Quiz</button>
          </div>
        </section>
      )}
    </div>
  )

  if (loading) {
    return <div className="pt-24 px-6 text-muted">Loading teaching copilot…</div>
  }

  if (source === 'live' && students.length === 0) {
    return (
      <div className="tai-page pt-20 px-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>AI Teaching Copilot</h1>
        <p className="text-muted mb-6">Once you have students, LearnSyra can use their learning context to personalize your teaching.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => navigate('/tutor/profile')}>Complete Tutor Profile</button>
          <button type="button" className="btn-glass" onClick={() => navigate('/tutor/courses')}>Explore Course Studio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="tai-page pt-20 px-4 sm:px-6 pb-16 max-w-[90rem] mx-auto overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>AI Teaching Copilot</h1>
          <p className="text-muted">Turn student progress into better teaching decisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm xl:hidden" onClick={() => setCtxOpen(true)}>View Context</button>
          <button type="button" className="btn-glass text-sm" onClick={clear}>Clear Context</button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 mb-5">
        {selectors}
        {(student || course) && (
          <p className="text-xs text-muted mt-3">Current focus: {topic}</p>
        )}
      </div>

      <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_18rem] gap-6">
        <aside className="tai-left-desktop tai-rail space-y-4">
          <section className="glass rounded-2xl p-4">
            <h2 className="text-sm font-black text-ink mb-2">Students</h2>
            <div className="space-y-2 max-h-64 overflow-auto">
              {students.slice(0, 8).map(s => (
                <button key={s.id} type="button" className="tai-chip w-full text-left rounded-xl px-3 py-2 text-xs" data-on={sel.studentId === s.id} onClick={() => patch({ studentId: s.id, courseId: s.courses[0]?.id || sel.courseId, focus: s.currentFocus || s.focusSkills[0] || '', sessionId: s.nextSession?.id || '', projectId: projects.find(p => p.studentId === s.id)?.id || s.projects[0]?.id || '' })}>
                  {s.name}
                </button>
              ))}
            </div>
          </section>
          <section className="glass rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-black text-ink">Saved Resources</h2>
              <button type="button" className="text-xs text-primary" style={{ background: 'none', border: 'none' }} onClick={() => setPanel('saved')}>Open</button>
            </div>
            {resources.slice(0, 5).map(r => (
              <button key={r.id} type="button" className="block w-full text-left text-xs text-muted mb-2" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => openSaved(r)}>
                {r.title}
              </button>
            ))}
            {resources.length === 0 && <p className="text-xs text-muted">No AI teaching resources yet.</p>}
          </section>
        </aside>

        <div>
          <p className="text-xs font-semibold text-primary mb-3">AI Suggested · Tutor decides what to use.</p>
          {error && (
            <div className="glass rounded-2xl p-4 mb-4 text-sm" style={{ color: '#e11d48' }}>
              {error}
              <div className="flex gap-2 mt-2">
                <button type="button" className="btn-primary text-xs" onClick={() => panel !== 'home' && panel !== 'saved' && generate(panel)}>Retry</button>
                <button type="button" className="btn-glass text-xs" onClick={() => { setError(null); setPanel('home') }}>Continue manually</button>
              </div>
            </div>
          )}
          {notice && <div className="glass rounded-2xl p-3 mb-4 text-xs text-muted">{notice}</div>}
          {busy && (
            <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-3">
              <div className="tai-spin" aria-hidden />
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">Generating…</div>
                <div className="tai-skel mt-2" />
              </div>
              <button type="button" className="btn-glass text-xs" onClick={cancel}>Cancel</button>
            </div>
          )}

          {panel === 'home' && (
            <>
              <section className="tai-hero glass rounded-3xl p-5 mb-5">
                <h2 className="text-lg font-black text-ink mb-1">✨ Today&apos;s Teaching Brief</h2>
                <p className="text-sm text-ink mb-4">{brief.count} student{brief.count === 1 ? '' : 's'} need focused attention today.</p>
                {brief.student ? (
                  <>
                    <div className="text-xs text-muted">Priority</div>
                    <div className="font-bold text-ink">{brief.student.name}</div>
                    <div className="text-sm text-muted mb-3">{brief.gapName || 'Focus not listed'} {brief.gapScore != null ? `${brief.gapScore}%` : ''}</div>
                    <div className="text-xs text-muted">Recommended Action</div>
                    <p className="text-sm text-ink mb-4">{brief.action}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary text-sm" onClick={() => { if (brief.student) patch({ studentId: brief.student.id, focus: brief.gapName || sel.focus }); generate('plan') }}>Start Teaching Plan</button>
                      {brief.student && <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorStudentPath(brief.student!.id))}>View Student</button>}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">Not enough learning data to make a recommendation.</p>
                )}
              </section>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
                {ACTIONS.map(a => (
                  <button key={a.id} type="button" className="tai-action glass rounded-2xl p-4 text-left" onClick={() => generate(a.id)}>
                    <div className="font-bold text-ink">{a.title}</div>
                    <div className="text-xs text-muted mt-1">{a.body}</div>
                  </button>
                ))}
              </div>

              <section className="glass rounded-2xl p-5 mb-5">
                <h2 className="text-lg font-black text-ink mb-2">✨ AI Teaching Insight</h2>
                <p className="text-sm text-ink mb-3">{insight.text}</p>
                {insight.enough && (
                  <>
                    <h3 className="text-sm font-bold text-ink">Why This Matters</h3>
                    <p className="text-sm text-muted mb-3">{insight.why}</p>
                    <h3 className="text-sm font-bold text-ink">Recommended Focus</h3>
                    <ul className="text-sm text-muted list-disc pl-5 mb-3">{insight.focus.map(f => <li key={f}>{f}</li>)}</ul>
                  </>
                )}
                <button type="button" className="btn-primary text-sm" onClick={() => generate('plan')}>Create Teaching Plan</button>
              </section>

              {project && (
                <section className="glass rounded-2xl p-5 mb-5">
                  <h2 className="text-lg font-black text-ink mb-2">🚀 Project Teaching Coach</h2>
                  <p className="text-sm">{project.title}</p>
                  <p className="text-xs text-muted">Current milestone: {coach.milestone || 'Data unavailable.'}</p>
                  <p className="text-xs text-muted mb-2">Student progress: {coach.progress != null ? `${coach.progress}%` : 'Data unavailable.'}</p>
                  <p className="text-sm text-ink mb-3">{coach.rec}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-glass text-xs" onClick={() => { patch({ focus: 'Error handling' }); generate('explain') }}>Explain Error Handling</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => generate('practice')}>Create Practice</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorProjectPath(project.id))}>Review Submission</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => generate('session')}>Prepare Session</button>
                  </div>
                </section>
              )}

              {sessionRow && (
                <section className="glass rounded-2xl p-5 mb-5">
                  <h2 className="text-lg font-black text-ink mb-2">📅 Session Preparation</h2>
                  <p className="text-sm">{sessionRow.studentName} · {sessionRow.topic} · {sessionRow.duration ? `${sessionRow.duration} min` : 'Duration not listed'}</p>
                  <p className="text-xs text-muted mb-3">Previous session: {prev?.topic || 'No previous session data available.'}</p>
                  <button type="button" className="btn-primary text-sm mr-2" onClick={() => generate('session')}>Use in Session</button>
                  <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorSessionPath(sessionRow.id))}>Open Session</button>
                </section>
              )}

              {course && studioNotes.lines.length > 0 && (
                <section className="glass rounded-2xl p-5 mb-5">
                  <h2 className="text-lg font-black text-ink mb-2">Course Teaching Insights</h2>
                  <ul className="text-sm text-muted list-disc pl-5 mb-3">{studioNotes.lines.map(l => <li key={l}>{l}</li>)}</ul>
                  <button type="button" className="btn-primary text-sm" onClick={() => generate('practice')}>Create Practice</button>
                  <button type="button" className="btn-glass text-sm ml-2" onClick={() => navigate(tutorCoursePath(course.id))}>Edit Course</button>
                </section>
              )}

              <section className="glass rounded-2xl p-5">
                <h2 className="text-lg font-black text-ink mb-3">Recent AI Teaching Work</h2>
                {history.length === 0 && <p className="text-sm text-muted">No AI teaching resources yet.</p>}
                {Object.entries(groupedHistory).map(([label, items]) => (
                  <div key={label} className="mb-3">
                    <div className="text-xs font-semibold text-muted mb-1">{label}</div>
                    {items.map(h => <div key={h.id} className="text-sm text-ink">{h.title}</div>)}
                  </div>
                ))}
              </section>
            </>
          )}

          {panel === 'plan' && plan && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-2">{plan.title}</h2>
              {toolbar({ copy: Object.values(plan).join('\n\n'), onSave: () => saveCurrent('plan', plan.title, plan), onRegen: () => generate('plan') })}
              {(['warmup', 'concept', 'guided', 'independent', 'review'] as const).map((k, i) => (
                <label key={k} className="block text-xs font-semibold text-muted mb-3">
                  {['0–5 min Warm-up', '5–15 min Concept explanation', '15–30 min Guided coding', '30–40 min Independent practice', '40–45 min Review + next step'][i]}
                  <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={3} value={plan[k]} onChange={e => setPlan({ ...plan, [k]: e.target.value })} />
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => saveCurrent('plan', plan.title, plan)}>Accept Plan</button>
                <button type="button" className="btn-glass text-sm" onClick={() => setNotice('Edit any section above. The plan is not assigned until you use it in a session.')}>Edit Plan</button>
                <button type="button" className="btn-glass text-sm" onClick={() => generate('plan')}>Regenerate</button>
              </div>
            </section>
          )}

          {panel === 'lesson' && lesson && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-3">Lesson Plan</h2>
              {toolbar({ copy: Object.values(lesson).join('\n\n'), onSave: () => saveCurrent('lesson', lesson.title, lesson), onRegen: () => generate('lesson') })}
              {(Object.keys(lesson) as (keyof LessonPlanDoc)[]).map(k => (
                <label key={k} className="block text-xs font-semibold text-muted mb-3 capitalize">
                  {k === 'objective' ? 'Learning objective' : k}
                  <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={k === 'title' ? 1 : 2} value={lesson[k]} onChange={e => setLesson({ ...lesson, [k]: e.target.value })} />
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => saveCurrent('lesson', lesson.title, lesson)}>Use Plan</button>
                <button type="button" className="btn-glass text-sm" onClick={() => saveCurrent('lesson', lesson.title, lesson)}>Save</button>
                <button type="button" className="btn-glass text-sm" onClick={() => setConfirm('send')}>Send to Student</button>
              </div>
            </section>
          )}

          {panel === 'explain' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-3">Explain Concept</h2>
              <div className="flex flex-wrap gap-3 mb-4">
                <label className="text-xs font-semibold text-muted flex-1">Topic
                  <input className="field w-full mt-1 px-3 py-2 text-sm" value={sel.focus} onChange={e => patch({ focus: e.target.value })} placeholder="useEffect dependency array" />
                </label>
                <fieldset>
                  <legend className="text-xs font-semibold text-muted mb-1">Difficulty</legend>
                  {(['Beginner', 'Intermediate', 'Advanced'] as Difficulty[]).map(d => (
                    <button key={d} type="button" className="tai-chip rounded-full px-3 py-1.5 text-xs mr-1" data-on={difficulty === d} onClick={() => setDifficulty(d)}>{d}</button>
                  ))}
                </fieldset>
                <button type="button" className="btn-primary text-sm self-end" onClick={() => generate('explain')}>Generate</button>
              </div>
              {explain && (
                <>
                  {toolbar({ copy: [explain.simple, explain.example, explain.mistake, explain.tryThis, explain.tutorTip].join('\n\n'), onSave: () => saveCurrent('explanation', explain.topic, explain), onRegen: () => generate('explain') })}
                  <label className="block text-xs font-semibold text-muted mb-3">Simple explanation<textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={3} value={explain.simple} onChange={e => setExplain({ ...explain, simple: e.target.value })} /></label>
                  <label className="block text-xs font-semibold text-muted mb-3">Example<textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={3} value={explain.example} onChange={e => setExplain({ ...explain, example: e.target.value })} /></label>
                  <label className="block text-xs font-semibold text-muted mb-3">Common mistake<textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={2} value={explain.mistake} onChange={e => setExplain({ ...explain, mistake: e.target.value })} /></label>
                  <label className="block text-xs font-semibold text-muted mb-3">Try this<textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={2} value={explain.tryThis} onChange={e => setExplain({ ...explain, tryThis: e.target.value })} /></label>
                  <label className="block text-xs font-semibold text-muted mb-3">Tutor tip<textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={2} value={explain.tutorTip} onChange={e => setExplain({ ...explain, tutorTip: e.target.value })} /></label>
                </>
              )}
            </section>
          )}

          {panel === 'practice' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-3">Practice Builder</h2>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <label className="text-xs font-semibold text-muted">Topic<input className="field w-full mt-1 px-3 py-2 text-sm" value={sel.focus} onChange={e => patch({ focus: e.target.value })} /></label>
                <label className="text-xs font-semibold text-muted">Duration
                  <select className="field w-full mt-1 px-3 py-2 text-sm" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                    {[10, 20, 30, 45].map(n => <option key={n} value={n}>{n} minutes</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="btn-primary text-sm mb-4" onClick={() => generate('practice')}>Generate</button>
              {practice && (
                <>
                  {toolbar({ copy: Object.values(practice).join('\n\n'), onSave: () => saveCurrent('practice', practice.topic, practice), onRegen: () => generate('practice') })}
                  {(Object.keys(practice) as (keyof PracticeDoc)[]).filter(k => !['difficulty', 'duration'].includes(k)).map(k => (
                    <label key={k} className="block text-xs font-semibold text-muted mb-3 capitalize">
                      {k}
                      <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={2} value={String(practice[k])} onChange={e => setPractice({ ...practice, [k]: e.target.value })} />
                    </label>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary text-sm" onClick={() => setConfirm('assign')}>Assign</button>
                    <button type="button" className="btn-glass text-sm" onClick={() => saveCurrent('practice', practice.topic, practice)}>Save</button>
                  </div>
                </>
              )}
            </section>
          )}

          {panel === 'quiz' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-2">Quiz Builder</h2>
              <p className="text-xs text-muted mb-3">AI output must be reviewed by the tutor. Nothing is scored automatically.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {([5, 10, 15] as const).map(n => (
                  <button key={n} type="button" className="tai-chip rounded-full px-3 py-1.5 text-xs" data-on={quizCount === n} onClick={() => setQuizCount(n)}>{n} questions</button>
                ))}
                <button type="button" className="btn-primary text-sm" onClick={() => generate('quiz')}>Generate</button>
              </div>
              {quiz && (
                <>
                  {toolbar({ copy: quiz.questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n'), onSave: () => saveCurrent('quiz', quiz.title, quiz), onRegen: () => generate('quiz') })}
                  {quiz.questions.map((q, i) => (
                    <div key={q.id} className="glass rounded-xl p-3 mb-3">
                      <div className="flex justify-between gap-2 mb-2">
                        <span className="text-xs text-muted">{q.kind} · {q.difficulty}</span>
                        <div className="flex gap-1">
                          <button type="button" className="btn-glass text-[10px]" disabled={i === 0} onClick={() => setQuiz({ ...quiz, questions: move(quiz.questions, i, -1) })}>Up</button>
                          <button type="button" className="btn-glass text-[10px]" disabled={i === quiz.questions.length - 1} onClick={() => setQuiz({ ...quiz, questions: move(quiz.questions, i, 1) })}>Down</button>
                          <button type="button" className="btn-glass text-[10px]" onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter(x => x.id !== q.id) })}>Delete</button>
                        </div>
                      </div>
                      <textarea className="field w-full px-3 py-2 text-sm mb-2" rows={2} value={q.question} onChange={e => setQuiz({ ...quiz, questions: quiz.questions.map(x => x.id === q.id ? { ...x, question: e.target.value } : x) })} />
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2 text-xs mb-1">
                          <input type="checkbox" checked={q.answers.includes(oi)} onChange={() => setQuiz({ ...quiz, questions: quiz.questions.map(x => x.id === q.id ? { ...x, answers: toggleAns(x.answers, oi) } : x) })} />
                          <input className="field flex-1 px-2 py-1" value={opt} onChange={e => setQuiz({ ...quiz, questions: quiz.questions.map(x => x.id === q.id ? { ...x, options: x.options.map((o, j) => j === oi ? e.target.value : o) } : x) })} />
                        </label>
                      ))}
                      <textarea className="field w-full mt-2 px-3 py-2 text-xs" rows={2} value={q.explanation} onChange={e => setQuiz({ ...quiz, questions: quiz.questions.map(x => x.id === q.id ? { ...x, explanation: e.target.value } : x) })} />
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary text-sm" onClick={() => saveCurrent('quiz', quiz.title, quiz)}>Save Quiz</button>
                    <button type="button" className="btn-glass text-sm" onClick={() => sel.courseId ? navigate(tutorCoursePath(sel.courseId)) : setNotice('Select a course first. The quiz is not inserted automatically.')}>Use in Course</button>
                    <button type="button" className="btn-glass text-sm" onClick={() => sel.sessionId ? navigate(tutorSessionPath(sel.sessionId)) : setNotice('Select a session first. The quiz is not inserted automatically.')}>Use in Session</button>
                  </div>
                </>
              )}
            </section>
          )}

          {(panel === 'questions' || panel === 'interview') && questions && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-3">Teaching Questions</h2>
              {toolbar({ copy: questions.map(q => q.text).join('\n'), onSave: () => saveCurrent('questions', `${topic} questions`, questions), onRegen: () => generate('questions') })}
              {questions.map(q => (
                <div key={q.id} className="glass rounded-xl p-3 mb-2">
                  <div className="text-[11px] text-muted mb-1">{q.kind} · {q.difficulty}</div>
                  <textarea className="field w-full px-3 py-2 text-sm" rows={2} value={q.text} onChange={e => setQuestions(questions.map(x => x.id === q.id ? { ...x, text: e.target.value } : x))} />
                  <button type="button" className="btn-glass text-xs mt-2" onClick={() => copyText(q.text)}>Copy</button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className="btn-primary text-sm" onClick={() => saveCurrent('questions', `${topic} questions`, questions)}>Save</button>
                <button type="button" className="btn-glass text-sm" onClick={() => sel.sessionId ? navigate(tutorSessionPath(sel.sessionId)) : setNotice('Select a session to use these questions there.')}>Use in Session</button>
              </div>
            </section>
          )}

          {panel === 'session' && prep && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-2">📅 Session Preparation</h2>
              <p className="text-sm text-muted mb-3">{student?.name || sessionRow?.studentName || 'Student'} · {sessionRow?.topic || topic} · {sessionRow?.duration || 60} min</p>
              <h3 className="text-sm font-bold text-ink mb-2">Previous Session</h3>
              {prevNote.available ? (
                <p className="text-sm text-muted mb-3">{prevNote.topic} · {prevNote.covered} · {prevNote.actions}</p>
              ) : <p className="text-sm text-muted mb-3">{prevNote.text}</p>}
              <p className="text-sm text-ink mb-4">{prep.followUp}</p>
              {toolbar({ copy: prep.agenda.map(a => `${a.minutes} min — ${a.label}`).join('\n'), onSave: () => saveCurrent('session', `${topic} session plan`, prep), onRegen: () => generate('session') })}
              <h3 className="text-sm font-bold text-ink mb-2">Suggested Agenda</h3>
              {prep.agenda.map((a, i) => (
                <label key={i} className="block text-xs font-semibold text-muted mb-2">
                  {a.minutes} min
                  <input className="field w-full mt-1 px-3 py-2 text-sm" value={a.label} onChange={e => setPrep({ ...prep, agenda: prep.agenda.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
                </label>
              ))}
              <h3 className="text-sm font-bold text-ink mt-3 mb-2">Suggested Questions</h3>
              {prep.questions.map((q, i) => (
                <input key={i} className="field w-full mb-2 px-3 py-2 text-sm" value={q} onChange={e => setPrep({ ...prep, questions: prep.questions.map((x, j) => j === i ? e.target.value : x) })} />
              ))}
              <h3 className="text-sm font-bold text-ink mt-3 mb-2">Suggested Practice</h3>
              <textarea className="field w-full px-3 py-2 text-sm mb-4" rows={3} value={prep.practice} onChange={e => setPrep({ ...prep, practice: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => sel.sessionId ? navigate(tutorSessionPath(sel.sessionId)) : setNotice('Select a session. The agenda is not applied automatically.')}>Use in Session</button>
                <button type="button" className="btn-glass text-sm" onClick={() => saveCurrent('session', `${topic} session plan`, prep)}>Save</button>
              </div>
            </section>
          )}

          {panel === 'project' && plan && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-2">🚀 Project Teaching Coach</h2>
              <p className="text-sm mb-3">{project?.title || 'No project selected'}</p>
              <p className="text-sm text-muted mb-4">{coach.rec}</p>
              {toolbar({ copy: plan.guided, onSave: () => saveCurrent('plan', `${topic} project plan`, plan), onRegen: () => generate('project') })}
              <div className="flex flex-wrap gap-2">
                {project && <button type="button" className="btn-primary text-sm" onClick={() => navigate(tutorProjectPath(project.id))}>Review Submission</button>}
                <button type="button" className="btn-glass text-sm" onClick={() => generate('explain')}>Explain</button>
                <button type="button" className="btn-glass text-sm" onClick={() => generate('practice')}>Create Practice</button>
              </div>
            </section>
          )}

          {panel === 'saved' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-xl font-black text-ink mb-3">Saved Resources</h2>
              <div className="flex flex-wrap gap-2 mb-4" role="tablist">
                {TABS.map(t => (
                  <button key={t.id} type="button" role="tab" className="tai-chip rounded-full px-3 py-1.5 text-xs" data-on={tab === t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
              </div>
              {savedFiltered.length === 0 && <p className="text-sm text-muted">No AI teaching resources yet.</p>}
              {savedFiltered.map(r => (
                <div key={r.id} className="glass rounded-xl p-3 mb-2 flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="font-semibold text-ink text-sm">{r.title}</div>
                    <div className="text-xs text-muted">{r.kind} · {new Date(r.createdAt).toLocaleString()} · {r.contextLabel}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-xs" onClick={() => openSaved(r)}>Open</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => openSaved(r)}>Edit</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => { openSaved(r); setNotice('Opened for use. Nothing was assigned automatically.') }}>Use</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => removeSaved(r.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>

        <aside className="tai-right-desktop tai-rail">{contextPanel}</aside>
      </div>

      {ctxOpen && (
        <div className="tai-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 xl:hidden" role="dialog" aria-modal="true" aria-labelledby="tai-ctx">
          <button type="button" className="absolute inset-0" aria-label="Close context" style={{ background: 'transparent', border: 'none' }} onClick={() => setCtxOpen(false)} />
          <div className="glass rounded-3xl p-5 relative z-10 w-full max-w-md max-h-[85vh] overflow-auto">
            <h2 id="tai-ctx" className="text-lg font-black text-ink mb-3">Context</h2>
            {contextPanel}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setCtxOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {confirm && (
        <div className="tai-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Cancel" style={{ background: 'transparent', border: 'none' }} onClick={() => setConfirm(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            {confirm === 'assign' ? (
              <>
                <h2 className="text-lg font-black text-ink mb-2">Assign practice?</h2>
                <p className="text-sm text-muted mb-4">This does not change student progress, course curriculum, or project status. Open the student or session to follow up.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-glass text-sm" onClick={() => setConfirm(null)}>Cancel</button>
                  <button type="button" className="btn-primary text-sm" onClick={() => { if (practice) saveCurrent('practice', practice.topic, practice); setConfirm(null); setNotice('Saved locally. Not assigned automatically.') }}>Save only</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-black text-ink mb-2">Send to student?</h2>
                <p className="text-sm text-muted mb-4">Student messaging is not available in this environment. This is a labeled placeholder — no second messaging system was created.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-glass text-sm" onClick={() => setConfirm(null)}>Close</button>
                  {student && <button type="button" className="btn-primary text-sm" onClick={() => { setConfirm(null); navigate(tutorStudentPath(student.id)) }}>View Student</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function move<T>(rows: T[], index: number, dir: number) {
  const next = [...rows]
  const j = index + dir
  if (j < 0 || j >= next.length) return rows
  const [item] = next.splice(index, 1)
  next.splice(j, 0, item)
  return next
}

function toggleAns(answers: number[], i: number) {
  return answers.includes(i) ? answers.filter(n => n !== i) : [...answers, i]
}
