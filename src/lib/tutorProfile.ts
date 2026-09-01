import type { CatalogTutor, SessionType, TutorSubject } from './tutorMarketplace'
import { peekAuthUserId, userStorageKey } from './supabase'

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
export type LangLevel = 'Basic' | 'Conversational' | 'Fluent' | 'Native'
export type VerifyState = 'not_verified' | 'pending' | 'verified'
export type ProfileVisibility = 'draft' | 'published' | 'paused'
export type VideoStatus = 'not_added' | 'added' | 'pending_review'
export type SessionOfferId = SessionType['id']
export type TeachingFormat = '1-on-1' | 'Group Classes' | 'Courses' | 'Project Mentoring' | 'Interview Preparation'

export const ONBOARDING_STEPS = [
  'About You',
  'Expertise',
  'Teaching Style',
  'Pricing',
  'Availability',
  'Verification',
  'Publish',
] as const

export const TEACHING_STYLE_TAGS = [
  'Practical',
  'Project-based',
  'Beginner-friendly',
  'Interview-focused',
  'Theory + Practice',
  'Fast-paced',
  'Step-by-step',
  'Career-focused',
] as const

export type TeachingStyleTag = (typeof TEACHING_STYLE_TAGS)[number]

export const PRIMARY_CATEGORIES = [
  'Programming',
  'AI & Machine Learning',
  'Data Analytics',
  'Business',
  'MBA',
  'Finance',
  'English',
  'Mathematics',
  'Career Skills',
] as const

export const SUGGESTED_SKILLS = [
  'React',
  'JavaScript',
  'TypeScript',
  'Node.js',
  'Python',
  'MongoDB',
  'REST APIs',
  'System Design',
  'Data Structures',
  'Interview Preparation',
  'SQL',
  'Machine Learning',
  'Excel',
  'Communication',
] as const

export const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Punjabi', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Korean', 'Spanish', 'French'] as const

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export const SKILL_LEVELS: SkillLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Expert']
export const LANG_LEVELS: LangLevel[] = ['Basic', 'Conversational', 'Fluent', 'Native']
export const SESSION_DURATIONS = [30, 45, 60, 90] as const
export const BUFFER_OPTIONS = [0, 10, 15, 30] as const
export const NOTICE_OPTIONS = [1, 6, 12, 24] as const
export const ADVANCE_OPTIONS = [7, 14, 30] as const

export interface TutorSkill {
  name: string
  level: SkillLevel
  primary: boolean
}

export interface TutorLanguage {
  name: string
  level: LangLevel
}

export interface EducationItem {
  id: string
  degree: string
  institution: string
  field: string
  year: string
  status: VerifyState
}

export interface CredentialItem {
  id: string
  name: string
  org: string
  credentialId: string
  url: string
  status: VerifyState
}

export interface SessionOffer {
  id: SessionOfferId
  label: string
  enabled: boolean
  hourlyRate: number
}

export interface ExtraRange {
  id: string
  start: string
  end: string
}

export interface BlockedDateRange {
  id: string
  from: string
  to: string
  reason: string
}

export const STUDENT_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
export type StudentLevel = (typeof STUDENT_LEVELS)[number]

export interface DayAvailability {
  day: (typeof WEEKDAYS)[number]
  enabled: boolean
  start: string
  end: string
  extraRanges?: ExtraRange[]
}

export interface TutorHubIdentity {
  name: string
  headline: string
  avatarUrl: string | null
  email: string
}

export interface PlatformCache {
  students: number
  courseCount: number
  rating: number | null
  interviewSessions: number
  projectReviews: number
}

export interface PublicLink {
  title: string
  href: string
  students?: number
  rating?: number
  published?: boolean
  completion?: number | null
}

