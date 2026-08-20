import { computeReadiness, type BookingRow, type CareerProfile, type CertificateRow, type CourseRow, type ProjectRow, type StudentProjectRow } from './api'
import { loadSavedLessons, type SavedLesson } from './aiLearning'
import { getCareerSnapshot, type CareerSkill, type CareerSnapshot } from './careerCenter'
import { buildCatalog, loadLocalWishlist, type CatalogCourse } from './courseCatalog'
import { getCourseDetailPack } from './courseDetail'
import { kindLabel, loadHistory, loadInterviewCareerOverlay, relativeWhen, type InterviewRecord } from './interviewStudio'
import {
  appStats,
  buildJobProfile,
  EXPERIENCE,
  getJobById,
  JOB_ROLES,
  loadApps,
  rankCatalog,
  WORK_MODES,
  type ExperienceBand,
  type JobApplication,
  type JobRole,
  type WorkMode,
} from './jobRecommendations'
import { peekAuthUserId } from './supabase'
import {
  careerJobPath,
  careerResumePath,
  coursePath,
  projectPath,
  projectWorkspacePath,
  tutorBookPath,
  tutorPath,
} from './paths'
import {
  buildProjectCatalog,
  loadAllProgress,
  loadPortfolioIds,
  loadProjectWishlist,
  type CatalogProject,
  type ProjectProgress,
} from './projectWorkspace'
import { loadActiveId, loadDocs, loadResumeCareerOverlay, type ResumeDoc } from './resumeBuilder'
import { buildTutorCatalog, loadTutorWishlist } from './tutorMarketplace'

export type ProfileVisibility = 'private' | 'recruiter' | 'public'
export type SavedTab = 'Courses' | 'Projects' | 'Lessons' | 'Jobs' | 'Tutors'

export interface ProfileExtras {
  phone: string
  location: string
  targetRole: string
  experienceLevel: ExperienceBand | ''
  workMode: WorkMode | ''
  interests: string[]
  linkedin: string
  github: string
  portfolio: string
  learningGoals: string
  weeklyTargetHours: number
  visibility: ProfileVisibility
  bestStreak: number
}

const EXTRAS_KEY = 'learnsyra_profile_extras'

function extrasStorageKey(userId?: string | null) {
  const uid = userId || peekAuthUserId()
  return uid ? `${EXTRAS_KEY}:${uid}` : null
}

export const EMPTY_EXTRAS: ProfileExtras = {
  phone: '',
  location: '',
  targetRole: '',
  experienceLevel: '',
  workMode: '',
  interests: [],
  linkedin: '',
  github: '',
  portfolio: '',
  learningGoals: '',
  weeklyTargetHours: 0,
  visibility: 'private',
  bestStreak: 0,
}

export function loadProfileExtras(userId?: string | null): ProfileExtras {
  const key = extrasStorageKey(userId)
  if (!key) return { ...EMPTY_EXTRAS }
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { ...EMPTY_EXTRAS }
    return { ...EMPTY_EXTRAS, ...(JSON.parse(raw) as Partial<ProfileExtras>) }
  } catch {
    return { ...EMPTY_EXTRAS }
  }
}

export function saveProfileExtras(extras: ProfileExtras, userId?: string | null) {
  const key = extrasStorageKey(userId)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(extras))
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function skillLevel(score: number) {
  if (score >= 80) return 'Advanced'
  if (score >= 65) return 'Intermediate'
  if (score >= 40) return 'Developing'
  return 'Beginner'
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
  href: string
}

export interface HubActivity {
  when: string
  text: string
  meta?: string
}

export interface SavedLink {
  id: string
  title: string
  href: string
  detail?: string
}

