import { relativePosted, salaryLabel, STATUSES, type AppStatus, type JobApplication, type RankedJob } from '../../lib/jobRecommendations'

export default function JobCard({
  job,
  app,
  showStatus,
  onView,
  onSave,
  onWhy,
  onApply,
  onStatus,
}: {
  job: RankedJob
  app?: JobApplication
  showStatus?: boolean
  onView: () => void
  onSave: () => void
  onWhy: () => void
  onApply: () => void
  onStatus?: (status: AppStatus) => void
}) {
  return (
    <article className="glass rounded-2xl p-5 career-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="badge badge-green text-[10px]">{job.careerFit}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg text-muted" style={{ border: '1px solid rgba(99,102,241,0.14)' }}>{job.workMode}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg text-muted" style={{ border: '1px solid rgba(99,102,241,0.14)' }}>{job.jobType}</span>
            {app?.status && app.status !== 'Saved' && (
              <span className="job-status text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'rgba(108,92,231,0.12)', color: '#5B4BD6' }}>{app.status}</span>
            )}
          </div>
          <h3 className="text-lg font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{job.title}</h3>
          <p className="text-sm font-semibold text-ink">{job.company}</p>
          <p className="text-sm text-muted">📍 {job.location}</p>
          <p className="text-sm text-ink mt-1">
            {salaryLabel(job)} · {job.yearsLabel} · Posted {relativePosted(job.postedAt)}
          </p>
        </div>
        <div className="text-right">
          {job.matchScore > 0 ? (
            <>
              <div className="text-2xl font-black text-primary career-count">{job.matchScore}%</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">LearnSyra Match</div>
              <div className="progress-bar mt-1 w-24 ml-auto" aria-hidden="true">
                <div className="progress-fill" style={{ width: `${job.matchScore}%` }} />
              </div>
            </>
          ) : (
            <div className="text-xs font-semibold text-muted max-w-[7rem]">Set your career goal</div>
          )}
        </div>
      </div>
      {job.matchScore > 0 ? (
      <p className="text-xs font-semibold text-ink mt-3 mb-1">Why this matches you</p>
      ) : (
      <p className="text-xs font-semibold text-ink mt-3 mb-1">Explore this listing</p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {job.matchReasons.map((r, i) => (
          <span key={`${r}-${i}`} className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'rgba(32,201,151,0.12)', color: '#0F8A68' }}>✓ {r}</span>
        ))}
      </div>
      {job.skillGaps.length > 0 && (
        <>
          <p className="text-xs font-semibold text-ink mb-1">Missing / Weak</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {job.skillGaps.map(g => (
              <span key={g} className="job-gap text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>⚠ {g}</span>
            ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary text-xs" onClick={onView}>View Job →</button>
        <button type="button" className="btn-glass text-xs job-heart" data-on={app?.saved === true} onClick={onSave} aria-pressed={app?.saved === true} aria-label={app?.saved ? 'Unsave job' : 'Save job'}>
          {app?.saved ? '♥ Saved' : '♡ Save'}
        </button>
        <button type="button" className="btn-glass text-xs" onClick={onApply}>Apply →</button>
        <button type="button" className="text-xs font-semibold text-primary underline-offset-2 hover:underline" onClick={onWhy}>Why this matches you</button>
        {showStatus && onStatus && (
          <label className="text-xs font-semibold text-muted ml-auto">
            Update Status
            <select
              className="field ml-2 text-xs py-1"
              value={app?.status ?? 'Saved'}
              onChange={e => onStatus(e.target.value as AppStatus)}
              aria-label={`Update status for ${job.title}`}
            >
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>
    </article>
  )
}