export interface TutorHub {
  version: 1
  userId: string
  publicId: string
  identity: TutorHubIdentity
  location: string
  bio: string
  languages: TutorLanguage[]
  experienceYears: number | null
  teachingExperienceYears: number | null
  industryExperience: string
  subjectsTaught: string
  categories: string[]
  skills: TutorSkill[]
  teachingStyles: TeachingStyleTag[]
  teachingPhilosophy: string
  teachingFormats: TeachingFormat[]
  education: EducationItem[]
  credentials: CredentialItem[]
  sessionOffers: SessionOffer[]
  currency: 'INR'
  availability: DayAvailability[]
  timezone: string
  sessionDuration: (typeof SESSION_DURATIONS)[number]
  bufferMinutes: (typeof BUFFER_OPTIONS)[number]
  minNoticeHours: (typeof NOTICE_OPTIONS)[number]
  maxAdvanceDays: (typeof ADVANCE_OPTIONS)[number]
  introVideoUrl: string
  introVideoStatus: VideoStatus
  portfolioProjectIds: string[]
  publicCourses: PublicLink[]
  publicProjects: PublicLink[]
  visibility: ProfileVisibility
  onboarding: { step: number; dismissed: boolean; completed: boolean }
  verification: {
    identity: VerifyState
    education: VerifyState
    experience: VerifyState
    submittedAt: string | null
    localMock: true
  }
  blockedDates: BlockedDateRange[]
  vacationMode: boolean
  preferredStudentLevels: StudentLevel[]
  links: { website: string; linkedin: string }
  platformCache: PlatformCache
}

const HUBS_KEY = 'learnsyra_tutor_hubs'

const STYLE_ICONS: Record<TeachingStyleTag, string> = {
  Practical: '🛠️',
  'Project-based': '🚀',
  'Beginner-friendly': '🌱',
  'Interview-focused': '🎯',
  'Theory + Practice': '📘',
  'Fast-paced': '⚡',
  'Step-by-step': '🧭',
  'Career-focused': '🎓',
}

const DEFAULT_OFFERS: SessionOffer[] = [
  { id: '1on1', label: '1-on-1 Mentoring', enabled: true, hourlyRate: 0 },
  { id: 'project', label: 'Project Help', enabled: false, hourlyRate: 0 },
  { id: 'interview', label: 'Interview Preparation', enabled: false, hourlyRate: 0 },
  { id: 'career', label: 'Career Guidance', enabled: false, hourlyRate: 0 },
]

export function selfTutorId(userId: string) {
  return `self-${userId}`
}

function defaultDays(): DayAvailability[] {
  return WEEKDAYS.map(day => ({
    day,
    enabled: false,
    start: '09:00',
    end: '18:00',
  }))
}

export function emptyHub(userId: string, identity: TutorHubIdentity): TutorHub {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  const hub: TutorHub = {
    version: 1,
    userId,
    publicId: selfTutorId(userId),
    identity,
    location: '',
    bio: '',
    languages: [{ name: 'English', level: 'Fluent' }],
    experienceYears: null,
    teachingExperienceYears: null,
    industryExperience: '',
    subjectsTaught: '',
    categories: [],
    skills: [],
    teachingStyles: [],
    teachingPhilosophy: '',
    teachingFormats: ['1-on-1'],
    education: [],
    credentials: [],
    sessionOffers: DEFAULT_OFFERS.map(o => ({ ...o })),
    currency: 'INR',
    availability: defaultDays(),
    timezone,
    sessionDuration: 60,
    bufferMinutes: 10,
    minNoticeHours: 6,
    maxAdvanceDays: 14,
    introVideoUrl: '',
    introVideoStatus: 'not_added',
    portfolioProjectIds: [],
    publicCourses: [],
    publicProjects: [],
    visibility: 'draft',
    onboarding: { step: 0, dismissed: false, completed: false },
    verification: {
      identity: 'not_verified',
      education: 'not_verified',
      experience: 'not_verified',
      submittedAt: null,
      localMock: true,
    },
    blockedDates: [],
    vacationMode: false,
    preferredStudentLevels: [],
    links: { website: '', linkedin: '' },
    platformCache: { students: 0, courseCount: 0, rating: null, interviewSessions: 0, projectReviews: 0 },
  }
  return hub
}

