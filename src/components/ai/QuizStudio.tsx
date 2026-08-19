import { useState } from 'react'
import { QUIZ_QUESTIONS } from '../../lib/aiLearning'

export default function QuizStudio({
  onPractice,
}: {
  onPractice: () => void
}) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const q = QUIZ_QUESTIONS[i]
  const total = QUIZ_QUESTIONS.length
  const pct = Math.round((score / total) * 100)

  const choose = (idx: number) => {
    if (locked) return
    setPicked(idx)
    setLocked(true)
    if (idx === q.answer) setScore(s => s + 1)
  }

  const next = () => {
    if (i + 1 >= total) {
      setDone(true)
      return
    }
    setI(i + 1)
    setPicked(null)
    setLocked(false)
  }

  if (done) {
    return (
      <div className="flex-1 overflow-y-auto p-5 md:p-6">
        <div className="glass rounded-2xl p-6 max-w-xl mx-auto text-center">
          <div className="text-xs font-semibold text-primary mb-2">🎯 React Hooks Quiz</div>
          <h2 className="text-2xl font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            Score
          </h2>
          <div className="text-4xl font-black gradient-text mb-1">{score} / {total}</div>
          <div className="text-lg font-bold text-ink mb-4">{pct}%</div>
          <p className="text-sm text-muted leading-relaxed mb-5">
            You are strong in useState. Review dependency arrays in useEffect.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={onPractice}>
            Practice Weak Area →
          </button>
        </div>
      </div>
    )
  }

  const stateFor = (idx: number) => {
    if (!locked) return picked === idx ? 'selected' : 'idle'
    if (idx === q.answer) return 'correct'
    if (idx === picked) return 'wrong'
    return 'idle'
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-6">
      <div className="glass rounded-2xl p-5 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            🎯 React Hooks Quiz
          </h2>
          <span className="text-sm text-muted">Question {i + 1} / {total}</span>
        </div>
        <div className="progress-bar mb-5">
          <div className="progress-fill" style={{ width: `${((i + (locked ? 1 : 0)) / total) * 100}%` }} />
        </div>
        <p className="text-base font-semibold text-ink mb-4 leading-relaxed">{q.q}</p>
        <div className="space-y-2 mb-4">
          {q.options.map((opt, idx) => (
            <button
              key={opt}
              type="button"
              className="ai-opt w-full text-left rounded-xl px-3 py-3 text-sm cursor-pointer"
              data-state={stateFor(idx)}
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(99,102,241,0.14)',
              }}
              onClick={() => choose(idx)}
            >
              {opt}
            </button>
          ))}
        </div>
        {locked && (
          <p className="text-sm text-muted leading-relaxed mb-4">{q.explain}</p>
        )}
        <button type="button" className="btn-primary text-sm" disabled={!locked} onClick={next}>
          {i + 1 >= total ? 'See score' : 'Next Question'}
        </button>
      </div>
    </div>
  )
}
