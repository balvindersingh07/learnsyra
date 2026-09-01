import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validatePasswordMatch } from '../lib/authValidation'
import { getProjects, getTutorBookings, getTutorCourses, getTutorStudents, type CourseRow } from '../lib/api'
import { formatInr } from '../lib/courseCatalog'
import { tutorBookPath, tutorPath } from '../lib/paths'
import { buildProjectCatalog } from '../lib/projectWorkspace'
import { displayInitials } from '../lib/roleAccess'
import {
  ADVANCE_OPTIONS,
  BUFFER_OPTIONS,
  LANGUAGE_OPTIONS,
  LANG_LEVELS,
  NOTICE_OPTIONS,
  ONBOARDING_STEPS,
  PRIMARY_CATEGORIES,
  SESSION_DURATIONS,
  SKILL_LEVELS,
  SUGGESTED_SKILLS,
  TEACHING_STYLE_TAGS,
  WEEKDAYS,
  coachTips,
  emptyHub,
  hasValidProfilePhoto,
  loadOrCreateHub,
  nextOnboardingTarget,
  profileStrength,
  publishBlockers,
  saveTutorHub,
  shouldShowOnboarding,
  suggestHeadline,
  suggestPhilosophy,
  uid,
  verifyLabel,
  type CredentialItem,
  type EducationItem,
  type ProfileVisibility,
  type SkillLevel,
  type TeachingFormat,
  type TeachingStyleTag,
  type TutorHub,
  type TutorLanguage,
  type VideoStatus,
} from '../lib/tutorProfile'
import { uploadTutorAvatar } from '../lib/tutorAvatarUpload'
import { mergeListingProfileIntoHub, syncTutorListingProfile } from '../lib/tutorListingProfile'
import { syncPublishedTutorPricing, syncTutorListingAvailability } from '../lib/tutorSessionOffers'
import './tutor-profile.css'

const FORMATS: TeachingFormat[] = ['1-on-1', 'Group Classes', 'Courses', 'Project Mentoring', 'Interview Preparation']

type ProfileSection = 'basic' | 'expertise' | 'sessions' | 'availability' | 'content' | 'verification' | 'publish' | 'account'

const PROFILE_SECTIONS: { id: ProfileSection; label: string; hint: string }[] = [
  { id: 'basic', label: 'Basic Profile', hint: 'Headline, bio, location, and languages' },
  { id: 'expertise', label: 'Expertise & Experience', hint: 'Skills, teaching background, credentials' },
  { id: 'sessions', label: 'Sessions & Pricing', hint: 'Bookable sessions, rates, duration' },
  { id: 'availability', label: 'Availability', hint: 'Weekly schedule students can book' },
  { id: 'content', label: 'Content & Portfolio', hint: 'Video, projects, courses' },
  { id: 'verification', label: 'Verification', hint: 'Email, identity, credentials' },
  { id: 'publish', label: 'Publish & Visibility', hint: 'Readiness, publish, discovery' },
  { id: 'account', label: 'Account', hint: 'Password and account settings' },
]

const SECTION_STORAGE_KEY = 'learnsyra_tutor_profile_section'

function sectionComplete(id: ProfileSection, hub: TutorHub): boolean {
  switch (id) {
    case 'basic':
      return (
        hasValidProfilePhoto(hub) &&
        hub.identity.headline.trim().length > 3 &&
        hub.bio.trim().length >= 20 &&
        hub.languages.length > 0
      )
    case 'expertise':
      return hub.skills.length > 0 && (hub.teachingStyles.length > 0 || hub.teachingPhilosophy.trim().length > 8)
    case 'sessions':
      return hub.sessionOffers.some(s => s.enabled && s.hourlyRate > 0)
    case 'availability':
      return hub.availability.some(d => d.enabled)
    case 'content':
      return Boolean(hub.introVideoUrl.trim()) || hub.portfolioProjectIds.length > 0 || hub.publicCourses.length > 0
    case 'verification':
      return hub.verification.identity === 'verified' || hub.verification.submittedAt != null
    case 'publish':
      return hub.visibility === 'published' && publishBlockers(hub).length === 0
    case 'account':
      return true
    default:
      return false
  }
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="text-xs font-semibold text-muted block mb-1">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-subtle mt-1">{hint}</p> : null}
    </div>
  )
}