export interface StudentHub {
  name: string
  email: string
  avatar: string | null
  headline: string
  targetRole: string
  careerMatch: number
  readiness: number
  completion: number
  checklist: ChecklistItem[]
  nextStep: ChecklistItem | null
  stats: { courses: number; projects: number; skills: number; achievements: number; interviews: number }
  currentCourse: { id: string; title: string; progress: number; done: number; total: number; href: string } | null
  activityWeek: { label: string; hours: number }[]
  weekHours: number
  weekSample: boolean
  streak: number
  bestStreak: number
  skills: Array<CareerSkill & { level: string; verified: boolean; source: string }>
  verified: Array<CareerSkill & { level: string; source: string }>
  gaps: CareerSkill[]
  projects: Array<{ id: string; title: string; score: number; skills: string[]; status: string; href: string; workspace: string }>
  projectStats: { completed: number; portfolio: number; review: number }
  portfolioReady: number
  portfolioChecks: { label: string; ok: boolean }[]
  resume: { name: string; score: number; jobMatch: number; updated: string } | null
  career: CareerSnapshot
  interviews: InterviewRecord[]
  interviewTrend: number[]
  tutor: {
    name: string
    tutorId: string
    session: string
    minutes: number
    rating: number
    status: string
    summary: string
    sessionHref: string | null
    bookHref: string
  } | null
  completedCourses: Array<{ id: string; title: string; href: string }>
  completions: Array<{ title: string; completed: string; official: boolean }>
  achievements: Array<{ id: string; label: string; earned: boolean; hint: string }>
  saved: Record<SavedTab, SavedLink[]>
  jobs: { saved: number; applied: number; interviews: number; offers: number; bestMatch: number }
  activity: HubActivity[]
  xp: CareerSnapshot['xp']
  extras: ProfileExtras
}

function pickResume(): ResumeDoc | undefined {
  const docs = loadDocs()
  const active = loadActiveId()
  return docs.find(d => d.id === active) ?? docs.find(d => d.isDefault) ?? docs[0]
}

function mergeExtras(extras: ProfileExtras, resume: ResumeDoc | undefined, career: CareerSnapshot): ProfileExtras {
  return {
    ...extras,
    phone: extras.phone || resume?.contact.phone || '',
    location: extras.location || resume?.contact.location || '',
    targetRole: extras.targetRole || career.targetRole || '',
    linkedin: extras.linkedin || resume?.contact.linkedin || '',
    github: extras.github || resume?.contact.github || '',
    portfolio: extras.portfolio || resume?.contact.portfolio || '',
  }
}

