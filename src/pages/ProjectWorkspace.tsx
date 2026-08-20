import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProjects, startProject, submitProject, type ProjectRow } from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import {
  buildProjectCatalog,
  currentMilestone,
  currentTask,
  detectRuntimeError,
  emptyProgress,
  formatCode,
  getProjectById,
  loadAllProgress,
  loadPortfolioIds,
  progressPct,
  remainingLabel,
  saveAllProgress,
  savePortfolioIds,
  submissionChecklist,
  type ProjectProgress,
} from '../lib/projectWorkspace'
import { projectPath } from '../lib/paths'
import './projects-workspace.css'

type CenterTab = 'files' | 'code' | 'preview' | 'resources'
type CoachView = 'home' | 'hint' | 'review' | 'error' | 'submit' | 'done'

const QUICK = [
  { id: 'explain', label: 'Explain Task' },
  { id: 'hint', label: 'Give Me a Hint' },
  { id: 'review', label: 'Review My Code' },
  { id: 'debug', label: 'Debug This' },
  { id: 'next', label: 'Suggest Next Step' },
  { id: 'error', label: 'Explain Error' },
  { id: 'prep', label: 'Prepare Submission' },
] as const

function persist(id: string, progress: ProjectProgress) {
  const all = loadAllProgress()
  all[id] = progress
  saveAllProgress(all)
}

type TreeNode = { name: string; path?: string; children: Record<string, TreeNode> }

function filesToTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', children: {} }
  for (const p of paths) {
    const parts = p.split('/')
    let cur = root
    parts.forEach((part, i) => {
      if (!cur.children[part]) {
        cur.children[part] = { name: part, children: {}, path: i === parts.length - 1 ? p : undefined }
      }
      cur = cur.children[part]
    })
  }
  return root
}

function FileTree({
  node,
  depth,
  active,
  onOpen,
}: {
  node: TreeNode
  depth: number
  active: string
  onOpen: (path: string) => void
}) {
  const entries = Object.values(node.children)
  return (
    <ul className={depth === 0 ? '' : 'ml-3'} style={{ borderLeft: depth ? '1px solid rgba(99,102,241,0.12)' : undefined }}>
      {entries.map(child => (
        <li key={child.path ?? child.name}>
          {child.path ? (
            <button
              type="button"
              className="pw-tree w-full text-left text-sm px-2 py-1 rounded-lg font-mono cursor-pointer"
              data-active={active === child.path}
              style={{ background: 'none', border: 'none' }}
              onClick={() => onOpen(child.path!)}
            >
              {child.name}
            </button>
          ) : (
            <div className="text-xs font-semibold text-muted px-2 py-1 font-mono">{child.name}/</div>
          )}
          {Object.keys(child.children).length > 0 && (
            <FileTree node={child} depth={depth + 1} active={active} onOpen={onOpen} />
          )}
        </li>
      ))}
    </ul>
  )
}

