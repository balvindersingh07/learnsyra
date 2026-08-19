import { supabase, isSupabaseConfigured } from './supabase'
import { getAllCoursesAdmin, getAllProfiles, getProjects, getTutorListings, type CourseRow, type ProfileLite, type ProjectRow, type TutorListing } from './api'
import { adminWindow, type AdminRange } from './adminPlatform'

export type UserTab = 'all' | 'students' | 'tutors' | 'suspended'
export type AccountStatus = 'active' | 'suspended'
export type JoinedFilter = 'any' | AdminRange
export type ActivityFilter = 'any' | 'recent' | 'inactive' | 'none'
export type UserSort = 'recommended' | 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'last_active'

export interface AdminEnrollmentLite {
  id: string
  student_id: string
  course_id: string
  progress: number
  enrolled_at: string
}

export interface AdminBookingRow {
  id: string
  student_id: string
  tutor_listing_id: string | null
  status: string
  created_at: string
}

export interface AdminProjectRow {
  id: string
  student_id: string
  project_id: string
  status: string
  submitted_at: string | null
  created_at: string
}

export interface AdminUserRow {
  id: string
  name: string
  role: string
  email: string | null
  avatarUrl: string | null
  headline: string | null
  joinedAt: string | null
  status: AccountStatus
  lastActiveAt: string | null
  courseCount: number
  sessionCount: number
  projectCount: number
  demo: boolean
}

export interface UserActivityEvent {
  id: string
  label: string
  at: string
}

const STATUS_KEY = 'learnsyra_admin_user_status'
const PAGE_SIZE = 20

export function usersPageSize() {
  return PAGE_SIZE
}

export function loadAccountStatus(): Record<string, AccountStatus> {
  try {
    const raw = localStorage.getItem(STATUS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, AccountStatus>) : {}
  } catch {
    return {}
  }
}

export function saveAccountStatus(map: Record<string, AccountStatus>) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(map))
}

export function setAccountStatus(userId: string, status: AccountStatus) {
  const map = loadAccountStatus()
  map[userId] = status
  saveAccountStatus(map)
  return status
}

function inRange(iso: string | null | undefined, from: Date, to: Date) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= from.getTime() && t <= to.getTime()
}

async function loadEnrollments(): Promise<AdminEnrollmentLite[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('enrollments').select('id, student_id, course_id, progress, enrolled_at')
  if (error) return []
  return (data as AdminEnrollmentLite[]) ?? []
}

async function loadBookings(): Promise<AdminBookingRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('bookings').select('id, student_id, tutor_listing_id, status, created_at')
  if (error) return []
  return (data as AdminBookingRow[]) ?? []
}

async function loadProjects(): Promise<AdminProjectRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('student_projects').select('id, student_id, project_id, status, submitted_at, created_at')
  if (error) return []
  return (data as AdminProjectRow[]) ?? []
}

export interface AdminUserIndex {
  profiles: ProfileLite[]
  rows: AdminUserRow[]
  courses: CourseRow[]
  enrollments: AdminEnrollmentLite[]
  bookings: AdminBookingRow[]
  projects: AdminProjectRow[]
  catalog: ProjectRow[]
  listings: TutorListing[]
}

export function isDemoUserId(id: string) {
  return id.startsWith('demo-')
}

export async function loadAdminUserIndex(): Promise<AdminUserIndex> {
  const [profiles, courses, enrollments, bookings, projects, catalog, listings] = await Promise.all([
    getAllProfiles(),
    getAllCoursesAdmin().catch(() => [] as CourseRow[]),
    loadEnrollments(),
    loadBookings(),
    loadProjects(),
    getProjects().catch(() => [] as ProjectRow[]),
    getTutorListings().catch(() => [] as TutorListing[]),
  ])
  const statusMap = loadAccountStatus()
  const listingById = Object.fromEntries(listings.map(l => [l.id, l]))
  const rows = profiles.map(p => toRow(p, { courses, enrollments, bookings, projects, statusMap, listingById }))
  return { profiles, rows, courses, enrollments, bookings, projects, catalog, listings }
}

