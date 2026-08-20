import type { ProjectRow, StudentProjectRow } from './api'
import { userStorageKey } from './supabase'

export type ProjectCategory =
  | 'Web Development'
  | 'Mobile Development'
  | 'Data Analytics'
  | 'AI & Machine Learning'
  | 'Business'
  | 'Finance'
  | 'Design'
  | 'Career'

export type ProjectDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export type ProjectBadge =
  | 'AI Recommended'
  | 'Portfolio Ready'
  | 'New'
  | 'Popular'
  | 'Tutor Supported'

export type ProjectStatus = 'not-started' | 'in-progress' | 'submitted' | 'completed'

export interface ProjectTask {
  id: string
  label: string
  required: boolean
}

export interface ProjectMilestone {
  id: string
  title: string
  tasks: ProjectTask[]
}

export interface ProjectFile {
  path: string
  language: 'jsx' | 'js' | 'css' | 'json' | 'md'
  content: string
}

export interface SkillNeed {
  name: string
  kind: 'required' | 'nice' | 'practice' | 'improve'
  have: boolean
}

export interface ProjectResource {
  title: string
  kind: 'lesson' | 'docs' | 'starter' | 'example' | 'notes'
  href: string
}

export interface CatalogProject {
  id: string
  title: string
  tagline: string
  description: string
  category: ProjectCategory
  difficulty: ProjectDifficulty
  estimatedMinutes: number
  skills: string[]
  requiredSkills: SkillNeed[]
  visual: { icon: string; color: string }
  badges: ProjectBadge[]
  aiRecommended: boolean
  aiReason: string
  skillMatch: number
  aiSupport: boolean
  tutorSupport: boolean
  portfolioReady: boolean
  careerRelevant: boolean
  interviewPractice: boolean
  popular: boolean
  createdAt: string
  outcomes: string[]
  roadmap: string[]
  milestones: ProjectMilestone[]
  files: ProjectFile[]
  resources: ProjectResource[]
  nextProjectId: string | null
  hints: string[]
  solution: string
  tutor: { name: string; skills: string; rating: number }
  review: {
    overall: number
    breakdown: Record<string, number>
    strengths: string[]
    improve: string[]
    finalOverall: number
    finalBreakdown: Record<string, number>
    didWell: string[]
    nextImprove: string[]
  }
  careerImpact: { skill: string; delta: number }[]
  careerMatchFrom: number
  careerMatchTo: number
  badgeName: string
  previewKind: 'expense' | 'generic'
}

export interface ProjectProgress {
  status: ProjectStatus
  tasks: Record<string, boolean>
  files: Record<string, string>
  ranSuccessfully: boolean
  readmeAdded: boolean
  codeReviewed: boolean
  testsCompleted: boolean
  submittedAt?: string
  completedAt?: string
  score?: number
  inPortfolio?: boolean
  savedAt?: string
}

export const PROJECT_CATEGORIES: Array<'All' | ProjectCategory> = [
  'All',
  'Web Development',
  'Mobile Development',
  'Data Analytics',
  'AI & Machine Learning',
  'Business',
  'Finance',
  'Design',
  'Career',
]

export const PROJECT_SKILLS = ['React', 'JavaScript', 'Python', 'Node.js', 'SQL', 'AI', 'Data Analytics'] as const

export const TIME_FILTERS = [
  { id: 'under1', label: 'Under 1 hour' },
  { id: '1to3', label: '1–3 hours' },
  { id: '3to8', label: '3–8 hours' },
  { id: '8plus', label: '8+ hours' },
] as const

const WISH_KEY = 'learnsyra_project_wish'
const PROGRESS_KEY = 'learnsyra_project_progress'
const PORTFOLIO_KEY = 'learnsyra_project_portfolio'

export function formatDuration(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function remainingLabel(minutes: number, progress: number) {
  const left = Math.max(8, Math.round(minutes * (1 - progress / 100)))
  return formatDuration(left)
}

export function timeBucket(minutes: number) {
  if (minutes < 60) return 'under1'
  if (minutes <= 180) return '1to3'
  if (minutes <= 480) return '3to8'
  return '8plus'
}

export function categoryVisual(category: ProjectCategory): { icon: string; color: string } {
  const map: Record<ProjectCategory, { icon: string; color: string }> = {
    'Web Development': { icon: '</>', color: '#6C5CE7' },
    'Mobile Development': { icon: '📱', color: '#8B5CF6' },
    'Data Analytics': { icon: '📊', color: '#22C7D6' },
    'AI & Machine Learning': { icon: '🤖', color: '#4F8CFF' },
    Business: { icon: '📈', color: '#20C997' },
    Finance: { icon: '💰', color: '#f43f5e' },
    Design: { icon: '◈', color: '#f59e0b' },
    Career: { icon: '💼', color: '#667085' },
  }
  return map[category]
}

export function loadProjectWishlist(): string[] {
  const key = userStorageKey(WISH_KEY)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveProjectWishlist(ids: string[]) {
  const key = userStorageKey(WISH_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(ids))
}

export function loadAllProgress(): Record<string, ProjectProgress> {
  const key = userStorageKey(PROGRESS_KEY)
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, ProjectProgress>) : {}
  } catch {
    return {}
  }
}

