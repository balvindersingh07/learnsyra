import type { CareerProfile, JobRow, ProjectRow } from './api'
import { jobMatch } from './api'
import type { Page } from './paths'

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

function detectPath(enrolled: { title: string; category: string | null }[]) {
  const blob = enrolled.map(c => `${c.title} ${c.category ?? ''}`).join(' ').toLowerCase()
  if (/machine learning|tensorflow|data science|python|ai & ml/.test(blob) && !/react|full.?stack|web/.test(blob)) {
    return 'ml' as const
  }
  return 'fullstack' as const
}

function topicFromCourses(enrolled: { title: string; category: string | null }[]) {
  if (detectPath(enrolled) === 'ml') {
    return { topic: 'Python for data', lesson: 'pandas basics', stack: 'Python', course: enrolled[0]?.title || 'Data Science' }
  }
  const title = enrolled.find(c => /full.?stack|web|react/i.test(c.title))?.title
    || enrolled[0]?.title
    || 'Full Stack Web Development'
  return { topic: 'React Hooks', lesson: 'useEffect', stack: 'React', course: title }
}

export function formatActivityLabel(hours: number) {
  const mins = Math.round(hours * 60)
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
  const fundPct = enrolledCount > 0 ? (avgProgress > 0 ? avgProgress : 17) : 0
  const projPct = clamp(submittedProjects * 40)
  const advPct = avgProgress >= 50 ? avgProgress : avgProgress >= 25 ? clamp(avgProgress - 10) : 0
  const interviewPct = careerScore
  const jobPct = careerScore >= 90 ? 100 : careerScore >= 70 ? clamp(careerScore - 15) : 0

  const steps: Omit<RoadmapStep, 'done' | 'current' | 'locked'>[] = [
    { label: 'Beginner', icon: '🌱', pct: beginnerPct, page: 'courses', hint: 'Your starting point' },
    { label: 'Fundamentals', icon: '📖', pct: fundPct, page: 'courses', hint: 'Complete Beginner to unlock' },
    { label: 'Projects', icon: '🔨', pct: projPct, page: 'projects', hint: 'Complete Fundamentals to unlock' },
    { label: 'Advanced', icon: '⚡', pct: advPct, page: 'courses', hint: 'Complete Projects to unlock' },
    { label: 'Interview Ready', icon: '🎯', pct: interviewPct, page: 'career', hint: 'Complete Advanced to unlock' },
    { label: 'Job Ready', icon: '💼', pct: jobPct, page: 'career', hint: 'Complete Interview Ready to unlock' },
  ]

  const firstOpen = steps.findIndex(s => s.pct < 100)
  return steps.map((s, i) => {
    const done = s.pct >= 100
    const current = !done && (firstOpen === -1 ? i === steps.length - 1 : i === firstOpen)
    const locked = !done && !current && i > (firstOpen === -1 ? steps.length : firstOpen)
    const hint = done
      ? 'Completed · 100%'
      : current
        ? `${s.pct}% complete · 4 lessons remaining`
        : s.hint
    return { ...s, done, current, locked, hint }
  })
}

export function formatSessionWhen(_iso?: string, durationMin = 45) {
  return `Today · 6:30 PM · ${durationMin} min`
}

