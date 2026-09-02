import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBookingById as getApiBooking, getTutorListings, type BookingRow } from '../lib/api'
import {
  buildTutorCatalog,
  formatLongDate,
  getBookingById as getLocalBooking,
  getTutorById,
} from '../lib/tutorMarketplace'
import { formatInr } from '../lib/courseCatalog'
import { getLiveRecord } from '../lib/liveSession'
import TutorAvatar from '../components/tutors/TutorAvatar'
import { tutorPath } from '../lib/paths'
import './tutor-market.css'

function linesFromMessage(message: string | null | undefined) {
  return (message ?? '').split('\n').map(line => line.trim()).filter(Boolean)
}

function displayFromApi(row: BookingRow) {
  const lines = linesFromMessage(row.message)
  const scheduled = row.scheduled_at ? new Date(row.scheduled_at) : null
  return {
    sessionLabel: lines[0] || row.offer_key || 'Session',
    date: scheduled ? scheduled.toISOString().slice(0, 10) : row.created_at.slice(0, 10),
    time: scheduled
      ? scheduled.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : lines[1]?.match(/\d{1,2}:\d{2}/)?.[0] ?? '',
    duration: row.duration_minutes ?? 45,
    price: row.amount_minor ? row.amount_minor / 100 : 0,
    goal: lines.slice(2).join('\n') || '',
    aiBrief: '',
    status: row.status,
    tutorListingId: row.tutor_listing_id,
  }
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [apiBooking, setApiBooking] = useState<BookingRow | null>(null)
  const [listings, setListings] = useState<Awaited<ReturnType<typeof getTutorListings>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTutorListings()
      .then(setListings)
      .catch(() => setListings([]))
  }, [])

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    getApiBooking(id)
      .then(row => {
        if (!cancelled) setApiBooking(row)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const localBooking = id ? getLocalBooking(id) : null
  const live = id ? getLiveRecord(id) : null
  const apiView = apiBooking ? displayFromApi(apiBooking) : null
  const catalog = useMemo(() => buildTutorCatalog(listings), [listings])
  const tutorListingId = apiView?.tutorListingId ?? localBooking?.tutorId ?? live?.tutorId
  const tutor = useMemo(() => {
    if (apiBooking?.listing) {
      return getTutorById(buildTutorCatalog([apiBooking.listing]), apiBooking.listing.id)
    }
    if (tutorListingId) return getTutorById(catalog, tutorListingId)
    return null
  }, [apiBooking, catalog, tutorListingId])

  if (loading) {
    return <div className="pt-24 px-6 text-muted">Loading session…</div>
  }

  if (!apiView && !localBooking && !live) {
    return (
      <div className="pt-24 px-6 max-w-xl mx-auto">
        <p className="text-muted mb-4">
          Session not found. It may have been removed or you may not have access to view it.
        </p>
        <button type="button" className="btn-glass" onClick={() => navigate('/tutors')}>
          Find a tutor
        </button>
      </div>
    )
  }

  const when = apiView?.date
    ? new Date(`${apiView.date}T12:00:00`)
    : localBooking
      ? new Date(`${localBooking.date}T12:00:00`)
      : live
        ? new Date(live.scheduledAt)
        : new Date()
  const title = apiView?.sessionLabel ?? localBooking?.sessionLabel ?? live?.sessionType ?? 'Session'
  const joinId = live?.id ?? apiBooking?.id ?? localBooking?.id
  const time = apiView?.time || localBooking?.time || when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const duration = apiView?.duration ?? localBooking?.duration ?? live?.duration
  const status = live?.status ?? apiView?.status ?? localBooking?.status
  const goal = apiView?.goal || localBooking?.goal || live?.goal
  const aiBrief = localBooking?.aiBrief || live?.aiBrief.text

  return (
    <div className="pt-20 px-6 pb-16 max-w-xl mx-auto">
      <div className="glass rounded-3xl p-6">
        <div className="text-xs font-semibold text-primary mb-2">
          {live?.status === 'completed' || status === 'completed' ? 'Completed session' : 'Upcoming session'}
        </div>
        <h1 className="text-2xl font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {title}
        </h1>
        {tutor && (
          <button
            type="button"
            className="flex items-center gap-3 mb-4 cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0 }}
            onClick={() => navigate(tutorPath(tutor.id))}
          >
            <TutorAvatar name={tutor.name} size={48} />
            <div className="text-left">
              <div className="font-bold text-ink">{tutor.name}</div>
              <div className="text-xs text-muted">{tutor.expertise.join(' · ')}</div>
            </div>
          </button>
        )}
        <dl className="text-sm space-y-2 mb-5">
          <div className="flex justify-between">
            <dt className="text-muted">Date</dt>
            <dd className="text-ink font-medium">{formatLongDate(when)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Time</dt>
            <dd className="text-ink font-medium">{time}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Duration</dt>
            <dd className="text-ink font-medium">{duration} minutes</dd>
          </div>
          {(localBooking || (apiView && apiView.price > 0)) && (
            <div className="flex justify-between">
              <dt className="text-muted">Price</dt>
              <dd className="text-ink font-medium">{formatInr(localBooking?.price ?? apiView?.price ?? 0)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Status</dt>
            <dd className="text-ink font-medium capitalize">{status}</dd>
          </div>
        </dl>
        {goal && <p className="text-sm text-muted mb-3">{goal}</p>}
        {aiBrief && <p className="text-xs text-muted mb-4">{aiBrief}</p>}
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
                <li key={a.id}>
                  {a.done ? '✓' : '○'} {a.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-ink mb-1">Recommended</div>
            <p className="text-muted">
              {live.recommendedLesson.title} · {live.recommendedProject.title}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
