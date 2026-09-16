import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CareerHubNav from '../components/career/CareerHubNav'
import ResumeAnalysisBar from '../components/career/resume-studio/ResumeAnalysisBar'
import ResumePhotoUpload from '../components/career/resume-studio/ResumePhotoUpload'
import ResumeSectionNav from '../components/career/resume-studio/ResumeSectionNav'
import ResumeStudioToolbar from '../components/career/resume-studio/ResumeStudioToolbar'
import ResumeStylePanel from '../components/career/resume-studio/ResumeStylePanel'
import ResumeTemplatePicker, { applyTemplate } from '../components/career/resume-studio/ResumeTemplatePicker'
import SectionAiBar from '../components/career/resume-studio/SectionAiBar'
import ResumePreview from '../components/career/ResumePreview'
import { analyzeResume } from '../lib/resumeAnalysis'
import { generateCoverLetter, runCoachAction } from '../lib/resumeCoach'
import { downloadResumeDocx, printResumePreview } from '../lib/resumeExport'
import { templateMeta } from '../lib/resumeStudioTypes'
import { useAuth } from '../context/AuthContext'
import {
  computeReadiness,
  getCareerProfile,
  getCertificates,
  getMyEnrolledCourses,
  getMyStudentProjects,
} from '../lib/api'
import { getCareerSnapshot, loadWeeklyActions, saveWeeklyActions } from '../lib/careerCenter'
import { careerSummaryText, hydrateCareerData, persistCareerNow } from '../lib/careerPersistence'
import {
  analyzeJob,
  applyJobSuggestion,
  applyResumeOverlay,
  applySafeImprovements,
  cloneResume,
  createResume,
  emptyEducation,
  emptyExperience,
  generateSummary,
  improveBullet,
  loadActiveId,
  loadDocs,
  projectBullets,
  relativeWhen,
  reorderLayout,
  RESUME_ROLES,
  rewriteSummary,
  saveActiveId,
  saveDocs,
  scoreResume,
  toggleSectionVisibility,
  uid,
  type JobSuggestion,
  type ResumeDoc,
  type ResumeSectionId,
  type ResumeSkill,
  type SkillCategory,
} from '../lib/resumeBuilder'
import { careerInterviewPath } from '../lib/paths'
import './career-center.css'
import './resume-builder.css'

type MobilePane = 'sections' | 'edit' | 'preview'

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="rs-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} className="rs-input" />
    </label>
  )
}