export function buildStudentHub(input: {
  name: string
  email: string
  avatar: string | null
  headline: string | null
  extras: ProfileExtras
  enrolled: { id: string; title: string; progress: number; last_lesson_id: string | null }[]
  apiCourses: CourseRow[]
  apiProjects: ProjectRow[]
  studentProjects: StudentProjectRow[]
  certs: CertificateRow[]
  stats: { streak: number; weekHours: number; completedLessons: number }
  careerProfile?: CareerProfile | null
  bookings?: BookingRow[]
}): StudentHub {
  const uid = peekAuthUserId()
  const titleById = new Map(input.apiProjects.map(p => [p.id, p.title]))
  const portfolio = input.studentProjects.map(row => ({
    id: row.id,
    title: titleById.get(row.project_id) || 'Project',
    score: 0,
    skills: input.apiProjects.find(p => p.id === row.project_id)?.skills ?? [],
    status: (row.status === 'completed' ? 'Portfolio Ready' : 'Needs Review') as 'Portfolio Ready' | 'Needs Review',
    href: `/projects/${row.project_id}`,
  }))
  const certificates = input.certs.map(r => ({
    title: r.title,
    completed: new Date(r.issued_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    official: true,
  }))
  const hasActivity =
    Boolean(input.careerProfile?.target_role?.trim()) ||
    (input.careerProfile?.skills?.length ?? 0) > 0 ||
    input.certs.length > 0 ||
    input.studentProjects.length > 0 ||
    input.enrolled.length > 0
  const readiness = hasActivity
    ? computeReadiness({
        enrolledCount: input.enrolled.length,
        avgProgress:
          input.enrolled.length > 0
            ? input.enrolled.reduce((s, e) => s + (e.progress ?? 0), 0) / input.enrolled.length
            : 0,
        submittedProjects: input.studentProjects.filter(p => p.status === 'submitted' || p.status === 'completed').length,
        resumeLength: input.careerProfile?.resume_text?.trim().length ?? 0,
        targetRole: input.careerProfile?.target_role ?? '',
      })
    : 0
  const career = getCareerSnapshot({
    userId: uid,
    targetRole: input.careerProfile?.target_role,
    readiness: hasActivity ? readiness : undefined,
    skills: input.careerProfile?.skills,
    certificates,
    portfolio,
  })
  const resume = pickResume()
  const extras = mergeExtras(input.extras, resume, career)
  const overlay = loadResumeCareerOverlay(uid)
  const courses = buildCatalog(input.apiCourses)
  const projects = buildProjectCatalog(input.apiProjects)
  const progressMap = loadAllProgress()
  const history = loadHistory().slice().sort((a, b) => +new Date(b.completedAt) - +new Date(a.completedAt))
  const apps = loadApps()
  const jobStats = appStats(apps)
  const profile = buildJobProfile({
    targetRole: extras.targetRole,
    haveSkills: career.haveSkills,
    gapSkills: career.needSkills,
    projects: career.portfolio.map(p => ({ id: p.id, title: p.title, skills: p.skills })),
    interviewScore: loadInterviewCareerOverlay(uid)?.interviewAfter ?? career.interview.overall,
    resumeScore: overlay?.resumeScore ?? career.resume.score,
    resumeSkills: resume?.skills.filter(s => s.included).map(s => s.name),
  })
  const hasJobSignal = Boolean(
    extras.targetRole.trim() &&
      (career.haveSkills.length || career.portfolio.length || overlay || career.interview.overall > 0),
  )
  const ranked = hasJobSignal ? rankCatalog(profile) : []
  const bestMatch = ranked.reduce((m, j) => Math.max(m, j.matchScore), 0)

  const skills = career.skills.map(s => ({
    ...s,
    level: skillLevel(s.score),
    verified: s.status === 'strong',
    source: s.status === 'strong' ? 'Course + Project' : 'Practice still open',
  }))

  const projectRows = projects
    .map(p => {
      const prog = progressMap[p.id]
      const api = input.studentProjects.find(r => r.project_id === p.id)
      const status = prog?.status ?? (api?.status === 'completed' ? 'completed' : api?.status === 'submitted' ? 'submitted' : 'not-started')
      const inPortfolio = loadPortfolioIds().includes(p.id) || prog?.inPortfolio
      if (status === 'not-started' && !inPortfolio) return null
      const score = prog?.score ?? (status === 'completed' ? p.review.finalOverall : p.review.overall)
      const ready = status === 'completed' || Boolean(inPortfolio)
      return {
        id: p.id,
        title: p.title,
        score,
        skills: p.skills.slice(0, 3),
        status: ready ? 'Portfolio Ready' : status === 'submitted' ? 'Needs Review' : 'In Progress',
        href: projectPath(p.id),
        workspace: projectWorkspacePath(p.id),
      }
    })
    .filter(Boolean) as StudentHub['projects']

  const shownProjects =
    projectRows.length > 0
      ? projectRows
      : career.portfolio.map(p => ({
          id: p.id,
          title: p.title,
          score: p.score,
          skills: p.skills,
          status: p.status,
          href: p.href.startsWith('/projects/') ? p.href : projectPath(p.id),
          workspace: p.id.startsWith('catalog-') ? projectWorkspacePath(p.id) : '/projects',
        }))

  const completedProjects = shownProjects.filter(p => p.status === 'Portfolio Ready')
  const reviewProjects = shownProjects.filter(p => p.status === 'Needs Review')
  const completedCourses = completedCourseList(input.enrolled, input.certs)
  const currentCourse = currentLearning(courses, input.enrolled)

  const hasName = input.name.trim().length > 1
  const hasGoal = Boolean(extras.targetRole)
  const hasSkills = career.haveSkills.length > 0
  const hasProjects = shownProjects.length > 0
  const hasResume = Boolean(resume || overlay)
  const hasExperience = Boolean(resume?.experience.some(e => e.company || e.title))
  const hasPortfolioLink = Boolean(extras.portfolio.trim())

  const checklist: ChecklistItem[] = [
    { id: 'basic', label: 'Basic information', done: hasName, href: '/profile' },
    { id: 'goal', label: 'Career goal', done: hasGoal, href: '/career' },
    { id: 'skills', label: 'Skills', done: hasSkills, href: '/courses' },
    { id: 'projects', label: 'Projects', done: hasProjects, href: '/projects' },
    { id: 'resume', label: 'Resume', done: hasResume, href: careerResumePath() },
    { id: 'experience', label: 'Experience', done: hasExperience, href: careerResumePath() },
    { id: 'portfolio', label: 'Portfolio link', done: hasPortfolioLink, href: '/profile' },
  ]
  const nextStep = checklist.find(c => !c.done) ?? null
  const completion = Math.round((checklist.filter(c => c.done).length / checklist.length) * 100)

  const achievements = buildAchievements({
    skills,
    completedProjects: completedProjects.length,
    streak: input.stats.streak,
    history,
    readiness: career.readinessScore,
  })

  const week = weekActivity(input.stats.weekHours)
  const bestStreak = Math.max(extras.bestStreak, input.stats.streak)
  const recentBook = (input.bookings ?? []).slice().sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0]
  const tutor = recentBook
    ? tutorFromApiBooking(recentBook)
    : career.tutorImpact.name
      ? {
          name: career.tutorImpact.name,
          tutorId: career.tutorImpact.tutorId,
          session: career.tutorImpact.session,
          minutes: 0,
          rating: 0,
          status: career.tutorImpact.session ? 'Completed' : '',
          summary: career.tutorImpact.feedback,
          sessionHref: null as string | null,
          bookHref: tutorBookPath(career.tutorImpact.tutorId),
        }
      : null

  const resumeCheck = overlay?.checks ?? career.resume.checks
  const portfolioChecks = [
    { label: 'Projects added', ok: shownProjects.length > 0 },
    { label: 'Skills attached', ok: shownProjects.some(p => p.skills.length > 0) },
    { label: 'Resume connected', ok: hasResume },
    { label: 'Project descriptions', ok: resumeCheck.find(c => /project/i.test(c.label))?.ok ?? false },
  ]

  return {
    name: input.name,
    email: input.email,
    avatar: input.avatar,
    headline: input.headline?.trim() || extras.targetRole || 'LearnSyra student',
    targetRole: extras.targetRole,
    careerMatch: career.targetMatch,
    readiness: career.readinessScore,
    completion,
    checklist,
    nextStep,
    stats: {
      courses: completedCourses.length,
      projects: completedProjects.length || shownProjects.length,
      skills: skills.length,
      achievements: achievements.filter(a => a.earned).length,
      interviews: history.length,
    },
    currentCourse,
    activityWeek: week.days,
    weekHours: week.weekHours,
    weekSample: week.sample,
    streak: input.stats.streak,
    bestStreak,
    skills,
    verified: skills.filter(s => s.verified),
    gaps: career.skills.filter(s => s.status === 'improve'),
    projects: shownProjects.slice(0, 4),
    projectStats: {
      completed: completedProjects.length,
      portfolio: shownProjects.filter(p => p.status === 'Portfolio Ready').length,
      review: reviewProjects.length,
    },
    portfolioReady: Math.round((portfolioChecks.filter(c => c.ok).length / portfolioChecks.length) * 100),
    portfolioChecks,
    resume: resume || overlay
      ? {
          name: resume?.versionName ?? `${extras.targetRole} Resume`,
          score: overlay?.resumeScore ?? career.resume.score,
          jobMatch: overlay?.roleMatch ?? career.targetMatch,
          updated: resume ? relativeResume(resume.updatedAt) : 'Saved',
        }
      : null,
    career,
    interviews: history.slice(0, 5),
    interviewTrend: history.slice().reverse().map(h => h.score).slice(-5),
    tutor,
    completedCourses,
    completions: completionsList(input.certs, career),
    achievements,
    saved: savedBuckets(courses, projects, apps, buildTutorCatalog([])),
    jobs: {
      saved: jobStats.saved,
      applied: jobStats.applied,
      interviews: jobStats.interviews,
      offers: jobStats.offers,
      bestMatch,
    },
    activity: buildActivity(history, progressMap, projects, overlay, career),
    xp: career.xp,
    extras,
  }
}

