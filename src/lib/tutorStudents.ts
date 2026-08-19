import type { BookingRow, CourseRow, ProfileLite, ProjectRow, StudentProjectRow } from './api'
import { buildCatalog, type CatalogCourse } from './courseCatalog'
import { getCourseDetailPack } from './courseDetail'
import { liveClassPath, projectPath, sessionPath } from './paths'
import type { TutorBooking } from './tutorMarketplace'

export type StudentStatus = 'active' | 'attention' | 'completed' | 'inactive'
export type SortKey = 'recommended' | 'recent' | 'attention' | 'high' | 'low' | 'newest' | 'lastSession'
export type ProgressBand = '0-25' | '26-50' | '51-75' | '76-100'
export type ActivityFilter = 'today' | 'week' | 'month' | 'none'
export type SessionFilter = 'upcoming' | 'completed' | 'none'

export interface TutorNote {
  id: string
  studentId: string
  tutorId: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface StudentCourseLink {
  id: string
  title: string
  progress: number
  enrolledAt: string
  lastLessonId: string | null
}

export interface StudentSkill {
  name: string
  score: number | null
  source: 'course' | 'project'
}

export interface StudentProjectLink {
  id: string
  title: string
  status: string
  href: string
  skills: string[]
  score?: number
  progress?: number
  needsReview: boolean
  stallNote: string | null
}

export interface StudentSessionLink {
  id: string
  label: string
  when: string
  duration: number | null
  status: string
  href: string
  joinHref: string | null
  upcoming: boolean
  notes: string | null
}

export interface LearningJourney {
  courseId: string
  title: string
  progress: number
  completedLessons: number | null
  totalLessons: number | null
  currentLesson: string | null
  nextLesson: string | null
}

export interface TutorStudent {
  id: string
  name: string
  headline: string | null
  avatarUrl: string | null
  demo: boolean
  status: StudentStatus
  courses: StudentCourseLink[]
  overallProgress: number
  currentFocus: string | null
  skills: StudentSkill[]
  focusSkills: string[]
  nextSession: StudentSessionLink | null
  lastActivityAt: string | null
  lastSessionAt: string | null
  enrolledAt: string
  attentionReasons: string[]
  recommendedAction: string
  insight: string
  projects: StudentProjectLink[]
  sessions: StudentSessionLink[]
  activity: { at: string; text: string }[]
  achievements: { id: string; label: string; earned: boolean; hint: string }[]
  career: {
    target: string | null
    skills: number | null
    projects: number | null
    resume: number | null
    interview: number | null
    overall: number | null
    support: string | null
  }
  relationship: 'Active Student' | 'Completed' | 'Inactive'
}

const NOTES_KEY = (tutorId: string) => `learnsyra_tutor_notes_${tutorId}`

export function loadTutorNotes(tutorId: string): TutorNote[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY(tutorId))
    return raw ? (JSON.parse(raw) as TutorNote[]) : []
  } catch {
    return []
  }
}

export function saveTutorNotes(tutorId: string, notes: TutorNote[]) {
  localStorage.setItem(NOTES_KEY(tutorId), JSON.stringify(notes))
}

export function notesForStudent(tutorId: string, studentId: string) {
  return loadTutorNotes(tutorId)
    .filter(n => n.studentId === studentId)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
}

export function upsertNote(tutorId: string, studentId: string, body: string, id?: string) {
  const all = loadTutorNotes(tutorId)
  const now = new Date().toISOString()
  if (id) {
    const next = all.map(n => (n.id === id && n.tutorId === tutorId ? { ...n, body, updatedAt: now } : n))
    saveTutorNotes(tutorId, next)
    return
  }
  saveTutorNotes(tutorId, [
    { id: `note-${Date.now()}`, studentId, tutorId, body, createdAt: now, updatedAt: now },
    ...all,
  ])
}

export function deleteNote(tutorId: string, noteId: string) {
  saveTutorNotes(tutorId, loadTutorNotes(tutorId).filter(n => n.id !== noteId))
}

export function statusLabel(status: StudentStatus) {
  if (status === 'attention') return 'Needs Attention'
  if (status === 'completed') return 'Completed'
  if (status === 'inactive') return 'Inactive'
  return 'Active'
}

