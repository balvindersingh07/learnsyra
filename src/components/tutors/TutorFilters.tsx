import {
  AVAIL_FILTERS,
  EXPERIENCE_FILTERS,
  PRICE_FILTERS,
  RATING_FILTERS,
  SUPPORT_FILTERS,
  TUTOR_SKILLS,
} from '../../lib/tutorMarketplace'

export interface TutorFiltersState {
  subject: string | null
  skills: string[]
  experience: string | null
  price: string | null
  rating: number | null
  availability: string[]
  support: string[]
}

export const EMPTY_TUTOR_FILTERS: TutorFiltersState = {
  subject: null,
  skills: [],
  experience: null,
  price: null,
  rating: null,
  availability: [],
  support: [],
}

const SUBJECTS = ['Programming', 'AI & ML', 'Data', 'Business', 'MBA', 'English', 'Finance', 'Career'] as const

function subjectValue(label: string) {
  if (label === 'AI & ML') return 'AI & Machine Learning'
  if (label === 'Data') return 'Data Analytics'
  return label
}

export default function TutorFilters({
  value,
  onChange,
  onClear,
}: {
  value: TutorFiltersState
  onChange: (next: TutorFiltersState) => void
  onClear: () => void
}) {
  const toggle = (key: 'skills' | 'availability' | 'support', item: string) => {
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
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Subject</legend>
        {SUBJECTS.map(s => {
          const val = subjectValue(s)
          return (
            <label key={s} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="tutor-subject"
                className="tm-check"
                checked={value.subject === val}
                onChange={() => onChange({ ...value, subject: val })}
              />
              {s}
            </label>
          )
        })}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Skills</legend>
        {TUTOR_SKILLS.map(s => (
          <label key={s} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              className="tm-check"
              checked={value.skills.includes(s)}
              onChange={() => toggle('skills', s)}
            />
            {s}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Experience</legend>
        {EXPERIENCE_FILTERS.map(e => (
          <label key={e.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="tutor-exp"
              className="tm-check"
              checked={value.experience === e.id}
              onChange={() => onChange({ ...value, experience: e.id })}
            />
            {e.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Price</legend>
        {PRICE_FILTERS.map(p => (
          <label key={p.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="tutor-price"
              className="tm-check"
              checked={value.price === p.id}
              onChange={() => onChange({ ...value, price: p.id })}
            />
            {p.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Rating</legend>
        {RATING_FILTERS.map(r => (
          <label key={r.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="tutor-rating"
              className="tm-check"
              checked={value.rating === r.id}
              onChange={() => onChange({ ...value, rating: r.id })}
            />
            {r.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Availability</legend>
        {AVAIL_FILTERS.map(a => (
          <label key={a.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              className="tm-check"
              checked={value.availability.includes(a.id)}
              onChange={() => toggle('availability', a.id)}
            />
            {a.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Support</legend>
        {SUPPORT_FILTERS.map(s => (
          <label key={s.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              className="tm-check"
              checked={value.support.includes(s.id)}
              onChange={() => toggle('support', s.id)}
            />
            {s.label}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