function tutorFromApiBooking(booking: BookingRow) {
  return {
    name: booking.listing?.name ?? 'Tutor',
    tutorId: booking.tutor_listing_id,
    session: booking.message?.trim() || `Session · ${booking.status}`,
    minutes: 0,
    rating: 0,
    status: booking.status === 'completed' ? 'Completed' : booking.status,
    summary: '',
    sessionHref: `/sessions/${booking.id}` as string | null,
    bookHref: tutorBookPath(booking.tutor_listing_id),
  }
}

function relativeResume(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function completedCourseList(
  enrolled: { id: string; title: string; progress: number }[],
  certs: CertificateRow[],
) {
  const done = new Map<string, { id: string; title: string; href: string }>()
  enrolled.filter(c => c.progress >= 100).forEach(c => done.set(c.id, { id: c.id, title: c.title, href: coursePath(c.id) }))
  certs.forEach(c => {
    const id = c.course_id || c.id
    if (![...done.values()].some(x => x.title === c.title)) {
      done.set(id, { id, title: c.title, href: c.course_id ? coursePath(c.course_id) : '/courses' })
    }
  })
  return [...done.values()]
}

function currentLearning(
  catalog: CatalogCourse[],
  enrolled: { id: string; title: string; progress: number; last_lesson_id: string | null }[],
) {
  const open = enrolled.find(c => c.progress < 100) ?? enrolled[0]
  if (!open) return null
  const pick = catalog.find(c => c.id === open.id)
  const pack = pick ? getCourseDetailPack(pick) : null
  const total = pack
    ? pack.lessonCount || pack.sections.reduce((s, sec) => s + sec.lessons.length, 0) || 0
    : 0
  const pct = open.progress
  const done = total ? Math.round((pct / 100) * total) : 0
  const last = open.last_lesson_id
  return {
    id: open.id,
    title: open.title,
    progress: pct,
    done,
    total,
    href: last ? `/courses/${open.id}/learn/${last}` : coursePath(open.id),
  }
}

function weekActivity(realHours: number) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return {
    sample: false,
    weekHours: realHours,
    days: labels.map(label => ({ label, hours: 0 })),
  }
}