export function statusDot(status: StudentStatus) {
  if (status === 'attention') return '🟡'
  if (status === 'completed') return '🔵'
  if (status === 'inactive') return '⚪'
  return '🟢'
}

function daysAgo(iso: string | null) {
  if (!iso) return 999
  return Math.max(0, Math.round((Date.now() - +new Date(iso)) / 86400000))
}

function skillsFromTitle(title: string) {
  const map: Array<[RegExp, string]> = [
    [/react/i, 'React'],
    [/typescript|type script/i, 'TypeScript'],
    [/javascript|js\b/i, 'JavaScript'],
    [/node/i, 'Node.js'],
    [/rest|api/i, 'REST APIs'],
    [/python/i, 'Python'],
    [/sql/i, 'SQL'],
    [/interview/i, 'Interview Preparation'],
  ]
  return map.filter(([re]) => re.test(title)).map(([, name]) => name)
}

function lessonJourney(course: CatalogCourse | undefined, progress: number): Pick<LearningJourney, 'completedLessons' | 'totalLessons' | 'currentLesson' | 'nextLesson'> {
  if (!course) return { completedLessons: null, totalLessons: null, currentLesson: null, nextLesson: null }
  const pack = getCourseDetailPack(course)
  const lessons = pack.sections.flatMap(s => s.lessons)
  const total = pack.lessonCount || lessons.length
  if (!total) return { completedLessons: null, totalLessons: null, currentLesson: null, nextLesson: null }
  const completed = Math.min(total, Math.round((progress / 100) * total))
  const current = lessons[Math.min(lessons.length - 1, completed)]?.title ?? null
  const next = lessons[Math.min(lessons.length - 1, completed + 1)]?.title ?? null
  return { completedLessons: completed, totalLessons: total, currentLesson: current, nextLesson: next }
}

export function learningJourney(student: TutorStudent, catalog: CatalogCourse[]): LearningJourney | null {
  const course = student.courses[0]
  if (!course) return null
  const match = catalog.find(c => c.id === course.id || c.title === course.title)
  return { courseId: course.id, title: course.title, progress: course.progress, ...lessonJourney(match, course.progress) }
}

function classify(input: {
  progress: number
  enrolledAt: string
  lastActivityAt: string | null
  hasUpcoming: boolean
  needsReview: boolean
}): { status: StudentStatus; reasons: string[] } {
  const reasons: string[] = []
  const idle = daysAgo(input.lastActivityAt)
  if (input.progress >= 100) return { status: 'completed', reasons: [] }
  if (input.needsReview) reasons.push('Project milestone awaiting review')
  if (input.progress < 50 && daysAgo(input.enrolledAt) >= 14) reasons.push('Course progress stalled')
  if (idle >= 14) reasons.push('No recent activity')
  if (input.hasUpcoming && (input.progress < 60 || input.needsReview)) reasons.push('Upcoming session requires preparation')
  if (reasons.length) return { status: 'attention', reasons }
  if (input.progress === 0 && idle >= 21) return { status: 'inactive', reasons: [] }
  return { status: 'active', reasons: [] }
}

function insightFor(student: Pick<TutorStudent, 'name' | 'skills' | 'courses' | 'status' | 'attentionReasons' | 'demo'>) {
  const first = student.name.split(' ')[0] || 'This student'
  const strong = student.skills.filter(s => s.score != null && s.score >= 70).map(s => s.name)
  const weak = student.skills.filter(s => s.score != null && s.score < 50).map(s => s.name)
  const course = student.courses[0]?.title
  if (student.status === 'attention' && student.attentionReasons[0]) {
    return `${first} may need support this week: ${student.attentionReasons[0].toLowerCase()}.`
  }
  if (strong.length && weak.length && course) {
    return `${first} is progressing in ${strong.slice(0, 2).join(' and ')}. ${weak[0]} is the largest listed gap before the next ${course} milestone.`
  }
  if (course) return `${first} is enrolled in ${course} at ${student.courses[0].progress}% course progress.`
  return `${first} is on your roster. Add session notes as you learn more about their goals.`
}

