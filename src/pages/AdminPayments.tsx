import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  filterPayments,
  formatMoney,
  formatWhen,
  isFinancialExportAvailable,
  isPayoutInfrastructureAvailable,
  isStatementGenerationAvailable,
  loadAdminPaymentIndex,
  paginate,
  paymentStats,
  paymentsPageSize,
  uniquePayees,
  uniquePayers,
  uniquePaymentValues,
  type AdminPaymentIndex,
  type AdminPaymentTx,
  type PaymentDateFilter,
  type PaymentQuery,
  type PaymentSort,
  type PaymentTab,
} from '../lib/adminPayments'
import './admin-control.css'

const TABS: { id: PaymentTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
]

export default function AdminPayments() {
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminPaymentIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<PaymentTab>('all')
  const [q, setQ] = useState('')
  const [date, setDate] = useState<PaymentDateFilter>('any')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [currency, setCurrency] = useState('')
  const [tutorId, setTutorId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [sort, setSort] = useState<PaymentSort>('newest')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminPaymentIndex()
      .then(setIndex)
      .catch(() => setError("Financial data couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [tab, q, date, customFrom, customTo, status, type, currency, tutorId, studentId, sort])
  useEffect(() => {
    if (!filtersOpen && !notice) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (notice && e.key === 'Enter')) {
        e.preventDefault()
        setFiltersOpen(false)
        setNotice(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen, notice])

  const available = index?.available ?? false
  const rows = index?.rows ?? []
  const query: PaymentQuery = useMemo(() => ({
    tab, q, date, customFrom, customTo, status, type, currency, tutorId, studentId, sort,
  }), [tab, q, date, customFrom, customTo, status, type, currency, tutorId, studentId, sort])
  const filtered = useMemo(() => (available ? filterPayments(rows, query) : []), [available, rows, query])
  const pager = paginate(filtered, page)
  const stats = index ? paymentStats(index) : null
  const statuses = uniquePaymentValues(rows, 'status')
  const types = uniquePaymentValues(rows, 'type')
  const currencies = uniquePaymentValues(rows, 'currency')
  const payees = uniquePayees(rows)
  const payers = uniquePayers(rows)
  const hasDemo = rows.some(r => r.demo)
  const hasTimestamps = rows.some(r => r.createdAt)
  const exportOk = isFinancialExportAvailable()
  const payoutOk = isPayoutInfrastructureAvailable()
  const statementsOk = isStatementGenerationAvailable()

  const filters = available && (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {hasTimestamps && (
        <label className="text-[11px] font-semibold text-muted">
          Date
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={date} onChange={e => setDate(e.target.value as PaymentDateFilter)}>
            <option value="any">All dates</option>
            <option value="today">Today</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="3m">3 months</option>
            <option value="6m">6 months</option>
            <option value="1y">1 year</option>
            <option value="custom">Custom</option>
          </select>
        </label>
      )}
      {statuses.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Status
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All</option>
            {statuses.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {types.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Type
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={type} onChange={e => setType(e.target.value)}>
            <option value="">All</option>
            {types.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {currencies.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Currency
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="">All</option>
            {currencies.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      )}
      {payees.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Tutor / payee
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={tutorId} onChange={e => setTutorId(e.target.value)}>
            <option value="">All</option>
            {payees.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
      {payers.length > 0 && (
        <label className="text-[11px] font-semibold text-muted">
          Student / payer
          <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">All</option>
            {payers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      <label className="text-[11px] font-semibold text-muted">
        Sort
        <select className="field mt-1 w-full px-2 py-1.5 text-sm" value={sort} onChange={e => setSort(e.target.value as PaymentSort)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest amount</option>
          <option value="lowest">Lowest amount</option>
          <option value="status">Status</option>
        </select>
      </label>
    </div>
  )

  return (
    <AdminShell>
      <div className="ac-dash">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Payments & Financial Center</h1>
            <p className="text-[13px] text-muted">Monitor real platform transactions and financial activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {available && <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFiltersOpen(true)}>Filters</button>}
            <button type="button" className="btn-glass text-xs" onClick={() => available && hasTimestamps ? setDate('30d') : setNotice('Date filtering unavailable.')}>Date Range</button>
            <button type="button" className="btn-glass text-xs" onClick={load}>Refresh</button>
          </div>
        </div>

        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {hasDemo && (
          <div className="glass rounded-2xl p-3 mb-4 text-sm ac-warn">Demo Financial Data — Not Production Data. Demo records are excluded from totals.</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
          {[
            ['Total Volume', loading ? null : stats?.volume],
            ['This Month', loading ? null : stats?.month],
            ['Completed', loading ? null : stats?.completed],
            ['Pending', loading ? null : stats?.pending],
            ['Refunded', loading ? null : stats?.refunded],
            ['Net', loading ? null : stats?.net],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl ac-stat">
              <span>{k}</span>
              {v == null ? <div className="ac-skel mt-1" /> : <strong className="text-ink" style={String(v).length > 8 ? { fontSize: '1rem' } : undefined}>{v}</strong>}
            </div>
          ))}
        </div>
        {!loading && !available && <p className="text-[13px] text-muted mb-4">Financial data unavailable</p>}

        {loading && (
          <div className="space-y-2 mb-3" aria-busy="true" aria-label="Loading financial data">
            <div className="ac-skel h-20" />
          </div>
        )}

        {!loading && !available && (
          <section className="glass rounded-2xl p-5 mb-4 text-center">
            <div className="text-3xl mb-2" aria-hidden>💳</div>
            <h2 className="font-black text-ink">Financial data unavailable</h2>
            <p className="text-[13px] text-muted max-w-xl mx-auto">
              LearnSyra does not have a connected payment ledger yet. Transaction, refund, fee, payout, and revenue data will appear here once financial infrastructure is connected.
            </p>
            <p className="text-[12px] text-muted mt-2">Enrollment is not a purchase. Booking hourly rate is not revenue. Payment provider not connected.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              <button type="button" className="btn-primary text-xs" onClick={load}>Refresh</button>
            </div>
            <p className="text-[11px] text-muted mt-3">Payout infrastructure unavailable. Financial export will be available when reporting is connected. Statements unavailable until financial reporting is connected.</p>
          </section>
        )}

        {available && (
          <>
            <p className="text-[12px] text-muted mb-3">{index?.provider ? `Provider: ${index.provider}` : 'Payment provider not connected.'}</p>
            <div className="flex flex-nowrap gap-1.5 mb-3 overflow-x-auto" role="tablist" aria-label="Transaction status">
              {TABS.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <label className="sr-only" htmlFor="tx-search">Search transaction</label>
              <input id="tx-search" className="field flex-1 min-w-[12rem] px-3 py-1.5 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search transaction..." />
              {q && <button type="button" className="btn-glass text-xs" onClick={() => setQ('')}>Clear Search</button>}
            </div>
            {date === 'custom' && hasTimestamps && (
              <div className="flex flex-wrap gap-2 mb-3">
                <label className="text-[11px] font-semibold text-muted">From<input type="date" className="field ml-2 px-2 py-1.5 text-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label>
                <label className="text-[11px] font-semibold text-muted">To<input type="date" className="field ml-2 px-2 py-1.5 text-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label>
              </div>
            )}
            <div className="hidden lg:block mb-3">{filters}</div>
            {!hasTimestamps && <p className="text-[12px] text-muted mb-3">Date filtering unavailable.</p>}
            <p className="text-[12px] text-muted mb-3">Financial activity will appear once payment data is connected. Not enough financial data for a volume chart.</p>
            {!exportOk && <p className="text-[12px] text-muted mb-3">Financial export will be available when reporting is connected.</p>}
            {!payoutOk && <p className="text-[12px] text-muted mb-3">Payout infrastructure unavailable.</p>}
            {!statementsOk && <p className="text-[12px] text-muted mb-3">Statements unavailable until financial reporting is connected.</p>}

            {pager.total === 0 && <p className="text-[13px] text-muted mb-3">No transactions yet.</p>}
            {pager.total > 0 && (
              <div className="ac-desktop-table glass rounded-2xl ac-table mb-3">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] text-muted">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Transaction</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Payer</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.slice.map((tx: AdminPaymentTx) => (
                      <tr key={tx.id} style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                        <td className="px-3 py-2">{tx.createdAt ? formatWhen(tx.createdAt) : '—'}</td>
                        <td className="px-3 py-2 font-semibold">{tx.id}{tx.demo ? ' · Demo' : ''}</td>
                        <td className="px-3 py-2">{tx.type || '—'}</td>
                        <td className="px-3 py-2">{tx.payerName || '—'}</td>
                        <td className="px-3 py-2">{formatMoney(tx.amount, tx.currency)}</td>
                        <td className="px-3 py-2">{tx.status || '—'}</td>
                        <td className="px-3 py-2">{tx.reference || '—'}</td>
                        <td className="px-3 py-2">
                          <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/payments/${tx.id}`)}>View →</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="ac-mobile-cards space-y-2 mb-3">
              {pager.slice.map((tx: AdminPaymentTx) => (
                <article key={tx.id} className="glass rounded-2xl p-3">
                  <div className="font-semibold text-ink">{tx.id}</div>
                  <p className="text-[12px] text-muted">{tx.createdAt ? formatWhen(tx.createdAt) : '—'} · {tx.type || '—'} · {formatMoney(tx.amount, tx.currency)} · {tx.status || '—'}</p>
                  <button type="button" className="btn-primary text-xs mt-2" onClick={() => navigate(`/admin/payments/${tx.id}`)}>View →</button>
                </article>
              ))}
            </div>
            {pager.total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <p className="text-muted">Showing {pager.from}–{pager.to} of {pager.total}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-glass text-xs" disabled={pager.page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                  <span className="text-xs py-2">Page {pager.page} of {pager.pages}</span>
                  <button type="button" className="btn-glass text-xs" disabled={pager.page >= pager.pages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted mt-2">Page size {paymentsPageSize()}. Enrollments and booking rates are not treated as payments.</p>
          </>
        )}
      </div>

      {filtersOpen && available && (
        <div className="ac-drawer fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="glass w-80 max-w-[90vw] h-full p-5 overflow-y-auto">
            <h2 className="text-lg font-black text-ink mb-3">Filters</h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setFiltersOpen(false)}>Apply</button>
          </div>
          <button type="button" className="flex-1" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setFiltersOpen(false)} />
        </div>
      )}
      {notice && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="pay-notice-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setNotice(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="pay-notice-title" className="text-lg font-black text-ink mb-2">Unavailable</h2>
            <p className="text-sm text-muted mb-4">{notice}</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setNotice(null)}>Close</button>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
