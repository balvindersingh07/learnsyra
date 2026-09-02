import { loadAdminStringMap, saveAdminStringMap } from './adminStorage'
import { adminApproveTutor, adminSuspendTutor, isModerationBackendAvailable } from './adminModeration'
import { getCourseReviews, type CourseReview, type ProfileLite, type TutorListing } from './api'
import {
  bookingsForUser,
  formatWhen,
  isDemoUserId,
  loadAdminUserIndex,
  paginate,
  type AdminUserIndex,
  type AdminUserRow,
} from './adminUsers'
import { loadTutorHub, saveTutorHub, type ProfileVisibility, type TutorHub } from './tutorProfile'
import { visibilityLabel } from './tutorSettings'

export type TutorTab = 'all' | 'published' | 'draft' | 'paused' | 'review'
export type TutorSort = 'recommended' | 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'students' | 'rating' | 'sessions'
export type MarketFilter = 'all' | ProfileVisibility | 'unknown'

export interface AdminTutorRow {
  id: string
  name: string
  headline: string | null
  avatarUrl: string | null
  email: string | null
  expertise: string[]
  teachingStyles: string[]
  sessionTypes: string[]
  market: ProfileVisibility | null
  publicId: string | null
  listingId: string | null
  listingAvailable: boolean | null
  courseCount: number
  unpublishedCount: number
  studentCount: number
  sessionCount: number
  rating: number | null
  reviewCount: number
  joinedAt: string | null
  hasHub: boolean
  demo: boolean
}

export interface AdminTutorIndex extends AdminUserIndex {
  tutors: AdminTutorRow[]
}

const NOTES_KEY = 'learnsyra_admin_tutor_notes'
const PAGE_SIZE = 20

export { formatWhen, paginate, bookingsForUser }

export function tutorsPageSize() {
  return PAGE_SIZE
}

export function loadAdminNotes(): Record<string, string> {
  return loadAdminStringMap(NOTES_KEY)
}

export function saveAdminNote(tutorId: string, note: string) {
  const map = loadAdminNotes()
  const next = note.trim()
  if (next) map[tutorId] = next
  else delete map[tutorId]
  saveAdminStringMap(NOTES_KEY, map)
}

function listingFor(userId: string, listings: TutorListing[]) {
  return listings.find(l => l.profile_id === userId) ?? null
}

function expertiseOf(hub: TutorHub | null, listing: TutorListing | null) {
  const fromHub = [
    ...(hub?.categories ?? []),
    ...(hub?.skills.map(s => s.name) ?? []),
  ]
  const fromListing = [listing?.expertise, listing?.subject, ...(listing?.tags ?? [])].filter(Boolean) as string[]
  return [...new Set([...fromHub, ...fromListing])].filter(Boolean)
}

function toTutorRow(user: AdminUserRow, index: AdminUserIndex): AdminTutorRow {
  const listing = listingFor(user.id, index.listings)
  const taught = index.courses.filter(c => c.tutor_id === user.id)
  const taughtIds = new Set(taught.map(c => c.id))
  const students = new Set(index.enrollments.filter(e => taughtIds.has(e.course_id)).map(e => e.student_id))
  const books = bookingsForUser(user.id, 'tutor', index)
  books.forEach(b => students.add(b.student_id))
  const rating = listing && listing.reviews > 0 ? listing.rating : null
  return {
    id: user.id,
    name: user.name,
    headline: user.headline || listing?.intro || null,
    avatarUrl: user.avatarUrl,
    email: user.email,
    expertise: expertiseOf(null, listing),
    teachingStyles: [],
    sessionTypes: [],
    market: listing ? (listing.available ? 'published' : 'paused') : null,
    publicId: listing?.id ?? null,
    listingId: listing?.id ?? null,
    listingAvailable: listing ? listing.available : null,
    courseCount: taught.length,
    unpublishedCount: taught.filter(c => !c.published).length,
    studentCount: students.size,
    sessionCount: books.length,
    rating,
    reviewCount: listing?.reviews ?? 0,
    joinedAt: user.joinedAt,
    hasHub: Boolean(listing),
    demo: isDemoUserId(user.id),
  }
}

