import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { displayInitials } from '../lib/roleAccess'
import { loadTutorHub, profileStrength } from '../lib/tutorProfile'
import {
  bookingsForUser,
  formatWhen,
  loadAdminNotes,
  loadAdminTutorIndex,
  loadTutorCourseReviews,
  marketLabel,
  pauseDiscovery,
  profileField,
  publicProfileHref,
  resumeDiscovery,
  saveAdminNote,
  tutorActivity,
  tutorProjects,
  tutorStudents,
  type AdminTutorIndex,
  type AdminTutorRow,
} from '../lib/adminTutors'
import type { CourseReview } from '../lib/api'
import './admin-control.css'

type DetailTab = 'overview' | 'profile' | 'courses' | 'students' | 'sessions' | 'projects' | 'reviews' | 'earnings' | 'activity'

export default function AdminTutorDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminTutorIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [confirm, setConfirm] = useState<'pause' | 'resume' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [reviews, setReviews] = useState<CourseReview[] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminTutorIndex()
      .then(setIndex)
      .catch(() => setError("Tutor details couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (id) setNote(loadAdminNotes()[id] ?? '')
  }, [id])
  useEffect(() => {
    if (!confirm) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirm(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])

  const tutor: AdminTutorRow | null = index?.tutors.find(t => t.id === id) ?? null
  const hub = tutor ? loadTutorHub(tutor.id) : null
  const books = tutor && index ? bookingsForUser(tutor.id, 'tutor', index) : []
  const courses = tutor && index ? index.courses.filter(c => c.tutor_id === tutor.id) : []
  const students = tutor && index ? tutorStudents(tutor, index) : []
  const projects = tutor && index ? tutorProjects(tutor, index) : []
  const events = tutor && index ? tutorActivity(tutor, index) : []
  const publicHref = tutor ? publicProfileHref(tutor) : null

  useEffect(() => {
    if (tab !== 'reviews' || !index || !tutor) return
    let live = true
    loadTutorCourseReviews(index, tutor.id).then(rows => { if (live) setReviews(rows) }).catch(() => { if (live) setReviews([]) })
    return () => { live = false }
  }, [tab, index, tutor])

  const applyVisibility = async (mode: 'pause' | 'resume') => {
    if (!tutor) return
    setBusy(true)
    setMsg(null)
    const result =
      mode === 'pause'
        ? await pauseDiscovery(tutor.id, tutor.listingId)
        : await resumeDiscovery(tutor.id, tutor.listingId)
    setBusy(false)
    setConfirm(null)
    setMsg(result.message)
    if (result.ok) load()
  }

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'profile', label: 'Profile' },
    { id: 'courses', label: 'Courses' },
    { id: 'students', label: 'Students' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'projects', label: 'Projects' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <AdminShell>
      <div className="ac-dash">
        <button type="button" className="btn-glass text-xs mb-3" onClick={() => navigate('/admin/tutors')}>← Tutors</button>
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
                    Marketplace: {marketLabel(tutor.market)} · Verification: Not Available
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/verification/${tutor.id}`)}>Review Verification</button>
                {publicHref && <button type="button" className="btn-glass text-xs" onClick={() => navigate(publicHref)}>View Public Profile</button>}
                <button type="button" className="btn-glass text-xs" onClick={() => setTab('courses')}>View Courses</button>
                {hub?.visibility === 'published' && <button type="button" className="btn-glass text-xs" onClick={() => setConfirm('pause')}>Pause Discovery</button>}
                {hub?.visibility === 'paused' && <button type="button" className="btn-primary text-xs" onClick={() => setConfirm('resume')}>Resume Discovery</button>}
              </div>
            </div>
            {tutor.demo && <div className="glass rounded-2xl p-3 mb-3 text-sm ac-warn">Demo Tutor Data — Not Production Data</div>}
            {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}
            {!hub && <p className="text-[12px] text-muted mb-3">Marketplace visibility control is not connected for this tutor on this device.</p>}

            <div className="flex flex-nowrap gap-1.5 mb-4 overflow-x-auto" role="tablist" aria-label="Tutor sections">
              {tabs.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>

            {tab === 'overview' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Overview</h2>
                <dl className="grid sm:grid-cols-2 gap-1.5 text-[13px]">
                  <KV k="Profile completion" v={hub ? `${profileStrength(hub).percent}%` : 'Data unavailable'} />
                  <KV k="Expertise" v={tutor.expertise.join(', ') || 'Not provided'} />
                  <KV k="Teaching style" v={tutor.teachingStyles.join(', ') || 'Not provided'} />
                  <KV k="Session types" v={tutor.sessionTypes.join(', ') || 'Not provided'} />
                  <KV k="Pricing" v={hub?.sessionOffers.some(s => s.enabled && s.hourlyRate > 0) ? hub.sessionOffers.filter(s => s.enabled && s.hourlyRate > 0).map(s => `${s.label} ₹${s.hourlyRate}/hr`).join(', ') : 'Not provided'} />
                  <KV k="Availability" v={hub?.availability.some(d => d.enabled) ? hub.availability.filter(d => d.enabled).map(d => d.day).join(', ') : 'Not provided'} />
                  <KV k="Marketplace visibility" v={marketLabel(tutor.market)} />
                  <KV k="Verification" v="Not Available" />
                </dl>
              </section>
            )}

            {tab === 'profile' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Profile</h2>
                <p className="text-[12px] text-muted mb-2">Admin read-only review. Tutor private notes are not shown.</p>
                <dl className="grid sm:grid-cols-2 gap-1.5 text-[13px]">
                  <KV k="Name" v={profileField(hub?.identity.name || tutor.name)} />
                  <KV k="Headline" v={profileField(hub?.identity.headline || tutor.headline)} />
                  <KV k="Bio" v={profileField(hub?.bio)} />
                  <KV k="Expertise" v={tutor.expertise.join(', ') || 'Not provided'} />
                  <KV k="Skills" v={hub?.skills.map(s => s.name).join(', ') || 'Not provided'} />
                  <KV k="Teaching style" v={tutor.teachingStyles.join(', ') || 'Not provided'} />
                  <KV k="Languages" v={hub?.languages.map(l => `${l.name} (${l.level})`).join(', ') || 'Not provided'} />
                  <KV k="Session types" v={tutor.sessionTypes.join(', ') || 'Not provided'} />
                  <KV k="Visibility" v={marketLabel(tutor.market)} />
                </dl>
                <label className="block mt-3 text-[12px] font-semibold text-muted">
                  Admin notes
                  <textarea className="field mt-1 w-full px-3 py-2 text-sm" rows={3} value={note} onChange={e => setNote(e.target.value)} />
                </label>
                <button type="button" className="btn-glass text-xs mt-2" onClick={() => { saveAdminNote(tutor.id, note); setMsg('Admin note saved in the Admin-only notes store.') }}>Save note</button>
              </section>
            )}

            {tab === 'courses' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Courses</h2>
                {courses.length === 0 && <p className="text-[13px] text-muted">No courses yet.</p>}
                {courses.map(c => {
                  const studentsN = index?.enrollments.filter(e => e.course_id === c.id).length ?? 0
                  return (
                    <div key={c.id} className="ac-act">
                      <span className="min-w-0 truncate">{c.title} · {c.published ? 'Published' : 'Draft'} · Students {studentsN}</span>
                      <button type="button" className="text-xs font-semibold shrink-0" style={{ background: 'none', border: 'none', color: '#5b4bd6' }} onClick={() => navigate(`/courses/${c.id}`)}>View Course →</button>
                    </div>
                  )
                })}
              </section>
            )}

            {tab === 'students' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Students</h2>
                {students.length === 0 && <p className="text-[13px] text-muted">No students associated yet.</p>}
                {students.map(s => (
                  <div key={s.id} className="ac-act">
                    <span className="min-w-0 truncate">{s.name} · {s.courses.join(', ') || '—'}{s.progress != null ? ` · ${s.progress}%` : ''}</span>
                    <span className="text-[11px] text-muted whitespace-nowrap">Sessions {s.sessions}</span>
                  </div>
                ))}
              </section>
            )}

            {tab === 'sessions' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Sessions</h2>
                {books.length === 0 && <p className="text-[13px] text-muted">No session data yet.</p>}
                {books.length > 0 && (
                  <p className="text-[12px] text-muted mb-2">Upcoming {books.filter(b => b.status === 'pending' || b.status === 'confirmed').length} · Completed {books.filter(b => b.status === 'completed').length} · Cancelled {books.filter(b => b.status === 'cancelled').length}</p>
                )}
                {books.map(b => {
                  const student = index?.profiles.find(p => p.id === b.student_id)
                  return (
                    <div key={b.id} className="ac-act">
                      <span>{student?.full_name || 'Student'} · {b.status}</span>
                      <span className="text-[11px] text-muted">{formatWhen(b.created_at)}</span>
                    </div>
                  )
                })}
              </section>
            )}

            {tab === 'projects' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Projects</h2>
                {projects.length === 0 && <p className="text-[13px] text-muted">No project review activity yet.</p>}
                {projects.map(p => (
                  <div key={p.id} className="ac-act">
                    <span className="min-w-0 truncate">{p.title} · {p.student} · {p.status}</span>
                    <span className="text-[11px] text-muted">{formatWhen(p.submitted)}</span>
                  </div>
                ))}
              </section>
            )}

            {tab === 'reviews' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Reviews</h2>
                {reviews == null && <div className="ac-skel" />}
                {reviews && reviews.length === 0 && <p className="text-[13px] text-muted">No reviews yet.</p>}
                {reviews?.map(r => (
                  <div key={r.id} className="ac-act">
                    <span className="min-w-0">{r.rating}/5 · {r.body || 'No written review'} · {r.student?.full_name || 'Student'}</span>
                    <span className="text-[11px] text-muted">{formatWhen(r.created_at)}</span>
                  </div>
                ))}
              </section>
            )}

            {tab === 'earnings' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Earnings</h2>
                <p className="text-[13px] text-muted">Financial data unavailable.</p>
                <p className="text-[12px] text-muted mt-1">Course enrollments are not treated as purchases. Platform commission is not inferred.</p>
              </section>
            )}

            {tab === 'activity' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Activity</h2>
                {events.length === 0 && <p className="text-[13px] text-muted">No tutor activity history available.</p>}
                {events.map(ev => (
                  <div key={ev.id} className="ac-act">
                    <span className="flex items-center gap-2 min-w-0"><i aria-hidden /><span className="truncate">{ev.label}</span></span>
                    <span className="text-[11px] text-muted whitespace-nowrap">{new Date(ev.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {confirm && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tutor-action-title">
          <button type="button" className="absolute inset-0" aria-label="Cancel" style={{ background: 'transparent', border: 'none' }} onClick={() => setConfirm(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="tutor-action-title" className="text-lg font-black text-ink mb-2">
              {confirm === 'pause' && 'Pause discovery?'}
              {confirm === 'resume' && 'Resume discovery?'}
            </h2>
            <p className="text-sm text-muted mb-4">
              {confirm === 'pause' && 'New discovery/bookings may be affected according to the existing visibility rules. Existing sessions are not cancelled automatically.'}
              {confirm === 'resume' && 'This restores published marketplace visibility using the existing tutor visibility state.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-glass text-sm" onClick={() => setConfirm(null)}>Cancel</button>
              {confirm === 'pause' && <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void applyVisibility('pause')}>Pause Discovery</button>}
              {confirm === 'resume' && <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void applyVisibility('resume')}>Resume Discovery</button>}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-medium text-right break-all">{v}</dd></div>
}
