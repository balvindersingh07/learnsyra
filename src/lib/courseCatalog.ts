import type { CourseRow } from './api'

export type CourseBadge =
  | 'AI Recommended'
  | 'Bestseller'
  | 'New'
  | 'Free'
  | 'Premium'
  | 'Career Relevant'
  | 'Tutor Supported'

export interface CatalogCourse {
  id: string
  title: string
  instructor: string
  category: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  rating: number
  students: number | null
  durationHours: number
  skills: string[]
  price: number
  originalPrice?: number
  badges: CourseBadge[]
  aiRecommended: boolean
  aiReason?: string
  tutorSupport: boolean
  aiSupport: boolean
  projects: boolean
  certificate: boolean
  thumbnail: string | null
  description: string
  createdAt: string
  demo?: boolean
}

export interface CourseRecommendation {
  courseId: string
  match: number
  reasons: string[]
  badges: string[]
}

export interface SkillGapRec {
  skill: string
  score: number
  courseTitle: string
}

export interface CareerPath {
  id: string
  icon: string
  title: string
  steps: string[]
}

export const MARKET_CATEGORIES = [
  'All',
  'Programming',
  'AI & Machine Learning',
  'Data Analytics',
  'Business',
  'MBA',
  'English',
  'Mathematics',
  'Finance',
  'Career Skills',
]

export const POPULAR_SEARCHES = ['React', 'Python', 'Data Analytics', 'AI', 'Excel', 'Communication']

export const SKILL_GAPS: SkillGapRec[] = [
  { skill: 'TypeScript', score: 35, courseTitle: 'TypeScript for React Developers' },
  { skill: 'Testing', score: 22, courseTitle: 'Frontend Testing with Jest' },
]

export const CAREER_PATHS: CareerPath[] = [
  {
    id: 'frontend',
    icon: '🚀',
    title: 'Become a Frontend Developer',
    steps: ['JavaScript', 'React', 'TypeScript', 'Testing', 'Projects'],
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'Become an AI Engineer',
    steps: ['Python', 'ML', 'Deep Learning', 'LLMs', 'Projects'],
  },
  {
    id: 'data',
    icon: '📊',
    title: 'Become a Data Analyst',
    steps: ['Excel', 'SQL', 'Python', 'Power BI', 'Projects'],
  },
]

export const FRONTEND_PATH = [
  { title: 'JavaScript Fundamentals', state: 'done' as const },
  { title: 'React Development', state: 'current' as const },
  { title: 'TypeScript', state: 'next' as const },
  { title: 'Testing', state: 'next' as const },
  { title: 'Frontend Projects', state: 'next' as const },
  { title: 'Interview Preparation', state: 'next' as const },
]

const WISH_KEY = 'learnsyra_wishlist'

export function formatInr(n: number) {
  if (n <= 0) return 'Free'
  return `₹${n.toLocaleString('en-IN')}`
}

export function formatStudents(n: number | null | undefined) {
  if (n == null) return 'No student data yet.'
  if (n >= 1000) {
    const k = n / 1000
    const label = Number.isInteger(k) ? `${k}` : k.toFixed(1).replace(/\.0$/, '')
    return `${label}K students`
  }
  return `${n} students`
}

export function loadLocalWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISH_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveLocalWishlist(ids: string[]) {
  localStorage.setItem(WISH_KEY, JSON.stringify(ids))
}

function catKey(category: string | null) {
  if (category === 'AI & ML' || category === 'AI & Machine Learning') return 'AI & Machine Learning'
  return category || 'Programming'
}

function inferPrice(row: CourseRow) {
  if (row.price_cents === 0) return 0
  const n = row.price_cents / 100
  return n < 80 ? Math.round(n * 80) : Math.round(n)
}