export async function loadAdminTutorIndex(): Promise<AdminTutorIndex> {
  const index = await loadAdminUserIndex()
  const tutors = index.rows.filter(r => r.role === 'tutor').map(r => toTutorRow(r, index))
  return { ...index, tutors }
}

export function tutorStats(rows: AdminTutorRow[]) {
  const real = rows.filter(r => !r.demo)
  return {
    total: real.length,
    published: real.filter(r => r.market === 'published' || r.listingAvailable === true).length,
    draft: real.filter(r => r.market === 'draft').length,
    paused: real.filter(r => r.market === 'paused' || r.listingAvailable === false).length,
    pendingReview: real.filter(r => r.unpublishedCount > 0 || r.listingAvailable === false).length,
    verified: real.filter(r => r.listingAvailable === true).length,
  }
}

export interface TutorQuery {
  tab: TutorTab
  q: string
  market: MarketFilter
  expertise: string
  style: string
  session: string
  joined: 'any' | '7d' | '30d' | '3m' | '1y'
  sort: TutorSort
}

export function filterTutors(rows: AdminTutorRow[], query: TutorQuery) {
  const q = query.q.trim().toLowerCase()
  let list = rows
  if (query.tab === 'published') list = list.filter(r => r.market === 'published')
  else if (query.tab === 'draft') list = list.filter(r => r.market === 'draft')
  else if (query.tab === 'paused') list = list.filter(r => r.market === 'paused')
  else if (query.tab === 'review') list = list.filter(r => r.unpublishedCount > 0)
  if (query.market === 'unknown') list = list.filter(r => r.market == null)
  else if (query.market !== 'all') list = list.filter(r => r.market === query.market)
  if (query.expertise) list = list.filter(r => r.expertise.includes(query.expertise))
  if (query.style) list = list.filter(r => r.teachingStyles.includes(query.style))
  if (query.session) list = list.filter(r => r.sessionTypes.includes(query.session))
  if (query.joined !== 'any') {
    const days = query.joined === '7d' ? 7 : query.joined === '30d' ? 30 : query.joined === '3m' ? 90 : 365
    const from = Date.now() - days * 86400000
    list = list.filter(r => r.joinedAt && +new Date(r.joinedAt) >= from)
  }
  if (q) {
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.headline && r.headline.toLowerCase().includes(q)) ||
      r.expertise.some(e => e.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list]
  if (query.sort === 'newest') sorted.sort((a, b) => +(new Date(b.joinedAt || 0)) - +(new Date(a.joinedAt || 0)))
  else if (query.sort === 'oldest') sorted.sort((a, b) => +(new Date(a.joinedAt || 0)) - +(new Date(b.joinedAt || 0)))
  else if (query.sort === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name))
  else if (query.sort === 'name_desc') sorted.sort((a, b) => b.name.localeCompare(a.name))
  else if (query.sort === 'students') sorted.sort((a, b) => b.studentCount - a.studentCount)
  else if (query.sort === 'rating') sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  else if (query.sort === 'sessions') sorted.sort((a, b) => b.sessionCount - a.sessionCount)
  else {
    sorted.sort((a, b) => {
      const rev = Number(b.unpublishedCount > 0) - Number(a.unpublishedCount > 0)
      if (rev) return rev
      return +(new Date(b.joinedAt || 0)) - +(new Date(a.joinedAt || 0))
    })
  }
  return sorted
}

export function uniqueValues(rows: AdminTutorRow[], key: 'expertise' | 'teachingStyles' | 'sessionTypes') {
  return [...new Set(rows.flatMap(r => r[key]))].filter(Boolean).sort()
}

export function marketLabel(v: ProfileVisibility | null) {
  if (!v) return '—'
  return visibilityLabel(v)
}

export async function pauseDiscovery(userId: string, listingId?: string | null): Promise<{ ok: boolean; message: string }> {
  if (isModerationBackendAvailable() && listingId) {
    const result = await adminSuspendTutor(userId)
    return { ok: result.ok, message: result.message }
  }
  const hub = loadTutorHub(userId)
  if (!hub) return { ok: false, message: 'Marketplace visibility control is not connected.' }
  saveTutorHub({ ...hub, visibility: 'paused' })
  return { ok: true, message: 'Discovery paused using the existing tutor visibility state. Existing sessions are not cancelled automatically.' }
}

