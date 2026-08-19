import type { BookingRow } from './api'
import type { StudioCourse } from './tutorCourses'
import type { TutorBooking } from './tutorMarketplace'
import type { TutorSessionView } from './tutorSessions'

export type EarnSource = 'course' | 'session' | 'project' | 'interview' | 'career' | 'refund'
export type TxStatus = 'pending' | 'recorded' | 'completed' | 'cancelled' | 'refunded'
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'unavailable'
export type DatePreset = 'today' | 'week' | 'month' | 'last_month' | '3m' | '6m' | 'year' | 'custom'
export type ChartRange = '7d' | '30d' | '3m' | '6m' | '1y'
export type TxTab = 'all' | 'courses' | 'sessions' | 'projects' | 'interview' | 'refunds'

export interface TutorTransaction {
  id: string
  sourceType: EarnSource
  sourceId: string
  courseId: string | null
  sessionId: string | null
  projectId: string | null
  studentId: string | null
  studentName: string | null
  description: string
  grossAmount: number | null
  platformFee: number | null
  refundAmount: number
  adjustmentAmount: number
  netAmount: number | null
  currency: 'INR'
  transactionStatus: TxStatus
  payoutStatus: PayoutStatus
  payoutId: string | null
  transactionDate: string
  settlementDate: string | null
  reference: string | null
  demo: boolean
}

export interface CourseRevenueRow {
  id: string
  title: string
  enrollments: number
  gross: number
  fee: number | null
  net: number | null
  refunds: number
}

export interface SessionTypeRevenue {
  kind: EarnSource
  label: string
  count: number
  gross: number
  fee: number | null
  net: number | null
  average: number | null
}

export const TX_PAGE_SIZE = 20
export const FILTER_KEY = 'learnsyra_tutor_earnings_filters'

export function platformFeeRate(): number | null {
  const raw = import.meta.env.VITE_PLATFORM_FEE_BPS
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 10000) return null
  return n / 10000
}

export function applyFee(gross: number | null, rate: number | null): { fee: number | null; net: number | null } {
  if (gross == null) return { fee: null, net: null }
  if (rate == null) return { fee: null, net: null }
  const fee = Math.round(gross * rate)
  return { fee, net: gross - fee }
}