function Chip({
  on,
  children,
  onClick,
}: {
  on: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="tp-chip rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer"
      data-on={on}
      aria-pressed={on}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Check({ done, warn }: { done: boolean; warn?: boolean }) {
  return (
    <span
      className="tp-check"
      style={{
        background: done ? 'rgba(32,201,151,0.18)' : warn ? 'rgba(245,158,11,0.16)' : 'rgba(152,162,179,0.16)',
        color: done ? '#0F8A68' : warn ? '#B45309' : '#667085',
      }}
      aria-hidden
    >
      {done ? '✓' : warn ? '⚠' : '○'}
    </span>
  )
}

export default function TutorAccount() {
  const { session, profile, updateProfile, updatePassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = session?.user.id || profile?.id || null
  const email = session?.user.email || ''
  const [hub, setHub] = useState<TutorHub>(() =>
    emptyHub('__awaiting_auth__', {
      name: profile?.full_name || email || 'Tutor',
      headline: profile?.headline || '',
      avatarUrl: profile?.avatar_url || null,
      email,
    }),
  )
  const [skillQuery, setSkillQuery] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([])
  const [courses, setCourses] = useState<(CourseRow & { students: number })[]>([])
  const [onboarding, setOnboarding] = useState(false)
  const [activeSection, setActiveSection] = useState<ProfileSection>(() => {
    try {
      const saved = sessionStorage.getItem(SECTION_STORAGE_KEY) as ProfileSection | null
      if (saved && PROFILE_SECTIONS.some(s => s.id === saved)) return saved
    } catch {
      /* ignore */
    }
    return 'basic'
  })
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const base = loadOrCreateHub(userId, {
      name: profile?.full_name || email || 'Tutor',
      headline: profile?.headline || '',
      avatarUrl: profile?.avatar_url || null,
      email,
    })
    mergeListingProfileIntoHub(base).then(merged => {
      if (!cancelled) {
        setHub(merged)
        setOnboarding(shouldShowOnboarding(merged))
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!userId || (!profile && !email)) return
    setHub(h => h ? ({
      ...h,
      identity: {
        name: h.identity.name || profile?.full_name || email || 'Tutor',
        headline: h.identity.headline || profile?.headline || '',
        avatarUrl: h.identity.avatarUrl || profile?.avatar_url || null,
        email: email || h.identity.email,
      },
    }) : h)
  }, [userId, profile?.full_name, profile?.headline, profile?.avatar_url, email])

  useEffect(() => {
    if (!userId || hub.userId !== userId) return
    saveTutorHub(hub)
  }, [hub, userId])

  useEffect(() => {
    if (!previewOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewOpen])

  useEffect(() => {
    try {
      sessionStorage.setItem(SECTION_STORAGE_KEY, activeSection)
    } catch {
      /* ignore */
    }
  }, [activeSection])

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (!hash) return
    const hashToSection: Record<string, ProfileSection> = {
      about: 'basic',
      photo: 'basic',
      languages: 'basic',
      expertise: 'expertise',
      experience: 'expertise',
      style: 'expertise',
      'session-types': 'sessions',
      pricing: 'sessions',
      prefs: 'sessions',
      availability: 'availability',
      'intro-video': 'content',
      portfolio: 'content',
      courses: 'content',
      verification: 'verification',
      publish: 'publish',
      visibility: 'publish',
      settings: 'account',
    }
    const next = hashToSection[hash]
    if (next) setActiveSection(next)
  }, [location.hash])

  useEffect(() => {
    getTutorCourses()
      .then(rows => {
        setCourses(rows)
        setHub(h => h ? ({
          ...h,
          publicCourses: rows.map(c => ({
            title: c.title,
            href: `/courses/${c.id}`,
            students: c.students,
            rating: Number(c.rating) || undefined,
            published: c.published,
            completion: null,
          })),
          platformCache: {
            ...h.platformCache,
            courseCount: rows.length,
            rating: rows.length ? rows.reduce((s, c) => s + Number(c.rating || 0), 0) / rows.length : null,
          },
        }) : h)
      })
      .catch(() => setCourses([]))
    getTutorStudents()
      .then(rows => {
        setHub(h => h ? ({ ...h, platformCache: { ...h.platformCache, students: rows.length } }) : h)
      })
      .catch(() => {})
    getTutorBookings()
      .then(() => {})
      .catch(() => {})
    getProjects()
      .then(rows => setProjects(buildProjectCatalog(rows).map(p => ({ id: p.id, title: p.title }))))
      .catch(() => setProjects(buildProjectCatalog([]).map(p => ({ id: p.id, title: p.title }))))
  }, [userId])

  const strength = profileStrength(hub)
  const blockers = publishBlockers(hub)
  const tips = coachTips(hub)
  const name = hub.identity.name || email || 'Tutor'
  const initials = displayInitials(name)
  const publicUrl = `${window.location.origin}${tutorPath(hub.publicId)}`
  const suggestedSkills = SUGGESTED_SKILLS.filter(
    s => s.toLowerCase().includes(skillQuery.toLowerCase()) && !hub.skills.some(x => x.name.toLowerCase() === s.toLowerCase()),
  )

  const patch = (partial: Partial<TutorHub> | ((prev: TutorHub) => TutorHub)) => {
    setHub(prev => {
      const next = typeof partial === 'function' ? partial(prev) : { ...prev, ...partial }
      return next
    })
  }

  const persist = async (next = hub, notify = true) => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    const withProjects = {
      ...next,
      publicProjects: projects
        .filter(p => next.portfolioProjectIds.includes(p.id))
        .map(p => ({ title: p.title, href: `/projects/${p.id}` })),
      identity: {
        ...next.identity,
        name: next.identity.name.trim() || name,
      },
      introVideoStatus: (next.introVideoUrl.trim()
        ? next.introVideoStatus === 'not_added'
          ? 'added'
          : next.introVideoStatus
        : 'not_added') as VideoStatus,
    }
    saveTutorHub(withProjects)
    setHub(withProjects)
    const avatar = withProjects.identity.avatarUrl
    const skipRemoteAvatar = Boolean(avatar && avatar.startsWith('data:'))
    const { error } = await updateProfile({
      full_name: withProjects.identity.name.trim(),
      headline: withProjects.identity.headline.trim() || null,
      avatar_url: skipRemoteAvatar ? profile?.avatar_url ?? null : avatar,
    })
    let pricingError: string | null = null
    let listingProfileError: string | null = null
    if (!error) {
      if (withProjects.visibility === 'published') {
        const sync = await syncPublishedTutorPricing(withProjects)
        pricingError = sync.error
      } else {
        const sync = await syncTutorListingAvailability(withProjects.userId, false)
        pricingError = sync.error
      }
      if (!pricingError) {
        const profileSync = await syncTutorListingProfile(withProjects)
        listingProfileError = profileSync.error
      }
    }
    setBusy(false)
    if (error) setErr(error)
    else if (pricingError) setErr(pricingError)
    else if (listingProfileError) setErr(listingProfileError)
    else if (notify) setMsg('Tutor profile saved. Public profile and booking use this data when published.')
    return !error && !pricingError && !listingProfileError
  }

  const goNextMissing = () => {
    const id = strength.next?.id
    const map: Record<string, ProfileSection> = {
      basic: 'basic',
      headline: 'basic',
      bio: 'basic',
      photo: 'basic',
      expertise: 'expertise',
      teaching: 'expertise',
      sessions: 'sessions',
      pricing: 'sessions',
      availability: 'availability',
      video: 'content',
      portfolio: 'content',
    }
    setOnboarding(false)
    setActiveSection(map[id ?? ''] || 'basic')
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setMsg('Profile link copied.')
    } catch {
      setMsg(publicUrl)
    }
  }

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    e.target.value = ''
    setBusy(true)
    setErr(null)
    setMsg(null)
    const previousAvatar = hub.identity.avatarUrl
    const localPreview = URL.createObjectURL(file)
    setPhotoPreview(localPreview)
    patch({ identity: { ...hub.identity, avatarUrl: localPreview } })
    const { url, error: uploadError } = await uploadTutorAvatar(userId, file)
    URL.revokeObjectURL(localPreview)
    setPhotoPreview(null)
    if (uploadError || !url) {
      patch({ identity: { ...hub.identity, avatarUrl: previousAvatar } })
      setBusy(false)
      setErr(uploadError || 'Could not upload photo.')
      return
    }
    const next = {
      ...hub,
      identity: { ...hub.identity, avatarUrl: url },
    }
    setHub(next)
    saveTutorHub(next)
    const { error: profileError } = await updateProfile({ avatar_url: url })
    const profileSync = await syncTutorListingProfile(next)
    setBusy(false)
    if (profileError) setErr(profileError)
    else if (profileSync.error) setErr(profileSync.error)
    else setMsg('Profile photo updated.')
  }

  const removePhoto = async () => {
    const next = { ...hub, identity: { ...hub.identity, avatarUrl: null } }
    patch({ identity: { ...hub.identity, avatarUrl: null } })
    setBusy(true)
    const { error: profileError } = await updateProfile({ avatar_url: null })
    const profileSync = await syncTutorListingProfile(next)
    setBusy(false)
    if (profileError) setErr(profileError)
    else if (profileSync.error) setErr(profileSync.error)
    else setMsg('Profile photo removed.')
  }

  const displayAvatar = photoPreview || hub.identity.avatarUrl

  const addSkill = (raw: string) => {
    const name = raw.trim()
    if (!name || hub.skills.some(s => s.name.toLowerCase() === name.toLowerCase())) return
    const primary = hub.skills.length === 0
    patch({ skills: [...hub.skills, { name, level: 'Intermediate', primary }] })
    setSkillQuery('')
  }

  const addEducation = () => {
    const row: EducationItem = { id: uid('edu'), degree: '', institution: '', field: '', year: '', status: 'not_verified' }
    patch({ education: [...hub.education, row] })
  }

  const addCredential = () => {
    const row: CredentialItem = { id: uid('cred'), name: '', org: '', credentialId: '', url: '', status: 'not_verified' }
    patch({ credentials: [...hub.credentials, row] })
  }

  const publish = async () => {
    if (blockers.length) {
      setErr(`Add ${blockers.join(', ')} before publishing.`)
      return
    }
    const next = { ...hub, visibility: 'published' as const, onboarding: { ...hub.onboarding, completed: true } }
    await persist(next)
    setMsg('Profile published. Students can discover you in the tutor marketplace.')
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

  const identityVerified = hub.verification.identity === 'verified'
  const emailVerified = Boolean(email)

  const photoUploadActions = (
    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
      <label className="btn-primary text-xs cursor-pointer">
        {hasValidProfilePhoto(hub) || displayAvatar ? 'Change Photo' : 'Upload Photo'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={onPhoto}
          disabled={busy}
        />
      </label>
      {(hasValidProfilePhoto(hub) || displayAvatar) && !photoPreview ? (
        <button type="button" className="btn-glass text-xs" disabled={busy} onClick={removePhoto}>
          Remove
        </button>
      ) : null}
    </div>
  )

  const headerPhotoBlock = (
    <div className="tp-header-photo shrink-0 flex flex-col items-center sm:items-start gap-2">
      <div
        className="tp-avatar w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden flex items-center justify-center text-white text-xl md:text-2xl font-black"
        aria-hidden
      >
        {displayAvatar ? <img src={displayAvatar} alt="" className="w-full h-full object-cover" /> : initials}
      </div>
      {photoUploadActions}
      <p className="text-[10px] text-subtle text-center sm:text-left max-w-[9rem] leading-snug">JPG, PNG or WebP. Square recommended.</p>
    </div>
  )

  const photoFields = (
    <section id="photo" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">Profile Photo</h2>
      <p className="text-sm text-muted mb-3">Students see this on your public tutor profile.</p>
      <div className="flex items-start gap-4">
        <div
          className="tp-avatar w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-black shrink-0"
          aria-hidden
        >
          {displayAvatar ? <img src={displayAvatar} alt="" className="w-full h-full object-cover" /> : initials}
        </div>
        <div className="min-w-0">
          {photoUploadActions}
          <p className="text-[11px] text-subtle mt-2">JPG, PNG or WebP. Recommended square image.</p>
        </div>
      </div>
    </section>
  )

  const basicProfileFields = (
    <section id="about" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">Basic Profile</h2>
      <p className="text-sm text-muted mb-4">Your headline and story for students.</p>
      <Field id="full-name" label="Full name">
        <input id="full-name" className="field tp-field w-full px-3 py-2 text-sm" value={hub.identity.name} onChange={e => patch({ identity: { ...hub.identity, name: e.target.value } })} autoComplete="name" />
      </Field>
      <Field id="headline" label="Professional headline" hint="Example shape: Full Stack Developer & React Mentor — only use titles you actually hold.">
        <input id="headline" className="field tp-field w-full px-3 py-2 text-sm" value={hub.identity.headline} onChange={e => patch({ identity: { ...hub.identity, headline: e.target.value } })} placeholder="Full Stack Developer & React Mentor" />
        <button
          type="button"
          className="text-xs font-semibold text-primary mt-1 cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0 }}
          onClick={() => {
            const s = suggestHeadline(hub)
            if (s) patch({ identity: { ...hub.identity, headline: s } })
          }}
        >
          Suggest wording from your skills
        </button>
      </Field>
      <Field id="bio" label="Short bio" hint="Cover what you teach, how you teach, and the outcomes you help with. Do not invent companies, degrees, or student counts.">
        <textarea id="bio" className="field tp-field w-full px-3 py-2 text-sm" rows={5} value={hub.bio} onChange={e => patch({ bio: e.target.value })} placeholder="What you teach, your teaching approach, and how you help students ship real work." />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Field id="location" label="Location">
          <input id="location" className="field tp-field w-full px-3 py-2 text-sm" value={hub.location} onChange={e => patch({ location: e.target.value })} />
        </Field>
        <Field id="years" label="Years of experience (self-reported)">
          <input
            id="years"
            type="number"
            min={0}
            max={60}
            className="field tp-field w-full px-3 py-2 text-sm"
            value={hub.experienceYears ?? ''}
            onChange={e => patch({ experienceYears: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
      </div>
      <h3 className="text-sm font-bold text-ink mb-2">Languages I Teach In</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {LANGUAGE_OPTIONS.map(lang => {
          const on = hub.languages.some(l => l.name === lang)
          return (
            <Chip
              key={lang}
              on={on}
              onClick={() => {
                const next: TutorLanguage[] = on
                  ? hub.languages.filter(l => l.name !== lang)
                  : [...hub.languages, { name: lang, level: 'Fluent' }]
                patch({ languages: next })
              }}
            >
              {lang}
            </Chip>
          )
        })}
      </div>
      <ul className="space-y-2">
        {hub.languages.map(lang => (
          <li key={lang.name} className="flex items-center gap-3">
            <span className="text-sm font-semibold text-ink w-28">{lang.name}</span>
            <select
              className="field px-2 py-1 text-xs"
              aria-label={`${lang.name} proficiency`}
              value={lang.level}
              onChange={e =>
                patch({
                  languages: hub.languages.map(l => (l.name === lang.name ? { ...l, level: e.target.value as TutorLanguage['level'] } : l)),
                })
              }
            >
              {LANG_LEVELS.map(l => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  )

  const aboutFields = (
    <section id="about-onboarding" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">About You</h2>
      <p className="text-sm text-muted mb-4">Who you are, in the student’s first glance.</p>
      <Field id="full-name-onboarding" label="Full name">
        <input id="full-name-onboarding" className="field tp-field w-full px-3 py-2 text-sm" value={hub.identity.name} onChange={e => patch({ identity: { ...hub.identity, name: e.target.value } })} autoComplete="name" />
      </Field>
      <Field id="headline-onboarding" label="Professional headline" hint="Example shape: Full Stack Developer & React Mentor — only use titles you actually hold.">
        <input id="headline-onboarding" className="field tp-field w-full px-3 py-2 text-sm" value={hub.identity.headline} onChange={e => patch({ identity: { ...hub.identity, headline: e.target.value } })} placeholder="Full Stack Developer & React Mentor" />
      </Field>
      <Field id="bio-onboarding" label="Short bio" hint="Cover what you teach, how you teach, and the outcomes you help with.">
        <textarea id="bio-onboarding" className="field tp-field w-full px-3 py-2 text-sm" rows={5} value={hub.bio} onChange={e => patch({ bio: e.target.value })} placeholder="What you teach, your teaching approach, and how you help students ship real work." />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field id="location-onboarding" label="Location">
          <input id="location-onboarding" className="field tp-field w-full px-3 py-2 text-sm" value={hub.location} onChange={e => patch({ location: e.target.value })} />
        </Field>
        <Field id="years-onboarding" label="Years of experience (self-reported)">
          <input
            id="years-onboarding"
            type="number"
            min={0}
            max={60}
            className="field tp-field w-full px-3 py-2 text-sm"
            value={hub.experienceYears ?? ''}
            onChange={e => patch({ experienceYears: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
      </div>
    </section>
  )

  const educationFields = (
    <section id="education" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">Education & Credentials</h2>
      <p className="text-sm text-muted mb-4">Entries stay Not Verified until an admin confirms them.</p>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-ink">Education</h3>
        <button type="button" className="btn-glass text-xs" onClick={addEducation}>
          Add education
        </button>
      </div>
      {hub.education.map(row => (
        <div key={row.id} className="glass rounded-xl p-3 mb-2 grid sm:grid-cols-2 gap-2">
          <input className="field px-3 py-2 text-sm" placeholder="Degree" value={row.degree} aria-label="Degree" onChange={e => patch({ education: hub.education.map(r => (r.id === row.id ? { ...r, degree: e.target.value } : r)) })} />
          <input className="field px-3 py-2 text-sm" placeholder="Institution" value={row.institution} aria-label="Institution" onChange={e => patch({ education: hub.education.map(r => (r.id === row.id ? { ...r, institution: e.target.value } : r)) })} />
          <input className="field px-3 py-2 text-sm" placeholder="Field of study" value={row.field} aria-label="Field of study" onChange={e => patch({ education: hub.education.map(r => (r.id === row.id ? { ...r, field: e.target.value } : r)) })} />
          <input className="field px-3 py-2 text-sm" placeholder="Graduation year" value={row.year} aria-label="Graduation year" onChange={e => patch({ education: hub.education.map(r => (r.id === row.id ? { ...r, year: e.target.value } : r)) })} />
          <div className="text-xs text-muted sm:col-span-2">{verifyLabel(row.status)}</div>
        </div>
      ))}
      <div className="flex justify-between items-center mt-4 mb-2">
        <h3 className="text-sm font-bold text-ink">Credentials</h3>
        <button type="button" className="btn-glass text-xs" onClick={addCredential}>
          Add credential
        </button>
      </div>
      {hub.credentials.map(row => (
        <div key={row.id} className="glass rounded-xl p-3 mb-2 grid sm:grid-cols-2 gap-2">
          <input className="field px-3 py-2 text-sm" placeholder="Certification name" value={row.name} aria-label="Certification name" onChange={e => patch({ credentials: hub.credentials.map(r => (r.id === row.id ? { ...r, name: e.target.value } : r)) })} />
          <input className="field px-3 py-2 text-sm" placeholder="Issuing organization" value={row.org} aria-label="Issuing organization" onChange={e => patch({ credentials: hub.credentials.map(r => (r.id === row.id ? { ...r, org: e.target.value } : r)) })} />
          <input className="field px-3 py-2 text-sm" placeholder="Credential ID" value={row.credentialId} aria-label="Credential ID" onChange={e => patch({ credentials: hub.credentials.map(r => (r.id === row.id ? { ...r, credentialId: e.target.value } : r)) })} />
          <input className="field px-3 py-2 text-sm" placeholder="Credential URL" value={row.url} aria-label="Credential URL" onChange={e => patch({ credentials: hub.credentials.map(r => (r.id === row.id ? { ...r, url: e.target.value } : r)) })} />
          <div className="text-xs text-muted sm:col-span-2">{verifyLabel(row.status)}</div>
        </div>
      ))}
    </section>
  )

  const expertiseFields = (
    <section id="expertise" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">What I Teach</h2>
      <p className="text-sm text-muted mb-4">Primary categories and the skills students will book you for.</p>
      <div className="text-xs font-semibold text-muted mb-2">Primary categories</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {PRIMARY_CATEGORIES.map(cat => (
          <Chip key={cat} on={hub.categories.includes(cat)} onClick={() => patch({ categories: hub.categories.includes(cat) ? hub.categories.filter(c => c !== cat) : [...hub.categories, cat] })}>
            {cat}
          </Chip>
        ))}
      </div>
      <Field id="skill-search" label="Skills">
        <div className="flex gap-2">
          <input
            id="skill-search"
            className="field tp-field flex-1 px-3 py-2 text-sm"
            value={skillQuery}
            onChange={e => setSkillQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addSkill(skillQuery)
              }
            }}
            placeholder="Search or add a skill"
          />
          <button type="button" className="btn-glass text-sm" onClick={() => addSkill(skillQuery)}>
            Add skill
          </button>
        </div>
      </Field>
      {skillQuery && suggestedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestedSkills.slice(0, 8).map(s => (
            <Chip key={s} on={false} onClick={() => addSkill(s)}>
              + {s}
            </Chip>
          ))}
        </div>
      )}
      <ul className="space-y-2">
        {hub.skills.map(skill => (
          <li key={skill.name} className="glass rounded-xl p-3 flex flex-wrap items-center gap-3">
            <div className="font-semibold text-ink text-sm min-w-[7rem]">{skill.name}</div>
            <label className="text-xs text-muted">
              Level
              <select
                className="field ml-2 px-2 py-1 text-xs"
                value={skill.level}
                onChange={e =>
                  patch({
                    skills: hub.skills.map(s => (s.name === skill.name ? { ...s, level: e.target.value as SkillLevel } : s)),
                  })
                }
              >
                {SKILL_LEVELS.map(l => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <Chip
              on={skill.primary}
              onClick={() =>
                patch({
                  skills: hub.skills.map(s => ({ ...s, primary: s.name === skill.name })),
                })
              }
            >
              {skill.primary ? 'Primary skill' : 'Set primary'}
            </Chip>
            <button
              type="button"
              className="text-xs font-semibold text-muted ml-auto cursor-pointer"
              style={{ background: 'none', border: 'none' }}
              onClick={() => patch({ skills: hub.skills.filter(s => s.name !== skill.name) })}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  )

  const experienceFields = (
    <section id="experience" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">Teaching Experience</h2>
      <p className="text-sm text-muted mb-4">Self-reported background only. LearnSyra student counts come from the platform.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field id="teach-years" label="Teaching experience (years, self-reported)">
          <input
            id="teach-years"
            type="number"
            min={0}
            className="field tp-field w-full px-3 py-2 text-sm"
            value={hub.teachingExperienceYears ?? ''}
            onChange={e => patch({ teachingExperienceYears: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
        <Field id="students-taught" label="Students taught on LearnSyra">
          <input id="students-taught" className="field tp-field w-full px-3 py-2 text-sm" value={hub.platformCache.students} readOnly aria-readonly="true" />
        </Field>
      </div>
      <Field id="industry" label="Industry experience">
        <textarea id="industry" className="field tp-field w-full px-3 py-2 text-sm" rows={3} value={hub.industryExperience} onChange={e => patch({ industryExperience: e.target.value })} placeholder="Roles and domains you have actually worked in. Leave blank if you prefer not to share." />
      </Field>
      <Field id="subjects" label="Subjects taught">
        <input id="subjects" className="field tp-field w-full px-3 py-2 text-sm" value={hub.subjectsTaught} onChange={e => patch({ subjectsTaught: e.target.value })} />
      </Field>
      <div className="text-xs font-semibold text-muted mb-2">Teaching formats</div>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map(f => (
          <Chip key={f} on={hub.teachingFormats.includes(f)} onClick={() => patch({ teachingFormats: hub.teachingFormats.includes(f) ? hub.teachingFormats.filter(x => x !== f) : [...hub.teachingFormats, f] })}>
            {f}
          </Chip>
        ))}
      </div>
    </section>
  )

  const styleFields = (
    <section id="style" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">My Teaching Style</h2>
      <div className="flex flex-wrap gap-2 my-3">
        {TEACHING_STYLE_TAGS.map(tag => (
          <Chip
            key={tag}
            on={hub.teachingStyles.includes(tag)}
            onClick={() =>
              patch({
                teachingStyles: hub.teachingStyles.includes(tag) ? hub.teachingStyles.filter(t => t !== tag) : [...hub.teachingStyles, tag as TeachingStyleTag],
              })
            }
          >
            {tag}
          </Chip>
        ))}
      </div>
      <Field id="philosophy" label="Teaching philosophy" hint="How do you help students learn? Keep this concise and student-friendly.">
        <textarea id="philosophy" className="field tp-field w-full px-3 py-2 text-sm" rows={4} value={hub.teachingPhilosophy} onChange={e => patch({ teachingPhilosophy: e.target.value })} />
        <button
          type="button"
          className="text-xs font-semibold text-primary mt-1 cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0 }}
          onClick={() => {
            const s = suggestPhilosophy(hub)
            if (s) patch({ teachingPhilosophy: s })
          }}
        >
          Suggest wording from selected styles
        </button>
      </Field>
    </section>
  )

  const languageFields = (
    <section id="languages" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-3">Languages I Teach In</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {LANGUAGE_OPTIONS.map(lang => {
          const on = hub.languages.some(l => l.name === lang)
          return (
            <Chip
              key={lang}
              on={on}
              onClick={() => {
                const next: TutorLanguage[] = on
                  ? hub.languages.filter(l => l.name !== lang)
                  : [...hub.languages, { name: lang, level: 'Fluent' }]
                patch({ languages: next })
              }}
            >
              {lang}
            </Chip>
          )
        })}
      </div>
      <ul className="space-y-2">
        {hub.languages.map(lang => (
          <li key={lang.name} className="flex items-center gap-3">
            <span className="text-sm font-semibold text-ink w-28">{lang.name}</span>
            <select
              className="field px-2 py-1 text-xs"
              aria-label={`${lang.name} proficiency`}
              value={lang.level}
              onChange={e =>
                patch({
                  languages: hub.languages.map(l => (l.name === lang.name ? { ...l, level: e.target.value as TutorLanguage['level'] } : l)),
                })
              }
            >
              {LANG_LEVELS.map(l => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  )

  const sessionFields = (
    <section id="session-types" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">What Students Can Book</h2>
      <p className="text-sm text-muted mb-4">These session types reuse the existing booking flow at the public tutor page.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {hub.sessionOffers.map(offer => (
          <div key={offer.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-bold text-ink text-sm">{offer.label}</h3>
              <Chip
                on={offer.enabled}
                onClick={() =>
                  patch({
                    sessionOffers: hub.sessionOffers.map(s => (s.id === offer.id ? { ...s, enabled: !s.enabled } : s)),
                  })
                }
              >
                {offer.enabled ? 'Enabled' : 'Disabled'}
              </Chip>
            </div>
            <label className="text-xs text-muted">
              Hourly rate ({hub.currency})
              <input
                type="number"
                min={0}
                className="field tp-field w-full mt-1 px-3 py-2 text-sm"
                value={offer.hourlyRate || ''}
                onChange={e =>
                  patch({
                    sessionOffers: hub.sessionOffers.map(s =>
                      s.id === offer.id ? { ...s, hourlyRate: Number(e.target.value) || 0 } : s,
                    ),
                  })
                }
              />
            </label>
            {offer.enabled && offer.hourlyRate > 0 ? (
              <div className="text-sm font-black text-ink mt-2">{formatInr(offer.hourlyRate)} / hour</div>
            ) : (
              <div className="text-xs text-subtle mt-2">Set a rate to offer this session.</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )

  const pricingFields = (
    <section id="pricing" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">My Pricing</h2>
      <p className="text-sm text-muted mb-4">Saved rates feed student booking. Platform earnings estimates appear only when commission config exists.</p>
      <Field id="currency" label="Currency">
        <select id="currency" className="field px-3 py-2 text-sm" value={hub.currency} disabled>
          <option value="INR">INR (₹)</option>
        </select>
      </Field>
      <ul className="space-y-2 text-sm">
        {hub.sessionOffers.map(o => (
          <li key={o.id} className="flex justify-between gap-3">
            <span className="text-muted">{o.label}</span>
            <span className="font-bold text-ink">{o.enabled && o.hourlyRate > 0 ? `${formatInr(o.hourlyRate)} / hour` : 'Not offered'}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 glass rounded-xl p-4">
        <h3 className="text-sm font-bold text-ink mb-1">Platform Fee</h3>
        <p className="text-xs text-muted">No platform commission configuration is connected yet, so estimated tutor earnings are not shown.</p>
      </div>
    </section>
  )

  const availabilityFields = (
    <section id="availability" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">My Availability</h2>
      <p className="text-sm text-muted mb-4">Tap a weekday to enable it, then set start and end times. This weekly schedule is what students see when they book.</p>
      <Field id="timezone" label="Timezone">
        <input id="timezone" className="field tp-field w-full px-3 py-2 text-sm" value={hub.timezone} onChange={e => patch({ timezone: e.target.value })} />
      </Field>
      <div className="space-y-2">
        {WEEKDAYS.map(day => {
          const row = hub.availability.find(d => d.day === day)!
          return (
            <div key={day} className="glass rounded-xl p-3 grid grid-cols-1 sm:grid-cols-[7rem_1fr_auto] gap-2 items-center">
              <Chip
                on={row.enabled}
                onClick={() =>
                  patch({
                    availability: hub.availability.map(d => (d.day === day ? { ...d, enabled: !d.enabled } : d)),
                  })
                }
              >
                {day}
              </Chip>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-muted">
                  Start
                  <input
                    type="time"
                    className="field ml-1 px-2 py-1 text-sm"
                    value={row.start}
                    disabled={!row.enabled}
                    onChange={e =>
                      patch({
                        availability: hub.availability.map(d => (d.day === day ? { ...d, start: e.target.value } : d)),
                      })
                    }
                  />
                </label>
                <label className="text-xs text-muted">
                  End
                  <input
                    type="time"
                    className="field ml-1 px-2 py-1 text-sm"
                    value={row.end}
                    disabled={!row.enabled}
                    onChange={e =>
                      patch({
                        availability: hub.availability.map(d => (d.day === day ? { ...d, end: e.target.value } : d)),
                      })
                    }
                  />
                </label>
              </div>
              <span className="text-xs text-muted">{row.enabled ? `${row.start} — ${row.end}` : day === 'Sunday' ? 'Unavailable' : 'Off'}</span>
            </div>
          )
        })}
      </div>
    </section>
  )

  const prefsFields = (
    <section id="prefs" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-3">Session Preferences</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <fieldset>
          <legend className="text-xs font-semibold text-muted mb-2">Session duration</legend>
          <div className="flex flex-wrap gap-2">
            {SESSION_DURATIONS.map(n => (
              <Chip key={n} on={hub.sessionDuration === n} onClick={() => patch({ sessionDuration: n })}>
                {n} min
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs font-semibold text-muted mb-2">Buffer</legend>
          <div className="flex flex-wrap gap-2">
            {BUFFER_OPTIONS.map(n => (
              <Chip key={n} on={hub.bufferMinutes === n} onClick={() => patch({ bufferMinutes: n })}>
                {n === 0 ? 'No buffer' : `${n} min`}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs font-semibold text-muted mb-2">Minimum booking notice</legend>
          <div className="flex flex-wrap gap-2">
            {NOTICE_OPTIONS.map(n => (
              <Chip key={n} on={hub.minNoticeHours === n} onClick={() => patch({ minNoticeHours: n })}>
                {n === 1 ? '1 hour' : `${n} hours`}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs font-semibold text-muted mb-2">Maximum advance booking</legend>
          <div className="flex flex-wrap gap-2">
            {ADVANCE_OPTIONS.map(n => (
              <Chip key={n} on={hub.maxAdvanceDays === n} onClick={() => patch({ maxAdvanceDays: n })}>
                {n} days
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  )

  const introVideoFields = (
    <section id="intro-video" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">Introduction Video</h2>
      <p className="text-sm text-muted mb-3">Introduce yourself to students in 30–60 seconds.</p>
      <Field id="video-url" label="Video URL">
        <input id="video-url" className="field tp-field w-full px-3 py-2 text-sm" value={hub.introVideoUrl} onChange={e => patch({ introVideoUrl: e.target.value })} placeholder="https://" />
      </Field>
      <div className="text-xs text-muted">
        Status: {hub.introVideoUrl.trim() ? (hub.introVideoStatus === 'pending_review' ? 'Pending Review' : 'Added') : 'Not Added'}
      </div>
    </section>
  )

  const portfolioFields = (
    <section id="portfolio" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">Professional Portfolio</h2>
      <p className="text-sm text-muted mb-3">Link existing LearnSyra projects. Project management stays on the projects page.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {projects.slice(0, 12).map(p => (
          <Chip
            key={p.id}
            on={hub.portfolioProjectIds.includes(p.id)}
            onClick={() =>
              patch({
                portfolioProjectIds: hub.portfolioProjectIds.includes(p.id)
                  ? hub.portfolioProjectIds.filter(id => id !== p.id)
                  : [...hub.portfolioProjectIds, p.id],
              })
            }
          >
            {p.title}
          </Chip>
        ))}
      </div>
      <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutor/projects')}>
        Add Project
      </button>
    </section>
  )

  const coursesFields = (
    <section id="courses" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-3">My Courses</h2>
      {courses.length === 0 ? (
        <p className="text-sm text-muted">No courses yet. Create them from the tutor courses workspace.</p>
      ) : (
        <div className="space-y-3">
          {courses.map(c => (
            <article key={c.id} className="glass rounded-xl p-4">
              <h3 className="font-bold text-ink">{c.title}</h3>
              <div className="text-xs text-muted mt-1">
                {c.students} students · {Number(c.rating) ? `${Number(c.rating).toFixed(1)} rating` : 'No rating yet'} · {c.published ? 'Published' : 'Draft'}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className="btn-glass text-xs" onClick={() => navigate('/tutor/courses')}>
                  Edit Course
                </button>
                <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/courses/${c.id}`)}>
                  View Course
                </button>
                <button type="button" className="btn-glass text-xs" onClick={() => navigate('/tutor/analytics')}>
                  Analytics
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )

  const visibilityFields = (
    <section id="visibility" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-3">Profile Visibility</h2>
      {(['draft', 'published', 'paused'] as ProfileVisibility[]).map(v => (
        <label key={v} className="flex items-start gap-2 mb-2 text-sm">
          <input type="radio" name="visibility" checked={hub.visibility === v} onChange={() => patch({ visibility: v })} />
          <span>
            <span className="font-semibold text-ink capitalize">{v}</span>
            <span className="text-muted block text-xs">
              {v === 'draft' && 'Students cannot discover the profile.'}
              {v === 'published' && 'Profile appears in the tutor marketplace.'}
              {v === 'paused' && 'Temporarily hidden from discovery.'}
            </span>
          </span>
        </label>
      ))}
    </section>
  )

  const accountFields = (
    <section id="settings" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-3">Account settings</h2>
      <input type="password" className="field w-full mb-3 px-3 py-2 text-sm" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" />
      <input type="password" className="field w-full mb-4 px-3 py-2 text-sm" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" />
      <button type="button" className="btn-glass text-sm" disabled={busy} onClick={changePassword}>
        Update password
      </button>
    </section>
  )

  const onboardingBody = () => {
    const step = hub.onboarding.step
    if (step === 0) return aboutFields
    if (step === 1) return (
      <>
        {expertiseFields}
        {experienceFields}
      </>
    )
    if (step === 2) return (
      <>
        {styleFields}
        {languageFields}
      </>
    )
    if (step === 3) return (
      <>
        {sessionFields}
        {pricingFields}
      </>
    )
    if (step === 4) return (
      <>
        {availabilityFields}
        {prefsFields}
      </>
    )
    if (step === 5) return (
      <>
        {photoFields}
        {verificationBlock}
      </>
    )
    return (
      <>
        {photoFields}
        {publishBlock}
      </>
    )
  }

  const verificationBlock = (
    <section id="verification" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">Tutor Verification</h2>
      <p className="text-sm text-muted mb-4">Verification is local until an admin workflow exists. Nothing is marked verified unless confirmed.</p>
      <ul className="space-y-2 text-sm mb-4">
        <li className="flex items-center gap-2">
          <Check done={emailVerified} />
          {emailVerified ? 'Email Verified' : 'Email not on file'}
        </li>
        <li className="flex items-center gap-2">
          <Check done={identityVerified} warn={hub.verification.identity === 'pending'} />
          Identity — {verifyLabel(hub.verification.identity)}
        </li>
        <li className="flex items-center gap-2">
          <Check done={hub.verification.education === 'verified'} warn={hub.verification.education === 'pending'} />
          Education — {verifyLabel(hub.verification.education)}
        </li>
        <li className="flex items-center gap-2">
          <Check done={hub.verification.experience === 'verified'} warn={hub.verification.experience === 'pending'} />
          Experience — {verifyLabel(hub.verification.experience)}
        </li>
        <li className="flex items-center gap-2">
          <Check done={strength.percent >= 70} />
          Profile — {strength.percent >= 70 ? 'Complete enough to continue' : 'Still in progress'}
        </li>
      </ul>
      <p className="text-[11px] text-subtle mb-3">Local verification request — pending admin review. This is not a live identity check.</p>
      <button
        type="button"
        className="btn-glass text-sm"
        onClick={() =>
          patch({
            verification: {
              ...hub.verification,
              identity: 'pending',
              education: hub.education.length ? 'pending' : hub.verification.education,
              experience: hub.industryExperience.trim() ? 'pending' : hub.verification.experience,
              submittedAt: new Date().toISOString(),
              localMock: true,
            },
          })
        }
      >
        Submit Verification
      </button>
    </section>
  )

  const publishBlock = (
    <section id="publish" className="glass rounded-2xl p-5 md:p-6 mb-5">
      <h2 className="text-lg font-black text-ink mb-1">Ready to Teach?</h2>
      <p className="text-sm text-muted mb-3">Profile readiness: {strength.percent}%</p>
      <div className="tp-progress mb-4" aria-hidden>
        <span style={{ width: `${strength.percent}%` }} />
      </div>
      <ul className="space-y-2 text-sm mb-4">
        {[
          ['Profile photo', hasValidProfilePhoto(hub)],
          ['Professional headline', hub.identity.headline.trim().length > 3],
          ['Bio', hub.bio.trim().length >= 20],
          ['Expertise', hub.skills.length > 0],
          ['Teaching style', hub.teachingStyles.length > 0],
          ['Pricing', hub.sessionOffers.some(s => s.enabled && s.hourlyRate > 0)],
          ['Availability', hub.availability.some(d => d.enabled)],
          ['At least one session type', hub.sessionOffers.some(s => s.enabled)],
        ].map(([label, done]) => (
          <li key={String(label)} className="flex items-center gap-2">
            <Check done={Boolean(done)} />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <Check done={identityVerified} warn />
          {identityVerified ? 'Identity verified' : 'Verification pending (not required to publish)'}
        </li>
      </ul>
      {blockers.length > 0 && (
        <p className="text-sm mb-3" style={{ color: '#E11D48' }}>
          Publishing is disabled until you add: {blockers.join(', ')}.
        </p>
      )}
      <button type="button" className="btn-primary text-sm" disabled={busy || blockers.length > 0} onClick={publish}>
        Publish Profile
      </button>
    </section>
  )

  const renderSectionPanel = () => {
    switch (activeSection) {
      case 'basic':
        return basicProfileFields
      case 'expertise':
        return (
          <>
            {expertiseFields}
            {experienceFields}
            {educationFields}
            {styleFields}
          </>
        )
      case 'sessions':
        return (
          <>
            {sessionFields}
            {pricingFields}
            {prefsFields}
          </>
        )
      case 'availability':
        return availabilityFields
      case 'content':
        return (
          <>
            {introVideoFields}
            {portfolioFields}
            {coursesFields}
          </>
        )
      case 'verification':
        return verificationBlock
      case 'publish':
        return (
          <>
            {publishBlock}
            {visibilityFields}
          </>
        )
      case 'account':
        return accountFields
      default:
        return basicProfileFields
    }
  }

  if (!userId) {
    return (
      <div className="tp-page pt-20 px-4 sm:px-6 pb-24 max-w-6xl mx-auto">
        <p className="text-sm text-muted">Loading tutor profile…</p>
      </div>
    )
  }

  if (onboarding) {
    const step = hub.onboarding.step
    const pct = Math.round(((step + 1) / ONBOARDING_STEPS.length) * 100)
    return (
      <div className="tp-page pt-20 px-4 sm:px-6 pb-24 max-w-6xl mx-auto overflow-x-hidden">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Tutor onboarding</p>
        <h1 className="text-3xl font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Build Your Tutor Profile
        </h1>
        <p className="text-muted mb-5">Complete your profile so students can discover and trust you.</p>
        <div className="glass rounded-2xl p-4 mb-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-ink">
              Step {step + 1} of {ONBOARDING_STEPS.length} · {ONBOARDING_STEPS[step]}
            </span>
            <span className="text-muted">{pct}%</span>
          </div>
          <div className="tp-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        {onboardingBody()}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-glass text-sm"
            disabled={step === 0}
            onClick={() => patch({ onboarding: { ...hub.onboarding, step: Math.max(0, step - 1) } })}
          >
            Back
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={busy}
            onClick={async () => {
              const nextStep = Math.min(ONBOARDING_STEPS.length - 1, step + 1)
              const completed = step >= ONBOARDING_STEPS.length - 1
              const next = {
                ...hub,
                onboarding: { ...hub.onboarding, step: completed ? step : nextStep, completed, dismissed: completed },
              }
              await persist(next, false)
              if (completed) {
                setOnboarding(false)
                setMsg('Setup saved. You can keep editing your tutor hub anytime.')
              } else {
                document.getElementById(nextOnboardingTarget(nextStep).slice(1))?.scrollIntoView({ behavior: 'smooth' })
              }
            }}
          >
            Save & Continue
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-muted cursor-pointer"
            style={{ background: 'none', border: 'none' }}
            onClick={async () => {
              const next = { ...hub, onboarding: { ...hub.onboarding, dismissed: true } }
              await persist(next, false)
              setOnboarding(false)
            }}
          >
            Exit and continue later
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="tp-page pt-20 px-4 sm:px-6 pb-16 max-w-6xl mx-auto overflow-x-hidden">
      <section className="tp-hero glass rounded-3xl p-4 md:p-6 mb-5">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {headerPhotoBlock}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">Tutor Profile</p>
            <h1 className="text-2xl md:text-3xl font-black text-ink leading-tight" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {name}
            </h1>
            <p className="text-sm text-muted mt-1 mb-2">{hub.identity.headline || 'Add a professional headline'}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="badge badge-primary">Tutor</span>
              {identityVerified ? (
                <span className="badge badge-primary">Verified Tutor</span>
              ) : emailVerified ? (
                <span className="badge">Email verified</span>
              ) : (
                <span className="badge">Unverified</span>
              )}
              <span className="badge">{hub.visibility === 'published' ? 'Published' : hub.visibility === 'paused' ? 'Paused' : 'Draft'}</span>
              <span className="badge">{strength.percent}% complete</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mb-4">
              {hub.platformCache.rating != null ? <span className="font-semibold text-ink">⭐ {hub.platformCache.rating.toFixed(1)}</span> : <span>No rating yet</span>}
              <span>{hub.platformCache.students} LearnSyra students</span>
              {hub.experienceYears != null ? <span>{hub.experienceYears} yrs experience</span> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => persist()}>
                {busy ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" className="btn-glass text-sm" disabled={busy || blockers.length > 0} onClick={publish}>
                Publish Profile
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => setPreviewOpen(true)}>
                Preview Public Profile
              </button>
              <button type="button" className="btn-glass text-sm" onClick={share}>
                Share Profile
              </button>
            </div>
            {(msg || err) && (
              <p className="text-sm mt-3" style={{ color: err ? '#E11D48' : '#0F8A68' }}>
                {err ?? msg}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="glass rounded-3xl p-3 md:p-4 mb-5">
        <div className="tp-section-nav mb-2" role="tablist" aria-label="Profile sections">
          {PROFILE_SECTIONS.map(section => {
            const done = sectionComplete(section.id, hub)
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={activeSection === section.id}
                className="tp-section-tab"
                data-on={activeSection === section.id}
                onClick={() => setActiveSection(section.id)}
              >
                {done ? <span className="tp-tab-done" aria-hidden>✓</span> : null}
                {section.label}
              </button>
            )
          })}
        </div>
        <p className="text-xs md:text-sm text-muted px-1">{PROFILE_SECTIONS.find(s => s.id === activeSection)?.hint}</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_17.5rem] gap-5 lg:gap-6">
        <div role="tabpanel">{renderSectionPanel()}</div>

        <aside className="tp-sidebar space-y-4 lg:sticky lg:top-24 self-start">
          <section className="glass rounded-2xl p-4">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h2 className="text-sm font-black text-ink">Profile Strength</h2>
              <span className="text-xl font-black text-ink tabular-nums">{strength.percent}%</span>
            </div>
            <div className="tp-progress tp-progress-sm mb-3" role="progressbar" aria-valuenow={strength.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion">
              <span style={{ width: `${strength.percent}%` }} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Required</p>
            <ul className="space-y-1.5 text-xs mb-3">
              {strength.items
                .filter(item => !item.optional)
                .map(item => (
                  <li key={item.id} className={`tp-strength-row flex items-center gap-2 ${item.done ? 'tp-strength-row--done' : ''}`}>
                    <Check done={item.done} />
                    <span className={item.done ? 'text-ink font-medium' : 'text-muted'}>{item.label}</span>
                  </li>
                ))}
            </ul>
            {strength.items.some(item => item.optional) ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Optional</p>
                <ul className="space-y-1.5 text-xs mb-3">
                  {strength.items
                    .filter(item => item.optional)
                    .map(item => (
                      <li key={item.id} className="tp-strength-row flex items-center gap-2">
                        <Check done={item.done} warn={!item.done} />
                        <span className="text-muted">{item.label}</span>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
            <button type="button" className="btn-primary w-full text-xs" onClick={goNextMissing}>
              Complete Next Step →
            </button>
            {hub.onboarding.dismissed && strength.percent < 70 && (
              <button type="button" className="btn-glass w-full text-xs mt-2" onClick={() => setOnboarding(true)}>
                Resume setup
              </button>
            )}
          </section>

          <section className="glass rounded-2xl p-4">
            <h2 className="text-sm font-black text-ink mb-2">Why Students Choose Me</h2>
            <ul className="text-xs space-y-1.5 text-muted">
              <li>⭐ {hub.platformCache.rating != null ? hub.platformCache.rating.toFixed(1) : 'No rating yet'}</li>
              <li>👥 {hub.platformCache.students} LearnSyra students</li>
              <li>📚 {courses.length} courses</li>
              <li>🚀 {hub.portfolioProjectIds.length} linked projects</li>
            </ul>
          </section>

          <section className="glass rounded-2xl p-4">
            <h2 className="text-sm font-black text-ink mb-1">✨ AI Profile Coach</h2>
            <p className="text-[11px] text-subtle mb-2">Based on your current profile only.</p>
            <ul className="space-y-2 text-xs text-muted mb-3">
              {tips.slice(0, 3).map(t => (
                <li key={t.text}>{t.text}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-xs" onClick={goNextMissing}>
                Improve Profile
              </button>
              <button type="button" className="btn-glass text-xs" onClick={() => setActiveSection('sessions')}>
                Add Session
              </button>
            </div>
          </section>
        </aside>
      </div>

      {previewOpen && (
        <div className="tp-dialog fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <button type="button" className="absolute inset-0 cursor-pointer" aria-label="Close preview" style={{ background: 'transparent', border: 'none' }} onClick={() => setPreviewOpen(false)} />
          <div className="glass rounded-3xl p-5 md:p-6 relative w-full max-w-lg z-10 max-h-[90vh] overflow-auto">
            <h2 id="preview-title" className="text-lg font-black text-ink mb-1">
              Student View
            </h2>
            <p className="text-xs text-muted mb-4">
              The live student page is {tutorPath(hub.publicId)}. This preview uses the same profile data.
            </p>
            <div className="flex gap-3 mb-3">
              <div className="tp-avatar w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-white font-black">
                {displayAvatar ? <img src={displayAvatar} alt="" className="w-full h-full object-cover" /> : initials}
              </div>
              <div>
                <div className="font-black text-ink">{name}</div>
                <div className="text-sm text-muted">{hub.identity.headline || 'Headline pending'}</div>
              </div>
            </div>
            <p className="text-sm text-muted mb-3">{hub.bio || 'Bio pending.'}</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {hub.skills.map(s => (
                <span key={s.name} className="badge badge-primary">
                  {s.name} · {s.level}
                </span>
              ))}
            </div>
            <ul className="text-sm text-muted space-y-1 mb-4">
              <li>Languages: {hub.languages.map(l => `${l.name} (${l.level})`).join(', ') || '—'}</li>
              <li>Style: {hub.teachingStyles.join(', ') || '—'}</li>
              <li>
                Pricing:{' '}
                {hub.sessionOffers
                  .filter(s => s.enabled && s.hourlyRate > 0)
                  .map(s => `${s.label} ${formatInr(s.hourlyRate)}/hr`)
                  .join(' · ') || '—'}
              </li>
              <li>Availability: {hub.availability.filter(d => d.enabled).map(d => d.day).join(', ') || 'Not set'}</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => navigate(tutorPath(hub.publicId))}>
                Open public profile
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorBookPath(hub.publicId))}>
                Book Session
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
