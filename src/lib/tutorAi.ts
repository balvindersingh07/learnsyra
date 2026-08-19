import { takePendingAiPrompt } from './dashboardIntel'
import type { StudioCourse } from './tutorCourses'
import type { SessionExtras, TutorSessionView } from './tutorSessions'
import type { TutorStudent } from './tutorStudents'
import type { TutorProjectReview } from './tutorProjects'

export type CopilotAction =
  | 'plan'
  | 'lesson'
  | 'explain'
  | 'practice'
  | 'quiz'
  | 'questions'
  | 'project'
  | 'session'
  | 'interview'

export type ResourceKind = 'lesson' | 'practice' | 'quiz' | 'questions' | 'explanation' | 'session' | 'plan'
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'
export type Confidence = 'based' | 'limited' | 'none'
export type SavedTab = 'all' | ResourceKind

export interface CopilotSelection {
  studentId: string
  courseId: string
  lessonTitle: string
  projectId: string
  sessionId: string
  focus: string
}

export interface TeachingPlan {
  title: string
  warmup: string
  concept: string
  guided: string
  independent: string
  review: string
}

export interface LessonPlanDoc {
  title: string
  objective: string
  prerequisites: string
  concepts: string
  examples: string
  steps: string
  practice: string
  assessment: string
  homework: string
}

export interface ExplainDoc {
  topic: string
  difficulty: Difficulty
  simple: string
  example: string
  mistake: string
  tryThis: string
  tutorTip: string
}

export interface PracticeDoc {
  topic: string
  difficulty: Difficulty
  duration: number
  skills: string
  context: string
  problem: string
  requirements: string
  starter: string
  hints: string
  expected: string
  extension: string
}

export interface QuizItem {
  id: string
  kind: 'mcq' | 'tf' | 'multi'
  question: string
  options: string[]
  answers: number[]
  explanation: string
  difficulty: Difficulty
}

export interface QuizDoc {
  title: string
  count: 5 | 10 | 15
  questions: QuizItem[]
}

export interface TeachingQuestion {
  id: string
  kind: 'concept' | 'debug' | 'critical' | 'interview' | 'project'
  difficulty: 'Easy' | 'Medium' | 'Hard'
  text: string
}

export interface SessionPrepDoc {
  agenda: { minutes: number; label: string }[]
  questions: string[]
  practice: string
  followUp: string
}

export interface TeachingResource {
  id: string
  kind: ResourceKind
  title: string
  createdAt: string
  contextLabel: string
  studentId: string | null
  courseId: string | null
  sessionId: string | null
  projectId: string | null
  body: string
}

export interface HistoryItem {
  id: string
  at: string
  title: string
}

const CTX_KEY = (tutorId: string) => `learnsyra_tutor_ai_ctx_${tutorId}`
const RES_KEY = (tutorId: string) => `learnsyra_tutor_ai_resources_${tutorId}`
const HIST_KEY = (tutorId: string) => `learnsyra_tutor_ai_history_${tutorId}`

export const EMPTY_SELECTION: CopilotSelection = {
  studentId: '',
  courseId: '',
  lessonTitle: '',
  projectId: '',
  sessionId: '',
  focus: '',
}

export function uid(prefix = 'tai') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function loadSelection(tutorId: string): CopilotSelection {
  try {
    const raw = sessionStorage.getItem(CTX_KEY(tutorId))
    return raw ? { ...EMPTY_SELECTION, ...JSON.parse(raw) } : EMPTY_SELECTION
  } catch {
    return EMPTY_SELECTION
  }
}

export function saveSelection(tutorId: string, sel: CopilotSelection) {
  sessionStorage.setItem(CTX_KEY(tutorId), JSON.stringify(sel))
}

export function loadResources(tutorId: string): TeachingResource[] {
  try {
    const raw = localStorage.getItem(RES_KEY(tutorId))
    return raw ? (JSON.parse(raw) as TeachingResource[]) : []
  } catch {
    return []
  }
}

export function saveResources(tutorId: string, rows: TeachingResource[]) {
  localStorage.setItem(RES_KEY(tutorId), JSON.stringify(rows.slice(0, 80)))
}

export function loadHistory(tutorId: string): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HIST_KEY(tutorId))
    return raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch {
    return []
  }
}

