import type { CatalogProject, ProjectProgress } from '../../lib/projectWorkspace'
import { formatDuration, progressPct } from '../../lib/projectWorkspace'

export default function ProjectCard({
  project,
  progress,
  wished,
  onOpen,
  onStart,
  onWish,
}: {
  project: CatalogProject
  progress?: ProjectProgress
  wished: boolean
  onOpen: () => void
  onStart: () => void
  onWish: () => void
}) {
  const pct = progress && progress.status !== 'not-started' ? progressPct(project, progress) : 0
  const started = progress && progress.status !== 'not-started'
  const visible = project.badges.filter(b =>
    ['AI Recommended', 'Portfolio Ready', 'New', 'Popular', 'Tutor Supported'].includes(b),
  )

  return (
    <article className="project-card glass rounded-2xl overflow-hidden card-hover flex flex-col">
      <button
        type="button"
        className="text-left cursor-pointer"
        onClick={onOpen}
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        <div
          className="h-36 flex items-center justify-center relative thumb-3d project-thumb"
          style={{ background: `linear-gradient(135deg, ${project.visual.color}26, ${project.visual.color}10)` }}
        >
          <div className="thumb-inner flex items-center justify-center w-full h-full">
            <span
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
              style={{ background: `linear-gradient(135deg, ${project.visual.color}, #22C7D6)` }}
            >
              {project.visual.icon}
            </span>
          </div>
          <div className="absolute top-3 left-3 flex flex-wrap gap-1 max-w-[80%]">
            {visible.slice(0, 3).map(b => (
              <span
                key={b}
                className={`badge ${b === 'New' || b === 'Popular' ? 'badge-amber' : 'badge-primary'}`}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </button>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="text-sm font-bold text-ink leading-snug"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
          >
            {project.title}
          </h3>
          <button
            type="button"
            aria-label={wished ? `Remove ${project.title} from saved projects` : `Save ${project.title}`}
            aria-pressed={wished}
            onClick={onWish}
            className={`w-8 h-8 rounded-lg flex-shrink-0 cursor-pointer ${wished ? 'wish-pop' : ''}`}
            style={{
              background: wished ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(99,102,241,0.12)',
              color: wished ? '#E11D48' : '#667085',
            }}
          >
            {wished ? '♥' : '♡'}
          </button>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-3">{project.description}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mb-3">
          <span className="font-semibold text-ink">{project.difficulty}</span>
          <span>{formatDuration(project.estimatedMinutes)}</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {project.skills.slice(0, 3).map(s => (
            <span key={s} className="badge badge-primary">
              {s}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted mb-3">
          {project.aiSupport && <span>🤖 AI</span>}
          {project.tutorSupport && <span>👨‍🏫 Tutor</span>}
        </div>
        {started ? (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>{pct}% Complete</span>
              <span className="capitalize">{progress?.status.replace('-', ' ')}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill pw-bar" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}
        <div className="mt-auto flex gap-2">
          <button type="button" className="flex-1 btn-primary text-sm py-2.5" onClick={onStart}>
            {started ? 'Continue →' : 'Start Project →'}
          </button>
        </div>
      </div>
    </article>
  )
}
