import { supabase, isSupabaseConfigured } from './supabase'
import {
  getAllCoursesAdmin,
  getAllProfiles,
  getLiveClasses,
  getProjects,
  getReviewQueue,
  type CourseRow,
  type ProfileLite,
} from './api'

export type AdminRange = '7d' | '30d' | '3m' | '6m' | '1y' | 'custom'

export interface AdminBookingLite {
  id: string
  status: string
  created_at: string
}

export interface GrowthPoint {
  label: string
  students: number
  tutors: number
  courses: number
  sessions: number
}

export interface ActivityItem {
  id: string
  label: string
  at: string
}

export interface AdminInsight {
  id: string
  observation: string
  basedOn: string
  href: string
  actionLabel: string
}

export interface AdminOverview {
  users: number
  students: number
  tutors: number
  publishedCourses: number
  pendingCourses: number
  activeSessions: number
  pendingReviews: number
  pendingVerification: number | null
  revenueAvailable: false
  profiles: ProfileLite[]
  courses: CourseRow[]
  bookings: AdminBookingLite[]
  growth: GrowthPoint[]
  activity: ActivityItem[]
  insights: AdminInsight[]
}

const DISMISS_KEY = 'learnsyra_admin_insights_dismissed'

export function adminWindow(range: AdminRange, custom?: { from: string; to: string }) {
  if (range === 'custom' && custom?.from && custom?.to) {
    return { from: new Date(custom.from), to: new Date(custom.to + 'T23:59:59') }
  }
  const to = new Date()
  const from = new Date()
  if (range === '7d') from.setDate(to.getDate() - 7)
  else if (range === '30d') from.setDate(to.getDate() - 30)
  else if (range === '3m') from.setMonth(to.getMonth() - 3)
  else if (range === '6m') from.setMonth(to.getMonth() - 6)
  else from.setFullYear(to.getFullYear() - 1)
  return { from, to }
}

function inRange(iso: string | null | undefined, from: Date, to: Date) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= from.getTime() && t <= to.getTime()
}

