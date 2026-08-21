import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTutorLiveClasses, getTutorBookings, getTutorCourses, getTutorStudents } from '../lib/api'
import {
  advisorLines,
  applyFee,
  buildTransactions,
  chartPoints,
  courseRevenueRows,
  earningsTotals,
  filterTransactions,
  formatEarn,
  formatEarnOrZero,
  insights,
  loadEarnFilters,
  monthCompare,
  platformFeeRate,
  rangeForPreset,
  saveEarnFilters,
  sessionPerformance,
  sourceBreakdown,
  statementForMonth,
  statusLabel,
  TX_PAGE_SIZE,
  type ChartRange,
  type DatePreset,
  type TutorTransaction,
  type TxTab,
} from '../lib/tutorEarnings'
import { tutorCoursePath, tutorSessionPath } from '../lib/paths'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import { loadTutorHub, selfTutorId } from '../lib/tutorProfile'
import { mergeTutorCourses } from '../lib/tutorCourses'
import { buildTutorSessions } from '../lib/tutorSessions'
import { buildTutorRoster } from '../lib/tutorStudents'
import './tutor-earnings.css'

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
]

const CHARTS: { id: ChartRange; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
]

const TABS: { id: TxTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'courses', label: 'Courses' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'projects', label: 'Projects' },
  { id: 'interview', label: 'Interview Prep' },
  { id: 'refunds', label: 'Refunds' },
]