export function pushHistory(tutorId: string, title: string) {
  const next = [{ id: uid('h'), at: new Date().toISOString(), title }, ...loadHistory(tutorId)].slice(0, 40)
  localStorage.setItem(HIST_KEY(tutorId), JSON.stringify(next))
  return next
}

export function confidence(sel: CopilotSelection, student: TutorStudent | undefined): Confidence {
  if (!student && !sel.courseId && !sel.projectId && !sel.sessionId) return 'none'
  const hasSkills = Boolean(student?.skills.some(s => s.score != null))
  const hasCourse = Boolean(student?.courses[0] || sel.courseId)
  if (student && hasSkills && hasCourse) return 'based'
  if (student || sel.courseId || sel.sessionId || sel.projectId) return 'limited'
  return 'none'
}

export function confidenceLabel(level: Confidence) {
  if (level === 'based') return 'Based on student progress'
  if (level === 'limited') return 'Limited context'
  return 'Not enough data for a personalized recommendation'
}

export function topicOf(sel: CopilotSelection, student: TutorStudent | undefined, session: TutorSessionView | undefined, project: TutorProjectReview | undefined, course: StudioCourse | undefined) {
  return (
    sel.focus.trim() ||
    student?.currentFocus ||
    student?.focusSkills[0] ||
    session?.lessonTitle ||
    session?.topic ||
    project?.skills[0] ||
    course?.primarySkills[0] ||
    'the current lesson'
  )
}

function field(prompt: string, label: string) {
  const m = prompt.match(new RegExp(`${label}:\\s*([^\\n.]+)`, 'i'))
  return m?.[1]?.trim() || ''
}

export function parseIncomingPrompt(
  prompt: string,
  input: {
    students: TutorStudent[]
    sessions: TutorSessionView[]
    projects: TutorProjectReview[]
    courses: StudioCourse[]
  },
): { selection: Partial<CopilotSelection>; action: CopilotAction | null } {
  const student =
    input.students.find(s => prompt.toLowerCase().includes(s.name.toLowerCase())) ||
    input.students.find(s => field(prompt, 'Student') && s.name.toLowerCase().includes(field(prompt, 'Student').toLowerCase()))
  const courseTitle = field(prompt, 'Course')
  const course = input.courses.find(c => (courseTitle && c.title.toLowerCase() === courseTitle.toLowerCase()) || prompt.toLowerCase().includes(c.title.toLowerCase()))
  const project =
    input.projects.find(p => prompt.toLowerCase().includes(p.title.toLowerCase())) ||
    (student ? input.projects.find(p => p.studentId === student.id) : undefined)
  const session =
    input.sessions.find(s => student && s.studentId === student.id && prompt.toLowerCase().includes(s.topic.toLowerCase())) ||
    input.sessions.find(s => student && s.studentId === student.id)
  const lesson = field(prompt, 'Lesson')
  const topic = field(prompt, 'Topic') || field(prompt, 'Focus')
  let action: CopilotAction | null = null
  const q = prompt.toLowerCase()
  if (/project review|review submission/.test(q)) action = 'project'
  else if (/interview/.test(q)) action = 'interview'
  else if (/session|prepare/.test(q)) action = 'session'
  else if (/quiz/.test(q)) action = 'quiz'
  else if (/practice|exercise/.test(q)) action = 'practice'
  else if (/explain/.test(q)) action = 'explain'
  else if (/lesson/.test(q)) action = 'lesson'
  return {
    action,
    selection: {
      studentId: student?.id || '',
      courseId: course?.id || student?.courses[0]?.id || '',
      lessonTitle: lesson,
      projectId: project?.id || student?.projects[0]?.id || '',
      sessionId: session?.id || '',
      focus: topic || student?.currentFocus || student?.focusSkills[0] || '',
    },
  }
}

export function takeHandoffPrompt() {
  return takePendingAiPrompt()
}

export function teachingBrief(students: TutorStudent[], source: 'live' | 'demo') {
  const list = source === 'demo' ? students : students.filter(s => !s.demo)
  const attention = list.filter(s => s.status === 'attention' || s.nextSession?.upcoming)
  const pick = attention[0] || list.find(s => s.focusSkills.length) || list[0]
  const gap = pick?.skills.find(s => s.score != null && s.score < 50)
  return {
    count: attention.length,
    student: pick,
    gapName: gap?.name || pick?.focusSkills[0] || null,
    gapScore: gap?.score ?? null,
    action: pick?.recommendedAction || 'Continue with the listed next lesson.',
  }
}

