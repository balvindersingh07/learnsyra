import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CareerHubNav from '../components/career/CareerHubNav'
import ResumePreview from '../components/career/ResumePreview'
import { useAuth } from '../context/AuthContext'
import {
  computeReadiness,
  getCareerProfile,
  getCertificates,
  getMyEnrolledCourses,
  getMyStudentProjects,
  saveCareerProfile,
} from '../lib/api'
import { getCareerSnapshot, loadWeeklyActions, saveWeeklyActions } from '../lib/careerCenter'
import {
  analyzeJob,
  applyJobSuggestion,
  applyResumeOverlay,
  applySafeImprovements,
  cloneResume,
  createResume,
  emptyEducation,
  emptyExperience,
  exportPlain,
  generateSummary,
  improveBullet,
  loadActiveId,
  loadDocs,
  projectBullets,
  relativeWhen,
  RESUME_ROLES,
  rewriteSummary,
  saveActiveId,
  saveDocs,
  scoreResume,
  sectionState,
  SECTIONS,
  TEMPLATES,
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
    <label className="block mb-3" htmlFor={id}>
      <span className="text-xs font-semibold text-muted uppercase">{label}</span>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} className="field w-full mt-1 px-3 py-2 text-sm" />
    </label>
  )
}

function AddSkill({ onAdd }: { onAdd: (s: ResumeSkill) => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<SkillCategory>('Technical')
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <input className="field px-3 py-2 text-sm" placeholder="Add a skill you actually have" value={name} onChange={e => setName(e.target.value)} />
      <select className="field px-3 py-2 text-sm" value={category} onChange={e => setCategory(e.target.value as SkillCategory)}>
        {['Technical', 'Tools', 'Languages', 'Soft Skills'].map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn-primary text-xs"
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
  const { profile, session } = useAuth()
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

  const doc = docs.find(d => d.id === activeId) ?? docs[0]
  const scores = doc ? scoreResume(doc) : null

  useEffect(() => {
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
        suggestedSkills: ['Node.js', 'MongoDB', 'TypeScript'],
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
        achievements: [
          { id: uid('ac'), label: 'React Builder', included: true },
          { id: uid('ac'), label: 'Project Finisher', included: true },
        ],
      })

    Promise.all([getCareerProfile(), getCertificates()])
      .then(([career, certRows]) => {
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
            contact: { ...d.contact, name: d.contact.name || name, email: d.contact.email || email },
          }))
          setDocs(patched)
          const aid = loadActiveId()
          setActiveId(aid && patched.some(d => d.id === aid) ? aid : patched[0].id)
          return
        }
        const created = seedCerts(certs)
        if (career?.resume_text) created.summary = career.resume_text
        if (career?.target_role) created.targetRole = career.target_role
        setDocs([created])
        setActiveId(created.id)
        saveDocs([created])
        saveActiveId(created.id)
        applyResumeOverlay(created)
      })
      .catch(() => {
        if (existing.length) {
          setDocs(existing)
          setActiveId(existing[0].id)
        } else {
          const created = seedCerts(snap.certificates)
          setDocs([created])
          setActiveId(created.id)
        }
      })
  }, [profile?.full_name, profile?.headline, session?.user.email, snap])

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
    const rows = list.map(d => (d.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : d))
    setDocs(rows)
    saveDocs(rows)
    applyResumeOverlay(next)
  }

  const patch = (partial: Partial<ResumeDoc>) => {
    if (!doc) return
    persist({ ...doc, ...partial })
  }

  const saveBackend = async () => {
    if (!doc) return
    setBusySave(true)
    const [enrolled, projects] = await Promise.all([getMyEnrolledCourses(), getMyStudentProjects()])
    const avg = enrolled.length ? enrolled.reduce((s, c) => s + c.progress, 0) / enrolled.length : 0
    const next = computeReadiness({
      enrolledCount: enrolled.length,
      avgProgress: avg,
      submittedProjects: projects.filter(p => p.status !== 'started').length,
      resumeLength: doc.summary.trim().length,
      targetRole: doc.targetRole,
    })
    const { error } = await saveCareerProfile({
      target_role: doc.targetRole,
      resume_text: doc.summary,
      skills: doc.skills.filter(s => s.included).map(s => s.name),
      readiness_score: next,
    })
    const week = loadWeeklyActions(getCareerSnapshot().weeklyActions)
    saveWeeklyActions(week.map(w => (w.id === 'w4' ? { ...w, done: true } : w)))
    setBusySave(false)
    setToast(error ?? 'Resume saved.')
  }

  const runSafe = () => {
    if (!doc) return
    const result = applySafeImprovements(doc)
    persist(result.next)
    setImproved({ from: result.from, to: result.to, deltas: result.deltas })
  }

  const downloadText = (ext: 'txt' | 'doc') => {
    if (!doc) return
    const blob = new Blob([exportPlain(doc)], { type: ext === 'doc' ? 'application/msword' : 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${doc.versionName.replace(/\s+/g, '-')}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
    setExportNote(ext === 'doc' ? 'Downloaded a Word-compatible text file. Open it in Word and Save As DOCX if needed.' : 'Downloaded a plain-text resume.')
  }

  if (!doc || !scores) {
    return (
      <div className="pt-20 px-6 max-w-3xl mx-auto">
        <CareerHubNav />
        <p className="text-muted">Loading resume builder…</p>
      </div>
    )
  }

  const recs = [
    !scores.summary ? 'Improve professional summary' : null,
    'Add measurable project outcomes where verified',
    scores.missingKeywords.includes('TypeScript') ? 'Keep TypeScript off the resume until you have learned it' : null,
    'Improve experience bullet clarity',
  ].filter(Boolean) as string[]

  const statusLabel = scores.completeness >= 80 ? 'Strong' : scores.completeness >= 70 ? 'On track' : 'Needs Improvement'

  return (
    <div className="pt-20 px-4 sm:px-6 pb-24 max-w-7xl mx-auto overflow-x-hidden rv-shell">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Career Center</p>
      <h1 className="text-3xl sm:text-4xl font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}>
        Build Your Career <span className="gradient-text">Resume</span>
      </h1>
      <p className="text-muted mb-5 max-w-2xl leading-relaxed">
        Create a professional, ATS-friendly resume using the skills, projects and achievements you have built on LearnSyra.
      </p>
      <CareerHubNav />

      <div className="glass rounded-3xl p-5 mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold text-muted">Resume Readiness</div>
            <div className="text-3xl font-black text-ink career-count">{scores.completeness}%</div>
            <div className="text-sm font-semibold" style={{ color: scores.completeness >= 80 ? '#0F8A68' : '#B45309' }}>{statusLabel}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={runSafe}>✨ Improve With AI</button>
            <button type="button" className="btn-glass text-sm" onClick={() => { setPreviewOpen(true); setPane('preview') }}>Preview Resume</button>
          </div>
        </div>
        <div className="progress-bar" aria-label={`Resume readiness ${scores.completeness} percent`}>
          <div className="progress-fill" style={{ width: `${scores.completeness}%` }} />
        </div>
        <p className="text-xs text-muted mt-2">AI-generated readiness estimate — not an official ATS vendor score.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-base font-black text-ink mb-1">Resume Strength</h2>
          <div className="text-3xl font-black career-count mb-3">{scores.completeness} / 100</div>
          <ul className="text-sm space-y-1 mb-4">
            <li>{scores.contact ? '✓' : '⚠'} Contact</li>
            <li>{scores.summary ? '✓' : '⚠'} Summary</li>
            <li>{scores.skills ? '✓' : '⚠'} Skills</li>
            <li>{scores.projects ? '✓' : '⚠'} Projects</li>
            <li>⚠ Experience — {scores.experience}%</li>
            <li>{scores.education ? '✓' : '○'} Education</li>
            <li>⚠ Achievements — {scores.achievements}%</li>
          </ul>
          <p className="text-sm text-muted mb-3">
            <span className="font-bold text-ink">AI Recommendation</span> — Your projects are strong, but your experience descriptions need measurable outcomes from work you actually did.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={runSafe}>Fix With AI →</button>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-base font-black text-ink mb-1">📊 ATS Readiness</h2>
          <div className="text-3xl font-black career-count mb-3">{scores.ats} / 100</div>
          <ul className="text-sm space-y-1 mb-3">
            <li>Keywords — {scores.keywords}</li>
            <li>Structure — {scores.structure}</li>
            <li>Readability — {scores.readability}</li>
            <li>Role Match — {scores.roleMatch}</li>
            <li>Missing Keywords — {scores.missingKeywords.length}</li>
          </ul>
          <p className="text-xs font-bold text-ink mb-1">Missing For {doc.targetRole}</p>
          <p className="text-sm text-muted mb-3">{scores.missingKeywords.join(' · ') || 'None from this estimate'}</p>
          <button type="button" className="btn-glass text-xs" onClick={() => setSection('skills')}>Improve Match →</button>
          <p className="text-xs text-muted mt-3">ATS-style readiness estimate. Not tied to a specific ATS vendor.</p>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-base font-black text-ink mb-2">✨ LearnSyra Resume Coach</h2>
          <p className="text-sm text-muted mb-2">Current Analysis · Resume Strength {scores.completeness} / 100</p>
          <ol className="text-sm space-y-1 mb-4 list-decimal pl-4">
            {recs.slice(0, 4).map(r => <li key={r}>{r}</li>)}
          </ol>
          <button type="button" className="btn-primary text-xs" onClick={runSafe}>Fix All Safe Improvements</button>
        </section>
      </div>

      <div className="flex lg:hidden gap-2 mb-4">
        {(['sections', 'edit', 'preview'] as MobilePane[]).map(p => (
          <button key={p} type="button" className="rv-choice flex-1 py-2 rounded-xl text-xs font-semibold border capitalize" data-on={pane === p} onClick={() => setPane(p)}>
            {p === 'edit' ? 'Editor' : p}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)_minmax(18rem,0.9fr)] gap-4 mb-6">
        <nav className={`glass rounded-3xl p-4 ${pane !== 'preview' ? '' : 'hidden'} lg:block`} aria-label="Resume sections">
          <h2 className="text-sm font-black text-ink mb-3">Resume Sections</h2>
          <ul className="space-y-1">
            {SECTIONS.map(s => {
              const st = sectionState(doc, s.id)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-xl text-sm"
                    style={{ background: section === s.id ? 'rgba(108,92,231,0.12)' : 'transparent', color: section === s.id ? '#5B4BD6' : '#172033' }}
                    onClick={() => { setSection(s.id); setPane('edit') }}
                  >
                    {s.label} {st === 'done' ? '✓' : st === 'warn' ? '⚠' : ''}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={`glass rounded-3xl p-5 ${pane === 'edit' ? '' : 'hidden'} lg:block`}>
          {section === 'contact' && (
            <>
              <h2 className="text-lg font-black text-ink mb-3">Contact Information</h2>
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
              <h2 className="text-lg font-black text-ink mb-3">Professional Summary</h2>
              <textarea className="field w-full p-3 text-sm mb-3" rows={6} placeholder="Write a short professional summary..." value={doc.summary} onChange={e => patch({ summary: e.target.value })} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-xs" onClick={() => patch({ summary: generateSummary(doc) })}>✨ Generate With AI</button>
                <button type="button" className="btn-glass text-xs" onClick={() => patch({ summary: rewriteSummary(doc.summary, 'improve', doc) })}>Improve</button>
                <button type="button" className="btn-glass text-xs" onClick={() => patch({ summary: rewriteSummary(doc.summary, 'concise', doc) })}>Make More Concise</button>
                <button type="button" className="btn-glass text-xs" onClick={() => patch({ summary: rewriteSummary(doc.summary, 'technical', doc) })}>Make More Technical</button>
                <button type="button" className="btn-glass text-xs" onClick={() => patch({ summary: rewriteSummary(doc.summary, 'career', doc) })}>Make More Career-Focused</button>
              </div>
              <p className="text-xs text-muted mt-3">AI uses your target role, listed skills, and LearnSyra projects. It does not invent jobs or metrics.</p>
            </>
          )}

          {section === 'target' && (
            <>
              <h2 className="text-lg font-black text-ink mb-2">Target Role</h2>
              <div className="text-2xl font-black text-ink">{doc.targetRole}</div>
              <p className="text-sm font-bold text-primary mb-4">{snap.targetMatch}% Match</p>
              <button type="button" className="btn-glass text-sm" onClick={() => setRoleOpen(true)}>Change Career Goal</button>
            </>
          )}

          {section === 'experience' && (
            <>
              <h2 className="text-lg font-black text-ink mb-2">Experience</h2>
              <p className="text-xs text-muted mb-4">Add only roles you actually held. AI may improve wording, never invent employers or metrics.</p>
              {doc.experience.map(exp => (
                <article key={exp.id} className="rounded-2xl p-3 mb-3" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
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
                        <textarea className="field w-full p-2 text-sm" rows={2} placeholder="Describe work you actually did..." value={b} onChange={e => {
                          const bullets = exp.bullets.slice()
                          bullets[i] = e.target.value
                          patch({ experience: doc.experience.map(x => (x.id === exp.id ? { ...x, bullets } : x)) })
                        }} />
                        <button type="button" className="btn-glass text-xs mt-1" onClick={() => setBulletHint({ ...bulletHint, [key]: { original: b, improved: improveBullet(b, 0), variant: 0 } })}>✨ Improve With AI</button>
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
                  <button type="button" className="btn-glass text-xs" onClick={() => patch({ experience: doc.experience.map(x => (x.id === exp.id ? { ...x, bullets: [...x.bullets, ''] } : x)) })}>+ Add bullet</button>
                </article>
              ))}
              <button type="button" className="btn-primary text-sm" onClick={() => patch({ experience: [...doc.experience, emptyExperience()] })}>+ Add Experience</button>
            </>
          )}

          {section === 'education' && (
            <>
              <h2 className="text-lg font-black text-ink mb-3">Education</h2>
              {doc.education.map(ed => (
                <article key={ed.id} className="rounded-2xl p-3 mb-3" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
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
              <button type="button" className="btn-primary text-sm" onClick={() => patch({ education: [...doc.education, emptyEducation()] })}>+ Add Education</button>
            </>
          )}

          {section === 'skills' && (
            <>
              <h2 className="text-lg font-black text-ink mb-2">🧬 Skills</h2>
              <p className="text-xs text-muted mb-3">Suggested from LearnSyra learning history. Verified only when backed by course or project data.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {doc.skills.map(sk => (
                  <label key={sk.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm" style={{ background: sk.included ? 'rgba(108,92,231,0.12)' : 'rgba(255,255,255,0.8)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <input type="checkbox" className="career-check" checked={sk.included} onChange={e => patch({ skills: doc.skills.map(s => (s.id === sk.id ? { ...s, included: e.target.checked } : s)) })} />
                    {sk.name}
                    {sk.verified && <span className="text-[10px] font-semibold text-success">Verified through LearnSyra</span>}
                  </label>
                ))}
              </div>
              <AddSkill onAdd={skill => patch({ skills: [...doc.skills, skill] })} />
            </>
          )}

          {section === 'projects' && (
            <>
              <h2 className="text-lg font-black text-ink mb-3">🚀 Projects</h2>
              {doc.projects.map(p => (
                <article key={p.projectId} className="rounded-2xl p-4 mb-3" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
                  <div className="flex justify-between gap-2">
                    <div className="font-bold text-ink">{p.title}</div>
                    <div className="text-sm font-black">{p.score} / 100</div>
                  </div>
                  <p className="text-xs text-muted">{p.skills.join(' · ')} {p.portfolioReady ? '· ✓ Portfolio ready' : ''}</p>
                  <textarea className="field w-full p-2 text-sm mt-2" rows={2} value={p.description} onChange={e => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, description: e.target.value } : x)) })} />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button type="button" className="btn-glass text-xs" onClick={() => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, included: true } : x)) })}>Add to Resume</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, bullets: projectBullets(x) } : x)) })}>✨ Generate Project Description</button>
                    <button type="button" className="btn-glass text-xs" onClick={() => patch({ projects: doc.projects.map(x => (x.projectId === p.projectId ? { ...x, included: false } : x)) })}>Remove</button>
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

          {section === 'extra' && (
            <>
              <h2 className="text-lg font-black text-ink mb-2">Additional Information</h2>
              <button type="button" className="btn-glass text-xs mb-3" onClick={() => patch({ extraOpen: !doc.extraOpen })}>
                {doc.extraOpen ? 'Hide optional fields' : 'Show optional fields'}
              </button>
              {doc.extraOpen && (
                <>
                  <Field id="lang" label="Languages" value={doc.extra.languages} onChange={v => patch({ extra: { ...doc.extra, languages: v } })} />
                  <Field id="int" label="Interests" value={doc.extra.interests} onChange={v => patch({ extra: { ...doc.extra, interests: v } })} />
                  <Field id="vol" label="Volunteer work" value={doc.extra.volunteer} onChange={v => patch({ extra: { ...doc.extra, volunteer: v } })} />
                  <Field id="pub" label="Publications" value={doc.extra.publications} onChange={v => patch({ extra: { ...doc.extra, publications: v } })} />
                  <Field id="aw" label="Awards" value={doc.extra.awards} onChange={v => patch({ extra: { ...doc.extra, awards: v } })} />
                  <Field id="os" label="Open source" value={doc.extra.opensource} onChange={v => patch({ extra: { ...doc.extra, opensource: v } })} />
                  <Field id="lk" label="Links" value={doc.extra.links} onChange={v => patch({ extra: { ...doc.extra, links: v } })} />
                </>
              )}
            </>
          )}
        </div>

        <aside className={`${pane === 'preview' ? '' : 'hidden'} lg:block`}>
          <div className="flex flex-wrap gap-2 mb-3">
            <button type="button" className="btn-glass text-xs" onClick={() => setPreviewMode('desktop')}>Desktop Preview</button>
            <button type="button" className="btn-glass text-xs" onClick={() => setPreviewMode('mobile')}>Mobile Preview</button>
            <button type="button" className="btn-glass text-xs" onClick={() => setFullPreview(true)}>Full Screen</button>
            <button type="button" className="btn-glass text-xs" onClick={() => setPane('edit')}>Edit</button>
            <button type="button" className="btn-primary text-xs" onClick={() => window.print()}>Download</button>
          </div>
          <div className="overflow-x-auto">
            <ResumePreview doc={doc} mode={previewMode} />
          </div>
        </aside>
      </div>

      <section className="glass rounded-3xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Choose Your Resume Style</h2>
        <div className="grid sm:grid-cols-4 gap-3">
          {TEMPLATES.map(t => (
            <button key={t.id} type="button" className="rv-choice text-left rounded-2xl p-3 border" data-on={doc.template === t.id} onClick={() => patch({ template: t.id })}>
              <div className="text-sm font-black text-ink">{t.title}{t.id === 'minimal' ? ' · Default' : ''}</div>
              <div className="text-xs text-muted mt-1">{t.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">🎯 Tailor Resume For a Job</h2>
        <p className="text-sm text-muted mb-3">Select a target role or paste a job description. Analysis never adds skills you do not have.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {RESUME_ROLES.map(r => (
            <button key={r} type="button" className="rv-choice px-3 py-1.5 rounded-xl text-xs font-semibold border" data-on={doc.targetRole === r} onClick={() => patch({ targetRole: r })}>{r}</button>
          ))}
        </div>
        <textarea className="field w-full p-3 text-sm mb-3" rows={4} placeholder="Paste job description here..." value={jobText} onChange={e => setJobText(e.target.value)} />
        <button type="button" className="btn-primary text-sm mb-4" onClick={() => patch({ jobTarget: analyzeJob(jobText || doc.targetRole, doc) })}>Analyze Job →</button>
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
      </section>

      <section className="glass rounded-3xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-3">Saved Resumes</h2>
        <div className="space-y-3">
          {docs.map(d => (
            <article key={d.id} className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
              <div>
                <div className="text-sm font-bold text-ink">{d.versionName}{d.isDefault ? ' · Default' : ''}</div>
                <div className="text-xs text-muted">Updated {relativeWhen(d.updatedAt)} · {scoreResume(d).roleMatch}% Job Match</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-glass text-xs" onClick={() => { setActiveId(d.id); saveActiveId(d.id) }}>Edit</button>
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
      </section>

      <section className="glass rounded-3xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Export Resume</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-sm" onClick={() => { window.print(); setExportNote("Use your browser's Print to PDF. A generated PDF binary is not attached yet.") }}>Download PDF</button>
          <button type="button" className="btn-glass text-sm" onClick={() => downloadText('doc')}>Download DOCX</button>
          <button type="button" className="btn-glass text-sm" onClick={() => window.print()}>Print</button>
        </div>
        {exportNote && <p className="text-sm text-muted mt-3">{exportNote}</p>}
      </section>

      <section className="glass rounded-3xl p-5 mb-6">
        <h2 className="text-lg font-black text-ink mb-2">Interview With Resume Context</h2>
        <p className="text-sm text-muted mb-3">Your next AI interview can use the experience and projects from this resume.</p>
        <button type="button" className="btn-primary text-sm" onClick={() => navigate(careerInterviewPath())}>Practice Interview →</button>
      </section>

      <div className="rv-sticky lg:hidden flex gap-2">
        <button type="button" className="btn-primary flex-1" disabled={busySave} onClick={saveBackend}>{busySave ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn-glass flex-1" onClick={() => setPane('preview')}>Preview</button>
      </div>
      <div className="hidden lg:flex gap-2 items-center">
        <button type="button" className="btn-primary" disabled={busySave} onClick={saveBackend}>{busySave ? 'Saving…' : 'Save resume'}</button>
        {toast && <p className="text-sm" style={{ color: '#0F8A68' }}>{toast}</p>}
      </div>
      {toast && <p className="text-sm mt-2 lg:hidden" style={{ color: '#0F8A68' }}>{toast}</p>}

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
    </div>
  )
}
