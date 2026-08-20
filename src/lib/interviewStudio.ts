import { peekAuthUserId, userStorageKey } from './supabase'

export type InterviewRole =
  | 'Frontend Developer'
  | 'React Developer'
  | 'Full Stack Developer'
  | 'Data Analyst'
  | 'Software Engineer'
  | 'Product Analyst'
  | 'Business Analyst'

export type InterviewKind = 'technical' | 'behavioral' | 'system-design' | 'project' | 'mixed'

export type InterviewDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export type QuestionKind = 'technical' | 'project' | 'problem-solving' | 'behavioral' | 'system-design' | 'coding'

export type AnswerMode = 'text' | 'voice' | 'code'

export interface InterviewQuestion {
  id: string
  type: QuestionKind
  category: string
  difficulty: InterviewDifficulty
  question: string
  expectedTopics: string[]
  skills: string[]
  roles: InterviewRole[] | ['*']
  projectId?: string
  courseId?: string
  preferredMode?: AnswerMode
  clarification: string
}

export interface InterviewAnswer {
  questionId: string
  text: string
  skipped: boolean
  mode: AnswerMode
  askedAt: string
  submittedAt: string
  score?: number
  rating?: 'Strong' | 'Good' | 'Improve'
  feedback?: string
}

export interface InterviewSetup {
  role: InterviewRole
  kind: InterviewKind
  difficulty: InterviewDifficulty
  duration: 10 | 20 | 30
  useResume: boolean
  useProjects: boolean
}

export interface InterviewRecord {
  id: string
  role: InterviewRole
  type: InterviewKind
  difficulty: InterviewDifficulty
  duration: 10 | 20 | 30
  questions: InterviewQuestion[]
  answers: InterviewAnswer[]
  score: number
  technicalScore: number
  problemSolvingScore: number
  communicationScore: number
  confidenceScore: number
  roleReadiness: number
  skillImpact: { skill: string; delta: number }[]
  feedback: { well: string[]; improve: string[] }
  weakAreas: { id: string; label: string; score: number; detail: string; kind: InterviewKind | 'behavioral' }[]
  recommendations: { title: string; minutes: number; href: string }
  startedAt: string
  completedAt: string
  careerBefore: number
  careerAfter: number
  interviewBefore: number
  seeded?: boolean
}

export interface LiveInterview {
  id: string
  setup: InterviewSetup
  questions: InterviewQuestion[]
  answers: InterviewAnswer[]
  index: number
  startedAt: string
  remainingSec: number
  hint: string | null
}

export interface InterviewCareerOverlay {
  interviewAfter: number
  interviewBefore: number
  careerAfter: number
  careerBefore: number
  technical: number
  problem: number
  communication: number
  confidence: number
  rec: string
}

export const INTERVIEW_ROLES: InterviewRole[] = [
  'Frontend Developer',
  'React Developer',
  'Full Stack Developer',
  'Data Analyst',
  'Software Engineer',
  'Product Analyst',
  'Business Analyst',
]

export const INTERVIEW_KINDS: { id: InterviewKind; title: string; desc: string; recommended?: boolean }[] = [
  { id: 'technical', title: 'Technical Interview', desc: 'React, JavaScript, APIs, coding' },
  { id: 'behavioral', title: 'Behavioral Interview', desc: 'Communication, teamwork, leadership' },
  { id: 'system-design', title: 'System Design', desc: 'Architecture and scalability' },
  { id: 'project', title: 'Project Interview', desc: "Questions about the student's actual projects" },
  { id: 'mixed', title: 'Mixed Interview', desc: 'Technical + Behavioral + Project', recommended: true },
]

export const INTERVIEW_DIFFICULTIES: InterviewDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']
export const INTERVIEW_DURATIONS: { min: 10 | 20 | 30; questions: string }[] = [
  { min: 10, questions: '~5–6 questions' },
  { min: 20, questions: '~8–12 questions' },
  { min: 30, questions: '~12 questions' },
]

export const TS_COURSE_ID = 'catalog-typescript-for-react-developers'
export const EXPENSE_PROJECT_ID = 'catalog-react-expense'
export const SARAH_TUTOR_ID = 'catalog-sarah-kim'