export function insightForStudent(student: TutorStudent | undefined): { text: string; why: string; focus: string[]; enough: boolean } {
  if (!student) {
    return { text: 'Not enough learning data to make a recommendation.', why: 'Select a student with course or skill records.', focus: [], enough: false }
  }
  const strong = student.skills.filter(s => s.score != null && s.score >= 70)
  const weak = student.skills.filter(s => s.score != null && s.score < 50)
  if (!strong.length && !weak.length && !student.courses[0]) {
    return { text: 'Not enough learning data to make a recommendation.', why: 'Skill scores and course progress are unavailable for this student.', focus: [], enough: false }
  }
  const first = student.name.split(' ')[0]
  const text = student.insight || (weak[0]
    ? `${first} has listed strength in ${strong[0]?.name || 'core coursework'} but ${weak[0].name} remains a gap.`
    : `${first} is enrolled in ${student.courses[0]?.title || 'a course'}.`)
  const why = student.projects[0]
    ? `The current project (${student.projects[0].title}) ${weak[0] ? `may need ${weak[0].name}` : 'is the listed focus'}.`
    : weak[0]
      ? `${weak[0].name} is the largest listed skill gap.`
      : 'Use the listed course progress to choose the next teaching step.'
  return { text, why, focus: (weak.length ? weak : student.focusSkills).slice(0, 3).map(s => typeof s === 'string' ? s : s.name), enough: true }
}

export function skillGapRows(student: TutorStudent | undefined, course: StudioCourse | undefined, project: TutorProjectReview | undefined) {
  const names = Array.from(new Set([
    ...(course?.primarySkills ?? []),
    ...(project?.skills ?? []),
    ...(student?.skills.map(s => s.name) ?? []),
  ]))
  return names.map(name => {
    const hit = student?.skills.find(s => s.name.toLowerCase() === name.toLowerCase())
    const score = hit?.score ?? null
    let mark: 'have' | 'gap' | 'unknown' = 'unknown'
    if (score != null && score >= 70) mark = 'have'
    else if (score != null) mark = 'gap'
    return { name, score, mark }
  })
}

export function courseInsights(course: StudioCourse | undefined) {
  if (!course) return { lines: [] as string[], enough: false }
  const lines: string[] = []
  course.modules.forEach((m, i) => {
    const kinds = m.lessons.map(l => l.kind)
    if (!kinds.some(k => k === 'code' || k === 'assignment')) lines.push(`Module ${i + 1} (${m.title}) has no hands-on practice lesson.`)
    if (!kinds.some(k => k === 'quiz') && !course.quizzes.length) lines.push(`Module ${i + 1} (${m.title}) has no quiz lesson.`)
  })
  if (!course.practices.length) lines.push('This course has no saved practice items in Course Studio.')
  if (!course.quizzes.length) lines.push('This course has no saved quizzes in Course Studio.')
  if (!course.projectIds.length && !course.projectTitle) lines.push('No project is linked in Course Studio.')
  const levels = course.modules.map((_, i) => i)
  if (course.level === 'Advanced' && course.modules[0]?.lessons[0]?.kind === 'project') {
    lines.push('Difficulty may jump to project work too early — confirm a concept lesson exists first.')
  }
  void levels
  return { lines: lines.slice(0, 6), enough: true }
}

export function buildTeachingPlan(topic: string, studentName: string | null, minutes = 45): TeachingPlan {
  return {
    title: `${minutes}-Minute Teaching Plan`,
    warmup: `Check what ${studentName || 'the student'} already knows about ${topic}. One recap question, no new syntax yet.`,
    concept: `Explain ${topic} with one diagram or typed example. Stay at the listed difficulty. Do not introduce unrelated APIs.`,
    guided: `Pair on a short example that uses ${topic} in the current course or project context.`,
    independent: `Student tries a 2-file change using ${topic}. Tutor watches and notes one misconception.`,
    review: `Restate the objective, assign one follow-up, and write the next step. Do not auto-grade.`,
  }
}