export async function resumeDiscovery(userId: string, listingId?: string | null): Promise<{ ok: boolean; message: string }> {
  if (isModerationBackendAvailable() && listingId) {
    const result = await adminApproveTutor(userId)
    return { ok: result.ok, message: result.message }
  }
  const hub = loadTutorHub(userId)
  if (!hub) return { ok: false, message: 'Marketplace visibility control is not connected.' }
  saveTutorHub({ ...hub, visibility: 'published' })
  return { ok: true, message: 'Discovery resumed using the existing tutor visibility state.' }
}

export function publicProfileHref(row: Pick<AdminTutorRow, 'publicId' | 'listingId'>) {
  const id = row.publicId || row.listingId
  return id ? `/tutors/${id}` : null
}

export function tutorActivity(row: AdminTutorRow, index: AdminUserIndex) {
  const out: { id: string; label: string; at: string }[] = []
  if (row.joinedAt) out.push({ id: 'joined', label: 'Tutor account created', at: row.joinedAt })
  for (const c of index.courses.filter(c => c.tutor_id === row.id)) {
    out.push({ id: `c-${c.id}`, label: `Course created: ${c.title}`, at: c.created_at })
    if (c.published) out.push({ id: `cp-${c.id}`, label: `Course published: ${c.title}`, at: c.created_at })
  }
  for (const b of bookingsForUser(row.id, 'tutor', index)) {
    out.push({ id: `b-${b.id}`, label: b.status === 'completed' ? 'Session completed' : `Session booked (${b.status})`, at: b.created_at })
  }
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at))
}

export function tutorStudents(row: AdminTutorRow, index: AdminUserIndex) {
  const taughtIds = new Set(index.courses.filter(c => c.tutor_id === row.id).map(c => c.id))
  const byStudent = new Map<string, { student: ProfileLite | null; courses: string[]; progress: number[]; sessions: number }>()
  const ensure = (id: string) => {
    if (!byStudent.has(id)) {
      byStudent.set(id, { student: index.profiles.find(p => p.id === id) ?? null, courses: [], progress: [], sessions: 0 })
    }
    return byStudent.get(id)!
  }
  for (const e of index.enrollments.filter(e => taughtIds.has(e.course_id))) {
    const rowS = ensure(e.student_id)
    const title = index.courses.find(c => c.id === e.course_id)?.title
    if (title && !rowS.courses.includes(title)) rowS.courses.push(title)
    rowS.progress.push(e.progress)
  }
  for (const b of bookingsForUser(row.id, 'tutor', index)) {
    ensure(b.student_id).sessions += 1
  }
  return [...byStudent.entries()].map(([id, v]) => ({
    id,
    name: v.student?.full_name || 'Student',
    courses: v.courses,
    progress: v.progress.length ? Math.round(v.progress.reduce((a, b) => a + b, 0) / v.progress.length) : null,
    sessions: v.sessions,
  }))
}

export function tutorProjects(row: AdminTutorRow, index: AdminUserIndex) {
  const studentIds = new Set(tutorStudents(row, index).map(s => s.id))
  return index.projects.filter(p => studentIds.has(p.student_id)).map(p => ({
    id: p.id,
    title: index.catalog.find(c => c.id === p.project_id)?.title || 'Project',
    student: index.profiles.find(pr => pr.id === p.student_id)?.full_name || 'Student',
    status: p.status,
    submitted: p.submitted_at,
  }))
}

export async function loadTutorCourseReviews(index: AdminUserIndex, tutorId: string): Promise<CourseReview[]> {
  const courses = index.courses.filter(c => c.tutor_id === tutorId)
  const packs = await Promise.all(courses.map(c => getCourseReviews(c.id).catch(() => [] as CourseReview[])))
  return packs.flat()
}

export function profileField(value: string | number | null | undefined) {
  if (value == null) return 'Not provided'
  if (typeof value === 'string' && !value.trim()) return 'Not provided'
  return String(value)
}
