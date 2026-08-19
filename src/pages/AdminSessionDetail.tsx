import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  attendanceFor,
  bookingStatusLabel,
  canCancelBooking,
  cancelAdminBooking,
  formatWhen,
  isSessionReportingAvailable,
  isSessionRescheduleAvailable,
  liveStateLabel,
  loadAdminSessionIndex,
  loadSessionNotes,
  saveSessionNote,
  timeline,
  type AdminSessionIndex,
  type AdminSessionRow,
} from '../lib/adminSessions'
import './admin-control.css'

export default function AdminSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminSessionIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [explain, setExplain] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminSessionIndex()
      .then(setIndex)
      .catch(() => setError("Session details couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (id) setNote(loadSessionNotes()[id] ?? '')
  }, [id])

  const session: AdminSessionRow | null = index?.rows.find(r => r.routeId === id) ?? null
  const events = session ? timeline(session) : []
  const attendees = index && session?.kind === 'live-class' ? attendanceFor(index, session.sourceId) : []
  const reporting = isSessionReportingAvailable()
  const reschedule = isSessionRescheduleAvailable()

  const applyCancel = async () => {
    if (!session) return
    setBusy(true)
    const result = await cancelAdminBooking(session.sourceId)
    setBusy(false)
    setConfirmCancel(false)
    setMsg(result.message)
    if (result.ok) load()
  }

  useEffect(() => {
    if (!explain && !confirmCancel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExplain(null)
        setConfirmCancel(false)
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (explain) setExplain(null)
        else if (confirmCancel && session && !busy) void applyCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [explain, confirmCancel, busy, session])

  return (
    <AdminShell>
      <div className="ac-dash">
        <button type="button" className="btn-glass text-xs mb-3" onClick={() => navigate('/admin/sessions')}>← Sessions</button>
        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {loading && <div className="ac-skel mb-4" aria-busy="true" />}
        {!loading && !session && !error && <p className="text-[13px] text-muted">Session details couldn't be loaded. This session is not in the platform records.</p>}
        {session && index && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{session.title}</h1>
                <p className="text-[13px] text-muted">
                  {session.typeLabel} · {session.startAt ? formatWhen(session.startAt) : `Booked ${formatWhen(session.bookedAt)}`}
                  {session.endAt ? ` – ${formatWhen(session.endAt)}` : ''}
                  {' · '}
                  {session.kind === 'live-class' ? liveStateLabel(session.liveStatus) : bookingStatusLabel(session.bookingStatus)}
                  {' · '}{session.tutorName}
                  {session.studentName ? ` · ${session.studentName}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {session.tutorId && <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/tutors/${session.tutorId}`)}>View Tutor →</button>}
                {session.studentId && <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/users/${session.studentId}`)}>View Student →</button>}
                {session.courseId && <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/courses/${session.courseId}`)}>View Course →</button>}
                {session.kind === 'live-class' && (
                  <button type="button" className="btn-glass text-xs" onClick={() => setExplain('Live session view is available to students and tutors only. Admin does not enter the /live room.')}>Open Live Session</button>
                )}
                {canCancelBooking(session) && <button type="button" className="btn-glass text-xs" onClick={() => setConfirmCancel(true)}>Cancel</button>}
              </div>
            </div>
            {session.demo && <div className="glass rounded-2xl p-3 mb-3 text-sm ac-warn">Demo Session — Not a Real Booking</div>}
            {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}

            <div className="grid lg:grid-cols-2 gap-3 mb-3">
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Booking details</h2>
                <dl className="grid gap-1.5 text-[13px]">
                  <KV k="Booking / class ID" v={session.sourceId} />
                  <KV k="Session type" v={session.typeLabel} />
                  <KV k="Date / time" v={session.startAt ? formatWhen(session.startAt) : `Booked ${formatWhen(session.bookedAt)}`} />
                  <KV k="End time" v={session.endAt ? formatWhen(session.endAt) : 'Not provided'} />
                  <KV k="Duration" v={session.durationMin != null ? `${session.durationMin} min` : '—'} />
                  <KV k="Tutor" v={session.tutorName} />
                  <KV k="Student" v={session.studentName || 'Not a 1:1 booking'} />
                  <KV k="Goal" v={session.goal || 'Not provided'} />
                  <KV k="Booking status" v={bookingStatusLabel(session.bookingStatus)} />
                  <KV k="Live state" v={liveStateLabel(session.liveStatus)} />
                </dl>
                <p className="text-[12px] text-muted mt-2">Financial data unavailable. Booking price is not treated as revenue. Payments stay on /admin/payments.</p>
              </section>
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Status</h2>
                <div className="ac-health"><span>Booking</span><span>{bookingStatusLabel(session.bookingStatus)}</span></div>
                <div className="ac-health"><span>Live</span><span>{liveStateLabel(session.liveStatus)}</span></div>
                <h2 className="font-black text-ink mt-3">Timeline</h2>
                {events.length === 0 && <p className="text-[13px] text-muted">Session timeline unavailable.</p>}
                {events.map(ev => (
                  <div key={ev.id} className="ac-act">
                    <span>{ev.label}</span>
                    <span className="text-[11px] text-muted">{formatWhen(ev.at)}</span>
                  </div>
                ))}
                <h2 className="font-black text-ink mt-3">Attendance</h2>
                {session.kind !== 'live-class' && <p className="text-[13px] text-muted">Attendance data unavailable. Bookings are not treated as attendance.</p>}
                {session.kind === 'live-class' && !index.attendanceAvailable && <p className="text-[13px] text-muted">Attendance data unavailable.</p>}
                {session.kind === 'live-class' && index.attendanceAvailable && attendees.length === 0 && <p className="text-[13px] text-muted">No attendance records yet.</p>}
                {attendees.map(a => (
                  <div key={`${a.classId}-${a.studentId}`} className="ac-act">
                    <span>{a.studentName} joined</span>
                    <span className="text-[11px] text-muted">Join/leave times not recorded</span>
                  </div>
                ))}
                <h2 className="font-black text-ink mt-3">Feedback</h2>
                <p className="text-[13px] text-muted">No feedback yet.</p>
              </section>
            </div>

            <div className="grid lg:grid-cols-2 gap-3 mb-3">
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Tutor</h2>
                <dl className="grid gap-1.5 text-[13px]">
                  <KV k="Name" v={session.tutorName} />
                  <KV k="Headline" v={session.tutorHeadline || 'Not provided'} />
                  <KV k="Tutor ID" v={session.tutorId || 'Not provided'} />
                </dl>
                {session.studentId && (
                  <>
                    <h2 className="font-black text-ink mt-3">Student</h2>
                    <dl className="grid gap-1.5 text-[13px]">
                      <KV k="Name" v={session.studentName || 'Not provided'} />
                      <KV k="Student ID" v={session.studentId} />
                      <KV k="Learning goal" v={session.goal || 'Not provided'} />
                    </dl>
                  </>
                )}
                {session.courseId && (
                  <>
                    <h2 className="font-black text-ink mt-3">Course</h2>
                    <dl className="grid gap-1.5 text-[13px]">
                      <KV k="Course" v={session.courseTitle || 'Not provided'} />
                      <KV k="Course ID" v={session.courseId} />
                    </dl>
                  </>
                )}
                <h2 className="font-black text-ink mt-3">Project</h2>
                <p className="text-[13px] text-muted">No project relationship on this record.</p>
              </section>
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Session outcome</h2>
                <p className="text-[13px] text-muted mb-3">Session outcome unavailable. Tutor private notes are not shown here.</p>
                <h2 className="font-black text-ink">Platform actions</h2>
                <p className="text-[13px] text-muted mb-2">Session management actions that are not connected stay disabled.</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button type="button" className="btn-glass text-xs" aria-disabled={!reschedule} onClick={() => setExplain('Rescheduling is not connected.')}>Reschedule</button>
                  <button type="button" className="btn-glass text-xs" aria-disabled={!reporting} onClick={() => setExplain('Session reporting is not connected.')}>Flag</button>
                </div>
                <p className="text-[12px] text-muted mb-3">Session reporting is not connected.</p>
                <label className="block text-[12px] font-semibold text-muted">
                  Admin notes
                  <textarea className="field mt-1 w-full px-3 py-2 text-sm" rows={3} value={note} onChange={e => setNote(e.target.value)} />
                </label>
                <button type="button" className="btn-glass text-xs mt-2" onClick={() => { saveSessionNote(session.routeId, note); setMsg('Admin note saved in the Admin-only session notes store.') }}>Save note</button>
              </section>
            </div>
          </>
        )}
      </div>

      {confirmCancel && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sess-cancel-title">
          <button type="button" className="absolute inset-0" aria-label="Cancel dialog" style={{ background: 'transparent', border: 'none' }} onClick={() => setConfirmCancel(false)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="sess-cancel-title" className="text-lg font-black text-ink mb-2">Cancel this session?</h2>
            <p className="text-sm text-muted mb-4">This updates the booking using the existing booking status API. It does not delete the student or tutor, and it does not refund money from this screen.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-glass text-sm" onClick={() => setConfirmCancel(false)}>Keep booking</button>
              <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void applyCancel()}>Cancel booking</button>
            </div>
          </div>
        </div>
      )}
      {explain && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="sess-mod-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExplain(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="sess-mod-title" className="text-lg font-black text-ink mb-2">Unavailable</h2>
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