export function buildLessonPlan(topic: string, studentName: string | null): LessonPlanDoc {
  return {
    title: topic,
    objective: `Student can use ${topic} in a small, realistic example.`,
    prerequisites: 'Listed course lessons already completed. Data unavailable items are skipped.',
    concepts: `${topic}: definition, when to use it, and one contrast with a nearby concept.`,
    examples: `One correct ${topic} snippet and one nearby incorrect version.`,
    steps: `1. Activate prior knowledge\n2. Teach the concept\n3. Live example\n4. Student attempt\n5. Check for understanding`,
    practice: `Write a 15-minute exercise for ${topic}${studentName ? ` with ${studentName}` : ''}.`,
    assessment: 'Two concept-check questions. Tutor scores — AI does not grade.',
    homework: `Apply ${topic} to the current project or next lesson. Do not invent a new project.`,
  }
}

export function buildExplain(topic: string, difficulty: Difficulty): ExplainDoc {
  const simple = difficulty === 'Beginner'
    ? `${topic} is a way to describe a rule the code should follow so the next step is predictable.`
    : `${topic} is the contract you give the rest of the program so callers know what they can rely on.`
  return {
    topic,
    difficulty,
    simple,
    example: `Show ${topic} in 8–12 lines, then point at the one line that matters.`,
    mistake: `A common mistake is treating ${topic} as optional documentation instead of a constraint the compiler or runtime will enforce.`,
    tryThis: `Change one input and predict the result before running. If files cannot be executed here, walk the trace on paper.`,
    tutorTip: `Ask “what would break if this were missing?” before showing the solution. This is a teaching resource, not a student chat.`,
  }
}

export function buildPractice(topic: string, difficulty: Difficulty, duration: number, skills: string, context: string): PracticeDoc {
  return {
    topic,
    difficulty,
    duration,
    skills,
    context,
    problem: `Build a small ${topic} exercise that matches the student's current course or project context${context ? ` (${context})` : ''}.`,
    requirements: `1. Use ${topic}\n2. Handle one empty or error path\n3. Keep the solution under ${Math.max(20, duration)} minutes`,
    starter: 'Starter files are not generated as a fake student submission. Use the existing project workspace or a blank file.',
    hints: `Hint 1: name the data first.\nHint 2: handle the failure path before the happy path.`,
    expected: `A working ${difficulty.toLowerCase()} solution that demonstrates ${topic}, with a one-paragraph README note.`,
    extension: `Add a second case (loading or retry) only if the core path is solid.`,
  }
}

const BANK: Record<string, { q: string; options: string[]; answers: number[]; explain: string; kind: QuizItem['kind'] }[]> = {
  default: [
    { q: 'What is the first thing to clarify before writing code for this topic?', options: ['The visual theme', 'The data contract and failure path', 'The folder names', 'The deployment target'], answers: [1], explain: 'Students stall when the shape of the data is unclear.', kind: 'mcq' },
    { q: 'A missing dependency in a side-effect hook can cause stale values.', options: ['True', 'False'], answers: [0], explain: 'Effects should list values they read from render.', kind: 'tf' },
    { q: 'Which are useful concept checks? (select all that apply)', options: ['Can they explain it in one sentence?', 'Can they name a failure case?', 'Did they memorize a blog title?', 'Can they change one input and predict output?'], answers: [0, 1, 3], explain: 'Understanding shows up in explanation and prediction, not slogans.', kind: 'multi' },
    { q: 'When should the tutor introduce a harder variant?', options: ['Immediately', 'After the student completes the core path', 'Only on the exam', 'Never'], answers: [1], explain: 'Extension work belongs after the listed objective is met.', kind: 'mcq' },
    { q: 'AI should assign the final grade for this quiz.', options: ['True', 'False'], answers: [1], explain: 'The tutor reviews and confirms every assessment.', kind: 'tf' },
  ],
}

export function buildQuiz(topic: string, count: 5 | 10 | 15): QuizDoc {
  const seed = BANK.default
  const questions: QuizItem[] = Array.from({ length: count }, (_, i) => {
    const row = seed[i % seed.length]
    return {
      id: uid('q'),
      kind: row.kind,
      question: i < seed.length ? `${topic}: ${row.q}` : `${topic} (variant ${i + 1}): ${row.q}`,
      options: [...row.options],
      answers: [...row.answers],
      explanation: row.explain,
      difficulty: i % 3 === 0 ? 'Beginner' : i % 3 === 1 ? 'Intermediate' : 'Advanced',
    }
  })
  return { title: `${topic} check`, count, questions }
}

