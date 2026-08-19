import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  formatMoney,
  formatWhen,
  isRefundApiAvailable,
  loadAdminPaymentIndex,
  loadPaymentNotes,
  savePaymentNote,
  type AdminPaymentIndex,
  type AdminPaymentTx,
} from '../lib/adminPayments'
import './admin-control.css'

export default function AdminPaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminPaymentIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [explain, setExplain] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminPaymentIndex()
      .then(setIndex)
      .catch(() => setError("Transaction details couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (id) setNote(loadPaymentNotes()[id] ?? '')
  }, [id])
  useEffect(() => {
    if (!explain) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        setExplain(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [explain])

  const tx: AdminPaymentTx | null = index?.rows.find(r => r.id === id) ?? null
  const refundApi = isRefundApiAvailable()
  const hasBreakdown = tx && (tx.amount != null || tx.refund != null || tx.fee != null || tx.net != null)

  return (
    <AdminShell>
      <div className="ac-dash">
        <button type="button" className="btn-glass text-xs mb-3" onClick={() => navigate('/admin/payments')}>← Payments</button>
        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {loading && <div className="ac-skel mb-4" aria-busy="true" />}
        {!loading && !index?.available && !error && (
          <section className="glass rounded-2xl p-5">
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Financial data unavailable</h1>
            <p className="text-[13px] text-muted">Transaction details couldn't be loaded. LearnSyra does not have a connected payment ledger yet.</p>
            <button type="button" className="btn-primary text-xs mt-3" onClick={load}>Retry</button>
          </section>
        )}
        {!loading && index?.available && !tx && !error && (
          <p className="text-[13px] text-muted">Transaction details couldn't be loaded. This ID is not in the payment ledger.</p>
        )}
        {tx && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{tx.id}</h1>
                <p className="text-[13px] text-muted">
                  {tx.status || 'Status unavailable'} · {tx.type || 'Type unavailable'} · {tx.createdAt ? formatWhen(tx.createdAt) : 'Date unavailable'}
                </p>
              </div>
              <button type="button" className="btn-glass text-xs" aria-disabled={!refundApi} onClick={() => setExplain('Refunds are not connected.')}>Refund</button>
            </div>
            {tx.demo && <div className="glass rounded-2xl p-3 mb-3 text-sm ac-warn">Demo Financial Data — Not Production Data</div>}
            {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}

            <div className="grid lg:grid-cols-2 gap-3 mb-3">
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Transaction</h2>
                <dl className="grid gap-1.5 text-[13px]">
                  <KV k="Transaction ID" v={tx.id} />
                  <KV k="Status" v={tx.status || '—'} />
                  <KV k="Date / time" v={tx.createdAt ? formatWhen(tx.createdAt) : '—'} />
                  <KV k="Completed" v={tx.completedAt ? formatWhen(tx.completedAt) : '—'} />
                  <KV k="Type" v={tx.type || '—'} />
                  <KV k="Amount" v={formatMoney(tx.amount, tx.currency)} />
                  <KV k="Currency" v={tx.currency || '—'} />
                  <KV k="Payer" v={tx.payerName || tx.payerId || '—'} />
                  <KV k="Payee" v={tx.payeeName || tx.payeeId || '—'} />
                  <KV k="Source" v={tx.source || '—'} />
                  <KV k="Reference" v={tx.reference || '—'} />
                  <KV k="Provider" v={tx.provider || 'Payment provider not connected.'} />
                </dl>
              </section>
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Financial breakdown</h2>
                {!hasBreakdown && <p className="text-[13px] text-muted">Financial data unavailable. Missing ledger fields are not calculated.</p>}
                {hasBreakdown && (
                  <dl className="grid gap-1.5 text-[13px]">
                    {tx.amount != null && <KV k="Gross" v={formatMoney(tx.amount, tx.currency)} />}
                    {tx.refund != null && <KV k="Refund" v={formatMoney(tx.refund, tx.currency)} />}
                    {tx.fee != null && <KV k="Platform fee" v={formatMoney(tx.fee, tx.currency)} />}
                    {tx.net != null && <KV k="Net" v={formatMoney(tx.net, tx.currency)} />}
                  </dl>
                )}
                {tx.failureReason && (
                  <>
                    <h2 className="font-black text-ink mt-3">Failure</h2>
                    <p className="text-[13px] text-muted">{tx.failureReason}</p>
                  </>
                )}
                <h2 className="font-black text-ink mt-3">Payouts</h2>
                <p className="text-[13px] text-muted">Payout infrastructure unavailable.</p>
              </section>
            </div>
            <section className="glass rounded-2xl p-3.5">
              <h2 className="font-black text-ink">Refund</h2>
              <p className="text-[13px] text-muted mb-2">Refunds are not connected.</p>
              <h2 className="font-black text-ink">Audit</h2>
              <p className="text-[13px] text-muted mb-3">Audit persistence is unavailable. Financial actions are not claimed as audited.</p>
              <label className="block text-[12px] font-semibold text-muted">
                Admin notes
                <textarea className="field mt-1 w-full px-3 py-2 text-sm" rows={3} value={note} onChange={e => setNote(e.target.value)} />
              </label>
              <button type="button" className="btn-glass text-xs mt-2" onClick={() => { savePaymentNote(tx.id, note); setMsg('Admin note saved in the Admin-only payment notes store.') }}>Save note</button>
            </section>
          </>
        )}
      </div>

      {explain && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="pay-mod-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExplain(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="pay-mod-title" className="text-lg font-black text-ink mb-2">Unavailable</h2>
            <p className="text-sm text-muted mb-4">{explain}</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setExplain(null)}>Close</button>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted shrink-0">{k}</dt><dd className="font-medium text-right break-all">{v}</dd></div>
}
