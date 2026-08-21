import type { BookingRow, LiveClass } from './api'
import { userStorageKey } from './supabase'
import {
  elapsedSeconds,
  getLiveRecord,
  loadLiveRecords,
  parseBookingTime,
  saveLiveRecord,
  secondsUntil,
  type LiveAction,
  type LiveSessionRecord,
} from './liveSession'
import { liveClassPath, tutorSessionPath } from './paths'
import { loadTutorBookings, saveTutorBookings, type TutorBooking } from './tutorMarketplace'
import { notesForStudent, type TutorStudent } from './tutorStudents'

export type SessionKind = '1on1' | 'project' | 'interview' | 'career' | 'group'
export type SessionUiStatus = 'confirmed' | 'needs_prep' | 'in_progress' | 'completed' | 'cancelled'
export type DateFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'next' | 'custom'
export type StatusFilter = 'all' | 'upcoming' | 'today' | 'in_progress' | 'completed' | 'cancelled' | 'followup'
export type SortKey = 'upcoming' | 'booked' | 'prep' | 'followup' | 'completed'
export type ProgressSelect = 'improved' | 'on_track' | 'needs_practice'
export type NextStepKind = 'lesson' | 'project' | 'practice' | 'interview' | 'session'

export interface SessionActionItem {
  id: string
  label: string
  done: boolean
}

export interface SessionExtras {
  goal: string
  covered: string
  progressSelect: ProgressSelect | ''
  feedback: string
  nextStep: NextStepKind | ''
  nextTopic: string
  actionItems: SessionActionItem[]
  followUp: boolean
  completedAt: string | null
}

export interface TutorSessionView {
  id: string
  source: 'local' | 'api' | 'live-class' | 'demo'
  demo: boolean
  studentId: string | null
  studentName: string
  studentAvatar: string | null
  topic: string
  kind: SessionKind
  kindLabel: string
  scheduledAt: string
  duration: number | null
  status: SessionUiStatus
  bookingStatus: string
  goal: string
  price: number | null
  courseTitle: string | null
  courseId: string | null
  lessonTitle: string | null
  projectTitle: string | null
  projectId: string | null
  studentProgress: number | null
  joinHref: string
  createdAt: string
  aiSummary: string | null
  aiFocus: string[]
  rating: number | null
}

function extrasKey(tutorId?: string | null) {
  return userStorageKey('learnsyra_tutor_session_extras', tutorId)
}
export const SESSION_PAGE_SIZE = 20

const EMPTY_EXTRAS: SessionExtras = {
  goal: '',
  covered: '',
  progressSelect: '',
  feedback: '',
  nextStep: '',
  nextTopic: '',
  actionItems: [],
  followUp: false,
  completedAt: null,
}

export function loadSessionExtrasMap(tutorId?: string | null): Record<string, SessionExtras> {
  const key = extrasKey(tutorId)
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, SessionExtras>) : {}
  } catch {
    return {}
  }
}

export function loadSessionExtras(tutorId: string | null | undefined, sessionId: string): SessionExtras {
  return { ...EMPTY_EXTRAS, ...(loadSessionExtrasMap(tutorId)[sessionId] ?? {}) }
}

export function saveSessionExtras(tutorId: string | null | undefined, sessionId: string, extras: SessionExtras) {
  const key = extrasKey(tutorId)
  if (!key) return
  const map = loadSessionExtrasMap(tutorId)
  map[sessionId] = extras
  localStorage.setItem(key, JSON.stringify(map))
}

export function statusDot(status: SessionUiStatus) {
  if (status === 'needs_prep') return '🟡'
  if (status === 'in_progress') return '🔵'
  if (status === 'completed') return '✓'
  if (status === 'cancelled') return '⚪'
  return '🟢'
}

export function statusLabel(status: SessionUiStatus) {
  if (status === 'needs_prep') return 'Needs Preparation'
  if (status === 'in_progress') return 'In Progress'
  if (status === 'completed') return 'Completed'
  if (status === 'cancelled') return 'Cancelled'
  return 'Confirmed'
}

