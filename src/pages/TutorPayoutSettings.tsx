import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getTutorPayoutAccount,
  onboardTutorRouteAccount,
  routeOnboardingPhase,
  routeOnboardingStatusLabel,
  saveTutorPayoutAccount,
  type TutorPayoutAccount,
} from '../lib/tutorPayouts'
import './tutor-earnings.css'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Puducherry', 'Chandigarh', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep',
]

export default function TutorPayoutSettings() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || null
  const [account, setAccount] = useState<TutorPayoutAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [routeDisabled, setRouteDisabled] = useState(false)

  // Legacy masked-only fallback (when RAZORPAY_ROUTE_ENABLED is false)
  const [accountType, setAccountType] = useState<'bank' | 'upi'>('bank')
  const [maskedAccount, setMaskedAccount] = useState('')
  const [holderName, setHolderName] = useState('')

  // Route onboarding fields (sensitive values stay in component state only)
  const [contactName, setContactName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(session?.user.email || '')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [pan, setPan] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState(profile?.full_name || '')
  const [tncAccepted, setTncAccepted] = useState(false)

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
          if (row.account_holder_name) {
            setContactName(row.account_holder_name)
            setBeneficiaryName(row.account_holder_name)
          }
          if (row.verification_metadata?.route_enabled === false) setRouteDisabled(true)
        }
      })
      .catch(() => setError("We couldn't load payout settings."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tutorId])

  useEffect(() => {
    if (profile?.full_name) {
      setContactName(prev => prev || profile.full_name || '')
      setBeneficiaryName(prev => prev || profile.full_name || '')
    }
    if (session?.user.email) setEmail(prev => prev || session.user.email || '')
  }, [profile?.full_name, session?.user.email])

  const phase = routeOnboardingPhase(account)
  const verified = account?.status === 'verified' || phase === 'activated'
  const canRetry = phase === 'failed' || phase === 'needs_clarification' || phase === 'not_connected' || phase === 'submitted' || phase === 'under_review'
  const formLocked = verified || busy

  const submitRoute = async (e: FormEvent) => {
    e.preventDefault()
    if (verified) {
      setNotice('A verified payout account is on file. Contact support to change verified details.')
      return
    }
    if (!tncAccepted) {
      setError('Please accept Razorpay Route terms to continue.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await onboardTutorRouteAccount({
      contact_name: contactName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      postal_code: postalCode.trim(),
      pan: pan.trim(),
      account_number: accountNumber.trim(),
      ifsc: ifsc.trim(),
      beneficiary_name: (beneficiaryName || contactName).trim(),
      tnc_accepted: true,
    })
    setBusy(false)

    // Clear sensitive fields from memory after submit attempt
    setPan('')
    setAccountNumber('')

    if (result.code === 'route_disabled') {
      setRouteDisabled(true)
      setError(null)
      setNotice('Route API onboarding is not enabled on this environment yet. You can still save masked payout details below.')
      return
    }

    if (!result.ok) {
      setError(result.error || 'Could not complete Route onboarding.')
      if (result.account) setAccount(result.account)
      return
    }

    if (result.account) setAccount(result.account)
    setNotice(result.message || 'Onboarding submitted to Razorpay Route.')
    load()
  }

  const submitLegacy = async (e: FormEvent) => {
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
          <p className="text-muted">Connect your bank account for tutoring earnings. Sensitive KYC details are sent securely and are not stored in LearnSyra.</p>
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
            <p className="text-sm font-semibold">
              {phase === 'activated' ? '● ' : '○ '}
              {routeOnboardingStatusLabel(phase)}
            </p>
            {account && (
              <dl className="text-sm mt-3 space-y-1">
                <Row k="Type" v={account.account_type === 'upi' ? 'UPI' : 'Bank account'} />
                <Row k="Account" v={account.masked_account} />
                {account.account_holder_name && <Row k="Name" v={account.account_holder_name} />}
                <Row k="Status" v={routeOnboardingStatusLabel(phase)} />
                <Row k="Provider" v="Razorpay Route" />
                {account.provider_account_id && <Row k="Linked account" v={account.provider_account_id} />}
              </dl>
            )}
            {account?.verification_metadata?.last_error && phase === 'failed' && (
              <p className="text-xs mt-3" style={{ color: '#e11d48' }}>{account.verification_metadata.last_error}</p>
            )}
            {account?.verification_metadata?.requirements && account.verification_metadata.requirements.length > 0 && (
              <ul className="text-xs text-muted mt-3 list-disc pl-5 space-y-1">
                {account.verification_metadata.requirements.slice(0, 6).map(r => (
                  <li key={`${r.field_reference}-${r.reason_code}`}>{r.field_reference}: {r.reason_code || r.status}</li>
                ))}
              </ul>
            )}
            {phase === 'not_connected' && (
              <p className="text-xs text-muted mt-3">
                Submit the form below to create your Razorpay Route Linked Account. LearnSyra stores only a masked account display and onboarding status.
              </p>
            )}
            {(phase === 'submitted' || phase === 'under_review' || phase === 'needs_clarification') && (
              <p className="text-xs text-muted mt-3">
                Your onboarding was submitted to Razorpay. Withdrawals stay locked until the Linked Account is activated.
              </p>
            )}
          </>
        )}
      </section>

      {!routeDisabled && (
        <section className="glass rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-black text-ink mb-2">
            {verified ? 'Route account on file' : phase === 'failed' ? 'Retry Route onboarding' : 'Razorpay Route onboarding'}
          </h2>
          <p className="text-xs text-muted mb-4">
            Required for individual tutors: identity, address, PAN, and bank settlement details. PAN and full account number are sent only to Razorpay and are not saved in LearnSyra.
          </p>
          <form className="space-y-4" onSubmit={submitRoute} autoComplete="off">
            <label className="block text-sm">
              <span className="font-semibold">Legal full name</span>
              <input className="field w-full mt-1 px-3 py-2 text-sm" value={contactName} onChange={e => setContactName(e.target.value)} disabled={formLocked} required />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-semibold">Mobile number</span>
                <input className="field w-full mt-1 px-3 py-2 text-sm" value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile" disabled={formLocked} required inputMode="numeric" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">Email</span>
                <input className="field w-full mt-1 px-3 py-2 text-sm" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={formLocked} required />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-semibold">Street address</span>
              <input className="field w-full mt-1 px-3 py-2 text-sm" value={street} onChange={e => setStreet(e.target.value)} disabled={formLocked} required minLength={10} />
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block text-sm">
                <span className="font-semibold">City</span>
                <input className="field w-full mt-1 px-3 py-2 text-sm" value={city} onChange={e => setCity(e.target.value)} disabled={formLocked} required />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">State</span>
                <select className="field w-full mt-1 px-3 py-2 text-sm" value={state} onChange={e => setState(e.target.value)} disabled={formLocked} required>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-semibold">PIN code</span>
                <input className="field w-full mt-1 px-3 py-2 text-sm" value={postalCode} onChange={e => setPostalCode(e.target.value)} disabled={formLocked} required inputMode="numeric" maxLength={6} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-semibold">PAN (individual)</span>
              <input className="field w-full mt-1 px-3 py-2 text-sm" value={pan} onChange={e => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" disabled={formLocked} required autoComplete="off" maxLength={10} />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-semibold">Bank account number</span>
                <input className="field w-full mt-1 px-3 py-2 text-sm" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} disabled={formLocked} required autoComplete="off" inputMode="numeric" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">IFSC</span>
                <input className="field w-full mt-1 px-3 py-2 text-sm" value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" disabled={formLocked} required autoComplete="off" maxLength={11} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-semibold">Beneficiary name</span>
              <input className="field w-full mt-1 px-3 py-2 text-sm" value={beneficiaryName} onChange={e => setBeneficiaryName(e.target.value)} disabled={formLocked} required />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={tncAccepted} onChange={e => setTncAccepted(e.target.checked)} disabled={formLocked} />
              <span>I accept Razorpay Route terms and confirm the details above are accurate for payout onboarding.</span>
            </label>
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={formLocked || !canRetry || !tncAccepted}
            >
              {busy ? 'Submitting to Razorpay…' : verified ? 'Verified account on file' : phase === 'failed' ? 'Retry onboarding' : 'Submit Route onboarding'}
            </button>
          </form>
        </section>
      )}

      {routeDisabled && (
        <section className="glass rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-black text-ink mb-2">Add or update payout details</h2>
          <p className="text-xs text-muted mb-4">
            Route API onboarding is disabled in this environment. For bank accounts, enter only the last 4 digits (stored as ****1234). For UPI, enter your UPI ID.
          </p>
          <form className="space-y-4" onSubmit={submitLegacy}>
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
      )}

      <section className="glass rounded-2xl p-5">
        <h2 className="text-lg font-black text-ink mb-2">How payouts work</h2>
        <ul className="text-sm text-muted list-disc pl-5 space-y-1">
          <li>Earnings from paid sessions stay pending until the booking is marked completed.</li>
          <li>Available balance is calculated on the server when you view Earnings or request a payout.</li>
          <li>Withdrawals require an activated Razorpay Route Linked Account and the minimum threshold.</li>
          <li>Route Linked Account onboarding is automated. Money transfers are not executed in this phase.</li>
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
      <dd className="font-medium text-right break-all">{v}</dd>
    </div>
  )
}