function latest(...dates: (string | null | undefined)[]) {
  const times = dates.filter(Boolean).map(d => +new Date(d as string)).filter(n => Number.isFinite(n))
  if (!times.length) return null
  return new Date(Math.max(...times)).toISOString()
}

export function bookingsForUser(userId: string, role: string, index: Pick<AdminUserIndex, 'bookings' | 'listings'>): AdminBookingRow[] {
  const listingIds = new Set(index.listings.filter(l => l.profile_id === userId).map(l => l.id))
  return index.bookings.filter(b => {
    if (b.student_id === userId) return true
    return role === 'tutor' && b.tutor_listing_id && listingIds.has(b.tutor_listing_id)
  })
}

function toRow(
  p: ProfileLite,
  ctx: {
    courses: CourseRow[]
    enrollments: AdminEnrollmentLite[]
    bookings: AdminBookingRow[]
    projects: AdminProjectRow[]
    statusMap: Record<string, AccountStatus>
    listingById: Record<string, TutorListing>
  },
): AdminUserRow {
  const ens = ctx.enrollments.filter(e => e.student_id === p.id)
  const taught = ctx.courses.filter(c => c.tutor_id === p.id)
  const listingIds = new Set(
    Object.values(ctx.listingById).filter(l => l.profile_id === p.id).map(l => l.id),
  )
  const books = ctx.bookings.filter(b => b.student_id === p.id || (b.tutor_listing_id && listingIds.has(b.tutor_listing_id)))
  const projs = ctx.projects.filter(r => r.student_id === p.id)
  const lastActiveAt = latest(
    ...ens.map(e => e.enrolled_at),
    ...books.map(b => b.created_at),
    ...projs.map(r => r.submitted_at || r.created_at),
    ...taught.map(c => c.created_at),
  )
  const courseCount = p.role === 'tutor' ? taught.length : ens.length
  return {
    id: p.id,
    name: p.full_name || 'Unnamed',
    role: p.role || 'student',
    email: null,
    avatarUrl: p.avatar_url,
    headline: p.headline ?? null,
    joinedAt: p.created_at ?? null,
    status: ctx.statusMap[p.id] || 'active',
    lastActiveAt,
    courseCount,
    sessionCount: books.length,
    projectCount: projs.length,
    demo: isDemoUserId(p.id),
  }
}

export function userStats(rows: AdminUserRow[], joined: JoinedFilter, custom?: { from: string; to: string }) {
  const win = joined === 'any' || (joined === 'custom' && (!custom?.from || !custom?.to))
    ? adminWindow('7d')
    : adminWindow(joined, custom)
  return {
    total: rows.length,
    students: rows.filter(r => r.role === 'student').length,
    tutors: rows.filter(r => r.role === 'tutor').length,
    active: rows.filter(r => r.status === 'active').length,
    suspended: rows.filter(r => r.status === 'suspended').length,
    newUsers: rows.filter(r => inRange(r.joinedAt, win.from, win.to)).length,
  }
}

export interface UserQuery {
  tab: UserTab
  q: string
  role: 'all' | 'student' | 'tutor'
  status: 'all' | AccountStatus
  joined: JoinedFilter
  custom?: { from: string; to: string }
  activity: ActivityFilter
  sort: UserSort
}

const RECENT_MS = 30 * 86400000

