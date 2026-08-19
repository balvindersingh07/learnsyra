import type { CertificateRow, CourseRow, ProjectRow, StudentProjectRow } from './api'
import { loadSavedLessons, type SavedLesson } from './aiLearning'
import { getCareerSnapshot, type CareerSkill, type CareerSnapshot } from './careerCenter'
import { buildCatalog, loadLocalWishlist, type CatalogCourse } from './courseCatalog'
import { getCourseDetailPack, loadLocalEnroll } from './courseDetail'
import { kindLabel, loadHistory, loadInterviewCareerOverlay, relativeWhen, type InterviewRecord } from './interviewStudio'
import {
  appStats,
  buildJobProfile,
  EXPERIENCE,
  getJobById,
  JOB_ROLES,
  loadApps,
  loadTargetRole,
  rankCatalog,
  WORK_MODES,
  type ExperienceBand,
  type JobApplication,
  type JobRole,
  type WorkMode,
} from './jobRecommendations'
import { loadLocalDone } from './lessonWorkspace'
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
import { buildTutorCatalog, loadTutorBookings, loadTutorWishlist, type TutorBooking } from './tutorMarketplace'

export type ProfileVisibility = 'private' | 'recruiter' | 'public'
export type SavedTab = 'Courses' | 'Projects' | 'Lessons' | 'Jobs' | 'Tutors'

export interface ProfileExtras {
  phone: string
  location: string
  targetRole: string
  experienceLevel: ExperienceBand
  workMode: WorkMode
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

export const EMPTY_EXTRAS: ProfileExtras = {
  phone: '',
  location: '',
  targetRole: '',
  experienceLevel: 'Junior',
  workMode: 'Remote',
  interests: [],
  linkedin: '',
  github: '',
  portfolio: '',
  learningGoals: '',
  weeklyTargetHours: 6,
  visibility: 'private',
  bestStreak: 0,
}

export function loadProfileExtras(): ProfileExtras {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY)
    if (!raw) return { ...EMPTY_EXTRAS }
    return { ...EMPTY_EXTRAS, ...(JSON.parse(raw) as Partial<ProfileExtras>) }
  } catch {
    return { ...EMPTY_EXTRAS }
  }
}

export function saveProfileExtras(extras: ProfileExtras) {
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras))
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
    targetRole: extras.targetRole || loadTargetRole(career.targetRole),
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
}): StudentHub {
  const career = getCareerSnapshot()
  const resume = pickResume()
  const extras = mergeExtras(input.extras, resume, career)
  const overlay = loadResumeCareerOverlay()
  const courses = buildCatalog(input.apiCourses)
  const projects = buildProjectCatalog(input.apiProjects)
  const progressMap = loadAllProgress()
  const localEnroll = new Set(loadLocalEnroll())
  const history = loadHistory().slice().sort((a, b) => +new Date(b.completedAt) - +new Date(a.completedAt))
  const apps = loadApps()
  const jobStats = appStats(apps)
  const profile = buildJobProfile({
    targetRole: extras.targetRole,
    haveSkills: career.haveSkills,
    gapSkills: career.needSkills,
    projects: career.portfolio.map(p => ({ id: p.id, title: p.title, skills: p.skills })),
    interviewScore: loadInterviewCareerOverlay()?.interviewAfter ?? career.interview.overall,
    resumeScore: overlay?.resumeScore ?? career.resume.score,
    resumeSkills: resume?.skills.filter(s => s.included).map(s => s.name),
  })
  const ranked = rankCatalog(profile)
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
  const completedCourses = completedCourseList(courses, input.enrolled, input.certs)
  const currentCourse = currentLearning(courses, input.enrolled, localEnroll)

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
  const bookings = loadTutorBookings()
  const tutors = buildTutorCatalog([])
  const recentBook = bookings.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]
  const tutor = recentBook
    ? tutorFromBooking(recentBook, tutors, career)
    : {
        name: career.tutorImpact.name,
        tutorId: career.tutorImpact.tutorId,
        session: career.tutorImpact.session,
        minutes: 60,
        rating: 5,
        status: 'Career Center record',
        summary: career.tutorImpact.feedback,
        sessionHref: null as string | null,
        bookHref: tutorBookPath(career.tutorImpact.tutorId),
      }

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
    saved: savedBuckets(courses, projects, apps, tutors),
    jobs: {
      saved: jobStats.saved,
      applied: jobStats.applied,
      interviews: jobStats.interviews,
      offers: jobStats.offers,
      bestMatch,
    },
    activity: buildActivity(history, progressMap, projects, bookings, overlay, career),
    xp: career.xp,
    extras,
  }
}

