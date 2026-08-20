import { userStorageKey } from './supabase'
import {
  buildTutorCatalog,
  generateSessionBrief,
  getTutorById,
  loadTutorBookings,
  type CatalogTutor,
  type TutorBooking,
} from './tutorMarketplace'

const RECORD_KEY = 'learnsyra_live_records'

export type LivePhase = 'lobby' | 'connecting' | 'live' | 'summary'

export interface LiveNoteItem {
  id: string
  text: string
}

export interface LiveAction {
  id: string
  label: string
  done: boolean
}

export interface ChatLine {
  id: string
  from: 'you' | 'tutor'
  text: string
}

export interface LiveSessionRecord {
  id: string
  bookingId: string
  tutorId: string
  studentId: string | null
  courseId: string
  courseTitle: string
  lessonId: string
  lessonTitle: string
  projectId: string
  projectTitle: string
  projectTask: string
  projectProgress: number
  sessionType: string
  goal: string
  scheduledAt: string
  duration: number
  status: 'upcoming' | 'live' | 'completed'
  phase: LivePhase
  aiBrief: {
    topics: string[]
    questions: string[]
    challenge: string
    text: string
  }
  notes: { my: string; session: string; live: LiveNoteItem[] }
  questions: string[]
  summary: string
  learned: string
  tutorFeedback: string
  tutorStrength: string
  tutorPractice: string
  rating: number | null
  actionItems: LiveAction[]
  recommendedLesson: { title: string; minutes: number; href: string }
  recommendedProject: { title: string; why: string; href: string }
  careerBefore: number
  careerAfter: number
  skillDeltas: { skill: string; delta: number }[]
  joinedAt?: string
  endedAt?: string
  chat: ChatLine[]
  board: string
  explanations: string[]
}

function loadAll(): Record<string, LiveSessionRecord> {
  const key = userStorageKey(RECORD_KEY)
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, LiveSessionRecord>) : {}
  } catch {
    return {}
  }
}

function saveAll(map: Record<string, LiveSessionRecord>) {
  const key = userStorageKey(RECORD_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(map))
}

export function saveLiveRecord(row: LiveSessionRecord) {
  const all = loadAll()
  all[row.id] = row
  saveAll(all)
}

export function getLiveRecord(id: string) {
  const all = loadAll()
  return all[id] ?? Object.values(all).find(r => r.bookingId === id) ?? null
}

export function loadLiveRecords(): LiveSessionRecord[] {
  return Object.values(loadAll())
}

export function parseBookingTime(booking: TutorBooking) {
  const d = new Date(`${booking.date}T00:00:00`)
  const m = booking.time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (m) {
    let h = Number(m[1]) % 12
    if (/pm/i.test(m[3])) h += 12
    d.setHours(h, Number(m[2]), 0, 0)
  }
  return d
}

export function formatClock(totalSeconds: number) {
  const n = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(n / 3600)
  const m = Math.floor((n % 3600) / 60)
  const s = n % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function secondsUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 1000)
}

function recordFromBooking(tutor: CatalogTutor, booking: TutorBooking): LiveSessionRecord {
  const briefRaw = generateSessionBrief(tutor, booking.goal || 'Session goals', booking.sessionLabel || '1-on-1')
  return {
    id: booking.id,
    bookingId: booking.id,
    tutorId: tutor.id,
    studentId: booking.studentId,
    courseId: '',
    courseTitle: booking.sessionLabel || 'Tutor session',
    lessonId: '',
    lessonTitle: '',
    projectId: '',
    projectTitle: '',
    projectTask: '',
    projectProgress: 0,
    sessionType: booking.sessionLabel || '1-on-1',
    goal: booking.goal || '',
    scheduledAt: parseBookingTime(booking).toISOString(),
    duration: booking.duration || 45,
    status: 'upcoming',
    phase: 'lobby',
    aiBrief: {
      topics: [],
      questions: [],
      challenge: '',
      text: booking.aiBrief || briefRaw.text,
    },
    notes: { my: '', session: '', live: [] },
    questions: [],
    summary: '',
    learned: '',
    tutorFeedback: '',
    tutorStrength: '',
    tutorPractice: '',
    rating: null,
    actionItems: [],
    recommendedLesson: { title: 'Explore courses', minutes: 0, href: '/courses' },
    recommendedProject: {
      title: 'Explore projects',
      why: 'Catalog projects you can try after this session.',
      href: '/projects',
    },
    careerBefore: 0,
    careerAfter: 0,
    skillDeltas: [],
    chat: [],
    board: '',
    explanations: [],
  }
}

function completeFields(row: LiveSessionRecord): LiveSessionRecord {
  return {
    ...row,
    status: 'completed',
    phase: 'summary',
    endedAt: new Date().toISOString(),
    summary: row.summary,
    learned: row.learned,
    tutorFeedback: row.tutorFeedback,
  }
}

export function resolveLiveSession(preferredId?: string | null): LiveSessionRecord | null {
  const catalog = buildTutorCatalog([])
  const bookings = loadTutorBookings().filter(b => b.status !== 'cancelled')
  const stored = loadAll()

  const fromBooking = (booking: TutorBooking) => {
    const existing = stored[booking.id] ?? Object.values(stored).find(r => r.bookingId === booking.id)
    if (existing) return existing
    const tutor = getTutorById(catalog, booking.tutorId)
    if (!tutor) return null
    const row = recordFromBooking(tutor, booking)
    saveLiveRecord(row)
    return row
  }

  if (preferredId) {
    const existing = stored[preferredId] ?? Object.values(stored).find(r => r.bookingId === preferredId)
    if (existing) return existing
    const booking = bookings.find(b => b.id === preferredId)
    if (booking) return fromBooking(booking)
    return null
  }

  const latest = bookings[0]
  if (latest) return fromBooking(latest)
  return null
}

export function markSessionLive(row: LiveSessionRecord) {
  const next: LiveSessionRecord = {
    ...row,
    status: 'live',
    phase: 'live',
    joinedAt: row.joinedAt ?? new Date().toISOString(),
  }
  saveLiveRecord(next)
  return next
}

export function markSessionComplete(row: LiveSessionRecord) {
  const next = completeFields(row)
  saveLiveRecord(next)
  return next
}

export function remainingSeconds(row: LiveSessionRecord) {
  const start = row.joinedAt ? new Date(row.joinedAt).getTime() : Date.now()
  const elapsed = Math.floor((Date.now() - start) / 1000)
  return row.duration * 60 - elapsed
}

export function elapsedSeconds(row: LiveSessionRecord) {
  const start = row.joinedAt ? new Date(row.joinedAt).getTime() : Date.now()
  return Math.max(0, Math.floor((Date.now() - start) / 1000))
}

export const COPILOT_QUESTIONS = [
  'What should I focus on in this session?',
  'How should I practice after we finish?',
  'What is a good next step?',
]

export const EXPLAIN_SERVICE_LAYER =
  'A service layer keeps API communication separate from UI components, making the application easier to test and maintain.'
