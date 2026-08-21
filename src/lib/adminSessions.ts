import { loadAdminStringMap, saveAdminStringMap } from './adminStorage'
import { getAllProfiles, getLiveClasses, getTutorListings, setBookingStatus, type LiveClass, type ProfileLite, type TutorListing } from './api'
import { formatWhen, paginate } from './adminUsers'
import { isSupabaseConfigured, supabase } from './supabase'

export type SessionTab = 'all' | 'upcoming' | 'live' | 'completed' | 'cancelled' | 'attention'
export type SessionSort = 'recommended' | 'newest' | 'oldest' | 'soonest' | 'latest' | 'longest' | 'shortest'
export type DateFilter = 'any' | 'today' | 'tomorrow' | 'week' | 'next7' | 'past7' | 'custom'
export type SessionKindFilter = 'all' | 'booking' | 'live-class'
export type BookingStatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'

interface BookingRaw {
  id: string
  student_id: string
  tutor_listing_id: string | null
  message: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  created_at: string
}

export interface AdminSessionRow {
  routeId: string
  sourceId: string
  kind: 'booking' | 'live-class'
  typeLabel: string
  title: string
  bookingStatus: BookingRaw['status'] | null
  liveStatus: 'scheduled' | 'live' | 'ended' | null
  bookedAt: string
  startAt: string | null
  endAt: string | null
  durationMin: number | null
  tutorId: string | null
  tutorName: string
  tutorHeadline: string | null
  studentId: string | null
  studentName: string | null
  courseId: string | null
  courseTitle: string | null
  goal: string | null
  demo: boolean
}

export interface AdminAttendanceRow {
  classId: string
  studentId: string
  studentName: string
}

export interface AdminSessionIndex {
  rows: AdminSessionRow[]
  attendance: AdminAttendanceRow[]
  bookingsAvailable: boolean
  liveAvailable: boolean
  attendanceAvailable: boolean
  profiles: ProfileLite[]
}

export interface SessionQuery {
  tab: SessionTab
  q: string
  date: DateFilter
  customFrom: string
  customTo: string
  status: BookingStatusFilter
  tutorId: string
  kind: SessionKindFilter
  courseId: string
  studentId: string
  sort: SessionSort
}

const NOTES_KEY = 'learnsyra_admin_session_notes'
const PAGE_SIZE = 20

export { formatWhen, paginate }

export function sessionsPageSize() {
  return PAGE_SIZE
}

export function isSessionReportingAvailable() {
  return false
}

export function isSessionRescheduleAvailable() {
  return false
}

export function canCancelBooking(row: AdminSessionRow) {
  return row.kind === 'booking' && row.bookingStatus !== 'cancelled' && row.bookingStatus !== 'completed'
}

export function loadSessionNotes(): Record<string, string> {
  return loadAdminStringMap(NOTES_KEY)
}

export function saveSessionNote(sessionId: string, note: string) {
  const map = loadSessionNotes()
  const next = note.trim()
  if (next) map[sessionId] = next
  else delete map[sessionId]
  saveAdminStringMap(NOTES_KEY, map)
}

function isDemoId(id: string) {
  return id.startsWith('demo-')
}

function durationFrom(start: string | null, end: string | null) {
  if (!start || !end) return null
  const ms = +(new Date(end)) - +(new Date(start))
  if (!Number.isFinite(ms) || ms <= 0) return null
  return Math.round(ms / 60000)
}

export function bookingStatusLabel(status: string | null) {
  if (status === 'pending') return 'Booked'
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'completed') return 'Completed'
  return 'Unavailable'
}

export function liveStateLabel(status: string | null) {
  if (status === 'scheduled') return 'Not Started'
  if (status === 'live') return 'Live'
  if (status === 'ended') return 'Ended'
  return 'Unavailable'
}

