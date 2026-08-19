import type { CourseReview } from './api'
import { chartWindow, formatEarn, formatEarnOrZero, monthCompare, type ChartRange } from './tutorEarnings'
import type { StudioCourse } from './tutorCourses'
import type { TutorSessionView } from './tutorSessions'
import type { TutorStudent } from './tutorStudents'
import type { TutorProjectReview, ReviewExtras } from './tutorProjects'
import type { TutorHub } from './tutorProfile'
import { WEEKDAYS } from './tutorProfile'

export type AnalyticsRange = ChartRange | 'custom'

export interface GrowthInsight {
  id: string
  observation: string
  recommendation: string
  basedOn: string
  href: string
  actionLabel: string
}

export interface FunnelStep {
  label: string
  count: number
}

export interface CoursePerfRow {
  id: string
  title: string
  enrollments: number
  completionPct: number | null
  rating: number | null
  projectCompletionPct: number | null
  revenue: number | null
}

const DISMISS_KEY = (tutorId: string) => `learnsyra_tutor_analytics_dismissed_${tutorId}`
const FILTER_KEY = 'learnsyra_tutor_analytics_filters'

export function analyticsWindow(range: AnalyticsRange, custom?: { from: string; to: string }) {
  if (range === 'custom' && custom?.from && custom?.to) {
    return { from: new Date(custom.from), to: new Date(custom.to + 'T23:59:59') }
  }
  return chartWindow(range === 'custom' ? '30d' : range)
}

export function previousWindow(from: Date, to: Date) {
  const span = to.getTime() - from.getTime()
  return { from: new Date(from.getTime() - span), to: new Date(from.getTime() - 1) }
}

export function inRange(iso: string | null | undefined, from: Date, to: Date) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= from.getTime() && t <= to.getTime()
}

export function loadDismissed(tutorId: string): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY(tutorId))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveDismissed(tutorId: string, ids: string[]) {
  localStorage.setItem(DISMISS_KEY(tutorId), JSON.stringify(ids.slice(0, 80)))
}