function actionFor(status: StudentStatus, reasons: string[], weak: string[]) {
  if (reasons.some(r => /project/i.test(r))) return 'Review the submitted project'
  if (reasons.some(r => /session/i.test(r))) return 'Prepare the upcoming session'
  if (weak[0]) return `Review ${weak[0]} fundamentals`
  if (status === 'inactive') return 'Check in on learning goals'
  if (status === 'completed') return 'Suggest a next project or interview session'
  return 'Continue the current learning path'
}

export function demoRoster(): TutorStudent[] {
  const today = new Date()
  const iso = (days: number, hour = 18, minute = 30) => {
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }
  const session = (id: string, label: string, days: number, upcoming: boolean, status: string, duration = 45): StudentSessionLink => ({
    id,
    label,
    when: iso(days),
    duration,
    status,
    href: sessionPath(id),
    joinHref: upcoming ? liveClassPath(id) : null,
    upcoming,
    notes: null,
  })
  const rows: Array<Partial<TutorStudent> & { id: string; name: string; headline: string; progress: number; course: string; skills: StudentSkill[]; reasons?: string[]; enrolledDays: number; activityDays: number }> = [
    {
      id: 'demo-alex',
      name: 'Alex Rivera',
      headline: 'Frontend Developer',
      progress: 67,
      course: 'Full Stack Web Development',
      skills: [
        { name: 'React', score: 88, source: 'course' },
        { name: 'JavaScript', score: 84, source: 'course' },
        { name: 'REST APIs', score: 78, source: 'course' },
        { name: 'Node.js', score: 72, source: 'course' },
        { name: 'TypeScript', score: 35, source: 'course' },
        { name: 'Testing', score: 22, source: 'course' },
      ],
      reasons: ['Course progress stalled'],
      enrolledDays: 28,
      activityDays: 16,
    },
    {
      id: 'demo-priya',
      name: 'Priya Shah',
      headline: 'Full Stack learner',
      progress: 82,
      course: 'Full Stack Web Development',
      skills: [
        { name: 'React', score: 90, source: 'course' },
        { name: 'JavaScript', score: 86, source: 'course' },
        { name: 'TypeScript', score: 70, source: 'course' },
      ],
      enrolledDays: 20,
      activityDays: 0,
    },
    {
      id: 'demo-jordan',
      name: 'Jordan Lee',
      headline: 'Career switcher',
      progress: 100,
      course: 'Interview Preparation',
      skills: [
        { name: 'Interview Preparation', score: 92, source: 'course' },
        { name: 'Communication', score: 80, source: 'course' },
      ],
      enrolledDays: 60,
      activityDays: 3,
    },
    {
      id: 'demo-sam',
      name: 'Sam Okonkwo',
      headline: 'Python beginner',
      progress: 8,
      course: 'Python Fundamentals',
      skills: [{ name: 'Python', score: 12, source: 'course' }],
      enrolledDays: 40,
      activityDays: 32,
    },
    {
      id: 'demo-meera',
      name: 'Meera Kapoor',
      headline: 'Project-focused learner',
      progress: 54,
      course: 'Full Stack Web Development',
      skills: [
        { name: 'React', score: 74, source: 'project' },
        { name: 'REST APIs', score: 40, source: 'project' },
      ],
      reasons: ['Project milestone awaiting review'],
      enrolledDays: 18,
      activityDays: 2,
    },
    {
      id: 'demo-dev',
      name: 'Dev Patel',
      headline: 'Backend track',
      progress: 41,
      course: 'Node.js APIs',
      skills: [
        { name: 'Node.js', score: 55, source: 'course' },
        { name: 'REST APIs', score: 48, source: 'course' },
        { name: 'Testing', score: 20, source: 'course' },
      ],
      reasons: ['Upcoming session requires preparation'],
      enrolledDays: 12,
      activityDays: 1,
    },
  ]

  return rows.map(row => {
    const enrolledAt = iso(-row.enrolledDays, 10, 0)
    const lastActivityAt = iso(-row.activityDays, 16, 0)
    const upcoming = row.id === 'demo-alex' || row.id === 'demo-dev'
    const needsReview = row.id === 'demo-meera'
    const cls = classify({
      progress: row.progress,
      enrolledAt,
      lastActivityAt,
      hasUpcoming: upcoming,
      needsReview,
    })
    const status = row.progress >= 100 ? 'completed' : row.id === 'demo-sam' ? 'inactive' : cls.status
    const reasons = row.reasons ?? cls.reasons
    const nextSession = upcoming
      ? session(`${row.id}-next`, row.id === 'demo-alex' ? 'React Architecture' : 'API review', 0, true, 'Confirmed')
      : null
    const projects: StudentProjectLink[] =
      row.id === 'demo-alex' || row.id === 'demo-meera' || row.id === 'demo-priya'
        ? [
            {
              id: 'catalog-react-expense',
              title: 'React Expense Tracker',
              status: row.id === 'demo-priya' ? 'completed' : 'in_progress',
              href: projectPath('catalog-react-expense'),
              skills: ['React', 'REST API', 'JavaScript'],
              score: row.id === 'demo-priya' ? 86 : undefined,
              progress: row.id === 'demo-priya' ? 100 : row.id === 'demo-meera' ? 72 : 72,
              needsReview: needsReview,
              stallNote: needsReview ? 'Student has not completed the API integration milestone.' : null,
            },
          ]
        : []
    const student: TutorStudent = {
      id: row.id,
      name: row.name,
      headline: row.headline,
      avatarUrl: null,
      demo: true,
      status,
      courses: [{ id: `demo-course-${row.id}`, title: row.course, progress: row.progress, enrolledAt, lastLessonId: null }],
      overallProgress: row.progress,
      currentFocus: row.skills[0]?.name ?? row.course,
      skills: row.skills,
      focusSkills: row.skills.filter(s => s.score != null && s.score < 50).map(s => s.name),
      nextSession,
      lastActivityAt,
      lastSessionAt: iso(-7, 18, 0),
      enrolledAt,
      attentionReasons: reasons,
      recommendedAction: '',
      insight: '',
      projects,
      sessions: [
        ...(nextSession ? [nextSession] : []),
        session(`${row.id}-h1`, 'React Hooks', -10, false, 'Completed'),
        session(`${row.id}-h2`, 'REST API Architecture', -18, false, 'Completed', 60),
      ],
      activity: [
        { at: lastActivityAt, text: `Course progress at ${row.progress}% in ${row.course}` },
        ...(needsReview ? [{ at: iso(-2, 15, 0), text: 'Submitted Expense Tracker milestone' }] : []),
      ],
      achievements: [
        { id: 'react', label: 'React Builder', earned: row.skills.some(s => s.name === 'React' && (s.score ?? 0) >= 70), hint: 'Shown when React course/project progress is strong' },
        { id: 'project', label: 'Project Finisher', earned: projects.some(p => p.status === 'completed'), hint: 'Complete a project' },
        { id: 'streak', label: 'Learning Streak', earned: false, hint: 'Streak data is not shared with tutors yet' },
      ],
      career: {
        target: row.headline,
        skills: row.progress,
        projects: projects.length ? (projects[0].status === 'completed' ? 78 : 55) : null,
        resume: null,
        interview: row.course.includes('Interview') ? 72 : null,
        overall: null,
        support: row.skills.some(s => s.name === 'TypeScript' && (s.score ?? 100) < 50)
          ? 'May benefit from a TypeScript-focused session before the next project.'
          : null,
      },
      relationship: status === 'completed' ? 'Completed' : status === 'inactive' ? 'Inactive' : 'Active Student',
    }
    student.career.overall = average([student.career.skills, student.career.projects, student.career.interview])
    student.recommendedAction = actionFor(status, reasons, student.focusSkills)
    student.insight = insightFor(student)
    return student
  })
}

