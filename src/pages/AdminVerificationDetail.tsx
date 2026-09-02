import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { displayInitials } from '../lib/roleAccess'
import { loadTutorHub, profileStrength } from '../lib/tutorProfile'
import { verificationDisplay } from '../lib/tutorSettings'
import { marketLabel, publicProfileHref } from '../lib/adminTutors'
import {
  adminApproveTutor,
  adminRejectTutor,
  adminSuspendTutor,
  findVerificationTutor,
  isVerificationBackendAvailable,
  loadVerificationCenter,
  loadVerificationNotes,
  saveVerificationNote,
  tutorVerificationStatus,
  verificationStatusLabel,
  type VerificationCenter,
} from '../lib/adminVerification'
import './admin-control.css'

type ConfirmAction = 'approve' | 'reject' | 'suspend' | null

export default function AdminVerificationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<VerificationCenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadVerificationCenter()
      .then(setData)
      .catch(() => setError("Tutor details couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (id) setNote(loadVerificationNotes()[id] ?? '')
  }, [id])
  useEffect(() => {
    if (!confirm) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirm(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])

  const tutor = data && id ? findVerificationTutor(data.index, id) : null
  const listing = tutor ? data?.index.listings.find(l => l.profile_id === tutor.id) ?? null : null
  const hub = tutor ? loadTutorHub(tutor.id) : null
  const publicHref = tutor ? publicProfileHref(tutor) : null
  const backend = isVerificationBackendAvailable()
  const copy = verificationDisplay()
  const status = tutor ? tutorVerificationStatus(tutor, listing) : 'not_submitted'
  const canModerate = backend && Boolean(tutor?.listingId)

  const applyAction = async (action: ConfirmAction) => {
    if (!tutor || !action) return
    setBusy(true)
    setActionError(null)
    const result =
      action === 'approve'
        ? await adminApproveTutor(tutor.id)
        : action === 'reject'
          ? await adminRejectTutor(tutor.id)
          : await adminSuspendTutor(tutor.id)
    setBusy(false)
    setConfirm(null)
    if (result.ok) {
      setMsg(result.message)
      load()
    } else {
      setActionError(result.message)
    }
  }

  return (
    <AdminShell>
      <div className="ac-dash">
        <button type="button" className="btn-glass text-xs mb-3" onClick={() => navigate('/admin/verification')}>← Verification</button>
        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {loading && <div className="ac-skel mb-4" aria-busy="true" />}
        {!loading && !tutor && !error && <p className="text-[13px] text-muted">No tutors yet.</p>}
        {tutor && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-black shrink-0" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}>
                  {tutor.avatarUrl ? <img src={tutor.avatarUrl} alt="" className="w-full h-full object-cover" /> : displayInitials(tutor.name)}
                </div>
                <div className="min-w-0">
                  <h1 className="font-black text-ink truncate" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{tutor.name}</h1>
                  <p className="text-[13px] text-muted">{tutor.headline || 'No headline'}</p>
                  <p className="text-[12px] text-muted mt-0.5">
                    Marketplace: {marketLabel(tutor.market)} · Verification: {verificationStatusLabel(status)}
                    {tutor.listingAvailable === true ? ' · Listing live' : tutor.listingId ? ' · Listing hidden' : ' · No listing'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn-glass text-xs" disabled={!canModerate || busy} onClick={() => setConfirm('reject')}>Request Changes</button>
                <button type="button" className="btn-primary text-xs" disabled={!canModerate || busy} onClick={() => setConfirm('approve')}>Approve</button>
                <button type="button" className="btn-glass text-xs" style={{ color: '#B45309' }} disabled={!canModerate || busy} onClick={() => setConfirm('reject')}>Reject</button>
                <button type="button" className="btn-glass text-xs" disabled={!canModerate || busy} onClick={() => setConfirm('suspend')}>Suspend</button>
                {publicHref && <button type="button" className="btn-glass text-xs" onClick={() => navigate(publicHref)}>View Public Profile →</button>}
              </div>
            </div>
            {!backend && <p className="text-[12px] text-muted mb-3">Moderation requires Supabase. {copy.badgeCopy}</p>}
            {backend && !tutor.listingId && (
              <p className="text-[12px] text-muted mb-3">This tutor has no marketplace listing yet. Create a listing before approve/reject actions can persist.</p>
            )}
            {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}
            {actionError && <p className="text-[13px] mb-3" style={{ color: '#e11d48' }} role="alert">{actionError}</p>}

            <div className="grid lg:grid-cols-2 gap-3 mb-3">
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Professional profile</h2>
                <p className="text-[12px] text-muted mb-2">Read-only from Supabase profile and local tutor hub when present on this device.</p>
                <dl className="grid gap-1.5 text-[13px]">
                  <KV k="Headline" v={hub?.identity.headline || tutor.headline || 'Not provided'} />
                  <KV k="Bio" v={hub?.bio?.trim() || 'Not provided'} />
                  <KV k="Expertise" v={tutor.expertise.join(', ') || 'Not provided'} />
                  <KV k="Skills" v={hub?.skills.map(s => s.name).join(', ') || 'Not provided'} />
                  <KV k="Teaching style" v={tutor.teachingStyles.join(', ') || 'Not provided'} />
                  <KV k="Languages" v={hub?.languages.map(l => l.name).join(', ') || 'Not provided'} />
                  <KV k="Session types" v={tutor.sessionTypes.join(', ') || 'Not provided'} />
                  <KV k="Pricing" v={hub?.sessionOffers.some(s => s.enabled && s.hourlyRate > 0) ? 'Configured' : 'Not provided'} />
                  <KV k="Profile completion" v={hub ? `${profileStrength(hub).percent}%` : 'Data unavailable'} />
                  <KV k="Marketplace" v={marketLabel(tutor.market)} />
                </dl>
              </section>
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Verification information</h2>
                <div className="ac-health"><span>Listing status</span><span>{tutor.listingAvailable === true ? 'Available' : tutor.listingId ? 'Hidden' : 'No listing'}</span></div>
                <div className="ac-health"><span>Identity documents</span><span className="text-muted">Not stored server-side</span></div>
                <div className="ac-health"><span>Education</span><span className="text-muted">Not stored server-side</span></div>
                <div className="ac-health"><span>Certifications</span><span className="text-muted">Not stored server-side</span></div>
                <div className="ac-health"><span>Intro video</span><span>{hub?.introVideoUrl ? 'Provided locally' : 'Not provided'}</span></div>
                <p className="text-[12px] text-muted mt-2">Approve sets tutor_listings.available=true. Reject/suspend sets available=false and notifies the tutor.</p>
              </section>
            </div>

            <section className="glass rounded-2xl p-3.5 mb-3">
              <h2 className="font-black text-ink">Review history</h2>
              <p className="text-[13px] text-muted">Dedicated verification audit history is unavailable. Tutors receive in-app notifications when moderation actions succeed.</p>
            </section>

            <section className="glass rounded-2xl p-3.5">
              <h2 className="font-black text-ink">Admin notes</h2>
              <p className="text-[12px] text-muted mb-2">Stored only in the Admin verification notes namespace. Not shown in Tutor UI.</p>
              <textarea className="field w-full px-3 py-2 text-sm" rows={3} value={note} onChange={e => setNote(e.target.value)} aria-label="Admin verification notes" />
              <button type="button" className="btn-glass text-xs mt-2" onClick={() => { saveVerificationNote(tutor.id, note); setMsg('Admin note saved.') }}>Save note</button>
            </section>
          </>
        )}
      </div>

      {confirm && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="verify-confirm">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setConfirm(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="verify-confirm" className="text-lg font-black text-ink mb-2">
              {confirm === 'approve' ? 'Approve tutor listing?' : confirm === 'suspend' ? 'Suspend tutor listing?' : 'Reject tutor listing?'}
            </h2>
            <p className="text-sm text-muted mb-4">
              {confirm === 'approve'
                ? 'This will mark the tutor marketplace listing as available.'
                : 'This will hide the tutor from the marketplace. Existing bookings are not cancelled automatically.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-glass text-sm" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void applyAction(confirm)}>
                {busy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 py-1" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}><dt className="text-muted">{k}</dt><dd className="font-medium text-right">{v}</dd></div>
}
