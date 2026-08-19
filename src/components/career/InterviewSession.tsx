import { useEffect, useRef, useState } from 'react'
import {
  formatClock,
  mixCounts,
  type AnswerMode,
  type LiveInterview,
} from '../../lib/interviewStudio'

function getSpeech() {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

interface SpeechRec {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export default function InterviewSession({
  live,
  onChange,
  onSubmit,
  onSkip,
  onClarify,
  onOpenContext,
}: {
  live: LiveInterview
  onChange: (text: string, mode: AnswerMode) => void
  onSubmit: () => void
  onSkip: () => void
  onClarify: () => void
  onOpenContext: () => void
}) {
  const q = live.questions[live.index]
  const total = live.questions.length
  const pct = Math.round((live.index / total) * 100)
  const mix = mixCounts(live.questions, live.index)
  const [mode, setMode] = useState<AnswerMode>(q?.preferredMode ?? 'text')
  const [recording, setRecording] = useState(false)
  const [clarify, setClarify] = useState(false)
  const recRef = useRef<SpeechRec | null>(null)
  const answer = live.answers[live.index]?.text ?? ''
  const Speech = getSpeech()

  useEffect(() => {
    setMode(q?.preferredMode ?? 'text')
    setClarify(false)
  }, [q?.id, q?.preferredMode])

  const startVoice = () => {
    if (!Speech) {
      setRecording(true)
      window.setTimeout(() => {
        setRecording(false)
        onChange(`${answer}${answer ? ' ' : ''}[Voice note captured locally — add detail in text if needed.]`.trim(), 'voice')
      }, 1600)
      return
    }
    const rec = new Speech()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = ev => {
      const said = ev.results[0]?.[0]?.transcript ?? ''
      onChange(`${answer}${answer ? ' ' : ''}${said}`.trim(), 'voice')
    }
    rec.onend = () => setRecording(false)
    recRef.current = rec
    setRecording(true)
    rec.start()
  }

  const stopVoice = () => {
    recRef.current?.stop()
    setRecording(false)
  }

  if (!q) return null

  return (
    <div className="iv-workspace max-w-6xl mx-auto px-4 sm:px-6 pb-8">
      <header className="glass rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            AI Interview · {live.setup.role}
          </div>
          <div className="text-xs text-muted">
            {live.setup.kind === 'mixed' ? 'Mixed Interview' : live.setup.kind} · {live.setup.difficulty}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-ink tabular-nums" aria-label={`Time remaining ${formatClock(live.remainingSec)}`}>
            {formatClock(live.remainingSec)}
          </div>
          <div className="text-sm font-semibold text-primary">
            Question {live.index + 1} / {total}
          </div>
          <button type="button" className="btn-glass text-xs lg:hidden py-1.5" onClick={onOpenContext}>
            Context
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.75fr)] gap-4">
        <section className="glass rounded-3xl p-5 sm:p-6" aria-labelledby="interviewer-heading">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="interviewer-heading" className="text-lg font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              🤖 LearnSyra Interviewer
            </h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-success">
              <span className="iv-pulse" aria-hidden="true" />
              Interview in progress
            </div>
          </div>
          <p className="text-xs text-muted mb-2">
            Question {live.index + 1} of {total} · {q.category}
          </p>
          <blockquote key={q.id} className="iv-q text-base sm:text-lg font-semibold text-ink leading-relaxed mb-5">
            {q.question}
          </blockquote>

          <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Answer mode">
            {(['text', 'voice', 'code'] as AnswerMode[]).map(m => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className="iv-seg px-3 py-1.5 rounded-xl text-xs font-semibold border"
                data-on={mode === m}
                onClick={() => setMode(m)}
              >
                {m === 'text' ? '💬 Text' : m === 'voice' ? '🎤 Voice' : '💻 Code'}
              </button>
            ))}
          </div>

          {mode === 'voice' && (
            <div className="mb-3">
              <button
                type="button"
                className="btn-glass text-sm"
                onClick={recording ? stopVoice : startVoice}
                aria-pressed={recording}
              >
                {recording ? 'Stop Recording' : 'Start Recording'}
              </button>
              {!Speech && <p className="text-xs text-muted mt-2">Browser speech recognition is unavailable. A local voice note placeholder will be added.</p>}
            </div>
          )}

          <label className="sr-only" htmlFor="iv-answer">
            Your answer
          </label>
          <textarea
            id="iv-answer"
            value={answer}
            onChange={e => onChange(e.target.value, mode)}
            placeholder={mode === 'code' ? 'function unique(values) {\n  // type your solution\n}' : 'Type your answer...'}
            className="field w-full p-3 text-sm mb-3"
            spellCheck={mode !== 'code'}
            style={{
              minHeight: mode === 'code' ? 180 : 140,
              resize: 'vertical',
              fontFamily: mode === 'code' ? 'JetBrains Mono,monospace' : undefined,
            }}
          />

          {clarify && (
            <p className="text-sm text-muted mb-3" role="status">
              {q.clarification}
            </p>
          )}
          {live.hint && (
            <p className="text-sm font-semibold text-primary mb-3" role="status">
              {live.hint === 'Answer recorded' ? 'Answer recorded ✓' : live.hint}
            </p>
          )}

          <div className="iv-sticky flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={onSubmit} disabled={!answer.trim()}>
              Submit Answer →
            </button>
            <button type="button" className="btn-glass" onClick={onSkip}>
              Skip
            </button>
            <button type="button" className="btn-glass" onClick={() => { setClarify(true); onClarify() }}>
              Ask for Clarification
            </button>
          </div>
        </section>

        <aside className="glass rounded-3xl p-5 hidden lg:block" aria-labelledby="ctx-heading">
          <h2 id="ctx-heading" className="text-base font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            🎯 Interview Context
          </h2>
          <ContextBody live={live} pct={pct} mix={mix} />
        </aside>
      </div>
    </div>
  )
}

export function ContextBody({
  live,
  pct,
  mix,
}: {
  live: LiveInterview
  pct: number
  mix: ReturnType<typeof mixCounts>
}) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-xs text-muted">Role</div>
        <div className="font-bold text-ink">{live.setup.role}</div>
      </div>
      <div>
        <div className="text-xs text-muted">Difficulty</div>
        <div className="font-bold text-ink">{live.setup.difficulty}</div>
      </div>
      <div>
        <div className="text-xs text-muted">Duration</div>
        <div className="font-bold text-ink">{live.setup.duration} min · {formatClock(live.remainingSec)} left</div>
      </div>
      <div>
        <div className="text-xs text-muted">Focus</div>
        <div className="font-semibold text-ink">React · JavaScript · REST APIs</div>
      </div>
      <div>
        <div className="text-xs text-muted">Weak Areas</div>
        <div className="font-semibold text-ink">TypeScript · Testing</div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted">Progress</span>
          <span className="font-bold text-ink">{pct}%</span>
        </div>
        <div className="progress-bar" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-xs text-muted">
        Technical — {mix.technical} · Behavioral — {mix.behavioral} · Project — {mix.project}
      </div>
    </div>
  )
}