export function loadDismissedInsights(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveDismissedInsights(ids: string[]) {
  localStorage.setItem(DISMISS_KEY, JSON.stringify(ids.slice(0, 80)))
}

async function loadBookings(): Promise<AdminBookingLite[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('bookings').select('id, status, created_at').order('created_at', { ascending: false })
  if (error) return []
  return (data as AdminBookingLite[]) ?? []
}

function bucketKey(d: Date, monthly: boolean) {
  return monthly ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function bucketLabel(d: Date, monthly: boolean) {
  return monthly
    ? d.toLocaleDateString('en-IN', { month: 'short' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function buildGrowth(
  profiles: ProfileLite[],
  courses: CourseRow[],
  bookings: AdminBookingLite[],
  from: Date,
  to: Date,
  monthly: boolean,
): GrowthPoint[] {
  const map = new Map<string, GrowthPoint>()
  const add = (iso: string | undefined, field: 'students' | 'tutors' | 'courses' | 'sessions') => {
    if (!inRange(iso, from, to)) return
    const d = new Date(iso!)
    const key = bucketKey(d, monthly)
    const cur = map.get(key) || { label: bucketLabel(d, monthly), students: 0, tutors: 0, courses: 0, sessions: 0 }
    cur[field] += 1
    map.set(key, cur)
  }
  for (const p of profiles) {
    if (p.role === 'student') add(p.created_at, 'students')
    if (p.role === 'tutor') add(p.created_at, 'tutors')
  }
  for (const c of courses) add(c.created_at, 'courses')
  for (const b of bookings) add(b.created_at, 'sessions')
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([, v]) => v)
}

function buildActivity(
  profiles: ProfileLite[],
  courses: CourseRow[],
  bookings: AdminBookingLite[],
  reviews: { id: string; submitted_at: string | null; status: string }[],
): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const p of profiles) {
    if (!p.created_at) continue
    if (p.role === 'student') items.push({ id: `u-${p.id}`, label: `New student${p.full_name ? `: ${p.full_name}` : ''}`, at: p.created_at })
    if (p.role === 'tutor') items.push({ id: `t-${p.id}`, label: `New tutor${p.full_name ? `: ${p.full_name}` : ''}`, at: p.created_at })
  }
  for (const c of courses) {
    items.push({ id: `c-${c.id}`, label: c.published ? `Course live: ${c.title}` : `Course submitted: ${c.title}`, at: c.created_at })
  }
  for (const b of bookings) {
    if (b.status === 'completed') items.push({ id: `b-${b.id}`, label: 'Session completed', at: b.created_at })
  }
  for (const r of reviews) {
    if (r.submitted_at) items.push({ id: `p-${r.id}`, label: r.status === 'completed' ? 'Project review completed' : 'Project submitted', at: r.submitted_at })
  }
  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 12)
}

function buildInsights(input: {
  pendingCourses: number
  tutors: ProfileLite[]
  bookings: AdminBookingLite[]
  from: Date
  to: Date
}): AdminInsight[] {
  const out: AdminInsight[] = []
  const queued = input.pendingCourses
  if (queued > 0) {
    out.push({
      id: 'course-queue',
      observation: `Course review queue currently has ${queued} unpublished course${queued === 1 ? '' : 's'}.`,
      basedOn: 'Unpublished rows in the courses catalog.',
      href: '/admin/courses',
      actionLabel: 'Review Courses',
    })
  }
  const periodTutors = input.tutors.filter(t => inRange(t.created_at, input.from, input.to))
  if (periodTutors.length >= 2) {
    out.push({
      id: 'new-tutors',
      observation: `${periodTutors.length} new tutors joined in the selected period.`,
      basedOn: 'Tutor profiles created in the selected date range.',
      href: '/admin/tutors',
      actionLabel: 'View Tutors',
    })
  }
  const evening = input.bookings.filter(b => {
    const h = new Date(b.created_at).getHours()
    return h >= 17 && h <= 21
  }).length
  if (evening >= 3 && evening >= input.bookings.length / 2) {
    out.push({
      id: 'evening-demand',
      observation: 'Session demand is highest during evening hours among recorded bookings.',
      basedOn: `${evening} of ${input.bookings.length} bookings created between 5 PM and 9 PM.`,
      href: '/admin/sessions',
      actionLabel: 'View Sessions',
    })
  }
  return out
}

export async function loadAdminOverview(range: AdminRange, custom?: { from: string; to: string }): Promise<AdminOverview> {
  const win = adminWindow(range, custom)
  const monthly = range === '3m' || range === '6m' || range === '1y'
  const [profiles, courses, bookings, reviews, live] = await Promise.all([
    getAllProfiles().catch(() => [] as ProfileLite[]),
    getAllCoursesAdmin().catch(() => [] as CourseRow[]),
    loadBookings(),
    getReviewQueue().catch(() => []),
    getLiveClasses().catch(() => []),
  ])
  const students = profiles.filter(p => p.role === 'student').length
  const tutors = profiles.filter(p => p.role === 'tutor')
  const publishedCourses = courses.filter(c => c.published).length
  const pendingCourses = courses.filter(c => !c.published).length
  const activeSessions = live.filter(c => c.status === 'live').length + bookings.filter(b => b.status === 'confirmed').length
  const pendingReviews = reviews.filter(r => r.status === 'submitted').length
  const pendingVerification = null
  return {
    users: profiles.length,
    students,
    tutors: tutors.length,
    publishedCourses,
    pendingCourses,
    activeSessions,
    pendingReviews,
    pendingVerification,
    revenueAvailable: false,
    profiles,
    courses,
    bookings,
    growth: buildGrowth(profiles, courses, bookings, win.from, win.to, monthly),
    activity: buildActivity(profiles, courses, bookings, reviews),
    insights: buildInsights({
      pendingCourses,
      tutors,
      bookings: bookings.filter(b => inRange(b.created_at, win.from, win.to)),
      from: win.from,
      to: win.to,
    }),
  }
}

export async function loadAdminProjects() {
  const [queue, projects] = await Promise.all([
    getReviewQueue().catch(() => []),
    getProjects().catch(() => []),
  ])
  return { queue, projects }
}
