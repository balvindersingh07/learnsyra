import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBookingById, getTutorById, buildTutorCatalog, formatLongDate } from '../lib/tutorMarketplace'
import { formatInr } from '../lib/courseCatalog'
import { getLiveRecord } from '../lib/liveSession'
import TutorAvatar from '../components/tutors/TutorAvatar'
import { tutorPath } from '../lib/paths'
import './tutor-market.css'

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const booking = id ? getBookingById(id) : null
  const live = id ? getLiveRecord(id) : null
  const tutorId = booking?.tutorId ?? live?.tutorId
  const tutor = useMemo(
    () => (tutorId ? getTutorById(buildTutorCatalog([]), tutorId) : null),
    [tutorId],
  )

  if (!booking && !live) {
    return (
      <div className="pt-24 px-6 max-w-xl mx-auto">
        <p className="text-muted mb-4">Session not found. Booked sessions are saved on this device.</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/tutors')}>
          Find a tutor
        </button>
      </div>
    )
  }

  const when = booking
    ? new Date(`${booking.date}T12:00:00`)
    : live
      ? new Date(live.scheduledAt)
      : new Date()
  const title = booking?.sessionLabel ?? live?.sessionType ?? 'Session'
  const joinId = live?.id ?? booking?.id

  return (
    <div className="pt-20 px-6 pb-16 max-w-xl mx-auto">
      <div className="glass rounded-3xl p-6">
        <div className="text-xs font-semibold text-primary mb-2">
          {live?.status === 'completed' ? 'Completed session' : 'Upcoming session'}
        </div>
        <h1 className="text-2xl font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {title}
        </h1>
        {tutor && (
          <button type="button" className="flex items-center gap-3 mb-4 cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => navigate(tutorPath(tutor.id))}>
            <TutorAvatar name={tutor.name} size={48} />
            <div className="text-left">
              <div className="font-bold text-ink">{tutor.name}</div>
              <div className="text-xs text-muted">{tutor.expertise.join(' · ')}</div>
            </div>
          </button>
        )}
        <dl className="text-sm space-y-2 mb-5">
          <div className="flex justify-between"><dt className="text-muted">Date</dt><dd className="text-ink font-medium">{formatLongDate(when)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Time</dt><dd className="text-ink font-medium">{booking?.time ?? when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Duration</dt><dd className="text-ink font-medium">{booking?.duration ?? live?.duration} minutes</dd></div>
          {booking && <div className="flex justify-between"><dt className="text-muted">Price</dt><dd className="text-ink font-medium">{formatInr(booking.price)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Status</dt><dd className="text-ink font-medium capitalize">{live?.status ?? booking?.status}</dd></div>
        </dl>
        {(booking?.goal || live?.goal) && <p className="text-sm text-muted mb-3">{booking?.goal || live?.goal}</p>}
        {(booking?.aiBrief || live?.aiBrief.text) && <p className="text-xs text-muted mb-4">{booking?.aiBrief || live?.aiBrief.text}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => navigate(joinId ? `/live?session=${joinId}&join=1` : '/live')}>
            Join Live Session →
          </button>
          <button type="button" className="btn-glass" onClick={() => navigate('/tutors')}>
            Back to tutors
          </button>
        </div>
      </div>

      {live && (
        <div className="glass rounded-2xl p-5 mt-4 text-sm space-y-3">
          {live.notes.session || live.notes.my ? (
            <div>
              <div className="font-semibold text-ink mb-1">Notes</div>
              <p className="text-muted whitespace-pre-wrap">{live.notes.session || live.notes.my}</p>
            </div>
          ) : null}
          {live.learned && (
            <div>
              <div className="font-semibold text-ink mb-1">Summary</div>
              <p className="text-muted">{live.learned}</p>
            </div>
          )}
          {live.tutorFeedback && (
            <div>
              <div className="font-semibold text-ink mb-1">Tutor feedback</div>
              <p className="text-muted">{live.tutorFeedback}</p>
            </div>
          )}
          {live.rating != null && (
            <div>
              <div className="font-semibold text-ink mb-1">Rating</div>
              <p className="text-muted">⭐ {live.rating} / 5</p>
            </div>
          )}
          <div>
            <div className="font-semibold text-ink mb-1">Action items</div>
            <ul className="text-muted">
              {live.actionItems.map(a => (
                <li key={a.id}>{a.done ? '✓' : '○'} {a.label}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-ink mb-1">Recommended</div>
            <p className="text-muted">{live.recommendedLesson.title} · {live.recommendedProject.title}</p>
          </div>
        </div>
      )}
    </div>
  )
}
