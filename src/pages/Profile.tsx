import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import ProfileEditDialog from '../components/profile/ProfileEditDialog'
import ProfilePreviewDialog from '../components/profile/ProfilePreviewDialog'
import { useAuth } from '../context/AuthContext'
import { validatePasswordMatch } from '../lib/authValidation'
import {
  getCertificates,
  getCourses,
  getMyBookings,
  getMyEnrolledCourses,
  getCareerProfile,
  getMyStudentProjects,
  getProjects,
  getStudentStats,
  planLabel,
  saveCareerProfile,
  type BookingRow,
  type CareerProfile,
  type CertificateRow,
  type CourseRow,
  type ProjectRow,
  type StudentProjectRow,
} from '../lib/api'
import { kindLabel, relativeWhen } from '../lib/interviewStudio'
import { saveTargetRole } from '../lib/jobRecommendations'
import { careerInterviewPath, careerJobsPath, careerResumePath, tutorPath } from '../lib/paths'
import {
  EMPTY_EXTRAS,
  buildStudentHub,
  goalMilestones,
  initials,
  insightCopy,
  loadProfileExtras,
  saveProfileExtras,
  type ProfileExtras,
  type ProfileVisibility,
  type SavedTab,
} from '../lib/studentProfile'
import { removeProfileAvatar, uploadProfileAvatar } from '../lib/tutorAvatarUpload'
import './career-center.css'
import './student-profile.css'

