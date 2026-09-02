import type { CareerProfile } from './api'
import type { Page } from './paths'
import { peekAuthUserId } from './supabase'

export interface MissionTask {
  id: string
  icon: string
  title: string
  minutes: number
  page: Page
}

export interface DailyMission {
  focus: string
  subtitle: string
  personalized: boolean
  tasks: MissionTask[]
}

export interface SkillDnaItem {
  name: string
  score: number
}

export interface RoadmapStep {
  label: string
  icon: string
  done: boolean
  current: boolean
  locked: boolean
  pct: number
  page: Page
  hint: string
}

export interface CareerBreakdown {
  skills: number
  projects: number
  resume: number
  interview: number
  communication: number
}

export interface RecommendedProject {
  title: string
  difficulty: string
  time: string
  skills: string[]
  badges: string[]
  catalog: boolean
}

export interface CareerMatchPreview {
  role: string
  match: number
  have: string[]
  improve: string[]
}

export interface WeeklyActivity {
  days: { label: string; hours: number }[]
  weekHours: number
  deltaPct: number
}

export interface AchievementBadge {
  icon: string
  label: string
  earned: boolean
  hint: string
}

export interface TutorContext {
  topic: string
  weakSkill: string
  currentLesson: string
}

export interface NextBestAction {
  title: string
  body: string
  minutes: number
  page: Page
}

export interface LearningInsight {
  label: string
  value: string
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function hasCareerSignal(career: CareerProfile | null) {
  return Boolean(
    career?.target_role?.trim() ||
      (career?.skills?.length ?? 0) > 0 ||
      career?.resume_text?.trim(),
  )
}

export function formatActivityLabel(hours: number) {
  const mins = Math.round(hours * 60)
  if (mins <= 0) return '0 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function buildRoadmap(input: {
  enrolledCount: number
  avgProgress: number
  careerScore: number
  submittedProjects: number
}): RoadmapStep[] {
  const { enrolledCount, avgProgress, careerScore, submittedProjects } = input
  const beginnerPct = enrolledCount > 0 ? 100 : 0
  const fundPct = enrolledCount > 0 ? avgProgress : 0
  const projPct = clamp(submittedProjects * 40)
  const advPct = avgProgress >= 50 ? avgProgress : 0
  const interviewPct = careerScore
  const jobPct = careerScore >= 90 ? 100 : careerScore >= 70 ? clamp(careerScore - 15) : 0

  const steps: Omit<RoadmapStep, 'done' | 'current' | 'locked'>[] = [
    { label: 'Start learning', icon: '🌱', pct: beginnerPct, page: 'courses', hint: 'Enroll in a course to begin' },
    { label: 'Keep learning', icon: '📖', pct: fundPct, page: 'courses', hint: 'Complete lessons in your course' },
    { label: 'Build a project', icon: '🔨', pct: projPct, page: 'projects', hint: 'Submit a project after you start learning' },
    { label: 'Go deeper', icon: '⚡', pct: advPct, page: 'courses', hint: 'Keep going after your first projects' },
    { label: 'Practice interview', icon: '🎯', pct: interviewPct, page: 'career', hint: 'Try a mock interview when you are ready' },
    { label: 'Get job-ready', icon: '💼', pct: jobPct, page: 'career', hint: 'Career Center uses your real activity' },
  ]

  const firstOpen = steps.findIndex(s => s.pct < 100)
  return steps.map((s, i) => {
    const done = s.pct >= 100
    const current = !done && (firstOpen === -1 ? i === steps.length - 1 : i === firstOpen)
    const locked = !done && !current && i > (firstOpen === -1 ? steps.length : firstOpen)
    const hint = done
      ? 'Completed · 100%'
      : current
        ? s.pct > 0
          ? `${s.pct}% complete`
          : s.hint
        : s.hint
    return { ...s, done, current, locked, hint }
  })
}