export function buildDashboardIntel(input: {
  firstName: string
  enrolled: { title: string; category: string | null; progress: number }[]
  stats: { streak: number; level: number; weekHours: number; careerScore: number; completedLessons: number }
  career: CareerProfile | null
  projects: ProjectRow[]
  submittedCount: number
  jobs: JobRow[]
}) {
  const { firstName, enrolled, stats, career, projects, submittedCount, jobs } = input
  const avgProgress = enrolled.length
    ? Math.round(enrolled.reduce((s, c) => s + c.progress, 0) / enrolled.length)
    : 0
  const ctx = topicFromCourses(enrolled)
  const path = detectPath(enrolled)
  const tsScore = 35

  const skillDna: SkillDnaItem[] =
    path === 'ml'
      ? [
          { name: 'Python', score: 78 },
          { name: 'SQL', score: 64 },
          { name: 'Statistics', score: 51 },
          { name: 'TensorFlow', score: 28 },
          { name: 'System Design', score: 21 },
        ]
      : [
          { name: 'React', score: 88 },
          { name: 'JavaScript', score: 76 },
          { name: 'Node.js', score: 58 },
          { name: 'TypeScript', score: tsScore },
          { name: 'System Design', score: 21 },
        ]

  const strongest = skillDna.reduce((a, b) => (a.score >= b.score ? a : b))
  const weakest = skillDna.reduce((a, b) => (a.score <= b.score ? a : b))

  const breakdown: CareerBreakdown = {
    skills: clamp(avgProgress || 72),
    projects: clamp(submittedCount * 22 + (projects.length ? 8 : 0) || 45),
    resume: career?.resume_text && career.resume_text.length > 80 ? 70 : career?.resume_text ? 30 : 30,
    interview: clamp(stats.careerScore * 0.45 || 18),
    communication: 60,
  }

  const ecom = projects.find(p => /e-?comm|shop|store|full.?stack/i.test(p.title))
  const project: RecommendedProject =
    path === 'ml'
      ? {
          title: projects.find(p => /ml|data|python/i.test(p.title))?.title || 'ML Classification Lab',
          difficulty: 'Intermediate',
          time: '2h 30m',
          skills: ['Python', 'pandas', 'SQL'],
          badges: ['AI Assistance', 'Tutor Support'],
        }
      : {
          title: ecom?.title || 'E-commerce Website',
          difficulty: ecom?.difficulty || 'Intermediate',
          time: '2h 30m',
          skills: (ecom?.skills?.length ? ecom.skills : ['React', 'JavaScript', 'REST API']).slice(0, 3),
          badges: ['AI Assistance', 'Tutor Support'],
        }

  const mlJob = jobs.find(j => /ml|machine|data scientist|tensorflow/i.test(`${j.title} ${(j.tags ?? []).join(' ')}`))
  const careerMatch: CareerMatchPreview =
    path === 'ml'
      ? {
          role: mlJob?.title || career?.target_role || 'Junior ML Engineer',
          match: mlJob ? jobMatch(mlJob, skillDna.map(s => s.name)) : 74,
          have: ['Python', 'SQL', 'Statistics'],
          improve: ['TensorFlow', 'System Design'],
        }
      : {
          role: 'Frontend Developer',
          match: 82,
          have: ['React', 'JavaScript', 'REST APIs'],
          improve: ['TypeScript', 'Testing'],
        }

  const mins = [45, 70, 35, 90, 40, 35, 5]
  const activity: WeeklyActivity = {
    weekHours: Math.round((mins.reduce((a, b) => a + b, 0) / 60) * 10) / 10,
    deltaPct: 34,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((label, i) => ({
      label,
      hours: mins[i] / 60,
    })),
  }

  const xpTarget = 1000
  const xp = 255

  const mission: DailyMission = {
    focus: `Become better at ${ctx.topic}`,
    subtitle: 'Your personalized learning plan for today',
    tasks: [
      { id: 'learn', icon: '📖', title: path === 'ml' ? `Learn ${ctx.lesson}` : 'Learn useEffect', minutes: 10, page: 'courses' },
      { id: 'practice', icon: '🧠', title: 'AI Practice', minutes: 10, page: 'ai-learning' },
      { id: 'build', icon: '💻', title: 'Build Mini Task', minutes: 20, page: 'projects' },
      { id: 'quiz', icon: '🎯', title: 'Quick Quiz', minutes: 5, page: 'ai-learning' },
    ],
  }

  const nextAction: NextBestAction =
    path === 'ml'
      ? {
          title: 'Complete Statistics Fundamentals',
          body: `You are currently at ${skillDna[2]?.score ?? 51}% proficiency. Completing this lesson will unlock your next data project.`,
          minutes: 15,
          page: 'courses',
        }
      : {
          title: 'Complete TypeScript Fundamentals',
          body: `You are currently at ${tsScore}% proficiency. Completing this lesson will unlock your next Full Stack project.`,
          minutes: 15,
          page: 'courses',
        }

  const insights: LearningInsight[] = [
    { label: 'React skill growth', value: '+18% this week' },
    { label: 'Focus next', value: path === 'ml' ? 'Statistics' : 'TypeScript' },
    { label: 'Estimated roadmap progress', value: '42 hours remaining' },
  ]

  const tutor: TutorContext = {
    topic: ctx.topic,
    weakSkill: ctx.lesson,
    currentLesson: ctx.topic,
  }

  return {
    firstName,
    courseTitle: ctx.course,
    tutor,
    mission,
    nextAction,
    insights,
    skillDna,
    strongest: strongest.name,
    weakest: weakest.name,
    skillInsight: `Your strongest skill is ${strongest.name}. ${weakest.name} needs attention.`,
    roadmap: buildRoadmap({
      enrolledCount: enrolled.length,
      avgProgress,
      careerScore: stats.careerScore,
      submittedProjects: submittedCount,
    }),
    breakdown,
    careerTip: 'Complete 2 projects + 1 mock interview to improve your career readiness.',
    project,
    careerMatch,
    activity,
    xp,
    xpTarget,
    levelLabel: `Level ${stats.level} — Skill Builder`,
    badges: [
      { icon: '🏆', label: 'First Course', earned: enrolled.length > 0, hint: enrolled.length > 0 ? 'Earned when you enrolled' : 'Enroll in your first course' },
      { icon: '🔥', label: 'Learning Streak', earned: stats.streak > 0, hint: stats.streak > 0 ? `${stats.streak}-day streak` : 'Complete a lesson today' },
      { icon: '💻', label: 'First Project', earned: submittedCount > 0, hint: submittedCount > 0 ? 'Project submitted' : 'Submit your first project' },
    ] as AchievementBadge[],
  }
}

const MISSION_KEY = () => `learnsyra_mission_${new Date().toISOString().slice(0, 10)}`
const MISSION_ACTIVE_KEY = () => `learnsyra_mission_active_${new Date().toISOString().slice(0, 10)}`

export function loadMissionDone(): string[] {
  try {
    const raw = localStorage.getItem(MISSION_KEY())
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveMissionDone(ids: string[]) {
  localStorage.setItem(MISSION_KEY(), JSON.stringify(ids))
}

export function loadMissionActive(): string | null {
  try {
    return localStorage.getItem(MISSION_ACTIVE_KEY())
  } catch {
    return null
  }
}

export function saveMissionActive(id: string | null) {
  if (id) localStorage.setItem(MISSION_ACTIVE_KEY(), id)
  else localStorage.removeItem(MISSION_ACTIVE_KEY())
}

const AI_PROMPT_KEY = 'learnsyra_pending_prompt'

export function setPendingAiPrompt(prompt: string) {
  sessionStorage.setItem(AI_PROMPT_KEY, prompt)
}

export function takePendingAiPrompt() {
  const v = sessionStorage.getItem(AI_PROMPT_KEY)
  if (v) sessionStorage.removeItem(AI_PROMPT_KEY)
  return v
}
