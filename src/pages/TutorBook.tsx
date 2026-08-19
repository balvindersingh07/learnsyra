import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { bookTutor, getTutorListings, type TutorListing } from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import { formatInr } from '../lib/courseCatalog'
import {
  buildTutorCatalog,
  calendarBlob,
  firstName,
  formatHourly,
  formatLongDate,
  generateSessionBrief,
  getTutorById,
  isDateAvailable,
  loadTutorBookings,
  saveTutorBookings,
  sessionTypesFor,
  slotsForDate,
  upcomingDates,
  type SessionType,
  type TutorBooking,
} from '../lib/tutorMarketplace'
import TutorAvatar from '../components/tutors/TutorAvatar'
import { sessionPath, tutorPath } from '../lib/paths'
import './tutor-market.css'

const GOALS = [
  'Explain a difficult concept',
  'Review my project',
  'Debug my code',
  'Prepare for interview',
  'Career advice',
]

type Step = 'session' | 'date' | 'time' | 'goal' | 'confirm'

export default function TutorBook() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [rows, setRows] = useState<TutorListing[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('session')
  const [typeId, setTypeId] = useState<SessionType['id']>((params.get('type') as SessionType['id']) || 'project')
  const [date, setDate] = useState<Date>(() => new Date())
  const [time, setTime] = useState(params.get('time') ?? '')
  const [goal, setGoal] = useState('')
  const [brief, setBrief] = useState<{ topics: string[]; questions: string[]; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<TutorBooking | null>(null)

  const catalog = useMemo(() => buildTutorCatalog(rows), [rows])
  const tutor = id ? getTutorById(catalog, id) : null
  const types = tutor ? sessionTypesFor(tutor) : []
  const selected = types.find(t => t.id === typeId) ?? types[0]
  const dates = upcomingDates()
  const slots = tutor ? slotsForDate(tutor, date) : []

  useEffect(() => {
    getTutorListings()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!tutor) return
    const preset = params.get('time')
    if (preset && tutor.availability.today) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      setDate(today)
      setTime(preset)
      return
    }
    const first = upcomingDates().find(d => isDateAvailable(tutor, d))
    if (first) setDate(first)
  }, [tutor?.id])

  const confirm = async () => {
    if (!tutor || !selected || !time) return
    setBusy(true)
    const booking: TutorBooking = {
      id: `sess-${Date.now()}`,
      tutorId: tutor.id,
      studentId: session?.user.id ?? null,
      sessionType: selected.id,
      sessionLabel: selected.label,
      date: date.toISOString().slice(0, 10),
      time,
      duration: selected.minutes,
      price: selected.price,
      goal,
      aiBrief: brief?.text ?? null,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    }
    if (session && !tutor.id.startsWith('catalog-')) {
      const { error: err } = await bookTutor(
        tutor.id,
        [selected.label, `${formatLongDate(date)} ${time}`, goal, brief?.text].filter(Boolean).join('\n'),
      )
      if (err) {
        setError(err)
        setBusy(false)
        return
      }
    }
    saveTutorBookings([booking, ...loadTutorBookings()])
    setDone(booking)
    setBusy(false)
  }

  const addCalendar = () => {
    if (!done || !tutor) return
    const blob = new Blob([calendarBlob(done, tutor.name)], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'learnsyra-session.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !tutor) return <div className="pt-24 px-6 text-muted">Loading booking…</div>
  if (!tutor || !selected) {
    return (
      <div className="pt-24 px-6">
        <p className="text-muted mb-4">Tutor not found.</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/tutors')}>
          Back to tutors
        </button>
      </div>
    )
  }

  const first = firstName(tutor.name)
  const steps: Step[] = ['session', 'date', 'time', 'goal', 'confirm']

  if (done) {
    return (
      <div className="pt-20 px-6 pb-16 max-w-xl mx-auto">
        <div className="glass rounded-3xl p-8 text-center tm-celebrate">
          <div className="text-3xl mb-2">🎉</div>
          <h1 className="text-2xl font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            Session Booked
          </h1>
          <TutorAvatar name={tutor.name} src={tutor.avatarUrl} size={72} />
          <div className="font-bold text-ink mt-3">{tutor.name}</div>
          <div className="text-sm text-muted mb-4">
            {done.sessionLabel}
            <br />
            {formatLongDate(date)} · {done.time}
            <br />
            {done.duration} minutes · {formatInr(done.price)}
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className="btn-glass" onClick={addCalendar}>
              Add to Calendar
            </button>
            <button
              type="button"
              className="btn-glass"
              onClick={() => {
                setPendingAiPrompt(done.aiBrief || `Prepare me for a ${done.sessionLabel} session with ${tutor.name}. Goal: ${done.goal || 'learning support'}.`)
                navigate('/ai-learning')
              }}
            >
              Prepare With AI
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate(sessionPath(done.id))}>
              View Session →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-20 px-6 pb-24 max-w-5xl mx-auto overflow-x-hidden">
      <button
        type="button"
        className="text-sm text-muted cursor-pointer mb-4"
        style={{ background: 'none', border: 'none', padding: 0 }}
        onClick={() => navigate(tutorPath(tutor.id))}
      >
        ← {tutor.name}
      </button>
      <h1 className="text-2xl md:text-3xl font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
        Book a Session With {first}
      </h1>
      {tutor.demo && <div className="badge badge-amber mb-6">Demo Tutor — Not Production Data</div>}

      <div className="flex gap-2 overflow-x-auto mb-6 md:hidden" role="list" aria-label="Booking steps">
        {steps.map(s => (
          <button
            key={s}
            type="button"
            className="tm-pill px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap"
            data-active={step === s}
            style={{ border: '1px solid rgba(99,102,241,0.14)', background: step === s ? undefined : 'rgba(255,255,255,0.9)' }}
            onClick={() => setStep(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_20rem] gap-6">
        <div className="space-y-5">
          <section className={`glass rounded-2xl p-5 ${step !== 'session' ? 'hidden md:block' : ''}`}>
            <h2 className="text-lg font-bold text-ink mb-3">Session type</h2>
            <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Session type">
              {types.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={selected.id === t.id}
                  className="glass rounded-xl p-4 text-left cursor-pointer"
                  style={{ boxShadow: selected.id === t.id ? '0 0 0 2px rgba(108,92,231,0.45)' : undefined }}
                  onClick={() => {
                    setTypeId(t.id)
                    setStep('date')
                  }}
                >
                  <div className="font-bold text-ink text-sm mb-1">{t.label}</div>
                  <div className="text-xs text-muted">{t.minutes} minutes</div>
                  <div className="text-lg font-black text-ink mt-2">{formatInr(t.price)}</div>
                </button>
              ))}
            </div>
          </section>

          <section className={`glass rounded-2xl p-5 ${step !== 'date' ? 'hidden md:block' : ''}`}>
            <h2 className="text-lg font-bold text-ink mb-3">Select date</h2>
            <div className="grid grid-cols-7 gap-2" role="grid" aria-label="Available dates">
              {dates.map(d => {
                const open = isDateAvailable(tutor, d)
                const active = d.toDateString() === date.toDateString()
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    className="tm-day rounded-xl py-2 text-xs cursor-pointer"
                    data-active={active}
                    data-open={open}
                    disabled={!open}
                    aria-pressed={active}
                    aria-label={formatLongDate(d)}
                    style={{ border: '1px solid rgba(99,102,241,0.12)', background: 'rgba(255,255,255,0.9)' }}
                    onClick={() => {
                      setDate(d)
                      setTime('')
                      setStep('time')
                    }}
                  >
                    <div className="text-[10px] uppercase text-muted">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                    <div>{d.getDate()}</div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className={`glass rounded-2xl p-5 ${step !== 'time' ? 'hidden md:block' : ''}`}>
            <h2 className="text-lg font-bold text-ink mb-3">Select time</h2>
            <div className="flex flex-wrap gap-2" role="listbox" aria-label="Time slots">
              {slots.map(s => (
                <button
                  key={s.time}
                  type="button"
                  role="option"
                  aria-selected={time === s.time}
                  disabled={!s.open}
                  className="tm-slot px-4 py-2 rounded-xl text-sm font-semibold"
                  data-active={time === s.time}
                  data-open={s.open}
                  style={{ border: '1px solid rgba(99,102,241,0.14)', background: 'rgba(255,255,255,0.9)' }}
                  onClick={() => {
                    if (!s.open) return
                    setTime(s.time)
                    setStep('goal')
                  }}
                >
                  {s.time}
                </button>
              ))}
            </div>
          </section>

          <section className={`glass rounded-2xl p-5 ${step !== 'goal' ? 'hidden md:block' : ''}`}>
            <h2 className="text-lg font-bold text-ink mb-2">What do you want help with?</h2>
            <textarea
              className="field w-full p-3 text-sm mb-3"
              rows={4}
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Tell your tutor what you want to learn or solve..."
            />
            <div className="flex flex-wrap gap-2 mb-5">
              {GOALS.map(g => (
                <button
                  key={g}
                  type="button"
                  className="badge badge-primary cursor-pointer"
                  style={{ border: 'none' }}
                  onClick={() => setGoal(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="glass rounded-xl p-4" style={{ borderColor: 'rgba(108,92,231,0.2)' }}>
              <h3 className="text-sm font-bold text-ink mb-1">✨ Prepare With AI</h3>
              <p className="text-xs text-muted mb-3">LearnSyra can prepare a short session brief for your tutor.</p>
              {brief ? (
                <div className="text-sm">
                  <div className="font-semibold text-ink mb-1">Topics to discuss</div>
                  <ul className="text-muted mb-2">
                    {brief.topics.map(t => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <div className="font-semibold text-ink mb-1">Questions to ask</div>
                  <ul className="text-muted">
                    {brief.questions.map(q => (
                      <li key={q}>&ldquo;{q}&rdquo;</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => {
                    setBrief(generateSessionBrief(tutor, goal, selected.label))
                    setStep('confirm')
                  }}
                >
                  Generate Session Brief →
                </button>
              )}
              <button type="button" className="btn-glass text-sm mt-3 md:hidden" onClick={() => setStep('confirm')}>
                Continue to summary →
              </button>
            </div>
          </section>
        </div>

        <aside className={`${step !== 'confirm' ? 'hidden md:block' : ''}`}>
          <div className="glass rounded-2xl p-5 sticky top-24">
            <h2 className="text-lg font-bold text-ink mb-3">Session Summary</h2>
            <div className="flex items-center gap-3 mb-3">
              <TutorAvatar name={tutor.name} src={tutor.avatarUrl} size={44} />
              <div>
                <div className="text-sm font-bold text-ink">{tutor.name}</div>
                <div className="text-xs text-muted">{formatHourly(tutor.hourlyRate)}</div>
              </div>
            </div>
            <dl className="text-sm space-y-2 mb-4">
              <div className="flex justify-between"><dt className="text-muted">Session</dt><dd className="font-medium text-ink">{selected.label}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Date</dt><dd className="font-medium text-ink">{formatLongDate(date)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Time</dt><dd className="font-medium text-ink">{time || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Duration</dt><dd className="font-medium text-ink">{selected.minutes} minutes</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Price</dt><dd className="font-black text-ink">{formatInr(selected.price)}</dd></div>
            </dl>
            {error && <p className="text-sm text-rose-500 mb-2">{error}</p>}
            <button type="button" className="btn-primary w-full" disabled={busy || !time} onClick={confirm}>
              {busy ? 'Booking…' : 'Confirm Booking →'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
