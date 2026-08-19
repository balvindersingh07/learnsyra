import { getAllCoursesAdmin, getAllProfiles, getProjects, getTutorListings, type CourseRow, type ProfileLite, type ProjectRow, type TutorListing } from './api'
import { formatWhen } from './adminUsers'
import { loadAdminPaymentIndex } from './adminPayments'
import { loadAdminProjectIndex, type AdminStudentBuild } from './adminProjects'
import { loadAdminReportIndex, reportStats } from './adminReports'
import { loadAdminSessionIndex, type AdminSessionRow } from './adminSessions'
import { isVerificationBackendAvailable } from './adminVerification'
import { adminWindow, type AdminRange } from './adminPlatform'
import { isSupabaseConfigured, supabase } from './supabase'

export type { AdminRange }

export interface MetricCard {
  label: string
  value: string
  hint: string
  delta: string | null
}

export interface GrowthPoint {
  label: string
  students: number
  tutors: number
  total: number
}

export interface SessionPoint {
  label: string
  upcoming: number
  completed: number
  cancelled: number
}

export interface ActivityPoint {
  label: string
  enrollments: number
  starts: number
  submissions: number
}

export interface NamedCount {
  id: string
  name: string
  count: number
}

export interface AnalyticsInsight {
  id: string
  insight: string
  evidence: string
  actionLabel: string
  href: string
}

export interface ActivityItem {
  id: string
  label: string
  at: string
}

export interface AdminAnalytics {
  periodLabel: string
  overview: MetricCard[]
  periodUsers: MetricCard[]
  growth: GrowthPoint[]
  growthAvailable: boolean
  distribution: { students: number; tutors: number; admins: number } | null
  activeUsersNote: string
  learning: MetricCard[]
  lessonActivity: string
  courseCompletion: string
  courses: MetricCard[]
  topCourses: NamedCount[]
  courseReviews: { count: string; average: string }
  projects: MetricCard[]
  projectCompletion: string
  projectActivity: ActivityPoint[]
  projectChartAvailable: boolean
  sessions: MetricCard[]
  sessionChart: SessionPoint[]
  sessionChartAvailable: boolean
  duration: string
  attendance: string
  marketplace: MetricCard[]
  marketplaceExtra: string
  topTutors: NamedCount[]
  career: MetricCard[]
  hiringNote: string
  finance: { available: boolean; summary: string }
  reports: { available: boolean; summary: string; open: string; resolved: string }
  verification: { available: boolean; summary: string }
  insights: AnalyticsInsight[]
  health: { name: string; status: string }[]
  exportNote: string
  activity: ActivityItem[]
  activityNote: string
  demoExcluded: boolean
  failed: string[]
}

const RANGE_LABEL: Record<Exclude<AdminRange, 'custom'>, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '3m': '3 months',
  '6m': '6 months',
  '1y': '1 year',
}

export { adminWindow, formatWhen }

export function selectedPeriodLabel(range: AdminRange, custom?: { from: string; to: string }) {
  if (range === 'custom' && custom?.from && custom?.to) return `${custom.from} to ${custom.to}`
  if (range === 'custom') return 'Custom range'
  return RANGE_LABEL[range]
}

function isDemo(id: string | null | undefined) {
  return !!id && id.startsWith('demo-')
}

function inRange(iso: string | null | undefined, from: Date, to: Date) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= from.getTime() && t <= to.getTime()
}

function previousWindow(from: Date, to: Date) {
  const span = Math.max(0, to.getTime() - from.getTime())
  const prevTo = new Date(from.getTime() - 1)
  return { from: new Date(prevTo.getTime() - span), to: prevTo }
}