export function saveAllProgress(map: Record<string, ProjectProgress>) {
  const key = userStorageKey(PROGRESS_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(map))
}

export function loadPortfolioIds(): string[] {
  const key = userStorageKey(PORTFOLIO_KEY)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function savePortfolioIds(ids: string[]) {
  const key = userStorageKey(PORTFOLIO_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(ids))
}

export function emptyProgress(project: CatalogProject): ProjectProgress {
  const files: Record<string, string> = {}
  project.files.forEach(f => {
    files[f.path] = f.content
  })
  return {
    status: 'not-started',
    tasks: {},
    files,
    ranSuccessfully: false,
    readmeAdded: (files['README.md'] ?? '').trim().length > 80,
    codeReviewed: false,
    testsCompleted: false,
  }
}

export function progressPct(project: CatalogProject, progress: ProjectProgress) {
  const tasks = project.milestones.flatMap(m => m.tasks)
  if (!tasks.length) return 0
  const done = tasks.filter(t => progress.tasks[t.id]).length
  return Math.round((done / tasks.length) * 100)
}

export function requiredIncomplete(project: CatalogProject, progress: ProjectProgress) {
  return project.milestones.flatMap(m => m.tasks).filter(t => t.required && !progress.tasks[t.id])
}

export function currentMilestone(project: CatalogProject, progress: ProjectProgress) {
  return (
    project.milestones.find(m => m.tasks.some(t => !progress.tasks[t.id])) ??
    project.milestones[project.milestones.length - 1]
  )
}

export function currentTask(project: CatalogProject, progress: ProjectProgress) {
  for (const m of project.milestones) {
    const open = m.tasks.find(t => !progress.tasks[t.id])
    if (open) return { milestone: m, task: open }
  }
  const last = project.milestones[project.milestones.length - 1]
  return { milestone: last, task: last?.tasks[last.tasks.length - 1] }
}

const ROADMAP = [
  'Understand Requirements',
  'Plan Architecture',
  'Build UI',
  'Connect API',
  'Test',
  'Deploy',
  'Submit',
]

const DEFAULT_TUTOR = { name: 'Explore tutors', skills: 'Recommended', rating: 0 }

const EXPENSE_FILES: ProjectFile[] = [
  {
    path: 'src/App.jsx',
    language: 'jsx',
    content: `import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <main className="app">
      <Dashboard />
    </main>
  )
}
`,
  },
  {
    path: 'src/pages/Dashboard.jsx',
    language: 'jsx',
    content: `import { useEffect, useState } from 'react'
import ExpenseList from '../components/ExpenseList'
import ExpenseForm from '../components/ExpenseForm'
import { fetchExpenses } from '../services/api'

export default function Dashboard() {
  const [expenses, setExpenses] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchExpenses().then(setExpenses).catch(() => setError('Could not load expenses'))
  }, [])

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <section>
      <h1>Expense Dashboard</h1>
      <p>Total Balance: {total}</p>
      {error && <p>{error}</p>}
      <ExpenseForm onAdd={item => setExpenses(list => [item, ...list])} />
      <ExpenseList items={expenses} />
    </section>
  )
}
`,
  },
  {
    path: 'src/components/ExpenseCard.jsx',
    language: 'jsx',
    content: `export default function ExpenseCard({ expense }) {
  return (
    <article className="card">
      <h3>{expense.title}</h3>
      <p>{expense.category}</p>
      <strong>\${expense.amount}</strong>
    </article>
  )
}
`,
  },
  {
    path: 'src/components/ExpenseList.jsx',
    language: 'jsx',
    content: `import ExpenseCard from './ExpenseCard'

export default function ExpenseList({ items }) {
  if (!items.length) return <p>No expenses yet.</p>
  return (
    <ul>
      {items.map(expense => (
        <li key={expense.id}>
          <ExpenseCard expense={expense} />
        </li>
      ))}
    </ul>
  )
}
`,
  },
  {
    path: 'src/components/ExpenseForm.jsx',
    language: 'jsx',
    content: `import { useState } from 'react'

export default function ExpenseForm({ onAdd }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')

  function handleSubmit(e) {
    e.preventDefault()
    onAdd({ id: Date.now(), title, amount: Number(amount), category })
    setTitle('')
    setAmount('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
      <select value={category} onChange={e => setCategory(e.target.value)}>
        <option>Food</option>
        <option>Travel</option>
        <option>Bills</option>
      </select>
      <button type="submit">Add Expense</button>
    </form>
  )
}
`,
  },
  {
    path: 'src/services/api.js',
    language: 'js',
    content: `const MOCK = [
  { id: 1, title: 'Groceries', amount: 54, category: 'Food' },
  { id: 2, title: 'Metro pass', amount: 30, category: 'Travel' },
]

export async function fetchExpenses() {
  return MOCK
}

export async function createExpense(payload) {
  return { id: Date.now(), ...payload }
}
`,
  },
  {
    path: 'README.md',
    language: 'md',
    content: `# React Expense Tracker\n\nStarter files for the LearnSyra project.\n`,
  },
]

function slugId(slug: string) {
  return `catalog-${slug}`
}

function milestonesFor(slug: string, title: string): ProjectMilestone[] {
  if (slug === 'react-expense') {
    return [
      {
        id: 'req',
        title: 'Requirements',
        tasks: [
          { id: 'req-1', label: 'Read product requirements', required: true },
          { id: 'req-2', label: 'List expense data fields', required: true },
        ],
      },
      {
        id: 'ui',
        title: 'UI Structure',
        tasks: [
          { id: 'ui-1', label: 'Scaffold App and Dashboard layout', required: true },
          { id: 'ui-2', label: 'Add empty states', required: false },
        ],
      },
      {
        id: 'components',
        title: 'Expense Components',
        tasks: [
          { id: 'comp-1', label: 'Create ExpenseCard', required: true },
          { id: 'comp-2', label: 'Create ExpenseList', required: true },
          { id: 'comp-3', label: 'Add ExpenseForm', required: true },
          { id: 'comp-4', label: 'Add validation', required: true },
        ],
      },
      {
        id: 'api',
        title: 'API Integration',
        tasks: [
          { id: 'api-1', label: 'Fetch expenses from REST API', required: true },
          { id: 'api-2', label: 'Create expense via POST', required: true },
        ],
      },
      {
        id: 'test',
        title: 'Testing',
        tasks: [
          { id: 'test-1', label: 'Test form validation', required: true },
          { id: 'test-2', label: 'Test list rendering', required: false },
        ],
      },
      {
        id: 'deploy',
        title: 'Deployment',
        tasks: [
          { id: 'dep-1', label: 'Prepare production build notes', required: true },
          { id: 'dep-2', label: 'Write README', required: true },
        ],
      },
      {
        id: 'submit',
        title: 'Submit',
        tasks: [{ id: 'sub-1', label: 'Final self-review before submit', required: true }],
      },
    ]
  }
  return ROADMAP.map((titleText, i) => ({
    id: `m-${i}`,
    title: titleText,
    tasks: [
      { id: `${slug}-t${i}a`, label: `Complete ${titleText.toLowerCase()} for ${title}`, required: true },
      { id: `${slug}-t${i}b`, label: `Capture notes for ${titleText.toLowerCase()}`, required: i < 5 },
    ],
  }))
}

function filesFor(slug: string, title: string, skills: string[]): ProjectFile[] {
  if (slug === 'react-expense') return EXPENSE_FILES
  const name = title.replace(/[^A-Za-z0-9]/g, '')
  return [
    {
      path: 'src/App.jsx',
      language: 'jsx',
      content: `export default function App() {
  return (
    <main>
      <h1>${title}</h1>
      <p>Skills in play: ${skills.join(', ')}</p>
    </main>
  )
}
`,
    },
    {
      path: `src/components/${name || 'Main'}View.jsx`,
      language: 'jsx',
      content: `export default function View() {
  return <section>Build the ${title} interface here.</section>
}
`,
    },
    {
      path: 'src/services/api.js',
      language: 'js',
      content: `export async function loadData() {
  return []
}
`,
    },
    {
      path: 'README.md',
      language: 'md',
      content: `# ${title}\n\nStarter files for this LearnSyra project.\n`,
    },
  ]
}

function resourcesFor(skills: string[]): ProjectResource[] {
  const first = skills[0] ?? 'React'
  return [
    { title: `${first} lesson`, kind: 'lesson', href: `/courses?q=${encodeURIComponent(first)}` },
    { title: 'REST API lesson', kind: 'lesson', href: '/courses?q=REST%20API' },
    { title: 'Authentication lesson', kind: 'lesson', href: '/courses?q=Authentication' },
    { title: 'Official documentation', kind: 'docs', href: '/courses' },
    { title: 'Starter files', kind: 'starter', href: '#files' },
    { title: 'Reference examples', kind: 'example', href: '/ai-learning' },
    { title: 'AI notes', kind: 'notes', href: '/ai-learning' },
  ]
}

function hintsFor(title: string, slug: string) {
  if (slug === 'react-expense') {
    return [
      'Start by creating a controlled form for the expense amount and category. Store the form values in component state before connecting the API.',
      'Guard the dashboard total with a fallback so an undefined expense cannot crash the first render. Use optional chaining or a default object.',
      'Validate amount as a positive number before calling onAdd. Disable submit until title and amount are valid.',
    ]
  }
  return [
    `Break ${title} into the smallest screen you can ship first, then add data.`,
    'Write the happy path, then add empty and error states.',
    'Review naming, accessibility labels, and one test before you submit.',
  ]
}

type Seed = {
  slug: string
  title: string
  tagline: string
  description: string
  category: ProjectCategory
  difficulty: ProjectDifficulty
  minutes: number
  skills: string[]
  outcomes: string[]
  badges?: ProjectBadge[]
  aiRecommended?: boolean
  aiReason?: string
  skillMatch?: number
  aiSupport?: boolean
  tutorSupport?: boolean
  portfolioReady?: boolean
  careerRelevant?: boolean
  interviewPractice?: boolean
  popular?: boolean
  createdAt?: string
  nextSlug?: string
  badgeName?: string
  requiredSkills?: SkillNeed[]
}

function expand(seed: Seed): CatalogProject {
  const visual = categoryVisual(seed.category)
  const badges: ProjectBadge[] = [...(seed.badges ?? [])]
  if (seed.aiRecommended && !badges.includes('AI Recommended')) badges.unshift('AI Recommended')
  if (seed.portfolioReady && !badges.includes('Portfolio Ready')) badges.push('Portfolio Ready')
  if (seed.tutorSupport !== false && !badges.includes('Tutor Supported')) badges.push('Tutor Supported')
  const slug = seed.slug
  return {
    id: slugId(slug),
    title: seed.title,
    tagline: seed.tagline,
    description: seed.description,
    category: seed.category,
    difficulty: seed.difficulty,
    estimatedMinutes: seed.minutes,
    skills: seed.skills,
    requiredSkills: seed.requiredSkills ?? [
      { name: seed.skills[0] ?? 'JavaScript', kind: 'required', have: false },
      { name: seed.skills[1] ?? 'Git', kind: 'required', have: false },
      { name: 'Testing', kind: 'improve', have: false },
    ],
    visual,
    badges,
    aiRecommended: Boolean(seed.aiRecommended),
    aiReason:
      seed.aiReason ??
      `This project helps you apply ${seed.skills.slice(0, 2).join(' and ')} in a portfolio-ready build.`,
    skillMatch: seed.skillMatch ?? 0,
    aiSupport: seed.aiSupport !== false,
    tutorSupport: seed.tutorSupport !== false,
    portfolioReady: seed.portfolioReady !== false,
    careerRelevant: seed.careerRelevant !== false,
    interviewPractice: Boolean(seed.interviewPractice),
    popular: Boolean(seed.popular),
    createdAt: seed.createdAt ?? '2026-06-01',
    outcomes: seed.outcomes,
    roadmap: ROADMAP,
    milestones: milestonesFor(slug, seed.title),
    files: filesFor(slug, seed.title, seed.skills),
    resources: resourcesFor(seed.skills),
    nextProjectId: seed.nextSlug ? slugId(seed.nextSlug) : null,
    hints: hintsFor(seed.title, slug),
    solution:
      slug === 'react-expense'
        ? 'Add controlled inputs, validate amount > 0, and compute totals with (expenses ?? []).reduce so the first render never reads amount from undefined.'
        : `Ship a working ${seed.title} flow, then add validation, empty states, and a short README.`,
    tutor: DEFAULT_TUTOR,
    review: {
      overall: 82,
      breakdown: { 'Code Quality': 84, Logic: 88, Accessibility: 72, Performance: 81, Security: 85 },
      strengths: ['Clean component structure', 'Good state management'],
      improve: ['Add form validation', 'Improve accessibility labels'],
      finalOverall: 86,
      finalBreakdown: {
        'Technical Skills': 88,
        'Code Quality': 84,
        'UI/UX': 86,
        'Problem Solving': 90,
        Documentation: 78,
      },
      didWell: ['Good component structure', 'Correct API integration', 'Clean state management'],
      nextImprove: ['Add automated tests', 'Improve documentation'],
    },
    careerImpact: seed.skills.slice(0, 3).map((skill, i) => ({ skill, delta: [8, 6, 5][i] ?? 4 })),
    careerMatchFrom: 0,
    careerMatchTo: 0,
    badgeName: seed.badgeName ?? `${seed.skills[0] ?? 'Project'} Builder`,
    previewKind: slug === 'react-expense' ? 'expense' : 'generic',
  }
}

const SEEDS: Seed[] = [
  {
    slug: 'react-expense',
    title: 'React Expense Tracker',
    tagline: 'Build a real-world expense management application.',
    description:
      'Build a production-style expense tracking application with authentication, charts and REST API integration.',
    category: 'Web Development',
    difficulty: 'Intermediate',
    minutes: 150,
    skills: ['React', 'JavaScript', 'REST API', 'Charts'],
    outcomes: [
      'Responsive dashboard',
      'Expense creation/editing',
      'REST API integration',
      'Data visualization',
      'Authentication',
      'Deployment-ready structure',
    ],
    badges: ['AI Recommended', 'Portfolio Ready', 'Popular'],
    aiRecommended: true,
    aiReason:
      'Catalog project for practicing React, JavaScript, REST APIs, and charts.',
    skillMatch: 0,
    popular: true,
    careerRelevant: true,
    interviewPractice: true,
    nextSlug: 'fullstack-auth',
    badgeName: 'React Builder',
    createdAt: '2026-07-12',
    requiredSkills: [
      { name: 'React', kind: 'required', have: false },
      { name: 'JavaScript', kind: 'required', have: false },
      { name: 'REST APIs', kind: 'required', have: false },
      { name: 'Basic Git', kind: 'required', have: false },
      { name: 'TypeScript', kind: 'nice', have: false },
      { name: 'Testing', kind: 'improve', have: false },
      { name: 'State Management', kind: 'practice', have: false },
    ],
  },
  {
    slug: 'fullstack-auth',
    title: 'Full Stack Authentication System',
    tagline: 'Ship login, sessions, and protected routes.',
    description: 'Build signup, login, password reset, and protected pages with a Node.js API and a React client.',
    category: 'Web Development',
    difficulty: 'Intermediate',
    minutes: 180,
    skills: ['React', 'Node.js', 'JavaScript'],
    outcomes: ['Auth screens', 'JWT session flow', 'Protected routes', 'Password reset', 'API error handling'],
    badges: ['Portfolio Ready', 'New'],
    aiRecommended: true,
    aiReason: 'Catalog project covering authentication with React and Node.js.',
    skillMatch: 0,
    nextSlug: 'node-task-queue',
    badgeName: 'Auth Builder',
    createdAt: '2026-08-02',
  },
  {
    slug: 'personal-portfolio',
    title: 'Personal Portfolio Website',
    tagline: 'A live site that proves your skills.',
    description: 'Design and build a responsive personal portfolio with project case studies and a contact form.',
    category: 'Web Development',
    difficulty: 'Beginner',
    minutes: 90,
    skills: ['JavaScript', 'React'],
    outcomes: ['Responsive layout', 'Project gallery', 'Contact form', 'Accessible navigation'],
    badges: ['New'],
    createdAt: '2026-08-10',
  },
  {
    slug: 'rest-bookstore',
    title: 'REST API Bookstore',
    tagline: 'CRUD APIs with clean resource design.',
    description: 'Create a bookstore API with books, authors, pagination, and validation using Node.js.',
    category: 'Web Development',
    difficulty: 'Intermediate',
    minutes: 200,
    skills: ['Node.js', 'JavaScript', 'REST API'],
    outcomes: ['REST resources', 'Validation', 'Pagination', 'Error contracts'],
    popular: true,
    interviewPractice: true,
  },
  {
    slug: 'habit-tracker-mobile',
    title: 'React Native Habit Tracker',
    tagline: 'Daily habits on iOS and Android.',
    description: 'Build a mobile habit tracker with streaks, local storage, and a weekly progress view.',
    category: 'Mobile Development',
    difficulty: 'Intermediate',
    minutes: 180,
    skills: ['React', 'JavaScript'],
    outcomes: ['Mobile screens', 'Streak logic', 'Local persistence', 'Weekly chart'],
    badges: ['Portfolio Ready'],
  },
  {
    slug: 'flutter-weather',
    title: 'Flutter Weather App',
    tagline: 'Live weather with a polished mobile UI.',
    description: 'Fetch weather data, show forecasts, and handle loading and error states in Flutter.',
    category: 'Mobile Development',
    difficulty: 'Beginner',
    minutes: 90,
    skills: ['JavaScript'],
    outcomes: ['Forecast UI', 'API fetch', 'Empty/error states'],
    badges: ['New'],
  },
  {
    slug: 'sql-sales-dashboard',
    title: 'Sales Dashboard with SQL',
    tagline: 'Turn warehouse data into decisions.',
    description: 'Query sales data with SQL and present KPIs, trends, and a regional breakdown.',
    category: 'Data Analytics',
    difficulty: 'Intermediate',
    minutes: 150,
    skills: ['SQL', 'Data Analytics'],
    outcomes: ['KPI cards', 'SQL joins', 'Trend chart', 'Regional table'],
    popular: true,
    careerRelevant: true,
  },
  {
    slug: 'python-cleaning',
    title: 'Python Data Cleaning Pipeline',
    tagline: 'Clean messy data the way teams actually do.',
    description: 'Profile, clean, and export a dataset with Python. Document every transformation.',
    category: 'Data Analytics',
    difficulty: 'Beginner',
    minutes: 75,
    skills: ['Python', 'Data Analytics'],
    outcomes: ['Data profile', 'Cleaning steps', 'Export', 'Reproducible notes'],
  },
  {
    slug: 'churn-analysis',
    title: 'Customer Churn Analysis',
    tagline: 'Find who leaves — and why.',
    description: 'Analyze churn drivers, build a simple model, and present an executive summary.',
    category: 'Data Analytics',
    difficulty: 'Advanced',
    minutes: 240,
    skills: ['Python', 'SQL', 'Data Analytics'],
    outcomes: ['Feature table', 'Churn insights', 'Model baseline', 'Exec brief'],
    interviewPractice: true,
  },
  {
    slug: 'sentiment-python',
    title: 'Sentiment Analysis with Python',
    tagline: 'Classify text and explain the results.',
    description: 'Train a lightweight sentiment classifier and ship a small review-scoring demo.',
    category: 'AI & Machine Learning',
    difficulty: 'Intermediate',
    minutes: 180,
    skills: ['Python', 'AI'],
    outcomes: ['Labeled dataset', 'Model training', 'Demo UI', 'Error analysis'],
    popular: true,
  },
  {
    slug: 'faq-chatbot',
    title: 'Chatbot FAQ Assistant',
    tagline: 'Answer product questions with retrieval.',
    description: 'Build an FAQ assistant that retrieves answers and cites the source document.',
    category: 'AI & Machine Learning',
    difficulty: 'Intermediate',
    minutes: 150,
    skills: ['AI', 'JavaScript'],
    outcomes: ['Knowledge base', 'Retrieval flow', 'Cited answers', 'Fallback path'],
    badges: ['AI Recommended', 'New'],
    aiRecommended: true,
    skillMatch: 0,
  },
  {
    slug: 'image-classifier',
    title: 'Image Classifier Starter',
    tagline: 'A first computer-vision build.',
    description: 'Train a small image classifier and wrap it in a simple upload demo.',
    category: 'AI & Machine Learning',
    difficulty: 'Advanced',
    minutes: 300,
    skills: ['Python', 'AI'],
    outcomes: ['Dataset split', 'Model training', 'Upload demo', 'Metrics'],
  },
  {
    slug: 'kpi-dashboard',
    title: 'Business KPI Dashboard',
    tagline: 'Weekly metrics leaders actually use.',
    description: 'Design a KPI dashboard with north-star metrics, trends, and commentary.',
    category: 'Business',
    difficulty: 'Beginner',
    minutes: 60,
    skills: ['Data Analytics', 'JavaScript'],
    outcomes: ['KPI cards', 'Trend view', 'Commentary', 'Export snapshot'],
  },
  {
    slug: 'market-research',
    title: 'Market Research Deck',
    tagline: 'A structured research brief.',
    description: 'Collect market signals, size a segment, and present a go-to-market recommendation.',
    category: 'Business',
    difficulty: 'Intermediate',
    minutes: 120,
    skills: ['Data Analytics'],
    outcomes: ['Segment sizing', 'Competitor map', 'Recommendation', 'Slide narrative'],
  },
  {
    slug: 'budget-planner',
    title: 'Personal Budget Planner',
    tagline: 'Income, categories, and a real monthly plan.',
    description: 'Build a budget planner that tracks income, categories, and remaining spend.',
    category: 'Finance',
    difficulty: 'Beginner',
    minutes: 90,
    skills: ['JavaScript', 'React'],
    outcomes: ['Budget form', 'Category totals', 'Remaining spend', 'Save state'],
  },
  {
    slug: 'stock-watchlist',
    title: 'Stock Watchlist App',
    tagline: 'Quotes, alerts, and a clean watchlist.',
    description: 'Create a stock watchlist with mock quotes, percent change, and simple alerts.',
    category: 'Finance',
    difficulty: 'Intermediate',
    minutes: 180,
    skills: ['React', 'JavaScript', 'REST API'],
    outcomes: ['Watchlist UI', 'Quote cards', 'Alert rules', 'API layer'],
    popular: true,
  },
  {
    slug: 'invoice-generator',
    title: 'Invoice Generator',
    tagline: 'Professional invoices from structured data.',
    description: 'Generate invoices with line items, tax, and a printable layout.',
    category: 'Finance',
    difficulty: 'Intermediate',
    minutes: 150,
    skills: ['JavaScript', 'React'],
    outcomes: ['Line items', 'Tax math', 'Print layout', 'PDF-ready view'],
    portfolioReady: true,
  },
  {
    slug: 'design-system',
    title: 'Design System Showcase',
    tagline: 'Tokens, components, and usage rules.',
    description: 'Document a small design system with color, type, buttons, and cards.',
    category: 'Design',
    difficulty: 'Intermediate',
    minutes: 120,
    skills: ['JavaScript'],
    outcomes: ['Token sheet', 'Button set', 'Card patterns', 'Usage notes'],
  },
  {
    slug: 'landing-redesign',
    title: 'Landing Page Redesign',
    tagline: 'A conversion-focused marketing page.',
    description: 'Redesign a landing page with hierarchy, social proof, and a clear CTA.',
    category: 'Design',
    difficulty: 'Beginner',
    minutes: 60,
    skills: ['JavaScript'],
    outcomes: ['Hero layout', 'Proof section', 'CTA', 'Mobile polish'],
    badges: ['New'],
    createdAt: '2026-08-14',
  },
  {
    slug: 'resume-kit',
    title: 'Resume & Cover Letter Kit',
    tagline: 'Career assets you can reuse.',
    description: 'Write a targeted resume and cover letter for one role, with a skills inventory.',
    category: 'Career',
    difficulty: 'Beginner',
    minutes: 45,
    skills: ['JavaScript'],
    outcomes: ['Resume draft', 'Cover letter', 'Skills inventory'],
    careerRelevant: true,
  },
  {
    slug: 'interview-tracker',
    title: 'Interview Prep Tracker',
    tagline: 'Practice questions with a weekly plan.',
    description: 'Track interview questions, confidence, and a weekly practice cadence.',
    category: 'Career',
    difficulty: 'Beginner',
    minutes: 50,
    skills: ['JavaScript', 'React'],
    outcomes: ['Question bank', 'Confidence scores', 'Weekly plan'],
    interviewPractice: true,
  },
  {
    slug: 'node-task-queue',
    title: 'Node.js Task Queue API',
    tagline: 'Background jobs with retries.',
    description: 'Design a small job queue API with enqueue, retry, and status endpoints.',
    category: 'Web Development',
    difficulty: 'Advanced',
    minutes: 240,
    skills: ['Node.js', 'JavaScript'],
    outcomes: ['Enqueue API', 'Retry policy', 'Job status', 'Failure logs'],
    interviewPractice: true,
  },
  {
    slug: 'sql-retail',
    title: 'SQL Case Study: Retail',
    tagline: 'Answer business questions with SQL.',
    description: 'Solve a retail case with joins, windows, and a clear insight write-up.',
    category: 'Data Analytics',
    difficulty: 'Intermediate',
    minutes: 100,
    skills: ['SQL', 'Data Analytics'],
    outcomes: ['Join queries', 'Window metrics', 'Insight memo'],
    careerRelevant: true,
  },
  {
    slug: 'prompt-library',
    title: 'AI Prompt Library App',
    tagline: 'Save, tag, and reuse high-quality prompts.',
    description: 'Build a prompt library with tags, search, and copy-to-clipboard workflows.',
    category: 'AI & Machine Learning',
    difficulty: 'Beginner',
    minutes: 80,
    skills: ['AI', 'React', 'JavaScript'],
    outcomes: ['Prompt cards', 'Tags', 'Search', 'Copy actions'],
    badges: ['New', 'Popular'],
    createdAt: '2026-08-08',
  },
]

const MOCK_PROJECTS: CatalogProject[] = SEEDS.map(expand)

function inferCategory(row: ProjectRow): ProjectCategory {
  const blob = `${row.title} ${row.description ?? ''} ${row.skills.join(' ')}`.toLowerCase()
  if (/mobile|android|ios|flutter|react native/.test(blob)) return 'Mobile Development'
  if (/data|sql|analytics|python/.test(blob) && /ai|ml|machine/.test(blob) === false) return 'Data Analytics'
  if (/ai|ml|machine|llm/.test(blob)) return 'AI & Machine Learning'
  if (/finance|budget|invoice|stock/.test(blob)) return 'Finance'
  if (/design|ui|ux/.test(blob)) return 'Design'
  if (/career|resume|interview/.test(blob)) return 'Career'
  if (/business|kpi|market/.test(blob)) return 'Business'
  return 'Web Development'
}

function inferDifficulty(value: string | null): ProjectDifficulty {
  if (value === 'Beginner' || value === 'Advanced' || value === 'Intermediate') return value
  return 'Intermediate'
}

function fromApi(row: ProjectRow): CatalogProject {
  const mock = MOCK_PROJECTS.find(m => m.title.toLowerCase() === row.title.toLowerCase())
  if (mock) {
    return {
      ...mock,
      id: row.id,
      title: row.title,
      description: row.description || mock.description,
      difficulty: inferDifficulty(row.difficulty) || mock.difficulty,
      skills: row.skills.length ? row.skills : mock.skills,
      createdAt: row.created_at || mock.createdAt,
    }
  }
  const category = inferCategory(row)
  const seed: Seed = {
    slug: row.id.slice(0, 12),
    title: row.title,
    tagline: row.description || 'Build a portfolio-ready project.',
    description: row.description || 'Apply your skills in a guided, tutor-supported project.',
    category,
    difficulty: inferDifficulty(row.difficulty),
    minutes: 120,
    skills: row.skills.length ? row.skills : ['JavaScript'],
    outcomes: ['Working prototype', 'Clean structure', 'README', 'AI review'],
    createdAt: row.created_at,
  }
  return { ...expand(seed), id: row.id }
}

export function buildProjectCatalog(apiProjects: ProjectRow[]): CatalogProject[] {
  const fromRows = apiProjects.map(fromApi)
  const extra = MOCK_PROJECTS.filter(m => !fromRows.some(r => r.title.toLowerCase() === m.title.toLowerCase()))
  return [...fromRows, ...extra]
}

export function getProjectById(catalog: CatalogProject[], id: string) {
  return catalog.find(p => p.id === id) ?? MOCK_PROJECTS.find(p => p.id === id) ?? null
}

export function recommendProject(catalog: CatalogProject[], completedIds: string[]) {
  const completed = new Set(completedIds)
  const nextFromDone = catalog.find(p => completed.has(p.id) && p.nextProjectId && !completed.has(p.nextProjectId))
  if (nextFromDone?.nextProjectId) {
    const nxt = catalog.find(p => p.id === nextFromDone.nextProjectId)
    if (nxt) return nxt
  }
  return (
    catalog.find(p => p.aiRecommended && !completed.has(p.id)) ||
    catalog.find(p => !completed.has(p.id)) ||
    catalog[0]
  )
}

export function mergeApiStatus(
  progress: ProjectProgress,
  row: StudentProjectRow | undefined,
): ProjectProgress {
  if (!row) return progress
  const status: ProjectStatus =
    row.status === 'completed' ? 'completed' : row.status === 'submitted' ? 'submitted' : 'in-progress'
  return {
    ...progress,
    status: progress.status === 'completed' ? 'completed' : status,
    submittedAt: row.submitted_at ?? progress.submittedAt,
  }
}

export function detectRuntimeError(code: string) {
  const dash = code.includes('expense.amount') && !code.includes('expense?.') && !code.includes('(expenses ??')
  if (dash) {
    return {
      title: 'Cannot read properties of undefined',
      why: 'The expense object is undefined when the component first renders.',
      how: 'The dashboard reduces expenses before data arrives, and it reads expense.amount without a guard.',
      tryThis: 'Use (expenses ?? []) and optional chaining, or start with an empty array and skip undefined items.',
      fixFrom: 'expenses.reduce((sum, expense) => sum + expense.amount, 0)',
      fixTo: '(expenses ?? []).reduce((sum, expense) => sum + (expense?.amount ?? 0), 0)',
    }
  }
  return null
}

export function formatCode(content: string, language: string) {
  if (language === 'json') {
    try {
      return JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      return content
    }
  }
  return content
    .replace(/\t/g, '  ')
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .join('\n')
}

export function treeFromFiles(files: ProjectFile[]) {
  const paths = files.map(f => f.path).sort()
  return paths
}

export function submissionChecklist(project: CatalogProject, progress: ProjectProgress) {
  const requiredLeft = requiredIncomplete(project, progress)
  const testsDone =
    progress.testsCompleted ||
    project.milestones
      .filter(m => /test/i.test(m.title))
      .every(m => m.tasks.filter(t => t.required).every(t => progress.tasks[t.id]))
  const readme = progress.readmeAdded || (progress.files['README.md'] ?? '').trim().length > 80
  return [
    { id: 'tasks', label: 'All required tasks completed', ok: requiredLeft.length === 0 },
    { id: 'run', label: 'Project runs successfully', ok: progress.ranSuccessfully },
    { id: 'readme', label: 'README added', ok: readme },
    { id: 'review', label: 'Code reviewed', ok: progress.codeReviewed },
    { id: 'tests', label: 'Tests completed', ok: testsDone },
  ]
}