export function formatEarn(n: number | null | undefined) {
  if (n == null) return 'Not available'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function formatEarnOrZero(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function rangeForPreset(preset: DatePreset, custom?: { from: string; to: string }): { from: Date; to: Date } {
  const now = new Date()
  const to = now
  if (preset === 'custom' && custom?.from && custom?.to) {
    return { from: new Date(custom.from), to: new Date(custom.to + 'T23:59:59') }
  }
  if (preset === 'today') return { from: startOfDay(now), to }
  if (preset === 'week') {
    const from = startOfDay(now)
    const day = (from.getDay() + 6) % 7
    from.setDate(from.getDate() - day)
    return { from, to }
  }
  if (preset === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
  if (preset === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    return { from, to: end }
  }
  if (preset === '3m') return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to }
  if (preset === '6m') return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to }
  return { from: new Date(now.getFullYear(), 0, 1), to }
}

export function chartWindow(range: ChartRange): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date()
  if (range === '7d') from.setDate(from.getDate() - 6)
  else if (range === '30d') from.setDate(from.getDate() - 29)
  else if (range === '3m') from.setMonth(from.getMonth() - 3)
  else if (range === '6m') from.setMonth(from.getMonth() - 6)
  else from.setFullYear(from.getFullYear() - 1)
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

function inRange(iso: string, from: Date, to: Date) {
  const t = new Date(iso).getTime()
  return t >= from.getTime() && t <= to.getTime()
}

function sourceFromKind(kind: TutorSessionView['kind']): EarnSource {
  if (kind === 'project') return 'project'
  if (kind === 'interview') return 'interview'
  if (kind === 'career') return 'career'
  return 'session'
}

export function sourceLabel(s: EarnSource) {
  if (s === 'course') return 'Course Sales'
  if (s === 'project') return 'Project Help'
  if (s === 'interview') return 'Interview Preparation'
  if (s === 'career') return 'Career Guidance'
  if (s === 'refund') return 'Refunds'
  return '1-on-1 Sessions'
}

export function sourceIcon(s: EarnSource) {
  if (s === 'course') return '📚'
  if (s === 'project') return '🚀'
  if (s === 'interview') return '🎤'
  if (s === 'career') return '🎯'
  if (s === 'refund') return '↩️'
  return '👨‍🏫'
}

function txStatus(bookingStatus: string): TxStatus {
  if (bookingStatus === 'cancelled') return 'cancelled'
  if (bookingStatus === 'completed') return 'completed'
  if (bookingStatus === 'pending') return 'pending'
  return 'recorded'
}

export function buildTransactions(input: {
  sessions: TutorSessionView[]
  local: TutorBooking[]
  api: BookingRow[]
  tutorPublicId: string
}): TutorTransaction[] {
  const rate = platformFeeRate()
  const rows: TutorTransaction[] = []
  const seen = new Set<string>()

  for (const s of input.sessions) {
    if (s.demo) continue
    if (s.status === 'cancelled') continue
    seen.add(s.id)
    const gross = s.price != null && s.price > 0 ? s.price : null
    const { fee, net } = applyFee(gross, rate)
    const sourceType = sourceFromKind(s.kind)
    rows.push({
      id: s.id,
      sourceType,
      sourceId: s.id,
      courseId: s.courseId,
      sessionId: s.id,
      projectId: s.projectId,
      studentId: s.studentId,
      studentName: s.studentName,
      description: s.topic,
      grossAmount: gross,
      platformFee: fee,
      refundAmount: 0,
      adjustmentAmount: 0,
      netAmount: net,
      currency: 'INR',
      transactionStatus: txStatus(s.bookingStatus),
      payoutStatus: 'unavailable',
      payoutId: null,
      transactionDate: s.scheduledAt || s.createdAt,
      settlementDate: null,
      reference: null,
      demo: false,
    })
  }

  for (const b of input.local) {
    if (b.tutorId !== input.tutorPublicId) continue
    if (seen.has(b.id) || b.status === 'cancelled') continue
    const gross = b.price > 0 ? b.price : null
    const { fee, net } = applyFee(gross, rate)
    rows.push({
      id: b.id,
      sourceType: b.sessionType === 'project' ? 'project' : b.sessionType === 'interview' ? 'interview' : b.sessionType === 'career' ? 'career' : 'session',
      sourceId: b.id,
      courseId: null,
      sessionId: b.id,
      projectId: null,
      studentId: b.studentId,
      studentName: null,
      description: b.sessionLabel,
      grossAmount: gross,
      platformFee: fee,
      refundAmount: 0,
      adjustmentAmount: 0,
      netAmount: net,
      currency: 'INR',
      transactionStatus: txStatus(b.status),
      payoutStatus: 'unavailable',
      payoutId: null,
      transactionDate: b.createdAt,
      settlementDate: null,
      reference: null,
      demo: false,
    })
  }

  for (const b of input.api) {
    if (seen.has(b.id) || b.status === 'cancelled') continue
    rows.push({
      id: b.id,
      sourceType: 'session',
      sourceId: b.id,
      courseId: null,
      sessionId: b.id,
      projectId: null,
      studentId: b.student_id,
      studentName: b.student?.full_name ?? null,
      description: b.message?.split('\n')[0] || b.listing?.expertise || 'Tutor session',
      grossAmount: null,
      platformFee: null,
      refundAmount: 0,
      adjustmentAmount: 0,
      netAmount: null,
      currency: 'INR',
      transactionStatus: txStatus(b.status),
      payoutStatus: 'unavailable',
      payoutId: null,
      transactionDate: b.created_at,
      settlementDate: null,
      reference: null,
      demo: false,
    })
  }

  return rows.sort((a, b) => +new Date(b.transactionDate) - +new Date(a.transactionDate))
}

export function filterTransactions(
  rows: TutorTransaction[],
  opts: { preset: DatePreset; custom?: { from: string; to: string }; tab: TxTab; query: string },
) {
  const { from, to } = rangeForPreset(opts.preset, opts.custom)
  return rows.filter(r => {
    if (!inRange(r.transactionDate, from, to)) return false
    if (opts.tab === 'courses' && r.sourceType !== 'course') return false
    if (opts.tab === 'sessions' && r.sourceType !== 'session') return false
    if (opts.tab === 'projects' && r.sourceType !== 'project') return false
    if (opts.tab === 'interview' && r.sourceType !== 'interview') return false
    if (opts.tab === 'refunds' && r.sourceType !== 'refund' && r.refundAmount <= 0) return false
    if (opts.query.trim()) {
      const blob = [r.description, r.studentName, r.sourceType, r.id].join(' ').toLowerCase()
      if (!blob.includes(opts.query.trim().toLowerCase())) return false
    }
    return true
  })
}

function sumGross(rows: TutorTransaction[]) {
  return rows.reduce((s, r) => s + (r.grossAmount ?? 0), 0)
}

export function earningsTotals(rows: TutorTransaction[]) {
  const countable = rows.filter(r => r.transactionStatus !== 'cancelled' && r.grossAmount != null)
  const pending = countable.filter(r => r.transactionStatus === 'pending' || r.transactionStatus === 'recorded')
  const completed = countable.filter(r => r.transactionStatus === 'completed')
  const refunds = rows.reduce((s, r) => s + r.refundAmount, 0)
  const adjustments = rows.reduce((s, r) => s + r.adjustmentAmount, 0)
  const rate = platformFeeRate()
  const gross = sumGross(countable)
  const completedGross = sumGross(completed)
  const pendingGross = sumGross(pending)
  const { fee, net } = applyFee(completedGross, rate)
  const lifetimeGross = sumGross(countable)
  const lifetime = applyFee(lifetimeGross, rate)
  const hasAnyAmount = countable.some(r => r.grossAmount != null && r.grossAmount > 0)
  return {
    hasAnyAmount,
    rate,
    gross: completedGross,
    pendingGross,
    lifetimeGross,
    fee,
    net,
    lifetimeNet: lifetime.net,
    refunds,
    adjustments,
    pendingCount: pending.length,
    completedCount: completed.length,
    available: 0,
    paid: 0,
  }
}

export function sourceBreakdown(rows: TutorTransaction[]) {
  const keys: EarnSource[] = ['course', 'session', 'project', 'interview', 'career']
  const completed = rows.filter(r => r.transactionStatus === 'completed' && r.grossAmount != null)
  const total = sumGross(completed)
  return keys.map(k => {
    const slice = completed.filter(r => r.sourceType === k)
    const amount = sumGross(slice)
    return {
      key: k,
      label: sourceLabel(k),
      icon: sourceIcon(k),
      amount,
      count: slice.length,
      pct: total > 0 && amount > 0 ? Math.round((amount / total) * 100) : null,
    }
  }).filter(s => s.amount > 0)
}

export function monthCompare(all: TutorTransaction[]) {
  const now = new Date()
  const thisFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
  const thisRows = all.filter(r => r.transactionStatus === 'completed' && inRange(r.transactionDate, thisFrom, now))
  const prevRows = all.filter(r => r.transactionStatus === 'completed' && inRange(r.transactionDate, prevFrom, prevTo))
  const current = sumGross(thisRows)
  const previous = sumGross(prevRows)
  let delta: number | null = null
  if (previous > 0) delta = ((current - previous) / previous) * 100
  return { current, previous, delta }
}

export function chartPoints(rows: TutorTransaction[], range: ChartRange, global: { from: Date; to: Date }) {
  const win = chartWindow(range)
  const from = new Date(Math.max(win.from.getTime(), global.from.getTime()))
  const to = new Date(Math.min(win.to.getTime(), global.to.getTime()))
  const useMonthly = range === '3m' || range === '6m' || range === '1y'
  const buckets = new Map<string, { gross: number; fee: number; net: number; label: string }>()
  const list = rows.filter(r => r.transactionStatus === 'completed' && r.grossAmount != null && inRange(r.transactionDate, from, to))
  for (const r of list) {
    const d = new Date(r.transactionDate)
    const key = useMonthly
      ? `${d.getFullYear()}-${d.getMonth()}`
      : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const label = useMonthly
      ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const cur = buckets.get(key) || { gross: 0, fee: 0, net: 0, label }
    cur.gross += r.grossAmount ?? 0
    cur.fee += r.platformFee ?? 0
    cur.net += r.netAmount ?? r.grossAmount ?? 0
    buckets.set(key, cur)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([, v]) => v)
}

export function sessionPerformance(rows: TutorTransaction[]): SessionTypeRevenue[] {
  const kinds: { kind: EarnSource; label: string }[] = [
    { kind: 'session', label: '1-on-1' },
    { kind: 'project', label: 'Project Help' },
    { kind: 'interview', label: 'Interview Prep' },
    { kind: 'career', label: 'Career Guidance' },
  ]
  return kinds.map(({ kind, label }) => {
    const slice = rows.filter(r => r.sourceType === kind && r.transactionStatus === 'completed')
    const withAmt = slice.filter(r => r.grossAmount != null)
    const gross = sumGross(withAmt)
    const { fee, net } = applyFee(gross || null, platformFeeRate())
    const average = withAmt.length >= 2 ? Math.round(gross / withAmt.length) : null
    return { kind, label, count: slice.length, gross, fee, net, average }
  }).filter(r => r.count > 0)
}

export function courseRevenueRows(
  courses: StudioCourse[],
  enrollMap: Record<string, number>,
  txs: TutorTransaction[],
): CourseRevenueRow[] {
  return courses
    .filter(c => !c.demo && c.status === 'published')
    .map(c => {
      const related = txs.filter(t => t.courseId === c.id || t.courseId === c.apiId)
      const gross = sumGross(related.filter(t => t.transactionStatus === 'completed'))
      const { fee, net } = applyFee(gross || null, platformFeeRate())
      return {
        id: c.id,
        title: c.title,
        enrollments: enrollMap[c.apiId || c.id] ?? enrollMap[c.id] ?? 0,
        gross,
        fee,
        net,
        refunds: related.reduce((s, t) => s + t.refundAmount, 0),
      }
    })
}

export function insights(input: {
  monthGross: number
  prevGross: number
  sources: ReturnType<typeof sourceBreakdown>
  sessions: SessionTypeRevenue[]
  courses: CourseRevenueRow[]
  hasAmounts: boolean
}) {
  if (!input.hasAmounts) return ['Not enough earnings data for an insight.']
  const lines: string[] = []
  const top = [...input.sources].sort((a, b) => b.amount - a.amount)[0]
  if (top && top.pct != null) lines.push(`${top.label} generated ${top.pct}% of recorded gross this month.`)
  const topCourse = [...input.courses].sort((a, b) => b.gross - a.gross)[0]
  if (topCourse && topCourse.gross > 0) lines.push(`${topCourse.title} has the highest recorded course revenue.`)
  if (input.prevGross > 0 && input.monthGross !== input.prevGross) {
    lines.push(input.monthGross > input.prevGross
      ? 'Session revenue increased compared with the previous month.'
      : 'Recorded revenue is lower than the previous month.')
  }
  return lines.length ? lines : ['Not enough earnings data for an insight.']
}

export function advisorLines(sessions: SessionTypeRevenue[], courses: CourseRevenueRow[]) {
  const lines: string[] = []
  const top = [...sessions].sort((a, b) => b.count - a.count)[0]
  if (top && top.count >= 2) lines.push(`Your most booked session type is ${top.label}.`)
  const busy = courses.find(c => c.enrollments >= 3 && c.gross === 0)
  if (busy) lines.push(`${busy.title} has enrollments on file, but no recorded course purchases yet.`)
  if (!lines.length) return ['Not enough activity data for a suggestion. These are not income forecasts.']
  return lines
}

export function statementForMonth(rows: TutorTransaction[], year: number, month: number) {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0, 23, 59, 59)
  const slice = rows.filter(r => inRange(r.transactionDate, from, to) && r.transactionStatus !== 'cancelled')
  const completed = slice.filter(r => r.transactionStatus === 'completed')
  const gross = sumGross(completed)
  const { fee, net } = applyFee(gross || null, platformFeeRate())
  return {
    label: from.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    gross,
    fee,
    refunds: slice.reduce((s, r) => s + r.refundAmount, 0),
    net,
    payouts: 0,
    closing: 0,
  }
}

export function loadEarnFilters(): Partial<{ preset: DatePreset; tab: TxTab; query: string; chart: ChartRange }> {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveEarnFilters(next: object) {
  sessionStorage.setItem(FILTER_KEY, JSON.stringify(next))
}

export function statusLabel(s: TxStatus) {
  if (s === 'completed') return 'Completed'
  if (s === 'pending') return 'Pending'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'refunded') return 'Refunded'
  return 'Recorded'
}