function ExpensePreview({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="pw-preview-card rounded-2xl p-4 border" style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Expense Dashboard
        </h3>
        <button type="button" className="btn-primary text-xs py-1.5" onClick={onAdd}>
          Add Expense
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="glass rounded-xl p-3">
          <div className="text-xs text-muted">Total Balance</div>
          <div className="text-xl font-black text-ink">$1,240</div>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="text-xs text-muted">Monthly Expenses</div>
          <div className="text-xl font-black text-ink">$386</div>
        </div>
      </div>
      <div className="h-24 rounded-xl mb-4 flex items-end gap-1 px-3 py-2" style={{ background: 'rgba(108,92,231,0.08)' }}>
        {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${h}%`, background: 'linear-gradient(180deg,#6C5CE7,#22C7D6)' }}
          />
        ))}
      </div>
      <div className="text-xs font-semibold text-muted mb-2">Recent transactions</div>
      {[
        ['Groceries', 'Food', '$54'],
        ['Metro pass', 'Travel', '$30'],
        ['Internet', 'Bills', '$42'],
      ].map(([t, c, a]) => (
        <div key={t} className="flex items-center justify-between py-2 text-sm" style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
          <div>
            <div className="font-medium text-ink">{t}</div>
            <div className="text-xs text-muted">{c}</div>
          </div>
          <div className="font-semibold text-ink">{a}</div>
        </div>
      ))}
    </div>
  )
}

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CenterTab>('code')
  const [planOpen, setPlanOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState('src/App.jsx')
  const [coach, setCoach] = useState<CoachView>('home')
  const [hintIndex, setHintIndex] = useState(0)
  const [typing, setTyping] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [confirmFix, setConfirmFix] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProjectProgress | null>(null)
  const [previewTick, setPreviewTick] = useState(0)

  const catalog = useMemo(() => buildProjectCatalog(rows), [rows])
  const project = id ? getProjectById(catalog, id) : null

  useEffect(() => {
    getProjects()
      .then(setRows)
      .catch(e => setError(e.message ?? 'Failed to load workspace'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!project) return
    const all = loadAllProgress()
    const existing = all[project.id] ?? emptyProgress(project)
    if (existing.status === 'not-started') existing.status = 'in-progress'
    if (!existing.files || !Object.keys(existing.files).length) {
      existing.files = Object.fromEntries(project.files.map(f => [f.path, f.content]))
    }
    setProgress(existing)
    persist(project.id, existing)
    const firstOpen = currentTask(project, existing)
    setExpanded(firstOpen.milestone?.id ?? project.milestones[0]?.id ?? null)
    setActiveFile(project.files[0]?.path ?? 'src/App.jsx')
  }, [project?.id])

  useEffect(() => {
    if (!project || !session || project.id.startsWith('catalog-')) return
    startProject(project.id).catch(() => {})
  }, [project?.id, session])

  const ping = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2000)
  }

  const update = (patch: Partial<ProjectProgress> | ((p: ProjectProgress) => ProjectProgress)) => {
    if (!project || !progress) return
    setProgress(prev => {
      if (!prev) return prev
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      persist(project.id, next)
      return next
    })
  }

  const pct = project && progress ? progressPct(project, progress) : 0
  const mile = project && progress ? currentMilestone(project, progress) : null
  const taskInfo = project && progress ? currentTask(project, progress) : null
  const checklist = project && progress ? submissionChecklist(project, progress) : []
  const remaining = checklist.filter(c => !c.ok)
  const dashCode = progress?.files['src/pages/Dashboard.jsx'] ?? ''
  const runtimeError = dashCode ? detectRuntimeError(dashCode) : null
  const code = progress?.files[activeFile] ?? ''

  const goAi = (prompt: string) => {
    setPendingAiPrompt(prompt)
    navigate('/ai-learning')
  }

  const withTyping = (view: CoachView, fn?: () => void) => {
    setTyping(true)
    setCoachOpen(true)
    window.setTimeout(() => {
      setTyping(false)
      setCoach(view)
      fn?.()
    }, 650)
  }

  const toggleTask = (taskId: string) => {
    if (!project || !progress) return
    update(p => {
      const tasks = { ...p.tasks, [taskId]: !p.tasks[taskId] }
      const testsCompleted = project.milestones
        .filter(m => /test/i.test(m.title))
        .every(m => m.tasks.filter(t => t.required).every(t => tasks[t.id]))
      return { ...p, tasks, testsCompleted, status: p.status === 'not-started' ? 'in-progress' : p.status }
    })
  }

  const runCode = () => {
    if (!project || !progress) return
    setTab('preview')
    setPreviewTick(n => n + 1)
    if (runtimeError) {
      update({ ranSuccessfully: false })
      withTyping('error')
      ping('Preview updated — an error was detected')
      return
    }
    update({ ranSuccessfully: true })
    ping('Preview updated')
  }

  const saveFiles = () => {
    if (!progress) return
    const readmeAdded = (progress.files['README.md'] ?? '').trim().length > 80
    update({ readmeAdded, savedAt: new Date().toISOString() })
    ping('Saved')
  }

  const applyFix = () => {
    if (!progress || !runtimeError) return
    const path = 'src/pages/Dashboard.jsx'
    const next = (progress.files[path] ?? '').replace(runtimeError.fixFrom, runtimeError.fixTo)
    update(p => ({ ...p, files: { ...p.files, [path]: next }, ranSuccessfully: true }))
    setConfirmFix(false)
    ping('Fix applied')
  }

  const doReview = () => {
    setReviewLoading(true)
    withTyping('review', () => {
      setReviewLoading(false)
      update({ codeReviewed: true })
    })
  }

  const handleQuick = (id: string) => {
    if (!project || !progress) return
    const t = taskInfo?.task?.label ?? 'current task'
    if (id === 'hint') {
      setHintIndex(0)
      setShowSolution(false)
      withTyping('hint')
      return
    }
    if (id === 'review') {
      doReview()
      return
    }
    if (id === 'debug' || id === 'error') {
      withTyping('error')
      return
    }
    if (id === 'prep') {
      setCoach('submit')
      setCoachOpen(true)
      return
    }
    const prompts: Record<string, string> = {
      explain: `Explain this project task simply: ${t}. Project: ${project.title}. Milestone: ${mile?.title}.`,
      next: `I am building ${project.title}. Current milestone: ${mile?.title}. Current task: ${t}. Suggest the next concrete step without giving the full solution.`,
    }
    goAi(prompts[id] ?? `Help with ${project.title}: ${t}`)
  }

  const submit = async () => {
    if (!project || !progress) return
    if (remaining.length) {
      setCoach('submit')
      setCoachOpen(true)
      return
    }
    const url = `https://github.com/learnsyra/demo-${project.id}`
    if (session && !project.id.startsWith('catalog-')) {
      const { error: err } = await submitProject(project.id, url)
      if (err) {
        setError(err)
        return
      }
    }
    update({
      status: 'completed',
      submittedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      score: project.review.finalOverall,
    })
    setCoach('done')
    setCoachOpen(true)
  }

  const addPortfolio = (yes: boolean) => {
    if (!project) return
    if (yes) {
      const ids = new Set(loadPortfolioIds())
      ids.add(project.id)
      savePortfolioIds([...ids])
      update({ inPortfolio: true })
      ping('Added to portfolio')
    }
  }

  if (loading && !project) {
    return <div className="pt-24 px-6 text-muted">Loading workspace…</div>
  }
  if (!project) {
    return (
      <div className="pt-24 px-6">
        <p className="text-muted mb-4">{error ?? 'Project not found.'}</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/projects')}>
          Back to projects
        </button>
      </div>
    )
  }
  if (!progress) {
    return <div className="pt-24 px-6 text-muted">Loading workspace…</div>
  }

  const fileTree = filesToTree(project.files.map(f => f.path))
  const nextProject = project.nextProjectId ? getProjectById(catalog, project.nextProjectId) : null
  const done = progress.status === 'completed' || progress.status === 'submitted'

  const planPanel = (
    <div className="h-full overflow-y-auto p-4">
      <div className="text-xs font-semibold text-muted uppercase mb-1">Project Progress</div>
      <div className="text-sm font-bold text-ink mb-2">{pct}% complete</div>
      <div className="progress-bar mb-4">
        <div className="progress-fill pw-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-2">
        {project.milestones.map(m => {
          const allDone = m.tasks.every(t => progress.tasks[t.id])
          const some = m.tasks.some(t => progress.tasks[t.id])
          const open = expanded === m.id
          const icon = allDone ? '✓' : some || mile?.id === m.id ? '▶' : '○'
          return (
            <div key={m.id} className="rounded-xl" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold cursor-pointer"
                style={{ background: open ? 'rgba(108,92,231,0.08)' : 'transparent', border: 'none' }}
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : m.id)}
              >
                <span aria-hidden>{icon}</span>
                {m.title}
              </button>
              {open && (
                <ul className="px-3 pb-3 space-y-1.5">
                  {m.tasks.map(t => (
                    <li key={t.id}>
                      <label className="flex items-start gap-2 text-sm text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          className="pw-check mt-0.5"
                          checked={Boolean(progress.tasks[t.id])}
                          onChange={() => toggleTask(t.id)}
                        />
                        <span className={progress.tasks[t.id] ? 'text-muted line-through' : ''}>{t.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  const coachPanel = (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🤖 LearnSyra Project Coach
        </h2>
        <div className="text-xs text-muted flex items-center gap-1.5">
          <span className="pw-coach-dot w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Project-aware AI
        </div>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-3">
        Understands requirements, {mile?.title ?? 'your milestone'}, {taskInfo?.task?.label ?? 'current task'}, and the
        skills you are practicing.
      </p>
      {typing && <div className="text-xs text-primary mb-3">Coach is thinking…</div>}

      {coach === 'home' && (
        <div className="grid grid-cols-1 gap-2 mb-4">
          {QUICK.map(q => (
            <button key={q.id} type="button" className="btn-glass text-sm py-2 text-left" onClick={() => handleQuick(q.id)}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      {coach === 'hint' && (
        <div className="glass rounded-xl p-3 mb-3">
          <div className="text-sm font-bold text-ink mb-1">💡 Hint</div>
          <p className="text-sm text-muted leading-relaxed">
            {showSolution ? project.solution : project.hints[Math.min(hintIndex, project.hints.length - 1)]}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn-glass text-xs py-1.5"
              onClick={() => setHintIndex(i => Math.min(i + 1, project.hints.length - 1))}
            >
              Another Hint
            </button>
            <button type="button" className="btn-glass text-xs py-1.5" onClick={() => setShowSolution(true)}>
              Show Solution
            </button>
          </div>
        </div>
      )}

      {coach === 'review' && (
        <div className="glass rounded-xl p-3 mb-3">
          <div className="text-sm font-bold text-ink mb-2">✨ AI Code Review</div>
          {reviewLoading ? (
            <p className="text-xs text-muted">Reviewing your files…</p>
          ) : (
            <>
              <div className="text-lg font-black text-ink mb-2">Overall: {project.review.overall} / 100</div>
              <ul className="text-xs text-muted space-y-1 mb-3">
                {Object.entries(project.review.breakdown).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="text-ink font-semibold">{v}</span>
                  </li>
                ))}
              </ul>
              <div className="text-xs font-bold text-ink mb-1">Strengths</div>
              <ul className="text-xs text-muted mb-2">
                {project.review.strengths.map(s => (
                  <li key={s}>✓ {s}</li>
                ))}
              </ul>
              <div className="text-xs font-bold text-ink mb-1">Improve</div>
              <ul className="text-xs text-muted mb-3">
                {project.review.improve.map(s => (
                  <li key={s}>⚠ {s}</li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-primary text-sm w-full"
                onClick={() =>
                  goAi(
                    `Review this ${project.title} code and suggest improvements, but do not rewrite everything unless I ask. Current file ${activeFile}:\n${code.slice(0, 1800)}`,
                  )
                }
              >
                Fix With AI →
              </button>
            </>
          )}
        </div>
      )}

      {coach === 'error' && (
        <div className="glass rounded-xl p-3 mb-3" style={{ borderColor: 'rgba(244,63,94,0.25)' }}>
          <div className="text-sm font-bold text-ink mb-1">⚠️ Error Detected</div>
          {runtimeError ? (
            <>
              <code className="text-xs text-rose-500 block mb-2">{runtimeError.title}</code>
              <p className="text-sm text-muted mb-2">&ldquo;{runtimeError.why}&rdquo;</p>
              <div className="text-xs font-bold text-ink">Why this happens</div>
              <p className="text-xs text-muted mb-2">{runtimeError.how}</p>
              <div className="text-xs font-bold text-ink">How to fix it</div>
              <p className="text-xs text-muted mb-2">{runtimeError.tryThis}</p>
              <div className="text-xs font-bold text-ink mb-1">Try this</div>
              <pre className="text-[11px] bg-white/70 rounded-lg p-2 mb-3 overflow-x-auto">{runtimeError.fixTo}</pre>
              {!confirmFix ? (
                <button type="button" className="btn-primary text-sm w-full" onClick={() => setConfirmFix(true)}>
                  Apply Fix
                </button>
              ) : (
                <div>
                  <p className="text-xs text-muted mb-2">Apply this change to Dashboard.jsx?</p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-sm flex-1" onClick={applyFix}>
                      Confirm
                    </button>
                    <button type="button" className="btn-glass text-sm" onClick={() => setConfirmFix(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">No runtime error in the current preview. Run the project to scan again.</p>
          )}
        </div>
      )}

      {coach === 'submit' && (
        <div className="glass rounded-xl p-3 mb-3">
          <div className="text-sm font-bold text-ink mb-2">🚀 Submit Project</div>
          <ul className="text-sm space-y-1 mb-3">
            {checklist.map(c => (
              <li key={c.id} className={c.ok ? 'text-ink' : 'text-muted'}>
                {c.ok ? '✓' : '○'} {c.label}
              </li>
            ))}
          </ul>
          {remaining.length ? (
            <p className="text-sm font-semibold text-amber-600 mb-2">{remaining.length} requirements remaining</p>
          ) : (
            <button type="button" className="btn-primary w-full text-sm" onClick={submit}>
              Submit Project →
            </button>
          )}
        </div>
      )}

      {coach === 'done' && (
        <div className="pw-celebrate space-y-3">
          <div className="text-lg font-black text-ink">🎉 Project Submitted</div>
          <div>
            <div className="text-sm font-bold text-ink">AI Project Review</div>
            <div className="text-xl font-black text-ink">Overall Score — {project.review.finalOverall} / 100</div>
            <ul className="text-xs text-muted mt-2 space-y-1">
              {Object.entries(project.review.finalBreakdown).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span className="text-ink font-semibold">{v}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold text-ink mb-1">What you did well</div>
            {project.review.didWell.map(s => (
              <div key={s} className="text-xs text-muted">
                ✓ {s}
              </div>
            ))}
          </div>
          <div>
            <div className="text-xs font-bold text-ink mb-1">Improve next</div>
            {project.review.nextImprove.map(s => (
              <div key={s} className="text-xs text-muted">
                ⚠ {s}
              </div>
            ))}
          </div>
          <div className="glass rounded-xl p-3 pw-badge-in text-center">
            <div>🏆 Project Completed</div>
            <div className="font-black text-ink">{project.badgeName}</div>
            <button type="button" className="btn-primary text-xs mt-2 py-1.5" onClick={() => navigate('/career')}>
              Add to Portfolio →
            </button>
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-sm font-bold text-ink mb-1">💼 Add This Project to Your Portfolio?</div>
            <div className="text-xs text-muted mb-2">
              {project.title} · {project.skills.slice(0, 3).join(' · ')} · {project.review.finalOverall} / 100
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary text-xs py-1.5" onClick={() => addPortfolio(true)}>
                Add to Portfolio
              </button>
              <button type="button" className="btn-glass text-xs py-1.5" onClick={() => addPortfolio(false)}>
                Not Now
              </button>
            </div>
          </div>
          {project.careerMatchFrom > 0 && (
          <div className="glass rounded-xl p-3">
            <div className="text-sm font-bold text-ink mb-1">Career Impact</div>
            <p className="text-xs text-muted mb-2">This project strengthens {project.careerImpact.length} skills required for your target role.</p>
            {project.careerImpact.map(c => (
              <div key={c.skill} className="flex justify-between text-xs">
                <span>{c.skill}</span>
                <span className="font-semibold text-success">+{c.delta}%</span>
              </div>
            ))}
            <div className="text-xs font-semibold text-ink mt-2">
              Career match: {project.careerMatchFrom}% → {project.careerMatchTo}%
            </div>
          </div>
          )}
          <div className="glass rounded-xl p-3 text-center">
            <div>🏆 Project Finisher</div>
            <div className="text-xs text-muted">Completed a portfolio-ready project.</div>
            <button type="button" className="btn-glass text-xs mt-2 py-1.5" onClick={() => navigate('/career')}>
              View Achievement
            </button>
          </div>
          {nextProject && (
            <div className="glass rounded-xl p-3" style={{ borderColor: 'rgba(108,92,231,0.22)' }}>
              <div className="text-sm font-bold text-ink mb-1">✨ Your Next Project</div>
              <div className="font-semibold text-ink">{nextProject.title}</div>
              <p className="text-xs text-muted mb-2">&ldquo;{nextProject.aiReason}&rdquo;</p>
              <button
                type="button"
                className="btn-primary text-sm w-full"
                onClick={() => navigate(`/projects/${nextProject.id}/workspace`)}
              >
                Start Next Project →
              </button>
            </div>
          )}
        </div>
      )}

      {coach !== 'home' && coach !== 'done' && (
        <button type="button" className="text-xs font-semibold text-primary cursor-pointer mb-4" style={{ background: 'none', border: 'none' }} onClick={() => setCoach('home')}>
          ← Coach actions
        </button>
      )}

      <div className="glass rounded-xl p-3 mt-2">
        <div className="text-sm font-bold text-ink mb-1">Need Human Help?</div>
        {project.tutor.rating > 0 ? (
          <>
            <div className="text-sm font-semibold text-ink">{project.tutor.name}</div>
            <div className="text-xs text-muted">{project.tutor.skills} · ⭐ {project.tutor.rating}</div>
          </>
        ) : (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommended · Explore tutors</p>
        )}
        <p className="text-xs text-muted my-2">
          Your AI coach can help with most issues. For architecture or complex debugging, a tutor may help.
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary text-xs py-1.5" onClick={() => navigate('/tutors')}>
            Find a Tutor
          </button>
          <button type="button" className="btn-glass text-xs py-1.5" onClick={() => navigate('/tutors')}>
            Book Session
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="pt-16 pw-workspace flex flex-col overflow-hidden">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-2 text-sm font-semibold text-ink">
          {toast}
        </div>
      )}

      <header
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'rgba(255,255,255,0.72)' }}
      >
        <div className="min-w-0">
          <button
            type="button"
            className="text-xs text-muted cursor-pointer mb-0.5"
            style={{ background: 'none', border: 'none', padding: 0 }}
            onClick={() => navigate(projectPath(project.id))}
          >
            ← Project details
          </button>
          <div className="text-sm font-bold text-ink truncate">{project.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="badge badge-primary">{done ? 'Completed' : 'In Progress'}</span>
            <span>Progress {pct}%</span>
            <span>Est. remaining {remainingLabel(project.estimatedMinutes, pct)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="lg:hidden btn-glass text-sm py-1.5" onClick={() => setPlanOpen(true)}>
            Plan
          </button>
          <button type="button" className="xl:hidden btn-glass text-sm py-1.5" onClick={() => setCoachOpen(true)}>
            AI Coach
          </button>
          <button type="button" className="btn-glass text-sm py-1.5" onClick={saveFiles}>
            Save
          </button>
          <button type="button" className="btn-primary text-sm py-1.5" onClick={submit}>
            Submit Project
          </button>
        </div>
      </header>

      <div className="lg:hidden px-4 pt-3">
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>{pct}% complete</span>
          <span className="truncate ml-2">{taskInfo?.task?.label ?? mile?.title}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill pw-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside
          className="hidden lg:flex w-72 flex-col flex-shrink-0"
          style={{ borderRight: '1px solid rgba(99,102,241,0.12)', background: 'rgba(255,255,255,0.55)' }}
        >
          {planPanel}
        </aside>

        <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="px-4 pt-3 flex flex-wrap gap-2" role="tablist" aria-label="Workspace">
            {(['files', 'code', 'preview', 'resources'] as CenterTab[]).map(t => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className="pw-tab px-3 py-1.5 rounded-xl text-sm font-semibold capitalize cursor-pointer"
                data-active={tab === t}
                style={{
                  border: '1px solid rgba(99,102,241,0.14)',
                  background: tab === t ? undefined : 'rgba(255,255,255,0.9)',
                  color: tab === t ? undefined : '#667085',
                }}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {tab === 'files' && (
              <div className="glass rounded-2xl p-4">
                <div className="text-sm font-bold text-ink mb-3">Project files</div>
                <FileTree
                  node={fileTree}
                  depth={0}
                  active={activeFile}
                  onOpen={path => {
                    setActiveFile(path)
                    setTab('code')
                  }}
                />
              </div>
            )}

            {tab === 'code' && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
                  <span className="text-xs font-mono text-muted">{activeFile}</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-glass text-xs py-1.5" onClick={runCode}>
                      Run Code
                    </button>
                    <button type="button" className="btn-glass text-xs py-1.5" onClick={saveFiles}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-glass text-xs py-1.5"
                      onClick={() => {
                        const file = project.files.find(f => f.path === activeFile)
                        update(p => ({
                          ...p,
                          files: { ...p.files, [activeFile]: formatCode(p.files[activeFile] ?? '', file?.language ?? 'js') },
                        }))
                        ping('Formatted')
                      }}
                    >
                      Format
                    </button>
                    <button type="button" className="btn-primary text-xs py-1.5" onClick={doReview}>
                      AI Review
                    </button>
                  </div>
                </div>
                <div className="flex p-3 min-h-[280px]">
                  <div className="pw-gutter" aria-hidden>
                    {code.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <label className="sr-only" htmlFor="pw-editor">
                    Code editor
                  </label>
                  <textarea
                    id="pw-editor"
                    className="pw-editor"
                    spellCheck={false}
                    value={code}
                    onChange={e =>
                      update(p => ({
                        ...p,
                        files: { ...p.files, [activeFile]: e.target.value },
                        readmeAdded: activeFile === 'README.md' ? e.target.value.trim().length > 80 : p.readmeAdded,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {tab === 'preview' && (
              <div key={previewTick} className="glass rounded-2xl p-4">
                {runtimeError && (
                  <div className="text-sm text-rose-500 mb-3">Preview warning: {runtimeError.title}</div>
                )}
                {project.previewKind === 'expense' ? (
                  <ExpensePreview onAdd={() => ping('Add Expense is a mock preview action')} />
                ) : (
                  <div className="pw-preview-card rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-ink mb-2">{project.title}</h3>
                    <p className="text-sm text-muted mb-4">{project.tagline}</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {project.outcomes.slice(0, 3).map(o => (
                        <div key={o} className="glass rounded-xl p-3 text-sm">
                          {o}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'resources' && (
              <div className="space-y-4">
                <div className="glass rounded-2xl p-4">
                  <h3 className="text-sm font-bold text-ink mb-2">📚 Resources</h3>
                  <ul className="space-y-2">
                    {project.resources.map(r => (
                      <li key={r.title}>
                        <button
                          type="button"
                          className="text-sm text-primary font-semibold cursor-pointer"
                          style={{ background: 'none', border: 'none', padding: 0 }}
                          onClick={() => {
                            if (r.href.startsWith('#')) setTab('files')
                            else navigate(r.href)
                          }}
                        >
                          {r.title}
                        </button>
                        <span className="text-xs text-muted ml-2">{r.kind}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="glass rounded-2xl p-4">
                  <div className="text-sm font-bold text-ink mb-2">Recommended for this project</div>
                  {['React Hooks lesson', 'REST API lesson', 'Authentication lesson'].map(label => (
                    <button
                      key={label}
                      type="button"
                      className="block text-sm text-primary font-semibold mb-1 cursor-pointer"
                      style={{ background: 'none', border: 'none', padding: 0 }}
                      onClick={() => navigate(`/courses?q=${encodeURIComponent(label.replace(' lesson', ''))}`)}
                    >
                      {label} →
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside
          className="hidden xl:flex w-80 flex-col flex-shrink-0"
          style={{ borderLeft: '1px solid rgba(99,102,241,0.12)', background: 'rgba(255,255,255,0.55)' }}
        >
          {coachPanel}
        </aside>
      </div>

      {planOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Project plan">
          <button type="button" className="absolute inset-0" style={{ background: 'rgba(23,32,51,0.35)', border: 'none' }} aria-label="Close plan" onClick={() => setPlanOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[min(100%,20rem)] pw-drawer bg-white overflow-y-auto">
            <div className="flex justify-between items-center p-3">
              <span className="font-bold text-ink">Project plan</span>
              <button type="button" className="btn-glass text-sm py-1.5" onClick={() => setPlanOpen(false)}>
                Close
              </button>
            </div>
            {planPanel}
          </div>
        </div>
      )}

      {coachOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-label="AI coach">
          <button type="button" className="absolute inset-0" style={{ background: 'rgba(23,32,51,0.35)', border: 'none' }} aria-label="Close coach" onClick={() => setCoachOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(100%,22rem)] pw-drawer bg-white overflow-y-auto">
            <div className="flex justify-between items-center p-3">
              <span className="font-bold text-ink">Project Coach</span>
              <button type="button" className="btn-glass text-sm py-1.5" onClick={() => setCoachOpen(false)}>
                Close
              </button>
            </div>
            {coachPanel}
          </div>
        </div>
      )}
    </div>
  )
}
