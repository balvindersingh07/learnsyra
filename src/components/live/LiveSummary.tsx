import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutorAvatar from '../tutors/TutorAvatar'
import { setPendingAiPrompt } from '../../lib/dashboardIntel'
import { saveLiveRecord, type LiveSessionRecord } from '../../lib/liveSession'
import type { CatalogTutor } from '../../lib/tutorMarketplace'
import { sessionPath } from '../../lib/paths'

export default function LiveSummary({
  record,
  tutor,
  onChange,
}: {
  record: LiveSessionRecord
  tutor: CatalogTutor
  onChange: (row: LiveSessionRecord) => void
}) {
  const navigate = useNavigate()
  const [rating, setRating] = useState(record.rating ?? 5)

  const patch = (partial: Partial<LiveSessionRecord>) => {
    const next = { ...record, ...partial }
    saveLiveRecord(next)
    onChange(next)
  }

  return (
    <div className="pt-20 px-6 pb-16 max-w-3xl mx-auto overflow-x-hidden lv-in">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🎉</div>
        <h1 className="text-3xl font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Session Complete
        </h1>
        <p className="text-muted">
          {tutor.name} · {record.sessionType}
          <br />
          {record.duration} minutes
        </p>
      </div>

      <section className="glass rounded-2xl p-5 mb-4" style={{ borderColor: 'rgba(108,92,231,0.2)' }}>
        <h2 className="text-lg font-bold text-ink mb-3">✨ AI Session Summary</h2>
        <div className="text-sm font-semibold text-ink mb-1">Topics Covered</div>
        <ul className="text-sm text-muted mb-3">
          {record.aiBrief.topics.map(t => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
        <div className="text-sm font-semibold text-ink mb-1">What You Learned</div>
        <p className="text-sm text-muted">&ldquo;{record.learned}&rdquo;</p>
      </section>

      <section className="glass rounded-2xl p-5 mb-4">
        <h2 className="text-lg font-bold text-ink mb-2">👨‍🏫 Tutor Feedback</h2>
        <div className="flex flex-wrap gap-2 text-xs mb-2">
          <span className="badge badge-green">{record.tutorStrength}</span>
          <span className="badge badge-amber">{record.tutorPractice}</span>
        </div>
        <p className="text-sm text-muted mb-3">&ldquo;{record.tutorFeedback}&rdquo;</p>
        <div className="text-sm font-semibold text-ink mb-1">Tutor Rating</div>
        <div className="flex gap-1 mb-1" role="radiogroup" aria-label="Rate this session">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              className="text-2xl cursor-pointer"
              style={{ background: 'none', border: 'none', color: n <= rating ? '#f59e0b' : '#d0d5dd' }}
              onClick={() => {
                setRating(n)
                patch({ rating: n })
              }}
            >
              ★
            </button>
          ))}
        </div>
        <div className="text-xs text-muted">⭐ {rating} / 5</div>
      </section>

      <section className="glass rounded-2xl p-5 mb-4">
        <h2 className="text-lg font-bold text-ink mb-3">🎯 Your Next Actions</h2>
        <ul className="space-y-2">
          {record.actionItems.map(a => (
            <li key={a.id}>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="lv-check mt-0.5"
                  checked={a.done}
                  onChange={() =>
                    patch({
                      actionItems: record.actionItems.map(x => (x.id === a.id ? { ...x, done: !x.done } : x)),
                    })
                  }
                />
                <span className={a.done ? 'text-muted line-through' : 'text-ink'}>{a.done ? '✓ ' : '○ '}{a.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-2xl p-5 mb-4">
        <h2 className="text-lg font-bold text-ink mb-1">Recommended practice</h2>
        <p className="text-sm text-muted mb-2">Explore a short AI practice drill after your session.</p>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => {
            setPendingAiPrompt('Give me a short practice challenge based on what I just reviewed with my tutor.')
            navigate('/ai-learning')
          }}
        >
          Start Practice →
        </button>
      </section>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <section className="glass rounded-2xl p-5">
          <h2 className="text-sm font-bold text-ink mb-1">Explore courses</h2>
          <div className="font-semibold text-ink">{record.recommendedLesson.title}</div>
          <button type="button" className="btn-glass text-sm" onClick={() => navigate(record.recommendedLesson.href || '/courses')}>
            Explore courses →
          </button>
        </section>
        <section className="glass rounded-2xl p-5">
          <h2 className="text-sm font-bold text-ink mb-1">Explore projects</h2>
          <div className="font-semibold text-ink">{record.recommendedProject.title}</div>
          <p className="text-xs text-muted mb-2">{record.recommendedProject.why}</p>
          <button type="button" className="btn-glass text-sm" onClick={() => navigate(record.recommendedProject.href || '/projects')}>
            Explore projects →
          </button>
        </section>
      </div>

      {(record.careerAfter > 0 || record.skillDeltas.length > 0) && (
      <section className="glass rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-bold text-ink mb-2">Career Progress</h2>
        <p className="text-sm text-muted mb-2">From this session — only shown when scores are recorded.</p>
        {record.careerAfter > 0 && (
        <div className="flex items-end gap-4 mb-3">
          <div>
            <div className="text-xs text-muted">Before</div>
            <div className="text-2xl font-black text-ink">{record.careerBefore}%</div>
          </div>
          <div className="text-muted">→</div>
          <div>
            <div className="text-xs text-muted">After</div>
            <div className="text-2xl font-black text-primary">{record.careerAfter}%</div>
          </div>
        </div>
        )}
        <ul className="text-sm">
          {record.skillDeltas.map(s => (
            <li key={s.skill} className="flex justify-between">
              <span>{s.skill}</span>
              <span className="font-semibold text-success">+{s.delta}%</span>
            </li>
          ))}
        </ul>
      </section>
      )}

      <div className="flex items-center gap-3 mb-4">
        <TutorAvatar name={tutor.name} size={44} />
        <div className="text-sm text-muted">Saved to your session record.</div>
      </div>
      <button type="button" className="btn-primary" onClick={() => navigate(sessionPath(record.id))}>
        View Session →
      </button>
    </div>
  )
}
