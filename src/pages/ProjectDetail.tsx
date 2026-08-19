import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyStudentProjects, getProjects, startProject, type ProjectRow } from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import {
  buildProjectCatalog,
  formatDuration,
  getProjectById,
  loadAllProgress,
  loadProjectWishlist,
  progressPct,
  saveAllProgress,
  saveProjectWishlist,
  type ProjectProgress,
} from '../lib/projectWorkspace'
import { projectWorkspacePath } from '../lib/paths'
import './projects-workspace.css'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wish, setWish] = useState<Set<string>>(() => new Set(loadProjectWishlist()))
  const [progressMap, setProgressMap] = useState(() => loadAllProgress())

  const catalog = useMemo(() => buildProjectCatalog(rows), [rows])
  const project = id ? getProjectById(catalog, id) : null
  const progress = project ? progressMap[project.id] : undefined
  const pct = project && progress ? progressPct(project, progress) : 0
  const currentIndex =
    project && progress
      ? Math.max(
          0,
          project.roadmap.findIndex((_, i) => {
            const m = project.milestones[i]
            return m ? m.tasks.some(t => !progress.tasks[t.id]) : false
          }),
        )
      : 0

  useEffect(() => {
    getProjects()
      .then(setRows)
      .catch(e => setError(e.message ?? 'Failed to load project'))
      .finally(() => setLoading(false))
    if (session) getMyStudentProjects().catch(() => {})
  }, [session])

  const start = async (toWorkspace: boolean) => {
    if (!project) return
    setBusy(true)
    setProgressMap(prev => {
      const current = prev[project.id]
      const next: Record<string, ProjectProgress> = {
        ...prev,
        [project.id]: {
          ...(current ?? {
            status: 'in-progress',
            tasks: {},
            files: Object.fromEntries(project.files.map(f => [f.path, f.content])),
            ranSuccessfully: false,
            readmeAdded: false,
            codeReviewed: false,
            testsCompleted: false,
          }),
          status:
            current?.status === 'completed' || current?.status === 'submitted' ? current.status : 'in-progress',
        },
      }
      saveAllProgress(next)
      return next
    })
    if (session && !project.id.startsWith('catalog-')) {
      const { error: err } = await startProject(project.id)
      if (err) setError(err)
    }
    setBusy(false)
    if (toWorkspace) navigate(projectWorkspacePath(project.id))
  }

  const toggleWish = () => {
    if (!project) return
    setWish(prev => {
      const next = new Set(prev)
      if (next.has(project.id)) next.delete(project.id)
      else next.add(project.id)
      saveProjectWishlist([...next])
      return next
    })
  }

  if (loading) {
    return <div className="pt-24 px-6 max-w-5xl mx-auto text-muted">Loading project…</div>
  }
  if (!project) {
    return (
      <div className="pt-24 px-6 max-w-5xl mx-auto">
        <p className="text-muted mb-4">{error ?? 'Project not found.'}</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/projects')}>
          Back to projects
        </button>
      </div>
    )
  }

  const wished = wish.has(project.id)

  return (
    <div className="pt-20 px-6 pb-24 max-w-5xl mx-auto overflow-x-hidden">
      <button
        type="button"
        className="text-sm text-muted cursor-pointer mb-4"
        style={{ background: 'none', border: 'none', padding: 0 }}
        onClick={() => navigate('/projects')}
      >
        ← All projects
      </button>

      <section className="glass rounded-3xl p-6 md:p-8 mb-8">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="badge badge-amber">{project.difficulty}</span>
          {project.portfolioReady && <span className="badge badge-primary">Portfolio Ready</span>}
          {project.aiSupport && <span className="badge badge-primary">AI Supported</span>}
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {project.title}
        </h1>
        <p className="text-muted text-lg mb-5">{project.tagline}</p>
        <div className="flex flex-wrap gap-3 text-sm text-muted mb-6">
          <span className="font-semibold text-ink">{formatDuration(project.estimatedMinutes)}</span>
          {project.skills.slice(0, 3).map(s => (
            <span key={s}>{s}</span>
          ))}
          <span>{project.difficulty}</span>
        </div>
        {progress && progress.status !== 'not-started' && (
          <div className="mb-5">
            <div className="text-xs text-muted mb-1">{pct}% complete</div>
            <div className="progress-bar max-w-xs">
              <div className="progress-fill pw-bar" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => start(true)}>
            Start Building →
          </button>
          <button
            type="button"
            className="btn-glass"
            aria-pressed={wished}
            onClick={toggleWish}
          >
            {wished ? '♥ Saved' : '♡ Save Project'}
          </button>
        </div>
      </section>

      <section className="glass rounded-2xl p-6 mb-6" style={{ borderColor: 'rgba(108,92,231,0.2)' }}>
        <h2 className="text-xl font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          ✨ Why LearnSyra Recommends This
        </h2>
        <p className="text-sm text-muted leading-relaxed mb-4">&ldquo;{project.aiReason}&rdquo;</p>
        <div className="text-sm font-bold text-ink mb-3">Skill Match — {project.skillMatch}%</div>
        <ul className="space-y-1.5 text-sm">
          {project.requiredSkills.map(s => (
            <li key={s.name} className="flex items-center gap-2">
              <span>{s.have ? '✓' : s.kind === 'practice' ? '→' : '○'}</span>
              <span className="text-ink font-medium">{s.name}</span>
              <span className="text-muted text-xs">
                {s.have ? 'Ready' : s.kind === 'practice' ? 'Practice' : s.kind === 'improve' ? 'Improve' : 'Nice to have'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🎯 What You&apos;ll Build
        </h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm text-ink">
          {project.outcomes.map(o => (
            <li key={o}>✓ {o}</li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🧰 Skills Required
        </h2>
        <div className="mb-3">
          <div className="text-xs font-semibold text-muted uppercase mb-2">Required</div>
          <div className="flex flex-wrap gap-2">
            {project.requiredSkills
              .filter(s => s.kind === 'required')
              .map(s => (
                <span key={s.name} className="badge badge-primary">
                  {s.name} {s.have ? '✓' : ''}
                </span>
              ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted uppercase mb-2">Nice to have</div>
          <div className="flex flex-wrap gap-2">
            {project.requiredSkills
              .filter(s => s.kind !== 'required')
              .map(s => (
                <span key={s.name} className="badge">
                  {s.name}
                </span>
              ))}
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🗺️ Project Roadmap
        </h2>
        <ol className="space-y-0">
          {project.roadmap.map((step, i) => {
            const active = i === currentIndex
            const done = i < currentIndex
            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: active ? 'rgba(108,92,231,0.18)' : done ? 'rgba(32,201,151,0.16)' : 'rgba(99,102,241,0.08)',
                      color: active ? '#5B4BD6' : done ? '#0F9F75' : '#667085',
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {i < project.roadmap.length - 1 && (
                    <span className="w-px flex-1 min-h-[18px]" style={{ background: 'rgba(99,102,241,0.16)' }} />
                  )}
                </div>
                <div className={`pb-4 text-sm ${active ? 'font-bold text-ink' : 'text-muted'}`}>{step}</div>
              </li>
            )
          })}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => start(true)}>
          Start Building →
        </button>
        <button
          type="button"
          className="btn-glass"
          onClick={() => {
            setPendingAiPrompt(
              `Help me understand the ${project.title} project. Skills: ${project.skills.join(', ')}. ${project.aiReason}`,
            )
            navigate('/ai-learning')
          }}
        >
          Ask LearnSyra
        </button>
      </div>
    </div>
  )
}