export function normalizeHub(hub: TutorHub): TutorHub {
  return {
    ...hub,
    blockedDates: Array.isArray(hub.blockedDates) ? hub.blockedDates : [],
    vacationMode: Boolean(hub.vacationMode),
    preferredStudentLevels: Array.isArray(hub.preferredStudentLevels)
      ? hub.preferredStudentLevels.filter((l): l is StudentLevel => (STUDENT_LEVELS as readonly string[]).includes(l))
      : [],
    availability: (hub.availability?.length ? hub.availability : defaultDays()).map(d => ({
      ...d,
      extraRanges: Array.isArray(d.extraRanges) ? d.extraRanges : [],
    })),
  }
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function daySlotRanges(day: DayAvailability): { start: string; end: string }[] {
  return [{ start: day.start, end: day.end }, ...(day.extraRanges ?? [])]
}

export function rangesOverlap(a: { start: string; end: string }, b: { start: string; end: string }) {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)
}

export function invalidRange(range: { start: string; end: string }) {
  return toMinutes(range.end) <= toMinutes(range.start)
}

export function isoDay(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isDateBlocked(hub: TutorHub, date: Date) {
  const key = isoDay(date)
  return (hub.blockedDates ?? []).some(b => b.from && b.to && key >= b.from && key <= b.to)
}

function hubKey(userId?: string | null) {
  return userStorageKey(HUBS_KEY, userId)
}

export function loadTutorHub(userId: string): TutorHub | null {
  const key = hubKey(userId)
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TutorHub
    if (!parsed || parsed.userId !== userId) return null
    return normalizeHub(parsed)
  } catch {
    return null
  }
}

export function saveTutorHub(hub: TutorHub) {
  const key = hubKey(hub.userId)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(normalizeHub(hub)))
}

export function loadOrCreateHub(userId: string, identity: TutorHubIdentity): TutorHub {
  const existing = loadTutorHub(userId)
  if (!existing) return emptyHub(userId, identity)
  return normalizeHub({
    ...existing,
    identity: {
      name: identity.name || existing.identity.name,
      headline: identity.headline || existing.identity.headline,
      avatarUrl: identity.avatarUrl ?? existing.identity.avatarUrl,
      email: identity.email || existing.identity.email,
    },
  })
}

export function findHubByPublicId(publicId: string): TutorHub | null {
  const uid = peekAuthUserId()
  if (!uid) return null
  const hub = loadTutorHub(uid)
  return hub?.publicId === publicId ? hub : null
}

export function loadPublishedHubs(): TutorHub[] {
  const uid = peekAuthUserId()
  if (!uid) return []
  const hub = loadTutorHub(uid)
  return hub?.visibility === 'published' ? [hub] : []
}

function mapSubject(category?: string): TutorSubject {
  const c = category ?? ''
  if (c === 'Career Skills' || c === 'Career') return 'Career'
  if (c === 'Mathematics') return 'Programming'
  if (
    c === 'Programming' ||
    c === 'AI & Machine Learning' ||
    c === 'Data Analytics' ||
    c === 'Business' ||
    c === 'MBA' ||
    c === 'English' ||
    c === 'Finance' ||
    c === 'Interview Prep'
  ) {
    return c
  }
  return 'Programming'
}

function formatHours(start: string, end: string) {
  return `${toDisplayTime(start)} — ${toDisplayTime(end)}`
}