export function buildQuestions(topic: string): TeachingQuestion[] {
  return [
    { id: uid('tq'), kind: 'concept', difficulty: 'Easy', text: `What is ${topic} responsible for in this lesson?` },
    { id: uid('tq'), kind: 'concept', difficulty: 'Medium', text: `Why would you use ${topic} instead of the nearby alternative here?` },
    { id: uid('tq'), kind: 'debug', difficulty: 'Medium', text: `If ${topic} fails only on empty input, where would you look first?` },
    { id: uid('tq'), kind: 'critical', difficulty: 'Hard', text: `What trade-off does ${topic} introduce in a larger codebase?` },
    { id: uid('tq'), kind: 'interview', difficulty: 'Medium', text: `Explain ${topic} as if an interviewer asked you to walk through a real example.` },
    { id: uid('tq'), kind: 'project', difficulty: 'Hard', text: `Where should ${topic} land in the current project milestone, and what is out of scope?` },
  ]
}

export function buildSessionPrep(input: {
  duration: number | null
  topic: string
  gap: string | null
  prevTopic: string | null
}): SessionPrepDoc {
  const total = input.duration && input.duration > 0 ? input.duration : 60
  const review = Math.max(8, Math.round(total * 0.15))
  const teach = Math.max(12, Math.round(total * 0.3))
  const guided = Math.max(12, Math.round(total * 0.3))
  const practice = Math.max(8, Math.round(total * 0.15))
  const close = Math.max(5, total - review - teach - guided - practice)
  const focus = input.gap || input.topic
  return {
    agenda: [
      { minutes: review, label: input.prevTopic ? `Review previous work (${input.prevTopic})` : 'Review previous task' },
      { minutes: teach, label: `${focus} concepts` },
      { minutes: guided, label: 'Guided project or lesson work' },
      { minutes: practice, label: 'Independent practice' },
      { minutes: close, label: 'Next steps' },
    ],
    questions: [
      `What part of ${focus} felt unclear after last time?`,
      `Where would ${focus} show up in the current project?`,
      `What would you try if the happy path failed?`,
      `How would you explain ${focus} in one sentence?`,
    ],
    practice: `One ${Math.min(20, practice + 5)}-minute exercise on ${focus}. Tutor does not auto-assign it.`,
    followUp: input.prevTopic
      ? `Previous topic on file: ${input.prevTopic}. Move forward only if that work is actually complete.`
      : 'No previous session data available.',
  }
}

export function previousSessionNote(prev: TutorSessionView | null, extras: SessionExtras | null) {
  if (!prev) return { available: false as const, text: 'No previous session data available.' }
  const covered = extras?.covered?.trim()
  const items = extras?.actionItems?.filter(a => a.label.trim()) ?? []
  const done = items.filter(a => a.done).length
  return {
    available: true as const,
    topic: prev.topic,
    covered: covered || 'What was covered was not recorded.',
    actions: items.length ? `${done}/${items.length} listed action items marked done.` : 'No action items on file.',
    followUp: extras?.nextTopic?.trim() || extras?.nextStep || null,
  }
}

export function projectCoachCopy(row: TutorProjectReview | undefined, student: TutorStudent | undefined) {
  if (!row) {
    return { enough: false, rec: 'Not enough project data to make a recommendation.', milestone: null as string | null, progress: null as number | null }
  }
  const gap = student?.focusSkills[0]
  const rec = gap
    ? `Focus on ${gap} before moving to the next milestone. Do not change project status from here.`
    : 'Walk the current milestone with the student. Do not change project status from here.'
  return { enough: true, rec, milestone: row.catalog?.milestones.find(m => m.title)?.title ?? null, progress: row.progress }
}

export function resourceBody(kind: ResourceKind, payload: unknown) {
  return JSON.stringify({ kind, payload })
}

export function parseResource<T>(row: TeachingResource): T | null {
  try {
    return (JSON.parse(row.body) as { payload: T }).payload
  } catch {
    return null
  }
}

export function contextLabel(sel: CopilotSelection, student?: TutorStudent, course?: StudioCourse, session?: TutorSessionView, project?: TutorProjectReview) {
  return [student?.name, course?.title, session?.topic, project?.title, sel.focus].filter(Boolean).join(' · ') || 'No context'
}

export function historyGroupLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const start = (n: Date) => new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
  if (start(d) === start(now)) return 'Today'
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (start(d) === start(y)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function skillDisplay(score: number | null) {
  return score == null ? 'Data unavailable' : `${score}%`
}
