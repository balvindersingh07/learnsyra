import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  getAdminAnalytics,
  selectedPeriodLabel,
  type AdminAnalytics,
  type AdminRange,
  type MetricCard,
} from '../lib/adminAnalytics'
import './admin-control.css'

const RANGES: { id: AdminRange; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: 'custom', label: 'Custom' },
]

export default function AdminAnalytics() {
  const navigate = useNavigate()
  const [range, setRange] = useState<AdminRange>('30d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const customReady = range !== 'custom' || (from && to && from <= to)

  const load = () => {
    if (!customReady) return
    setError(null)
    setLoading(true)
    getAdminAnalytics(range, { from, to })
      .then(setData)
      .catch(() => setError("Analytics couldn't be loaded right now."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [range, from, to])
  useEffect(() => {
    if (!customOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setCustomOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [customOpen])

  const pickRange = (id: AdminRange) => {
    if (id === 'custom') {
      setDraftFrom(from)
      setDraftTo(to)
      setCustomError(null)
      setCustomOpen(true)
      return
    }
    setCustomOpen(false)
    setRange(id)
  }

  const applyCustom = () => {
    if (!draftFrom || !draftTo) {
      setCustomError('Start date and end date are required.')
      return
    }
    if (draftFrom > draftTo) {
      setCustomError('Start date must be on or before the end date.')
      return
    }
    setCustomError(null)
    setFrom(draftFrom)
    setTo(draftTo)
    setRange('custom')
    setCustomOpen(false)
  }

  const maxGrowth = Math.max(1, ...(data?.growth ?? []).flatMap(g => [g.students, g.tutors, g.total]))
  const maxSession = Math.max(1, ...(data?.sessionChart ?? []).flatMap(g => [g.upcoming, g.completed, g.cancelled]))
  const maxLearn = Math.max(1, ...(data?.projectActivity ?? []).flatMap(g => [g.enrollments, g.starts, g.submissions]))
  const distMax = data?.distribution ? Math.max(1, data.distribution.students, data.distribution.tutors, data.distribution.admins) : 1

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Platform Analytics</h1>
            <p className="text-[13px] text-muted">Understand growth, learning activity, and platform performance.</p>
            <p className="text-[12px] text-muted mt-1">Selected Period: {selectedPeriodLabel(range, { from, to })} · Lifetime totals stay labeled separately.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div role="tablist" aria-label="Date range" className="flex flex-wrap gap-1">
              {RANGES.map(r => (
                <button key={r.id} type="button" role="tab" aria-selected={range === r.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold" data-on={range === r.id} onClick={() => pickRange(r.id)}>{r.label}</button>
              ))}
            </div>
            <button type="button" className="btn-glass text-xs" onClick={load}>Refresh</button>
          </div>
        </div>

        {loading && <p className="text-[13px] text-muted mb-3" aria-live="polite">Loading analytics...</p>}
        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {data?.failed.length ? (
          <p className="text-[12px] text-muted mb-3">Some sources could not be loaded: {data.failed.join(', ')}. Available metrics are shown below.</p>
        ) : null}
        {data?.demoExcluded && <div className="glass rounded-2xl p-3 mb-4 text-sm ac-warn">Demo records are excluded from these metrics.</div>}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          {(data?.overview ?? ['Total Users', 'Students', 'Tutors', 'Courses', 'Projects', 'Sessions'].map(label => ({ label, value: '—', hint: 'Lifetime', delta: null as string | null }))).map(m => (
            <Stat key={m.label} metric={m} loading={loading && !data} />
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-3 mb-4">
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">User Growth</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(data?.periodUsers ?? []).map(m => <Stat key={m.label} metric={m} loading={loading && !data} />)}
            </div>
            {loading && !data && <div className="ac-skel h-20" />}
            {data && !data.growthAvailable && <p className="text-[13px] text-muted">User growth data unavailable.</p>}
            {data?.growthAvailable && data.growth.length === 0 && <p className="text-[13px] text-muted">No activity data for this period.</p>}
            {data?.growthAvailable && data.growth.length > 0 && (
              <>
                <p className="text-[11px] text-muted mb-1.5">Students · Tutors · Total users</p>
                <div className="ac-chart-scroll">
                  <div className="ac-bar min-w-[16rem]" role="img" aria-label={data.growth.map(g => `${g.label}: ${g.students} students, ${g.tutors} tutors, ${g.total} total`).join('; ')}>
                    {data.growth.map(g => (
                      <span key={g.label} title={`${g.label}: ${g.students} students, ${g.tutors} tutors, ${g.total} total`}>
                        <i style={{ height: `${Math.max(6, (g.students / maxGrowth) * 76)}px`, background: '#6c5ce7' }} />
                        <i style={{ height: `${Math.max(6, (g.tutors / maxGrowth) * 76)}px`, background: '#8b5cf6' }} />
                        <i style={{ height: `${Math.max(6, (g.total / maxGrowth) * 76)}px`, background: '#22c7d6' }} />
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
            <p className="text-[12px] text-muted mt-2">{data?.activeUsersNote}</p>
          </section>
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Student / Tutor distribution</h2>
            {!data?.distribution && <p className="text-[13px] text-muted">{loading ? '' : 'Data unavailable'}</p>}
            {data?.distribution && (
              <>
                <p className="sr-only">{`Students ${data.distribution.students}, tutors ${data.distribution.tutors}, admins ${data.distribution.admins}.`}</p>
                {(['students', 'tutors', 'admins'] as const).map(k => (
                  <div key={k} className="ac-health">
                    <span className="capitalize">{k}</span>
                    <span className="font-semibold">{data.distribution![k].toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="ac-bar mt-2" role="img" aria-label="Role distribution">
                  {(['students', 'tutors', 'admins'] as const).map(k => (
                    <span key={k}>
                      <i style={{ height: `${Math.max(6, (data.distribution![k] / distMax) * 76)}px`, background: k === 'students' ? '#6c5ce7' : k === 'tutors' ? '#8b5cf6' : '#94a3b8' }} />
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <section className="glass rounded-2xl p-3.5 mb-4">
          <h2 className="font-black text-ink">Learning Activity</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            {(data?.learning ?? []).map(m => <Stat key={m.label} metric={m} loading={loading && !data} />)}
          </div>
          <p className="text-[12px] text-muted">{data?.lessonActivity}</p>
          {data?.projectChartAvailable && (
            <div className="ac-chart-scroll mt-2">
              <p className="text-[11px] text-muted mb-1.5">Enrollments · Project starts · Submissions</p>
              <div className="ac-bar min-w-[16rem]" role="img" aria-label={data.projectActivity.map(g => `${g.label}: ${g.enrollments} enrollments, ${g.starts} starts, ${g.submissions} submissions`).join('; ')}>
                {data.projectActivity.map(g => (
                  <span key={g.label} title={`${g.label}: enroll ${g.enrollments}, starts ${g.starts}, submissions ${g.submissions}`}>
                    <i style={{ height: `${Math.max(6, (g.enrollments / maxLearn) * 76)}px`, background: '#6c5ce7' }} />
                    <i style={{ height: `${Math.max(6, (g.starts / maxLearn) * 76)}px`, background: '#22c7d6' }} />
                    <i style={{ height: `${Math.max(6, (g.submissions / maxLearn) * 76)}px`, background: '#f59e0b' }} />
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-2 gap-3 mb-4">
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Course Performance</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(data?.courses ?? []).map(m => <Stat key={m.label} metric={m} loading={loading && !data} />)}
            </div>
            <p className="text-[12px] text-muted">Average rating {data?.courseReviews.average ?? '—'} from {data?.courseReviews.count ?? '—'} real reviews.</p>
            <p className="text-[12px] text-muted mt-1">{data?.courseCompletion}</p>
            {data && data.topCourses.length === 0 && <p className="text-[13px] text-muted mt-2">Course performance data unavailable.</p>}
            {data && data.topCourses.length > 0 && (
              <ul className="mt-2 text-[13px]">
                {data.topCourses.map((c, i) => (
                  <li key={c.id} className="ac-health">
                    <span>{i + 1}. {c.name}</span>
                    <span>{c.count.toLocaleString('en-IN')} enrollments</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Project Activity</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(data?.projects ?? []).map(m => <Stat key={m.label} metric={m} loading={loading && !data} />)}
            </div>
            <p className="text-[12px] text-muted">{data?.projectCompletion}</p>
            <p className="text-[11px] text-muted mt-1">Catalog projects are not counted as completed student projects.</p>
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-3 mb-4">
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Sessions</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(data?.sessions ?? []).map(m => <Stat key={m.label} metric={m} loading={loading && !data} />)}
            </div>
            {data && !data.sessionChartAvailable && <p className="text-[13px] text-muted">No activity data for this period.</p>}
            {data?.sessionChartAvailable && (
              <div className="ac-chart-scroll">
                <p className="text-[11px] text-muted mb-1.5">Upcoming · Completed · Cancelled</p>
                <div className="ac-bar min-w-[16rem]" role="img" aria-label={data.sessionChart.map(g => `${g.label}: ${g.upcoming} upcoming, ${g.completed} completed, ${g.cancelled} cancelled`).join('; ')}>
                  {data.sessionChart.map(g => (
                    <span key={g.label} title={`${g.label}: upcoming ${g.upcoming}, completed ${g.completed}, cancelled ${g.cancelled}`}>
                      <i style={{ height: `${Math.max(6, (g.upcoming / maxSession) * 76)}px`, background: '#6c5ce7' }} />
                      <i style={{ height: `${Math.max(6, (g.completed / maxSession) * 76)}px`, background: '#20c997' }} />
                      <i style={{ height: `${Math.max(6, (g.cancelled / maxSession) * 76)}px`, background: '#f59e0b' }} />
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[12px] text-muted mt-2">{data?.duration}</p>
            <p className="text-[12px] text-muted">{data?.attendance}</p>
          </section>
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Tutor Marketplace</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(data?.marketplace ?? []).map(m => <Stat key={m.label} metric={m} loading={loading && !data} />)}
            </div>
            <p className="text-[12px] text-muted">{data?.marketplaceExtra || 'Marketplace analytics unavailable.'}</p>
            {data && data.topTutors.length === 0 && <p className="text-[13px] text-muted mt-2">Top tutors unavailable. Completed session activity is not high enough to rank.</p>}
            {data && data.topTutors.length > 0 && (
              <ul className="mt-2 text-[13px]">
                {data.topTutors.map((t, i) => (
                  <li key={t.id} className="ac-health">
                    <span>{i + 1}. {t.name}</span>
                    <span>{t.count.toLocaleString('en-IN')} completed sessions</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="glass rounded-2xl p-3.5 mb-4">
          <h2 className="font-black text-ink">Career Activity</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            {(data?.career ?? []).map(m => <Stat key={m.label} metric={m} loading={loading && !data} />)}
          </div>
          <p className="text-[13px] font-semibold text-ink">{data?.hiringNote}</p>
        </section>

        <div className="grid lg:grid-cols-2 gap-3 mb-4">
          <section className="ac-hero glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">AI Platform Insights</h2>
            <p className="text-[11px] text-muted mb-2">Recommendations only. Insights never change accounts, courses, or sessions automatically.</p>
            {data && data.insights.length === 0 && <p className="text-[13px] text-muted">Not enough observed activity for a recommendation in this period.</p>}
            {data?.insights.map(row => (
              <article key={row.id} className="py-2" style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                <p className="text-[13px] font-semibold text-ink">{row.insight}</p>
                <p className="text-[12px] text-muted">{row.evidence}</p>
                <button type="button" className="text-xs font-semibold mt-1" style={{ background: 'none', border: 'none', color: '#5b4bd6' }} onClick={() => navigate(row.href)}>{row.actionLabel} →</button>
              </article>
            ))}
          </section>
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Platform Health</h2>
            {(data?.health ?? []).map(h => (
              <div key={h.name} className="ac-health">
                <span>{h.name}</span>
                <span className="text-muted">{h.status}</span>
              </div>
            ))}
            {!data && <p className="text-[13px] text-muted">Status unavailable</p>}
          </section>
        </div>

        <div className="grid lg:grid-cols-3 gap-3 mb-4">
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Financial</h2>
            <p className="text-[13px] text-muted">{data?.finance.summary || 'Financial analytics unavailable.'}</p>
            <button type="button" className="btn-glass text-xs mt-2" onClick={() => navigate('/admin/payments')}>View Payments →</button>
          </section>
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Reports</h2>
            <p className="text-[13px] text-muted">{data?.reports.summary || 'Reporting analytics unavailable.'}</p>
            {data && (
              <p className="text-[12px] text-muted mt-1">Open {data.reports.open} · Resolved {data.reports.resolved}</p>
            )}
            <button type="button" className="btn-glass text-xs mt-2" onClick={() => navigate('/admin/reports')}>View Reports →</button>
          </section>
          <section className="glass rounded-2xl p-3.5">
            <h2 className="font-black text-ink">Verification</h2>
            <p className="text-[13px] text-muted">{data?.verification.summary || 'Verification analytics unavailable.'}</p>
            <button type="button" className="btn-glass text-xs mt-2" onClick={() => navigate('/admin/verification')}>Tutor Verification →</button>
          </section>
        </div>

        <section className="glass rounded-2xl p-3.5 mb-4">
          <h2 className="font-black text-ink">Recent Platform Activity</h2>
          <p className="text-[11px] text-muted mb-2">{data?.activityNote}</p>
          {data && data.activity.length === 0 && <p className="text-[13px] text-muted">No activity data for this period.</p>}
          {data?.activity.map(a => (
            <div key={a.id} className="ac-act">
              <span className="flex items-center gap-2 min-w-0">
                <i aria-hidden />
                <span className="truncate">{a.label}</span>
              </span>
              <span className="text-[11px] text-muted whitespace-nowrap">{new Date(a.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          ))}
        </section>

        {!loading && data && data.overview.every(m => m.value === '—') && (
          <section className="glass rounded-2xl p-5 text-center mb-4">
            <h2 className="font-black text-ink">Analytics data unavailable</h2>
            <p className="text-[13px] text-muted">Some platform analytics require activity tracking that is not connected yet.</p>
          </section>
        )}

        <p className="text-[11px] text-muted">{data?.exportNote}</p>
      </div>

      {customOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="an-custom-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setCustomOpen(false)} />
          <form className="glass rounded-3xl p-6 relative z-10 w-full max-w-md" onSubmit={e => { e.preventDefault(); applyCustom() }}>
            <h2 id="an-custom-title" className="text-lg font-black text-ink mb-2">Custom date range</h2>
            <p className="text-[13px] text-muted mb-3">Start date must be on or before the end date.</p>
            <label className="block text-[12px] font-semibold text-muted mb-2">
              Start date
              <input type="date" className="field mt-1 w-full px-3 py-2 text-sm" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} required />
            </label>
            <label className="block text-[12px] font-semibold text-muted mb-3">
              End date
              <input type="date" className="field mt-1 w-full px-3 py-2 text-sm" value={draftTo} onChange={e => setDraftTo(e.target.value)} required />
            </label>
            {customError && <p className="text-[12px] mb-3" style={{ color: '#e11d48' }}>{customError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary text-sm">Apply</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setCustomOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  )
}

function Stat({ metric, loading }: { metric: MetricCard; loading: boolean }) {
  return (
    <div className="glass rounded-xl ac-stat">
      <span>{metric.label}</span>
      {loading ? <div className="ac-skel mt-1" /> : <strong className="text-ink">{metric.value}</strong>}
      <span className="text-[10px] font-medium">{metric.hint}</span>
      {metric.delta && !loading && <span className="text-[10px]">{metric.delta === 'Comparison unavailable' ? metric.delta : `${metric.delta} vs previous period`}</span>}
    </div>
  )
}
