import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { displayInitials } from '../lib/roleAccess'
import { loadTutorHub, profileStrength } from '../lib/tutorProfile'
import { verificationDisplay } from '../lib/tutorSettings'
import { marketLabel, publicProfileHref } from '../lib/adminTutors'
import {
  findVerificationTutor,
  isVerificationBackendAvailable,
  loadVerificationCenter,
  loadVerificationNotes,
  saveVerificationNote,
  type VerificationCenter,
} from '../lib/adminVerification'
import './admin-control.css'

export default function AdminVerificationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<VerificationCenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [explain, setExplain] = useState<string | null>(null)

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
    if (!explain) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExplain(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [explain])

  const tutor = data && id ? findVerificationTutor(data.index, id) : null
  const hub = tutor ? loadTutorHub(tutor.id) : null
  const publicHref = tutor ? publicProfileHref(tutor) : null
  const backend = isVerificationBackendAvailable()
  const copy = verificationDisplay()
  const blocked = 'Verification actions unavailable until the verification backend is connected.'

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
                    Marketplace: {marketLabel(tutor.market)} · Verification: Unavailable
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn-glass text-xs" aria-disabled={!backend} onClick={() => setExplain(blocked)}>Review</button>
                <button type="button" className="btn-glass text-xs" aria-disabled={!backend} onClick={() => setExplain(blocked)}>Request Changes</button>
                <button type="button" className="btn-primary text-xs" aria-disabled={!backend} onClick={() => setExplain('Verification approval is unavailable because the verification backend is not connected.')}>Approve</button>
                <button type="button" className="btn-glass text-xs" style={{ color: '#B45309' }} aria-disabled={!backend} onClick={() => setExplain(blocked)}>Reject</button>
                {publicHref && <button type="button" className="btn-glass text-xs" onClick={() => navigate(publicHref)}>View Public Profile →</button>}
              </div>
            </div>
            {!backend && <p className="text-[12px] text-muted mb-3">{blocked} {copy.badgeCopy}</p>}
            {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}

            <div className="grid lg:grid-cols-2 gap-3 mb-3">
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Professional profile</h2>
                <p className="text-[12px] text-muted mb-2">Read-only from the existing tutor profile. This is not a second profile system.</p>
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
                <div className="ac-health"><span>Identity</span><span className="text-muted">Unavailable</span></div>
                <div className="ac-health"><span>Education</span><span className="text-muted">Unavailable</span></div>
                <div className="ac-health"><span>Certifications</span><span className="text-muted">Unavailable</span></div>
                <div className="ac-health"><span>Documents</span><span className="text-muted">Verification documents unavailable.</span></div>
                <div className="ac-health"><span>Intro video</span><span className="text-muted">{hub?.introVideoUrl ? 'Provided' : 'Not provided'}</span></div>
                <p className="text-[12px] text-muted mt-2">Admin decisions are not persisted because verification infrastructure is not connected.</p>
              </section>
            </div>

            <section className="glass rounded-2xl p-3.5 mb-3">
              <h2 className="font-black text-ink">Review history</h2>
              <p className="text-[13px] text-muted">No verification history available.</p>
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

      {explain && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="verify-unavail">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExplain(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="verify-unavail" className="text-lg font-black text-ink mb-2">Verification infrastructure unavailable</h2>
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