export function loadAnalyticsFilters(): Partial<{ range: AnalyticsRange; from: string; to: string }> {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveAnalyticsFilters(next: object) {
  sessionStorage.setItem(FILTER_KEY, JSON.stringify(next))
}

export function realStudents(rows: TutorStudent[], source: 'live' | 'demo') {
  if (source === 'live') return rows.filter(s => !s.demo)
  return rows
}

export function realSessions(rows: TutorSessionView[]) {
  return rows.filter(s => !s.demo && s.status !== 'cancelled')
}

export function completedSessions(rows: TutorSessionView[]) {
  return realSessions(rows).filter(s => s.status === 'completed')
}

export function teachingHours(rows: TutorSessionView[]) {
  const mins = completedSessions(rows).reduce((s, r) => s + (r.duration ?? 0), 0)
  if (!completedSessions(rows).some(r => r.duration != null)) return null
  return Math.round((mins / 60) * 10) / 10
}

export function ratingStats(sessions: TutorSessionView[], reviews: CourseReview[]) {
  const sessionRatings = completedSessions(sessions).map(s => s.rating).filter((n): n is number => n != null && n >= 1 && n <= 5)
  const courseRatings = reviews.map(r => r.rating).filter(n => n >= 1 && n <= 5)
  const all = [...sessionRatings, ...courseRatings]
  if (!all.length) return { average: null as number | null, dist: [0, 0, 0, 0, 0], count: 0 }
  const dist = [1, 2, 3, 4, 5].map(star => all.filter(n => Math.round(n) === star).length)
  const average = Math.round((all.reduce((s, n) => s + n, 0) / all.length) * 10) / 10
  return { average, dist, count: all.length }
}

export function studentProgress(students: TutorStudent[]) {
  const withCourse = students.filter(s => s.courses.length)
  const avgCourse = withCourse.length
    ? Math.round(withCourse.reduce((s, r) => s + r.overallProgress, 0) / withCourse.length)
    : null
  const completedCourse = withCourse.length
    ? Math.round((withCourse.filter(s => s.overallProgress >= 100).length / withCourse.length) * 100)
    : null
  const withProjects = students.filter(s => s.projects.length)
  const projectDone = withProjects.length
    ? Math.round((withProjects.filter(s => s.projects.some(p => /complete|approved|portfolio/i.test(p.status))).length / withProjects.length) * 100)
    : null
  return {
    avgCourse,
    completedCourse,
    projectDone,
    practice: null as number | null,
    quiz: null as number | null,
    sessionActivity: students.filter(s => s.sessions.length).length,
  }
}

export function courseFunnel(students: TutorStudent[]): FunnelStep[] {
  const enroll = students.flatMap(s => s.courses)
  if (!enroll.length) return []
  return [
    { label: 'Enrolled', count: enroll.length },
    { label: 'Started', count: enroll.filter(c => c.progress > 0).length },
    { label: '50% Completed', count: enroll.filter(c => c.progress >= 50).length },
    { label: '75% Completed', count: enroll.filter(c => c.progress >= 75).length },
    { label: 'Completed', count: enroll.filter(c => c.progress >= 100).length },
  ]
}

export function growthBuckets(students: TutorStudent[], from: Date, to: Date, monthly: boolean) {
  const map = new Map<string, { label: string; n: number }>()
  for (const s of students) {
    if (!inRange(s.enrolledAt, from, to)) continue
    const d = new Date(s.enrolledAt)
    const key = monthly ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const label = monthly
      ? d.toLocaleDateString('en-IN', { month: 'short' })
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const cur = map.get(key) || { label, n: 0 }
    cur.n += 1
    map.set(key, cur)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([, v]) => v)
}

export function periodStudentCounts(students: TutorStudent[], from: Date, to: Date) {
  const newStudents = students.filter(s => inRange(s.enrolledAt, from, to)).length
  const active = students.filter(s => s.status === 'active' || s.status === 'attention').length
  const returning = students.filter(s => s.lastActivityAt && inRange(s.lastActivityAt, from, to) && new Date(s.enrolledAt) < from).length
  const completed = students.filter(s => s.status === 'completed').length
  return { newStudents, active, returning, completed }
}

export function sessionBreakdown(rows: TutorSessionView[]) {
  const done = completedSessions(rows)
  const kinds: TutorSessionView['kind'][] = ['1on1', 'project', 'interview', 'career', 'group']
  const labels: Record<TutorSessionView['kind'], string> = {
    '1on1': '1-on-1',
    project: 'Project Help',
    interview: 'Interview Prep',
    career: 'Career Guidance',
    group: 'Group',
  }
  return kinds.map(kind => ({ kind, label: labels[kind], count: done.filter(s => s.kind === kind).length })).filter(r => r.count > 0)
}

export function repeatBookings(rows: TutorSessionView[]) {
  const done = completedSessions(rows).filter(s => s.studentId)
  const byStudent = new Map<string, number>()
  for (const s of done) byStudent.set(s.studentId!, (byStudent.get(s.studentId!) ?? 0) + 1)
  const repeat = [...byStudent.values()].filter(n => n >= 2).length
  return { students: byStudent.size, repeat }
}

export function availabilityInsights(rows: TutorSessionView[], hub: TutorHub | null) {
  const booked = realSessions(rows).filter(s => s.status !== 'cancelled')
  if (booked.length < 2) return null
  const days = new Map<string, number>()
  const hours = new Map<number, number>()
  for (const s of booked) {
    const d = new Date(s.scheduledAt)
    const day = WEEKDAYS[(d.getDay() + 6) % 7]
    days.set(day, (days.get(day) ?? 0) + 1)
    hours.set(d.getHours(), (hours.get(d.getHours()) ?? 0) + 1)
  }
  const topDay = [...days.entries()].sort((a, b) => b[1] - a[1])[0]
  const topHour = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]
  const openDays = hub?.availability.filter(d => d.enabled).map(d => d.day) ?? []
  return {
    topDay: topDay?.[0] ?? null,
    topHour: topHour ? `${topHour[0]}:00` : null,
    booked: booked.length,
    openDays,
  }
}