function tutorFromBooking(
  booking: TutorBooking,
  tutors: ReturnType<typeof buildTutorCatalog>,
  career: CareerSnapshot,
) {
  const t = tutors.find(x => x.id === booking.tutorId)
  return {
    name: t?.name ?? 'Tutor',
    tutorId: booking.tutorId,
    session: booking.sessionLabel,
    minutes: booking.duration,
    rating: t?.rating ?? 5,
    status: booking.status === 'completed' ? 'Completed' : booking.status,
    summary: career.tutorImpact.feedback,
    sessionHref: `/sessions/${booking.id}`,
    bookHref: tutorBookPath(booking.tutorId),
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
  catalog: CatalogCourse[],
  enrolled: { id: string; title: string; progress: number }[],
  certs: CertificateRow[],
) {
  const done = new Map<string, { id: string; title: string; href: string }>()
  enrolled.filter(c => c.progress >= 100).forEach(c => done.set(c.id, { id: c.id, title: c.title, href: coursePath(c.id) }))
  catalog.forEach(c => {
    const pack = getCourseDetailPack(c)
    const finished = loadLocalDone(c.id)
    if (pack.lessonCount && finished.length >= pack.lessonCount) {
      done.set(c.id, { id: c.id, title: c.title, href: coursePath(c.id) })
    }
  })
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
  localEnroll: Set<string>,
) {
  const open = enrolled.find(c => c.progress < 100) ?? enrolled[0]
  const pick =
    (open && catalog.find(c => c.id === open.id)) ||
    catalog.find(c => localEnroll.has(c.id)) ||
    catalog.find(c => c.title === 'Full Stack Web Development') ||
    catalog[0]
  if (!pick) return null
  const pack = getCourseDetailPack(pick)
  const total = pack.lessonCount || pack.sections.reduce((s, sec) => s + sec.lessons.length, 0) || 1
  const localDone = loadLocalDone(pick.id).length
  const apiPct = open && open.id === pick.id ? open.progress : 0
  const pct = apiPct || Math.round((localDone / total) * 100)
  const done = apiPct ? Math.round((apiPct / 100) * total) : localDone
  const last = open?.last_lesson_id
  return {
    id: pick.id,
    title: pick.title,
    progress: pct,
    done,
    total,
    href: last ? `/courses/${pick.id}/learn/${last}` : coursePath(pick.id),
  }
}

function weekActivity(realHours: number) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  if (realHours > 0) {
    const weights = [0.16, 0.2, 0.12, 0.22, 0.14, 0.12, 0.04]
    return {
      sample: false,
      weekHours: realHours,
      days: labels.map((label, i) => ({ label, hours: Math.round(realHours * weights[i] * 10) / 10 })),
    }
  }
  const mins = [45, 70, 35, 90, 40, 35, 5]
  return {
    sample: true,
    weekHours: Math.round((mins.reduce((a, b) => a + b, 0) / 60) * 10) / 10,
    days: labels.map((label, i) => ({ label, hours: mins[i] / 60 })),
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
  bookings: TutorBooking[],
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
  bookings.filter(b => b.status === 'completed').slice(0, 2).forEach(b => {
    rows.push({ when: relativeWhen(b.createdAt), text: `Tutor session · ${b.sessionLabel}` })
  })
  if (overlay) rows.push({ when: 'Resume', text: 'Resume readiness on file', meta: `${overlay.resumeScore}%` })
  if (!rows.length) career.activity.forEach(a => rows.push({ when: a.when, text: a.text }))
  return rows.slice(0, 8)
}

export const PROFILE_ROLES: JobRole[] = [...JOB_ROLES]
export const PROFILE_EXPERIENCE = EXPERIENCE
export const PROFILE_MODES = WORK_MODES

export function insightCopy(hub: StudentHub) {
  const gap = hub.gaps[0]?.name
  const gap2 = hub.gaps[1]?.name
  const extra = gap && gap2 ? `${gap} and ${gap2}` : gap || 'a remaining skill'
  return `Your profile is strong for ${hub.targetRole} roles. Your biggest opportunity is adding ${extra} experience.`
}

export function goalMilestones(hub: StudentHub) {
  const names = ['React', 'JavaScript', 'REST APIs', 'TypeScript', 'Testing']
  return [
    ...names.map(name => ({
      name,
      done: hub.skills.find(s => s.name === name)?.verified ?? hub.career.haveSkills.includes(name),
    })),
    { name: 'Interview Ready', done: hub.career.interview.overall >= 80 },
  ]
}
