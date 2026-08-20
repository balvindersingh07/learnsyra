import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  kindLabel,
  relativeWhen,
  type InterviewRecord,
} from '../../lib/interviewStudio'

const RING = 339.292

export default function InterviewResults({
  record,
  history,
  onRetake,
  onPractice,
  onReview,
}: {
  record: InterviewRecord
  history: InterviewRecord[]
  onRetake: () => void
  onPractice: (id: string) => void
  onReview: (id: string) => void
}) {
  const navigate = useNavigate()
  const ringId = useId()
  const [openId, setOpenId] = useState<string | null>(record.questions[0]?.id ?? null)
  const trend = history.slice().reverse().map(h => h.score)
  const weak = record.score < 75 || record.weakAreas.some(w => w.score < 70)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 overflow-x-hidden">
      <section className="glass rounded-3xl p-6 sm:p-8 mb-6" aria-labelledby="score-heading">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative w-36 h-36 flex-shrink-0">
            <svg
              viewBox="0 0 120 120"
              className="w-full h-full career-ring"
              role="img"
              aria-label={`Interview score ${record.score} out of 100`}
              style={{ ['--career-circ' as string]: RING, ['--career-pct' as string]: record.score }}
            >
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(108,92,231,0.12)" strokeWidth="10" />
              <circle cx="60" cy="60" r="54" fill="none" stroke={`url(#${ringId})`} strokeWidth="10" strokeLinecap="round" className="career-ring-fill" />
              <defs>
                <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6C5CE7" />
                  <stop offset="100%" stopColor="#22C7D6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-black text-ink career-count">{record.score}</span>
            </div>
          </div>
          <div>
            <h2 id="score-heading" className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              Your Interview Score
            </h2>
            <p className="text-3xl font-black text-ink career-count mb-2">{record.score} / 100</p>
            <p className="text-sm text-muted">
              {history.every(h => h.seeded || h.id === record.id) && record.seeded
                ? 'First interview completed'
                : `${record.score - record.interviewBefore >= 0 ? '+' : ''}${record.score - record.interviewBefore} points from your previous interview`}
            </p>
            <p className="text-xs text-muted mt-2">Simulated AI evaluation from your answers — not a scientific measurement.</p>
          </div>
        </div>
      </section>

      <section className="glass rounded-3xl p-6 mb-6">
        <h3 className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Performance Breakdown</h3>
        {[
          ['Technical Knowledge', record.technicalScore],
          ['Problem Solving', record.problemSolvingScore],
          ['Communication', record.communicationScore],
          ['Confidence', record.confidenceScore],
          ['Role Readiness', record.roleReadiness],
        ].map(([label, value]) => (
          <div key={String(label)} className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted">{label}</span>
              <span className="font-bold text-ink">{value} / 100</span>
            </div>
            <div className="progress-bar" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${Number(value)}%` }} />
            </div>
          </div>
        ))}
      </section>

      {record.feedback.well.length > 0 && (
        <section className="glass rounded-3xl p-6 mb-6">
          <h3 className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>✨ AI Interview Coach</h3>
          <h4 className="text-sm font-bold text-ink mb-2">What You Did Well</h4>
          <ul className="mb-4 space-y-1">
            {record.feedback.well.map(item => (
              <li key={item} className="text-sm text-ink">✓ {item}</li>
            ))}
          </ul>
          <h4 className="text-sm font-bold text-ink mb-2">Improve Next</h4>
          <ul className="space-y-1">
            {record.feedback.improve.map(item => (
              <li key={item} className="text-sm text-ink">⚠ {item}</li>
            ))}
          </ul>
        </section>
      )}

      {record.questions.length > 0 && (
        <section className="glass rounded-3xl p-6 mb-6">
          <h3 className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>📝 Answer Review</h3>
          <div className="space-y-2">
            {record.questions.map((q, i) => {
              const a = record.answers[i]
              const open = openId === q.id
              return (
                <article key={q.id} className="rounded-xl" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 flex justify-between gap-3"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : q.id)}
                  >
                    <span className="text-sm font-semibold text-ink">Question {i + 1} · {q.question}</span>
                    <span className="text-xs font-bold text-primary flex-shrink-0">{a?.rating ?? '—'}</span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-muted mb-2">Student answer</p>
                      <blockquote className="text-sm text-ink mb-3 pl-3" style={{ borderLeft: '3px solid #6C5CE7' }}>
                        {a?.skipped || !a?.text ? 'Skipped' : a.text}
                      </blockquote>
                      <p className="text-sm font-bold text-ink mb-1">
                        AI evaluation · {a?.rating} · {a?.score ?? 0} / 10
                      </p>
                      <p className="text-sm text-muted">{a?.feedback}</p>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {record.skillImpact.length > 0 && (
        <section className="glass rounded-3xl p-6 mb-6">
          <h3 className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>🧬 Skills Improved</h3>
          <p className="text-xs text-muted mb-3">Local estimates from this session. Not scientifically measured.</p>
          <div className="flex flex-wrap gap-2">
            {record.skillImpact.map(s => (
              <span key={s.skill} className="text-sm font-semibold px-3 py-1.5 rounded-xl" style={{ background: 'rgba(32,201,151,0.12)', color: '#0F8A68' }}>
                {s.skill} +{s.delta}%
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="glass rounded-3xl p-6 mb-6">
        <h3 className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>🎯 Career Readiness</h3>
        <p className="text-sm text-ink mb-1">
          Before <span className="font-black">{record.careerBefore}%</span> → After <span className="font-black text-primary">{record.careerAfter}%</span>
        </p>
        <p className="text-sm text-muted mb-3">
          Interview readiness: {record.interviewBefore} → {record.score}
        </p>
        <p className="text-sm text-muted">Your interview performance improved your overall career readiness.</p>
      </section>

      <section className="glass rounded-3xl p-6 mb-6">
        <h3 className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>✨ Your Next Best Action</h3>
        <blockquote className="text-sm text-ink mb-4 pl-3" style={{ borderLeft: '3px solid #6C5CE7' }}>
          {record.weakAreas[0]
            ? `Recommended next: practice ${record.weakAreas[0].label}.`
            : 'Recommended: keep practicing with another interview when you are ready.'}
        </blockquote>
        <p className="text-sm font-bold text-ink mb-3">
          {record.recommendations.title} · {record.recommendations.minutes} min
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => onPractice('typescript')}>
            Practice Again →
          </button>
          <button type="button" className="btn-glass" onClick={() => navigate('/courses?q=TypeScript')}>
            Explore TypeScript courses →
          </button>
        </div>
      </section>

      {record.weakAreas.length > 0 && (
        <section className="mb-6">
          <h3 className="text-lg font-black text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Practice Your Weak Areas</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            {record.weakAreas.map(w => (
              <article key={w.id} className="glass rounded-2xl p-4 career-card">
                <div className="text-base font-bold text-ink">{w.label}</div>
                <div className="text-2xl font-black text-primary career-count my-1">{w.score}%</div>
                <p className="text-xs text-muted mb-3">{w.detail}</p>
                <button type="button" className="btn-glass text-xs w-full py-2" onClick={() => onPractice(w.id)}>
                  Practice →
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {weak && (
        <section className="glass rounded-3xl p-6 mb-6">
          <h3 className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>👨‍🏫 Want Expert Feedback?</h3>
          <p className="text-sm text-muted mb-3">Want a human review of your answers?</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-4">Recommended · Explore tutors</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutors')}>
              Ask a Tutor →
            </button>
            <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutors')}>
              Find a Tutor →
            </button>
          </div>
        </section>
      )}

      <section className="glass rounded-3xl p-6 mb-6">
        <h3 className="text-lg font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Recommended learning</h3>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Explore</p>
        <p className="text-sm font-bold text-ink mb-3">Courses that match your interview topics</p>
        <button type="button" className="btn-primary text-sm" onClick={() => navigate(`/courses?q=${encodeURIComponent(record.role || 'interview')}`)}>
          Explore courses →
        </button>
      </section>

      <section className="glass rounded-3xl p-6 mb-6">
        <h3 className="text-lg font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>📊 Interview History</h3>
        <div className="space-y-3 mb-5">
          {history.map(h => (
            <article key={h.id} className="rounded-xl px-4 py-3 career-card flex flex-wrap items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(99,102,241,0.12)' }}>
              <div>
                <div className="text-sm font-bold text-ink">{h.role}</div>
                <div className="text-xs text-muted">{kindLabel(h.type)} · {relativeWhen(h.completedAt)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-lg font-black text-ink career-count">{h.score} / 100</div>
                <button type="button" className="btn-glass text-xs py-1.5" onClick={() => onReview(h.id)}>
                  Review
                </button>
              </div>
            </article>
          ))}
        </div>
        <h4 className="text-sm font-bold text-ink mb-2">Interview Score</h4>
        <TrendChart scores={trend.length ? trend : [record.score]} />
        <p className="text-xs text-muted mt-2">
          {trend.length > 1 ? `+${Math.max(0, trend[trend.length - 1] - trend[0])} points over ${trend.length} interviews` : 'Complete another interview to see a trend.'}
        </p>
      </section>

      <button type="button" className="btn-primary" onClick={onRetake}>
        Take Another Interview →
      </button>
    </div>
  )
}

function TrendChart({ scores }: { scores: number[] }) {
  const w = 280
  const h = 56
  const min = Math.min(...scores, 50)
  const max = Math.max(...scores, 90)
  const pts = scores.map((s, i) => {
    const x = scores.length === 1 ? w / 2 : (i / (scores.length - 1)) * (w - 12) + 6
    const y = h - 8 - ((s - min) / (max - min || 1)) * (h - 16)
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="iv-trend w-full max-w-sm" role="img" aria-label={`Scores ${scores.join(' to ')}`}>
      <polyline fill="none" stroke="#6C5CE7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pts.join(' ')} />
      {scores.map((s, i) => {
        const x = scores.length === 1 ? w / 2 : (i / (scores.length - 1)) * (w - 12) + 6
        const y = h - 8 - ((s - min) / (max - min || 1)) * (h - 16)
        return <circle key={`${s}-${i}`} cx={x} cy={y} r="4" fill="#22C7D6" />
      })}
    </svg>
  )
}