function pctDelta(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return 'Comparison unavailable'
  const pct = ((current - previous) / previous) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function num(n: number) {
  return n.toLocaleString('en-IN')
}

function card(label: string, value: string, hint: string, delta: string | null = null): MetricCard {
  return { label, value, hint, delta }
}

function dash(label: string, hint: string, delta: string | null = null): MetricCard {
  return card(label, '—', hint, delta)
}

async function settled<T>(label: string, task: Promise<T>, fallback: T, failed: string[]): Promise<T> {
  try {
    return await task
  } catch {
    failed.push(label)
    return fallback
  }
}

async function probe<T>(table: string, select: string): Promise<{ available: boolean; rows: T[] }> {
  if (!isSupabaseConfigured) return { available: false, rows: [] }
  const { data, error } = await supabase.from(table).select(select)
  if (error) return { available: false, rows: [] }
  return { available: true, rows: ((data as T[]) ?? []) }
}

function bucketKey(d: Date, monthly: boolean) {
  return monthly ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function bucketLabel(d: Date, monthly: boolean) {
  return monthly
    ? d.toLocaleDateString('en-IN', { month: 'short' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function addBucket<T extends { label: string }>(map: Map<string, T>, iso: string | null | undefined, from: Date, to: Date, monthly: boolean, make: (label: string) => T, bump: (row: T) => void) {
  if (!inRange(iso, from, to)) return
  const d = new Date(iso!)
  const key = bucketKey(d, monthly)
  const cur = map.get(key) || make(bucketLabel(d, monthly))
  bump(cur)
  map.set(key, cur)
}

function sessionStamp(row: AdminSessionRow) {
  return row.startAt || row.bookedAt
}

export async function getAdminAnalytics(range: AdminRange, custom?: { from: string; to: string }): Promise<AdminAnalytics> {
  const win = adminWindow(range, custom)
  const prev = previousWindow(win.from, win.to)
  const monthly = range === '3m' || range === '6m' || range === '1y'
  const periodHint = `Selected period · ${selectedPeriodLabel(range, custom)}`
  const failed: string[] = []

  const [profiles, courses, catalog, listings, enrollPack, reviewPack, sessions, projects, payments, reports] = await Promise.all([
    settled('profiles', getAllProfiles(), [] as ProfileLite[], failed),
    settled('courses', getAllCoursesAdmin(), [] as CourseRow[], failed),
    settled('projects', getProjects(), [] as ProjectRow[], failed),
    settled('listings', getTutorListings(), [] as TutorListing[], failed),
    probe<{ id: string; student_id: string; course_id: string; enrolled_at: string }>('enrollments', 'id, student_id, course_id, enrolled_at'),
    probe<{ id: string; course_id: string; rating: number; created_at: string }>('course_reviews', 'id, course_id, rating, created_at'),
    settled('sessions', loadAdminSessionIndex(), null, failed),
    settled('student_projects', loadAdminProjectIndex(), null, failed),
    settled('payments', loadAdminPaymentIndex(), null, failed),
    settled('reports', loadAdminReportIndex(), null, failed),
  ])

  const realProfiles = profiles.filter(p => !isDemo(p.id))
  const realCourses = courses.filter(c => !isDemo(c.id))
  const realCatalog = catalog.filter(p => !isDemo(p.id))
  const realListings = listings.filter(l => !isDemo(l.id))
  const enrollments = enrollPack.available ? enrollPack.rows.filter(e => !isDemo(e.id) && !isDemo(e.student_id) && !isDemo(e.course_id)) : []
  const reviews = reviewPack.available ? reviewPack.rows.filter(r => !isDemo(r.id) && !isDemo(r.course_id)) : []
  const sessionRows = sessions ? sessions.rows.filter(r => !r.demo) : []
  const builds: AdminStudentBuild[] = projects?.buildsAvailable ? projects.builds.filter(b => !b.demo) : []
  const demoExcluded = profiles.some(p => isDemo(p.id)) || courses.some(c => isDemo(c.id)) || catalog.some(p => isDemo(p.id)) || sessionRows.length !== (sessions?.rows.length ?? 0)

  const students = realProfiles.filter(p => p.role === 'student')
  const tutors = realProfiles.filter(p => p.role === 'tutor')
  const admins = realProfiles.filter(p => p.role === 'admin')
  const hasProfileTs = realProfiles.some(p => p.created_at)
  const profilesOk = !failed.includes('profiles')
  const coursesOk = !failed.includes('courses')
  const catalogOk = !failed.includes('projects')

  const newStudents = hasProfileTs ? students.filter(p => inRange(p.created_at, win.from, win.to)).length : null
  const newTutors = hasProfileTs ? tutors.filter(p => inRange(p.created_at, win.from, win.to)).length : null
  const newUsers = hasProfileTs ? realProfiles.filter(p => inRange(p.created_at, win.from, win.to)).length : null
  const prevStudents = hasProfileTs ? students.filter(p => inRange(p.created_at, prev.from, prev.to)).length : null
  const prevTutors = hasProfileTs ? tutors.filter(p => inRange(p.created_at, prev.from, prev.to)).length : null
  const prevUsers = hasProfileTs ? realProfiles.filter(p => inRange(p.created_at, prev.from, prev.to)).length : null

  const periodEnroll = enrollPack.available ? enrollments.filter(e => inRange(e.enrolled_at, win.from, win.to)).length : null
  const prevEnroll = enrollPack.available ? enrollments.filter(e => inRange(e.enrolled_at, prev.from, prev.to)).length : null
  const starts = projects?.buildsAvailable ? builds.filter(b => inRange(b.createdAt, win.from, win.to)).length : null
  const prevStarts = projects?.buildsAvailable ? builds.filter(b => inRange(b.createdAt, prev.from, prev.to)).length : null
  const submissions = projects?.buildsAvailable ? builds.filter(b => inRange(b.submittedAt, win.from, win.to)).length : null
  const completedBuilds = projects?.buildsAvailable ? builds.filter(b => b.status === 'completed' && inRange(b.submittedAt || b.createdAt, win.from, win.to)).length : null
  const activeBuilds = projects?.buildsAvailable ? builds.filter(b => b.status === 'started').length : null
  const lifetimeCompleted = projects?.buildsAvailable ? builds.filter(b => b.status === 'completed').length : null
  const lifetimeStarts = projects?.buildsAvailable ? builds.length : null

  const sessionsOk = !!(sessions && (sessions.bookingsAvailable || sessions.liveAvailable))
  const periodSessions = sessionsOk ? sessionRows.filter(r => inRange(sessionStamp(r), win.from, win.to)) : []
  const bookings = sessionRows.filter(r => r.kind === 'booking')
  const live = sessionRows.filter(r => r.kind === 'live-class')
  const periodBookings = periodSessions.filter(r => r.kind === 'booking')
  const confirmed = bookings.filter(r => r.bookingStatus === 'confirmed').length
  const completedSessions = sessionRows.filter(r => r.bookingStatus === 'completed' || r.liveStatus === 'ended').length
  const cancelled = bookings.filter(r => r.bookingStatus === 'cancelled').length
  const overview: MetricCard[] = [
    profilesOk ? card('Total Users', num(realProfiles.length), 'Lifetime') : dash('Total Users', 'Lifetime'),
    profilesOk ? card('Students', num(students.length), 'Lifetime') : dash('Students', 'Lifetime'),
    profilesOk ? card('Tutors', num(tutors.length), 'Lifetime') : dash('Tutors', 'Lifetime'),
    coursesOk ? card('Courses', num(realCourses.length), 'Lifetime') : dash('Courses', 'Lifetime'),
    catalogOk ? card('Projects', num(realCatalog.length), 'Lifetime catalog') : dash('Projects', 'Lifetime catalog'),
    sessionsOk ? card('Sessions', num(sessionRows.length), 'Lifetime bookings + live classes') : dash('Sessions', 'Lifetime'),
  ]

  const periodUsers: MetricCard[] = [
    newUsers == null ? dash('New users', periodHint, 'Comparison unavailable') : card('New users', num(newUsers), periodHint, pctDelta(newUsers, prevUsers ?? 0)),
    newStudents == null ? dash('New students', periodHint, 'Comparison unavailable') : card('New students', num(newStudents), periodHint, pctDelta(newStudents, prevStudents ?? 0)),
    newTutors == null ? dash('New tutors', periodHint, 'Comparison unavailable') : card('New tutors', num(newTutors), periodHint, pctDelta(newTutors, prevTutors ?? 0)),
  ]

  const growthMap = new Map<string, GrowthPoint>()
  if (hasProfileTs) {
    for (const p of realProfiles) {
      addBucket(growthMap, p.created_at, win.from, win.to, monthly, label => ({ label, students: 0, tutors: 0, total: 0 }), row => {
        row.total += 1
        if (p.role === 'student') row.students += 1
        if (p.role === 'tutor') row.tutors += 1
      })
    }
  }
  const growth = [...growthMap.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([, v]) => v)

  const enrollMap = new Map<string, number>()
  if (enrollPack.available) {
    for (const e of enrollments) {
      if (!inRange(e.enrolled_at, win.from, win.to)) continue
      const d = new Date(e.enrolled_at)
      const key = bucketKey(d, monthly)
      enrollMap.set(key, (enrollMap.get(key) || 0) + 1)
    }
  }
  const projectMap = new Map<string, ActivityPoint>()
  if (projects?.buildsAvailable) {
    for (const b of builds) {
      addBucket(projectMap, b.createdAt, win.from, win.to, monthly, label => ({ label, enrollments: 0, starts: 0, submissions: 0 }), row => { row.starts += 1 })
      addBucket(projectMap, b.submittedAt, win.from, win.to, monthly, label => ({ label, enrollments: 0, starts: 0, submissions: 0 }), row => { row.submissions += 1 })
    }
  }
  for (const [key, count] of enrollMap) {
    const sample = enrollments.find(e => bucketKey(new Date(e.enrolled_at), monthly) === key)
    const label = sample ? bucketLabel(new Date(sample.enrolled_at), monthly) : key
    const cur = projectMap.get(key) || { label, enrollments: 0, starts: 0, submissions: 0 }
    cur.enrollments = count
    projectMap.set(key, cur)
  }
  const projectActivity = [...projectMap.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([, v]) => v)

  const sessionMap = new Map<string, SessionPoint>()
  for (const r of periodSessions) {
    addBucket(sessionMap, sessionStamp(r), win.from, win.to, monthly, label => ({ label, upcoming: 0, completed: 0, cancelled: 0 }), row => {
      if (r.bookingStatus === 'cancelled') row.cancelled += 1
      else if (r.bookingStatus === 'completed' || r.liveStatus === 'ended') row.completed += 1
      else row.upcoming += 1
    })
  }
  const sessionChart = [...sessionMap.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([, v]) => v)

  const courseByEnroll = new Map<string, number>()
  if (enrollPack.available) {
    for (const e of enrollments) courseByEnroll.set(e.course_id, (courseByEnroll.get(e.course_id) || 0) + 1)
  }
  const topCourses = enrollPack.available
    ? realCourses
      .map(c => ({ id: c.id, name: c.title, count: courseByEnroll.get(c.id) || 0 }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5)
    : []

  const reviewAvg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : null
  const tutorBookings = new Map<string, { name: string; count: number }>()
  for (const r of sessionRows.filter(s => s.bookingStatus === 'completed' || s.liveStatus === 'ended')) {
    if (!r.tutorId) continue
    const cur = tutorBookings.get(r.tutorId) || { name: r.tutorName, count: 0 }
    cur.count += 1
    tutorBookings.set(r.tutorId, cur)
  }
  const topTutors = [...tutorBookings.entries()]
    .map(([id, v]) => ({ id, name: v.name, count: v.count }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5)

  const durations = sessionRows.map(r => r.durationMin).filter((n): n is number => n != null && n > 0)
  const publishedListings = realListings.length
  const availableListings = realListings.filter(l => l.available).length
  const periodTutorBookings = periodBookings.length

  const reportIndex = reports
  const rStats = reportIndex ? reportStats(reportIndex) : null
  const verifyOn = isVerificationBackendAvailable()

  const learning: MetricCard[] = [
    periodEnroll == null ? dash('Course enrollments', periodHint, 'Comparison unavailable') : card('Course enrollments', num(periodEnroll), periodHint, pctDelta(periodEnroll, prevEnroll ?? 0)),
    starts == null ? dash('Project starts', periodHint, 'Comparison unavailable') : card('Project starts', num(starts), periodHint, pctDelta(starts, prevStarts ?? 0)),
    submissions == null ? dash('Project submissions', periodHint) : card('Project submissions', num(submissions), periodHint, null),
    completedBuilds == null ? dash('Project completions', periodHint) : card('Project completions', num(completedBuilds), periodHint, null),
  ]

  const projectCompletion = lifetimeStarts != null && lifetimeStarts > 0 && lifetimeCompleted != null
    ? `${((lifetimeCompleted / lifetimeStarts) * 100).toFixed(1)}% of started student projects are completed (lifetime)`
    : 'Project completion data unavailable.'

  const insights: AnalyticsInsight[] = []
  if (periodEnroll != null && prevEnroll != null && prevEnroll > 0 && periodEnroll > prevEnroll) {
    insights.push({
      id: 'enroll-up',
      insight: 'Course enrollments increased during the selected period.',
      evidence: `${num(periodEnroll)} enrollments in the selected period vs ${num(prevEnroll)} in the previous period.`,
      actionLabel: 'Review Course Engagement',
      href: '/admin/courses',
    })
  }
  if (starts != null && submissions != null && starts > submissions) {
    insights.push({
      id: 'proj-gap',
      insight: 'Project submissions are lower than starts.',
      evidence: `${num(starts)} starts and ${num(submissions)} submissions in the selected period.`,
      actionLabel: 'Review Project Completion',
      href: '/admin/projects',
    })
  }
  if (periodSessions.length >= 4) {
    const byDay = new Map<string, number>()
    for (const r of periodSessions) {
      const d = new Date(sessionStamp(r))
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      byDay.set(key, (byDay.get(key) || 0) + 1)
    }
    const ranked = [...byDay.values()].sort((a, b) => b - a)
    const top3 = ranked.slice(0, 3).reduce((s, n) => s + n, 0)
    if (top3 >= periodSessions.length / 2) {
      insights.push({
        id: 'session-days',
        insight: 'Session activity is concentrated in a small number of days.',
        evidence: `${top3} of ${periodSessions.length} recorded sessions fall on the three busiest days in the selected period.`,
        actionLabel: 'Review Session Activity',
        href: '/admin/sessions',
      })
    }
  }
  if (availableListings > 0 && periodTutorBookings === 0 && sessions) {
    insights.push({
      id: 'avail',
      insight: 'Tutor listings are available, and no bookings were recorded in the selected period.',
      evidence: `${num(availableListings)} available tutor listings; ${num(periodTutorBookings)} bookings in the selected period.`,
      actionLabel: 'Review Tutor Availability',
      href: '/admin/tutors',
    })
  }

  const activity: ActivityItem[] = []
  for (const p of realProfiles) {
    if (!inRange(p.created_at, win.from, win.to)) continue
    if (p.role === 'student') activity.push({ id: `u-${p.id}`, label: `New student${p.full_name ? `: ${p.full_name}` : ''}`, at: p.created_at! })
    if (p.role === 'tutor') activity.push({ id: `t-${p.id}`, label: `New tutor${p.full_name ? `: ${p.full_name}` : ''}`, at: p.created_at! })
  }
  for (const c of realCourses) {
    if (!inRange(c.created_at, win.from, win.to)) continue
    activity.push({ id: `c-${c.id}`, label: c.published ? `Course live: ${c.title}` : `Course created: ${c.title}`, at: c.created_at })
  }
  for (const b of builds) {
    const at = b.submittedAt || b.createdAt
    if (!inRange(at, win.from, win.to)) continue
    activity.push({ id: `p-${b.id}`, label: b.status === 'completed' ? 'Student project completed' : b.status === 'submitted' ? 'Project submitted' : 'Project started', at })
  }
  for (const s of periodSessions) {
    activity.push({ id: `s-${s.routeId}`, label: s.bookingStatus === 'completed' || s.liveStatus === 'ended' ? 'Session completed' : s.bookingStatus === 'cancelled' ? 'Session cancelled' : 'Session recorded', at: sessionStamp(s) })
  }
  activity.sort((a, b) => +new Date(b.at) - +new Date(a.at))

  const marketplaceCards: MetricCard[] = profilesOk
    ? [
        card('Tutor accounts', num(tutors.length), 'Lifetime'),
        failed.includes('listings') ? dash('Tutor listings', 'Lifetime') : card('Tutor listings', num(publishedListings), 'Lifetime'),
        failed.includes('listings') ? dash('Available tutors', 'Lifetime') : card('Available tutors', num(availableListings), 'Listings marked available'),
        sessionsOk ? card('Tutor bookings', num(periodBookings.length), periodHint) : dash('Tutor bookings', periodHint),
      ]
    : [dash('Tutor accounts', 'Lifetime'), dash('Tutor listings', 'Lifetime'), dash('Available tutors', 'Lifetime'), dash('Tutor bookings', periodHint)]

  return {
    periodLabel: selectedPeriodLabel(range, custom),
    overview,
    periodUsers,
    growth,
    growthAvailable: hasProfileTs,
    distribution: profilesOk ? { students: students.length, tutors: tutors.length, admins: admins.length } : null,
    activeUsersNote: 'Active user data unavailable. LearnSyra does not currently store a reliable last-activity timestamp for platform-wide active users.',
    learning,
    lessonActivity: 'Lesson activity unavailable. Lesson progress is not exposed as a platform-wide admin metric.',
    courseCompletion: 'Course completion data unavailable. Enrollments exist, but a comparable course-completion record is not connected.',
    courses: [
      coursesOk ? card('Total courses', num(realCourses.length), 'Lifetime') : dash('Total courses', 'Lifetime'),
      coursesOk ? card('Published courses', num(realCourses.filter(c => c.published).length), 'Lifetime') : dash('Published courses', 'Lifetime'),
      enrollPack.available ? card('Enrollments', num(enrollments.length), 'Lifetime') : dash('Enrollments', 'Lifetime'),
      reviewPack.available ? card('Course reviews', num(reviews.length), 'Lifetime') : dash('Course reviews', 'Lifetime'),
    ],
    topCourses,
    courseReviews: {
      count: reviewPack.available ? num(reviews.length) : '—',
      average: reviewPack.available && reviewAvg != null ? reviewAvg.toFixed(1) : '—',
    },
    projects: [
      catalogOk ? card('Catalog projects', num(realCatalog.length), 'Lifetime catalog') : dash('Catalog projects', 'Lifetime catalog'),
      starts == null ? dash('Project starts', periodHint) : card('Project starts', num(starts), periodHint, pctDelta(starts, prevStarts ?? 0)),
      activeBuilds == null ? dash('Active builds', 'Lifetime student projects') : card('Active builds', num(activeBuilds), 'Lifetime student projects in progress'),
      submissions == null ? dash('Submissions', periodHint) : card('Submissions', num(submissions), periodHint),
      completedBuilds == null ? dash('Completed projects', periodHint) : card('Completed projects', num(completedBuilds), 'Selected period · student_projects only'),
    ],
    projectCompletion,
    projectActivity,
    projectChartAvailable: projectActivity.length > 0,
    sessions: sessionsOk && sessions
      ? [
          sessions.bookingsAvailable ? card('Bookings', num(bookings.length), 'Lifetime') : dash('Bookings', 'Lifetime'),
          sessions.bookingsAvailable ? card('Confirmed sessions', num(confirmed), 'Lifetime') : dash('Confirmed sessions', 'Lifetime'),
          card('Completed sessions', num(completedSessions), 'Lifetime'),
          sessions.bookingsAvailable ? card('Cancelled sessions', num(cancelled), 'Lifetime') : dash('Cancelled sessions', 'Lifetime'),
          sessions.liveAvailable ? card('Live classes', num(live.length), 'Lifetime') : dash('Live classes', 'Lifetime'),
          card('Sessions in period', num(periodSessions.length), periodHint),
        ]
      : [dash('Bookings', 'Lifetime'), dash('Confirmed sessions', 'Lifetime'), dash('Completed sessions', 'Lifetime'), dash('Cancelled sessions', 'Lifetime'), dash('Live classes', 'Lifetime')],
    sessionChart,
    sessionChartAvailable: sessionChart.length > 0,
    duration: durations.length ? `${Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)} min average for sessions with start and end times` : 'Average duration unavailable.',
    attendance: 'Attendance rate unavailable. Live attendance is not complete enough to calculate a platform rate.',
    marketplace: marketplaceCards,
    marketplaceExtra: 'Profile views, search impressions, and booking conversion are not tracked.',
    topTutors,
    career: [
      dash('Career profiles', 'Lifetime'),
      dash('Interview sessions', 'Lifetime'),
      dash('Career Center usage', periodHint),
      dash('Job recommendation usage', periodHint),
    ],
    hiringNote: 'LearnSyra does not currently have verified hiring outcome data.',
    finance: {
      available: !!payments?.available,
      summary: payments?.available ? `${payments.rows.filter(r => !r.demo).length} ledger rows connected.` : 'Financial analytics unavailable.',
    },
    reports: {
      available: !!reportIndex?.available,
      summary: reportIndex?.available ? 'Reporting records are connected.' : 'Reporting analytics unavailable.',
      open: rStats && reportIndex?.available ? rStats.open : '—',
      resolved: rStats && reportIndex?.available ? rStats.resolved : '—',
    },
    verification: {
      available: verifyOn,
      summary: verifyOn ? 'Verification backend flag is present. Counts remain unset until verification records exist.' : 'Verification analytics unavailable.',
    },
    insights,
    health: ['Database', 'Authentication', 'Courses API', 'Projects API', 'Bookings', 'Live Classes', 'Payments', 'Reports'].map(name => ({ name, status: 'Status unavailable' })),
    exportNote: 'Analytics export will be available when reporting is connected.',
    activity: activity.slice(0, 10),
    activityNote: 'Events derived from recorded users, courses, projects, and sessions. This is not an audit log.',
    demoExcluded,
    failed,
  }
}