function buildAchievements(input: {
  skills: StudentHub['skills']
  completedProjects: number
  streak: number
  history: InterviewRecord[]
  readiness: number
}) {
  const chrono = input.history.slice().sort((a, b) => +new Date(a.completedAt) - +new Date(b.completedAt))
  const improved = chrono.length >= 2 && chrono[chrono.length - 1].score > chrono[0].score
  return [
    { id: 'react', label: 'React Builder', earned: input.skills.some(s => s.name === 'React' && s.verified), hint: 'Verified React through LearnSyra course or project work' },
    { id: 'project', label: 'Project Finisher', earned: input.completedProjects > 0, hint: input.completedProjects > 0 ? 'Earned on a completed project' : 'Complete a project to unlock' },
    { id: 'streak', label: '7-Day Streak', earned: input.streak >= 7, hint: input.streak >= 7 ? `${input.streak}-day streak` : 'Complete lessons on 7 days in a row' },
    { id: 'interview', label: 'Interview Improver', earned: improved, hint: improved ? 'Latest mock scored higher than an earlier one' : 'Complete another mock to show improvement' },
    { id: 'career', label: 'Career Ready', earned: input.readiness >= 90, hint: 'Reach 90% career readiness' },
    { id: 'ten', label: '10 Projects', earned: input.completedProjects >= 10, hint: 'Complete 10 projects' },
  ]
}