export function whenLabel(row: AdminSessionRow) {
  if (row.startAt) return formatWhen(row.startAt)
  return `Booked ${formatWhen(row.bookedAt)}`
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function inDateFilter(iso: string, query: SessionQuery, now: Date) {
  if (query.date === 'any') return true
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  if (query.date === 'today') return t >= today.getTime() && t < tomorrow.getTime()
  if (query.date === 'tomorrow') return t >= tomorrow.getTime() && t < addDays(tomorrow, 1).getTime()
  if (query.date === 'week') {
    const day = today.getDay()
    const weekStart = addDays(today, -day)
    return t >= weekStart.getTime() && t < addDays(weekStart, 7).getTime()
  }
  if (query.date === 'next7') return t >= today.getTime() && t < addDays(today, 7).getTime()
  if (query.date === 'past7') return t >= addDays(today, -7).getTime() && t < today.getTime()
  if (query.date === 'custom') {
    if (query.customFrom) {
      const from = startOfDay(new Date(query.customFrom)).getTime()
      if (t < from) return false
    }
    if (query.customTo) {
      const to = addDays(startOfDay(new Date(query.customTo)), 1).getTime()
      if (t >= to) return false
    }
    return true
  }
  return true
}

function stamp(row: AdminSessionRow) {
  return row.startAt || row.bookedAt
}

async function loadBookingsRaw(): Promise<{ rows: BookingRaw[]; available: boolean }> {
  if (!isSupabaseConfigured) return { rows: [], available: false }
  const { data, error } = await supabase
    .from('bookings')
    .select('id, student_id, tutor_listing_id, message, status, created_at')
    .order('created_at', { ascending: false })
  if (error) return { rows: [], available: false }
  return { rows: (data as BookingRaw[]) ?? [], available: true }
}

async function loadAttendance(): Promise<{ rows: { classId: string; studentId: string }[]; available: boolean }> {
  if (!isSupabaseConfigured) return { rows: [], available: false }
  const { data, error } = await supabase.from('live_class_attendance').select('class_id, student_id')
  if (error) return { rows: [], available: false }
  return {
    rows: ((data as { class_id: string; student_id: string }[]) ?? []).map(r => ({ classId: r.class_id, studentId: r.student_id })),
    available: true,
  }
}

function fromBooking(b: BookingRaw, listings: TutorListing[], profiles: ProfileLite[]): AdminSessionRow {
  const listing = b.tutor_listing_id ? listings.find(l => l.id === b.tutor_listing_id) : null
  const tutor = listing?.profile_id ? profiles.find(p => p.id === listing.profile_id) : null
  const student = profiles.find(p => p.id === b.student_id)
  const topic = b.message?.split('\n')[0]?.trim() || listing?.expertise || 'Tutor booking'
  return {
    routeId: `b-${b.id}`,
    sourceId: b.id,
    kind: 'booking',
    typeLabel: 'Tutor booking',
    title: topic,
    bookingStatus: b.status,
    liveStatus: null,
    bookedAt: b.created_at,
    startAt: null,
    endAt: null,
    durationMin: null,
    tutorId: listing?.profile_id ?? null,
    tutorName: tutor?.full_name || listing?.name || 'Unnamed tutor',
    tutorHeadline: tutor?.headline ?? listing?.expertise ?? null,
    studentId: b.student_id,
    studentName: student?.full_name || 'Unnamed student',
    courseId: null,
    courseTitle: null,
    goal: b.message?.trim() || null,
    demo: isDemoId(b.id) || isDemoId(b.student_id),
  }
}

function fromLive(c: LiveClass, profiles: ProfileLite[]): AdminSessionRow {
  const tutor = profiles.find(p => p.id === c.tutor_id)
  return {
    routeId: `l-${c.id}`,
    sourceId: c.id,
    kind: 'live-class',
    typeLabel: 'Live class',
    title: c.title,
    bookingStatus: null,
    liveStatus: c.status,
    bookedAt: c.created_at,
    startAt: c.starts_at || null,
    endAt: c.ended_at,
    durationMin: durationFrom(c.starts_at, c.ended_at),
    tutorId: c.tutor_id,
    tutorName: tutor?.full_name || c.tutor?.full_name || 'Unnamed tutor',
    tutorHeadline: tutor?.headline ?? null,
    studentId: null,
    studentName: null,
    courseId: c.course_id,
    courseTitle: c.course?.title ?? null,
    goal: c.description?.trim() || null,
    demo: isDemoId(c.id),
  }
}

export async function loadAdminSessionIndex(): Promise<AdminSessionIndex> {
  const [profiles, listings, bookingPack, livePack, attendPack] = await Promise.all([
    getAllProfiles().catch(() => [] as ProfileLite[]),
    getTutorListings().catch(() => [] as TutorListing[]),
    loadBookingsRaw(),
    getLiveClasses()
      .then(rows => ({ rows: isSupabaseConfigured ? rows : [], available: isSupabaseConfigured }))
      .catch(() => ({ rows: [] as LiveClass[], available: false })),
    loadAttendance(),
  ])
  const attendance = attendPack.available
    ? attendPack.rows.map(r => ({
        classId: r.classId,
        studentId: r.studentId,
        studentName: profiles.find(p => p.id === r.studentId)?.full_name || 'Unnamed student',
      }))
    : []
  return {
    rows: [
      ...bookingPack.rows.map(b => fromBooking(b, listings, profiles)),
      ...livePack.rows.map(c => fromLive(c, profiles)),
    ],
    attendance,
    bookingsAvailable: bookingPack.available,
    liveAvailable: livePack.available,
    attendanceAvailable: attendPack.available,
    profiles,
  }
}

export function sessionStats(index: AdminSessionIndex) {
  const real = index.rows.filter(r => !r.demo)
  const now = Date.now()
  const upcoming = real.filter(r => r.kind === 'live-class' && r.liveStatus === 'scheduled' && r.startAt && +(new Date(r.startAt)) >= now)
  return {
    total: index.bookingsAvailable || index.liveAvailable ? String(real.length) : '—',
    upcoming: index.liveAvailable ? String(upcoming.length) : '—',
    liveNow: index.liveAvailable ? String(real.filter(r => r.liveStatus === 'live').length) : '—',
    completed: index.bookingsAvailable || index.liveAvailable
      ? String(real.filter(r => r.bookingStatus === 'completed' || r.liveStatus === 'ended').length)
      : '—',
    cancelled: index.bookingsAvailable ? String(real.filter(r => r.bookingStatus === 'cancelled').length) : '—',
    needsAttention: index.bookingsAvailable ? String(real.filter(r => r.bookingStatus === 'pending').length) : '—',
  }
}

export function filterSessions(rows: AdminSessionRow[], query: SessionQuery, index: Pick<AdminSessionIndex, 'bookingsAvailable' | 'liveAvailable'>) {
  const q = query.q.trim().toLowerCase()
  const now = new Date()
  let list = rows
  if (query.tab === 'upcoming') {
    if (!index.liveAvailable) list = []
    else list = list.filter(r => r.kind === 'live-class' && r.liveStatus === 'scheduled' && r.startAt && +(new Date(r.startAt)) >= now.getTime())
  } else if (query.tab === 'live') {
    list = index.liveAvailable ? list.filter(r => r.liveStatus === 'live') : []
  } else if (query.tab === 'completed') {
    list = list.filter(r => r.bookingStatus === 'completed' || r.liveStatus === 'ended')
  } else if (query.tab === 'cancelled') {
    list = index.bookingsAvailable ? list.filter(r => r.bookingStatus === 'cancelled') : []
  } else if (query.tab === 'attention') {
    list = index.bookingsAvailable ? list.filter(r => r.bookingStatus === 'pending') : []
  }
  if (query.status !== 'all') list = list.filter(r => r.bookingStatus === query.status)
  if (query.tutorId) list = list.filter(r => r.tutorId === query.tutorId)
  if (query.kind !== 'all') list = list.filter(r => r.kind === query.kind)
  if (query.courseId) list = list.filter(r => r.courseId === query.courseId)
  if (query.studentId) list = list.filter(r => r.studentId === query.studentId)
  list = list.filter(r => inDateFilter(stamp(r), query, now))
  if (q) {
    list = list.filter(r =>
      r.routeId.toLowerCase().includes(q) ||
      r.sourceId.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.typeLabel.toLowerCase().includes(q) ||
      r.tutorName.toLowerCase().includes(q) ||
      (r.studentName && r.studentName.toLowerCase().includes(q)) ||
      (r.courseTitle && r.courseTitle.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list]
  if (query.sort === 'newest') sorted.sort((a, b) => +(new Date(b.bookedAt)) - +(new Date(a.bookedAt)))
  else if (query.sort === 'oldest') sorted.sort((a, b) => +(new Date(a.bookedAt)) - +(new Date(b.bookedAt)))
  else if (query.sort === 'soonest') sorted.sort((a, b) => +(new Date(stamp(a))) - +(new Date(stamp(b))))
  else if (query.sort === 'latest') sorted.sort((a, b) => +(new Date(stamp(b))) - +(new Date(stamp(a))))
  else if (query.sort === 'longest') sorted.sort((a, b) => (b.durationMin ?? -1) - (a.durationMin ?? -1))
  else if (query.sort === 'shortest') sorted.sort((a, b) => (a.durationMin ?? 1e9) - (b.durationMin ?? 1e9))
  else {
    sorted.sort((a, b) => {
      const live = Number(b.liveStatus === 'live') - Number(a.liveStatus === 'live')
      if (live) return live
      const pend = Number(b.bookingStatus === 'pending') - Number(a.bookingStatus === 'pending')
      if (pend) return pend
      return +(new Date(stamp(b))) - +(new Date(stamp(a)))
    })
  }
  return sorted
}

export function uniqueSessionTutors(rows: AdminSessionRow[]) {
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.tutorId) map.set(r.tutorId, r.tutorName)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function uniqueSessionStudents(rows: AdminSessionRow[]) {
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.studentId && r.studentName) map.set(r.studentId, r.studentName)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function uniqueSessionCourses(rows: AdminSessionRow[]) {
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.courseId && r.courseTitle) map.set(r.courseId, r.courseTitle)
  }
  return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title))
}

export function hasDuration(rows: AdminSessionRow[]) {
  return rows.some(r => r.durationMin != null)
}

export function timeline(row: AdminSessionRow) {
  const out: { id: string; label: string; at: string }[] = []
  if (row.bookedAt) out.push({ id: 'booked', label: row.kind === 'live-class' ? 'Created' : 'Booked', at: row.bookedAt })
  if (row.startAt && (row.liveStatus === 'live' || row.liveStatus === 'ended' || row.liveStatus === 'scheduled')) {
    out.push({ id: 'starts', label: row.liveStatus === 'scheduled' ? 'Scheduled start' : 'Started', at: row.startAt })
  }
  if (row.endAt) out.push({ id: 'ended', label: 'Ended', at: row.endAt })
  return out
}

export async function cancelAdminBooking(sourceId: string) {
  const { error } = await setBookingStatus(sourceId, 'cancelled')
  if (error) return { ok: false, message: error }
  return {
    ok: true,
    message: 'Booking cancelled using the existing booking status API. The student, tutor, and payment records were not deleted. Refunds are not issued from this screen.',
  }
}

export function attendanceFor(index: AdminSessionIndex, classId: string) {
  return index.attendance.filter(a => a.classId === classId)
}
