import { useEffect, useState } from 'react'
import { INTERVIEW_QUESTIONS } from '../../lib/aiLearning'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function InterviewStudio({
  targetRole,
  onPractice,
}: {
  targetRole?: string | null
  onPractice: () => void
}) {
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [done, setDone] = useState(false)
  const total = INTERVIEW_QUESTIONS.length
  const roleLabel = targetRole?.trim() || 'Choose a target role'

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
            Interview complete
          </h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Practice session finished{targetRole?.trim() ? ` for ${targetRole.trim()}` : ''}. Scores appear after a real interview in Career Center — this studio does not invent a score.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={onPractice}>
            Practice again →
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
            <div className="text-sm text-muted mt-1">Role: {roleLabel}</div>
            <div className="text-sm text-muted">Topic: Practice questions</div>
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