const MOCK: Omit<CatalogCourse, 'id'>[] = [
  {
    title: 'Full Stack Web Development',
    instructor: 'Dr. Sarah Kim',
    category: 'Programming',
    level: 'Intermediate',
    rating: 4.9,
    students: 12400,
    durationHours: 42,
    skills: ['React', 'Node.js', 'APIs', 'MongoDB'],
    price: 1499,
    originalPrice: 2999,
    badges: ['AI Recommended', 'Bestseller', 'Premium'],
    aiRecommended: true,
    aiReason: "You're already strong in React. This course will help you develop backend and API skills needed for your Full Stack Developer goal.",
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Build production web apps with React, Node.js, REST APIs, and MongoDB.',
    createdAt: '2026-01-12',
  },
  {
    title: 'Data Analytics with Python',
    instructor: 'Priya Nair',
    category: 'Data Analytics',
    level: 'Beginner',
    rating: 4.8,
    students: 9800,
    durationHours: 28,
    skills: ['Python', 'pandas', 'SQL', 'Charts'],
    price: 1299,
    originalPrice: 2499,
    badges: ['Bestseller', 'Career Relevant'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Analyze datasets and present insights with Python.',
    createdAt: '2026-02-02',
  },
  {
    title: 'AI & Machine Learning',
    instructor: 'Dr. Arjun Mehta',
    category: 'AI & Machine Learning',
    level: 'Intermediate',
    rating: 4.8,
    students: 11200,
    durationHours: 36,
    skills: ['Python', 'ML', 'TensorFlow', 'Metrics'],
    price: 1799,
    originalPrice: 3299,
    badges: ['Bestseller', 'Premium'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Train, evaluate, and ship classical ML models.',
    createdAt: '2026-01-20',
  },
  {
    title: 'Business Analytics',
    instructor: 'Maya Kapoor',
    category: 'Business',
    level: 'Beginner',
    rating: 4.7,
    students: 7600,
    durationHours: 18,
    skills: ['Excel', 'SQL', 'Dashboards', 'KPIs'],
    price: 999,
    originalPrice: 1999,
    badges: ['Career Relevant'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Turn business questions into dashboards and decisions.',
    createdAt: '2026-03-01',
  },
  {
    title: 'JavaScript Fundamentals',
    instructor: 'Alex Rivera',
    category: 'Programming',
    level: 'Beginner',
    rating: 4.8,
    students: 15200,
    durationHours: 8,
    skills: ['JavaScript', 'ES6', 'DOM'],
    price: 0,
    badges: ['Free', 'Bestseller'],
    aiRecommended: false,
    tutorSupport: false,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Core JavaScript for web development.',
    createdAt: '2025-11-08',
  },
  {
    title: 'Excel for Beginners',
    instructor: 'Neha Shah',
    category: 'Data Analytics',
    level: 'Beginner',
    rating: 4.6,
    students: 13400,
    durationHours: 6,
    skills: ['Excel', 'Formulas', 'Charts'],
    price: 0,
    badges: ['Free'],
    aiRecommended: false,
    tutorSupport: false,
    aiSupport: true,
    projects: false,
    certificate: true,
    thumbnail: null,
    description: 'Spreadsheets, formulas, and clean charts.',
    createdAt: '2025-12-01',
  },
  {
    title: 'Communication Skills',
    instructor: 'Dr. Sarah Kim',
    category: 'Career Skills',
    level: 'Beginner',
    rating: 4.7,
    students: 8900,
    durationHours: 5,
    skills: ['Speaking', 'Writing', 'Meetings'],
    price: 0,
    badges: ['Free'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: false,
    certificate: true,
    thumbnail: null,
    description: 'Clear professional communication for interviews and teams.',
    createdAt: '2026-01-05',
  },
  {
    title: 'Python Basics',
    instructor: 'Priya Nair',
    category: 'Programming',
    level: 'Beginner',
    rating: 4.7,
    students: 14100,
    durationHours: 7,
    skills: ['Python', 'Functions', 'Data types'],
    price: 0,
    badges: ['Free'],
    aiRecommended: false,
    tutorSupport: false,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Syntax, control flow, and small scripts.',
    createdAt: '2025-10-14',
  },
  {
    title: 'TypeScript for React Developers',
    instructor: 'Alex Rivera',
    category: 'Programming',
    level: 'Intermediate',
    rating: 4.8,
    students: 5400,
    durationHours: 12,
    skills: ['TypeScript', 'React', 'Generics'],
    price: 899,
    originalPrice: 1799,
    badges: ['New', 'AI Recommended', 'Career Relevant'],
    aiRecommended: true,
    aiReason: 'TypeScript is your current skill gap at 35%. This course maps types directly onto the React you already know.',
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Type props, hooks, and API responses in real React apps.',
    createdAt: '2026-07-18',
  },
  {
    title: 'Frontend Testing with Jest',
    instructor: 'Maya Kapoor',
    category: 'Programming',
    level: 'Intermediate',
    rating: 4.6,
    students: 3100,
    durationHours: 9,
    skills: ['Jest', 'Testing Library', 'React'],
    price: 799,
    originalPrice: 1499,
    badges: ['New', 'AI Recommended'],
    aiRecommended: true,
    aiReason: 'Testing is at 22%. Coverage here unblocks interview-ready frontend work.',
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Unit and component tests for React UIs.',
    createdAt: '2026-07-22',
  },
  {
    title: 'React Development',
    instructor: 'Dr. Sarah Kim',
    category: 'Programming',
    level: 'Beginner',
    rating: 4.9,
    students: 16100,
    durationHours: 16,
    skills: ['React', 'Hooks', 'Routing'],
    price: 1199,
    originalPrice: 2199,
    badges: ['Bestseller', 'Tutor Supported'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Components, hooks, and app structure.',
    createdAt: '2026-03-12',
  },
  {
    title: 'Node.js and REST APIs',
    instructor: 'Dr. Sarah Kim',
    category: 'Programming',
    level: 'Intermediate',
    rating: 4.7,
    students: 6200,
    durationHours: 14,
    skills: ['Node.js', 'REST', 'Express'],
    price: 1099,
    originalPrice: 1999,
    badges: ['Tutor Supported'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'APIs, auth, and server patterns.',
    createdAt: '2026-04-04',
  },
  {
    title: 'SQL for Analysts',
    instructor: 'Priya Nair',
    category: 'Data Analytics',
    level: 'Beginner',
    rating: 4.7,
    students: 8700,
    durationHours: 10,
    skills: ['SQL', 'Joins', 'Aggregations'],
    price: 699,
    originalPrice: 1299,
    badges: [],
    aiRecommended: false,
    tutorSupport: false,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Query real tables with confidence.',
    createdAt: '2026-02-18',
  },
  {
    title: 'Power BI Essentials',
    instructor: 'Neha Shah',
    category: 'Data Analytics',
    level: 'Intermediate',
    rating: 4.6,
    students: 4100,
    durationHours: 11,
    skills: ['Power BI', 'DAX', 'Dashboards'],
    price: 899,
    originalPrice: 1599,
    badges: ['New'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: false,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Model data and publish dashboards.',
    createdAt: '2026-06-30',
  },
  {
    title: 'MBA Essentials',
    instructor: 'Maya Kapoor',
    category: 'MBA',
    level: 'Beginner',
    rating: 4.5,
    students: 2900,
    durationHours: 22,
    skills: ['Strategy', 'Finance', 'Ops'],
    price: 1499,
    originalPrice: 2499,
    badges: ['Premium'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Core MBA concepts without the campus.',
    createdAt: '2026-03-20',
  },
  {
    title: 'English for Professionals',
    instructor: 'James Cole',
    category: 'English',
    level: 'Beginner',
    rating: 4.6,
    students: 6400,
    durationHours: 9,
    skills: ['Grammar', 'Email', 'Presenting'],
    price: 499,
    originalPrice: 999,
    badges: [],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: false,
    certificate: true,
    thumbnail: null,
    description: 'Workplace English that sounds natural.',
    createdAt: '2026-01-28',
  },
  {
    title: 'Mathematics for Data',
    instructor: 'Dr. Arjun Mehta',
    category: 'Mathematics',
    level: 'Intermediate',
    rating: 4.5,
    students: 2300,
    durationHours: 15,
    skills: ['Stats', 'Linear algebra', 'Probability'],
    price: 899,
    badges: [],
    aiRecommended: false,
    tutorSupport: false,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'The math behind analytics and ML.',
    createdAt: '2026-02-09',
  },
  {
    title: 'Personal Finance Basics',
    instructor: 'Neha Shah',
    category: 'Finance',
    level: 'Beginner',
    rating: 4.6,
    students: 5100,
    durationHours: 4,
    skills: ['Budgeting', 'Investing', 'Tax'],
    price: 0,
    badges: ['Free'],
    aiRecommended: false,
    tutorSupport: false,
    aiSupport: true,
    projects: false,
    certificate: true,
    thumbnail: null,
    description: 'Money habits for early-career professionals.',
    createdAt: '2026-04-11',
  },
  {
    title: 'Interview Preparation',
    instructor: 'Dr. Sarah Kim',
    category: 'Career Skills',
    level: 'Intermediate',
    rating: 4.8,
    students: 7200,
    durationHours: 8,
    skills: ['DSA basics', 'System design', 'Behavioral'],
    price: 999,
    originalPrice: 1799,
    badges: ['Career Relevant', 'Tutor Supported'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: false,
    certificate: true,
    thumbnail: null,
    description: 'Practice interviews for frontend and full stack roles.',
    createdAt: '2026-05-02',
  },
  {
    title: 'Mobile App Development',
    instructor: 'Alex Rivera',
    category: 'Programming',
    level: 'Intermediate',
    rating: 4.5,
    students: 2800,
    durationHours: 20,
    skills: ['React', 'Navigation', 'APIs'],
    price: 1399,
    originalPrice: 2499,
    badges: ['New'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Ship a mobile-ready React experience.',
    createdAt: '2026-07-01',
  },
  {
    title: 'Deep Learning Fundamentals',
    instructor: 'Dr. Arjun Mehta',
    category: 'AI & Machine Learning',
    level: 'Advanced',
    rating: 4.7,
    students: 3600,
    durationHours: 24,
    skills: ['Neural nets', 'PyTorch', 'CNNs'],
    price: 1899,
    originalPrice: 3499,
    badges: ['Premium'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'From tensors to a first vision model.',
    createdAt: '2026-04-22',
  },
  {
    title: 'LLMs for Builders',
    instructor: 'Priya Nair',
    category: 'AI & Machine Learning',
    level: 'Intermediate',
    rating: 4.8,
    students: 4200,
    durationHours: 13,
    skills: ['Prompts', 'RAG', 'Eval'],
    price: 1299,
    originalPrice: 2299,
    badges: ['New', 'AI Recommended'],
    aiRecommended: true,
    aiReason: 'A practical next step after Python if you later pivot toward applied AI products.',
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Build reliable LLM features, not demos.',
    createdAt: '2026-08-01',
  },
  {
    title: 'Product Management Foundations',
    instructor: 'Maya Kapoor',
    category: 'Business',
    level: 'Beginner',
    rating: 4.6,
    students: 3400,
    durationHours: 12,
    skills: ['Discovery', 'Roadmaps', 'Metrics'],
    price: 1099,
    badges: [],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: null,
    description: 'Ship products with clarity and evidence.',
    createdAt: '2026-03-08',
  },
  {
    title: 'Career Communication Lab',
    instructor: 'James Cole',
    category: 'Career Skills',
    level: 'Beginner',
    rating: 4.5,
    students: 1900,
    durationHours: 6,
    skills: ['Storytelling', 'Feedback', 'Stakeholder'],
    price: 599,
    badges: ['New'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: false,
    certificate: true,
    thumbnail: null,
    description: 'Practice the conversations that move careers.',
    createdAt: '2026-08-08',
  },
]

function slugId(title: string) {
  return `catalog-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
}

function fromMock(row: Omit<CatalogCourse, 'id' | 'demo'>): CatalogCourse {
  return {
    ...row,
    id: slugId(row.title),
    demo: true,
    rating: 0,
    students: null,
    originalPrice: undefined,
    badges: row.badges.filter(b => b !== 'Bestseller' && b !== 'AI Recommended'),
    aiRecommended: false,
    aiReason: undefined,
  }
}

function fromApi(row: CourseRow): CatalogCourse {
  const studioLike = row.id.startsWith('studio-')
  const demo = row.id.startsWith('demo-')
  const price = row.price_cents === 0 ? 0 : inferPrice(row)
  const badges: CourseBadge[] = []
  if (price === 0) badges.push('Free')
  if (row.is_premium) badges.push('Premium')
  return {
    id: row.id,
    title: row.title,
    instructor: studioLike ? 'LearnSyra Tutor' : 'LearnSyra Faculty',
    category: catKey(row.category),
    level: (row.level as CatalogCourse['level']) || 'Beginner',
    rating: Number(row.rating) || 0,
    students: studioLike ? 0 : null,
    durationHours: 0,
    skills: [row.category || 'Skills'].filter(Boolean),
    price,
    badges,
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: true,
    certificate: true,
    thumbnail: row.thumbnail_url,
    description: row.description || row.title,
    createdAt: row.created_at || '',
    demo,
  }
}

export function buildCatalog(apiCourses: CourseRow[]): CatalogCourse[] {
  const fromRows = apiCourses.map(fromApi)
  const extra = MOCK.map(fromMock).filter(m => !fromRows.some(r => r.title.toLowerCase() === m.title.toLowerCase()))
  return [...fromRows, ...extra]
}

export function recommendForStudent(catalog: CatalogCourse[]): CourseRecommendation | null {
  const live = catalog.filter(c => !c.demo)
  const pool = live.length ? live : catalog
  const pick = pool.find(c => c.aiRecommended) || pool[0]
  if (!pick) return null
  return {
    courseId: pick.id,
    match: 0,
    reasons: pick.demo
      ? ['Sample recommendation for exploring the catalog.']
      : ['Based on courses currently in your catalog.'],
    badges: pick.demo ? ['Demo Course — Not Production Data'] : [],
  }
}

export function matchesCategory(course: CatalogCourse, cat: string) {
  if (cat === 'All') return true
  return course.category === cat
}

export function durationBucket(hours: number) {
  if (hours < 5) return 'under5'
  if (hours <= 20) return '5to20'
  if (hours <= 50) return '20to50'
  return 'over50'
}

export function priceBucket(price: number) {
  if (price === 0) return 'free'
  if (price < 500) return 'under500'
  if (price <= 1000) return '500to1000'
  return 'over1000'
}

export function relatedSearch(query: string): string[] {
  const q = query.toLowerCase()
  if (/react native/.test(q)) return ['React Development', 'JavaScript Fundamentals', 'Mobile App Development']
  if (/backend|node/.test(q)) return ['Node.js and REST APIs', 'Full Stack Web Development']
  if (/machine/.test(q)) return ['AI & Machine Learning', 'Python Basics']
  return ['Full Stack Web Development', 'JavaScript Fundamentals', 'React Development']
}

export function findByTitle(catalog: CatalogCourse[], title: string) {
  return catalog.find(c => c.title.toLowerCase() === title.toLowerCase())
}
