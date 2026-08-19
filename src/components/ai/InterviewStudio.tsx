import { useEffect, useState } from 'react'
import { INTERVIEW_FEEDBACK, INTERVIEW_QUESTIONS } from '../../lib/aiLearning'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function InterviewStudio({
  onPractice,
}: {
  onPractice: () => void
}) {
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [done, setDone] = useState(false)
  const total = INTERVIEW_QUESTIONS.length

  useEffect(() => {
    if (done) return
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [done])

  const submit = () => {
    if (!answer.trim()) return
    if (i + 1 >= total) {
      setDone(true)
      return
    }
    setI(i + 1)
    setAnswer('')
  }

  if (done) {
    return (
      <div className="flex-1 overflow-y-auto p-5 md:p-6">
        <div className="glass rounded-2xl p-6 max-w-xl mx-auto">
          <div className="text-xs font-semibold text-primary mb-1">🎤 AI Mock Interview</div>
          <h2 className="text-xl font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            Interview Score
          </h2>
          <div className="text-4xl font-black gradient-text mb-4">{INTERVIEW_FEEDBACK.score} / 100</div>
          <div className="space-y-3 mb-4">
            {INTERVIEW_FEEDBACK.breakdown.map(b => (
              <div key={b.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">{b.label}</span>
                  <span className="font-semibold text-ink">{b.v}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${b.v}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted leading-relaxed mb-4">
            <span className="font-semibold text-ink">AI recommendation </span>
            {INTERVIEW_FEEDBACK.rec}
          </p>
          <button type="button" className="btn-primary text-sm" onClick={onPractice}>
            Practice React architecture →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-6">
      <div className="glass rounded-2xl p-5 md:p-6 max-w-2xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              🎤 AI Mock Interview
            </h2>
            <div className="text-sm text-muted mt-1">Role: Junior Frontend Developer</div>
            <div className="text-sm text-muted">Topic: React · Beginner → Intermediate</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-ink">{formatTime(seconds)}</div>
            <div className="text-xs text-muted">Question {i + 1} / {total}</div>
          </div>
        </div>
        <p className="text-base font-semibold text-ink leading-relaxed mb-4">
          {INTERVIEW_QUESTIONS[i]}
        </p>
        <label className="sr-only" htmlFor="interview-answer">Your answer</label>
        <textarea
          id="interview-answer"
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Speak your answer here…"
          className="field w-full p-3 text-sm mb-3"
          style={{ minHeight: 140, resize: 'vertical' }}
        />
        <button type="button" className="btn-primary text-sm" onClick={submit} disabled={!answer.trim()}>
          {i + 1 >= total ? 'Finish interview' : 'Submit answer'}
        </button>
      </div>
    </div>
  )
}