function AddSkill({ onAdd }: { onAdd: (s: ResumeSkill) => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SkillCategory>('Technical')
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <input className="rs-input" placeholder="Add a skill you actually have" value={name} onChange={e => setName(e.target.value)} />
      <select className="rs-input" value={category} onChange={e => setCategory(e.target.value as SkillCategory)}>
        {['Technical', 'Tools', 'Languages', 'Soft Skills'].map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <button
        type="button"
        className="rs-btn rs-btn-primary"
        onClick={() => {
          if (!name.trim()) return
          onAdd({ id: uid('sk'), name: name.trim(), category, verified: false, included: true })
          setName('')
        }}
      >
        + Add Skill
      </button>
    </div>
  )
}

export default function CareerResume() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile, session } = useAuth()
  const autosaveTimer = useRef<number | null>(null)
  const snap = useMemo(() => getCareerSnapshot(), [])
  const [docs, setDocs] = useState<ResumeDoc[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [section, setSection] = useState<ResumeSectionId>('contact')
  const [pane, setPane] = useState<MobilePane>('edit')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [fullPreview, setFullPreview] = useState(false)
  const [jobText, setJobText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const [improved, setImproved] = useState<{ from: number; to: number; deltas: { label: string; delta: number }[] } | null>(null)
  const [bulletHint, setBulletHint] = useState<Record<string, { original: string; improved: string; variant: number }>>({})
  const [roleOpen, setRoleOpen] = useState(false)
  const [busySave, setBusySave] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const templatesRef = useRef<HTMLDetailsElement>(null)

  const doc = docs.find(d => d.id === activeId) ?? docs[0]
  const scores = doc ? scoreResume(doc) : null
  const analysis = doc ? analyzeResume(doc) : null

  useEffect(() => {
    const userId = session?.user.id ?? null
    let alive = true
    setLoading(true)
    setSyncError(null)
    hydrateCareerData(userId)
      .then(async () => {
        if (!alive) return
        const existing = loadDocs()
        const name = profile?.full_name?.trim() || session?.user.email?.split('@')[0] || 'Student'
        const email = session?.user.email || ''
        const seedCerts = (certs: { title: string; completed: string; official: boolean }[]) =>
          createResume({
            name,
            email,
            headline: profile?.headline || undefined,
            targetRole: snap.targetRole,
            verifiedSkills: snap.haveSkills,
            suggestedSkills: [],
            projects: snap.portfolio.map((p, i) => ({
              projectId: p.id,
              title: p.title,
              description: `${p.title} covering ${p.skills.join(', ')}.`,
              skills: p.skills,
              score: p.score,
              bullets: [],
              included: i === 0,
              portfolioReady: p.status === 'Portfolio Ready',
            })),
            certifications: certs.map(c => ({
              id: uid('ct'),
              title: c.title,
              issuer: 'LearnSyra',
              completed: c.completed,
              official: c.official,
              included: true,
            })),
            achievements: [],
          })

        const [career, certRows] = await Promise.all([getCareerProfile(), getCertificates()])
        if (!alive) return
        const certs =
          certRows.length > 0
            ? certRows.map(r => ({
                title: r.title,
                completed: new Date(r.issued_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                official: true,
              }))
            : snap.certificates
        if (existing.length) {
          const patched = existing.map(d => ({
            ...d,
            contact: {
              ...d.contact,
              name: d.contact.name || name,
              email: d.contact.email || email,
              photoUrl: d.contact.photoUrl ?? profile?.avatar_url ?? null,
            },
          }))
          setDocs(patched)
          const aid = loadActiveId()
          setActiveId(aid && patched.some(d => d.id === aid) ? aid : patched[0].id)
          return
        }
        const created = seedCerts(certs)
        const summary = careerSummaryText(null, career?.resume_text)
        if (summary) created.summary = summary
        if (career?.target_role) created.targetRole = career.target_role
        setDocs([created])
        setActiveId(created.id)
        saveDocs([created])
        saveActiveId(created.id)
        applyResumeOverlay(created)
      })
      .catch(() => {
        if (!alive) return
        setSyncError('Could not sync your resume right now. Showing local data.')
        const existing = loadDocs()
        if (existing.length) {
          setDocs(existing)
          setActiveId(existing[0].id)
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [profile?.full_name, profile?.headline, session?.user.email, session?.user.id, snap])

  useEffect(() => {
    const jobId = searchParams.get('jobId')
    if (jobId && doc && !jobText) setJobText(`Target role context: ${doc.targetRole}`)
  }, [searchParams, doc, jobText])

  useEffect(() => {
    if (!roleOpen && !previewOpen && !fullPreview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleOpen(false)
        setPreviewOpen(false)
        setFullPreview(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [roleOpen, previewOpen, fullPreview])

  const persist = (next: ResumeDoc, list = docs) => {
    const rows = list.map(d => (d.id === next.id ? { ...next, updatedAt: new Date().toISOString(), autosaveNote: 'Saved locally' } : d))
    setDocs(rows)
    saveDocs(rows)
    applyResumeOverlay(next)
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => {
      setAutosavedAt(new Date().toLocaleTimeString())
      setSaveState('saved')
    }, 400)
  }

  const patch = (partial: Partial<ResumeDoc>) => {
    if (!doc) return
    persist({ ...doc, ...partial })
  }

  const saveBackend = async () => {
    if (!doc) return
    setBusySave(true)
    setSaveState('idle')
    const [enrolled, projects] = await Promise.all([getMyEnrolledCourses(), getMyStudentProjects()])
    const avg = enrolled.length ? enrolled.reduce((s, c) => s + c.progress, 0) / enrolled.length : 0
    const next = computeReadiness({
      enrolledCount: enrolled.length,
      avgProgress: avg,
      submittedProjects: projects.filter(p => p.status !== 'started').length,
      resumeLength: doc.summary.trim().length,
      targetRole: doc.targetRole,
    })
    const rows = docs.map(d => (d.id === doc.id ? { ...doc, updatedAt: new Date().toISOString() } : d))
    const scored = scoreResume(doc)
    const { error } = await persistCareerNow(
      session?.user.id ?? null,
      {
        summary: doc.summary,
        resume: { docs: rows, activeId: doc.id },
        resumeOverlay: {
          resumeScore: scored.completeness,
          atsScore: scored.ats,
          completeness: scored.completeness,
          targetRole: doc.targetRole,
          roleMatch: scored.roleMatch,
          checks: [
            { label: 'Skills listed', ok: scored.skills },
            { label: 'Education', ok: scored.education },
            { label: 'Project descriptions', ok: scored.projects },
            { label: 'Quantified achievements', ok: scored.achievements >= 60 },
            { label: 'ATS optimization', ok: scored.ats >= 75 },
          ],
        },
      },
      next,
    )
    const week = loadWeeklyActions(getCareerSnapshot().weeklyActions, session?.user.id)
    saveWeeklyActions(week.map(w => (w.id === 'w4' ? { ...w, done: true } : w)), session?.user.id)
    setBusySave(false)
    if (error) {
      setSaveState('error')
      setToast(error)
      return
    }
    setSaveState('saved')
    setToast('Resume saved to your account.')
  }

  const runSafe = () => {
    if (!doc) return
    const result = applySafeImprovements(doc)
    persist(result.next)
    setImproved({ from: result.from, to: result.to, deltas: result.deltas })
  }

  if (loading || !doc || !scores || !analysis) {
    return (
      <div className="pt-20 px-6 max-w-3xl mx-auto">
        <CareerHubNav />
        <p className="text-muted">{loading ? 'Loading resume builder…' : 'Preparing resume builder…'}</p>
        {syncError && <p className="text-sm mt-2" style={{ color: '#e11d48' }}>{syncError}</p>}
      </div>
    )
  }

  const scrollToTemplates = () => {
    templatesRef.current?.setAttribute('open', '')
    templatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="pt-16 px-3 sm:px-5 pb-20 max-w-[1600px] mx-auto rs-studio">
      <CareerHubNav />
      {syncError && <p className="text-sm mb-2" style={{ color: '#e11d48' }}>{syncError}</p>}

      <div className={`${pane === 'sections' || pane === 'edit' || pane === 'preview' ? '' : ''} lg:hidden rs-mobile-tabs`}>
        {(['sections', 'edit', 'preview'] as MobilePane[]).map(p => (
          <button key={p} type="button" className={`rs-mobile-tab${pane === p ? ' rs-mobile-tab--on' : ''}`} onClick={() => setPane(p)}>
            {p === 'edit' ? 'Editor' : p === 'sections' ? 'Sections' : 'Preview'}
          </button>
        ))}
      </div>

      <ResumeStudioToolbar
        resumeName={doc.versionName}
        autosaveLabel={autosavedAt ? `Autosaved ${autosavedAt}` : saveState === 'saved' ? 'Saved locally' : null}
        template={doc.template}
        busySave={busySave}
        onTemplates={scrollToTemplates}
        onPreview={() => { setPane('preview'); setFullPreview(true) }}
        onPdf={() => { printResumePreview(); setExportNote("Use Print → Save as PDF to match the live preview.") }}
        onDocx={() => { downloadResumeDocx(doc); setExportNote('DOCX downloaded.') }}
        onSave={saveBackend}
      />

      <ResumeAnalysisBar analysis={analysis} expanded={analysisOpen} onToggle={() => setAnalysisOpen(v => !v)} />

      <div className="rs-workspace">
        <div className={`${pane === 'sections' || pane === 'edit' ? '' : 'hidden'} lg:block`}>
          <ResumeSectionNav
            doc={doc}
            active={section}
            onSelect={id => { setSection(id); setPane('edit') }}
            onReorder={(from, to) => persist(reorderLayout(doc, from, to))}
            onToggle={(id, visible) => persist(toggleSectionVisibility(doc, id, visible))}
          />
        </div>

        <div className={`rs-editor ${pane === 'edit' ? '' : 'hidden'} lg:block`}>
          <SectionAiBar section={section} doc={doc} onApply={next => persist(next)} />
          {section === 'contact' && (
            <>
              <h2 className="rs-editor-title">Contact Information</h2>
              <p className="rs-editor-sub">Professional contact details shown in the resume header.</p>
              {session?.user.id && (
                <ResumePhotoUpload
                  userId={session.user.id}
                  photoUrl={doc.contact.photoUrl}
                  usePhoto={doc.contact.usePhoto}
                  onChange={next => patch({ contact: { ...doc.contact, ...next } })}
                />
              )}
              <Field id="nm" label="Full Name" value={doc.contact.name} onChange={v => patch({ contact: { ...doc.contact, name: v } })} />
              <Field id="tt" label="Professional Title" value={doc.contact.title} onChange={v => patch({ contact: { ...doc.contact, title: v } })} />
              <Field id="em" label="Email" value={doc.contact.email} onChange={v => patch({ contact: { ...doc.contact, email: v } })} />
              <Field id="ph" label="Phone" value={doc.contact.phone} onChange={v => patch({ contact: { ...doc.contact, phone: v } })} />
              <Field id="lc" label="Location" value={doc.contact.location} onChange={v => patch({ contact: { ...doc.contact, location: v } })} />
              <Field id="li" label="LinkedIn" value={doc.contact.linkedin} onChange={v => patch({ contact: { ...doc.contact, linkedin: v } })} />
              <Field id="gh" label="GitHub" value={doc.contact.github} onChange={v => patch({ contact: { ...doc.contact, github: v } })} />
              <Field id="pf" label="Portfolio" value={doc.contact.portfolio} onChange={v => patch({ contact: { ...doc.contact, portfolio: v } })} />
            </>
          )}

          {section === 'summary' && (
            <>
              <h2 className="rs-editor-title">Professional Summary</h2>
              <p className="rs-editor-sub">2–4 lines focused on your engineering profile and target role.</p>
              <textarea className="rs-input mb-3" rows={6} placeholder="Write a short professional summary..." value={doc.summary} onChange={e => patch({ summary: e.target.value })} />
              <button type="button" className="rs-btn rs-btn-ai" onClick={() => patch({ summary: generateSummary(doc) })}>Generate from profile</button>
            </>
          )}

          {section === 'target' && (
            <>
              <h2 className="rs-editor-title">Target Role</h2>
              <div className="text-2xl font-black text-ink">{doc.targetRole}</div>
              <p className="text-sm font-bold text-primary mb-4">{snap.targetMatch}% Match</p>
              <button type="button" className="btn-glass text-sm" onClick={() => setRoleOpen(true)}>Change Career Goal</button>
            </>
          )}

          {section === 'experience' && (
            <>
              <h2 className="rs-editor-title">Experience</h2>
              <p className="rs-editor-sub">Add only roles you actually held. Lead bullets with action, technology, and outcome.</p>
              {doc.experience.map(exp => (
                <article key={exp.id} className="rs-entry-card">
                  <Field id={`${exp.id}-t`} label="Job title" value={exp.title} onChange={v => patch({ experience: doc.experience.map(e => (e.id === exp.id ? { ...e, title: v } : e)) })} />
                  <Field id={`${exp.id}-c`} label="Company" value={exp.company} onChange={v => patch({ experience: doc.experience.map(e => (e.id === exp.id ? { ...e, company: v } : e)) })} />
                  <Field id={`${exp.id}-l`} label="Location" value={exp.location} onChange={v => patch({ experience: doc.experience.map(e => (e.id === exp.id ? { ...e, location: v } : e)) })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field id={`${exp.id}-s`} label="Start date" value={exp.startDate} onChange={v => patch({ experience: doc.experience.map(e => (e.id === exp.id ? { ...e, startDate: v } : e)) })} />
                    <Field id={`${exp.id}-e`} label="End date" value={exp.endDate} onChange={v => patch({ experience: doc.experience.map(e => (e.id === exp.id ? { ...e, endDate: v } : e)) })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm mb-3">
                    <input type="checkbox" className="career-check" checked={exp.current} onChange={e => patch({ experience: doc.experience.map(x => (x.id === exp.id ? { ...x, current: e.target.checked } : x)) })} />
                    Current position
                  </label>
                  {exp.bullets.map((b, i) => {
                    const key = `${exp.id}-${i}`
                    const hint = bulletHint[key]
                    return (
                      <div key={key} className="mb-3">
                        <textarea className="rs-input" rows={2} placeholder="Action + technology + outcome..." value={b} onChange={e => {
                          const bullets = exp.bullets.slice()
                          bullets[i] = e.target.value
                          patch({ experience: doc.experience.map(x => (x.id === exp.id ? { ...x, bullets } : x)) })
                        }} />
                        <button type="button" className="rs-btn rs-btn-ai mt-1" onClick={() => setBulletHint({ ...bulletHint, [key]: { original: b, improved: improveBullet(b, 0), variant: 0 } })}>Improve Bullet</button>
                        {hint && (
                          <div className="mt-2 text-sm">
                            <p className="text-muted">Original: {hint.original}</p>
                            <p className="text-ink font-semibold mt-1">Improved: {hint.improved}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <button type="button" className="btn-primary text-xs" onClick={() => {
                                const bullets = exp.bullets.slice()
                                bullets[i] = hint.improved
                                patch({ experience: doc.experience.map(x => (x.id === exp.id ? { ...x, bullets } : x)) })
                                const nextH = { ...bulletHint }
                                delete nextH[key]
                                setBulletHint(nextH)
                              }}>Use Suggestion</button>
                              <button type="button" className="btn-glass text-xs" onClick={() => setBulletHint({ ...bulletHint, [key]: { ...hint, variant: hint.variant + 1, improved: improveBullet(hint.original, hint.variant + 1) } })}>Try Another</button>
                              <button type="button" className="btn-glass text-xs" onClick={() => {
                                const nextH = { ...bulletHint }
                                delete nextH[key]
                                setBulletHint(nextH)
                              }}>Keep Original</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <button type="button" className="rs-btn rs-btn-ghost" onClick={() => patch({ experience: doc.experience.map(x => (x.id === exp.id ? { ...x, bullets: [...x.bullets, ''] } : x)) })}>+ Add bullet</button>
                </article>
              ))}
              <button type="button" className="rs-btn rs-btn-primary" onClick={() => patch({ experience: [...doc.experience, emptyExperience()] })}>+ Add Experience</button>
            </>
          )}

          {section === 'education' && (
            <>
              <h2 className="rs-editor-title">Education</h2>
              {doc.education.map(ed => (
                <article key={ed.id} className="rs-entry-card">
                  <Field id={`${ed.id}-d`} label="Degree" value={ed.degree} onChange={v => patch({ education: doc.education.map(e => (e.id === ed.id ? { ...e, degree: v } : e)) })} />
                  <Field id={`${ed.id}-i`} label="Institution" value={ed.institution} onChange={v => patch({ education: doc.education.map(e => (e.id === ed.id ? { ...e, institution: v } : e)) })} />
                  <Field id={`${ed.id}-l`} label="Location" value={ed.location} onChange={v => patch({ education: doc.education.map(e => (e.id === ed.id ? { ...e, location: v } : e)) })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field id={`${ed.id}-s`} label="Start date" value={ed.startDate} onChange={v => patch({ education: doc.education.map(e => (e.id === ed.id ? { ...e, startDate: v } : e)) })} />
                    <Field id={`${ed.id}-e`} label="End date" value={ed.endDate} onChange={v => patch({ education: doc.education.map(e => (e.id === ed.id ? { ...e, endDate: v } : e)) })} />
                  </div>
                  <Field id={`${ed.id}-g`} label="Grade/GPA (optional)" value={ed.grade} onChange={v => patch({ education: doc.education.map(e => (e.id === ed.id ? { ...e, grade: v } : e)) })} />
                  <Field id={`${ed.id}-c`} label="Relevant coursework (optional)" value={ed.coursework} onChange={v => patch({ education: doc.education.map(e => (e.id === ed.id ? { ...e, coursework: v } : e)) })} />
                </article>
              ))}
              <button type="button" className="rs-btn rs-btn-primary" onClick={() => patch({ education: [...doc.education, emptyEducation()] })}>+ Add Education</button>
            </>
          )}

          {section === 'skills' && (
            <>
              <h2 className="rs-editor-title">Technical Skills</h2>
              <p className="rs-editor-sub">Include only skills you can support with projects or experience.</p>
              <div className="rs-skill-row">
                {doc.skills.map(sk => (
                  <label key={sk.id} className={`rs-skill-chip${sk.included ? ' rs-skill-chip--on' : ''}`}>
                    <input type="checkbox" className="career-check" checked={sk.included} onChange={e => patch({ skills: doc.skills.map(s => (s.id === sk.id ? { ...s, included: e.target.checked } : s)) })} />
                    {sk.name}
                    {sk.verified && <span className="text-[10px] text-success">Verified</span>}
                  </label>
                ))}
              </div>
              <AddSkill onAdd={skill => patch({ skills: [...doc.skills, skill] })} />
            </>
          )}

          {section === 'projects' && (
            <>
              <h2 className="rs-editor-title">Projects</h2>
              <p className="rs-editor-sub">Highlight engineering projects with tech stack and outcomes.</p>
              {doc.projects.map(p => (
                <article key={p.projectId} className="rs-entry-card">
                  <div className="flex justify-between gap-2">
                    <div className="font-bold text-ink">{p.title}</div>
                    <div className="text-sm font-semibold text-muted">{p.score} / 100</div>
                  </div>
                  <Field id={`${p.projectId}-stack`} label="Tech Stack / Technologies" value={p.skills.join(', ')} onChange={v => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, skills: v.split(',').map(s => s.trim()).filter(Boolean) } : x)) })} />
                  <label className="rs-field">
                    <span>Project summary</span>
                    <textarea className="rs-input" rows={2} value={p.description} onChange={e => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, description: e.target.value } : x)) })} />
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button type="button" className="rs-btn rs-btn-ghost" onClick={() => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, included: true } : x)) })}>Include on resume</button>
                    <button type="button" className="rs-btn rs-btn-ai" onClick={() => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, bullets: projectBullets(x) } : x)) })}>Generate bullets</button>
                    <button type="button" className="rs-btn rs-btn-ghost" onClick={() => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, included: false } : x)) })}>Exclude</button>
                  </div>
                  {p.bullets.length > 0 && (
                    <ul className="text-sm mt-2 list-disc pl-5">{p.bullets.map(b => <li key={b}>{b}</li>)}</ul>
                  )}
                </article>
              ))}
              <button type="button" className="btn-glass text-sm" onClick={() => navigate('/projects')}>Browse projects</button>
            </>
          )}

          {section === 'certs' && (
            <>
              <h2 className="text-lg font-black text-ink mb-3">🏆 Certifications</h2>
              {doc.certifications.length === 0 && <p className="text-sm text-muted">No course records yet. Certificates appear after a recorded completion.</p>}
              {doc.certifications.map(c => (
                <label key={c.id} className="flex items-start gap-2 mb-3 text-sm">
                  <input type="checkbox" className="career-check mt-1" checked={c.included} onChange={e => patch({ certifications: doc.certifications.map(x => (x.id === c.id ? { ...x, included: e.target.checked } : x)) })} />
                  <span>
                    <span className="font-bold text-ink">{c.title}</span>
                    <span className="block text-muted">{c.issuer} · Completed {c.completed}{c.official ? '' : ' · Course record — not an external credential'}</span>
                  </span>
                </label>
              ))}
            </>
          )}

          {section === 'achievements' && (
            <>
              <h2 className="text-lg font-black text-ink mb-3">Achievements</h2>
              {doc.achievements.map(a => (
                <label key={a.id} className="flex items-center gap-2 mb-2 text-sm">
                  <input type="checkbox" className="career-check" checked={a.included} onChange={e => patch({ achievements: doc.achievements.map(x => (x.id === a.id ? { ...x, included: e.target.checked } : x)) })} />
                  {a.label}
                </label>
              ))}
            </>
          )}

          {section === 'languages' && (
            <>
              <h2 className="text-lg font-black text-ink mb-3">Languages</h2>
              <Field id="lang" label="Languages" value={doc.extra.languages} onChange={v => patch({ extra: { ...doc.extra, languages: v } })} />
            </>
          )}

          {section === 'publications' && (
            <>
              <h2 className="text-lg font-black text-ink mb-3">Publications</h2>
              <textarea className="field w-full p-3 text-sm" rows={5} value={doc.extra.publications} onChange={e => patch({ extra: { ...doc.extra, publications: e.target.value } })} />
            </>
          )}

          {section === 'volunteer' && (
            <>
              <h2 className="text-lg font-black text-ink mb-3">Volunteer Work</h2>
              <textarea className="field w-full p-3 text-sm" rows={5} value={doc.extra.volunteer} onChange={e => patch({ extra: { ...doc.extra, volunteer: e.target.value } })} />
            </>
          )}

          {section === 'extra' && (
            <>
              <h2 className="text-lg font-black text-ink mb-2">Additional Information</h2>
              <Field id="int" label="Interests" value={doc.extra.interests} onChange={v => patch({ extra: { ...doc.extra, interests: v } })} />
              <Field id="aw" label="Awards" value={doc.extra.awards} onChange={v => patch({ extra: { ...doc.extra, awards: v } })} />
              <Field id="os" label="Open source" value={doc.extra.opensource} onChange={v => patch({ extra: { ...doc.extra, opensource: v } })} />
              <Field id="lk" label="Links" value={doc.extra.links} onChange={v => patch({ extra: { ...doc.extra, links: v } })} />
              <div className="mt-4">
                <h3 className="text-sm font-black text-ink mb-2">Custom Sections</h3>
                {(doc.customSections ?? []).map(cs => (
                  <article key={cs.id} className="rounded-2xl p-3 mb-3" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
                    <Field id={`${cs.id}-t`} label="Section title" value={cs.title} onChange={v => patch({ customSections: (doc.customSections ?? []).map(s => (s.id === cs.id ? { ...s, title: v } : s)) })} />
                    <textarea className="field w-full p-2 text-sm" rows={3} value={cs.body} onChange={e => patch({ customSections: (doc.customSections ?? []).map(s => (s.id === cs.id ? { ...s, body: e.target.value } : s)) })} />
                    <div className="flex gap-2 mt-2">
                      <button type="button" className="btn-glass text-xs" onClick={() => patch({ customSections: (doc.customSections ?? []).map(s => (s.id === cs.id ? { ...s, visible: !s.visible } : s)) })}>{cs.visible ? 'Hide' : 'Show'}</button>
                      <button type="button" className="btn-glass text-xs" onClick={() => patch({ customSections: (doc.customSections ?? []).filter(s => s.id !== cs.id) })}>Remove</button>
                    </div>
                  </article>
                ))}
                <button type="button" className="btn-primary text-sm" onClick={() => patch({ customSections: [...(doc.customSections ?? []), { id: uid('cs'), title: 'Custom Section', body: '', visible: true }] })}>+ Add Custom Section</button>
              </div>
            </>
          )}
        </div>

        <aside className={`rs-preview-wrap ${pane === 'preview' ? '' : 'hidden'} lg:block`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="rs-preview-label">Live preview · {templateMeta(doc.template).title}</p>
            <div className="flex gap-1">
              <button type="button" className="rs-btn rs-btn-ghost" onClick={() => setPreviewMode('desktop')}>Desktop</button>
              <button type="button" className="rs-btn rs-btn-ghost" onClick={() => setPreviewMode('mobile')}>Mobile</button>
              <button type="button" className="rs-btn rs-btn-ghost" onClick={() => setFullPreview(true)}>Fullscreen</button>
            </div>
          </div>
          <ResumePreview doc={doc} mode={previewMode} />
        </aside>
      </div>

      <details className="rs-panel" ref={templatesRef} open>
        <summary>Templates &amp; typography</summary>
        <div className="rs-panel-body">
          <ResumeTemplatePicker doc={doc} onSelect={t => persist(applyTemplate(doc, t))} />
          <div className="mt-4 pt-4 border-t border-slate-200">
            <ResumeStylePanel doc={doc} onChange={style => patch({ style })} />
          </div>
        </div>
      </details>

      <details className="rs-panel">
        <summary>Job targeting &amp; tailoring</summary>
        <div className="rs-panel-body">
        <p className="text-sm text-muted mb-3">Paste a job description or select a target role. Tailoring only uses information already in your resume.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {RESUME_ROLES.map(r => (
            <button key={r} type="button" className="rv-choice px-3 py-1.5 rounded-xl text-xs font-semibold border" data-on={doc.targetRole === r} onClick={() => patch({ targetRole: r })}>{r}</button>
          ))}
        </div>
        <textarea className="field w-full p-3 text-sm mb-3" rows={4} placeholder="Paste job description here..." value={jobText} onChange={e => setJobText(e.target.value)} />
        <button type="button" className="btn-primary text-sm mb-2" onClick={() => patch({ jobTarget: analyzeJob(jobText || doc.targetRole, doc) })}>Analyze Job →</button>
        <button type="button" className="btn-glass text-sm mb-4" onClick={() => persist(runCoachAction(doc, 'tailor-job'))}>Tailor Resume For Job</button>
        {doc.jobTarget && (
          <div>
            <p className="text-sm font-bold text-ink">Job Match {doc.jobTarget.matchScore}%</p>
            <p className="text-sm text-success mt-2">Matched Skills: {doc.jobTarget.matchedSkills.join(' · ') || '—'}</p>
            <p className="text-sm mb-3" style={{ color: '#B45309' }}>Missing / Weak: {doc.jobTarget.missingSkills.join(' · ') || '—'}</p>
            <h3 className="text-sm font-black text-ink mb-2">✨ AI Resume Suggestions</h3>
            {doc.jobTarget.suggestions.map((sg: JobSuggestion) => (
              <article key={sg.id} className="rounded-xl p-3 mb-2" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
                <p className="text-xs font-semibold uppercase text-muted">{sg.area}</p>
                <p className="text-sm text-ink mb-2">{sg.text}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary text-xs" disabled={sg.applied} onClick={() => persist(applyJobSuggestion(doc, sg))}>Apply Suggestion</button>
                  <button type="button" className="btn-glass text-xs" onClick={() => patch({ jobTarget: { ...doc.jobTarget!, suggestions: doc.jobTarget!.suggestions.filter(s => s.id !== sg.id) } })}>Ignore</button>
                </div>
              </article>
            ))}
            <button type="button" className="btn-glass text-sm mt-2" onClick={() => {
              let next = doc
              doc.jobTarget?.suggestions.forEach(sg => { if (!sg.applied) next = applyJobSuggestion(next, sg) })
              persist(next)
            }}>Apply All Safe Changes</button>
            <button type="button" className="btn-primary text-sm ml-2 mt-2" onClick={() => {
              const copy = cloneResume(doc, `${doc.targetRole} — Job Specific`)
              copy.isDefault = false
              copy.jobTarget = doc.jobTarget
              const rows = docs.map(d => ({ ...d, isDefault: false })).concat(copy)
              setDocs(rows)
              saveDocs(rows)
              setActiveId(copy.id)
              saveActiveId(copy.id)
              setToast('Created a job-specific version. Your general resume was not overwritten.')
            }}>Save as job-specific version</button>
          </div>
        )}
        </div>
      </details>

      <details className="rs-panel">
        <summary>Saved resume versions</summary>
        <div className="rs-panel-body">
        <div className="space-y-3">
          {docs.map(d => (
            <article key={d.id} className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
              <div>
                <div className="text-sm font-bold text-ink">{d.versionName}{d.isDefault ? ' · Default' : ''}</div>
                <div className="text-xs text-muted">Updated {relativeWhen(d.updatedAt)} · {scoreResume(d).roleMatch}% Job Match</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-glass text-xs" onClick={() => { setActiveId(d.id); saveActiveId(d.id) }}>Edit</button>
                <button type="button" className="btn-glass text-xs" onClick={() => { setRenameId(d.id); setRenameValue(d.versionName) }}>Rename</button>
                <button type="button" className="btn-glass text-xs" onClick={() => {
                  const copy = cloneResume(d, `${d.versionName} copy`)
                  copy.isDefault = false
                  const rows = [...docs, copy]
                  setDocs(rows)
                  saveDocs(rows)
                }}>Duplicate</button>
                <button type="button" className="btn-glass text-xs" onClick={() => {
                  const rows = docs.map(x => ({ ...x, isDefault: x.id === d.id }))
                  setDocs(rows)
                  saveDocs(rows)
                }}>Set as Default</button>
                <button type="button" className="btn-glass text-xs" disabled={docs.length < 2} onClick={() => {
                  const rows = docs.filter(x => x.id !== d.id)
                  setDocs(rows)
                  saveDocs(rows)
                  if (activeId === d.id) {
                    setActiveId(rows[0].id)
                    saveActiveId(rows[0].id)
                  }
                }}>Delete</button>
              </div>
            </article>
          ))}
        </div>
        </div>
      </details>

      {exportNote && <p className="text-sm text-muted mb-3">{exportNote}</p>}

      <details className="rs-panel">
        <summary>Cover letter</summary>
        <div className="rs-panel-body">
        <p className="text-sm text-muted mb-3">Generated from your resume and job context. No invented experience is added.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" className="btn-primary text-sm" onClick={() => {
            const letter = generateCoverLetter(doc)
            patch({ coverLetter: { ...letter, updatedAt: new Date().toISOString() } })
          }}>Generate Cover Letter</button>
        </div>
        {doc.coverLetter && (
          <textarea className="rs-input" rows={12} value={doc.coverLetter.body} onChange={e => patch({ coverLetter: { ...doc.coverLetter!, body: e.target.value, updatedAt: new Date().toISOString() } })} />
        )}
        </div>
      </details>

      <details className="rs-panel">
        <summary>Interview practice</summary>
        <div className="rs-panel-body">
          <p className="text-sm text-muted mb-3">Practice interviews using experience and projects from this resume.</p>
          <button type="button" className="rs-btn rs-btn-primary" onClick={() => navigate(careerInterviewPath())}>Open interview studio</button>
        </div>
      </details>

      {toast && <p className="text-sm mt-3" style={{ color: '#0f766e' }}>{toast}</p>}

      {improved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setImproved(null)}>
          <div role="dialog" aria-modal="true" className="glass rounded-3xl p-6 max-w-md w-full career-modal-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-ink mb-2">🎉 Resume Improved</h2>
            <p className="text-lg font-black text-ink career-count mb-3">{improved.from} → {improved.to}</p>
            <ul className="text-sm mb-4">{improved.deltas.map(d => <li key={d.label}>+{d.delta} {d.label}</li>)}</ul>
            <p className="text-xs text-muted mb-4">Readiness estimate after safe wording and structure changes. No employers, metrics, or skills were invented.</p>
            <button type="button" className="btn-primary text-sm" onClick={() => { setImproved(null); setPane('preview') }}>Preview Updated Resume →</button>
          </div>
        </div>
      )}

      {roleOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setRoleOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="role-pick" className="glass rounded-3xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 id="role-pick" className="text-lg font-black text-ink mb-3">Change Career Goal</h2>
            <div className="flex flex-wrap gap-2">
              {RESUME_ROLES.map(r => (
                <button key={r} type="button" className="rv-choice px-3 py-2 rounded-xl text-xs font-semibold border" data-on={doc.targetRole === r} onClick={() => { patch({ targetRole: r }); setRoleOpen(false) }}>{r}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {fullPreview && (
        <div className="fixed inset-0 z-[70] overflow-auto p-6" style={{ background: 'rgba(247,249,252,0.96)' }}>
          <button type="button" className="btn-glass text-sm mb-4" onClick={() => setFullPreview(false)}>Close</button>
          <ResumePreview doc={doc} mode={previewMode} />
        </div>
      )}

      {renameId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setRenameId(null)}>
          <div role="dialog" aria-modal="true" className="glass rounded-3xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-ink mb-3">Rename Resume</h2>
            <input className="field w-full px-3 py-2 text-sm mb-4" value={renameValue} onChange={e => setRenameValue(e.target.value)} />
            <button type="button" className="btn-primary text-sm" onClick={() => {
              const rows = docs.map(d => d.id === renameId ? { ...d, versionName: renameValue.trim() || d.versionName, updatedAt: new Date().toISOString() } : d)
              setDocs(rows)
              saveDocs(rows)
              setRenameId(null)
            }}>Save name</button>
          </div>
        </div>
      )}
    </div>
  )
}