export function toDisplayTime(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(h)) return hhmm
  const d = new Date(2000, 0, 1, h, Number.isFinite(m) ? m : 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function generateTimeSlots(start: string, end: string, step = 30) {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const fromMin = (n: number) => {
    const h = Math.floor(n / 60)
    const m = n % 60
    return toDisplayTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  const a = toMin(start)
  const b = toMin(end)
  const out: string[] = []
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return out
  for (let t = a; t + step <= b; t += step) out.push(fromMin(t))
  return out
}

function weekdayFromDate(date: Date): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[(date.getDay() + 6) % 7]
}

function isToday(date: Date) {
  const n = new Date()
  return date.getFullYear() === n.getFullYear() && date.getMonth() === n.getMonth() && date.getDate() === n.getDate()
}

export function catalogTutorFromHub(hub: TutorHub): CatalogTutor {
  const skills = hub.skills.map(s => s.name)
  const primary = hub.skills.find(s => s.primary)?.name
  const expertise = [primary, ...hub.categories, ...skills].filter((v, i, a) => v && a.indexOf(v) === i) as string[]
  const rate =
    hub.sessionOffers.find(s => s.enabled && s.hourlyRate > 0)?.hourlyRate ??
    hub.sessionOffers.find(s => s.id === '1on1')?.hourlyRate ??
    0
  const weekly = hub.availability.map(d => ({
    day: d.day,
    hours: d.enabled
      ? daySlotRanges(d).map(r => formatHours(r.start, r.end)).join(' · ')
      : 'Unavailable',
  }))
  const todayRow = hub.availability.find(d => d.day === weekdayFromDate(new Date()))
  const blockedToday = isDateBlocked(hub, new Date())
  const todayOpen = Boolean(todayRow?.enabled) && !blockedToday
  const slotsToday = todayRow?.enabled && !blockedToday
    ? [...new Set(daySlotRanges(todayRow).flatMap(r => generateTimeSlots(r.start, r.end)))]
    : []
  const support: CatalogTutor['support'] = []
  for (const s of hub.sessionOffers) {
    if (!s.enabled) continue
    if (s.id === 'project' || s.id === 'interview' || s.id === 'career') support.push(s.id)
  }
  const rating = hub.platformCache.rating ?? 0
  const students = hub.platformCache.students
  return {
    id: hub.publicId,
    name: hub.identity.name || 'LearnSyra Tutor',
    title: hub.identity.headline || 'LearnSyra Tutor',
    intro: (hub.bio.trim().slice(0, 180) || hub.identity.headline || 'LearnSyra tutor.').trim(),
    bio: hub.bio.trim() || hub.identity.headline || '',
    expertise: expertise.length ? expertise.slice(0, 6) : skills.slice(0, 3),
    skills: skills.length ? skills : expertise.slice(0, 4),
    subject: mapSubject(hub.categories[0]),
    rating,
    reviewCount: rating ? hub.platformCache.students : 0,
    students,
    experienceYears: hub.experienceYears ?? 0,
    hourlyRate: rate,
    languages: hub.languages.map(l => l.name),
    industries: [],
    teachingStyle: hub.teachingStyles.map(label => ({ icon: STYLE_ICONS[label], label })),
    badges: [],
    courses: hub.publicCourses.map(({ title, href }) => ({ title, href })),
    projects: hub.publicProjects.map(({ title, href }) => ({ title, href })),
    careerSpecialties: hub.sessionOffers.some(s => s.id === 'career' && s.enabled) ? ['Career guidance'] : [],
    support: support.length ? support : [],
    aiMatch: 0,
    aiMatchReason: hub.identity.headline || 'Matches your learning goals.',
    matchReasons: [
      ...expertise.slice(0, 3).map(s => `Teaches ${s}`),
      ...(hub.preferredStudentLevels?.length ? [`Works with ${hub.preferredStudentLevels.join(', ')} learners`] : []),
    ],
    availability: {
      today: hub.visibility === 'published' && !hub.vacationMode && todayOpen,
      thisWeek: hub.visibility === 'published' && !hub.vacationMode && hub.availability.some(d => d.enabled),
      onlineNow: false,
      slotsToday: hub.visibility === 'published' && !hub.vacationMode ? slotsToday : [],
      weekly,
    },
    reviews: [],
    avatarUrl: hub.identity.avatarUrl,
    fromTutorHub: true,
    demo: false,
  }
}

export function applyPublishedHubs(catalog: CatalogTutor[]): CatalogTutor[] {
  const published = loadPublishedHubs().map(catalogTutorFromHub)
  const next = catalog.filter(t => !published.some(p => p.id === t.id))
  return [...published, ...next]
}

export function sessionTypesFromHub(hub: TutorHub): SessionType[] {
  const minutes = hub.sessionDuration
  return hub.sessionOffers
    .filter(s => s.enabled && s.hourlyRate > 0)
    .map(s => ({
      id: s.id,
      label: s.label,
      minutes,
      price: Math.max(0, Math.round(s.hourlyRate * (minutes / 60))),
    }))
}

export function isHubDateAvailable(hub: TutorHub, date: Date) {
  if (hub.vacationMode || hub.visibility === 'paused') return false
  if (isDateBlocked(hub, date)) return false
  const row = hub.availability.find(d => d.day === weekdayFromDate(date))
  if (!row?.enabled) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const diffDays = Math.round((start.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return false
  if (diffDays > hub.maxAdvanceDays) return false
  const ranges = daySlotRanges(row)
  if (diffDays === 0) {
    const now = new Date()
    const latestEnd = Math.max(...ranges.map(r => toMinutes(r.end)))
    const end = new Date()
    end.setHours(Math.floor(latestEnd / 60), latestEnd % 60, 0, 0)
    const latest = new Date(now.getTime() + hub.minNoticeHours * 3600000)
    if (latest >= end) return false
  }
  return ranges.some(r => generateTimeSlots(r.start, r.end).length > 0)
}

export function hubSlotsForDate(hub: TutorHub, date: Date) {
  if (hub.vacationMode || hub.visibility === 'paused' || isDateBlocked(hub, date)) return []
  const row = hub.availability.find(d => d.day === weekdayFromDate(date))
  const slots = row?.enabled ? daySlotRanges(row).flatMap(r => generateTimeSlots(r.start, r.end)) : []
  const unique = [...new Set(slots)]
  const now = new Date()
  return unique.map(time => {
    let open = true
    if (isToday(date)) {
      const parsed = parseDisplayTime(time)
      if (parsed) {
        const when = new Date()
        when.setHours(parsed.h, parsed.m, 0, 0)
        if (when.getTime() < now.getTime() + hub.minNoticeHours * 3600000 + hub.bufferMinutes * 60000) open = false
      }
    }
    return { time, open }
  })
}

function parseDisplayTime(label: string) {
  const m = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const ap = m[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return { h, m: min }
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
  optional?: boolean
}

export interface ProfileStrength {
  percent: number
  items: ChecklistItem[]
  next: ChecklistItem | null
}

export function hasValidProfilePhoto(hub: TutorHub): boolean {
  const url = hub.identity.avatarUrl?.trim()
  return Boolean(url && !url.startsWith('data:'))
}

export function profileStrength(hub: TutorHub): ProfileStrength {
  const items: ChecklistItem[] = [
    { id: 'basic', label: 'Basic information', done: hub.identity.name.trim().length > 1 },
    { id: 'headline', label: 'Professional headline', done: hub.identity.headline.trim().length > 3 },
    { id: 'bio', label: 'Bio', done: hub.bio.trim().length >= 20 },
    { id: 'expertise', label: 'Expertise', done: hub.skills.length > 0 },
    {
      id: 'teaching',
      label: 'Teaching experience',
      done: hub.teachingStyles.length > 0 || hub.teachingPhilosophy.trim().length > 8,
    },
    { id: 'sessions', label: 'Session types', done: hub.sessionOffers.some(s => s.enabled) },
    { id: 'pricing', label: 'Pricing', done: hub.sessionOffers.some(s => s.enabled && s.hourlyRate > 0) },
    { id: 'availability', label: 'Availability', done: hub.availability.some(d => d.enabled) },
    { id: 'photo', label: 'Profile photo', done: hasValidProfilePhoto(hub) },
    { id: 'video', label: 'Add introduction video', done: Boolean(hub.introVideoUrl.trim()), optional: true },
    { id: 'portfolio', label: 'Add portfolio', done: hub.portfolioProjectIds.length > 0, optional: true },
  ]
  const required = items.filter(i => !i.optional)
  const percent = required.length
    ? Math.round((required.filter(i => i.done).length / required.length) * 100)
    : 0
  const next = items.find(i => !i.done && !i.optional) ?? items.find(i => !i.done) ?? null
  return { percent, items, next }
}

export function publishBlockers(hub: TutorHub) {
  const missing: string[] = []
  if (!hasValidProfilePhoto(hub)) missing.push('Profile photo')
  if (hub.identity.headline.trim().length < 4) missing.push('Professional headline')
  if (hub.bio.trim().length < 20) missing.push('Bio')
  if (!hub.skills.length) missing.push('Expertise')
  if (!hub.teachingStyles.length) missing.push('Teaching style')
  if (!hub.sessionOffers.some(s => s.enabled && s.hourlyRate > 0)) missing.push('Pricing')
  if (!hub.availability.some(d => d.enabled)) missing.push('Availability')
  if (!hub.sessionOffers.some(s => s.enabled)) missing.push('At least one session type')
  return missing
}

export function shouldShowOnboarding(hub: TutorHub) {
  if (hub.onboarding.completed || hub.onboarding.dismissed) return false
  return profileStrength(hub).percent < 70
}

export function coachTips(hub: TutorHub) {
  const tips: { text: string; action: 'improve' | 'session'; href?: string }[] = []
  const strength = profileStrength(hub)
  tips.push({ text: `Your profile is ${strength.percent}% complete.`, action: 'improve' })
  if (!hub.introVideoUrl.trim()) {
    tips.push({
      text: 'Add a 30-second introduction video to help students understand your teaching style.',
      action: 'improve',
      href: '#intro-video',
    })
  }
  const react = hub.skills.find(s => /react/i.test(s.name))
  const interviewOn = hub.sessionOffers.some(s => s.id === 'interview' && s.enabled)
  if (react && !interviewOn) {
    tips.push({
      text: `Your ${react.name} expertise is listed. Consider enabling an interview-preparation session if you teach that.`,
      action: 'session',
      href: '#session-types',
    })
  }
  if (!hasValidProfilePhoto(hub)) {
    tips.push({ text: 'Add a profile photo so students can recognize you.', action: 'improve', href: '#photo' })
  }
  if (hub.bio.trim().length < 20) {
    tips.push({ text: 'Write a short bio covering what you teach and how you help students learn.', action: 'improve', href: '#about' })
  }
  if (!hub.availability.some(d => d.enabled)) {
    tips.push({ text: 'Set weekly hours so students can book a time that works.', action: 'improve', href: '#availability' })
  }
  return tips.slice(0, 4)
}

export function suggestHeadline(hub: TutorHub) {
  const primary = hub.skills.find(s => s.primary)?.name || hub.skills[0]?.name
  const cat = hub.categories[0]
  if (primary && cat) return `${primary} Mentor · ${cat}`
  if (primary) return `${primary} Mentor`
  if (cat) return `${cat} Tutor & Mentor`
  return ''
}

export function suggestPhilosophy(hub: TutorHub) {
  const styles = hub.teachingStyles.slice(0, 3)
  if (!styles.length) return ''
  return `I teach in a ${styles.join(', ').toLowerCase()} way. Sessions stay tied to what you are actually building, then we practice until the idea sticks.`
}

export function verifyLabel(state: VerifyState) {
  if (state === 'verified') return 'Verified'
  if (state === 'pending') return 'Pending Verification'
  return 'Not Verified'
}

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function nextOnboardingTarget(step: number) {
  const map = ['#about', '#expertise', '#style', '#pricing', '#availability', '#verification', '#publish']
  return map[step] ?? '#about'
}
