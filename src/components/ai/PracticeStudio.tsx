import { useState } from 'react'
import { CODING_TASK, PRACTICE_TASK } from '../../lib/aiLearning'

export default function PracticeStudio({
  variant,
  onAskTutor,
}: {
  variant: 'practice' | 'coding'
  onAskTutor: () => void
}) {
  const task = variant === 'coding' ? CODING_TASK : PRACTICE_TASK
  const [code, setCode] = useState(task.starter)
  const [output, setOutput] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const run = () => {
    setRunning(true)
    setOutput(null)
    window.setTimeout(() => {
      setRunning(false)
      setOutput(
        variant === 'coding'
          ? 'Loading…\n["Ada", "Lin"]\n(Mock run — fetch is simulated.)'
          : '3\n+ clicked\n(Mock run — state updates are simulated.)',
      )
    }, 700)
  }

  const submit = () => {
    const hasReset = /setCount\(0\)|reset/i.test(code)
    const hasEffect = /useEffect\s*\(/.test(code) && /\[\]/.test(code)
    setFeedback(
      variant === 'coding'
        ? hasEffect
          ? 'Solid. You mounted the effect once. Add a loading flag next.'
          : task.success
        : hasReset
          ? 'Nice — increment and reset are both in place. Try the functional updater next: setCount(c => c + 1).'
          : task.success,
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-6">
      <div className="glass rounded-2xl p-5 max-w-3xl mx-auto">
        <div className="text-xs font-semibold text-primary mb-1">🧠 Practice Challenge</div>
        <h2 className="text-xl font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {task.title}
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="badge badge-primary">{task.difficulty}</span>
          <span className="badge badge-accent">{task.minutes} min</span>
        </div>
        <p className="text-sm text-muted leading-relaxed mb-4">{task.description}</p>

        <label className="text-sm font-semibold text-ink mb-2 block" htmlFor="starter-code">Starter code</label>
        <textarea
          id="starter-code"
          value={code}
          onChange={e => setCode(e.target.value)}
          spellCheck={false}
          className="field w-full p-3 text-sm mb-3"
          style={{ fontFamily: 'JetBrains Mono,monospace', minHeight: 220, resize: 'vertical' }}
        />

        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" className="btn-primary text-sm" onClick={run} disabled={running}>
            {running ? 'Running…' : 'Run Code'}
          </button>
          <button type="button" className="btn-glass text-sm" onClick={() => setHint(task.hint)}>
            Get Hint
          </button>
          <button type="button" className="btn-glass text-sm" onClick={submit}>
            Submit
          </button>
          <button type="button" className="btn-glass text-sm" onClick={onAskTutor}>
            Ask a tutor
          </button>
        </div>

        {output && (
          <pre className="ai-code p-3 text-xs mb-3 whitespace-pre-wrap">{output}</pre>
        )}
        {hint && (
          <div className="rounded-xl px-3 py-2.5 text-sm text-muted mb-3 leading-relaxed" style={{ background: 'rgba(108,92,231,0.08)' }}>
            <span className="font-semibold text-ink">AI Hint </span>
            {hint}
          </div>
        )}
        {feedback && (
          <div className="rounded-xl px-3 py-2.5 text-sm leading-relaxed" style={{ background: 'rgba(32,201,151,0.12)', color: '#0F8A68' }}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  )
}
