import { PROJECT_SKILLS, TIME_FILTERS } from '../../lib/projectWorkspace'

export interface ProjectFiltersState {
  difficulty: string[]
  time: string | null
  skills: string[]
  support: string[]
  career: string[]
}

export const EMPTY_PROJECT_FILTERS: ProjectFiltersState = {
  difficulty: [],
  time: null,
  skills: [],
  support: [],
  career: [],
}

const DIFFS = ['Beginner', 'Intermediate', 'Advanced']
const SUPPORT = [
  { id: 'ai', label: 'AI Assistance' },
  { id: 'tutor', label: 'Tutor Assistance' },
]
const CAREER = [
  { id: 'portfolio', label: 'Portfolio Ready' },
  { id: 'interview', label: 'Interview Practice' },
  { id: 'job', label: 'Job Relevant' },
]

export default function ProjectFilters({
  value,
  onChange,
  onClear,
}: {
  value: ProjectFiltersState
  onChange: (next: ProjectFiltersState) => void
  onClear: () => void
}) {
  const toggle = (key: 'difficulty' | 'skills' | 'support' | 'career', item: string) => {
    const cur = value[key]
    onChange({
      ...value,
      [key]: cur.includes(item) ? cur.filter(x => x !== item) : [...cur, item],
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Filters
        </h3>
        <button
          type="button"
          className="text-xs font-semibold text-primary cursor-pointer"
          style={{ background: 'none', border: 'none' }}
          onClick={onClear}
        >
          Clear Filters
        </button>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Difficulty</legend>
        {DIFFS.map(d => (
          <label key={d} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              className="pw-check"
              checked={value.difficulty.includes(d)}
              onChange={() => toggle('difficulty', d)}
            />
            {d}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Estimated Time</legend>
        {TIME_FILTERS.map(t => (
          <label key={t.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="project-time"
              className="pw-check"
              checked={value.time === t.id}
              onChange={() => onChange({ ...value, time: t.id })}
            />
            {t.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Skills</legend>
        {PROJECT_SKILLS.map(s => (
          <label key={s} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              className="pw-check"
              checked={value.skills.includes(s)}
              onChange={() => toggle('skills', s)}
            />
            {s}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Support</legend>
        {SUPPORT.map(s => (
          <label key={s.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              className="pw-check"
              checked={value.support.includes(s.id)}
              onChange={() => toggle('support', s.id)}
            />
            {s.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Career</legend>
        {CAREER.map(c => (
          <label key={c.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              className="pw-check"
              checked={value.career.includes(c.id)}
              onChange={() => toggle('career', c.id)}
            />
            {c.label}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
