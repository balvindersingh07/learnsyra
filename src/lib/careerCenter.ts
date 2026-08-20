import { peekAuthUserId } from './supabase'
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

function weekStorageKey(userId?: string | null) {
  const uid = userId || peekAuthUserId()
  return uid ? `${WEEK_KEY}:${uid}` : null
}

function genericExploreMatches(): CareerMatch[] {
  return [
    {
      id: 'frontend',
      title: 'Frontend Developer',
      match: 0,
      strong: [],
      missing: ['React', 'JavaScript', 'TypeScript'],
      nextStep: 'Set a target role and add real skills to personalize this path.',
      projects: [],
      courses: ['React', 'TypeScript'],
      interview: 0,
    },
    {
      id: 'react',
      title: 'React Developer',
      match: 0,
      strong: [],
      missing: ['React', 'Testing'],
      nextStep: 'Complete a React project to start a personalized match.',
      projects: [],
      courses: ['React'],
      interview: 0,
    },
    {
      id: 'fullstack',
      title: 'Full Stack Developer',
      match: 0,
      strong: [],
      missing: ['React', 'APIs', 'TypeScript'],
      nextStep: 'Build both frontend and API skills, then return here.',
      projects: [],
      courses: ['Full Stack Web Development'],
      interview: 0,
    },
    {
      id: 'ui',
      title: 'UI Engineer',
      match: 0,
      strong: [],
      missing: ['Accessibility', 'Design systems'],
      nextStep: 'Explore UI courses when you are ready — this is not a personal score.',
      projects: [],
      courses: ['Frontend Testing'],
      interview: 0,
    },
  ]
}

export function emptyCareerSnapshot(): CareerSnapshot {
  const jobCount = getJobCatalog().length
  return {
    targetRole: '',
    readinessScore: 0,
    readinessDelta: 0,
    readinessNote: 'Getting started — your score will grow from lessons, projects, and interviews you actually complete.',
    simulated: false,
    skillScore: 0,
    projectScore: 0,
    resumeScore: 0,
    interviewScore: 0,
    communicationScore: 0,
    targetMatch: 0,
    haveSkills: [],
    needSkills: [],
    coachQuote:
      'Welcome to Career Center. Set a target role, finish a lesson, and add a project. Recommendations here stay empty until they come from your real activity.',
    nextActions: [
      { title: 'Set your target role', minutes: 2, href: '/career/resume' },
      { title: 'Start a course lesson', minutes: 15, href: '/courses' },
      { title: 'Create your resume', minutes: 10, href: '/career/resume' },
    ],
    roadmap: [
      { id: 'learn', label: 'Learn', status: 'Starting', progress: 0, detail: 'Enroll in a course to begin', cta: 'Browse Courses →', href: '/courses' },
      { id: 'practice', label: 'Practice', status: 'Starting', progress: 0, detail: 'No practice sessions yet', cta: 'Practice With AI →', href: '/ai-learning' },
      { id: 'build', label: 'Build', status: 'Starting', progress: 0, detail: 'No projects started', cta: 'View Projects →', href: '/projects' },
      { id: 'prepare', label: 'Prepare', status: 'Starting', progress: 0, detail: 'Resume not created', cta: 'Prepare →', href: '/career/resume' },
      { id: 'interview', label: 'Interview', status: 'Starting', progress: 0, detail: 'No mock interviews yet', cta: 'Practice Interview →', href: '/career/interview' },
      { id: 'hired', label: 'Get Hired', status: 'Starting', progress: 0, detail: `${jobCount} roles in the job catalog`, cta: 'Explore Jobs →', href: '/career/jobs' },
    ],
    skills: [],
    careerMatches: genericExploreMatches(),
    portfolio: [],
    portfolioStats: { projects: 0, certificates: 0, verified: 0 },
    certificates: [],
    projectImpact: [],
    tutorImpact: {
      name: '',
      tutorId: '',
      session: '',
      feedback: '',
      deltas: [],
    },
    interview: {
      overall: 0,
      technical: 0,
      problem: 0,
      communication: 0,
      confidence: 0,
      rec: 'Not started — complete a mock interview to see scores.',
    },
    resume: {
      score: 0,
      checks: [],
    },
    jobMatches: [],
    weeklyActions: [
      { id: 'w1', label: 'Set your target role', done: false, href: '/career/resume' },
      { id: 'w2', label: 'Complete a lesson', done: false, href: '/courses' },
      { id: 'w3', label: 'Complete 1 AI interview', done: false, href: '/career/interview' },
      { id: 'w4', label: 'Create or improve resume', done: false, href: '/career/resume' },
      { id: 'w5', label: 'Browse job matches', done: false, href: '/career/jobs' },
    ],
    activity: [],
    xp: { total: 0, level: 1, levelName: 'Getting Started', intoLevel: 0, levelNeed: 1000, next: 'Career Builder' },
    aiPlan: [
      { week: 'Week 1', focus: 'Choose a target role and start one course', progress: 0 },
      { week: 'Week 2', focus: 'Start or submit a project', progress: 0 },
      { week: 'Week 3', focus: 'Draft your resume', progress: 0 },
      { week: 'Week 4', focus: 'Try a mock interview', progress: 0 },
    ],
  }
}

