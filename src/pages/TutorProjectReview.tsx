import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getProjects, getReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents, reviewProject } from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import { displayInitials } from '../lib/roleAccess'
import { tutorProjectWorkspacePath, tutorSessionPath, tutorStudentPath } from '../lib/paths'
import { loadAllProgress } from '../lib/projectWorkspace'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import {
  EMPTY_EXTRAS,
  RUBRIC_MAX,
  addToPortfolio,
  applyApproveToWorkspace,
  availableFiles,
  buildAiPreReview,
  buildReviews,
  fileTree,
  formatSubmitted,
  loadReviewExtras,
  rubricTotal,
  saveReviewExtras,
  statusDot,
  statusLabel,
  studentVisibleFeedback,
  type InlineComment,
  type ReviewExtras,
  type RubricKey,
  type TutorProjectReview,
} from '../lib/tutorProjects'
import { buildTutorRoster, notesForStudent, upsertNote, type TutorNote, type TutorStudent } from '../lib/tutorStudents'
import './tutor-projects.css'

export default function TutorProjectReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || 'local-tutor'
  const tutorName = profile?.full_name || 'Tutor'
  const [row, setRow] = useState<TutorProjectReview | null>(null)
  const [student, setStudent] = useState<TutorStudent | undefined>()
  const [extras, setExtras] = useState<ReviewExtras>(EMPTY_EXTRAS)
  const [notes, setNotes] = useState<TutorNote[]>([])
  const [draftNote, setDraftNote] = useState('')
  const [filePath, setFilePath] = useState('')
  const [line, setLine] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [filesOpen, setFilesOpen] = useState(true)
  const [confirm, setConfirm] = useState<'changes' | 'approve' | null>(null)
  const [done, setDone] = useState<'approved' | 'changes' | null>(null)
  const [action, setAction] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const reload = () => {
    if (!id) return
    Promise.all([
      getTutorStudents().catch(() => []),
      getTutorBookings().catch(() => []),
      getReviewQueue().catch(() => []),
      getTutorCourses().catch(() => []),
      getProjects().catch(() => []),
    ]).then(([enrollments, bookings, queue, apiCourses, apiProjects]) => {
      const roster = buildTutorRoster({ enrollments, bookings, reviews: queue, localBookings: loadTutorBookings(), apiCourses })
      const built = buildReviews({ queue, roster: roster.students, apiProjects, tutorId })
      const found = built.reviews.find(r => r.id === id)
      if (!found) {
        setForbidden(true)
        return
      }
      const extrasRow = loadReviewExtras(tutorId, id)
      setRow({ ...found, status: extrasRow.status || found.status })
      setStudent(roster.students.find(s => s.id === found.studentId))
      setExtras(extrasRow)
      setNotes(notesForStudent(tutorId, found.studentId))
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [id, tutorId])

  const persist = (next: ReviewExtras) => {
    if (!id) return
    setExtras(next)
    saveReviewExtras(tutorId, id, next)
  }

  const filesPack = row ? availableFiles(row.catalog, loadAllProgress()[row.projectId] ?? null) : { files: [], source: 'none' as const, note: '' }
  const selected = filesPack.files.find(f => f.path === filePath) || filesPack.files[0]
  useEffect(() => {
    if (selected && !filePath) setFilePath(selected.path)
  }, [selected, filePath])
  const ai = useMemo(
    () => buildAiPreReview(filesPack.files, filesPack.source, loadAllProgress()[row?.projectId ?? '']?.ranSuccessfully ?? null),
    [filesPack.files, filesPack.source, row?.projectId],
  )
  const score = rubricTotal(extras.rubric)
  const focus = ai.focus.filter(f => !extras.ignoredFocus.includes(f))
  const next = student?.nextSession
  const readme = filesPack.files.find(f => /readme/i.test(f.path))
  const catalog = row?.catalog

  const requestChanges = async () => {
    const items = extras.actionItems.filter(Boolean)
    if (!items.length && !extras.improve.trim()) {
      setError('Add at least one actionable improvement before requesting changes.')
      return
    }
    setError(null)
    const summary = studentVisibleFeedback(extras) || extras.improve
    if (row?.apiRowId && row.studentId) {
      const res = await reviewProject(row.apiRowId, row.studentId, summary, false)
      if (res.error) setError(res.error)
    }
    persist({
      ...extras,
      status: 'changes',
      sentFeedback: summary,
      reviewedAt: new Date().toISOString(),
      history: [...extras.history, { at: new Date().toISOString(), status: 'changes', summary: 'Changes requested', score }],
    })
    setRow({ ...row!, status: 'changes' })
    setConfirm(null)
    setDone('changes')
  }

  const approve = async () => {
    const summary = studentVisibleFeedback(extras)
    if (row?.apiRowId && row.studentId) {
      const res = await reviewProject(row.apiRowId, row.studentId, summary || extras.well || 'Approved', true)
      if (res.error) setError(res.error)
    }
    if (row) applyApproveToWorkspace(row.projectId, score)
    persist({
      ...extras,
      status: 'approved',
      sentFeedback: summary,
      reviewedAt: new Date().toISOString(),
      history: [...extras.history, { at: new Date().toISOString(), status: 'approved', summary: 'Approved', score }],
    })
    setRow({ ...row!, status: 'approved' })
    setConfirm(null)
    setDone('approved')
  }

  if (loading) return <div className="pt-24 px-6 text-muted">Loading review…</div>
  if (forbidden || !row) {
    return (
      <div className="pt-24 px-6 max-w-xl">
        <p className="text-muted mb-4">You can only review submissions from your students.</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/tutor/projects')}>Back to reviews</button>
      </div>
    )
  }

  const addComment = (kind: InlineComment['kind']) => {
    if (!comment.trim() || !selected) return
    const item: InlineComment = {
      id: `c-${Date.now()}`,
      file: selected.path,
      line,
      target: line != null ? 'line' : 'file',
      body: comment.trim(),
      kind,
      status: 'open',
      createdAt: new Date().toISOString(),
    }
    persist({ ...extras, comments: [...extras.comments, item] })
    setComment('')
  }

  return (
    <div className="tp-page pt-20 px-4 sm:px-6 pb-28 max-w-6xl mx-auto overflow-x-hidden">
      <button type="button" className="text-sm text-muted mb-4 cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => navigate('/tutor/projects')}>← Project Reviews</button>

      <section className="tp-hero glass rounded-3xl p-5 md:p-7 mb-6">
        {row.demo && <span className="badge mb-2">Demo Project — Not a Real Student Submission</span>}
        <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{row.title}</h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black" style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}>
            {row.studentAvatar ? <img src={row.studentAvatar} alt="" className="w-full h-full object-cover rounded-2xl" /> : displayInitials(row.studentName)}
          </div>
          <div>
            <div className="font-bold text-ink">{row.studentName}</div>
            <div className="text-sm text-muted">{row.courseTitle || 'Course not linked'} · {row.difficulty} · {statusDot(row.status)} {statusLabel(row.status)}</div>
            <div className="text-xs text-muted">Submitted {formatSubmitted(row.submittedAt)}{row.progress != null ? ` · ${row.progress}% complete` : ''}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-3 mb-4">
          {row.skills.map(s => <span key={s} className="badge text-[10px]">{s}</span>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-sm" onClick={() => persist({ ...extras, status: 'in_review', inReviewAt: extras.inReviewAt || new Date().toISOString() })}>Start Review</button>
          <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorStudentPath(row.studentId))}>View Student</button>
          <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorProjectWorkspacePath(row.projectId))}>Open Student Workspace</button>
        </div>
      </section>

      {error && <div className="glass rounded-2xl p-4 mb-4 text-sm" style={{ color: '#e11d48' }}>{error}</div>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-6">
        <div>
          {catalog && (
            <section className="glass rounded-2xl p-5 mb-5">
              <h2 className="text-lg font-black text-ink mb-2">Project Overview</h2>
              <p className="text-sm text-muted mb-2">{catalog.description}</p>
              <div className="text-xs text-muted mb-2">Estimated time: {Math.round(catalog.estimatedMinutes / 60) || 1} hours</div>
              <h3 className="text-sm font-bold text-ink mt-3 mb-1">Learning objectives</h3>
              <ul className="text-sm text-muted list-disc pl-5">{catalog.outcomes.map(o => <li key={o}>{o}</li>)}</ul>
              <h3 className="text-sm font-bold text-ink mt-3 mb-1">Required skills</h3>
              <p className="text-sm text-muted">{catalog.requiredSkills?.length ? catalog.requiredSkills.map(s => s.name).join(' · ') : catalog.skills.join(' · ')}</p>
              {catalog.roadmap?.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-ink mt-3 mb-1">Completion requirements</h3>
                  <ul className="text-sm text-muted list-disc pl-5">{catalog.roadmap.map(r => <li key={r}>{r}</li>)}</ul>
                </>
              )}
            </section>
          )}

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">Milestones</h2>
            {catalog?.milestones.map(m => {
              const tasks = m.tasks
              const progress = loadAllProgress()[row.projectId]
              const doneCount = tasks.filter(t => progress?.tasks[t.id]).length
              const mark = doneCount === tasks.length && tasks.length ? '✓' : doneCount ? '🟡' : '○'
              return (
                <div key={m.id} className="mb-3">
                  <div className="text-sm font-semibold text-ink">{mark} {m.title} {progress ? `(${doneCount}/${tasks.length})` : '(not marked automatically)'}</div>
                  <label className="block text-xs font-semibold text-muted mt-1">
                    Tutor comment
                    <input className="field w-full mt-1 px-3 py-2 text-sm" value={extras.milestoneNotes[m.id] || ''} onChange={e => persist({ ...extras, milestoneNotes: { ...extras.milestoneNotes, [m.id]: e.target.value } })} />
                  </label>
                </div>
              )
            }) || <p className="text-sm text-muted">No milestone data on this project.</p>}
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <div className="flex justify-between gap-2 mb-2">
              <h2 className="text-lg font-black text-ink">Submission</h2>
              <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFilesOpen(o => !o)}>{filesOpen ? 'Hide files' : 'Show files'}</button>
            </div>
            <p className="text-xs text-muted mb-3">{filesPack.note}</p>
            {row.submissionUrl && <a className="text-sm text-primary" href={row.submissionUrl} target="_blank" rel="noreferrer">Open submission URL</a>}
            {catalog?.resources?.length ? (
              <div className="mb-3">
                <h3 className="text-xs font-semibold text-muted mb-1">Resources</h3>
                <ul className="text-sm text-muted">{catalog.resources.map(r => <li key={r.href}>{r.title} · {r.kind}</li>)}</ul>
              </div>
            ) : null}
            {filesPack.source === 'none' && <p className="text-sm text-muted">Submission files are not available in this environment.</p>}
            {filesOpen && filesPack.files.length > 0 && (
              <div className="grid md:grid-cols-[10rem_minmax(0,1fr)] gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-muted mb-2">Files</h3>
                  {fileTree(filesPack.files).map(p => (
                    <button key={p} type="button" className="tp-chip rounded-lg px-2 py-1 text-[11px] w-full text-left mb-1" data-on={selected?.path === p} onClick={() => { setFilePath(p); setLine(null) }}>{p}</button>
                  ))}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-muted mb-2">Code</h3>
                  {selected ? (
                    <div className="tp-code" role="list">
                      {selected.content.split('\n').map((ln, i) => (
                        <button key={i} type="button" data-on={line === i + 1} onClick={() => setLine(i + 1)} aria-label={`Line ${i + 1}`}>
                          <span className="text-subtle">{i + 1}</span>
                          <span>{ln || ' '}</span>
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted">No file selected.</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <input className="field flex-1 px-3 py-2 text-sm" value={comment} onChange={e => setComment(e.target.value)} placeholder={line ? `Comment on line ${line}` : 'Comment on this file'} aria-label="Inline comment" />
                    <button type="button" className="btn-glass text-xs" onClick={() => addComment('comment')}>Add Comment</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => addComment('concern')}>Mark Concern</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => addComment('approve')}>Approve Section</button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {extras.comments.filter(c => !selected || c.file === selected.path).map(c => (
                      <li key={c.id} className="text-xs text-muted">
                        {c.line ? `Line ${c.line}: ` : ''}{c.body} · {c.status}
                        <button type="button" className="ml-2 text-primary" style={{ background: 'none', border: 'none' }} onClick={() => persist({ ...extras, comments: extras.comments.map(x => x.id === c.id ? { ...x, status: x.status === 'open' ? 'resolved' : 'open' } : x) })}>
                          {c.status === 'open' ? 'Resolve' : 'Reopen'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-2">Project Preview</h2>
            <p className="text-sm text-muted mb-3">Preview unavailable</p>
            <p className="text-xs text-subtle mb-3">This workspace does not execute student code. Open the existing student project workspace to inspect the build.</p>
            <button type="button" className="btn-primary text-sm" onClick={() => navigate(tutorProjectWorkspacePath(row.projectId))}>Open Student Workspace</button>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-2">README</h2>
            {readme ? <pre className="text-sm text-muted whitespace-pre-wrap">{readme.content}</pre> : <p className="text-sm text-muted">No README in available files.</p>}
            <p className="text-xs text-muted mt-3">Suggested review: setup steps, architecture, screenshots, known limitations.</p>
            <button type="button" className="btn-glass text-xs mt-2" onClick={() => persist({ ...extras, improve: extras.improve || 'README needs improvement.' })}>README needs improvement</button>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-1">✨ AI Project Pre-Review</h2>
            <p className="text-xs text-muted mb-3">This is a pre-review, not a final review. Tutor decides.</p>
            <p className="text-sm text-ink mb-3">{ai.summary}</p>
            {ai.findings.map(f => (
              <div key={f.category} className="mb-2">
                <div className="text-sm font-semibold text-ink">{f.category} — {f.label}</div>
                <div className="text-xs text-muted">{f.evidence}</div>
              </div>
            ))}
            <h3 className="text-sm font-bold text-ink mt-4 mb-2">Recommended Tutor Focus</h3>
            <ol className="text-sm text-muted list-decimal pl-5 mb-3">
              {focus.map(f => (
                <li key={f} className="mb-2">
                  {f}
                  <div className="flex gap-2 mt-1">
                    <button type="button" className="btn-primary text-xs" onClick={() => persist({ ...extras, actionItems: extras.actionItems.includes(f) ? extras.actionItems : [...extras.actionItems, f] })}>Accept</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => persist({ ...extras, improve: extras.improve ? `${extras.improve}\n${f}` : f })}>Edit</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => persist({ ...extras, ignoredFocus: [...extras.ignoredFocus, f] })}>Ignore</button>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-2">Review Rubric</h2>
            <p className="text-xs text-muted mb-3">Not scored automatically. Enter values only when you have reviewed the work.</p>
            {(Object.keys(RUBRIC_MAX) as RubricKey[]).map(k => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm mb-2 capitalize">
                <span>{k === 'a11y' ? 'Accessibility' : k === 'docs' ? 'Documentation' : k === 'ux' ? 'UI / UX' : k === 'quality' ? 'Code Quality' : k}</span>
                <span>
                  <input
                    type="number"
                    min={0}
                    max={RUBRIC_MAX[k]}
                    className="field w-20 px-2 py-1 text-sm"
                    value={extras.rubric[k] ?? ''}
                    placeholder="—"
                    onChange={e => persist({ ...extras, rubric: { ...extras.rubric, [k]: e.target.value === '' ? null : Math.min(RUBRIC_MAX[k], Math.max(0, Number(e.target.value))) } })}
                  />
                  <span className="text-muted"> / {RUBRIC_MAX[k]}</span>
                </span>
              </label>
            ))}
            <div className="font-bold text-ink mt-2">Total: {score == null ? 'Not scored' : `${score} / 100`}</div>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">Tutor Feedback</h2>
            <p className="text-xs text-muted mb-2">Student-visible</p>
            <label className="block text-xs font-semibold text-muted mb-3">What went well<textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={3} value={extras.well} onChange={e => persist({ ...extras, well: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-muted mb-3">What to improve<textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={3} value={extras.improve} onChange={e => persist({ ...extras, improve: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-muted mb-3">Recommended next step<textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={2} value={extras.next} onChange={e => persist({ ...extras, next: e.target.value })} /></label>
            <div className="flex gap-2 mb-2">
              <input className="field flex-1 px-3 py-2 text-sm" value={action} onChange={e => setAction(e.target.value)} placeholder="Add an action item" aria-label="Action item" />
              <button type="button" className="btn-glass text-sm" onClick={() => { if (!action.trim()) return; persist({ ...extras, actionItems: [...extras.actionItems, action.trim()] }); setAction('') }}>Add</button>
            </div>
            <ul className="text-sm mb-4">{extras.actionItems.map((a, i) => (
              <li key={i} className="flex justify-between gap-2"><span>○ {a}</span><button type="button" className="text-xs text-muted" style={{ background: 'none', border: 'none' }} onClick={() => persist({ ...extras, actionItems: extras.actionItems.filter((_, j) => j !== i) })}>Remove</button></li>
            ))}</ul>
            <h3 className="text-sm font-bold text-ink mb-1">Student Will See</h3>
            <p className="text-sm text-muted whitespace-pre-wrap mb-3">{studentVisibleFeedback(extras) || 'Nothing drafted yet.'}</p>
            <button type="button" className="btn-glass text-sm" onClick={() => persist({ ...extras, sentFeedback: studentVisibleFeedback(extras) })}>Send Feedback</button>
            {extras.sentFeedback && <p className="text-xs mt-2" style={{ color: '#0F8A68' }}>Feedback saved for the student record. {row.source === 'api' ? 'Use Request Changes or Approve to sync the submission.' : 'Local/demo state — no separate messaging system.'}</p>}
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-2">Review History</h2>
            {extras.history.length === 0 && <p className="text-sm text-muted">No review events recorded yet.</p>}
            {extras.history.map((h, i) => (
              <div key={i} className="text-sm mb-2">
                {new Date(h.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {tutorName} · {statusLabel(h.status)}
                {h.score != null ? ` · ${h.score}/100` : ''} · {h.summary}
              </div>
            ))}
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-2">Submission versions</h2>
            {extras.versions.length === 0 ? (
              <p className="text-sm text-muted">Only the current submission is available.</p>
            ) : extras.versions.map(v => (
              <div key={v.n} className="text-sm text-muted">Version {v.n} · {formatSubmitted(v.at)} · {statusLabel(v.status)}</div>
            ))}
            <h3 className="text-sm font-bold text-ink mt-3">What Changed</h3>
            <p className="text-sm text-muted">{extras.changeSummary || 'No change summary available.'}</p>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-2">👤 Student Context</h2>
            <p className="text-sm text-ink">{row.studentName}</p>
            <p className="text-xs text-muted">{student?.career.target || student?.headline || 'Target role not shared'}</p>
            <p className="text-xs text-muted mt-1">Course progress: {student?.overallProgress != null ? `${student.overallProgress}%` : '—'}</p>
            <p className="text-xs text-muted">Previous project: {student?.projects.filter(p => p.id !== row.projectId)[0]?.title || 'None on file'}</p>
            <button type="button" className="btn-glass text-xs mt-3" onClick={() => navigate(tutorStudentPath(row.studentId))}>View Student Journey</button>
          </section>
          {next?.upcoming && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-base font-black text-ink mb-2">Next Session</h2>
              <p className="text-sm text-ink">{next.label}</p>
              <p className="text-xs text-muted mb-3">{new Date(next.when).toLocaleString()}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-glass text-xs" onClick={() => { setPendingAiPrompt(`Prepare a session about ${row.title} with ${row.studentName}. Project review context only. Do not invent grades.`); navigate('/tutor/ai') }}>Prepare With AI</button>
                <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorSessionPath(next.id))}>View Session</button>
              </div>
            </section>
          )}
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-2">Private Tutor Notes</h2>
            <p className="text-xs text-subtle mb-2">Private to you. Not shown on the student profile, public tutor profile, portfolio, or job recommendations.</p>
            {extras.privateNote && <p className="text-sm text-ink mb-2">{extras.privateNote}</p>}
            <textarea className="field w-full px-3 py-2 text-sm mb-2" rows={3} value={draftNote} onChange={e => setDraftNote(e.target.value)} placeholder="Student understands React but needs testing practice." aria-label="Private tutor notes" />
            <button type="button" className="btn-glass text-xs" onClick={() => {
              if (!draftNote.trim()) return
              upsertNote(tutorId, row.studentId, draftNote.trim())
              persist({ ...extras, privateNote: draftNote.trim() })
              setDraftNote('')
              setNotes(notesForStudent(tutorId, row.studentId))
            }}>Save private note</button>
            <ul className="mt-3 space-y-2">{notes.map(n => (
              <li key={n.id} className="text-xs text-ink">{n.body}</li>
            ))}</ul>
          </section>
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-2">🎯 Career Impact</h2>
            <p className="text-xs text-muted mb-2">Strengthens your LearnSyra portfolio. This is not a hiring guarantee.</p>
            {row.skills.map(s => <div key={s} className="text-sm text-ink">{s} ✓</div>)}
            {student?.focusSkills[0] && <div className="text-sm mt-2">Potential skill gap: {student.focusSkills[0]} ⚠</div>}
            {catalog?.nextProjectId && (
              <button type="button" className="btn-glass text-xs mt-3" onClick={() => navigate(tutorProjectWorkspacePath(catalog.nextProjectId!))}>View Next Project</button>
            )}
          </section>
        </aside>
      </div>

      {(row.status === 'needs_review' || row.status === 'in_review' || row.status === 'changes') && (
      <div className="tp-sticky -mx-4 sm:-mx-6 mt-8 px-4 sm:px-6 py-3 flex flex-wrap gap-2">
        <button type="button" className="btn-glass text-sm" onClick={() => setConfirm('changes')}>Request Changes</button>
        <button type="button" className="btn-primary text-sm" onClick={() => setConfirm('approve')}>Approve Project</button>
      </div>
      )}

      {confirm && (
        <div className="tp-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Cancel" style={{ background: 'transparent', border: 'none' }} onClick={() => setConfirm(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            {confirm === 'changes' ? (
              <>
                <h2 className="text-lg font-black text-ink mb-2">Request changes from {row.studentName}?</h2>
                <p className="text-sm text-muted mb-3">{extras.actionItems.length || (extras.improve ? 1 : 0)} improvement{((extras.actionItems.length || 1) === 1) ? '' : 's'} requested. The project files will not be edited for the student.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-glass text-sm" onClick={() => setConfirm(null)}>Cancel</button>
                  <button type="button" className="btn-primary text-sm" onClick={requestChanges}>Request Changes</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-black text-ink mb-2">Approve Submission?</h2>
                <p className="text-sm text-muted mb-3">This will mark the project as approved, update progress when a workspace record exists, and make it eligible for portfolio readiness. It does not claim the student is job-ready.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-glass text-sm" onClick={() => setConfirm(null)}>Cancel</button>
                  <button type="button" className="btn-primary text-sm" onClick={approve}>Approve Project</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {done === 'approved' && (
        <div className="tp-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setDone(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 className="text-xl font-black text-ink mb-2">🚀 Portfolio Ready</h2>
            <p className="text-sm text-ink">{row.title}</p>
            <p className="text-xs text-muted mb-2">Approved by Tutor</p>
            <p className="text-sm text-muted mb-2">{row.skills.join(' · ')}</p>
            <p className="text-sm text-ink mb-4">Project score: {score == null ? 'Not scored' : `${score} / 100`}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => { addToPortfolio(row.projectId); persist({ ...extras, status: 'portfolio' }); setRow({ ...row, status: 'portfolio' }) }}>Add to Portfolio</button>
              <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutor/students/' + row.studentId)}>View Portfolio</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setDone(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
