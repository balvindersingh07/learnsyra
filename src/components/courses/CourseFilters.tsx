export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
export const DURATIONS = [
  { id: 'under5', label: 'Under 5 hours' },
  { id: '5to20', label: '5–20 hours' },
  { id: '20to50', label: '20–50 hours' },
  { id: 'over50', label: '50+ hours' },
] as const
export const PRICES = [
  { id: 'free', label: 'Free' },
  { id: 'under500', label: 'Under ₹500' },
  { id: '500to1000', label: '₹500–₹1,000' },
  { id: 'over1000', label: '₹1,000+' },
] as const
export const RATINGS = [
  { id: 4.5, label: '4.5+' },
  { id: 4, label: '4.0+' },
  { id: 3.5, label: '3.5+' },
] as const
export const SUPPORT = ['AI Tutor', 'Human Tutor', 'Projects', 'Certificate'] as const
export const SIDEBAR_CATS = ['Programming', 'AI & ML', 'Data', 'Business', 'MBA', 'English', 'Finance', 'Career'] as const

export function sidebarCatToNav(cat: string) {
  if (cat === 'AI & ML') return 'AI & Machine Learning'
  if (cat === 'Data') return 'Data Analytics'
  if (cat === 'Career') return 'Career Skills'
  return cat
}

export interface MarketFilters {
  levels: string[]
  duration: string | null
  price: string | null
  rating: number | null
  support: string[]
}

export const EMPTY_FILTERS: MarketFilters = {
  levels: [],
  duration: null,
  price: null,
  rating: null,
  support: [],
}

export default function CourseFilters({
  value,
  category,
  onCategory,
  onChange,
  onClear,
}: {
  value: MarketFilters
  category: string
  onCategory: (c: string) => void
  onChange: (next: MarketFilters) => void
  onClear: () => void
}) {
  const toggleArr = (key: 'levels' | 'support', item: string) => {
    const cur = value[key]
    onChange({
      ...value,
      [key]: cur.includes(item) ? cur.filter(x => x !== item) : [...cur, item],
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Filters</h3>
        <button type="button" className="text-xs font-semibold text-primary cursor-pointer" style={{ background: 'none', border: 'none' }} onClick={onClear}>
          Clear Filters
        </button>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Category</legend>
        {SIDEBAR_CATS.map(c => {
          const nav = sidebarCatToNav(c)
          return (
            <label key={c} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="mkt-cat"
                checked={category === nav}
                onChange={() => onCategory(nav)}
                className="accent-indigo-500"
              />
              {c}
            </label>
          )
        })}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Level</legend>
        {LEVELS.map(l => (
          <label key={l} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="checkbox" checked={value.levels.includes(l)} onChange={() => toggleArr('levels', l)} className="accent-indigo-500" />
            {l}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Duration</legend>
        {DURATIONS.map(d => (
          <label key={d.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="mkt-dur"
              checked={value.duration === d.id}
              onChange={() => onChange({ ...value, duration: d.id })}
              className="accent-indigo-500"
            />
            {d.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Price</legend>
        {PRICES.map(p => (
          <label key={p.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="mkt-price"
              checked={value.price === p.id}
              onChange={() => onChange({ ...value, price: p.id })}
              className="accent-indigo-500"
            />
            {p.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Rating</legend>
        {RATINGS.map(r => (
          <label key={r.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="radio"
              name="mkt-rating"
              checked={value.rating === r.id}
              onChange={() => onChange({ ...value, rating: r.id })}
              className="accent-indigo-500"
            />
            {r.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Learning Support</legend>
        {SUPPORT.map(s => (
          <label key={s} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input type="checkbox" checked={value.support.includes(s)} onChange={() => toggleArr('support', s)} className="accent-indigo-500" />
            {s}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