export function projectOutcomes(reviews: TutorProjectReview[], extras: Record<string, ReviewExtras>) {
  const real = reviews.filter(r => !r.demo)
  const assigned = real.length
  const submitted = real.filter(r => Boolean(r.submittedAt)).length
  const approved = real.filter(r => r.status === 'approved' || r.status === 'portfolio' || extras[r.id]?.status === 'approved' || extras[r.id]?.status === 'portfolio').length
  const portfolio = real.filter(r => r.status === 'portfolio' || extras[r.id]?.status === 'portfolio').length
  const pending = real.filter(r => r.status === 'needs_review' || r.status === 'in_review').length
  const turns = real
    .map(r => {
      const ex = extras[r.id]
      if (!r.submittedAt || !ex?.reviewedAt) return null
      return +new Date(ex.reviewedAt) - +new Date(r.submittedAt)
    })
    .filter((n): n is number => n != null && n >= 0)
  const avgMs = turns.length ? turns.reduce((s, n) => s + n, 0) / turns.length : null
  const fastest = turns.length ? Math.min(...turns) : null
  return {
    assigned,
    submitted,
    approved,
    portfolio,
    pending,
    started: real.filter(r => (r.progress ?? 0) > 0 || Boolean(r.submittedAt)).length,
    avgHours: avgMs != null ? Math.round((avgMs / 3600000) * 10) / 10 : null,
    fastestHours: fastest != null ? Math.round((fastest / 3600000) * 10) / 10 : null,
  }
}

export function coursePerformance(
  courses: StudioCourse[],
  students: TutorStudent[],
  reviews: CourseReview[],
  revenueByCourse: Record<string, number>,
): CoursePerfRow[] {
  return courses.filter(c => !c.demo && c.status === 'published').map(c => {
    const enrolled = students.filter(s => s.courses.some(x => x.id === c.id || x.id === c.apiId || x.title === c.title))
    const completionPct = enrolled.length
      ? Math.round((enrolled.filter(s => s.courses.some(x => (x.id === c.id || x.title === c.title) && x.progress >= 100)).length / enrolled.length) * 100)
      : null
    const courseReviews = reviews.filter(r => r.course_id === c.id || r.course_id === c.apiId)
    const rating = courseReviews.length
      ? Math.round((courseReviews.reduce((s, r) => s + r.rating, 0) / courseReviews.length) * 10) / 10
      : null
    const withProj = enrolled.filter(s => s.projects.length)
    const projectCompletionPct = withProj.length
      ? Math.round((withProj.filter(s => s.projects.some(p => /complete|approved|portfolio/i.test(p.status))).length / withProj.length) * 100)
      : null
    const revenue = revenueByCourse[c.id] ?? revenueByCourse[c.apiId || ''] ?? null
    return {
      id: c.id,
      title: c.title,
      enrollments: enrolled.length,
      completionPct,
      rating,
      projectCompletionPct,
      revenue: revenue && revenue > 0 ? revenue : null,
    }
  })
}

export function contentInsights(students: TutorStudent[], courses: StudioCourse[]) {
  const lessons = students.map(s => s.courses[0]?.lastLessonId).filter(Boolean) as string[]
  if (!lessons.length) return [] as { title: string; count: number }[]
  const counts = new Map<string, number>()
  for (const id of lessons) counts.set(id, (counts.get(id) ?? 0) + 1)
  const titles = new Map<string, string>()
  for (const c of courses) {
    for (const m of c.modules) {
      for (const l of m.lessons) titles.set(l.id, `${m.title} — ${l.title}`)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, count]) => ({ title: titles.get(id) || 'Recorded lesson', count }))
}

export function lowestModule(students: TutorStudent[], courses: StudioCourse[]) {
  const published = courses.find(c => !c.demo && c.status === 'published' && c.modules.length > 1)
  if (!published) return null
  const enrolled = students.filter(s => s.courses.some(x => x.id === published.id || x.title === published.title))
  if (enrolled.length < 3) return null
  const total = published.modules.length
  const bands = published.modules.map((m, i) => {
    const min = Math.round((i / total) * 100)
    const max = Math.round(((i + 1) / total) * 100)
    const here = enrolled.filter(s => {
      const p = s.courses.find(x => x.id === published.id || x.title === published.title)?.progress ?? 0
      return p >= min && p < max
    }).length
    return { title: m.title, here, index: i }
  })
  const hit = [...bands].sort((a, b) => b.here - a.here)[0]
  if (!hit || hit.here < 2) return null
  return { course: published, module: hit.title, stuck: hit.here, id: published.id }
}

export function learningSignal(students: TutorStudent[]) {
  const withPracticeProxy = students.filter(s => s.projects.length)
  const without = students.filter(s => !s.projects.length && s.courses.length)
  if (withPracticeProxy.length < 2 || without.length < 2) return null
  const avgWith = Math.round(withPracticeProxy.reduce((s, r) => s + r.overallProgress, 0) / withPracticeProxy.length)
  const avgWithout = Math.round(without.reduce((s, r) => s + r.overallProgress, 0) / without.length)
  if (avgWith === avgWithout) return null
  return { avgWith, avgWithout }
}

