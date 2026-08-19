import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  buildsForProject,
  formatWhen,
  isProjectModerationBackendAvailable,
  isProjectReportingAvailable,
  loadAdminProjectIndex,
  loadProjectNotes,
  projectInsights,
  projectReviewSummary,
  projectStatusLabel,
  saveProjectNote,
  studentBuildLabel,
  studentReviewLabel,
  type AdminProjectIndex,
  type AdminProjectRow,
} from '../lib/adminProjects'
import './admin-control.css'

type DetailTab = 'overview' | 'activity' | 'submissions' | 'moderation'

export default function AdminProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminProjectIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [explain, setExplain] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminProjectIndex()
      .then(setIndex)
      .catch(() => setError("Project details couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (id) setNote(loadProjectNotes()[id] ?? '')
  }, [id])

  const project: AdminProjectRow | null = index?.catalog.find(p => p.id === id) ?? null
  const builds = index && project ? buildsForProject(index, project.id) : []
  const submissions = builds.filter(b => b.status === 'submitted' || b.status === 'completed')
  const reviews = builds.filter(b => b.reviewNote?.trim())
  const insights = project ? projectInsights(project) : []
  const moderation = isProjectModerationBackendAvailable()
  const reporting = isProjectReportingAvailable()
  const blocked = 'Project moderation actions are not connected.'

  useEffect(() => {
    if (!explain) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        setExplain(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [explain])

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Student activity' },
    { id: 'submissions', label: 'Submissions' },
    { id: 'moderation', label: 'Moderation' },
  ]

  return (
    <AdminShell>
      <div className="ac-dash">
        <button type="button" className="btn-glass text-xs mb-3" onClick={() => navigate('/admin/projects')}>← Projects</button>
        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {loading && <div className="ac-skel mb-4" aria-busy="true" />}
        {!loading && !project && !error && <p className="text-[13px] text-muted">Project details couldn't be loaded. This project is not in the catalog.</p>}
        {project && index && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{project.title}</h1>
                <p className="text-[13px] text-muted">
                  Creator not provided · {projectStatusLabel()} · {project.difficulty || 'Not provided'}
                  {project.skills.length ? ` · ${project.skills.slice(0, 4).join(', ')}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/projects/${project.id}`)}>View Student Project →</button>
                <button type="button" className="btn-glass text-xs" onClick={() => setExplain('Tutor review workspace is available to tutors only. Admin does not bypass Tutor role protection.')}>View Tutor Reviews →</button>
                <button type="button" className="btn-glass text-xs" aria-disabled={!reporting} onClick={() => setExplain('Project reporting is not connected.')}>Review Reports</button>
              </div>
            </div>
            {project.demo && <div className="glass rounded-2xl p-3 mb-3 text-sm ac-warn">Demo Project Data — Not Production Data</div>}
            {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}

            <div className="flex flex-nowrap gap-1.5 mb-4 overflow-x-auto" role="tablist" aria-label="Project sections">
              {tabs.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="grid lg:grid-cols-2 gap-3">
                <section className="glass rounded-2xl p-3.5">
                  <h2 className="font-black text-ink">Overview</h2>
                  <dl className="grid gap-1.5 text-[13px]">
                    <KV k="Description" v={project.description?.trim() || 'Not provided'} />
                    <KV k="Objectives" v="Not provided" />
                    <KV k="Difficulty" v={project.difficulty || 'Not provided'} />
                    <KV k="Estimated duration" v="Not provided" />
                    <KV k="Required skills" v={project.skills.length ? project.skills.join(', ') : 'Not provided'} />
                    <KV k="Learning outcomes" v="Not provided" />
                    <KV k="Tools / technologies" v="Not provided" />
                    <KV k="Created" v={formatWhen(project.createdAt)} />
                    <KV k="Catalog status" v={projectStatusLabel()} />
                    <KV k="Review" v={projectReviewSummary(project, index.buildsAvailable)} />
                  </dl>
                  <p className="text-[12px] text-muted mt-2">Financial data unavailable. Projects are not treated as purchases.</p>
                </section>
                <section className="glass rounded-2xl p-3.5">
                  <h2 className="font-black text-ink">Roadmap</h2>
                  <p className="text-[13px] text-muted mb-3">Project roadmap unavailable.</p>
                  <h2 className="font-black text-ink">AI Project Insights</h2>
                  {insights.length === 0 && <p className="text-[13px] text-muted">AI project analysis unavailable.</p>}
                  {insights.map(i => (
                    <p key={i.id} className="text-[13px] py-1" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>{i.label}: {i.rec}</p>
                  ))}
                  <p className="text-[11px] text-muted mt-2">Advisory only. AI does not approve, reject, publish, or score students.</p>
                </section>
              </div>
            )}

            {tab === 'activity' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Student activity</h2>
                {!index.buildsAvailable && <p className="text-[13px] text-muted">Student project activity unavailable.</p>}
                {index.buildsAvailable && builds.length === 0 && <p className="text-[13px] text-muted">No student project activity yet.</p>}
                {index.buildsAvailable && builds.map(b => (
                  <div key={b.id} className="ac-act">
                    <span>{b.studentName} · {studentBuildLabel(b.status)} · Review {studentReviewLabel(b.status)}</span>
                    <span className="text-[11px] text-muted">{b.submittedAt ? formatWhen(b.submittedAt) : formatWhen(b.createdAt)}</span>
                  </div>
                ))}
              </section>
            )}

            {tab === 'submissions' && (
              <div className="grid lg:grid-cols-2 gap-3">
                <section className="glass rounded-2xl p-3.5">
                  <h2 className="font-black text-ink">Submissions</h2>
                  {!index.buildsAvailable && <p className="text-[13px] text-muted">Submission data unavailable.</p>}
                  {index.buildsAvailable && submissions.length === 0 && <p className="text-[13px] text-muted">No submissions yet.</p>}
                  {index.buildsAvailable && submissions.map(b => (
                    <div key={b.id} className="py-1.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                      <div className="ac-act">
                        <span>{b.studentName} · {studentBuildLabel(b.status)} · {studentReviewLabel(b.status)}</span>
                        <span className="text-[11px] text-muted">{b.submittedAt ? formatWhen(b.submittedAt) : '—'}</span>
                      </div>
                      {b.submissionUrl && <p className="text-[12px] text-muted break-all">{b.submissionUrl}</p>}
                    </div>
                  ))}
                </section>
                <section className="glass rounded-2xl p-3.5">
                  <h2 className="font-black text-ink">Tutor reviews</h2>
                  {!index.buildsAvailable && <p className="text-[13px] text-muted">Tutor review data unavailable.</p>}
                  {index.buildsAvailable && reviews.length === 0 && <p className="text-[13px] text-muted">No project reviews yet.</p>}
                  {reviews.map(b => (
                    <div key={b.id} className="py-1.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                      <div className="text-[13px] font-semibold">{b.studentName} · {studentReviewLabel(b.status)}</div>
                      <p className="text-[13px] text-muted">{b.reviewNote}</p>
                      <p className="text-[11px] text-muted">Tutor identity is not recorded on this review. Admin does not override tutor decisions.</p>
                    </div>
                  ))}
                </section>
              </div>
            )}

            {tab === 'moderation' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Platform Moderation</h2>
                <p className="text-[13px] mb-2">Current catalog status: {projectStatusLabel()}</p>
                <p className="text-[13px] text-muted mb-3">{blocked} Tutors remain the reviewers of student submissions.</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button type="button" className="btn-glass text-xs" aria-disabled={!moderation} onClick={() => setExplain(blocked)}>Request Changes</button>
                  <button type="button" className="btn-glass text-xs" aria-disabled={!moderation} onClick={() => setExplain('Pause is unavailable. Catalog projects do not support a paused status.')}>Pause</button>
                  <button type="button" className="btn-glass text-xs" aria-disabled={!moderation} onClick={() => setExplain('Archive unavailable.')}>Archive</button>
                </div>
                <h2 className="font-black text-ink mt-2">Reports / flags</h2>
                <p className="text-[13px] text-muted mb-3">Project reporting is not connected.</p>
                <label className="block text-[12px] font-semibold text-muted">
                  Admin notes
                  <textarea className="field mt-1 w-full px-3 py-2 text-sm" rows={3} value={note} onChange={e => setNote(e.target.value)} />
                </label>
                <button type="button" className="btn-glass text-xs mt-2" onClick={() => { saveProjectNote(project.id, note); setMsg('Admin note saved in the Admin-only project notes store.') }}>Save note</button>
              </section>
            )}
          </>
        )}
      </div>

      {explain && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="project-mod-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExplain(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="project-mod-title" className="text-lg font-black text-ink mb-2">Unavailable</h2>
            <p className="text-sm text-muted mb-4">{explain}</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setExplain(null)}>Close</button>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted shrink-0">{k}</dt><dd className="font-medium text-right break-all">{v}</dd></div>
}