function average(ns: Array<number | null>) {
  const v = ns.filter((n): n is number => n != null)
  if (!v.length) return null
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length)
}

export interface RosterInput {
  enrollments: { progress: number; enrolled_at: string; last_lesson_id?: string | null; student: ProfileLite | null; course: { id: string; title: string } | null }[]
  bookings: BookingRow[]
  reviews: (StudentProjectRow & { project: ProjectRow | null; student: ProfileLite | null })[]
  localBookings: TutorBooking[]
  apiCourses: CourseRow[]
}

export function buildTutorRoster(input: RosterInput): { students: TutorStudent[]; source: 'live' | 'demo' } {
  const catalog = buildCatalog(input.apiCourses)
  const byId = new Map<string, TutorStudent>()

  const ensure = (id: string, profile: ProfileLite | null, fallbackName: string) => {
    let row = byId.get(id)
    if (!row) {
      row = {
        id,
        name: profile?.full_name || fallbackName,
        headline: profile?.headline ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        demo: false,
        status: 'active',
        courses: [],
        overallProgress: 0,
        currentFocus: null,
        skills: [],
        focusSkills: [],
        nextSession: null,
        lastActivityAt: null,
        lastSessionAt: null,
        enrolledAt: new Date().toISOString(),
        attentionReasons: [],
        recommendedAction: '',
        insight: '',
        projects: [],
        sessions: [],
        activity: [],
        achievements: [],
        career: { target: profile?.headline ?? null, skills: null, projects: null, resume: null, interview: null, overall: null, support: null },
        relationship: 'Active Student',
      }
      byId.set(id, row)
    }
    return row
  }

  for (const en of input.enrollments) {
    const sid = en.student?.id
    if (!sid) continue
    const row = ensure(sid, en.student, 'Student')
    if (en.course) {
      row.courses.push({
        id: en.course.id,
        title: en.course.title,
        progress: en.progress,
        enrolledAt: en.enrolled_at,
        lastLessonId: en.last_lesson_id ?? null,
      })
    }
    row.enrolledAt = en.enrolled_at < row.enrolledAt ? en.enrolled_at : row.enrolledAt
    bumpActivity(row, en.enrolled_at, `Enrolled in ${en.course?.title ?? 'a course'}`)
    if (en.progress > 0) bumpActivity(row, en.enrolled_at, `Course progress at ${en.progress}%`)
    const names = skillsFromTitle(`${en.course?.title ?? ''} ${en.course?.id ?? ''}`)
    for (const name of names) addSkill(row, name, en.progress, 'course')
  }

  for (const b of input.bookings) {
    const sid = b.student_id
    if (!sid) continue
    const row = ensure(sid, b.student ?? null, 'Student')
    const upcoming = b.status === 'pending' || b.status === 'confirmed'
    const sess: StudentSessionLink = {
      id: b.id,
      label: b.message?.split('\n')[0] || b.listing?.expertise || 'Tutor session',
      when: b.created_at,
      duration: null,
      status: b.status,
      href: '/tutor/sessions',
      joinHref: upcoming ? liveClassPath(b.id) : null,
      upcoming,
      notes: b.message,
    }
    row.sessions.push(sess)
    if (upcoming && !row.nextSession) row.nextSession = sess
    if (!upcoming) row.lastSessionAt = b.created_at
    bumpActivity(row, b.created_at, upcoming ? 'Session booked' : `Session ${b.status}`)
  }

  for (const b of input.localBookings) {
    const sid = b.studentId
    if (!sid) continue
    const row = byId.get(sid)
    if (!row) continue
    const when = `${b.date}T12:00:00`
    const upcoming = b.status === 'pending' || b.status === 'confirmed'
    const sess: StudentSessionLink = {
      id: b.id,
      label: b.sessionLabel,
      when,
      duration: b.duration,
      status: b.status,
      href: sessionPath(b.id),
      joinHref: upcoming ? liveClassPath(b.id) : null,
      upcoming,
      notes: b.goal || b.aiBrief,
    }
    row.sessions.push(sess)
    if (upcoming) row.nextSession = pickSooner(row.nextSession, sess)
    else row.lastSessionAt = when
    bumpActivity(row, when, `${b.sessionLabel} · ${b.status}`)
  }

  for (const r of input.reviews) {
    const sid = r.student_id
    if (!sid) continue
    const row = ensure(sid, r.student ?? null, 'Student')
    const needsReview = r.status === 'submitted'
    row.projects.push({
      id: r.project_id,
      title: r.project?.title ?? 'Project',
      status: r.status,
      href: '/tutor/projects',
      skills: r.project?.skills ?? [],
      needsReview,
      stallNote: needsReview ? 'Submitted work is waiting for tutor review.' : null,
      progress: r.status === 'completed' ? 100 : 70,
    })
    for (const sk of r.project?.skills ?? []) addSkill(row, sk, r.status === 'completed' ? 80 : 45, 'project')
    bumpActivity(row, r.submitted_at || r.created_at, needsReview ? `Submitted ${r.project?.title ?? 'a project'}` : `Completed ${r.project?.title ?? 'a project'}`)
  }

  const students = [...byId.values()].map(row => finalizeStudent(row, catalog))
  if (!students.length) return { students: demoRoster(), source: 'demo' }
  return { students, source: 'live' }
}

