import {
  CAREER_FITS,
  EXPERIENCE,
  JOB_ROLES,
  JOB_TYPES,
  LOCATIONS,
  MATCH_BANDS,
  SALARY_BANDS,
  WORK_MODES,
  type ExperienceBand,
  type JobFilters,
} from '../../lib/jobRecommendations'

function toggleIn<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item]
}

export default function JobFiltersPanel({
  filters,
  onChange,
  resetExperience,
}: {
  filters: JobFilters
  onChange: (next: JobFilters) => void
  resetExperience: ExperienceBand
}) {
  return (
    <div className="space-y-4 text-sm">
      <fieldset>
        <legend className="text-xs font-bold uppercase text-muted mb-2">Role</legend>
        <div className="flex flex-wrap gap-1.5">
          {JOB_ROLES.map(r => (
            <button key={r} type="button" className="job-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={filters.roles.includes(r)} aria-pressed={filters.roles.includes(r)} onClick={() => onChange({ ...filters, roles: toggleIn(filters.roles, r) })}>{r}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-bold uppercase text-muted mb-2">Experience</legend>
        <div className="flex flex-wrap gap-1.5">
          {EXPERIENCE.map(r => (
            <button key={r} type="button" className="job-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={filters.experience.includes(r)} aria-pressed={filters.experience.includes(r)} onClick={() => onChange({ ...filters, experience: toggleIn(filters.experience, r) })}>{r}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-bold uppercase text-muted mb-2">Work Mode</legend>
        <div className="flex flex-wrap gap-1.5">
          {WORK_MODES.map(r => (
            <button key={r} type="button" className="job-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={filters.workMode.includes(r)} aria-pressed={filters.workMode.includes(r)} onClick={() => onChange({ ...filters, workMode: toggleIn(filters.workMode, r) })}>{r}</button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-xs font-bold uppercase text-muted">Location</span>
        <select className="field w-full mt-1 text-sm px-3 py-2" value={filters.location} onChange={e => onChange({ ...filters, location: e.target.value })}>
          {LOCATIONS.map(l => <option key={l}>{l}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="text-xs font-bold uppercase text-muted mb-2">Salary</legend>
        <div className="flex flex-wrap gap-1.5">
          {SALARY_BANDS.map(r => (
            <button key={r} type="button" className="job-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={filters.salary === r} aria-pressed={filters.salary === r} onClick={() => onChange({ ...filters, salary: r })}>{r}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-bold uppercase text-muted mb-2">Match Score</legend>
        <div className="flex flex-wrap gap-1.5">
          {MATCH_BANDS.map(r => (
            <button key={r.label} type="button" className="job-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={filters.matchFloor === r.floor} aria-pressed={filters.matchFloor === r.floor} onClick={() => onChange({ ...filters, matchFloor: r.floor })}>{r.label}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-bold uppercase text-muted mb-2">Job Type</legend>
        <div className="flex flex-wrap gap-1.5">
          {JOB_TYPES.map(r => (
            <button key={r} type="button" className="job-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={filters.jobType.includes(r)} aria-pressed={filters.jobType.includes(r)} onClick={() => onChange({ ...filters, jobType: toggleIn(filters.jobType, r) })}>{r}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-bold uppercase text-muted mb-2">Career Fit</legend>
        <div className="flex flex-wrap gap-1.5">
          {CAREER_FITS.map(r => (
            <button key={r} type="button" className="job-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={filters.careerFit.includes(r)} aria-pressed={filters.careerFit.includes(r)} onClick={() => onChange({ ...filters, careerFit: toggleIn(filters.careerFit, r) })}>{r}</button>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        className="btn-glass text-xs w-full"
        onClick={() => onChange({
          search: filters.search,
          roles: [],
          experience: [resetExperience],
          workMode: [],
          location: 'Any location',
          salary: 'Any Salary',
          matchFloor: 0,
          jobType: [],
          careerFit: [],
        })}
      >
        Reset filters
      </button>
    </div>
  )
}