export function formatSessionWhen(iso?: string) {
  if (!iso) return 'Scheduled'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Scheduled'
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function buildDashboardIntel(input: {
  firstName: string
  enrolled: { title: string; category: string | null; progress: number }[]
  stats: {
    streak: number
    level: number
    weekHours: number
    careerScore: number
    completedLessons: number
    weekDays?: { label: string; hours: number }[]
  }
  career: CareerProfile | null
  submittedCount: number
}) {
  const { firstName, enrolled, stats, career, submittedCount } = input
  const avgProgress = enrolled.length
    ? Math.round(enrolled.reduce((s, c) => s + c.progress, 0) / enrolled.length)
    : 0
  const live = Boolean(
    enrolled.length ||
      submittedCount > 0 ||
      stats.completedLessons > 0 ||
      stats.weekHours > 0 ||
      hasCareerSignal(career),
  )
  const careerScore = hasCareerSignal(career) ? stats.careerScore : 0
  const currentCourse = enrolled[0]?.title ?? ''

  const skillDna: SkillDnaItem[] = (career?.skills ?? [])
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => ({ name, score: 0 }))
  const measured = skillDna.filter(s => s.score > 0)
  const strongest = measured[0]?.name ?? ''
  const weakest = measured.length > 1 ? measured[measured.length - 1]?.name ?? '' : ''

  const breakdown: CareerBreakdown = {
    skills: live ? clamp(avgProgress) : 0,
    projects: live ? clamp(submittedCount * 22) : 0,
    resume: career?.resume_text
      ? career.resume_text.trim().length > 80
        ? 70
        : career.resume_text.trim()
          ? 30
          : 0
      : 0,
    interview: live ? clamp(careerScore * 0.45) : 0,
    communication: 0,
  }

  const project: RecommendedProject = {
    title: 'Explore Projects',
    difficulty: '',
    time: '',
    skills: [],
    badges: ['Catalog'],
    catalog: true,
  }

  const careerMatch: CareerMatchPreview = {
    role: career?.target_role?.trim() || '',
    match: 0,
    have: career?.skills ?? [],
    improve: [],
  }

  const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const activity: WeeklyActivity = {
    weekHours: stats.weekHours,
    deltaPct: 0,
    days: stats.weekDays?.length === 7 ? stats.weekDays : labels.map(label => ({ label, hours: 0 })),
  }

  const xp = stats.completedLessons * 25 + submittedCount * 50
  const xpTarget = 1000

  const mission: DailyMission = live
    ? {
        focus: currentCourse ? `Continue ${currentCourse}` : 'Keep building from your activity',
        subtitle: 'Based on your enrollments and progress',
        personalized: true,
        tasks: [
          { id: 'learn', icon: '📖', title: currentCourse ? 'Continue your course' : 'Choose a course', minutes: 15, page: 'courses' },
          { id: 'lesson', icon: '✅', title: 'Complete a lesson', minutes: 15, page: 'courses' },
          { id: 'build', icon: '💻', title: 'Explore a project', minutes: 20, page: 'projects' },
        ],
      }
    : {
        focus: 'Start your learning journey',
        subtitle: 'Generic first steps — not a personalized plan yet',
        personalized: false,
        tasks: [
          { id: 'learn', icon: '📖', title: 'Choose a course', minutes: 5, page: 'courses' },
          { id: 'lesson', icon: '✅', title: 'Complete your first lesson', minutes: 15, page: 'courses' },
          { id: 'build', icon: '💻', title: 'Explore a project', minutes: 10, page: 'projects' },
        ],
      }

  const nextAction: NextBestAction = currentCourse
    ? {
        title: `Continue ${currentCourse}`,
        body: `You're at ${enrolled[0].progress}% in this course. Pick up where you left off.`,
        minutes: 15,
        page: 'courses',
      }
    : {
        title: 'Choose a course to start learning',
        body: 'Browse available courses. Nothing here is marked as already in progress until you enroll.',
        minutes: 5,
        page: 'courses',
      }

  const insights: LearningInsight[] = live
    ? [
        { label: 'This week', value: `${stats.weekHours} hours` },
        { label: 'Lessons completed', value: String(stats.completedLessons) },
        { label: 'Projects submitted', value: String(submittedCount) },
      ]
    : [
        { label: 'This week', value: '0 hours' },
        { label: 'Focus next', value: 'Choose a course' },
        { label: 'Roadmap', value: 'Get started' },
      ]

  const tutor: TutorContext = {
    topic: currentCourse,
    weakSkill: '',
    currentLesson: currentCourse,
  }

  return {
    firstName,
    courseTitle: currentCourse,
    live,
    tutor,
    mission,
    nextAction,
    insights,
    skillDna,
    strongest,
    weakest,
    skillInsight: skillDna.length
      ? 'These skills are listed on your career profile. Scores appear after real coursework or assessments.'
      : 'Skill DNA stays empty until you add skills or complete real coursework.',
    roadmap: buildRoadmap({
      enrolledCount: enrolled.length,
      avgProgress,
      careerScore,
      submittedProjects: submittedCount,
    }),
    breakdown,
    careerTip: live
      ? 'Complete a project and a mock interview to improve your career readiness.'
      : 'Set a target role and complete a lesson to start a real career score.',
    project,
    careerMatch,
    activity,
    xp,
    xpTarget,
    careerScore,
    levelLabel: xp > 0 ? `Level ${stats.level} — Skill Builder` : 'Level 1 — Getting Started',
    badges: [
      { icon: '🏆', label: 'First Course', earned: enrolled.length > 0, hint: enrolled.length > 0 ? 'Earned when you enrolled' : 'Enroll in your first course' },
      { icon: '🔥', label: 'Learning Streak', earned: stats.streak > 0, hint: stats.streak > 0 ? `${stats.streak}-day streak` : 'Complete a lesson today' },
      { icon: '💻', label: 'First Project', earned: submittedCount > 0, hint: submittedCount > 0 ? 'Project submitted' : 'Submit your first project' },
    ] as AchievementBadge[],
  }
}

function missionDay() {
  return new Date().toISOString().slice(0, 10)
}

function missionDoneKey(userId?: string | null) {
  const uid = userId || peekAuthUserId()
  return uid ? `learnsyra_mission_${uid}_${missionDay()}` : null
}

function missionActiveKey(userId?: string | null) {
  const uid = userId || peekAuthUserId()
  return uid ? `learnsyra_mission_active_${uid}_${missionDay()}` : null
}

export function loadMissionDone(userId?: string | null): string[] {
  const key = missionDoneKey(userId)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveMissionDone(ids: string[], userId?: string | null) {
  const key = missionDoneKey(userId)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(ids))
}

export function loadMissionActive(userId?: string | null): string | null {
  const key = missionActiveKey(userId)
  if (!key) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function saveMissionActive(id: string | null, userId?: string | null) {
  const key = missionActiveKey(userId)
  if (!key) return
  if (id) localStorage.setItem(key, id)
  else localStorage.removeItem(key)
}

const AI_PROMPT_KEY = 'learnsyra_pending_prompt'

function promptStorageKey(userId?: string | null) {
  const uid = userId || peekAuthUserId()
  return uid ? `${AI_PROMPT_KEY}:${uid}` : null
}

export function setPendingAiPrompt(prompt: string, userId?: string | null) {
  const key = promptStorageKey(userId)
  if (!key) return
  sessionStorage.setItem(key, prompt)
}

export function takePendingAiPrompt(userId?: string | null) {
  const key = promptStorageKey(userId)
  if (!key) return null
  const v = sessionStorage.getItem(key)
  if (v) sessionStorage.removeItem(key)
  return v
}