function finalizeStudent(row: TutorStudent, catalog: CatalogCourse[]): TutorStudent {
  row.courses.sort((a, b) => b.progress - a.progress)
  row.overallProgress = row.courses.length
    ? Math.round(row.courses.reduce((s, c) => s + c.progress, 0) / row.courses.length)
    : 0
  const journey = row.courses[0] ? lessonJourney(catalog.find(c => c.id === row.courses[0].id || c.title === row.courses[0].title), row.courses[0].progress) : null
  row.currentFocus = journey?.currentLesson || row.skills[0]?.name || row.courses[0]?.title || null
  row.focusSkills = row.skills.filter(s => s.score != null && s.score < 50).map(s => s.name)
  const needsReview = row.projects.some(p => p.needsReview)
  const cls = classify({
    progress: row.overallProgress,
    enrolledAt: row.enrolledAt,
    lastActivityAt: row.lastActivityAt,
    hasUpcoming: Boolean(row.nextSession?.upcoming),
    needsReview,
  })
  row.status = cls.status
  row.attentionReasons = cls.reasons
  if (row.focusSkills.length && !row.attentionReasons.some(r => /skill/i.test(r))) {
    // skill gaps are informational; only add attention if progress is also lagging
    if (row.overallProgress < 70) row.attentionReasons.push('Listed skills still have low course progress')
  }
  if (row.attentionReasons.length && row.status === 'active') row.status = 'attention'
  row.recommendedAction = actionFor(row.status, row.attentionReasons, row.focusSkills)
  row.insight = insightFor(row)
  row.relationship = row.status === 'completed' ? 'Completed' : row.status === 'inactive' ? 'Inactive' : 'Active Student'
  row.achievements = [
    { id: 'react', label: 'React Builder', earned: row.skills.some(s => s.name === 'React' && (s.score ?? 0) >= 70), hint: 'Based on React-related course or project progress' },
    { id: 'project', label: 'Project Finisher', earned: row.projects.some(p => p.status === 'completed'), hint: 'Complete a reviewed project' },
    { id: 'streak', label: 'Learning Streak', earned: false, hint: 'Streak data is not available to tutors' },
  ]
  const interviewSessions = row.sessions.filter(s => /interview/i.test(s.label)).length
  row.career = {
    target: row.headline,
    skills: row.courses.length ? row.overallProgress : null,
    projects: row.projects.length ? Math.round((row.projects.filter(p => p.status === 'completed').length / row.projects.length) * 100) : null,
    resume: null,
    interview: interviewSessions ? Math.min(100, 40 + interviewSessions * 15) : null,
    overall: null,
    support: row.focusSkills[0]
      ? `May benefit from focused practice on ${row.focusSkills[0]} before applying.`
      : interviewSessions
        ? 'Student may benefit from one more technical interview before applying.'
        : null,
  }
  row.career.overall = average([row.career.skills, row.career.projects, row.career.interview])
  row.activity.sort((a, b) => +new Date(b.at) - +new Date(a.at))
  row.sessions.sort((a, b) => +new Date(b.when) - +new Date(a.when))
  return row
}

