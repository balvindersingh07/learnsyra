import type { ResumeSectionId } from '../../../lib/resumeBuilder'
import { coachActionLabel, runCoachAction, type CoachAction } from '../../../lib/resumeCoach'
import type { ResumeDoc } from '../../../lib/resumeBuilder'

const SECTION_ACTIONS: Partial<Record<ResumeSectionId, CoachAction[]>> = {
  summary: ['improve-summary', 'ats-friendly', 'concise', 'professional', 'fix-grammar'],
  experience: ['improve-experience', 'measurable-impact', 'fix-grammar'],
  skills: ['improve-skills', 'ats-friendly'],
  projects: ['improve-resume'],
  target: ['tailor-job'],
}

export default function SectionAiBar({
  section,
  doc,
  onApply,
  onImproveBullet,
}: {
  section: ResumeSectionId
  doc: ResumeDoc
  onApply: (next: ResumeDoc) => void
  onImproveBullet?: () => void
}) {
  const actions = SECTION_ACTIONS[section] ?? []
  if (!actions.length && section !== 'experience') return null
  return (
    <div className="rs-ai-bar">
      <span className="rs-ai-label">AI assist</span>
      <div className="rs-ai-actions">
        {actions.map(action => (
          <button key={action} type="button" className="rs-btn rs-btn-ai" onClick={() => onApply(runCoachAction(doc, action))}>
            {coachActionLabel(action)}
          </button>
        ))}
        {section === 'experience' && onImproveBullet && (
          <button type="button" className="rs-btn rs-btn-ai" onClick={onImproveBullet}>Improve Bullet</button>
        )}
        <button type="button" className="rs-btn rs-btn-ai" onClick={() => onApply(runCoachAction(doc, 'improve-resume'))}>Improve Resume</button>
      </div>
    </div>
  )
}