export function coverageLabel(input: { students: number; sessions: number; courses: number; demo: boolean }) {
  if (input.demo) return { level: 'Demo', text: 'Analytics are based on labeled sample context, not live tutor performance.' }
  if (input.students >= 8 && input.sessions >= 10) return { level: 'High', text: `Based on ${input.sessions} completed sessions and ${input.courses} published courses.` }
  if (input.students > 0 || input.sessions > 0 || input.courses > 0) {
    return { level: 'Partial', text: `Based on ${input.sessions} completed sessions and ${input.courses} published courses. Analytics are based on limited activity.` }
  }
  return { level: 'Limited', text: 'Analytics are based on limited activity.' }
}

export function buildInsights(input: {
  students: TutorStudent[]
  sessions: TutorSessionView[]
  courses: StudioCourse[]
  attention: TutorStudent[]
  avail: ReturnType<typeof availabilityInsights>
  reviews: CourseReview[]
}): GrowthInsight[] {
  const out: GrowthInsight[] = []
  const stall = lowestModule(input.students, input.courses)
  if (stall) {
    out.push({
      id: `stall-${stall.id}`,
      observation: `${stall.course.title} has ${stall.stuck} students currently around ${stall.module}.`,
      recommendation: 'Consider adding an intermediate practice task before the next module.',
      basedOn: `${stall.stuck} enrollments with progress in this module band.`,
      href: `/tutor/courses/${stall.id}`,
      actionLabel: 'Open Course',
    })
  }
  const types = sessionBreakdown(input.sessions)
  const top = [...types].sort((a, b) => b.count - a.count)[0]
  if (top && top.count >= 2) {
    out.push({
      id: `type-${top.kind}`,
      observation: `${top.label} sessions are your most frequently completed session type.`,
      recommendation: 'Consider adding more availability during your highest-demand time.',
      basedOn: `${top.count} completed ${top.label} sessions.`,
      href: '/tutor/profile#availability',
      actionLabel: 'Manage Availability',
    })
  }
  const withProjects = input.students.filter(s => s.projects.some(p => /complete|approved|submitted/i.test(p.status)))
  const without = input.students.filter(s => s.courses.length && !s.projects.length)
  if (withProjects.length >= 2 && without.length >= 2) {
    out.push({
      id: 'project-progress',
      observation: 'Students with recorded project work also show course activity on file.',
      recommendation: 'Add a short project checkpoint after an early module.',
      basedOn: `${withProjects.length} students with projects and ${without.length} without.`,
      href: '/tutor/projects',
      actionLabel: 'Review Projects',
    })
  }
  const sameAction = new Map<string, TutorStudent[]>()
  for (const s of input.attention) {
    const key = s.recommendedAction || s.attentionReasons[0] || ''
    if (!key) continue
    sameAction.set(key, [...(sameAction.get(key) ?? []), s])
  }
  const cluster = [...sameAction.values()].sort((a, b) => b.length - a.length)[0]
  if (cluster && cluster.length >= 2) {
    out.push({
      id: 'cluster-attention',
      observation: `${cluster.length} students currently share a similar attention signal.`,
      recommendation: 'Create a shared practice exercise for this concept.',
      basedOn: cluster.map(s => s.name).slice(0, 3).join(', '),
      href: '/tutor/ai',
      actionLabel: 'Open AI Teaching',
    })
  }
  const thin = input.courses.find(c => !c.demo && c.status === 'published' && !c.practices.length && c.modules.length)
  if (thin) {
    out.push({
      id: `practice-${thin.id}`,
      observation: `${thin.title} has no saved practice items in Course Studio.`,
      recommendation: 'Consider adding a practice task or quiz before the next publish.',
      basedOn: 'Course Studio practice list is empty for this course.',
      href: `/tutor/courses/${thin.id}`,
      actionLabel: 'Open Course',
    })
  }
  if (input.avail?.topDay && input.avail.topHour) {
    out.push({
      id: 'avail-demand',
      observation: `Highest recorded demand is ${input.avail.topDay} around ${input.avail.topHour}.`,
      recommendation: 'Consider adding availability during this period.',
      basedOn: `${input.avail.booked} booked sessions on file.`,
      href: '/tutor/profile#availability',
      actionLabel: 'Manage Availability',
    })
  }
  return out
}

export { formatEarn, formatEarnOrZero }
