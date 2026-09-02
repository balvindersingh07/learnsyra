import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CareerHubNav from '../components/career/CareerHubNav'
import { useAuth } from '../context/AuthContext'
import { getCareerSnapshot } from '../lib/careerCenter'
import { hydrateCareerData } from '../lib/careerPersistence'
import { loadInterviewCareerOverlay } from '../lib/interviewStudio'
import {
  applicationReadiness,
  buildJobProfile,
  getJobById,
  loadApps,
  loadTargetRole,
  rankJob,
  relativePosted,
  salaryLabel,
  STATUSES,
  upsertApp,
  type AppStatus,
  type JobApplication,
} from '../lib/jobRecommendations'
import { careerInterviewPath, careerJobsPath, careerResumePath } from '../lib/paths'
import { loadActiveId, loadDocs, loadResumeCareerOverlay } from '../lib/resumeBuilder'
import './career-center.css'
import './job-recs.css'

function currentProfile() {
  const snap = getCareerSnapshot()
  const docs = loadDocs()
  const active = loadActiveId()
  const resume = docs.find(d => d.id === active) ?? docs.find(d => d.isDefault) ?? docs[0]
  const iv = loadInterviewCareerOverlay()
  const rs = loadResumeCareerOverlay()
  const targetRole = loadTargetRole(snap.targetRole)
  return {
    snap,
    resume,
    profile: buildJobProfile({
      targetRole,
      haveSkills: snap.haveSkills,
      gapSkills: snap.needSkills,
      projects: snap.portfolio.map(p => ({ id: p.id, title: p.title, skills: p.skills })),
      interviewScore: iv?.interviewAfter ?? snap.interview.overall,
      resumeScore: rs?.resumeScore ?? snap.resume.score,
      resumeSkills: resume?.skills.filter(s => s.included).map(s => s.name),
    }),
  }
}