export function kindLabel(kind: SessionKind) {
  if (kind === 'project') return 'Project Help'
  if (kind === 'interview') return 'Interview Prep'
  if (kind === 'career') return 'Career Guidance'
  if (kind === 'group') return 'Group Class'
  return '1-on-1 Mentoring'
}

function inferKind(label: string, fallback: SessionKind = '1on1'): SessionKind {
  const s = label.toLowerCase()
  if (/group|class|live/.test(s)) return 'group'
  if (/interview/.test(s)) return 'interview'
  if (/career/.test(s)) return 'career'
  if (/project/.test(s)) return 'project'
  if (/1-on-1|1on1|mentor/.test(s)) return '1on1'
  return fallback
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isToday(iso: string) {
  return sameDay(new Date(iso), new Date())
}

export function isTomorrow(iso: string) {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  return sameDay(new Date(iso), t)
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

export function inThisWeek(iso: string) {
  const start = startOfWeek(new Date())
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

export function inNextWeek(iso: string) {
  const start = startOfWeek(new Date())
  start.setDate(start.getDate() + 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

export function joinableNow(view: TutorSessionView, liveClass?: LiveClass | null) {
  if (view.status === 'cancelled' || view.status === 'completed') return false
  if (view.kind === 'group' || liveClass) {
    return liveClass?.status === 'live' || view.status === 'in_progress'
  }
  return secondsUntil(view.scheduledAt) <= 0
}

export function startsInLabel(iso: string) {
  const left = secondsUntil(iso)
  if (left <= 0) return null
  const m = Math.ceil(left / 60)
  if (m < 60) return `Session starts in ${m} minute${m === 1 ? '' : 's'}`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return `Session starts in ${h}h ${rem}m`
}

function studentFromRoster(roster: TutorStudent[], id: string | null, fallback: string) {
  if (!id) return { name: fallback, avatar: null as string | null, progress: null as number | null, course: null as TutorStudent['courses'][0] | null, skills: [] as TutorStudent['skills'], project: null as TutorStudent['projects'][0] | null, focus: null as string | null }
  const s = roster.find(r => r.id === id)
  if (!s) return { name: fallback, avatar: null, progress: null, course: null, skills: [], project: null, focus: null }
  return {
    name: s.name,
    avatar: s.avatarUrl,
    progress: s.overallProgress,
    course: s.courses[0] ?? null,
    skills: s.skills,
    project: s.projects[0] ?? null,
    focus: s.currentFocus,
  }
}

function applyLive(view: TutorSessionView, live: LiveSessionRecord | null): TutorSessionView {
  if (!live) return view
  if (live.status === 'live') view.status = 'in_progress'
  else if (live.status === 'completed' && view.status !== 'cancelled') view.status = 'completed'
  view.courseTitle = view.courseTitle || live.courseTitle
  view.courseId = view.courseId || live.courseId
  view.lessonTitle = view.lessonTitle || live.lessonTitle
  view.projectTitle = view.projectTitle || live.projectTitle
  view.projectId = view.projectId || live.projectId
  view.goal = view.goal || live.goal
  view.duration = view.duration ?? live.duration
  if (live.rating != null) view.rating = live.rating
  if (live.aiBrief?.text && !view.aiSummary) view.aiSummary = live.aiBrief.text
  if (live.aiBrief?.topics?.length && !view.aiFocus.length) view.aiFocus = live.aiBrief.topics.slice(0, 3)
  return view
}

function briefFromRoster(info: ReturnType<typeof studentFromRoster>): { aiSummary: string | null; aiFocus: string[] } {
  const gaps = info.skills.filter(s => s.score != null && s.score < 50).map(s => s.name)
  const strong = info.skills.filter(s => s.score != null && s.score >= 70).map(s => s.name)
  const focus = gaps.slice(0, 3)
  if (!gaps.length && !strong.length) return { aiSummary: null, aiFocus: info.focus ? [info.focus] : [] }
  const summary = [
    strong.length ? `Student is strong in ${strong.slice(0, 2).join(' and ')}` : null,
    gaps.length ? `${gaps[0]} remains a gap` : null,
  ]
    .filter(Boolean)
    .join(' but ')
  return { aiSummary: summary ? `${summary}.` : null, aiFocus: focus }
}

function applyExtras(view: TutorSessionView, extras: SessionExtras): TutorSessionView {
  if (extras.goal) view.goal = extras.goal
  if (extras.completedAt && view.status !== 'cancelled') view.status = 'completed'
  return view
}

export function needsFollowUp(view: TutorSessionView, extras: SessionExtras) {
  if (view.status === 'cancelled') return false
  if (extras.followUp) return true
  if (extras.actionItems.some(a => !a.done)) return true
  if (view.status === 'completed' && !extras.feedback && !extras.covered) return true
  if (view.status === 'completed' && extras.nextStep) return true
  return false
}

export function needsPrep(view: TutorSessionView, extras: SessionExtras, tutorId?: string | null) {
  if (view.status !== 'confirmed' && view.status !== 'needs_prep') return false
  if (view.status === 'needs_prep') return true
  const notes = view.studentId ? notesForStudent(tutorId, view.studentId) : []
  return !extras.goal && notes.length === 0 && !view.goal
}

export interface SessionBuildInput {
  local: TutorBooking[]
  api: BookingRow[]
  liveClasses: LiveClass[]
  roster: TutorStudent[]
  tutorUserId: string | null
  tutorPublicId: string
}

export function buildTutorSessions(input: SessionBuildInput): { sessions: TutorSessionView[]; source: 'live' | 'demo' } {
  const extrasMap = loadSessionExtrasMap(input.tutorUserId)
  const lives = loadLiveRecords()
  const out: TutorSessionView[] = []

  for (const b of input.local) {
    if (b.tutorId !== input.tutorPublicId) continue
    const when = parseBookingTime(b).toISOString()
    const info = studentFromRoster(input.roster, b.studentId, 'Student')
    const kind = inferKind(b.sessionLabel, b.sessionType)
    let view: TutorSessionView = {
      id: b.id,
      source: 'local',
      demo: false,
      studentId: b.studentId,
      studentName: info.name,
      studentAvatar: info.avatar,
      topic: b.sessionLabel || 'Tutor session',
      kind,
      kindLabel: kindLabel(kind),
      scheduledAt: when,
      duration: b.duration,
      status: b.status === 'cancelled' ? 'cancelled' : b.status === 'completed' ? 'completed' : b.status === 'pending' ? 'needs_prep' : 'confirmed',
      bookingStatus: b.status,
      goal: b.goal || '',
      price: b.price || null,
      courseTitle: info.course?.title ?? null,
      courseId: info.course?.id ?? null,
      lessonTitle: info.focus,
      projectTitle: info.project?.title ?? null,
      projectId: info.project?.id ?? null,
      studentProgress: info.progress,
      joinHref: `/live?session=${encodeURIComponent(b.id)}`,
      createdAt: b.createdAt,
      ...briefFromRoster(info),
      rating: null,
    }
    view = applyLive(view, lives.find(l => l.id === b.id || l.bookingId === b.id) ?? getLiveRecord(b.id))
    view = applyExtras(view, { ...EMPTY_EXTRAS, ...(extrasMap[view.id] ?? {}) })
    out.push(view)
  }

  for (const b of input.api) {
    if (out.some(s => s.id === b.id)) continue
    const info = studentFromRoster(input.roster, b.student_id, b.student?.full_name || 'Student')
    const label = b.message?.split('\n')[0] || b.listing?.expertise || 'Tutor session'
    const kind = inferKind(label)
    let view: TutorSessionView = {
      id: b.id,
      source: 'api',
      demo: false,
      studentId: b.student_id,
      studentName: info.name,
      studentAvatar: b.student?.avatar_url || info.avatar,
      topic: label,
      kind,
      kindLabel: kindLabel(kind),
      scheduledAt: b.created_at,
      duration: null,
      status: b.status === 'cancelled' ? 'cancelled' : b.status === 'completed' ? 'completed' : b.status === 'pending' ? 'needs_prep' : 'confirmed',
      bookingStatus: b.status,
      goal: b.message || '',
      price: null,
      courseTitle: info.course?.title ?? null,
      courseId: info.course?.id ?? null,
      lessonTitle: info.focus,
      projectTitle: info.project?.title ?? null,
      projectId: info.project?.id ?? null,
      studentProgress: info.progress,
      joinHref: `/live?session=${encodeURIComponent(b.id)}`,
      createdAt: b.created_at,
      ...briefFromRoster(info),
      rating: null,
    }
    view = applyLive(view, getLiveRecord(b.id))
    view = applyExtras(view, { ...EMPTY_EXTRAS, ...(extrasMap[view.id] ?? {}) })
    out.push(view)
  }

  for (const c of input.liveClasses) {
    if (out.some(s => s.id === c.id)) continue
    const kind: SessionKind = 'group'
    let view: TutorSessionView = {
      id: c.id,
      source: 'live-class',
      demo: false,
      studentId: null,
      studentName: c.course?.title ? `${c.course.title} class` : 'Group class',
      studentAvatar: null,
      topic: c.title,
      kind,
      kindLabel: kindLabel(kind),
      scheduledAt: c.starts_at,
      duration: null,
      status: c.status === 'ended' ? 'completed' : c.status === 'live' ? 'in_progress' : 'confirmed',
      bookingStatus: c.status,
      goal: c.description || '',
      price: null,
      courseTitle: c.course?.title ?? null,
      courseId: c.course_id,
      lessonTitle: null,
      projectTitle: null,
      projectId: null,
      studentProgress: null,
      joinHref: liveClassPath(c.id),
      createdAt: c.created_at,
      aiSummary: null,
      aiFocus: [],
      rating: null,
    }
    view = applyExtras(view, { ...EMPTY_EXTRAS, ...(extrasMap[view.id] ?? {}) })
    out.push(view)
  }

  out.sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt))
  return { sessions: out, source: 'live' as const }
}

export function sessionStats(rows: TutorSessionView[], tutorId?: string | null) {
  const extras = loadSessionExtrasMap(tutorId)
  return {
    today: rows.filter(s => !s.demo && isToday(s.scheduledAt) && s.status !== 'cancelled').length,
    upcoming: rows.filter(s => !s.demo && +new Date(s.scheduledAt) >= Date.now() && s.status !== 'completed' && s.status !== 'cancelled').length,
    completed: rows.filter(s => !s.demo && s.status === 'completed').length,
    followup: rows.filter(s => needsFollowUp(s, { ...EMPTY_EXTRAS, ...(extras[s.id] ?? {}) })).length,
  }
}

export function matchesQuery(s: TutorSessionView, q: string) {
  if (!q.trim()) return true
  const blob = [s.studentName, s.topic, s.courseTitle, s.projectTitle, s.kindLabel, s.lessonTitle, s.goal].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every(w => blob.includes(w))
}

export function matchesFilters(
  s: TutorSessionView,
  opts: { kind: SessionKind | 'all'; status: StatusFilter; date: DateFilter; custom: string; student: string; tutorId?: string | null },
) {
  if (opts.kind !== 'all' && s.kind !== opts.kind) return false
  if (opts.student && !s.studentName.toLowerCase().includes(opts.student.toLowerCase())) return false
  if (opts.date === 'today' && !isToday(s.scheduledAt)) return false
  if (opts.date === 'tomorrow' && !isTomorrow(s.scheduledAt)) return false
  if (opts.date === 'week' && !inThisWeek(s.scheduledAt)) return false
  if (opts.date === 'next' && !inNextWeek(s.scheduledAt)) return false
  if (opts.date === 'custom' && opts.custom && !s.scheduledAt.startsWith(opts.custom)) return false
  const extras = loadSessionExtras(opts.tutorId, s.id)
  if (opts.status === 'upcoming') return +new Date(s.scheduledAt) >= Date.now() && s.status !== 'cancelled' && s.status !== 'completed'
  if (opts.status === 'today') return isToday(s.scheduledAt)
  if (opts.status === 'in_progress') return s.status === 'in_progress'
  if (opts.status === 'completed') return s.status === 'completed'
  if (opts.status === 'cancelled') return s.status === 'cancelled'
  if (opts.status === 'followup') return needsFollowUp(s, extras)
  return true
}

export function sortSessions(rows: TutorSessionView[], key: SortKey, tutorId?: string | null) {
  const copy = [...rows]
  copy.sort((a, b) => {
    if (key === 'booked') return +new Date(b.createdAt) - +new Date(a.createdAt)
    if (key === 'completed') return +new Date(b.scheduledAt) - +new Date(a.scheduledAt)
    if (key === 'prep') return Number(needsPrep(b, loadSessionExtras(tutorId, b.id), tutorId)) - Number(needsPrep(a, loadSessionExtras(tutorId, a.id), tutorId))
    if (key === 'followup') return Number(needsFollowUp(b, loadSessionExtras(tutorId, b.id))) - Number(needsFollowUp(a, loadSessionExtras(tutorId, a.id)))
    const ua = a.status === 'completed' || a.status === 'cancelled' ? 1 : 0
    const ub = b.status === 'completed' || b.status === 'cancelled' ? 1 : 0
    if (ua !== ub) return ua - ub
    return +new Date(a.scheduledAt) - +new Date(b.scheduledAt)
  })
  return copy
}

export function formatWhen(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  if (isToday(iso)) return `Today · ${time}`
  if (isTomorrow(iso)) return `Tomorrow · ${time}`
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function previousSession(all: TutorSessionView[], current: TutorSessionView) {
  return all
    .filter(s => s.studentId && s.studentId === current.studentId && s.id !== current.id && +new Date(s.scheduledAt) < +new Date(current.scheduledAt))
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))[0] ?? null
}

export function buildAiBrief(view: TutorSessionView, student: TutorStudent | undefined, prev: TutorSessionView | null) {
  const skills = student?.skills ?? []
  const gaps = student?.focusSkills ?? skills.filter(s => s.score != null && s.score < 50).map(s => s.name)
  const strong = skills.filter(s => s.score != null && s.score >= 70)
  const recent = student?.activity[0]?.text ?? null
  const focus = gaps.length ? gaps.slice(0, 3) : view.lessonTitle ? [view.lessonTitle] : []
  const question = gaps[0]
    ? `What part of ${gaps[0]} feels most difficult right now?`
    : 'What part of the work feels most difficult right now?'
  const summary = student
    ? `${view.studentName} is working on ${view.topic}. ${strong.length ? `Listed strengths: ${strong.map(s => s.name).join(', ')}.` : ''} ${gaps.length ? `${gaps[0]} is the largest listed gap.` : ''}`.trim()
    : `${view.topic} with ${view.studentName}.`
  return { skills, gaps, strong, recent, focus, question, summary, project: view.projectTitle, prev: prev?.topic ?? null }
}

export function preparePrompt(view: TutorSessionView, student: TutorStudent | undefined, prev: TutorSessionView | null) {
  const brief = buildAiBrief(view, student, prev)
  return [
    `Prepare a tutoring session.`,
    `Student: ${view.studentName}.`,
    `Session type: ${view.kindLabel}.`,
    `Topic: ${view.topic}.`,
    `Goal: ${view.goal || 'not added'}.`,
    view.courseTitle ? `Course: ${view.courseTitle}.` : '',
    view.lessonTitle ? `Lesson: ${view.lessonTitle}.` : '',
    view.projectTitle ? `Project: ${view.projectTitle}.` : '',
    brief.prev ? `Previous session: ${brief.prev}.` : '',
    brief.gaps.length ? `Skill gaps listed: ${brief.gaps.join(', ')}.` : '',
    'Suggest what to teach, what to review, 3 questions, a practice exercise, the likely gap, and homework.',
    'Do not invent extra student history, grades, or credentials.',
  ]
    .filter(Boolean)
    .join(' ')
}

export function completeLocalBooking(id: string) {
  const rows = loadTutorBookings()
  saveTutorBookings(rows.map(b => (b.id === id ? { ...b, status: 'completed' as const } : b)))
}

export function liveElapsed(id: string) {
  const rec = getLiveRecord(id)
  if (!rec || rec.status !== 'live') return null
  return elapsedSeconds(rec)
}

export function liveActions(id: string): LiveAction[] {
  return getLiveRecord(id)?.actionItems ?? []
}

export { secondsUntil, EMPTY_EXTRAS, tutorSessionPath }