const SAVED_TABS: SavedTab[] = ['Courses', 'Projects', 'Lessons', 'Jobs', 'Tutors']
const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const VIS: { id: ProfileVisibility; label: string; note: string }[] = [
  { id: 'private', label: 'Private', note: 'Only you can see this profile.' },
  { id: 'recruiter', label: 'Recruiter Ready', note: 'Professional summary only — no private contact by default.' },
  { id: 'public', label: 'Public Portfolio', note: 'Name, skills, projects, and career goal can be shared.' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { session, profile, updateProfile, updatePassword } = useAuth()
  const uid = session?.user.id ?? null
  const [extras, setExtras] = useState<ProfileExtras>({ ...EMPTY_EXTRAS })
  const [enrolled, setEnrolled] = useState<{ id: string; title: string; progress: number; last_lesson_id: string | null }[]>([])
  const [apiCourses, setApiCourses] = useState<CourseRow[]>([])
  const [apiProjects, setApiProjects] = useState<ProjectRow[]>([])
  const [studentProjects, setStudentProjects] = useState<StudentProjectRow[]>([])
  const [certs, setCerts] = useState<CertificateRow[]>([])
  const [careerProfile, setCareerProfile] = useState<CareerProfile | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [stats, setStats] = useState({ streak: 0, weekHours: 0, completedLessons: 0 })
  const [editOpen, setEditOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [savedTab, setSavedTab] = useState<SavedTab>('Courses')
  const [editName, setEditName] = useState(profile?.full_name ?? '')
  const [editHeadline, setEditHeadline] = useState(profile?.headline ?? '')
  const [editExtras, setEditExtras] = useState(extras)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    setExtras(loadProfileExtras(uid))
  }, [uid])

  useEffect(() => {
    setEditName(profile?.full_name ?? '')
    setEditHeadline(profile?.headline ?? '')
  }, [profile])

  useEffect(() => {
    let cancelled = false
    setEnrolled([])
    setStudentProjects([])
    setCerts([])
    setCareerProfile(null)
    setBookings([])
    setStats({ streak: 0, weekHours: 0, completedLessons: 0 })

    Promise.all([
      getMyEnrolledCourses().catch(() => []),
      getCourses().catch(() => []),
      getProjects().catch(() => []),
      getMyStudentProjects().catch(() => []),
      getCertificates().catch(() => []),
      getCareerProfile().catch(() => null),
      getMyBookings().catch(() => []),
      getStudentStats().catch(() => ({ streak: 0, weekHours: 0, completedLessons: 0 })),
    ]).then(([nextEnrolled, courses, projects, mine, certificates, career, books, studentStats]) => {
      if (cancelled) return
      setEnrolled(nextEnrolled)
      setApiCourses(courses)
      setApiProjects(projects)
      setStudentProjects(mine)
      setCerts(certificates)
      setCareerProfile(career)
      setBookings(books)
      setStats({ streak: studentStats.streak, weekHours: studentStats.weekHours, completedLessons: studentStats.completedLessons })
    })

    return () => {
      cancelled = true
    }
  }, [uid])

  const name = profile?.full_name || session?.user.email || 'Student'
  const hub = useMemo(
    () =>
      buildStudentHub({
        name,
        email: session?.user.email ?? '',
        avatar: profile?.avatar_url ?? null,
        headline: profile?.headline ?? null,
        extras,
        enrolled,
        apiCourses,
        apiProjects,
        studentProjects,
        certs,
        stats,
        careerProfile,
        bookings,
      }),
    [name, session?.user.email, profile?.avatar_url, profile?.headline, extras, enrolled, apiCourses, apiProjects, studentProjects, certs, stats, careerProfile, bookings],
  )

  useEffect(() => {
    if (hub.bestStreak > extras.bestStreak) {
      const next = { ...extras, bestStreak: hub.bestStreak }
      setExtras(next)
      saveProfileExtras(next, uid)
    }
  }, [hub.bestStreak, extras, uid])

  useEffect(() => {
    if (!editOpen && !previewOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditOpen(false)
        setPreviewOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editOpen, previewOpen])

  const persistExtras = (next: ProfileExtras) => {
    setExtras(next)
    saveProfileExtras(next, uid)
    if (next.targetRole) saveTargetRole(next.targetRole)
  }

  const saveEdits = async () => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    const { error } = await updateProfile({
      full_name: editName.trim(),
      headline: editHeadline.trim() || null,
    })
    persistExtras(editExtras)
    if (editExtras.targetRole) {
      await saveCareerProfile({ target_role: editExtras.targetRole }).catch(() => ({ error: null }))
    }
    setBusy(false)
    if (error) setErr(error)
    else {
      setMsg('Profile saved.')
      setEditOpen(false)
    }
  }

  const changePassword = async () => {
    setErr(null)
    setMsg(null)
    const validation = validatePasswordMatch(password, confirm)
    if (validation) {
      setErr(validation)
      return
    }
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) setErr(error)
    else {
      setPassword('')
      setConfirm('')
      setMsg('Password updated.')
    }
  }

  const completeNext = () => {
    if (!hub.nextStep || hub.nextStep.id === 'basic' || hub.nextStep.id === 'portfolio') {
      setEditName(profile?.full_name ?? '')
      setEditHeadline(profile?.headline ?? '')
      setEditExtras(hub.extras)
      setEditOpen(true)
      return
    }
    navigate(hub.nextStep.href)
  }

  const validateAvatarFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const extOk = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp'
    if (!AVATAR_TYPES.has(file.type) && !extOk) {
      return 'Please choose a JPG, PNG, or WebP image under 5 MB.'
    }
    if (file.size > 5 * 1024 * 1024) return 'Image must be under 5 MB.'
    return null
  }

  const onAvatarSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !uid) return
    const validation = validateAvatarFile(file)
    if (validation) {
      setErr(validation)
      setMsg(null)
      return
    }

    setAvatarBusy(true)
    setErr(null)
    setMsg(null)
    const localPreview = URL.createObjectURL(file)
    setPhotoPreview(localPreview)

    const { url, error: uploadError } = await uploadProfileAvatar(uid, file)
    URL.revokeObjectURL(localPreview)

    if (uploadError || !url) {
      setPhotoPreview(null)
      setAvatarBusy(false)
      setErr(uploadError || 'Could not upload photo.')
      return
    }

    const { error: profileError } = await updateProfile({ avatar_url: url })
    setPhotoPreview(null)
    setAvatarBusy(false)
    if (profileError) {
      setErr(profileError)
      return
    }
    setMsg('Profile photo updated.')
  }

  const removeAvatarPhoto = async () => {
    if (!uid) return
    setAvatarBusy(true)
    setErr(null)
    setMsg(null)
    setPhotoPreview(null)

    const { error: removeError } = await removeProfileAvatar(uid)
    if (removeError) {
      setAvatarBusy(false)
      setErr(removeError)
      return
    }

    const { error: profileError } = await updateProfile({ avatar_url: null })
    setAvatarBusy(false)
    if (profileError) setErr(profileError)
    else setMsg('Profile photo removed.')
  }

  const displayAvatar = photoPreview || profile?.avatar_url || hub.avatar

  const maxHours = Math.max(...hub.activityWeek.map(d => d.hours), 0.1)
  const milestones = goalMilestones(hub)
  const savedItems = hub.saved[savedTab]
  const vis = hub.extras.visibility

  return (
    <div className="pt-20 px-4 sm:px-6 pb-16 max-w-6xl mx-auto overflow-x-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Student identity</p>
      <h1 className="text-3xl sm:text-4xl font-black text-ink mb-6" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}>
        Your <span className="gradient-text">Profile</span>
      </h1>

      <section className="glass rounded-3xl p-5 sm:p-7 mb-5 sp-hero">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="sp-avatar-wrap">
            <button
              type="button"
              className="sp-avatar-btn w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarBusy}
              aria-label={displayAvatar ? 'Change profile photo' : 'Upload profile photo'}
            >
              {displayAvatar ? (
                <img src={displayAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(hub.name)
              )}
              <span className="sp-avatar-edit" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
              {avatarBusy && <span className="sp-avatar-busy">…</span>}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept={AVATAR_ACCEPT}
              className="sr-only"
              onChange={onAvatarSelected}
              disabled={avatarBusy}
            />
            {(profile?.avatar_url || photoPreview) && (
              <button
                type="button"
                className="btn-glass text-xs mt-2 w-full sm:w-auto"
                disabled={avatarBusy}
                onClick={() => void removeAvatarPhoto()}
              >
                Remove photo
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{hub.name}</h2>
            <p className="text-sm text-muted">{hub.headline}</p>
            <p className="text-base font-bold text-ink mt-1">{hub.targetRole || 'Choose a career goal to get started'}</p>
            <p className="text-sm font-bold text-primary">
              {hub.careerMatch > 0 ? `${hub.careerMatch}% Career Match` : 'Match appears after you add real skills and projects'}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="badge badge-primary capitalize">{profile?.role ?? 'student'}</span>
              <span className="badge badge-amber">{planLabel(profile?.plan)}</span>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase text-muted">Profile Strength</p>
            <p className="text-3xl font-black career-count text-ink">{hub.completion}%</p>
            <p className="text-xs text-muted mb-3">Complete</p>
            <div className="progress-bar w-36 sm:ml-auto mb-3" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${hub.completion}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button type="button" className="btn-glass text-sm" onClick={() => { setEditName(profile?.full_name ?? ''); setEditHeadline(profile?.headline ?? ''); setEditExtras(hub.extras); setEditOpen(true) }}>Edit Profile</button>
              <button type="button" className="btn-primary text-sm" onClick={() => navigate('/career')}>View Career →</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setPreviewOpen(true)}>Preview Profile</button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          ['Courses Completed', hub.stats.courses],
          ['Projects', hub.stats.projects],
          ['Skills', hub.stats.skills],
          ['Achievements', hub.stats.achievements],
          ['Interviews', hub.stats.interviews],
        ].map(([label, n]) => (
          <div key={String(label)} className="glass rounded-2xl p-4 text-center sp-stat">
            <div className="text-2xl font-black career-count text-ink">{n}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">Complete Your Profile</h2>
          <p className="text-3xl font-black career-count mb-2">{hub.completion}%</p>
          <div className="progress-bar mb-4" role="progressbar" aria-valuenow={hub.completion} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
            <div className="progress-fill" style={{ width: `${hub.completion}%` }} />
          </div>
          <ul className="text-sm space-y-1 mb-4">
            {hub.checklist.map(c => (
              <li key={c.id}>{c.done ? '✓' : '⚠'} {c.label}</li>
            ))}
          </ul>
          <button type="button" className="btn-primary text-sm" onClick={completeNext}>Complete Next Step →</button>
        </section>

        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">📚 My Learning</h2>
          {hub.currentCourse ? (
            <>
              <p className="font-bold text-ink">{hub.currentCourse.title}</p>
              <p className="text-sm text-muted mb-2">
                {hub.currentCourse.total > 0
                  ? `${hub.currentCourse.done} / ${hub.currentCourse.total} lessons · ${hub.currentCourse.progress}%`
                  : `${hub.currentCourse.progress}% complete`}
              </p>
              <div className="progress-bar mb-4" aria-hidden="true"><div className="progress-fill" style={{ width: `${hub.currentCourse.progress}%` }} /></div>
              <button type="button" className="btn-primary text-sm" onClick={() => navigate(hub.currentCourse!.href)}>Continue Learning →</button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted mb-4">You haven't enrolled in any courses yet</p>
              <button type="button" className="btn-primary text-sm" onClick={() => navigate('/courses')}>Browse courses</button>
            </>
          )}
        </section>
      </div>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-1">⏱ Learning Activity</h2>
        <p className="text-sm text-muted mb-3">{hub.weekHours} hours this week</p>
        <div className="sp-week mb-2" aria-hidden="true">
          {hub.activityWeek.map(d => (
            <div key={d.label} className="flex flex-col justify-end h-full">
              <div className="sp-week-bar" data-empty={d.hours <= 0 ? 'true' : 'false'} style={{ height: d.hours > 0 ? `${Math.max(8, (d.hours / maxHours) * 100)}%` : '0%' }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted mb-3">
          {hub.activityWeek.map(d => <span key={d.label}>{d.label}</span>)}
        </div>
        <p className="text-sm">Current streak <span className="font-bold">{hub.streak} days</span> · Best streak <span className="font-bold">{hub.bestStreak} days</span></p>
      </section>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-4">🧬 Skill DNA</h2>
        {hub.skills.length === 0 ? (
          <p className="text-sm text-muted">Skills appear after you complete courses, projects, or assessments.</p>
        ) : (
        <div className="space-y-3">
          {hub.skills.map(s => (
            <div key={s.name}>
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="font-bold text-ink">{s.name}</span>
                <span className="text-muted">{s.score}% · {s.level}</span>
              </div>
              <div className="progress-bar mt-1" aria-hidden="true"><div className="progress-fill" style={{ width: `${s.score}%` }} /></div>
              <p className="text-xs text-muted mt-1">{s.verified ? `Verified through: ${s.source}` : s.source}</p>
            </div>
          ))}
        </div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">✓ LearnSyra Verified Skills</h2>
          {hub.verified.length === 0 && <p className="text-sm text-muted">No verified skills yet. Complete a course or project to verify a skill.</p>}
          <div className="flex flex-wrap gap-2">
            {hub.verified.map(s => (
              <span key={s.name} className="badge badge-green text-xs">✓ {s.name}</span>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">Verified only from LearnSyra course, project, assessment, or interview activity — not an external certificate.</p>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">🎯 Skills To Improve</h2>
          {hub.gaps.length === 0 ? (
            <p className="text-sm text-muted">Set a target role to see personalized recommendations.</p>
          ) : hub.gaps.map(g => (
            <div key={g.name} className="mb-4">
              <div className="flex justify-between text-sm font-bold">
                <span>{g.name}</span>
                <span>{g.score}% → {g.target}%</span>
              </div>
              <p className="text-xs text-muted mb-2">Gap: {Math.max(0, g.target - g.score)} points</p>
              <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/courses?q=${encodeURIComponent(g.courseQuery)}`)}>
                Improve Skill →
              </button>
            </div>
          ))}
        </section>
      </div>

      <section className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
          <h2 className="text-lg font-black text-ink">🚀 My Projects</h2>
          <button type="button" className="text-sm font-semibold text-primary" onClick={() => navigate('/projects')}>View All Projects →</button>
        </div>
        <p className="text-sm text-muted mb-3">{hub.projectStats.completed} Completed · {hub.projectStats.portfolio} Portfolio Ready · {hub.projectStats.review} Needs Review</p>
        {hub.projects.length === 0 ? (
          <p className="text-sm text-muted">Complete a project to add it to your portfolio.</p>
        ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {hub.projects.map(p => (
            <article key={p.id} className="glass rounded-2xl p-5 career-card">
              <h3 className="font-black text-ink">{p.title}</h3>
              <p className="text-sm text-muted">{p.score} / 100 · {p.skills.join(' · ')}</p>
              <p className="text-xs font-semibold text-primary mt-1">{p.status}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className="btn-primary text-xs" onClick={() => navigate(p.href)}>View Project →</button>
                <button type="button" className="btn-glass text-xs" onClick={() => navigate(p.workspace)}>Open Workspace →</button>
              </div>
            </article>
          ))}
        </div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-1">💼 Portfolio</h2>
          <p className="text-3xl font-black career-count">{hub.portfolioReady}% Ready</p>
          <ul className="text-sm space-y-1 my-3">
            {hub.portfolioChecks.map(c => <li key={c.label}>{c.ok ? '✓' : '⚠'} {c.label}</li>)}
          </ul>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate('/projects')}>Manage Portfolio →</button>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">📄 My Resume</h2>
          {hub.resume ? (
            <>
              <p className="font-bold">{hub.resume.name}</p>
              <p className="text-sm">Resume Readiness: <span className="font-bold">{hub.resume.score}%</span></p>
              <p className="text-sm">Job Match: <span className="font-bold">{hub.resume.jobMatch}%</span></p>
              <p className="text-xs text-muted mb-3">Updated: {hub.resume.updated}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => navigate(careerResumePath())}>Edit Resume →</button>
                <button type="button" className="btn-glass text-sm" onClick={() => navigate(careerResumePath())}>Preview Resume →</button>
              </div>
            </>
          ) : (
            <button type="button" className="btn-primary text-sm" onClick={() => navigate(careerResumePath())}>Create Resume →</button>
          )}
        </section>
      </div>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-1">🎯 Career Progress</h2>
        <p className="text-3xl font-black career-count mb-3">{hub.readiness}%</p>
        {[
          ['Skills', hub.career.skillScore],
          ['Projects', hub.career.projectScore],
          ['Resume', hub.career.resumeScore],
          ['Interview', hub.career.interviewScore],
          ['Communication', hub.career.communicationScore],
        ].map(([label, val]) => (
          <div key={String(label)} className="mb-2">
            <div className="flex justify-between text-sm"><span>{label}</span><span className="font-bold">{val}%</span></div>
            <div className="progress-bar" aria-hidden="true"><div className="progress-fill" style={{ width: `${Number(val)}%` }} /></div>
          </div>
        ))}
        <button type="button" className="btn-primary text-sm mt-3" onClick={() => navigate('/career')}>Open Career Center →</button>
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">🎤 Interview Performance</h2>
          {hub.interviewTrend.length > 1 && (
            <p className="text-sm font-semibold text-primary mb-3">{hub.interviewTrend.join(' → ')}</p>
          )}
          {hub.interviews.length === 0 ? (
            <p className="text-sm text-muted mb-4">Complete an interview to track interview readiness.</p>
          ) : (
          <div className="space-y-3 mb-4">
            {hub.interviews.map(iv => (
              <article key={iv.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(108,92,231,0.06)' }}>
                <div className="font-bold text-sm">{iv.role}</div>
                <div className="text-xs text-muted">{kindLabel(iv.type)} · {iv.score} / 100 · {relativeWhen(iv.completedAt)}</div>
              </article>
            ))}
          </div>
          )}
          <button type="button" className="btn-primary text-sm" onClick={() => navigate(careerInterviewPath())}>Practice Interview →</button>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">👨‍🏫 Tutor Learning</h2>
          {hub.tutor ? (
            <>
              <p className="font-bold">{hub.tutor.name}</p>
              <p className="text-sm">{hub.tutor.session}</p>
              <p className="text-sm text-muted">
                {hub.tutor.minutes > 0 ? `${hub.tutor.minutes} minutes · ` : ''}
                {hub.tutor.rating > 0 ? `Rating ${hub.tutor.rating} / 5 · ` : ''}
                {hub.tutor.status}
              </p>
              {hub.tutor.summary && <p className="text-sm mt-2 mb-4">AI summary: "{hub.tutor.summary}"</p>}
              <div className="flex flex-wrap gap-2 mt-4">
                {hub.tutor.sessionHref && (
                  <button type="button" className="btn-primary text-sm" onClick={() => navigate(hub.tutor!.sessionHref!)}>View Session →</button>
                )}
                <button type="button" className="btn-glass text-sm" onClick={() => navigate(hub.tutor!.bookHref)}>Book Follow-up →</button>
                <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorPath(hub.tutor!.tutorId))}>Tutor profile</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted mb-4">Book your first tutor session</p>
              <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutors')}>Browse Tutors →</button>
            </>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">📚 Completed Courses</h2>
          {hub.completedCourses.length === 0 && <p className="text-sm text-muted">No 100% completions yet. Progress is tracked from your LearnSyra enrollments.</p>}
          {hub.completedCourses.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="font-bold text-sm">{c.title}</p>
                <p className="text-xs text-muted">LearnSyra Completion</p>
              </div>
              <button type="button" className="btn-glass text-xs" onClick={() => navigate(c.href)}>View Course →</button>
            </div>
          ))}
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">🎓 LearnSyra Completions</h2>
          {hub.completions.length === 0 ? (
            <p className="text-sm text-muted">Complete your first course to start building your career profile.</p>
          ) : hub.completions.map(c => (
            <div key={c.title} className="rounded-xl px-3 py-2 mb-2" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <p className="font-bold text-sm">{c.title}</p>
              <p className="text-xs text-muted">Completed {c.completed} · {c.official ? 'Official certificate on file' : 'LearnSyra Completion'}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-3">🏆 Achievements</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {hub.achievements.map(a => (
            <div key={a.id} className={`glass rounded-2xl p-4 career-card sp-ach ${a.earned ? '' : 'sp-lock'}`} title={a.hint}>
              <p className="font-bold text-sm">{a.earned ? a.label : `Locked · ${a.label}`}</p>
              <p className="text-xs text-muted mt-1">{a.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-3">🔖 Saved</h2>
        <div className="sp-saved flex gap-2 mb-3" role="tablist" aria-label="Saved items">
          {SAVED_TABS.map(t => (
            <button key={t} type="button" role="tab" aria-selected={savedTab === t} className="sp-choice px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap" data-on={savedTab === t} onClick={() => setSavedTab(t)}>{t}</button>
          ))}
        </div>
        {savedItems.length === 0 && <p className="text-sm text-muted">Nothing saved in {savedTab} yet.</p>}
        <ul className="space-y-2">
          {savedItems.map(item => (
            <li key={item.id}>
              <button type="button" className="text-left w-full" onClick={() => navigate(item.href)}>
                <span className="text-sm font-bold text-ink">{item.title}</span>
                {item.detail && <span className="block text-xs text-muted">{item.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">💼 Job Search</h2>
          <div className="grid grid-cols-2 gap-2 text-center mb-3">
            <div><div className="text-xl font-black career-count">{hub.jobs.saved}</div><div className="text-xs text-muted">Saved</div></div>
            <div><div className="text-xl font-black career-count">{hub.jobs.applied}</div><div className="text-xs text-muted">Applied</div></div>
            <div><div className="text-xl font-black career-count">{hub.jobs.interviews}</div><div className="text-xs text-muted">Interviews</div></div>
            <div><div className="text-xl font-black career-count">{hub.jobs.offers}</div><div className="text-xs text-muted">Offers</div></div>
          </div>
          <p className="text-sm">Target: <span className="font-bold">{hub.targetRole || 'Choose a career goal to get started'}</span></p>
          <p className="text-sm mb-3">
            Best Match:{' '}
            <span className="font-bold">
              {hub.jobs.bestMatch > 0 ? `${hub.jobs.bestMatch}% LearnSyra Match` : 'Not personalized yet'}
            </span>
          </p>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate(careerJobsPath())}>View Job Matches →</button>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">📈 Recent Activity</h2>
          {hub.activity.length === 0 ? (
            <p className="text-sm text-muted">No career activity yet.</p>
          ) : (
          <ul className="space-y-2">
            {hub.activity.map((a, i) => (
              <li key={`${a.when}-${i}`} className="text-sm">
                <span className="font-semibold text-muted">{a.when}</span>
                <span className="block text-ink">{a.text}{a.meta ? ` · ${a.meta}` : ''}</span>
              </li>
            ))}
          </ul>
          )}
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-1">⭐ LearnSyra Progress</h2>
          <p className="text-3xl font-black career-count">{hub.xp.total.toLocaleString()} XP</p>
          <p className="text-sm font-bold">{hub.xp.levelName} — Level {hub.xp.level}</p>
          <p className="text-xs text-muted mb-2">{hub.xp.intoLevel} / {hub.xp.levelNeed}</p>
          <div className="progress-bar mb-3" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${Math.round((hub.xp.intoLevel / hub.xp.levelNeed) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted">Sources: course completion, project completion, interview, tutor session.</p>
        </section>
        <section className="glass rounded-3xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">🎯 Current Goal</h2>
          <p className="font-bold mb-1">
            {hub.targetRole ? `Become a Job-Ready ${hub.targetRole}` : 'Choose a career goal to get started'}
          </p>
          <p className="text-sm text-muted mb-3">
            {hub.careerMatch > 0 ? `${hub.careerMatch}% toward this goal` : 'Personalized progress appears after you add real skills and projects.'}
          </p>
          <ul className="text-sm space-y-1 mb-4">
            {milestones.map(m => <li key={m.name}>{m.done ? '✓' : '○'} {m.name}</li>)}
          </ul>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate('/career')}>View Career Plan →</button>
        </section>
      </div>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-2">✨ LearnSyra Career Insight</h2>
        <blockquote className="text-sm text-ink mb-4 pl-3" style={{ borderLeft: '3px solid #6C5CE7' }}>{insightCopy(hub)}</blockquote>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => navigate(hub.gaps[0]?.name ? `/projects?q=${encodeURIComponent(hub.gaps[0].name)}` : '/projects')}
        >
          {hub.gaps[0]?.name ? `Explore ${hub.gaps[0].name} projects →` : 'Browse projects →'}
        </button>
      </section>

      <section className="glass rounded-3xl p-5 mb-5">
        <h2 className="text-lg font-black text-ink mb-2">🔒 Profile Visibility</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {VIS.map(v => (
            <button
              key={v.id}
              type="button"
              className="sp-choice px-3 py-2 rounded-xl text-xs font-semibold"
              data-on={vis === v.id}
              aria-pressed={vis === v.id}
              onClick={() => persistExtras({ ...hub.extras, visibility: v.id })}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{VIS.find(v => v.id === vis)?.note}</p>
        <p className="text-xs text-muted mt-2">Private email, phone, tutor sessions, AI conversations, notes, and internal analytics are never shown by default.</p>
      </section>

      <section className="glass rounded-2xl p-6 mb-5">
        <h2 className="text-base font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Account password</h2>
        <label className="sr-only" htmlFor="new-pass">New password</label>
        <input id="new-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" className="field w-full mb-3 px-3 py-2 text-sm" />
        <label className="sr-only" htmlFor="confirm-pass">Confirm password</label>
        <input id="confirm-pass" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" className="field w-full mb-4 px-3 py-2 text-sm" />
        <button type="button" className="btn-glass text-sm" disabled={busy} onClick={changePassword}>Update password</button>
      </section>

      {(msg || err) && (
        <p className="text-sm" role="status" style={{ color: err ? '#E11D48' : '#0F8A68' }}>{err ?? msg}</p>
      )}

      {editOpen && (
        <ProfileEditDialog
          name={editName}
          headline={editHeadline}
          email={session?.user.email ?? ''}
          extras={editExtras}
          busy={busy}
          onName={setEditName}
          onHeadline={setEditHeadline}
          onExtras={setEditExtras}
          onClose={() => setEditOpen(false)}
          onSave={saveEdits}
        />
      )}
      {previewOpen && <ProfilePreviewDialog hub={hub} onClose={() => setPreviewOpen(false)} />}
    </div>
  )
}