export default function CareerJobDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [{ snap, resume, profile }, setBundle] = useState(currentProfile)
  const catalog = getJobById(id)
  const job = catalog ? rankJob(catalog, profile) : null
  const [apps, setApps] = useState<Record<string, JobApplication>>(() => loadApps())
  const [demoApply, setDemoApply] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const app = job ? apps[job.id] : undefined
  const ready = job ? applicationReadiness(job, profile) : null

  useEffect(() => {
    let alive = true
    setLoading(true)
    hydrateCareerData(session?.user.id ?? null)
      .then(() => {
        if (!alive) return
        setBundle(currentProfile())
        setApps({ ...loadApps() })
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, session?.user.id])

  useEffect(() => {
    setBundle(currentProfile())
  }, [id])

  useEffect(() => {
    if (!demoApply && !reviewOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDemoApply(false)
        setReviewOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [demoApply, reviewOpen])

  const resumeMatched = useMemo(() => {
    if (!job || !resume) return profile.skills.slice(0, 4)
    const have = resume.skills.filter(s => s.included).map(s => s.name)
    return job.skills.filter(s => have.some(h => h.toLowerCase() === s.toLowerCase() || h.toLowerCase().includes(s.toLowerCase())))
  }, [job, resume, profile.skills])

  const resumeMissing = job ? job.skillGaps : []
  const contactOk = Boolean(resume?.contact.email || session?.user.email)
  const interviewQs = job
    ? [...new Set(['React Hooks', 'JavaScript fundamentals', 'REST APIs', ...job.skills.filter(s => /test|type|access/i.test(s))])].slice(0, 4)
    : []

  const refreshApps = () => setApps({ ...loadApps() })

  const saveJob = () => {
    if (!job) return
    upsertApp(job.id, { saved: !app?.saved, status: !app?.saved ? (app?.status ?? 'Saved') : app?.status })
    refreshApps()
  }

  const applyNow = () => {
    if (!job) return
    if (job.externalUrl) window.open(job.externalUrl, '_blank', 'noopener,noreferrer')
    setDemoApply(true)
  }

  const markApplied = () => {
    if (!job) return
    upsertApp(job.id, { status: 'Applied', appliedAt: new Date().toISOString(), saved: true })
    refreshApps()
    setDemoApply(false)
    setReviewOpen(false)
  }

  const setStatus = (status: AppStatus) => {
    if (!job) return
    upsertApp(job.id, { status, saved: true, appliedAt: app?.appliedAt ?? (status === 'Saved' ? null : new Date().toISOString()) })
    refreshApps()
  }

  if (loading) {
    return (
      <div className="pt-20 px-4 sm:px-6 pb-16 max-w-5xl mx-auto overflow-x-hidden">
        <CareerHubNav />
        <p className="text-muted text-sm mt-6">Loading application data…</p>
      </div>
    )
  }

  if (!job || !ready) {
    return (
      <div className="pt-20 px-4 sm:px-6 pb-16 max-w-3xl mx-auto">
        <CareerHubNav />
        <section className="glass rounded-3xl p-8">
          <h1 className="text-2xl font-black text-ink mb-2">Job not found</h1>
          <p className="text-sm text-muted mb-4">This sample listing is not in the LearnSyra catalog.</p>
          <Link to={careerJobsPath()} className="btn-primary text-sm inline-block">Back to Jobs</Link>
        </section>
      </div>
    )
  }

  const gapCourse = job.relatedCourses[0]
  const gapProject = job.relatedProjects[0]
  const appliedLabel = app?.appliedAt ? new Date(app.appliedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="pt-20 px-4 sm:px-6 pb-24 lg:pb-16 max-w-4xl mx-auto overflow-x-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Career Center</p>
      <CareerHubNav />
      <Link to={careerJobsPath()} className="text-sm font-semibold text-primary mb-4 inline-block">← All jobs</Link>

      <section className="glass rounded-3xl p-5 sm:p-7 mb-4">
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="badge badge-green text-[10px]">{job.careerFit}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{ border: '1px solid rgba(99,102,241,0.14)' }}>{job.workMode}</span>
          {job.skills.slice(0, 3).map(s => (
            <span key={s} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{ border: '1px solid rgba(99,102,241,0.14)' }}>{s}</span>
          ))}
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}>{job.title}</h1>
        <p className="text-base font-semibold text-ink">{job.company}</p>
        <p className="text-sm text-muted">{job.location} · {salaryLabel(job)} · {job.yearsLabel} · Posted {relativePosted(job.postedAt)}</p>
        <div className="flex flex-wrap items-end gap-4 mt-4">
          <div>
            {job.matchScore > 0 ? (
              <>
                <div className="text-3xl font-black text-primary career-count">{job.matchScore}%</div>
                <div className="text-[10px] font-semibold uppercase text-muted">LearnSyra Match</div>
                <div className="progress-bar mt-1 w-36" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${job.matchScore}%` }} />
                </div>
              </>
            ) : (
              <div className="text-sm font-semibold text-muted">Set your career goal</div>
            )}
          </div>
          <div className="hidden lg:flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={() => setReviewOpen(true)}>Apply →</button>
            <button type="button" className="btn-glass text-sm job-heart" data-on={app?.saved === true} onClick={saveJob} aria-pressed={app?.saved === true}>
              {app?.saved ? '♥ Saved' : '♡ Save'}
            </button>
          </div>
        </div>
      </section>

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-3">{job.matchScore > 0 ? 'Your Match' : 'Explore this listing'}</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-bold mb-1">{job.matchScore > 0 ? 'You Have' : 'Role skills'}</h3>
            <div className="flex flex-wrap gap-1.5">
              {job.matchScore > 0
                ? job.matchReasons.map((r, i) => <span key={`${r}-${i}`} style={{ color: '#0F8A68' }}>✓ {r}</span>)
                : <span className="text-muted">Set your career goal to see a personalized match.</span>}
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-1">Improve</h3>
            <div className="flex flex-wrap gap-1.5">
              {job.skillGaps.map(g => <span key={g} className="job-gap px-2 py-0.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>⚠ {g}</span>)}
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-1">Your Projects</h3>
            {profile.projects.slice(0, 2).map(p => <p key={p.id}>✓ {p.title}</p>)}
          </div>
          <div>
            <p><span className="font-bold">Interview Readiness</span> {profile.interviewScore} / 100</p>
            <p><span className="font-bold">Resume Match</span> {ready.resume} / 100</p>
          </div>
        </div>
      </section>

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-2">About the Role</h2>
        <p className="text-sm text-muted mb-4 leading-relaxed">{job.description}</p>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-bold mb-1">Responsibilities</h3>
            <ul className="list-disc pl-5 space-y-1">{job.responsibilities.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="font-bold mb-1">Requirements</h3>
            <ul className="list-disc pl-5 space-y-1">{job.requirements.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="font-bold mb-1">Nice to Have</h3>
            <ul className="list-disc pl-5 space-y-1">{job.niceToHave.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3 className="font-bold mb-1">Benefits</h3>
            <ul className="list-disc pl-5 space-y-1">{job.benefits.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-1">✨ Application Readiness</h2>
        <div className="text-4xl font-black career-count">{ready.overall}%</div>
        <p className="text-xs font-semibold uppercase text-muted mb-3">AI Match Estimate</p>
        <div className="space-y-2 mb-3">
          {[
            ['Resume', ready.resume],
            ['Skills', ready.skills],
            ['Projects', ready.projects],
            ['Interview', ready.interview],
          ].map(([label, val]) => (
            <div key={String(label)}>
              <div className="flex justify-between text-sm"><span>{label}</span><span className="font-bold">{val}%</span></div>
              <div className="progress-bar" aria-hidden="true"><div className="progress-fill" style={{ width: `${Number(val)}%` }} /></div>
            </div>
          ))}
        </div>
        <blockquote className="text-sm text-ink mb-4">You are ready to apply, but improving {job.skillGaps[0] || 'a remaining skill'} could strengthen your profile.</blockquote>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm" onClick={() => navigate(`/courses?q=${encodeURIComponent(job.skillGaps[0] || 'TypeScript')}`)}>Improve Before Applying</button>
          <button type="button" className="btn-primary text-sm" onClick={() => setReviewOpen(true)}>Apply Now</button>
        </div>
      </section>

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-2">📄 Resume Match</h2>
        <p className="font-bold text-ink">{resume?.versionName ?? `${snap.targetRole} Resume`}</p>
        <p className="text-sm text-primary font-semibold mb-2">{ready.resume}% Job Match</p>
        <p className="text-sm mb-1"><span className="font-bold">Matched:</span> {resumeMatched.join(', ') || 'Core skills on file'}</p>
        <p className="text-sm mb-3"><span className="font-bold">Missing:</span> {resumeMissing.join(', ') || 'None listed'}</p>
        <button type="button" className="btn-primary text-sm" onClick={() => navigate(`${careerResumePath()}?jobId=${job.id}`)}>Tailor Resume →</button>
      </section>

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-2">🤖 Prepare For This Job</h2>
        <h3 className="text-sm font-bold mb-2">Recommended Before Applying</h3>
        <ul className="text-sm space-y-1 mb-4">
          <li>{resume ? '✓' : '⚠'} Resume is {resume ? 'ready' : 'not saved yet'}</li>
          {job.skillGaps.slice(0, 2).map(g => <li key={g}>⚠ Practice {g}</li>)}
          <li>✓ Portfolio has relevant project</li>
        </ul>
        <button type="button" className="btn-primary text-sm" onClick={() => navigate('/ai-learning')}>Prepare With AI →</button>
      </section>

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-2">🎤 Interview Preparation</h2>
        <p className="font-bold text-ink mb-2">{job.role} Technical Interview</p>
        <p className="text-sm text-muted mb-2">Recommended questions:</p>
        <ul className="list-disc pl-5 text-sm mb-4">{interviewQs.map(q => <li key={q}>{q}</li>)}</ul>
        <button type="button" className="btn-primary text-sm" onClick={() => navigate(`${careerInterviewPath()}?jobId=${job.id}`)}>Practice Interview →</button>
      </section>

      {gapCourse && (
        <section className="glass rounded-3xl p-5 mb-4">
          <h2 className="text-lg font-black text-ink mb-2">Close This Gap</h2>
          <p className="font-bold">{gapCourse.title}</p>
          <p className="text-sm text-muted">Estimated {gapCourse.hours} hours · +{gapCourse.lift}% estimated match</p>
          <button type="button" className="btn-primary text-sm mt-3" onClick={() => navigate(`/courses?q=${encodeURIComponent(gapCourse.query)}`)}>Start Learning →</button>
        </section>
      )}

      {gapProject && (
        <section className="glass rounded-3xl p-5 mb-4">
          <h2 className="text-lg font-black text-ink mb-2">🚀 Build This To Strengthen Your Application</h2>
          <p className="font-bold">{gapProject.title}</p>
          <p className="text-sm text-muted">{gapProject.skills.join(' · ')} · Estimated {gapProject.hours} hours</p>
          <button type="button" className="btn-primary text-sm mt-3" onClick={() => navigate(gapProject.href)}>Start Project →</button>
        </section>
      )}

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-2">🏢 About the Company</h2>
        <p className="font-bold text-ink">{job.company}</p>
        <p className="text-sm text-muted">Industry: {job.industry}</p>
        <p className="text-sm text-muted">Size: {job.companySize}</p>
        <p className="text-sm text-muted">Location: {job.location}</p>
        <p className="text-xs text-muted mt-2">Company details are sample data for LearnSyra practice, not a verified employer profile.</p>
      </section>

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-2">Application tracking</h2>
        <p className="text-sm">{job.title}</p>
        <p className="text-sm text-muted">{job.company}</p>
        <p className="text-sm font-bold mt-1">{app?.status ?? 'Not saved'}</p>
        {appliedLabel && <p className="text-xs text-muted">Applied: {appliedLabel}</p>}
        <label className="block text-sm font-semibold mt-3">
          Update Status
          <select className="field w-full mt-1 px-3 py-2 text-sm" value={app?.status ?? 'Saved'} onChange={e => setStatus(e.target.value as AppStatus)} aria-label="Update application status">
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
      </section>

      <section className="glass rounded-3xl p-5 mb-4">
        <h2 className="text-lg font-black text-ink mb-2">Application Checklist</h2>
        <ul className="text-sm space-y-1 mb-4">
          <li>{resume ? '✓' : '⚠'} Resume selected</li>
          <li>{profile.projects.length ? '✓' : '⚠'} Portfolio project selected</li>
          <li>{contactOk ? '✓' : '⚠'} Contact information complete</li>
          <li>{profile.interviewScore >= 80 ? '✓' : '⚠'} Interview practice recommended</li>
        </ul>
        <button type="button" className="btn-glass text-sm" onClick={() => setReviewOpen(true)}>Review Application</button>
      </section>

      <div className="job-sticky lg:hidden flex gap-2">
        <button type="button" className="btn-primary text-sm flex-1" onClick={() => setReviewOpen(true)}>Apply →</button>
        <button type="button" className="btn-glass text-sm job-heart" data-on={app?.saved === true} onClick={saveJob} aria-pressed={app?.saved === true}>
          {app?.saved ? '♥ Saved' : '♡ Save'}
        </button>
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setReviewOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="review-title" className="glass rounded-3xl p-6 max-w-md w-full career-modal-in" onClick={e => e.stopPropagation()}>
            <h2 id="review-title" className="text-lg font-black text-ink mb-2">Review Application</h2>
            <p className="text-sm text-muted mb-3">LearnSyra does not submit applications. A score never blocks you from applying.</p>
            <ul className="text-sm space-y-1 mb-4">
              <li>{resume ? '✓' : '⚠'} Resume selected</li>
              <li>{profile.projects.length ? '✓' : '⚠'} Portfolio project selected</li>
              <li>{contactOk ? '✓' : '⚠'} Contact information complete</li>
              <li>{profile.interviewScore >= 80 ? '✓' : '⚠'} Interview practice recommended</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={applyNow}>Apply →</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setReviewOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {demoApply && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setDemoApply(false)}>
          <div role="dialog" aria-modal="true" className="glass rounded-3xl p-6 max-w-md w-full career-modal-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-ink mb-2">{job.externalUrl ? 'External application opened' : 'Demo application flow'}</h2>
            <p className="text-sm text-muted mb-4">
              {job.externalUrl
                ? 'This listing opened an example URL. After you apply on the source, mark it here. LearnSyra does not submit applications.'
                : 'This is a mock listing with no live employer URL. Mark as Applied for local tracking practice only.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={markApplied}>Mark as Applied</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setDemoApply(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-4">Match scores are LearnSyra estimates from your skills, projects, resume, and interview practice. They are not hiring probabilities.</p>
    </div>
  )
}
