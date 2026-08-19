import {
  buildTutorCatalog,
  generateSessionBrief,
  getTutorById,
  loadTutorBookings,
  type CatalogTutor,
  type TutorBooking,
} from './tutorMarketplace'
import { lessonPath, projectWorkspacePath } from './paths'

const RECORD_KEY = 'learnsyra_live_records'
const SEED_KEY = 'learnsyra_live_seed'

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

const COURSE_ID = 'catalog-full-stack-web-development'
const LESSON_CURRENT = `${COURSE_ID}-l-1-3`
const LESSON_NEXT = `${COURSE_ID}-l-2-0`
const PROJECT_ID = 'catalog-react-expense'
const NEXT_PROJECT = 'catalog-fullstack-auth'

function loadAll(): Record<string, LiveSessionRecord> {
  try {
    const raw = localStorage.getItem(RECORD_KEY)
    return raw ? (JSON.parse(raw) as Record<string, LiveSessionRecord>) : {}
  } catch {
    return {}
  }
}

function saveAll(map: Record<string, LiveSessionRecord>) {
  localStorage.setItem(RECORD_KEY, JSON.stringify(map))
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

function defaultsFor(tutor: CatalogTutor, booking: TutorBooking | null, scheduledAt: string): LiveSessionRecord {
  const briefRaw = generateSessionBrief(tutor, booking?.goal || 'Project architecture and REST APIs', booking?.sessionLabel || 'Project Help')
  const id = booking?.id ?? 'live-demo-sarah'
  return {
    id,
    bookingId: booking?.id ?? 'demo',
    tutorId: tutor.id,
    studentId: booking?.studentId ?? null,
    courseId: COURSE_ID,
    courseTitle: 'Full Stack Web Development',
    lessonId: LESSON_CURRENT,
    lessonTitle: 'React useEffect',
    projectId: PROJECT_ID,
    projectTitle: 'React Expense Tracker',
    projectTask: 'Connect REST API',
    projectProgress: 45,
    sessionType: booking?.sessionLabel ?? 'Project Help',
    goal: booking?.goal || 'Review project architecture and REST API integration',
    scheduledAt,
    duration: booking?.duration ?? 60,
    status: 'upcoming',
    phase: 'lobby',
    aiBrief: {
      topics: ['React Hooks', 'REST API integration', 'Project architecture'],
      questions: [
        'How should I structure my API layer?',
        'Should I move this logic into a custom hook?',
      ],
      challenge: 'Expense Tracker API integration',
      text: booking?.aiBrief || briefRaw.text,
    },
    notes: {
      my: '',
      session: '',
      live: [
        { id: 'n1', text: 'Separate API service layer' },
        { id: 'n2', text: 'Keep UI components focused' },
        { id: 'n3', text: 'Use custom hooks for reusable logic' },
      ],
    },
    questions: [
      'Why should this API call be separated?',
      'Would you use React Query here?',
      'How would this scale in production?',
    ],
    summary: '',
    learned: '',
    tutorFeedback: '',
    tutorStrength: 'Strong understanding',
    tutorPractice: 'Needs more practice',
    rating: null,
    actionItems: [
      { id: 'a1', label: 'Refactor API service', done: true },
      { id: 'a2', label: 'Add error handling', done: false },
      { id: 'a3', label: 'Write API tests', done: false },
      { id: 'a4', label: 'Complete expense tracker', done: false },
    ],
    recommendedLesson: {
      title: 'Advanced REST API Patterns',
      minutes: 14,
      href: lessonPath(COURSE_ID, LESSON_NEXT),
    },
    recommendedProject: {
      title: 'Full Stack Authentication System',
      why: 'This builds on the API architecture skills you practiced today.',
      href: projectWorkspacePath(NEXT_PROJECT),
    },
    careerBefore: 82,
    careerAfter: 85,
    skillDeltas: [
      { skill: 'REST APIs', delta: 5 },
      { skill: 'Architecture', delta: 4 },
      { skill: 'Testing', delta: 2 },
    ],
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
    summary: row.summary || 'React Hooks, REST APIs, API service architecture',
    learned:
      row.learned ||
      'You learned how to separate API communication from UI components and when to use custom hooks.',
    tutorFeedback:
      row.tutorFeedback ||
      'Your React fundamentals are strong. Focus on API error handling and testing next.',
    tutorStrength: 'Strong understanding',
    tutorPractice: 'Needs more practice',
  }
}

export function resolveLiveSession(preferredId?: string | null): LiveSessionRecord {
  const catalog = buildTutorCatalog([])
  const bookings = loadTutorBookings().filter(b => b.status !== 'cancelled')
  const stored = loadAll()

  if (preferredId) {
    const existing = stored[preferredId] ?? Object.values(stored).find(r => r.bookingId === preferredId)
    if (existing) return existing
    const booking = bookings.find(b => b.id === preferredId)
    if (booking) {
      const tutor = getTutorById(catalog, booking.tutorId) ?? getTutorById(catalog, 'catalog-sarah-kim')
      if (tutor) {
        const row = defaultsFor(tutor, booking, parseBookingTime(booking).toISOString())
        saveLiveRecord(row)
        return row
      }
    }
  }

  const latest = bookings[0]
  if (latest) {
    const existing = stored[latest.id]
    if (existing) return existing
    const tutor = getTutorById(catalog, latest.tutorId) ?? getTutorById(catalog, 'catalog-sarah-kim')
    if (tutor) {
      const row = defaultsFor(tutor, latest, parseBookingTime(latest).toISOString())
      saveLiveRecord(row)
      return row
    }
  }

  const demoId = 'live-demo-sarah'
  if (stored[demoId]) return stored[demoId]
  const tutor = getTutorById(catalog, 'catalog-sarah-kim') ?? catalog[0]
  let scheduled = localStorage.getItem(SEED_KEY)
  if (!scheduled) {
    scheduled = new Date(Date.now() + 75_000).toISOString()
    localStorage.setItem(SEED_KEY, scheduled)
  }
  const row = defaultsFor(tutor, null, scheduled)
  row.id = demoId
  saveLiveRecord(row)
  return row
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
  'Why should this API call be separated?',
  'Would you use React Query here?',
  'How would this scale in production?',
]

export const EXPLAIN_SERVICE_LAYER =
  'A service layer keeps API communication separate from UI components, making the application easier to test and maintain.'