function addSkill(row: TutorStudent, name: string, score: number, source: StudentSkill['source']) {
  const existing = row.skills.find(s => s.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    if (existing.score == null || score > existing.score) existing.score = score
    return
  }
  row.skills.push({ name, score, source })
}

function bumpActivity(row: TutorStudent, at: string | null, text: string) {
  if (!at) return
  row.activity.push({ at, text })
  if (!row.lastActivityAt || at > row.lastActivityAt) row.lastActivityAt = at
}

function pickSooner(a: StudentSessionLink | null, b: StudentSessionLink) {
  if (!a) return b
  return +new Date(b.when) < +new Date(a.when) ? b : a
}

export function rosterStats(students: TutorStudent[]) {
  return {
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    attention: students.filter(s => s.status === 'attention').length,
    completed: students.filter(s => s.status === 'completed').length,
    inactive: students.filter(s => s.status === 'inactive').length,
    stalled: students.filter(s => s.attentionReasons.some(r => /stalled/i.test(r))).length,
    skillGaps: students.filter(s => s.focusSkills.length > 0).length,
    nextProject: students.filter(s => s.status === 'active' && s.overallProgress >= 70).length,
  }
}

export function aiSummary(students: TutorStudent[], source: 'live' | 'demo') {
  const stats = rosterStats(students)
  const prefix = source === 'demo' ? 'Demo roster: ' : ''
  return {
    headline: `${prefix}${stats.attention} student${stats.attention === 1 ? '' : 's'} may need attention this week.`,
    stalled: stats.stalled,
    skillGaps: stats.skillGaps,
    nextProject: stats.nextProject,
  }
}