export default function TutorEarnings() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || null
  const publicId = tutorId ? (loadTutorHub(tutorId)?.publicId || selfTutorId(tutorId)) : ''
  const saved = loadEarnFilters(tutorId)
  const [rows, setRows] = useState<TutorTransaction[]>([])
  const [enrollMap, setEnrollMap] = useState<Record<string, number>>({})
  const [courses, setCourses] = useState<ReturnType<typeof mergeTutorCourses>['courses']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preset, setPreset] = useState<DatePreset>(saved.preset || 'month')
  const [chart, setChart] = useState<ChartRange>(saved.chart || '30d')
  const [tab, setTab] = useState<TxTab>(saved.tab || 'all')
  const [query, setQuery] = useState(saved.query || '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<TutorTransaction | null>(null)
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [stmtMonth, setStmtMonth] = useState(() => new Date().getMonth())
  const [stmtYear, setStmtYear] = useState(() => new Date().getFullYear())
  const [tip, setTip] = useState<string | null>(null)

  const load = () => {
    if (!tutorId) {
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    Promise.all([
      getTutorStudents().catch(() => []),
      getTutorBookings().catch(() => []),
      getTutorCourses().catch(() => []),
      getTutorLiveClasses().catch(() => []),
    ]).then(([enrollments, bookings, apiCourses, liveClasses]) => {
      const roster = buildTutorRoster({ enrollments, bookings, reviews: [], localBookings: loadTutorBookings(), apiCourses })
      const built = buildTutorSessions({
        local: loadTutorBookings(),
        api: bookings,
        liveClasses,
        roster: roster.students,
        tutorUserId: tutorId,
        tutorPublicId: publicId,
      })
      const studio = mergeTutorCourses(apiCourses, tutorId)
      setCourses(studio.courses)
      const map: Record<string, number> = {}
      for (const c of apiCourses) map[c.id] = c.students
      setEnrollMap(map)
      setRows(buildTransactions({ sessions: built.sessions, local: loadTutorBookings(), api: bookings, tutorPublicId: publicId }))
    }).catch(() => {
      setError("We couldn't load earnings right now.")
      setRows([])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tutorId, publicId, profile?.id])
  useEffect(() => {
    saveEarnFilters({ preset, tab, query, chart }, tutorId)
    setPage(1)
  }, [preset, tab, query, chart, from, to, tutorId])
  useEffect(() => {
    if (!drawer && !detail && !payoutOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawer(false); setDetail(null); setPayoutOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, detail, payoutOpen])

  const filtered = useMemo(
    () => filterTransactions(rows, { preset, custom: { from, to }, tab, query }),
    [rows, preset, from, to, tab, query],
  )
  const windowRows = useMemo(
    () => filterTransactions(rows, { preset, custom: { from, to }, tab: 'all', query: '' }),
    [rows, preset, from, to],
  )
  const totals = earningsTotals(windowRows)
  const lifetime = earningsTotals(rows)
  const sources = sourceBreakdown(windowRows)
  const mom = monthCompare(rows)
  const globalRange = rangeForPreset(preset, { from, to })
  const points = chartPoints(rows, chart, globalRange)
  const maxBar = Math.max(...points.map(p => p.gross), 0)
  const sessions = sessionPerformance(windowRows)
  const courseRows = courseRevenueRows(courses, enrollMap, windowRows)
  const insightLines = insights({ monthGross: mom.current, prevGross: mom.previous, sources, sessions, courses: courseRows, hasAmounts: totals.hasAnyAmount })
  const tips = advisorLines(sessions, courseRows)
  const pages = Math.max(1, Math.ceil(filtered.length / TX_PAGE_SIZE))
  const slice = filtered.slice((page - 1) * TX_PAGE_SIZE, page * TX_PAGE_SIZE)
  const stmt = statementForMonth(rows, stmtYear, stmtMonth)
  const feeRate = platformFeeRate()
  const refunds = windowRows.filter(r => r.refundAmount > 0 || r.sourceType === 'refund')
  const topType = [...sessions].sort((a, b) => b.gross - a.gross)[0]
  const pendingRows = windowRows.filter(r => (r.transactionStatus === 'pending' || r.transactionStatus === 'recorded') && r.grossAmount)

  const filters = (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map(p => (
        <button key={p.id} type="button" className="te-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={preset === p.id} aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>{p.label}</button>
      ))}
    </div>
  )

  return (
    <div className="te-page pt-20 px-4 sm:px-6 pb-16 max-w-6xl mx-auto overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Earnings</h1>
          <p className="text-muted">Track your tutoring income, course revenue, and payouts in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm lg:hidden" onClick={() => setDrawer(true)}>Filters</button>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/profile#pricing')}>Payout Settings</button>
        </div>
      </div>

      <div className="hidden lg:block mb-5">{filters}</div>
      {preset === 'custom' && (
        <div className="flex flex-wrap gap-3 mb-5">
          <label className="text-xs font-semibold text-muted">From<input type="date" className="field ml-2 px-3 py-2 text-sm" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="text-xs font-semibold text-muted">To<input type="date" className="field ml-2 px-3 py-2 text-sm" value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
      )}

      {error && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm" style={{ color: '#e11d48' }}>
          {error}
          <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Earnings', value: loading ? null : lifetime.lifetimeNet != null ? formatEarn(lifetime.lifetimeNet) : lifetime.hasAnyAmount ? 'Fee data unavailable' : '₹0' },
          { label: 'This Month', value: loading ? null : mom.current ? formatEarnOrZero(mom.current) : '₹0' },
          { label: 'Pending', value: loading ? null : formatEarnOrZero(totals.pendingGross) },
          { label: 'Available for Payout', value: loading ? null : '₹0' },
        ].map(c => (
          <div key={c.label} className="te-card glass rounded-2xl p-4">
            <div className="text-xs text-muted">{c.label}</div>
            {c.value == null ? <div className="te-skel mt-2" /> : <div className="text-2xl font-black text-ink mt-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{c.value}</div>}
          </div>
        ))}
      </div>

      {!loading && !lifetime.hasAnyAmount && rows.filter(r => r.grossAmount != null).length === 0 && (
        <section className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-black text-ink mb-2">No Earnings Yet</h2>
          <p className="text-sm text-muted">Your earnings will appear here after students purchase your courses or book paid sessions.</p>
        </section>
      )}

      <section className="te-hero glass rounded-3xl p-5 md:p-7 mb-6">
        <h2 className="text-lg font-black text-ink mb-1">This Month</h2>
        {loading ? <div className="te-skel w-40" /> : (
          <>
            <div className="text-4xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{formatEarnOrZero(mom.current)}</div>
            {mom.delta != null && <p className="text-sm mt-1" style={{ color: mom.delta >= 0 ? '#0F8A68' : '#e11d48' }}>{mom.delta >= 0 ? '+' : ''}{mom.delta.toFixed(1)}% vs previous month</p>}
            <dl className="grid sm:grid-cols-2 gap-2 mt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Gross Revenue</dt><dd className="font-semibold">{formatEarnOrZero(mom.current)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Platform Fees</dt><dd>{feeRate == null ? 'Platform fee calculation unavailable' : formatEarn(applyFee(mom.current, feeRate).fee)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Refunds</dt><dd>{formatEarnOrZero(0)}</dd></div>
              <div className="flex justify-between font-bold"><dt>Net Tutor Earnings</dt><dd>{feeRate == null ? 'Not available' : formatEarn(applyFee(mom.current, feeRate).net)}</dd></div>
            </dl>
          </>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Where Your Earnings Come From</h2>
        {sources.length === 0 && <p className="text-sm text-muted">No earnings yet.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sources.map(s => (
            <div key={s.key} className="glass rounded-xl p-4">
              <div className="text-sm font-semibold">{s.icon} {s.label}</div>
              <div className="text-xl font-black text-ink mt-1">{formatEarnOrZero(s.amount)}</div>
              {s.pct != null && <div className="text-xs text-muted">{s.pct}%</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap justify-between gap-3 mb-3">
          <h2 className="text-lg font-black text-ink">Earnings Overview</h2>
          <div className="flex flex-wrap gap-2">
            {CHARTS.map(c => (
              <button key={c.id} type="button" className="te-chip rounded-full px-3 py-1.5 text-xs" data-on={chart === c.id} onClick={() => setChart(c.id)}>{c.label}</button>
            ))}
          </div>
        </div>
        {points.length === 0 ? (
          <p className="text-sm text-muted">No earnings history yet</p>
        ) : (
          <>
            <p className="text-xs text-muted mb-3">Recorded gross across the selected range. {points.length} period{points.length === 1 ? '' : 's'} with amounts.</p>
            <div className="te-bar" role="img" aria-label="Earnings chart">
              {points.map(p => (
                <button key={p.label} type="button" style={{ height: `${Math.max(8, (p.gross / (maxBar || 1)) * 140)}px` }} aria-label={`${p.label}: gross ${formatEarnOrZero(p.gross)}`} onClick={() => setTip(`${p.label} · Gross ${formatEarnOrZero(p.gross)} · Fees ${feeRate == null ? 'unavailable' : formatEarnOrZero(p.fee)} · Net ${feeRate == null ? 'unavailable' : formatEarnOrZero(p.net)}`)} />
              ))}
            </div>
            {tip && <p className="text-xs text-muted mt-3">{tip}</p>}
          </>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Earnings Breakdown</h2>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between"><dt className="text-muted">Gross Revenue</dt><dd>{formatEarnOrZero(totals.gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Platform Fee</dt><dd>{feeRate == null ? 'Platform fee calculation unavailable' : `−${formatEarn(totals.fee)}`}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Refunds</dt><dd>−{formatEarnOrZero(totals.refunds)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Adjustments</dt><dd>−{formatEarnOrZero(totals.adjustments)}</dd></div>
          <div className="flex justify-between font-bold pt-2" style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}><dt>Tutor Earnings</dt><dd>{feeRate == null ? 'Not available' : formatEarn(totals.net)}</dd></div>
        </dl>
      </section>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <section className="glass rounded-2xl p-5">
          <h2 className="text-lg font-black text-ink mb-1">Pending Earnings</h2>
          <p className="text-xs text-muted mb-3">Earnings that are recorded but not yet available for payout.</p>
          <div className="text-2xl font-black">{formatEarnOrZero(totals.pendingGross)}</div>
          <p className="text-sm text-muted mt-2">Expected: Settlement date unavailable</p>
          <p className="text-sm text-muted">From: {pendingRows.length} session{pendingRows.length === 1 ? '' : 's'}</p>
        </section>
        <section className="glass rounded-2xl p-5">
          <h2 className="text-lg font-black text-ink mb-1">Available for Payout</h2>
          <div className="text-2xl font-black">₹0</div>
          <p className="text-xs text-muted mt-2">Minimum payout threshold is not configured.</p>
          <button type="button" className="btn-primary text-sm mt-4" onClick={() => setPayoutOpen(true)}>Request Payout</button>
        </section>
      </div>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Next Payout</h2>
        <p className="text-sm text-muted">No payout scheduled</p>
        <p className="text-xs text-muted mt-1">Status: Not Available</p>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Payout History</h2>
        <p className="text-sm text-muted">No payouts yet.</p>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Transactions</h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input className="field flex-1 px-3 py-2 text-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search transactions" aria-label="Search transactions" />
        </div>
        <div className="flex flex-wrap gap-2 mb-4" role="tablist">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" className="te-chip rounded-full px-3 py-1.5 text-xs" data-on={tab === t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        {slice.length === 0 && <p className="text-sm text-muted">No transactions yet.</p>}
        <div className="te-table-desktop overflow-x-auto">
          {slice.length > 0 && (
            <table className="te-table">
              <thead>
                <tr>
                  {['Date', 'Description', 'Student/Course', 'Gross', 'Fee', 'Net', 'Status'].map(h => <th key={h} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {slice.map(r => (
                  <tr key={r.id}>
                    <td><button type="button" className="text-primary" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => setDetail(r)}>{new Date(r.transactionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</button></td>
                    <td>{r.description}</td>
                    <td>{r.studentName || r.courseId || '—'}</td>
                    <td>{formatEarn(r.grossAmount)}</td>
                    <td>{formatEarn(r.platformFee)}</td>
                    <td>{formatEarn(r.netAmount)}</td>
                    <td>{statusLabel(r.transactionStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="te-cards-mobile space-y-3">
          {slice.map(r => (
            <button key={r.id} type="button" className="te-card glass rounded-xl p-4 w-full text-left" onClick={() => setDetail(r)}>
              <div className="font-semibold text-sm">{r.description}</div>
              <div className="text-xs text-muted">{new Date(r.transactionDate).toLocaleDateString('en-IN')} · {r.studentName || 'Student not listed'}</div>
              <div className="text-sm mt-1">Gross {formatEarn(r.grossAmount)} · Net {formatEarn(r.netAmount)}</div>
              <div className="text-xs text-muted">{statusLabel(r.transactionStatus)}</div>
            </button>
          ))}
        </div>
        {pages > 1 && (
          <nav className="flex gap-2 mt-4" aria-label="Transaction pagination">
            <button type="button" className="btn-glass text-xs" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 7).map(n => (
              <button key={n} type="button" className="te-chip rounded-lg px-3 py-1.5 text-xs" data-on={page === n} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" className="btn-glass text-xs" disabled={page === pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>Next</button>
          </nav>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Course Revenue</h2>
        {courseRows.length === 0 && <p className="text-sm text-muted">No course revenue yet.</p>}
        {courseRows.map(c => (
          <div key={c.id} className="glass rounded-xl p-4 mb-2 flex flex-wrap justify-between gap-3">
            <div>
              <div className="font-semibold">{c.title}</div>
              <div className="text-xs text-muted">{c.enrollments} enrollment{c.enrollments === 1 ? '' : 's'} · Gross {formatEarnOrZero(c.gross)} · Fees {formatEarn(c.fee)} · Net {formatEarn(c.net)}</div>
              {c.gross === 0 && <p className="text-xs text-subtle mt-1">Enrollments are not counted as purchases.</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorCoursePath(c.id))}>View Course</button>
              <button type="button" className="btn-glass text-xs" onClick={() => navigate('/tutor/analytics')}>View Analytics</button>
            </div>
          </div>
        ))}
      </section>

      {courseRows.some(c => c.gross > 0) ? (
        <section className="glass rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-black text-ink mb-3">Top Earning Courses</h2>
          {[...courseRows].filter(c => c.gross > 0).sort((a, b) => b.gross - a.gross).map(c => (
            <div key={c.id} className="flex justify-between text-sm mb-2"><span>{c.title}</span><span>{formatEarnOrZero(c.gross)}</span></div>
          ))}
        </section>
      ) : (
        <section className="glass rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-black text-ink mb-2">Top Earning Courses</h2>
          <p className="text-sm text-muted">No course revenue yet.</p>
        </section>
      )}

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Tutoring Revenue</h2>
        {sessions.length === 0 && <p className="text-sm text-muted">No session revenue yet.</p>}
        {sessions.map(s => (
          <div key={s.kind} className="flex flex-wrap justify-between gap-2 text-sm mb-2">
            <span>{s.label} · {s.count} completed</span>
            <span>Gross {formatEarnOrZero(s.gross)}{s.average != null ? ` · Avg ${formatEarnOrZero(s.average)}` : ''}</span>
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Session Performance</h2>
        {topType ? (
          <p className="text-sm">{topType.label} · {topType.count} sessions · {formatEarnOrZero(topType.gross)}</p>
        ) : (
          <p className="text-sm text-muted">No completed paid sessions on file.</p>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Refunds & Adjustments</h2>
        {refunds.length === 0 && <p className="text-sm text-muted">No refunds recorded.</p>}
        {refunds.map(r => (
          <div key={r.id} className="text-sm mb-2">−{formatEarnOrZero(r.refundAmount)} · {new Date(r.transactionDate).toLocaleDateString('en-IN')} · {r.description}</div>
        ))}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Payout Account</h2>
        <p className="text-sm">○ Not Connected</p>
        <p className="text-xs text-muted mt-1">Bank details are not collected on this page.</p>
        <button type="button" className="btn-glass text-sm mt-3" onClick={() => navigate('/tutor/profile#pricing')}>Manage Payout Account</button>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Financial Documents</h2>
        <p className="text-sm text-muted">Financial documents will appear here when enabled.</p>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Monthly Statement</h2>
        <div className="flex flex-wrap gap-3 mb-3">
          <label className="text-xs font-semibold text-muted">Month
            <select className="field ml-2 px-3 py-2 text-sm" value={stmtMonth} onChange={e => setStmtMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(2000, i, 1).toLocaleString('en-IN', { month: 'long' })}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">Year
            <input type="number" className="field ml-2 w-24 px-3 py-2 text-sm" value={stmtYear} onChange={e => setStmtYear(Number(e.target.value))} />
          </label>
        </div>
        <p className="text-sm font-semibold mb-2">{stmt.label}</p>
        <dl className="text-sm space-y-1">
          <div className="flex justify-between"><dt className="text-muted">Gross revenue</dt><dd>{formatEarnOrZero(stmt.gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Platform fees</dt><dd>{formatEarn(stmt.fee)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Refunds</dt><dd>{formatEarnOrZero(stmt.refunds)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Net earnings</dt><dd>{formatEarn(stmt.net)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Payouts</dt><dd>₹0</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Closing balance</dt><dd>₹0</dd></div>
        </dl>
        <button type="button" className="btn-glass text-sm mt-4" onClick={() => setTip('Statement export will be available when financial reporting is connected.')}>Export Statement</button>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">✨ Earnings Insights</h2>
        <ul className="text-sm text-muted list-disc pl-5">{insightLines.map(l => <li key={l}>{l}</li>)}</ul>
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">AI Earnings Suggestions</h2>
        <p className="text-xs text-muted mb-2">Recommendations only — not income guarantees.</p>
        <ul className="text-sm text-muted list-disc pl-5">{tips.map(l => <li key={l}>{l}</li>)}</ul>
      </section>

      {drawer && (
        <div className="te-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="te-filters">
          <button type="button" className="absolute inset-0" aria-label="Close filters" style={{ background: 'transparent', border: 'none' }} onClick={() => setDrawer(false)} />
          <div className="glass rounded-3xl p-5 relative z-10 w-full max-w-md">
            <h2 id="te-filters" className="text-lg font-black text-ink mb-3">Date filter</h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setDrawer(false)}>Apply</button>
          </div>
        </div>
      )}

      {payoutOpen && (
        <div className="te-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setPayoutOpen(false)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 className="text-lg font-black text-ink mb-2">Request Payout</h2>
            <p className="text-sm text-muted mb-4">Payout processing will be available once payout infrastructure is connected. No transfer was created.</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setPayoutOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {detail && (
        <div className="te-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="te-tx">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setDetail(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md max-h-[85vh] overflow-auto">
            <h2 id="te-tx" className="text-lg font-black text-ink mb-3">Transaction</h2>
            <dl className="text-sm space-y-2">
              <Row k="Transaction ID" v={detail.id} />
              <Row k="Date" v={new Date(detail.transactionDate).toLocaleString()} />
              <Row k="Type" v={detail.sourceType} />
              <Row k="Course/session" v={detail.description} />
              <Row k="Gross amount" v={formatEarn(detail.grossAmount)} />
              <Row k="Platform fee" v={formatEarn(detail.platformFee)} />
              <Row k="Refund/adjustment" v={formatEarnOrZero(detail.refundAmount + detail.adjustmentAmount)} />
              <Row k="Net amount" v={formatEarn(detail.netAmount)} />
              <Row k="Payment status" v={statusLabel(detail.transactionStatus)} />
              <Row k="Payout status" v="Not available" />
              <Row k="Settlement date" v="Not available" />
              <Row k="Reference" v={detail.reference || 'Not available'} />
            </dl>
            {detail.sessionId && <button type="button" className="btn-glass text-sm mt-4" onClick={() => navigate(tutorSessionPath(detail.sessionId!))}>Open Session</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-medium text-right">{v}</dd></div>
}
