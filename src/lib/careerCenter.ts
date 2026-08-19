import { loadInterviewCareerOverlay } from './interviewStudio'
import { loadResumeCareerOverlay } from './resumeBuilder'
import { getJobCatalog } from './jobRecommendations'

export type RoadmapId = 'learn' | 'practice' | 'build' | 'prepare' | 'interview' | 'hired'

export interface CareerSkill {
  name: string
  score: number
  target: number
  status: 'strong' | 'improve'
  courseQuery: string
  recommended: string
}

export interface CareerMatch {
  id: string
  title: string
  match: number
  strong: string[]
  missing: string[]
  nextStep: string
  projects: string[]
  courses: string[]
  interview: number
}

export interface CareerRoadmapStep {
  id: RoadmapId
  label: string
  status: string
  progress: number
  detail: string
  cta: string
  href: string
}

export interface CareerPortfolioItem {
  id: string
  title: string
  score: number
  skills: string[]
  status: 'Portfolio Ready' | 'Needs Review'
  href: string
}

export interface CareerJobMatch {
  title: string
  match: number
  skills: string[]
}

export interface CareerSnapshot {
  targetRole: string
  readinessScore: number
  readinessDelta: number
  readinessNote: string
  simulated: boolean
  skillScore: number
  projectScore: number
  resumeScore: number
  interviewScore: number
  communicationScore: number
  targetMatch: number
  haveSkills: string[]
  needSkills: string[]
  coachQuote: string
  nextActions: { title: string; minutes: number; href: string }[]
  roadmap: CareerRoadmapStep[]
  skills: CareerSkill[]
  careerMatches: CareerMatch[]
  portfolio: CareerPortfolioItem[]
  portfolioStats: { projects: number; certificates: number; verified: number }
  certificates: { title: string; completed: string; official: boolean }[]
  projectImpact: { title: string; href: string; deltas: { skill: string; delta: number }[]; from: number; to: number }[]
  tutorImpact: {
    name: string
    tutorId: string
    session: string
    feedback: string
    deltas: { skill: string; delta: number }[]
  }
  interview: { overall: number; technical: number; problem: number; communication: number; confidence: number; rec: string }
  resume: { score: number; checks: { label: string; ok: boolean }[] }
  jobMatches: CareerJobMatch[]
  weeklyActions: { id: string; label: string; done: boolean; href: string }[]
  activity: { when: string; text: string }[]
  xp: { total: number; level: number; levelName: string; intoLevel: number; levelNeed: number; next: string }
  aiPlan: { week: string; focus: string; progress: number }[]
}

const WEEK_KEY = 'learnsyra_career_week'

export function loadWeeklyActions(defaults: CareerSnapshot['weeklyActions']) {
  try {
    const raw = localStorage.getItem(WEEK_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CareerSnapshot['weeklyActions']
      return defaults.map(d => {
        const found = parsed.find(p => p.id === d.id)
        return found ? { ...d, done: found.done } : d
      })
    }
  } catch {
    /* ignore */
  }
  return defaults
}

export function saveWeeklyActions(rows: CareerSnapshot['weeklyActions']) {
  localStorage.setItem(WEEK_KEY, JSON.stringify(rows))
}

export function statusFor(score: number) {
  if (score >= 80) return 'Strong'
  if (score >= 70) return 'On track'
  if (score >= 55) return 'Needs work'
  return 'Starting'
}