function completionsList(certs: CertificateRow[], career: CareerSnapshot) {
  if (certs.length) {
    return certs.map(c => ({
      title: c.title,
      completed: new Date(c.issued_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      official: true,
    }))
  }
  return career.certificates.map(c => ({ title: c.title, completed: c.completed, official: c.official }))
}

function savedBuckets(
  courses: CatalogCourse[],
  projects: CatalogProject[],
  apps: Record<string, JobApplication>,
  tutors: ReturnType<typeof buildTutorCatalog>,
): Record<SavedTab, SavedLink[]> {
  const lessons = loadSavedLessons()
  return {
    Courses: loadLocalWishlist().map(id => {
      const c = courses.find(x => x.id === id)
      return { id, title: c?.title ?? 'Saved course', href: coursePath(id), detail: c?.instructor }
    }),
    Projects: loadProjectWishlist().map(id => {
      const p = projects.find(x => x.id === id)
      return { id, title: p?.title ?? 'Saved project', href: projectPath(id), detail: p?.skills.slice(0, 3).join(' · ') }
    }),
    Lessons: lessons.map((l: SavedLesson) => ({
      id: l.id,
      title: l.title,
      href: '/ai-learning',
      detail: l.tags.slice(0, 3).join(' · '),
    })),
    Jobs: Object.values(apps).filter(a => a.saved).map(a => {
      const job = getJobById(a.jobId)
      return { id: a.jobId, title: job?.title ?? 'Saved role', href: careerJobPath(a.jobId), detail: job?.company }
    }),
    Tutors: loadTutorWishlist().map(id => {
      const t = tutors.find(x => x.id === id)
      return { id, title: t?.name ?? 'Saved tutor', href: tutorPath(id), detail: t?.title }
    }),
  }
}

function buildActivity(
  history: InterviewRecord[],
  progress: Record<string, ProjectProgress>,
  projects: CatalogProject[],
  overlay: ReturnType<typeof loadResumeCareerOverlay>,
  career: CareerSnapshot,
): HubActivity[] {
  const rows: HubActivity[] = []
  history.slice(0, 3).forEach(h => {
    rows.push({ when: relativeWhen(h.completedAt), text: `Completed ${kindLabel(h.type)} interview`, meta: `${h.score} / 100` })
  })
  Object.entries(progress).forEach(([id, p]) => {
    if (!p.completedAt) return
    const proj = projects.find(x => x.id === id)
    rows.push({
      when: relativeWhen(p.completedAt),
      text: `Completed ${proj?.title ?? 'a project'}`,
      meta: p.score != null ? `${p.score} / 100` : undefined,
    })
  })
  if (overlay) rows.push({ when: 'Resume', text: 'Resume readiness on file', meta: `${overlay.resumeScore}%` })
  if (!rows.length) career.activity.forEach(a => rows.push({ when: a.when, text: a.text }))
  return rows.slice(0, 8)
}

export const PROFILE_ROLES: JobRole[] = [...JOB_ROLES]
export const PROFILE_EXPERIENCE = EXPERIENCE
export const PROFILE_MODES = WORK_MODES

export function insightCopy(hub: StudentHub) {
  if (!hub.targetRole && hub.skills.length === 0 && hub.gaps.length === 0) {
    return 'Choose a career goal and complete your first course to start building your career profile.'
  }
  const gap = hub.gaps[0]?.name
  if (gap) {
    return hub.targetRole
      ? `Your biggest opportunity for ${hub.targetRole} roles is adding ${gap} experience.`
      : `Add ${gap} experience to strengthen your career profile.`
  }
  return 'Keep learning, building projects, and practicing interviews to grow your career profile.'
}

export function goalMilestones(hub: StudentHub) {
  if (hub.skills.length === 0) {
    return [
      { name: 'Choose a career goal', done: Boolean(hub.targetRole.trim()) },
      { name: 'Enroll in a course', done: Boolean(hub.currentCourse) || hub.stats.courses > 0 },
      { name: 'Complete a project', done: hub.projectStats.completed > 0 },
      { name: 'Interview Ready', done: hub.career.interview.overall >= 80 },
    ]
  }
  return [
    ...hub.skills.slice(0, 5).map(s => ({
      name: s.name,
      done: s.verified || hub.career.haveSkills.includes(s.name),
    })),
    { name: 'Interview Ready', done: hub.career.interview.overall >= 80 },
  ]
}
