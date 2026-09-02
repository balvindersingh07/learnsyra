import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  formatPayoutInr,
  getTutorPayoutAccount,
  payoutAccountStatusLabel,
  saveTutorPayoutAccount,
  type TutorPayoutAccount,
} from '../lib/tutorPayouts'
import './tutor-earnings.css'

export default function TutorPayoutSettings() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || null
  const [account, setAccount] = useState<TutorPayoutAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [accountType, setAccountType] = useState<'bank' | 'upi'>('bank')
  const [maskedAccount, setMaskedAccount] = useState('')
  const [holderName, setHolderName] = useState('')

  const load = () => {
    if (!tutorId) {
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    getTutorPayoutAccount()
      .then(row => {
        setAccount(row)
        if (row) {
          setAccountType(row.account_type)
          setMaskedAccount(row.masked_account)
          setHolderName(row.account_holder_name || '')
        }
      })
      .catch(() => setError("We couldn't load payout settings."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tutorId])

  const connected = Boolean(account)
  const verified = account?.status === 'verified'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (account?.status === 'verified') {
      setNotice('A verified payout account is on file. Contact support to change verified details.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await saveTutorPayoutAccount({
      account_type: accountType,
      masked_account: maskedAccount.trim(),
      account_holder_name: holderName.trim() || undefined,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error || 'Could not save payout account.')
      return
    }
    if (result.account) setAccount(result.account)
    setNotice(result.message || 'Payout details saved securely. Razorpay verification is required before withdrawals.')
  }

  return (
    <div className="te-page pt-20 px-4 sm:px-6 pb-16 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Payout Settings</h1>
          <p className="text-muted">Manage how LearnSyra pays your tutoring earnings. Raw bank or UPI credentials are never stored in your browser.</p>
        </div>
        <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutor/earnings')}>← Earnings</button>
      </div>

      {error && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm" style={{ color: '#e11d48' }}>
          {error}
          <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
        </div>
      )}

      <section className="te-card glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Payout account status</h2>
        {loading ? (
          <div className="te-skel w-48" />
        ) : (
          <>
            <p className="text-sm font-semibold">{connected ? (verified ? '● Connected & verified' : '○ Connected — verification pending') : '○ Not connected'}</p>
            {account && (
              <dl className="text-sm mt-3 space-y-1">
                <Row k="Type" v={account.account_type === 'upi' ? 'UPI' : 'Bank account'} />
                <Row k="Account" v={account.masked_account} />
                {account.account_holder_name && <Row k="Name" v={account.account_holder_name} />}
                <Row k="Status" v={payoutAccountStatusLabel(account.status)} />
                <Row k="Provider" v="Razorpay Route (onboarding required)" />
              </dl>
            )}
            {!connected && (
              <p className="text-xs text-muted mt-3">
                Add masked payout details below. LearnSyra stores only masked identifiers server-side. Full Razorpay Route onboarding and verification must be completed before withdrawals are enabled.
              </p>
            )}
            {connected && !verified && (
              <p className="text-xs text-muted mt-3">
                Your details were saved securely. Razorpay Route verification has not completed yet, so the Request Payout button on Earnings stays disabled until an admin or provider marks this account verified.
              </p>
            )}
          </>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Add or update payout details</h2>
        <p className="text-xs text-muted mb-4">
          For bank accounts, enter only the last 4 digits (stored as ****1234). For UPI, enter your full UPI ID — it is stored as the masked display value and sent securely to the server; do not save credentials in localStorage.
        </p>
        <form className="space-y-4" onSubmit={submit}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Payout method</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="ptype" checked={accountType === 'bank'} onChange={() => setAccountType('bank')} disabled={verified} />
              Bank account (India)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="ptype" checked={accountType === 'upi'} onChange={() => setAccountType('upi')} disabled={verified} />
              UPI
            </label>
          </fieldset>
          <label className="block text-sm">
            <span className="font-semibold">{accountType === 'bank' ? 'Last 4 digits of account' : 'UPI ID'}</span>
            <input
              className="field w-full mt-1 px-3 py-2 text-sm"
              value={maskedAccount}
              onChange={e => setMaskedAccount(e.target.value)}
              placeholder={accountType === 'bank' ? '1234' : 'name@bank'}
              disabled={verified || busy}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Account holder name (optional)</span>
            <input
              className="field w-full mt-1 px-3 py-2 text-sm"
              value={holderName}
              onChange={e => setHolderName(e.target.value)}
              disabled={verified || busy}
              autoComplete="name"
            />
          </label>
          <button type="submit" className="btn-primary text-sm" disabled={busy || verified || !maskedAccount.trim()}>
            {busy ? 'Saving…' : verified ? 'Verified account on file' : 'Save payout details'}
          </button>
        </form>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-lg font-black text-ink mb-2">How payouts work</h2>
        <ul className="text-sm text-muted list-disc pl-5 space-y-1">
          <li>Earnings from paid sessions stay pending until the booking is marked completed.</li>
          <li>Available balance is calculated on the server when you view Earnings or request a payout.</li>
          <li>Withdrawals require a verified payout account and meet the minimum threshold.</li>
          <li>Razorpay Route transfer execution is integration-ready but not live until merchant credentials are activated.</li>
        </ul>
        <p className="text-sm mt-4">
          <Link to="/tutor/earnings" className="text-primary">View earnings & request payout →</Link>
        </p>
      </section>

      {notice && (
        <div className="te-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setNotice(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 className="text-lg font-black text-ink mb-2">Payout account</h2>
            <p className="text-sm text-muted mb-4">{notice}</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setNotice(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium text-right">{v}</dd>
    </div>
  )
}