const HISTORY_KEY = 'learnsyra_interview_history'
const LIVE_KEY = 'learnsyra_interview_live'
const OVERLAY_KEY = 'learnsyra_interview_career'
const USED_KEY = 'learnsyra_interview_used'

function interviewOverlayKey(userId?: string | null) {
  const uid = userId || peekAuthUserId()
  return uid ? `${OVERLAY_KEY}:${uid}` : null
}

function q(
  partial: Omit<InterviewQuestion, 'clarification'> & { clarification?: string },
): InterviewQuestion {
  return {
    clarification:
      'Focus on a clear definition, one trade-off, and a real example from your work. I will not share a model answer during the interview.',
    ...partial,
  }
}

const BANK: InterviewQuestion[] = [
  q({
    id: 't-state-props',
    type: 'technical',
    category: 'React',
    difficulty: 'Beginner',
    question: 'Can you explain the difference between React state and props, and give an example of when you would use each?',
    expectedTopics: ['props', 'state', 'parent', 'read-only', 're-render'],
    skills: ['React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 't-memo-cb',
    type: 'technical',
    category: 'React',
    difficulty: 'Intermediate',
    question: 'What is the difference between useMemo and useCallback, and when would you reach for each?',
    expectedTopics: ['memoize', 'function', 'value', 'dependency', 'render'],
    skills: ['React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 't-keys',
    type: 'technical',
    category: 'React',
    difficulty: 'Beginner',
    question: 'Why do lists in React need stable keys, and what goes wrong if you use the array index?',
    expectedTopics: ['reconciliation', 'identity', 'index', 'reorder'],
    skills: ['React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer'],
  }),
  q({
    id: 't-rest',
    type: 'technical',
    category: 'APIs',
    difficulty: 'Beginner',
    question: 'How would you fetch data from a REST API in React and handle loading, success, and error states?',
    expectedTopics: ['fetch', 'useEffect', 'loading', 'error', 'abort'],
    skills: ['React', 'REST APIs'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 't-ts-types',
    type: 'technical',
    category: 'TypeScript',
    difficulty: 'Intermediate',
    question: 'How would you type a React component that receives children and an optional callback, and why does that help in a team codebase?',
    expectedTopics: ['props', 'optional', 'interface', 'ReactNode', 'type'],
    skills: ['TypeScript', 'React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
    courseId: TS_COURSE_ID,
  }),
  q({
    id: 't-ts-narrow',
    type: 'technical',
    category: 'TypeScript',
    difficulty: 'Advanced',
    question: 'Explain a time you used TypeScript to catch a bug before runtime. What types or narrowing made that possible?',
    expectedTopics: ['narrowing', 'union', 'undefined', 'compiler'],
    skills: ['TypeScript'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
    courseId: TS_COURSE_ID,
  }),
  q({
    id: 't-testing',
    type: 'technical',
    category: 'Testing',
    difficulty: 'Intermediate',
    question: 'How would you test a React form that submits to an API? What would you mock and what would you assert?',
    expectedTopics: ['testing-library', 'mock', 'user event', 'assert'],
    skills: ['Testing', 'React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 't-hooks',
    type: 'technical',
    category: 'React',
    difficulty: 'Intermediate',
    question: 'Walk through the rules of hooks and a bug you have seen when those rules were broken.',
    expectedTopics: ['top level', 'condition', 'custom hook', 'order'],
    skills: ['React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer'],
  }),
  q({
    id: 't-js-event',
    type: 'technical',
    category: 'JavaScript',
    difficulty: 'Beginner',
    question: 'What is the difference between var, let, and const, and how does that show up in React event handlers?',
    expectedTopics: ['scope', 'const', 'let', 'closure'],
    skills: ['JavaScript'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 't-js-async',
    type: 'technical',
    category: 'JavaScript',
    difficulty: 'Intermediate',
    question: 'How do promises and async/await differ in error handling when several API calls depend on each other?',
    expectedTopics: ['await', 'try', 'Promise.all', 'error'],
    skills: ['JavaScript', 'REST APIs'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 'p-slow-react',
    type: 'problem-solving',
    category: 'Performance',
    difficulty: 'Intermediate',
    question: 'How would you debug a slow React application that feels fine in development but janky with real data?',
    expectedTopics: ['profiler', 'memo', 'list', 'network', 'render'],
    skills: ['React', 'Problem Solving'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 'p-prod-bug',
    type: 'problem-solving',
    category: 'Debugging',
    difficulty: 'Intermediate',
    question: 'A production page is blank for some users after a deploy. How do you investigate without guessing?',
    expectedTopics: ['error', 'repro', 'logs', 'rollback', 'feature flag'],
    skills: ['Problem Solving'],
    roles: ['*'],
  }),
  q({
    id: 'p-api-fail',
    type: 'problem-solving',
    category: 'APIs',
    difficulty: 'Beginner',
    question: 'The API starts returning 500s for one endpoint. What do you tell the user, and what do you check first?',
    expectedTopics: ['error state', 'retry', 'status', 'logs'],
    skills: ['REST APIs', 'Problem Solving'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 'b-difficult',
    type: 'behavioral',
    category: 'Teamwork',
    difficulty: 'Beginner',
    question: 'Tell me about a difficult technical problem you solved. What made it hard, and what did you do?',
    expectedTopics: ['situation', 'action', 'result', 'learn'],
    skills: ['Communication'],
    roles: ['*'],
  }),
  q({
    id: 'b-conflict',
    type: 'behavioral',
    category: 'Collaboration',
    difficulty: 'Intermediate',
    question: 'Describe a time you disagreed with a teammate about an implementation. How did you reach a decision?',
    expectedTopics: ['listen', 'trade-off', 'data', 'respect'],
    skills: ['Communication'],
    roles: ['*'],
  }),
  q({
    id: 'b-deadline',
    type: 'behavioral',
    category: 'Ownership',
    difficulty: 'Intermediate',
    question: 'Tell me about a time a deadline slipped. How did you communicate and what changed afterward?',
    expectedTopics: ['communicate', 'scope', 'stakeholder', 'plan'],
    skills: ['Communication', 'Confidence'],
    roles: ['*'],
  }),
  q({
    id: 'b-learn',
    type: 'behavioral',
    category: 'Growth',
    difficulty: 'Beginner',
    question: 'How do you learn a new library or tool under time pressure? Walk me through a recent example.',
    expectedTopics: ['docs', 'small project', 'mentor', 'practice'],
    skills: ['Communication'],
    roles: ['*'],
  }),
  q({
    id: 'b-stakeholder',
    type: 'behavioral',
    category: 'Communication',
    difficulty: 'Advanced',
    question: 'Explain a technical constraint to a non-technical stakeholder. How did you keep it honest without drowning them in detail?',
    expectedTopics: ['plain language', 'impact', 'option', 'risk'],
    skills: ['Communication', 'Confidence'],
    roles: ['*'],
  }),
  q({
    id: 's-notify',
    type: 'system-design',
    category: 'Architecture',
    difficulty: 'Intermediate',
    question: 'How would you design a scalable notification system for web and mobile users?',
    expectedTopics: ['queue', 'fan-out', 'retry', 'preference', 'websocket'],
    skills: ['System Design'],
    roles: ['Frontend Developer', 'Full Stack Developer', 'Software Engineer', 'React Developer'],
  }),
  q({
    id: 's-feed',
    type: 'system-design',
    category: 'Architecture',
    difficulty: 'Advanced',
    question: 'Design the frontend architecture for a dashboard that must stay usable with millions of rows of analytics data.',
    expectedTopics: ['pagination', 'virtualize', 'cache', 'api', 'chart'],
    skills: ['System Design', 'React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 's-auth',
    type: 'system-design',
    category: 'Architecture',
    difficulty: 'Intermediate',
    question: 'How would you design authentication for a student app with web, a tutor dashboard, and a public marketing site?',
    expectedTopics: ['session', 'role', 'token', 'cookie', 'oauth'],
    skills: ['System Design'],
    roles: ['Full Stack Developer', 'Software Engineer', 'Frontend Developer'],
  }),
  q({
    id: 's-cdn',
    type: 'system-design',
    category: 'Performance',
    difficulty: 'Beginner',
    question: 'A marketing page is slow in another country. What layers would you inspect, from the browser to the origin?',
    expectedTopics: ['cdn', 'image', 'cache', 'ttf', 'network'],
    skills: ['System Design'],
    roles: ['Frontend Developer', 'Full Stack Developer', 'Software Engineer', 'Product Analyst'],
  }),
  q({
    id: 'pr-arch',
    type: 'project',
    category: 'Projects',
    difficulty: 'Intermediate',
    question: 'Why did you choose this architecture for your React Expense Tracker?',
    expectedTopics: ['component', 'state', 'api', 'folder'],
    skills: ['React', 'REST APIs'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
    projectId: EXPENSE_PROJECT_ID,
  }),
  q({
    id: 'pr-errors',
    type: 'project',
    category: 'Projects',
    difficulty: 'Intermediate',
    question: 'How did you handle API errors in the Expense Tracker, and what would you improve next?',
    expectedTopics: ['error', 'retry', 'empty', 'toast'],
    skills: ['REST APIs', 'React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer'],
    projectId: EXPENSE_PROJECT_ID,
  }),
  q({
    id: 'pr-scale',
    type: 'project',
    category: 'Projects',
    difficulty: 'Advanced',
    question: 'How would you scale the Expense Tracker if thousands of users added expenses at once?',
    expectedTopics: ['pagination', 'index', 'cache', 'queue'],
    skills: ['System Design', 'React'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
    projectId: EXPENSE_PROJECT_ID,
  }),
  q({
    id: 'pr-state',
    type: 'project',
    category: 'Projects',
    difficulty: 'Beginner',
    question: 'Walk me through how state is managed in your Expense Tracker. What lives locally vs on the server?',
    expectedTopics: ['local', 'server', 'form', 'list'],
    skills: ['React', 'State Management'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer'],
    projectId: EXPENSE_PROJECT_ID,
  }),
  q({
    id: 'c-dedupe',
    type: 'coding',
    category: 'JavaScript',
    difficulty: 'Beginner',
    question: 'Write a function that removes duplicate values from an array. Talk through time and space trade-offs.',
    expectedTopics: ['set', 'filter', 'unique', 'complexity'],
    skills: ['JavaScript'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
    preferredMode: 'code',
  }),
  q({
    id: 'c-debounce',
    type: 'coding',
    category: 'JavaScript',
    difficulty: 'Intermediate',
    question: 'Write a debounce helper and explain where you would use it in a search input.',
    expectedTopics: ['timeout', 'clear', 'delay', 'closure'],
    skills: ['JavaScript'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Software Engineer'],
    preferredMode: 'code',
  }),
  q({
    id: 'c-group',
    type: 'coding',
    category: 'JavaScript',
    difficulty: 'Intermediate',
    question: 'Given a list of expenses `{category, amount}`, write a function that returns totals grouped by category.',
    expectedTopics: ['reduce', 'map', 'category', 'sum'],
    skills: ['JavaScript'],
    roles: ['Frontend Developer', 'React Developer', 'Full Stack Developer', 'Data Analyst', 'Software Engineer'],
    preferredMode: 'code',
    projectId: EXPENSE_PROJECT_ID,
  }),
  q({
    id: 'da-sql',
    type: 'technical',
    category: 'SQL',
    difficulty: 'Intermediate',
    question: 'How would you find the top 5 product categories by revenue last quarter, and what would you check for data quality?',
    expectedTopics: ['group by', 'sum', 'date', 'null', 'join'],
    skills: ['SQL'],
    roles: ['Data Analyst', 'Product Analyst', 'Business Analyst'],
  }),
  q({
    id: 'da-metric',
    type: 'technical',
    category: 'Metrics',
    difficulty: 'Beginner',
    question: 'A dashboard shows a sudden drop in weekly active users. How do you decide if it is a real change or a tracking issue?',
    expectedTopics: ['segment', 'event', 'compare', 'source'],
    skills: ['Analytics'],
    roles: ['Data Analyst', 'Product Analyst', 'Business Analyst'],
  }),
  q({
    id: 'da-story',
    type: 'behavioral',
    category: 'Insight',
    difficulty: 'Intermediate',
    question: 'Tell me about an analysis that changed a product or business decision. What was the recommendation?',
    expectedTopics: ['insight', 'action', 'stakeholder', 'result'],
    skills: ['Communication'],
    roles: ['Data Analyst', 'Product Analyst', 'Business Analyst'],
  }),
  q({
    id: 'pa-prioritize',
    type: 'behavioral',
    category: 'Product',
    difficulty: 'Intermediate',
    question: 'How do you prioritize two features when engineering can only ship one this sprint?',
    expectedTopics: ['impact', 'effort', 'user', 'risk'],
    skills: ['Communication'],
    roles: ['Product Analyst', 'Business Analyst', 'Software Engineer'],
  }),
  q({
    id: 'ba-case',
    type: 'problem-solving',
    category: 'Business',
    difficulty: 'Intermediate',
    question: 'Revenue is flat while traffic is up. What hypotheses would you test first?',
    expectedTopics: ['conversion', 'mix', 'pricing', 'funnel'],
    skills: ['Problem Solving'],
    roles: ['Business Analyst', 'Product Analyst', 'Data Analyst'],
  }),
  q({
    id: 'fs-node',
    type: 'technical',
    category: 'Backend',
    difficulty: 'Intermediate',
    question: 'How would you design a REST endpoint that creates an expense, including validation and idempotency?',
    expectedTopics: ['validation', 'status', 'idempotent', 'auth'],
    skills: ['REST APIs'],
    roles: ['Full Stack Developer', 'Software Engineer'],
  }),
  q({
    id: 'se-complexity',
    type: 'technical',
    category: 'CS',
    difficulty: 'Intermediate',
    question: 'When would you choose a hash map over a list, and how does that choice show up in frontend data handling?',
    expectedTopics: ['lookup', 'O(1)', 'memory', 'key'],
    skills: ['JavaScript'],
    roles: ['Software Engineer', 'Full Stack Developer', 'Frontend Developer'],
  }),
]

export function questionCountFor(duration: 10 | 20 | 30) {
  if (duration === 10) return 6
  if (duration === 30) return 12
  return 10
}

export function defaultDifficulty(readiness: number): InterviewDifficulty {
  if (readiness < 60) return 'Beginner'
  if (readiness >= 88) return 'Advanced'
  return 'Intermediate'
}

export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

function matchesRole(qst: InterviewQuestion, role: InterviewRole) {
  return qst.roles[0] === '*' || (qst.roles as InterviewRole[]).includes(role)
}

function difficultyRank(d: InterviewDifficulty) {
  return d === 'Beginner' ? 0 : d === 'Intermediate' ? 1 : 2
}

function typeAllowed(kind: InterviewKind, qType: QuestionKind) {
  if (kind === 'mixed') return true
  if (kind === 'technical') return qType === 'technical' || qType === 'coding' || qType === 'problem-solving'
  if (kind === 'behavioral') return qType === 'behavioral'
  if (kind === 'system-design') return qType === 'system-design' || qType === 'problem-solving'
  if (kind === 'project') return qType === 'project' || qType === 'coding'
  return true
}

export function loadUsedQuestionIds() {
  const key = userStorageKey(USED_KEY)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveUsedQuestionIds(ids: string[]) {
  const key = userStorageKey(USED_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(ids.slice(-80)))
}

export function pickQuestions(setup: InterviewSetup, count: number): InterviewQuestion[] {
  const used = new Set(loadUsedQuestionIds())
  const rank = difficultyRank(setup.difficulty)
  let pool = BANK.filter(item => {
    if (!matchesRole(item, setup.role)) return false
    if (!typeAllowed(setup.kind, item.type)) return false
    if (!setup.useProjects && item.projectId) return false
    const d = difficultyRank(item.difficulty)
    return Math.abs(d - rank) <= 1
  })
  if (pool.length < count) {
    pool = BANK.filter(item => matchesRole(item, setup.role) && typeAllowed(setup.kind, item.type))
  }
  const fresh = pool.filter(item => !used.has(item.id))
  const source = (fresh.length >= count ? fresh : pool).slice()
  source.sort((a, b) => {
    const au = used.has(a.id) ? 1 : 0
    const bu = used.has(b.id) ? 1 : 0
    if (au !== bu) return au - bu
    return a.id.localeCompare(b.id)
  })
  const picked: InterviewQuestion[] = []
  const wantOrder: QuestionKind[] =
    setup.kind === 'mixed'
      ? ['technical', 'project', 'behavioral', 'problem-solving', 'system-design', 'coding']
      : []
  for (const type of wantOrder) {
    const next = source.find(item => item.type === type && !picked.includes(item))
    if (next) picked.push(next)
    if (picked.length >= count) break
  }
  for (const item of source) {
    if (picked.length >= count) break
    if (!picked.includes(item)) picked.push(item)
  }
  saveUsedQuestionIds([...used, ...picked.map(p => p.id)])
  return picked.slice(0, count)
}

export function evaluateAnswer(question: InterviewQuestion, text: string, skipped: boolean) {
  if (skipped || !text.trim()) {
    return {
      score: 4,
      rating: 'Improve' as const,
      feedback: 'This one was skipped or too brief. Next time outline a definition, an example, and a trade-off.',
    }
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const lower = text.toLowerCase()
  const hits = question.expectedTopics.filter(t => lower.includes(t.toLowerCase())).length
  let score = 5
  if (words >= 24) score = 6
  if (words >= 48) score = 7
  if (words >= 90) score = 8
  score = Math.min(10, score + Math.min(2, hits))
  const rating: 'Strong' | 'Good' | 'Improve' = score >= 8 ? 'Strong' : score >= 6 ? 'Good' : 'Improve'
  const extra =
    hits === 0
      ? ' Add a concrete example so the interviewer can picture the work.'
      : hits >= 2
        ? ' You covered the core ideas clearly.'
        : ' Name one more trade-off to sound interview-ready.'
  return {
    score,
    rating,
    feedback: `Solid direction.${extra} Tie the answer back to ${question.skills[0] ?? 'the role'}.`,
  }
}

function avgFor(answers: InterviewAnswer[], questions: InterviewQuestion[], types: QuestionKind[]) {
  const rows = answers.filter((a, i) => types.includes(questions[i]?.type))
  if (!rows.length) return 70
  const mean = rows.reduce((s, a) => s + (a.score ?? 6), 0) / rows.length
  return Math.round(mean * 10)
}

export function liveHint(text: string, skipped: boolean) {
  if (skipped) return 'Answer recorded'
  const words = text.trim().split(/\s+/).filter(Boolean).length
  if (words < 22) return 'Consider giving a concrete example'
  if (words >= 70) return 'Good pacing'
  return 'Answer recorded'
}

export function finalizeInterview(live: LiveInterview, interviewBefore: number, careerBefore: number): InterviewRecord {
  const answers = live.answers.map((a, i) => {
    const ev = evaluateAnswer(live.questions[i], a.text, a.skipped)
    return { ...a, ...ev }
  })
  const technicalScore = avgFor(answers, live.questions, ['technical', 'coding'])
  const problemSolvingScore = avgFor(answers, live.questions, ['problem-solving', 'system-design'])
  const communicationScore = avgFor(answers, live.questions, ['behavioral', 'project'])
  const answered = answers.filter(a => !a.skipped && a.text.trim().length >= 24).length
  const confidenceScore = Math.max(52, Math.min(88, 58 + answered * 3 + Math.round(communicationScore * 0.08)))
  const roleReadiness = Math.round(
    technicalScore * 0.34 + problemSolvingScore * 0.22 + communicationScore * 0.22 + confidenceScore * 0.22,
  )
  const score = Math.max(
    48,
    Math.min(
      92,
      Math.round(
        technicalScore * 0.3 +
          problemSolvingScore * 0.2 +
          communicationScore * 0.2 +
          confidenceScore * 0.15 +
          roleReadiness * 0.15,
      ),
    ),
  )
  const skillImpact = [
    { skill: 'React', delta: live.setup.role.includes('Frontend') || live.setup.role.includes('React') ? 3 : 1 },
    { skill: 'Communication', delta: 4 },
    { skill: 'Problem Solving', delta: 2 },
    { skill: 'Interview Confidence', delta: 5 },
  ]
  const weakAreas = [
    { id: 'typescript', label: 'TypeScript', score: Math.min(62, technicalScore - 12), detail: '5 questions', kind: 'technical' as const },
    { id: 'system-design', label: 'System Design', score: Math.min(48, problemSolvingScore - 20), detail: '5 questions', kind: 'system-design' as const },
    { id: 'confidence', label: 'Confidence', score: confidenceScore, detail: 'Behavioral practice', kind: 'behavioral' as const },
  ]
  const careerAfter = Math.min(99, careerBefore + (score >= 75 ? 2 : score >= 65 ? 1 : 0))
  return {
    id: live.id,
    role: live.setup.role,
    type: live.setup.kind,
    difficulty: live.setup.difficulty,
    duration: live.setup.duration,
    questions: live.questions,
    answers,
    score,
    technicalScore,
    problemSolvingScore,
    communicationScore,
    confidenceScore,
    roleReadiness,
    skillImpact,
    feedback: {
      well: [
        'Strong React fundamentals',
        'Clear explanation of state management',
        'Good problem-solving approach',
      ],
      improve: [
        'Give more concrete examples',
        'Practice TypeScript questions',
        'Improve confidence when explaining architecture',
      ],
    },
    weakAreas,
    recommendations: {
      title: 'Practice TypeScript Interview',
      minutes: 10,
      href: '/career/interview?practice=typescript',
    },
    startedAt: live.startedAt,
    completedAt: new Date().toISOString(),
    careerBefore,
    careerAfter,
    interviewBefore,
  }
}

export function loadHistory(): InterviewRecord[] {
  const key = userStorageKey(HISTORY_KEY)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const rows = JSON.parse(raw) as InterviewRecord[]
      return rows.filter(row => !row.seeded)
    }
  } catch {
    /* ignore */
  }
  return []
}

export function saveHistory(rows: InterviewRecord[]) {
  const key = userStorageKey(HISTORY_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(rows.slice(0, 20)))
}

export function appendHistory(record: InterviewRecord) {
  const rows = loadHistory().filter(r => r.id !== record.id)
  saveHistory([record, ...rows])
}

export function loadLive(): LiveInterview | null {
  const key = userStorageKey(LIVE_KEY)
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as LiveInterview) : null
  } catch {
    return null
  }
}

export function saveLive(live: LiveInterview | null) {
  const key = userStorageKey(LIVE_KEY)
  if (!key) return
  if (!live) localStorage.removeItem(key)
  else localStorage.setItem(key, JSON.stringify(live))
}

export function loadInterviewCareerOverlay(userId?: string | null): InterviewCareerOverlay | null {
  const key = interviewOverlayKey(userId)
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as InterviewCareerOverlay) : null
  } catch {
    return null
  }
}

export function saveInterviewCareerOverlay(overlay: InterviewCareerOverlay, userId?: string | null) {
  const key = interviewOverlayKey(userId)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(overlay))
}

export function applyInterviewOverlay(record: InterviewRecord) {
  saveInterviewCareerOverlay({
    interviewAfter: record.score,
    interviewBefore: record.interviewBefore,
    careerAfter: record.careerAfter,
    careerBefore: record.careerBefore,
    technical: record.technicalScore,
    problem: record.problemSolvingScore,
    communication: record.communicationScore,
    confidence: record.confidenceScore,
    rec: 'Practice system design and TypeScript questions.',
  })
}

export function relativeWhen(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  return `${Math.floor(days / 7)} weeks ago`
}

export function mixCounts(questions: InterviewQuestion[], upto: number) {
  const slice = questions.slice(0, upto)
  const n = (t: QuestionKind) => slice.filter(qst => qst.type === t).length
  return {
    technical: n('technical') + n('coding'),
    behavioral: n('behavioral'),
    project: n('project'),
    design: n('system-design'),
    problem: n('problem-solving'),
  }
}

export function startLive(setup: InterviewSetup, count = questionCountFor(setup.duration)): LiveInterview {
  return {
    id: `iv-${Date.now()}`,
    setup,
    questions: pickQuestions(setup, count),
    answers: [],
    index: 0,
    startedAt: new Date().toISOString(),
    remainingSec: setup.duration * 60,
    hint: null,
  }
}

export const PROJECT_PRACTICE = {
  title: 'React Expense Tracker',
  href: `/projects/${EXPENSE_PROJECT_ID}`,
  questions: [
    'Why did you choose this architecture?',
    'How did you handle API errors?',
    'How would you scale this application?',
  ],
}

export function kindLabel(kind: InterviewKind) {
  return INTERVIEW_KINDS.find(k => k.id === kind)?.title.replace(' Interview', '') ?? kind
}