export function getCareerSnapshot(input?: {
  targetRole?: string | null
  readiness?: number | null
}): CareerSnapshot {
  const overlay = loadInterviewCareerOverlay()
  const resumeOverlay = loadResumeCareerOverlay()
  const targetRole = input?.targetRole?.trim() || resumeOverlay?.targetRole || 'Frontend Developer'
  const readinessScore =
    overlay?.careerAfter ?? (input?.readiness && input.readiness > 12 ? input.readiness : 85)
  const interviewScore = overlay?.interviewAfter ?? 72
  const resumeScore = resumeOverlay?.resumeScore ?? 65
  const snap: CareerSnapshot = {
    targetRole,
    readinessScore,
    readinessDelta: 7,
    readinessNote: "You're making strong progress toward your target role.",
    simulated: true,
    skillScore: 82,
    projectScore: 78,
    resumeScore,
    interviewScore,
    communicationScore: 80,
    targetMatch: 82,
    haveSkills: ['React', 'JavaScript', 'REST APIs'],
    needSkills: ['TypeScript', 'Testing'],
    coachQuote:
      'Your technical skills are progressing well, but your interview readiness is currently 72%. Completing two React mock interviews and one TypeScript project could significantly improve your readiness.',
    nextActions: [
      { title: 'Complete React Mock Interview', minutes: 15, href: '/career/interview' },
      { title: 'Build TypeScript Mini Project', minutes: 45, href: '/projects?q=TypeScript' },
      { title: 'Improve Resume Skills Section', minutes: 10, href: '/career/resume' },
    ],
    roadmap: [
      { id: 'learn', label: 'Learn', status: 'Strong', progress: 82, detail: 'Current focus: TypeScript', cta: 'Continue Learning →', href: '/courses?q=TypeScript' },
      { id: 'practice', label: 'Practice', status: 'On track', progress: 76, detail: '24 practice sessions', cta: 'Practice With AI →', href: '/ai-learning' },
      { id: 'build', label: 'Build', status: 'On track', progress: 78, detail: '3 projects · React Expense Tracker', cta: 'View Projects →', href: '/projects' },
      { id: 'prepare', label: 'Prepare', status: 'Needs work', progress: 65, detail: 'Resume 65% · Communication 80%', cta: 'Prepare →', href: '/career/resume' },
      { id: 'interview', label: 'Interview', status: 'On track', progress: 72, detail: '8 mock interviews · Strength: React', cta: 'Practice Interview →', href: '/career/interview' },
      { id: 'hired', label: 'Get Hired', status: 'Starting', progress: 28, detail: '12 matching opportunities', cta: 'Explore Jobs →', href: '/career/jobs' },
    ],
    skills: [
      { name: 'React', score: 88, target: 90, status: 'strong', courseQuery: 'React', recommended: 'Advanced React Patterns' },
      { name: 'JavaScript', score: 84, target: 90, status: 'strong', courseQuery: 'JavaScript', recommended: 'Modern JavaScript' },
      { name: 'REST APIs', score: 78, target: 85, status: 'strong', courseQuery: 'REST API', recommended: 'API Design Practice' },
      { name: 'TypeScript', score: 35, target: 70, status: 'improve', courseQuery: 'TypeScript', recommended: 'TypeScript for React Developers' },
      { name: 'Testing', score: 22, target: 70, status: 'improve', courseQuery: 'Testing', recommended: 'Frontend Testing' },
      { name: 'System Design', score: 28, target: 65, status: 'improve', courseQuery: 'System Design', recommended: 'System Design Foundations' },
    ],
    careerMatches: [
      {
        id: 'frontend',
        title: 'Frontend Developer',
        match: 82,
        strong: ['React', 'JavaScript', 'REST APIs'],
        missing: ['TypeScript', 'Testing', 'Accessibility'],
        nextStep: 'Add TypeScript and testing to your portfolio.',
        projects: ['React Expense Tracker', 'React Dashboard'],
        courses: ['TypeScript for React Developers', 'Frontend Testing'],
        interview: 72,
      },
      {
        id: 'react',
        title: 'React Developer',
        match: 89,
        strong: ['React', 'JavaScript'],
        missing: ['Testing'],
        nextStep: 'Ship one tested React project.',
        projects: ['React Expense Tracker'],
        courses: ['Advanced React'],
        interview: 78,
      },
      {
        id: 'fullstack',
        title: 'Full Stack Developer',
        match: 76,
        strong: ['React', 'REST APIs'],
        missing: ['Node.js depth', 'TypeScript'],
        nextStep: 'Complete the Full Stack Authentication project.',
        projects: ['Full Stack Authentication'],
        courses: ['Full Stack Web Development'],
        interview: 68,
      },
      {
        id: 'ui',
        title: 'UI Engineer',
        match: 74,
        strong: ['React', 'JavaScript'],
        missing: ['Accessibility', 'Design systems'],
        nextStep: 'Practice accessible component patterns.',
        projects: ['Design System Showcase'],
        courses: ['Frontend Testing'],
        interview: 70,
      },
    ],
    portfolio: [
      {
        id: 'catalog-react-expense',
        title: 'React Expense Tracker',
        score: 86,
        skills: ['React', 'REST API', 'JavaScript'],
        status: 'Portfolio Ready',
        href: '/projects/catalog-react-expense',
      },
      {
        id: 'admin-dash',
        title: 'Admin Analytics Dashboard',
        score: 91,
        skills: ['React', 'Charts', 'APIs'],
        status: 'Portfolio Ready',
        href: '/projects',
      },
      {
        id: 'py-data',
        title: 'Python Data Analysis',
        score: 78,
        skills: ['Python', 'Pandas'],
        status: 'Needs Review',
        href: '/projects?q=Python',
      },
    ],
    portfolioStats: { projects: 3, certificates: 2, verified: 4 },
    certificates: [
      { title: 'Full Stack Web Development', completed: 'Aug 2026', official: false },
      { title: 'React Fundamentals', completed: 'Aug 2026', official: false },
    ],
    projectImpact: [
      {
        title: 'React Expense Tracker',
        href: '/projects/catalog-react-expense',
        deltas: [
          { skill: 'React', delta: 6 },
          { skill: 'REST APIs', delta: 5 },
          { skill: 'State Management', delta: 4 },
        ],
        from: 82,
        to: 86,
      },
    ],
    tutorImpact: {
      name: 'Dr. Sarah Kim',
      tutorId: 'catalog-sarah-kim',
      session: 'React Project Architecture',
      feedback: 'Strong React fundamentals. Focus next on testing and API error handling.',
      deltas: [
        { skill: 'Architecture', delta: 4 },
        { skill: 'Testing', delta: 2 },
      ],
    },
    interview: {
      overall: interviewScore,
      technical: overlay?.technical ?? 78,
      problem: overlay?.problem ?? 75,
      communication: overlay?.communication ?? 80,
      confidence: overlay?.confidence ?? 64,
      rec: overlay?.rec ?? 'Practice system design and behavioral questions.',
    },
    resume: {
      score: resumeScore,
      checks: resumeOverlay?.checks ?? [
        { label: 'Skills listed', ok: true },
        { label: 'Education', ok: true },
        { label: 'Project descriptions', ok: false },
        { label: 'Quantified achievements', ok: false },
        { label: 'ATS optimization', ok: false },
      ],
    },
    jobMatches: [
      { title: 'Junior Frontend Developer', match: 88, skills: ['React', 'JavaScript', 'REST APIs'] },
      { title: 'React Developer', match: 84, skills: ['React', 'JavaScript'] },
      { title: 'Frontend Engineer', match: 79, skills: ['React', 'TypeScript'] },
    ],
    weeklyActions: [
      { id: 'w1', label: 'Complete 2 lessons', done: true, href: '/courses' },
      { id: 'w2', label: 'Finish React Expense Tracker', done: true, href: '/projects/catalog-react-expense' },
      { id: 'w3', label: 'Complete 1 AI interview', done: false, href: '/career/interview' },
      { id: 'w4', label: 'Improve resume', done: false, href: '/career/resume' },
      { id: 'w5', label: 'Apply to 3 matched roles', done: false, href: '/career/jobs' },
    ],
    activity: [
      { when: 'Today', text: 'Completed React lesson' },
      { when: 'Yesterday', text: 'Finished project milestone' },
      { when: '2 days ago', text: 'Tutor session with Sarah' },
      { when: '4 days ago', text: 'AI interview completed' },
    ],
    xp: { total: 1240, level: 4, levelName: 'Career Builder', intoLevel: 640, levelNeed: 1000, next: 'Job Ready' },
    aiPlan: [
      { week: 'Week 1', focus: 'Improve TypeScript', progress: 70 },
      { week: 'Week 2', focus: 'Complete testing project', progress: 20 },
      { week: 'Week 3', focus: 'Resume + portfolio', progress: 10 },
      { week: 'Week 4', focus: 'Mock interviews + applications', progress: 0 },
    ],
  }
  if (overlay) {
    snap.coachQuote = `Your latest mock interview scored ${overlay.interviewAfter}%. Interview readiness moved from ${overlay.interviewBefore}% to ${overlay.interviewAfter}%.`
    snap.roadmap = snap.roadmap.map(step =>
      step.id === 'interview'
        ? { ...step, progress: overlay.interviewAfter, detail: `Latest mock ${overlay.interviewAfter}% · Strength: React` }
        : step,
    )
  }
  if (resumeOverlay) {
    snap.roadmap = snap.roadmap.map(step =>
      step.id === 'prepare'
        ? { ...step, progress: resumeOverlay.resumeScore, detail: `Resume ${resumeOverlay.resumeScore}% · Communication 80%` }
        : step,
    )
  }
  const jobCount = getJobCatalog().length
  snap.roadmap = snap.roadmap.map(step =>
    step.id === 'hired' ? { ...step, detail: `${jobCount} matching opportunities` } : step,
  )
  return snap
}
