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
}): CareerSnapshot {
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
