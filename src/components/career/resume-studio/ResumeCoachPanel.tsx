import { coachActionLabel, runCoachAction, type CoachAction } from '../../../lib/resumeCoach'
import type { ResumeDoc } from '../../../lib/resumeBuilder'

const ACTIONS: CoachAction[] = [
  'improve-resume',
  'ats-friendly',
  'improve-summary',
  'improve-experience',
  'measurable-impact',
  'improve-skills',
  'fix-grammar',
  'concise',
  'professional',
  'tailor-job',
]

export default function ResumeCoachPanel({
  doc,
  onApply,
}: {
  doc: ResumeDoc
  onApply: (next: ResumeDoc) => void
}) {
  return (
    <section className="glass rounded-3xl p-5 mb-6">
      <h2 className="text-lg font-black text-ink mb-2">AI Resume Coach</h2>
      <p className="text-sm text-muted mb-4">Suggestions only rephrase or reorder content you already have. No jobs, skills, metrics, or achievements are invented.</p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(action => (
          <button
            key={action}
            type="button"
            className="btn-glass text-xs"
            onClick={() => onApply(runCoachAction(doc, action))}
          >
            {coachActionLabel(action)}
          </button>
        ))}
      </div>
    </section>
  )
}