export function getDemoCareerSnapshot(): CareerSnapshot {
  const targetRole = 'Frontend Developer'
  const readinessScore = 85
  const interviewScore = 72
  const resumeScore = 65
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
      technical: 78,
      problem: 75,
      communication: 80,
      confidence: 64,
      rec: 'Practice system design and behavioral questions.',
    },
    resume: {
      score: resumeScore,
      checks: [
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
  const jobCount = getJobCatalog().length
  snap.roadmap = snap.roadmap.map(step =>
    step.id === 'hired' ? { ...step, detail: `${jobCount} roles in the job catalog` } : step,
  )
  return snap
}

export function loadWeeklyActions(defaults: CareerSnapshot['weeklyActions'], userId?: string | null) {
  const key = weekStorageKey(userId)
  if (!key) return defaults
  try {
    const raw = localStorage.getItem(key)
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

export function saveWeeklyActions(rows: CareerSnapshot['weeklyActions'], userId?: string | null) {
  const key = weekStorageKey(userId)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(rows))
}

export function statusFor(score: number) {
  if (score >= 80) return 'Strong'
  if (score >= 70) return 'On track'
  if (score >= 55) return 'Needs work'
  if (score > 0) return 'Getting Started'
  return 'Not started'
}

export function getCareerSnapshot(input?: {
  userId?: string | null
  targetRole?: string | null
  readiness?: number | null
  skills?: string[]
  certificates?: CareerSnapshot['certificates']
  portfolio?: CareerPortfolioItem[]
  previewDemo?: boolean
}): CareerSnapshot {
  if (input?.previewDemo) return getDemoCareerSnapshot()

  const uid = input?.userId ?? peekAuthUserId()
  const overlay = loadInterviewCareerOverlay(uid)
  const resumeOverlay = loadResumeCareerOverlay(uid)
  const snap = emptyCareerSnapshot()

  const targetRole = input?.targetRole?.trim() || resumeOverlay?.targetRole?.trim() || ''
  snap.targetRole = targetRole

  if (overlay) {
    snap.interviewScore = overlay.interviewAfter
    snap.interview = {
      overall: overlay.interviewAfter,
      technical: overlay.technical ?? 0,
      problem: overlay.problem ?? 0,
      communication: overlay.communication ?? 0,
      confidence: overlay.confidence ?? 0,
      rec: overlay.rec ?? 'Keep practicing with another mock interview.',
    }
    snap.communicationScore = overlay.communication ?? 0
    snap.roadmap = snap.roadmap.map(step =>
      step.id === 'interview'
        ? {
            ...step,
            progress: overlay.interviewAfter,
            status: statusFor(overlay.interviewAfter),
            detail: `Latest mock ${overlay.interviewAfter}%`,
          }
        : step,
    )
    snap.coachQuote = `Your latest mock interview scored ${overlay.interviewAfter}%. Interview readiness moved from ${overlay.interviewBefore}% to ${overlay.interviewAfter}%.`
    snap.activity = [{ when: 'Recently', text: `Completed a mock interview (${overlay.interviewAfter}%)` }]
  }

  if (resumeOverlay) {
    snap.resumeScore = resumeOverlay.resumeScore
    snap.resume = { score: resumeOverlay.resumeScore, checks: resumeOverlay.checks }
    snap.roadmap = snap.roadmap.map(step =>
      step.id === 'prepare'
        ? {
            ...step,
            progress: resumeOverlay.resumeScore,
            status: statusFor(resumeOverlay.resumeScore),
            detail: `Resume ${resumeOverlay.resumeScore}%`,
          }
        : step,
    )
  }

  const listedSkills = (input?.skills ?? []).map(s => s.trim()).filter(Boolean)
  if (listedSkills.length) {
    snap.haveSkills = listedSkills
    snap.skills = listedSkills.map(name => ({
      name,
      score: 0,
      target: 70,
      status: 'improve' as const,
      courseQuery: name,
      recommended: `Learn ${name}`,
    }))
    snap.skillScore = 0
  }

  if (input?.portfolio?.length) {
    snap.portfolio = input.portfolio
    snap.portfolioStats = { ...snap.portfolioStats, projects: input.portfolio.length }
    snap.roadmap = snap.roadmap.map(step =>
      step.id === 'build'
        ? {
            ...step,
            progress: Math.min(100, input.portfolio!.length * 25),
            status: statusFor(Math.min(100, input.portfolio!.length * 25)),
            detail: `${input.portfolio!.length} project${input.portfolio!.length === 1 ? '' : 's'} in progress`,
          }
        : step,
    )
  }

  if (input?.certificates?.length) {
    snap.certificates = input.certificates
    snap.portfolioStats = { ...snap.portfolioStats, certificates: input.certificates.length }
  }

  const hasLiveSignal = Boolean(
    targetRole || overlay || resumeOverlay || listedSkills.length || input?.portfolio?.length || input?.certificates?.length,
  )
  if (typeof input?.readiness === 'number') {
    snap.readinessScore = input.readiness
  } else if (overlay?.careerAfter != null) {
    snap.readinessScore = overlay.careerAfter
  } else {
    snap.readinessScore = 0
  }

  if (hasLiveSignal && targetRole) {
    snap.nextActions = [
      { title: 'Continue a course lesson', minutes: 15, href: '/courses' },
      { title: 'Add a project', minutes: 20, href: '/projects' },
      { title: overlay ? 'Practice another interview' : 'Start an AI interview', minutes: 15, href: '/career/interview' },
    ]
  }

  const jobCount = getJobCatalog().length
  snap.roadmap = snap.roadmap.map(step =>
    step.id === 'hired' ? { ...step, detail: `${jobCount} roles in the job catalog` } : step,
  )

  return snap
}
