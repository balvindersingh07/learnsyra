import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CareerHubNav from '../components/career/CareerHubNav'
import JobCard from '../components/career/JobCard'
import JobFiltersPanel from '../components/career/JobFiltersPanel'
import { getCareerSnapshot } from '../lib/careerCenter'
import { loadInterviewCareerOverlay } from '../lib/interviewStudio'
import {
  appStats,
  buildJobProfile,
  defaultExperience,
  EMPTY_FILTERS,
  filterJobs,
  fitCopy,
  JOB_ROLES,
  loadApps,
  loadFilters,
  loadTargetRole,
  rankCatalog,
  saveFilters,
  saveTargetRole,
  sortJobs,
  SORTS,
  upsertApp,
  type AppStatus,
  type JobApplication,
  type JobFilters,
  type JobSort,
  type RankedJob,
} from '../lib/jobRecommendations'
import { careerJobPath, careerResumePath } from '../lib/paths'
import { loadActiveId, loadDocs, loadResumeCareerOverlay } from '../lib/resumeBuilder'
import './career-center.css'
import './job-recs.css'

function currentProfile(targetRole: string) {
  const snap = getCareerSnapshot()
  const docs = loadDocs()
  const active = loadActiveId()
  const resume = docs.find(d => d.id === active) ?? docs.find(d => d.isDefault) ?? docs[0]
  const iv = loadInterviewCareerOverlay()
  const rs = loadResumeCareerOverlay()
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

export default function CareerJobs() {
  const navigate = useNavigate()
  const initialSnap = useMemo(() => getCareerSnapshot(), [])
  const [targetRole, setTargetRole] = useState(() => loadTargetRole(initialSnap.targetRole))
  const [roleOpen, setRoleOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [why, setWhy] = useState<RankedJob | null>(null)
  const [demoApply, setDemoApply] = useState<RankedJob | null>(null)
  const [aiReady, setAiReady] = useState(false)
  const [tab, setTab] = useState<'Recommended' | 'Saved' | 'Applied'>('Recommended')
  const [sort, setSort] = useState<JobSort>('Recommended')
  const [filters, setFilters] = useState<JobFilters>(() => loadFilters() ?? { ...EMPTY_FILTERS, experience: [defaultExperience(initialSnap.readinessScore)] })
  const [apps, setApps] = useState<Record<string, JobApplication>>(() => loadApps())
  const { snap, resume, profile } = useMemo(() => currentProfile(targetRole), [targetRole])
  const ranked = useMemo(() => rankCatalog(profile), [profile])

  useEffect(() => {
    const t = window.setTimeout(() => setAiReady(true), 280)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    saveFilters(filters)
  }, [filters])

  useEffect(() => {
    if (!roleOpen && !why && !filterOpen && !demoApply) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleOpen(false)
        setWhy(null)
        setFilterOpen(false)
        setDemoApply(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [roleOpen, why, filterOpen, demoApply])

  const filtered = useMemo(() => {
    let rows = filterJobs(ranked, filters)
    if (tab === 'Saved') rows = rows.filter(j => apps[j.id]?.saved)
    if (tab === 'Applied') {
      rows = rows.filter(j => {
        const st = apps[j.id]?.status
        return Boolean(apps[j.id]?.appliedAt) || st === 'Applied' || st === 'Interview' || st === 'Offer' || st === 'Rejected'
      })
    }
    return sortJobs(rows, sort)
  }, [ranked, filters, sort, tab, apps])

  const stats = appStats(apps)
  const rolePool = ranked.filter(j => j.role === targetRole)
  const important = [...new Set(rolePool.flatMap(j => j.skills))].slice(0, 22)
  const matchedSkills = important.filter(s => profile.skills.some(h => h.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(h.toLowerCase())))
  const readyPct = Math.round((matchedSkills.length / Math.max(1, important.length)) * 100)
  const careerMatch = targetRole === snap.targetRole
    ? snap.targetMatch
    : Math.round(sortJobs(rolePool, 'Highest Match').slice(0, 5).reduce((s, j) => s + j.matchScore, 0) / Math.max(1, Math.min(5, rolePool.length)))
  const best = sortJobs(ranked, 'Highest Match').slice(0, 4)
  const ready = ranked.filter(j => j.matchScore >= 85).slice(0, 4)
  const almost = ranked.filter(j => j.matchScore >= 70 && j.matchScore < 85).slice(0, 4)
  const stretch = ranked.filter(j => j.matchScore >= 60 && j.matchScore < 70).slice(0, 4)
  const interviewOk = profile.interviewScore >= 80
  const gapCourse = profile.gapSkills[0] || 'TypeScript'

  const refreshApps = () => setApps({ ...loadApps() })

  const saveJob = (id: string) => {
    const cur = apps[id]?.saved
    upsertApp(id, { saved: !cur, status: !cur ? (apps[id]?.status ?? 'Saved') : apps[id]?.status })
    refreshApps()
  }

  const setStatus = (id: string, status: AppStatus) => {
    upsertApp(id, {
      status,
      saved: true,
      appliedAt: status === 'Saved' ? apps[id]?.appliedAt ?? null : apps[id]?.appliedAt ?? new Date().toISOString(),
    })
    refreshApps()
  }

  const applyJob = (job: RankedJob) => {
    if (job.externalUrl) window.open(job.externalUrl, '_blank', 'noopener,noreferrer')
    setDemoApply(job)
  }

  const markApplied = (id: string) => {
    upsertApp(id, { status: 'Applied', appliedAt: new Date().toISOString(), saved: true })
    refreshApps()
    setDemoApply(null)
  }

  const startRecommended = () => {
    const first = ready[0] ?? best[0]
    if (first) {
      navigate(careerJobPath(first.id))
      return
    }
    navigate(`/courses?q=${encodeURIComponent(gapCourse)}`)
  }

  const list = (rows: RankedJob[], withStatus = false) => (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-muted">No roles in this group right now.</p>}
      {rows.map(job => (
        <JobCard
          key={job.id}
          job={job}
          app={apps[job.id]}
          showStatus={withStatus}
          onView={() => navigate(careerJobPath(job.id))}
          onSave={() => saveJob(job.id)}
          onWhy={() => setWhy(job)}
          onApply={() => applyJob(job)}
          onStatus={status => setStatus(job.id, status)}
        />
      ))}
    </div>
  )

  return (
    <div className="pt-20 px-4 sm:px-6 pb-16 max-w-7xl mx-auto overflow-x-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Career Center</p>
      <h1 className="text-3xl sm:text-4xl font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}>
        Jobs That Match Your <span className="gradient-text">Skills</span>
      </h1>
      <p className="text-muted mb-5 max-w-2xl leading-relaxed">
        Discover opportunities based on what you have learned, built, and practiced on LearnSyra.
      </p>
      <CareerHubNav />

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-muted mb-1">🎯 Target Role</h2>
          <div className="text-2xl font-black text-ink">{targetRole}</div>
          <p className="text-sm font-bold text-primary mb-1">{careerMatch}% Career Match</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-4">LearnSyra Match · not a hiring probability</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-glass text-sm" onClick={() => setRoleOpen(true)}>Change Career Goal</button>
            <button type="button" className="btn-primary text-sm" onClick={() => navigate(`/courses?q=${encodeURIComponent(gapCourse)}`)}>Improve My Match</button>
          </div>
        </section>
        <section className={`glass rounded-3xl p-5 ${aiReady ? 'job-ai-in' : ''}`}>
          <h2 className="text-lg font-black text-ink mb-1">✨ Your Job Match</h2>
          <div className="text-4xl font-black text-ink career-count">{aiReady ? `${readyPct}%` : '…'}</div>
          <p className="text-xs font-semibold uppercase text-muted mb-2">Ready · AI Match Estimate</p>
          <p className="text-sm text-muted mb-3">You currently match {matchedSkills.length} of {Math.max(important.length, matchedSkills.length + profile.gapSkills.length)} important skills across your recommended roles.</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {matchedSkills.slice(0, 6).map(s => <span key={s} className="text-xs font-semibold" style={{ color: '#0F8A68' }}>✓ {s}</span>)}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {profile.gapSkills.map(s => <span key={s} className="job-gap text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>⚠ {s}</span>)}
          </div>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate(`/courses?q=${encodeURIComponent(gapCourse)}`)}>Close My Skill Gaps →</button>
        </section>
      </div>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-2">🤖 AI Recommendation</h2>
        {!aiReady ? (
          <p className="text-sm text-muted">Estimating your match from skills, projects, resume, and interview practice…</p>
        ) : (
          <>
            <blockquote className="text-sm text-ink mb-4 pl-3" style={{ borderLeft: '3px solid #6C5CE7' }}>
              You are strongest for junior-to-mid {targetRole} roles. Your {profile.skills.slice(0, 2).join(' and ') || 'core'} skills are strong, but {profile.gapSkills.join(' and ') || 'a few advanced topics'} are still your biggest gaps.
            </blockquote>
            <h3 className="text-sm font-bold text-ink mb-2">Recommended Strategy</h3>
            <ol className="text-sm space-y-1 mb-4 list-decimal pl-5">
              <li>Apply to high-match {targetRole} roles</li>
              <li>Complete {gapCourse} practice</li>
              <li>Add your {profile.projects[0]?.title ?? 'best project'} to your resume</li>
              <li>Complete one more technical interview</li>
            </ol>
            <button type="button" className="btn-primary text-sm" onClick={startRecommended}>Start Recommended Action →</button>
          </>
        )}
      </section>

      <div className="grid md:grid-cols-3 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">👤 Your Profile</h2>
          <ul className="text-sm space-y-1 mb-4">
            <li>{resume ? '✓' : '⚠'} Resume {resume ? 'selected' : 'not saved yet'}</li>
            <li>✓ Skills</li>
            <li>✓ Projects</li>
            <li>{interviewOk ? '✓' : '⚠'} Interview</li>
            <li>✓ Portfolio</li>
          </ul>
          <button type="button" className="btn-glass text-sm" onClick={() => navigate('/profile')}>Complete Profile →</button>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">Close This Gap</h2>
          <p className="font-bold text-ink">{gapCourse === 'Testing' ? 'Frontend Testing with Jest' : gapCourse === 'Accessibility' ? 'Accessible UI practice' : 'TypeScript for React Developers'}</p>
          <p className="text-sm text-muted">Estimated 4 hours · +8% estimated match</p>
          <button type="button" className="btn-primary text-sm mt-3" onClick={() => navigate(`/courses?q=${encodeURIComponent(gapCourse)}`)}>Start Learning →</button>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">🚀 Build This To Strengthen Your Application</h2>
          <p className="font-bold text-ink">React Admin Dashboard</p>
          <p className="text-sm text-muted">React · TypeScript · Testing · Estimated 3 hours</p>
          <button type="button" className="btn-primary text-sm mt-3" onClick={() => navigate('/projects')}>Start Project →</button>
        </section>
      </div>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-3">📌 My Job Search</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div><div className="text-2xl font-black career-count">{stats.saved}</div><div className="text-xs text-muted">Saved</div></div>
          <div><div className="text-2xl font-black career-count">{stats.applied}</div><div className="text-xs text-muted">Applied</div></div>
          <div><div className="text-2xl font-black career-count">{stats.interviews}</div><div className="text-xs text-muted">Interviews</div></div>
          <div><div className="text-2xl font-black career-count">{stats.offers}</div><div className="text-xs text-muted">Offers</div></div>
        </div>
      </section>

      {tab === 'Recommended' && (
        <div className="space-y-5 mb-6">
          <section>
            <h2 className="text-lg font-black text-ink mb-3">🎯 Best Matches For You</h2>
            {list(best)}
          </section>
          <section id="ready-to-apply">
            <h2 className="text-lg font-black text-ink mb-1">🟢 Ready To Apply</h2>
            <p className="text-sm text-muted mb-3">{fitCopy('High Match')}</p>
            {list(ready)}
          </section>
          <section>
            <h2 className="text-lg font-black text-ink mb-1">🟡 Almost Ready</h2>
            <p className="text-sm text-muted mb-3">{fitCopy('Skill Gap')}</p>
            {list(almost)}
          </section>
          <section>
            <h2 className="text-lg font-black text-ink mb-1">🚀 Stretch Opportunities</h2>
            <p className="text-sm text-muted mb-3">{fitCopy('Stretch Role')}</p>
            {list(stretch)}
          </section>
        </div>
      )}

      <div id="job-catalog" className="grid lg:grid-cols-[17rem_minmax(0,1fr)] gap-4">
        <aside className="glass rounded-3xl p-4 hidden lg:block h-fit sticky top-24">
          <h2 className="text-sm font-black text-ink mb-3">Filters</h2>
          <JobFiltersPanel filters={filters} onChange={setFilters} resetExperience={defaultExperience(snap.readinessScore)} />
        </aside>
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['Recommended', 'Saved', 'Applied'] as const).map(t => (
              <button key={t} type="button" className="job-choice px-3 py-1.5 rounded-xl text-xs font-semibold" data-on={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'Saved' ? 'Saved Jobs' : t}</button>
            ))}
            <button type="button" className="btn-glass text-xs lg:hidden" onClick={() => setFilterOpen(true)}>Filters</button>
          </div>
          <label className="block mb-3">
            <span className="sr-only">Search jobs, companies, skills</span>
            <input className="field w-full px-3 py-2 text-sm" placeholder="Search jobs, companies, skills..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm text-muted"><span className="font-bold text-ink">{filtered.length}</span> opportunities</p>
            <label className="text-sm">
              Sort
              <select className="field ml-2 text-sm px-2 py-1" value={sort} onChange={e => setSort(e.target.value as JobSort)}>
                {SORTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          {filtered.length === 0 && <p className="text-sm text-muted">No roles match these filters. Try All Matches or reset filters.</p>}
          {list(filtered, tab !== 'Recommended')}
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-[60] flex items-end lg:hidden" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setFilterOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Filters" className="job-drawer glass rounded-t-3xl p-5 w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-black text-ink mb-3">Filters</h2>
            <JobFiltersPanel filters={filters} onChange={setFilters} resetExperience={defaultExperience(snap.readinessScore)} />
            <button type="button" className="btn-primary text-sm w-full mt-4" onClick={() => setFilterOpen(false)}>Show results</button>
          </div>
        </div>
      )}

      {roleOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setRoleOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="goal-title" className="glass rounded-3xl p-6 max-w-md w-full career-modal-in" onClick={e => e.stopPropagation()}>
            <h2 id="goal-title" className="text-lg font-black text-ink mb-3">Change Career Goal</h2>
            <div className="flex flex-wrap gap-2">
              {JOB_ROLES.map(r => (
                <button key={r} type="button" className="job-choice px-3 py-2 rounded-xl text-xs font-semibold" data-on={targetRole === r} onClick={() => { setTargetRole(r); saveTargetRole(r); setRoleOpen(false) }}>{r}</button>
              ))}
            </div>
            <button type="button" className="btn-glass text-sm mt-4" onClick={() => setRoleOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {why && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setWhy(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="why-title" className="glass rounded-3xl p-6 max-w-lg w-full career-modal-in" onClick={e => e.stopPropagation()}>
            <h2 id="why-title" className="text-lg font-black text-ink mb-1">✨ AI Match Explanation</h2>
            <p className="text-2xl font-black text-primary career-count mb-1">{why.matchScore}% Match</p>
            <p className="text-xs font-semibold uppercase text-muted mb-3">LearnSyra Match · not a hiring probability</p>
            <p className="text-sm mb-1"><span className="font-bold">Strong matches:</span> {why.matchReasons.join(', ')}</p>
            <p className="text-sm mb-1"><span className="font-bold">Projects:</span> {profile.projects[0]?.title ?? 'None on file'}</p>
            <p className="text-sm mb-1"><span className="font-bold">Interview:</span> Frontend readiness {profile.interviewScore}%</p>
            <p className="text-sm mb-3"><span className="font-bold">Gap:</span> {why.skillGaps.join(', ') || 'None listed'}</p>
            <blockquote className="text-sm text-ink mb-4">You can apply now, but improving {why.skillGaps[0] || 'a remaining skill'} will increase your competitiveness.</blockquote>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => navigate(`/courses?q=${encodeURIComponent(why.skillGaps[0] || 'TypeScript')}`)}>Improve Skill</button>
              <button type="button" className="btn-glass text-sm" onClick={() => { setWhy(null); applyJob(why) }}>Apply Anyway</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setWhy(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {demoApply && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={() => setDemoApply(null)}>
          <div role="dialog" aria-modal="true" className="glass rounded-3xl p-6 max-w-md w-full career-modal-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-ink mb-2">{demoApply.externalUrl ? 'External application opened' : 'Demo application flow'}</h2>
            <p className="text-sm text-muted mb-4">
              {demoApply.externalUrl
                ? 'This listing opened an example URL. After you apply on the source, you can mark it here. LearnSyra does not submit applications for you.'
                : 'This is a mock listing with no live employer URL. You can mark it Applied for tracking practice only.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => markApplied(demoApply.id)}>Mark as Applied</button>
              <button type="button" className="btn-glass text-sm" onClick={() => navigate(`${careerResumePath()}?jobId=${demoApply.id}`)}>Tailor Resume →</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setDemoApply(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted mt-6">Listings are LearnSyra sample opportunities for career practice. Match scores are estimates, not hiring predictions.</p>
    </div>
  )
}