export function filterUsers(rows: AdminUserRow[], query: UserQuery) {
  const q = query.q.trim().toLowerCase()
  const now = Date.now()
  let list = rows
  if (query.tab === 'students') list = list.filter(r => r.role === 'student')
  else if (query.tab === 'tutors') list = list.filter(r => r.role === 'tutor')
  else if (query.tab === 'suspended') list = list.filter(r => r.status === 'suspended')
  if (query.role !== 'all') list = list.filter(r => r.role === query.role)
  if (query.status !== 'all') list = list.filter(r => r.status === query.status)
  if (query.joined !== 'any' && !(query.joined === 'custom' && (!query.custom?.from || !query.custom?.to))) {
    const win = adminWindow(query.joined, query.custom)
    list = list.filter(r => inRange(r.joinedAt, win.from, win.to))
  }
  if (query.activity === 'none') list = list.filter(r => !r.lastActiveAt)
  if (query.activity === 'recent') list = list.filter(r => r.lastActiveAt && now - +new Date(r.lastActiveAt) <= RECENT_MS)
  if (query.activity === 'inactive') list = list.filter(r => r.lastActiveAt && now - +new Date(r.lastActiveAt) > RECENT_MS)
  if (q) {
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.email && r.email.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list]
  if (query.sort === 'newest') sorted.sort((a, b) => +(new Date(b.joinedAt || 0)) - +(new Date(a.joinedAt || 0)))
  else if (query.sort === 'oldest') sorted.sort((a, b) => +(new Date(a.joinedAt || 0)) - +(new Date(b.joinedAt || 0)))
  else if (query.sort === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name))
  else if (query.sort === 'name_desc') sorted.sort((a, b) => b.name.localeCompare(a.name))
  else if (query.sort === 'last_active') {
    sorted.sort((a, b) => +(new Date(b.lastActiveAt || 0)) - +(new Date(a.lastActiveAt || 0)))
  } else {
    sorted.sort((a, b) => {
      const att = Number(b.status === 'suspended') - Number(a.status === 'suspended')
      if (att) return att
      return +(new Date(b.joinedAt || 0)) - +(new Date(a.joinedAt || 0))
    })
  }
  return sorted
}

export function paginate<T>(rows: T[], page: number) {
  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(Math.max(1, page), pages)
  const start = (safe - 1) * PAGE_SIZE
  const slice = rows.slice(start, start + PAGE_SIZE)
  return {
    page: safe,
    pages,
    total,
    slice,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  }
}

export function userEvents(user: AdminUserRow, index: AdminUserIndex): UserActivityEvent[] {
  const out: UserActivityEvent[] = []
  if (user.joinedAt) out.push({ id: 'joined', label: 'Account created', at: user.joinedAt })
  for (const e of index.enrollments.filter(r => r.student_id === user.id)) {
    const course = index.courses.find(c => c.id === e.course_id)
    out.push({ id: `en-${e.id}`, label: `Course enrolled${course ? `: ${course.title}` : ''}`, at: e.enrolled_at })
    if (e.progress >= 100) out.push({ id: `done-${e.id}`, label: `Course completed${course ? `: ${course.title}` : ''}`, at: e.enrolled_at })
  }
  for (const c of index.courses.filter(c => c.tutor_id === user.id && c.published)) {
    out.push({ id: `pub-${c.id}`, label: `Tutor course published: ${c.title}`, at: c.created_at })
  }
  for (const b of bookingsForUser(user.id, user.role, index)) {
    out.push({ id: `bk-${b.id}`, label: b.status === 'completed' ? 'Session completed' : `Session booked (${b.status})`, at: b.created_at })
  }
  for (const p of index.projects.filter(p => p.student_id === user.id)) {
    const title = index.catalog.find(c => c.id === p.project_id)?.title
    if (p.submitted_at) out.push({ id: `ps-${p.id}`, label: `Project submitted${title ? `: ${title}` : ''}`, at: p.submitted_at })
    else out.push({ id: `pst-${p.id}`, label: `Project started${title ? `: ${title}` : ''}`, at: p.created_at })
  }
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at))
}

export function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function roleLabel(role: string) {
  if (role === 'tutor') return 'Tutor'
  if (role === 'admin') return 'Admin'
  return 'Student'
}
