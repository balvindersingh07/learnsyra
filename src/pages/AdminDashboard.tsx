import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  loadAdminOverview,
  loadDismissedInsights,
  saveDismissedInsights,
  type AdminInsight,
  type AdminOverview,
  type AdminRange,
} from '../lib/adminPlatform'
import { loadDashboardHealth, type HealthItem } from '../lib/platformHealth'
import './admin-control.css'

const RANGES: { id: AdminRange; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: 'custom', label: 'Custom' },
]

const ACTIVITY_LIMIT = 8

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [range, setRange] = useState<AdminRange>('30d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(() => loadDismissedInsights())
  const [health, setHealth] = useState<HealthItem[] | null>(null)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminOverview(range, { from, to })
      .then(setData)
      .catch(() => setError("Admin data couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [range, from, to])

  useEffect(() => {
    loadDashboardHealth().then(setHealth)
  }, [])

  const insights = (data?.insights ?? []).filter(i => !dismissed.includes(i.id)).slice(0, 3)
  const maxGrowth = Math.max(1, ...(data?.growth ?? []).flatMap(g => [g.students, g.tutors, g.courses, g.sessions]))
  const attention = [
    { title: 'Tutor Verification', count: data?.pendingVerification ?? null, action: 'Review →', href: '/admin/verification' },
    { title: 'Course Moderation', count: data?.pendingCourses ?? 0, action: 'Review →', href: '/admin/courses' },
    { title: 'Project Reports', count: null, action: 'Review →', href: '/admin/reports' },
    { title: 'User Reports', count: null, action: 'Review →', href: '/admin/reports' },
    { title: 'Payment Issues', count: null, action: 'View →', href: '/admin/payments' },
  ]
  const needs = attention.filter(a => typeof a.count === 'number' && a.count > 0)
  const pendingHref = needs[0]?.href ?? '/admin/verification'

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    saveDismissedInsights(next)
  }

  const take = (row: AdminInsight) => navigate(row.href)

  const stats = [
    { label: 'Total Users', value: data ? String(data.users) : null },
    { label: 'Students', value: data ? String(data.students) : null },
    { label: 'Tutors', value: data ? String(data.tutors) : null },
    { label: 'Published Courses', value: data ? String(data.publishedCourses) : null },
    { label: 'Active Sessions', value: data ? String(data.activeSessions) : null },
    { label: 'Pending Reviews', value: data ? String(data.pendingReviews) : null },
    { label: 'Pending Tutor Verification', value: data ? (data.pendingVerification == null ? '—' : String(data.pendingVerification)) : null },
    { label: 'Platform Revenue', value: data ? 'No platform revenue yet' : null },
  ]

  const activity = data?.activity.slice(0, ACTIVITY_LIMIT) ?? []

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">LearnSyra Super Admin</p>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Super Admin</h1>
            <p className="text-[13px] font-semibold text-ink leading-tight">Platform Control Center</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGES.map(r => (
              <button key={r.id} type="button" className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold" data-on={range === r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
            ))}
            <button type="button" className="btn-primary text-xs ml-1" onClick={() => navigate(pendingHref)}>Review Pending</button>
          </div>
        </div>
        {range === 'custom' && (
          <div className="flex flex-wrap gap-3 mb-3">
            <label className="text-xs font-semibold text-muted">From<input type="date" className="field ml-2 px-3 py-1.5 text-sm" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label className="text-xs font-semibold text-muted">To<input type="date" className="field ml-2 px-3 py-1.5 text-sm" value={to} onChange={e => setTo(e.target.value)} /></label>
          </div>
        )}

        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
            <button type="button" className="btn-glass text-xs ml-2" onClick={() => setError(null)}>Continue with available data</button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          {stats.map(s => (
            <div key={s.label} className="glass rounded-xl ac-stat">
              <span>{s.label}</span>
              {s.value == null || loading ? <div className="ac-skel mt-1" /> : <strong className="text-ink" style={s.value.length > 10 ? { fontSize: '1rem' } : undefined}>{s.value}</strong>}
            </div>
          ))}
        </div>

        <section className="glass rounded-2xl px-3 py-2.5 mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <h2 className="font-black text-ink mb-0">Requires Attention</h2>
            {needs.length === 0 && !loading && <p className="text-xs text-muted">Nothing requires attention</p>}
          </div>
          {attention.map(row => (
            <div key={row.title} className={`ac-attn ${typeof row.count === 'number' && row.count > 0 ? 'ac-warn rounded-xl' : ''}`}>
              <div className="flex-1 min-w-0 font-semibold text-ink text-[13px]">{row.title}</div>
              <em className="text-[13px] text-ink">{row.count == null ? '—' : row.count}</em>
              <button type="button" className="text-xs font-semibold" style={{ background: 'none', border: 'none', color: '#5b4bd6' }} onClick={() => navigate(row.href)}>{row.action}</button>
            </div>
          ))}
        </section>

        <div className="grid lg:grid-cols-2 gap-3 mb-4">
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Platform Growth</h2>
            {!data || loading ? <div className="ac-skel h-20" /> : data.growth.length === 0 ? (
              <p className="text-[13px] text-muted">Platform growth data will appear as activity accumulates.</p>
            ) : (
              <>
                <p className="text-[11px] text-muted mb-1.5">Students · Tutors · Courses · Sessions</p>
                <div className="ac-bar" role="img" aria-label={data.growth.map(g => `${g.label}: ${g.students} students, ${g.tutors} tutors`).join('; ')}>
                  {data.growth.map(g => (
                    <span key={g.label} title={`${g.label}: students ${g.students}, tutors ${g.tutors}, courses ${g.courses}, sessions ${g.sessions}`}>
                      <i style={{ height: `${g.students === 0 || maxGrowth <= 0 ? 0 : (g.students / maxGrowth) * 76}px`, background: '#6c5ce7' }} />
                      <i style={{ height: `${g.tutors === 0 || maxGrowth <= 0 ? 0 : (g.tutors / maxGrowth) * 76}px`, background: '#8b5cf6' }} />
                      <i style={{ height: `${g.courses === 0 || maxGrowth <= 0 ? 0 : (g.courses / maxGrowth) * 76}px`, background: '#22c7d6' }} />
                      <i style={{ height: `${g.sessions === 0 || maxGrowth <= 0 ? 0 : (g.sessions / maxGrowth) * 76}px`, background: '#f59e0b' }} />
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Revenue Overview</h2>
            <p className="text-[13px] text-muted">Financial data unavailable.</p>
            <p className="text-[11px] text-muted mt-1">Gross, fees, refunds, and net appear when a payment ledger is connected. Tutor earnings stay on each tutor workspace.</p>
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-3 mb-4">
          <section className="ac-hero glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">✨ AI Platform Insights</h2>
            <p className="text-[11px] text-muted mb-2">Recommendations only. Nothing is changed automatically.</p>
            {insights.length === 0 && <p className="text-[13px] text-muted">Not enough platform activity for a recommendation.</p>}
            {insights.map(row => (
              <div key={row.id} className="flex flex-wrap items-start gap-2 py-1.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                <p className="text-[13px] text-ink flex-1 min-w-[12rem]">{row.observation}</p>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" className="text-xs font-semibold" style={{ background: 'none', border: 'none', color: '#5b4bd6' }} onClick={() => take(row)}>View →</button>
                  <button type="button" className="text-xs font-semibold text-muted" style={{ background: 'none', border: 'none' }} onClick={() => dismiss(row.id)}>Dismiss</button>
                </div>
              </div>
            ))}
          </section>
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Platform Health</h2>
            {(health ?? [
              { name: 'API', status: 'Checking…' },
              { name: 'Database', status: 'Checking…' },
              { name: 'Authentication', status: 'Checking…' },
              { name: 'Payments', status: 'Checking…' },
              { name: 'Bookings', status: 'Checking…' },
              { name: 'AI Services', status: 'Checking…' },
            ]).map(s => (
              <div key={s.name} className="ac-health">
                <span>{s.name}</span>
                <span className="text-muted">{s.status}</span>
              </div>
            ))}
          </section>
        </div>

        <section className="glass rounded-2xl px-3.5 py-2.5 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-black text-ink mb-0 mr-1">Quick Actions</h2>
            {[
              ['Review Tutors', '/admin/verification'],
              ['Review Courses', '/admin/courses'],
              ['Review Projects', '/admin/projects'],
              ['View Sessions', '/admin/sessions'],
              ['Review Reports', '/admin/reports'],
              ['View Payments', '/admin/payments'],
              ['View Users', '/admin/users'],
              ['Analytics', '/admin/analytics'],
            ].map(([label, href]) => (
              <button key={label} type="button" className="ac-pill" onClick={() => navigate(href)}>{label}</button>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-3.5">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h2 className="font-black text-ink mb-0">Recent Platform Activity</h2>
            <button type="button" className="text-xs font-semibold" style={{ background: 'none', border: 'none', color: '#5b4bd6' }} onClick={() => navigate('/admin/audit')}>View All Activity →</button>
          </div>
          {loading && <div className="ac-skel" />}
          {!loading && (!data || data.activity.length === 0) && <p className="text-[13px] text-muted">No recent platform activity.</p>}
          {activity.map(a => (
            <div key={a.id} className="ac-act">
              <span className="flex items-center gap-2 min-w-0">
                <i aria-hidden />
                <span className="truncate">{a.label}</span>
              </span>
              <span className="text-[11px] text-muted whitespace-nowrap">{new Date(a.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          ))}
        </section>
      </div>
    </AdminShell>
  )
}
