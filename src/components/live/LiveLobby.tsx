import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutorAvatar from '../tutors/TutorAvatar'
import { setPendingAiPrompt } from '../../lib/dashboardIntel'
import {
  formatClock,
  secondsUntil,
  type LiveSessionRecord,
} from '../../lib/liveSession'
import type { CatalogTutor } from '../../lib/tutorMarketplace'
import { sessionPath, tutorPath } from '../../lib/paths'

export default function LiveLobby({
  record,
  tutor,
  onJoin,
}: {
  record: LiveSessionRecord
  tutor: CatalogTutor
  onJoin: () => void
}) {
  const navigate = useNavigate()
  const [left, setLeft] = useState(() => secondsUntil(record.scheduledAt))
  const [briefOpen, setBriefOpen] = useState(false)

  useEffect(() => {
    const t = window.setInterval(() => setLeft(secondsUntil(record.scheduledAt)), 1000)
    return () => window.clearInterval(t)
  }, [record.scheduledAt])

  const ready = left <= 0
  const first = tutor.name.replace(/^Dr\.\s*/, '').split(' ')[0]

  return (
    <div className="mb-12">
      <p className="text-sm text-muted mb-2">LearnSyra Live · 1-on-1 tutor workspace</p>
      <h1
        className="text-3xl md:text-4xl font-black text-ink mb-2"
        style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
      >
        👨‍🏫 Your Session With {tutor.name}
      </h1>
      <p className="text-muted text-lg mb-4">
        {tutor.expertise.slice(0, 2).join(' · ')} · {record.sessionType}
      </p>
      <div className="flex items-center gap-2 text-sm mb-6">
        <span className="lv-avail" />
        <span className="font-semibold text-ink">{ready ? 'Ready to join' : 'Starting soon'}</span>
      </div>

      <div className="glass rounded-3xl p-6 md:p-8 mb-6 text-center" style={{ borderColor: 'rgba(108,92,231,0.22)' }}>
        <div className="lv-countdown text-5xl md:text-6xl font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {formatClock(Math.max(0, left))}
        </div>
        <div className="text-sm text-muted mb-6">until your session begins</div>
        <button type="button" className="btn-primary" disabled={!ready} onClick={onJoin}>
          {ready ? 'Join Session →' : `Join in ${formatClock(left)}`}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <section className="glass rounded-2xl p-5">
          <h2 className="text-sm font-bold text-ink mb-3">Session details</h2>
          <button
            type="button"
            className="flex items-center gap-3 mb-3 cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0 }}
            onClick={() => navigate(tutorPath(tutor.id))}
          >
            <TutorAvatar name={tutor.name} size={52} />
            <div className="text-left">
              <div className="font-bold text-ink">{tutor.name}</div>
              <div className="text-xs text-muted">⭐ {tutor.rating.toFixed(1)} · {tutor.expertise.join(' · ')}</div>
            </div>
          </button>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-muted">Session</dt><dd className="font-medium text-ink">{record.sessionType}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Duration</dt><dd className="font-medium text-ink">{record.duration} minutes</dd></div>
          </dl>
        </section>

        <section className="glass rounded-2xl p-5" style={{ borderColor: 'rgba(108,92,231,0.2)' }}>
          <h2 className="text-sm font-bold text-ink mb-2">✨ AI Session Brief</h2>
          <p className="text-xs text-muted mb-3">Built from your course, project, skill gaps, and prior AI work.</p>
          <div className="text-xs font-semibold text-ink mb-1">Topics to Discuss</div>
          <ul className="text-xs text-muted mb-3 space-y-0.5">
            {record.aiBrief.topics.map(t => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
          <button type="button" className="btn-glass text-sm py-1.5" onClick={() => setBriefOpen(true)}>
            Open Session Brief
          </button>
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-glass"
          onClick={() => {
            setPendingAiPrompt(
              `Prepare me for a ${record.sessionType} session with ${tutor.name}. Course: ${record.courseTitle}. Project: ${record.projectTitle}. Goal: ${record.goal}. Topics: ${record.aiBrief.topics.join(', ')}.`,
            )
            navigate('/ai-learning')
          }}
        >
          Prepare With AI →
        </button>
        <button type="button" className="btn-glass" onClick={() => navigate(sessionPath(record.id))}>
          View session record
        </button>
      </div>

      {briefOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Session brief">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: 'rgba(23,32,51,0.4)', border: 'none' }}
            aria-label="Close brief"
            onClick={() => setBriefOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 glass rounded-2xl p-6 lv-in">
            <h3 className="text-lg font-bold text-ink mb-3">✨ AI Session Brief</h3>
            <div className="text-sm font-semibold text-ink mb-1">Topics to Discuss</div>
            <ul className="text-sm text-muted mb-3">
              {record.aiBrief.topics.map(t => <li key={t}>• {t}</li>)}
            </ul>
            <div className="text-sm font-semibold text-ink mb-1">Questions to Ask</div>
            <ul className="text-sm text-muted mb-3">
              {record.aiBrief.questions.map(q => <li key={q}>&ldquo;{q}&rdquo;</li>)}
            </ul>
            <div className="text-sm font-semibold text-ink mb-1">Current Challenge</div>
            <p className="text-sm text-muted mb-4">{record.aiBrief.challenge}</p>
            <div className="flex gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => setBriefOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="btn-glass text-sm"
                onClick={() => {
                  setPendingAiPrompt(`Expand this session brief for ${first}: ${record.aiBrief.text}`)
                  navigate('/ai-learning')
                }}
              >
                Prepare With AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