export function courseAverageInsight(students: TutorStudent[]) {
  const live = students.filter(s => !s.demo)
  const byCourse = new Map<string, number[]>()
  for (const s of live) {
    for (const c of s.courses) {
      const arr = byCourse.get(c.title) ?? []
      arr.push(c.progress)
      byCourse.set(c.title, arr)
    }
  }
  const hit = [...byCourse.entries()].find(([, arr]) => arr.length >= 3)
  if (!hit) return null
  const avg = Math.round(hit[1].reduce((a, b) => a + b, 0) / hit[1].length)
  return `Average progress in ${hit[0]} among your students is ${avg}%.`
}

export function matchesQuery(student: TutorStudent, q: string) {
  if (!q.trim()) return true
  const blob = [
    student.name,
    student.headline,
    student.status,
    statusLabel(student.status),
    ...student.courses.map(c => c.title),
    ...student.skills.map(s => s.name),
    ...student.projects.map(p => p.title),
  ]
    .join(' ')
    .toLowerCase()
  return q.toLowerCase().split(/\s+/).every(w => blob.includes(w))
}

export function inProgressBand(progress: number, band: ProgressBand | 'all') {
  if (band === 'all') return true
  if (band === '0-25') return progress <= 25
  if (band === '26-50') return progress >= 26 && progress <= 50
  if (band === '51-75') return progress >= 51 && progress <= 75
  return progress >= 76
}

export function matchesActivity(student: TutorStudent, filter: ActivityFilter | 'all') {
  if (filter === 'all') return true
  const d = daysAgo(student.lastActivityAt)
  if (filter === 'today') return d === 0
  if (filter === 'week') return d <= 7
  if (filter === 'month') return d <= 31
  return d > 31
}

export function matchesSession(student: TutorStudent, filter: SessionFilter | 'all') {
  if (filter === 'all') return true
  if (filter === 'upcoming') return Boolean(student.nextSession?.upcoming)
  if (filter === 'completed') return student.sessions.some(s => /complete/i.test(s.status))
  return !student.nextSession?.upcoming
}

export function sortStudents(rows: TutorStudent[], key: SortKey) {
  const copy = [...rows]
  copy.sort((a, b) => {
    if (key === 'recent') return +new Date(b.lastActivityAt ?? 0) - +new Date(a.lastActivityAt ?? 0)
    if (key === 'attention') return Number(b.status === 'attention') - Number(a.status === 'attention')
    if (key === 'high') return b.overallProgress - a.overallProgress
    if (key === 'low') return a.overallProgress - b.overallProgress
    if (key === 'newest') return +new Date(b.enrolledAt) - +new Date(a.enrolledAt)
    if (key === 'lastSession') return +new Date(b.lastSessionAt ?? 0) - +new Date(a.lastSessionAt ?? 0)
    const rank = (s: TutorStudent) => (s.status === 'attention' ? 0 : s.nextSession ? 1 : s.status === 'active' ? 2 : 3)
    const d = rank(a) - rank(b)
    if (d) return d
    return +new Date(b.lastActivityAt ?? 0) - +new Date(a.lastActivityAt ?? 0)
  })
  return copy
}

export function formatWhen(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const same = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  if (same) return `Today · ${time}`
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`
}

export function relativeActivity(iso: string) {
  const d = daysAgo(iso)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

export const PAGE_SIZE = 20
