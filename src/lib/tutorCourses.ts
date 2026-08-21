import type { CourseLesson, CourseModule, CourseRow } from './api'
import type { CatalogCourse } from './courseCatalog'
import { userStorageKey } from './supabase'
import { SUGGESTED_SKILLS, LANGUAGE_OPTIONS, PRIMARY_CATEGORIES } from './tutorProfile'
import { TUTOR_SKILLS } from './tutorMarketplace'
import { PROJECT_SKILLS } from './projectWorkspace'

export type StudioStatus = 'draft' | 'review' | 'published' | 'paused' | 'archived'
export type LessonKind = 'video' | 'article' | 'code' | 'quiz' | 'assignment' | 'project'
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced'
export type StudioTab = 'all' | 'published' | 'draft' | 'review' | 'archived'
export type StudioSort = 'recommended' | 'updated' | 'students' | 'rated' | 'newest' | 'oldest'

export const STUDIO_STEPS = [
  'Course Basics',
  'Learning Outcomes',
  'Curriculum',
  'Lessons',
  'Practice & Quizzes',
  'Projects',
  'AI Review',
  'Pricing',
  'Preview',
  'Publish',
] as const

export const COURSE_CATEGORIES = PRIMARY_CATEGORIES
export const COURSE_LANGUAGES = LANGUAGE_OPTIONS
export const COURSE_LEVELS: CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced']

export const PLATFORM_SKILLS = Array.from(
  new Set<string>([...SUGGESTED_SKILLS, ...TUTOR_SKILLS, ...PROJECT_SKILLS, 'REST APIs', 'Testing', 'State Management']),
)

export const SUBCATEGORIES: Record<string, string[]> = {
  Programming: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'Testing'],
  'AI & Machine Learning': ['Python', 'Machine Learning', 'TensorFlow'],
  'Data Analytics': ['Python', 'SQL', 'Excel', 'Data Analytics'],
  Business: ['Communication', 'Excel'],
  MBA: ['Communication', 'Excel'],
  Finance: ['Excel', 'SQL'],
  English: ['Communication'],
  Mathematics: ['Python'],
  'Career Skills': ['Communication', 'Interview Preparation'],
}

export interface StudioResource {
  label: string
  url: string
}

export interface StudioQuizQuestion {
  id: string
  kind: 'mcq' | 'tf' | 'multi'
  prompt: string
  options: string[]
  answers: number[]
  explanation: string
  difficulty: CourseLevel
  points: number
}

export interface StudioQuiz {
  id: string
  title: string
  passingScore: number
  attempts: number
  randomize: boolean
  questions: StudioQuizQuestion[]
}

export interface StudioPractice {
  id: string
  title: string
  instructions: string
  difficulty: CourseLevel
  skills: string[]
  expected: string
  hints: string[]
  resources: StudioResource[]
}

export interface StudioLesson {
  id: string
  title: string
  description: string
  durationMin: number
  kind: LessonKind
  body: string
  videoUrl: string
  language: string
  starterCode: string
  expectedOutput: string
  instructions: string
  resources: StudioResource[]
}

export interface StudioModule {
  id: string
  title: string
  description: string
  objective: string
  durationMin: number
  requireComplete: boolean
  lessons: StudioLesson[]
}

export interface StudioCourse {
  id: string
  tutorId: string
  apiId: string | null
  demo: boolean
  status: StudioStatus
  title: string
  subtitle: string
  shortDescription: string
  description: string
  category: string
  subcategory: string
  level: CourseLevel
  language: string
  durationHours: number
  thumbnail: string | null
  introVideo: string
  outcomes: string[]
  primarySkills: string[]
  secondarySkills: string[]
  modules: StudioModule[]
  practices: StudioPractice[]
  quizzes: StudioQuiz[]
  projectIds: string[]
  projectTitle: string
  projectHours: number
  requirements: {
    lessonPct: number
    requireQuiz: boolean
    requireProject: boolean
    minQuizScore: number
  }
  pricing: { mode: 'free' | 'paid'; priceInr: number; originalInr: number }
  ignoredRecs: string[]
  createdAt: string
  updatedAt: string
}

export interface QualityBreakdown {
  content: number
  structure: number
  practice: number
  projects: number
  assessment: number
  accessibility: number
  total: number
}

export interface PublishCheck {
  id: string
  label: string
  ok: boolean
  required: boolean
}

export interface HealthItem {
  id: string
  label: string
  tone: 'good' | 'warn'
  rec: string
}

const STORE_KEY = 'learnsyra_course_studio'

function nid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

export function emptyLesson(title = 'New lesson'): StudioLesson {
  return {
    id: nid('les'),
    title,
    description: '',
    durationMin: 12,
    kind: 'article',
    body: '',
    videoUrl: '',
    language: 'JavaScript',
    starterCode: '',
    expectedOutput: '',
    instructions: '',
    resources: [],
  }
}

export function emptyModule(title = 'New module'): StudioModule {
  return {
    id: nid('mod'),
    title,
    description: '',
    objective: '',
    durationMin: 60,
    requireComplete: true,
    lessons: [emptyLesson('Introduction')],
  }
}

export function emptyQuiz(): StudioQuiz {
  return {
    id: nid('quiz'),
    title: 'Knowledge check',
    passingScore: 70,
    attempts: 3,
    randomize: false,
    questions: [
      {
        id: nid('qq'),
        kind: 'mcq',
        prompt: '',
        options: ['', '', '', ''],
        answers: [0],
        explanation: '',
        difficulty: 'Beginner',
        points: 1,
      },
    ],
  }
}

export function emptyPractice(): StudioPractice {
  return {
    id: nid('prac'),
    title: '',
    instructions: '',
    difficulty: 'Beginner',
    skills: [],
    expected: '',
    hints: [''],
    resources: [],
  }
}

export function emptyCourse(tutorId: string | null | undefined): StudioCourse {
  const t = nowIso()
  return {
    id: nid('studio'),
    tutorId: tutorId || '',
    apiId: null,
    demo: false,
    status: 'draft',
    title: '',
    subtitle: '',
    shortDescription: '',
    description: '',
    category: 'Programming',
    subcategory: 'React',
    level: 'Beginner',
    language: 'English',
    durationHours: 8,
    thumbnail: null,
    introVideo: '',
    outcomes: ['', '', '', ''],
    primarySkills: [],
    secondarySkills: [],
    modules: [],
    practices: [],
    quizzes: [],
    projectIds: [],
    projectTitle: '',
    projectHours: 4,
    requirements: { lessonPct: 80, requireQuiz: true, requireProject: true, minQuizScore: 70 },
    pricing: { mode: 'free', priceInr: 0, originalInr: 0 },
    ignoredRecs: [],
    createdAt: t,
    updatedAt: t,
  }
}

function studioKey(tutorId?: string | null) {
  return userStorageKey(STORE_KEY, tutorId)
}

function loadAll(tutorId?: string | null): Record<string, StudioCourse> {
  const key = studioKey(tutorId)
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, StudioCourse>) : {}
  } catch {
    return {}
  }
}

function saveAll(map: Record<string, StudioCourse>, tutorId?: string | null) {
  const uid = tutorId || Object.values(map)[0]?.tutorId
  const key = studioKey(uid)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(map))
}

export function loadStudioCourses(tutorId: string): StudioCourse[] {
  return Object.values(loadAll(tutorId))
    .filter(c => c.tutorId === tutorId && !c.demo)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
}

export function getStudioCourse(id: string): StudioCourse | null {
  return loadAll()[id] ?? null
}

export function saveStudioCourse(course: StudioCourse) {
  if (course.demo) return course
  const map = loadAll(course.tutorId)
  map[course.id] = { ...course, updatedAt: nowIso() }
  saveAll(map, course.tutorId)
  return map[course.id]
}

export function deleteStudioCourse(id: string, tutorId: string | null | undefined) {
  if (!tutorId) return false
  const map = loadAll(tutorId)
  const row = map[id]
  if (!row || row.tutorId !== tutorId) return false
  if (row.status === 'published') return false
  delete map[id]
  saveAll(map, tutorId)
  return true
}

export function ownsStudioCourse(course: StudioCourse | null, tutorId: string | null | undefined) {
  return Boolean(course && course.tutorId === tutorId)
}

export function publishedStudioCourses(): StudioCourse[] {
  return Object.values(loadAll()).filter(c => c.status === 'published' && !c.demo)
}

export function studioFromApiRow(row: CourseRow & { students?: number }, tutorId: string): StudioCourse {
  const existing = Object.values(loadAll(tutorId)).find(c => c.apiId === row.id || c.id === row.id)
  if (existing) return existing
  const course = emptyCourse(tutorId)
  course.id = row.id
  course.apiId = row.id
  course.title = row.title
  course.description = row.description || ''
  course.shortDescription = row.description || ''
  course.category = (PRIMARY_CATEGORIES as readonly string[]).includes(row.category || '')
    ? (row.category as string)
    : row.category === 'AI & ML'
      ? 'AI & Machine Learning'
      : 'Programming'
  course.level = (COURSE_LEVELS as string[]).includes(row.level || '') ? (row.level as CourseLevel) : 'Beginner'
  course.pricing = {
    mode: row.price_cents > 0 ? 'paid' : 'free',
    priceInr: row.price_cents > 0 ? Math.round(row.price_cents) : 0,
    originalInr: 0,
  }
  course.thumbnail = row.thumbnail_url
  course.status = row.published ? 'published' : 'draft'
  course.createdAt = row.created_at
  return saveStudioCourse(course)
}

export function duplicateCourse(course: StudioCourse, tutorId: string | null | undefined): StudioCourse {
  if (!tutorId || course.demo) return course
  const copy: StudioCourse = JSON.parse(JSON.stringify(course)) as StudioCourse
  copy.id = nid('studio')
  copy.apiId = null
  copy.tutorId = tutorId
  copy.demo = false
  copy.status = 'draft'
  copy.title = course.title ? `${course.title} (Copy)` : 'Untitled course (Copy)'
  copy.createdAt = nowIso()
  copy.updatedAt = nowIso()
  return saveStudioCourse(copy)
}

export function mergeTutorCourses(
  apiRows: (CourseRow & { students?: number })[],
  tutorId: string | null | undefined,
): { courses: StudioCourse[]; source: 'live' | 'demo' } {
  if (!tutorId) return { courses: [], source: 'live' as const }
  const local = loadStudioCourses(tutorId)
  const seen = new Set(local.map(c => c.apiId || c.id))
  const merged = [...local]
  for (const row of apiRows) {
    if (seen.has(row.id)) continue
    merged.push(studioFromApiRow(row, tutorId))
    seen.add(row.id)
  }
  const real = merged.filter(c => !c.demo)
  return { courses: real, source: 'live' as const }
}

export function studioToCourseRow(course: StudioCourse): CourseRow {
  return {
    id: course.apiId || course.id,
    tutor_id: course.tutorId,
    title: course.title || 'Untitled course',
    description: course.shortDescription || course.description,
    category: course.category === 'AI & Machine Learning' ? 'AI & ML' : course.category,
    level: course.level,
    price_cents: course.pricing.mode === 'paid' ? course.pricing.priceInr : 0,
    is_premium: course.pricing.mode === 'paid',
    rating: 0,
    thumbnail_url: course.thumbnail && !course.thumbnail.startsWith('data:') ? course.thumbnail : null,
    published: course.status === 'published',
    created_at: course.createdAt,
  }
}

export function publishedStudioRows(): CourseRow[] {
  return publishedStudioCourses().map(studioToCourseRow)
}

export function findStudioByAnyId(id: string): StudioCourse | null {
  const map = loadAll()
  if (map[id]) return map[id]
  return Object.values(map).find(c => c.apiId === id) ?? null
}

function apiLessonType(kind: LessonKind): CourseLesson['lesson_type'] {
  if (kind === 'quiz') return 'quiz'
  if (kind === 'project' || kind === 'assignment') return 'project'
  return 'video'
}

export function studioCurriculum(course: StudioCourse): CourseModule[] {
  return course.modules.map((m, mi) => ({
    id: m.id,
    course_id: course.apiId || course.id,
    title: m.title,
    sort_order: mi,
    lessons: m.lessons.map((l, li) => {
      const quiz = course.quizzes[0]
      return {
        id: l.id,
        module_id: m.id,
        title: l.title,
        lesson_type: apiLessonType(l.kind),
        duration_min: l.durationMin,
        sort_order: li,
        is_free: mi === 0 && li === 0,
        body: l.body || l.description || l.instructions || null,
        video_url: l.videoUrl || null,
        quiz:
          l.kind === 'quiz' && quiz
            ? {
                pass: quiz.passingScore,
                questions: quiz.questions.map(q => ({
                  q: q.prompt,
                  options: q.options.filter(Boolean),
                  answer: q.answers[0] ?? 0,
                })),
              }
            : null,
      }
    }),
  }))
}

export function findStudioLesson(lessonId: string): CourseLesson | null {
  for (const course of Object.values(loadAll())) {
    for (const mod of studioCurriculum(course)) {
      const hit = mod.lessons.find(l => l.id === lessonId)
      if (hit) return hit
    }
  }
  return null
}

export function studioToCatalog(course: StudioCourse, instructor: string): CatalogCourse {
  const hours =
    course.durationHours ||
    Math.max(1, Math.round(course.modules.reduce((s, m) => s + m.lessons.reduce((a, l) => a + l.durationMin, 0), 0) / 60))
  const cat =
    course.category === 'AI & ML' || course.category === 'AI & Machine Learning'
      ? 'AI & Machine Learning'
      : course.category || 'Programming'
  return {
    id: course.apiId || course.id,
    title: course.title,
    instructor,
    category: cat,
    level: course.level,
    rating: 0,
    students: 0,
    durationHours: hours,
    skills: [...course.primarySkills, ...course.secondarySkills],
    price: course.pricing.mode === 'paid' ? course.pricing.priceInr : 0,
    originalPrice: course.pricing.originalInr || undefined,
    badges: course.pricing.mode === 'free' ? ['Free'] : ['Premium'],
    aiRecommended: false,
    tutorSupport: true,
    aiSupport: true,
    projects: Boolean(course.projectIds.length || course.projectTitle),
    certificate: true,
    thumbnail: course.thumbnail && !course.thumbnail.startsWith('data:') ? course.thumbnail : null,
    description: course.shortDescription || course.description,
    createdAt: course.createdAt.slice(0, 10),
  }
}

export function overlayPublishedCatalog(catalog: CatalogCourse[], instructorFallback = 'LearnSyra Tutor'): CatalogCourse[] {
  const extras = publishedStudioCourses().map(c => studioToCatalog(c, instructorFallback))
  return [...catalog.filter(c => !extras.some(e => e.id === c.id)), ...extras]
}

export function lessonCount(course: StudioCourse) {
  return course.modules.reduce((s, m) => s + m.lessons.length, 0)
}

export function statusLabel(status: StudioStatus) {
  if (status === 'review') return 'Under Review'
  if (status === 'published') return 'Published'
  if (status === 'paused') return 'Paused'
  if (status === 'archived') return 'Archived'
  return 'Draft'
}

export function qualityScore(course: StudioCourse): QualityBreakdown {
  const lessons = lessonCount(course)
  const withBody = course.modules.flatMap(m => m.lessons).filter(l => l.body || l.videoUrl || l.starterCode).length
  const content = clamp(
    (course.title ? 20 : 0) +
      (course.description.length > 80 ? 25 : course.description.length > 20 ? 12 : 0) +
      (course.thumbnail ? 15 : 0) +
      (lessons ? Math.min(40, Math.round((withBody / Math.max(1, lessons)) * 40)) : 0),
  )
  const structure = clamp(
    (course.modules.length >= 2 ? 40 : course.modules.length === 1 ? 20 : 0) +
      (lessons >= 6 ? 40 : lessons >= 3 ? 24 : lessons ? 10 : 0) +
      (course.outcomes.filter(Boolean).length >= 4 ? 20 : 0),
  )
  const practice = clamp(course.practices.length ? 70 + Math.min(30, course.practices.length * 10) : lessons && course.modules.some(m => m.lessons.some(l => l.kind === 'code' || l.kind === 'assignment')) ? 55 : 20)
  const projects = clamp(course.projectIds.length || course.projectTitle ? 85 : 25)
  const assessment = clamp(course.quizzes.some(q => q.questions.some(qq => qq.prompt)) ? 82 : 20)
  const accessibility = clamp(
    (course.language ? 30 : 0) +
      (course.modules.every(m => m.lessons.every(l => l.durationMin > 0)) && lessons ? 30 : 10) +
      (course.level ? 28 : 0),
  )
  const total = Math.round((content + structure + practice + projects + assessment + accessibility) / 6)
  return { content, structure, practice, projects, assessment, accessibility, total }
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function publishChecklist(course: StudioCourse, profileComplete: boolean): PublishCheck[] {
  return [
    { id: 'title', label: 'Course title', ok: course.title.trim().length >= 4, required: true },
    { id: 'desc', label: 'Description', ok: course.description.trim().length >= 40, required: true },
    { id: 'thumb', label: 'Thumbnail', ok: Boolean(course.thumbnail), required: true },
    { id: 'profile', label: 'Instructor profile', ok: profileComplete, required: true },
    { id: 'outcomes', label: 'Learning outcomes', ok: course.outcomes.filter(o => o.trim()).length >= 4, required: true },
    { id: 'skills', label: 'Skills', ok: course.primarySkills.length > 0, required: true },
    { id: 'curriculum', label: 'Curriculum', ok: course.modules.length > 0, required: true },
    { id: 'lessons', label: 'Lessons', ok: lessonCount(course) > 0, required: true },
    { id: 'practice', label: 'Practice', ok: course.practices.length > 0 || course.modules.some(m => m.lessons.some(l => l.kind === 'code' || l.kind === 'assignment')), required: true },
    { id: 'assessment', label: 'Assessment', ok: course.quizzes.some(q => q.questions.some(qq => qq.prompt.trim())), required: true },
    { id: 'project', label: 'Project', ok: Boolean(course.projectIds.length || course.projectTitle), required: true },
    { id: 'pricing', label: 'Pricing', ok: course.pricing.mode === 'free' || course.pricing.priceInr > 0, required: true },
    { id: 'preview', label: 'Student preview', ok: Boolean(course.title && course.modules.length), required: true },
    { id: 'intro', label: 'Intro video (optional)', ok: Boolean(course.introVideo), required: false },
  ]
}

export function readinessPct(checks: PublishCheck[]) {
  const req = checks.filter(c => c.required)
  return req.length ? Math.round((req.filter(c => c.ok).length / req.length) * 100) : 0
}

export function curriculumHealth(course: StudioCourse): HealthItem[] {
  const lessons = lessonCount(course)
  const hasTest = /test/i.test(JSON.stringify(course.modules)) || course.primarySkills.includes('Testing')
  const hasProject = Boolean(course.projectIds.length || course.projectTitle)
  const progressive = course.modules.length >= 3
  return [
    { id: 'structure', label: 'Structure', tone: course.modules.length >= 2 && lessons >= 4 ? 'good' : 'warn', rec: 'Add at least two modules with several lessons each.' },
    { id: 'difficulty', label: 'Difficulty progression', tone: progressive ? 'good' : 'warn', rec: 'Order modules from fundamentals toward a real project.' },
    { id: 'testing', label: 'Testing coverage', tone: hasTest ? 'good' : 'warn', rec: 'Add a testing lesson before the final project.' },
    { id: 'practice', label: 'Practical work', tone: hasProject && course.practices.length ? 'good' : 'warn', rec: 'Add one more project or practice task.' },
  ]
}

export function matchesStudioQuery(course: StudioCourse, q: string) {
  if (!q.trim()) return true
  const blob = [course.title, course.category, course.subcategory, course.status, statusLabel(course.status), ...course.primarySkills, ...course.secondarySkills].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every(w => blob.includes(w))
}

export function matchesStudioTab(course: StudioCourse, tab: StudioTab) {
  if (tab === 'all') return true
  if (tab === 'published') return course.status === 'published'
  if (tab === 'draft') return course.status === 'draft'
  if (tab === 'review') return course.status === 'review'
  return course.status === 'archived' || course.status === 'paused'
}

export function sortStudio(rows: StudioCourse[], key: StudioSort, studentMap: Record<string, number>, ratingMap: Record<string, number>) {
  const copy = [...rows]
  copy.sort((a, b) => {
    if (key === 'updated') return +new Date(b.updatedAt) - +new Date(a.updatedAt)
    if (key === 'newest') return +new Date(b.createdAt) - +new Date(a.createdAt)
    if (key === 'oldest') return +new Date(a.createdAt) - +new Date(b.createdAt)
    if (key === 'students') return (studentMap[b.apiId || b.id] ?? 0) - (studentMap[a.apiId || a.id] ?? 0)
    if (key === 'rated') return (ratingMap[b.apiId || b.id] ?? 0) - (ratingMap[a.apiId || a.id] ?? 0)
    const score = (c: StudioCourse) => (c.status === 'published' ? 2 : c.status === 'draft' ? 1 : 0) + qualityScore(c).total / 100
    return score(b) - score(a)
  })
  return copy
}

export function studioStats(rows: StudioCourse[], studentMap: Record<string, number>, ratingMap: Record<string, number>) {
  const real = rows.filter(c => !c.demo)
  const published = real.filter(c => c.status === 'published')
  const ratings = published.map(c => ratingMap[c.apiId || c.id]).filter((n): n is number => typeof n === 'number' && n > 0)
  return {
    total: real.length,
    published: published.length,
    drafts: real.filter(c => c.status === 'draft').length,
    review: real.filter(c => c.status === 'review').length,
    students: Object.values(studentMap).reduce((s, n) => s + n, 0),
    rating: ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : null,
  }
}

function claimWords(text: string) {
  return /\b(guarantee|certified|certification|salary|placed|placement|100%|job offer|partnered with|students enrolled|[0-9]{2,}k students|years of experience)\b/i.test(text)
}

export function improveDescription(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Describe what students will build, which skills they practice, and how lessons connect to a project. Do not add job or salary claims.'
  let out = clean
  if (!/[.!?]$/.test(out)) out += '.'
  out = out.replace(/\bi want to teach\b/i, 'This course teaches')
  if (claimWords(out)) {
    out = out
      .replace(/\bguaranteed?\b/gi, '')
      .replace(/\bcertifications?\b/gi, 'skills')
      .replace(/\bsalaries\b/gi, 'skills')
      .replace(/\s+/g, ' ')
      .trim()
  }
  if (out.length < 80) out += ' Lessons stay practical: explain, practice, then apply the idea in a small project.'
  return out
}

export function suggestOutcomes(course: StudioCourse): string[] {
  const skill = course.primarySkills[0] || course.subcategory || 'the topic'
  return [
    `Build ${skill} applications`,
    `Work with ${course.secondarySkills[0] || 'core APIs'}`,
    'Manage application state',
    'Build production-ready projects',
    `Prepare for ${course.category === 'Career Skills' ? 'career conversations' : 'frontend interviews'}`,
  ].slice(0, 5)
}

export function suggestOutline(prompt: string, course: StudioCourse) {
  const text = `${prompt} ${course.title} ${course.category}`.toLowerCase()
  if (/react/.test(text)) {
    return [
      'React Fundamentals',
      'Components & Props',
      'Hooks',
      'API Integration',
      'State Management',
      'Testing',
      'Real Project',
      'Interview Preparation',
    ]
  }
  if (/python|data/.test(text)) {
    return ['Python Basics', 'Working with Data', 'Analysis Workflow', 'Charts', 'SQL', 'Project', 'Interview Preparation']
  }
  return ['Foundations', 'Core Skills', 'Practice', 'Project', 'Review']
}

export function suggestMissingLessons(course: StudioCourse): string[] {
  const titles = course.modules.flatMap(m => m.lessons.map(l => l.title.toLowerCase())).join(' ')
  const missing: string[] = []
  if (!/test/.test(titles)) missing.push('Testing basics')
  if (!/error/.test(titles)) missing.push('Error handling')
  if (!/deploy|production/.test(titles)) missing.push('Deploy a small build')
  if (!course.projectTitle && !/project/.test(titles)) missing.push('Guided project workshop')
  return missing
}

export function suggestQuiz(course: StudioCourse): StudioQuiz {
  const topic = course.primarySkills[0] || course.title || 'this topic'
  const quiz = emptyQuiz()
  quiz.title = `${topic} check`
  quiz.questions = [
    {
      id: nid('qq'),
      kind: 'mcq',
      prompt: `Which statement best describes ${topic}?`,
      options: [`A practical skill used in this course`, 'A marketing slogan', 'An unrelated tool', 'A salary figure'],
      answers: [0],
      explanation: 'Keep the question tied to what the lesson actually taught.',
      difficulty: course.level,
      points: 1,
    },
    {
      id: nid('qq'),
      kind: 'tf',
      prompt: `${topic} is best learned by building, not only watching.`,
      options: ['True', 'False'],
      answers: [0],
      explanation: 'Practice is part of the LearnSyra course model.',
      difficulty: 'Beginner',
      points: 1,
    },
  ]
  return quiz
}

export function suggestPractice(course: StudioCourse): StudioPractice {
  const skill = course.primarySkills[0] || 'JavaScript'
  return {
    id: nid('prac'),
    title: `Build a small ${skill} exercise`,
    instructions: `Apply ${skill} from the latest module. Keep the scope small enough to finish in one sitting.`,
    difficulty: course.level,
    skills: course.primarySkills.slice(0, 3),
    expected: 'A working demo plus a short note of what was hard.',
    hints: ['Start with the happy path, then add one edge case.'],
    resources: [],
  }
}

export function applyOutline(course: StudioCourse, titles: string[]): StudioCourse {
  return {
    ...course,
    modules: titles.map(title => ({
      ...emptyModule(title),
      lessons: [emptyLesson(`Introduction to ${title}`), emptyLesson(`${title} practice`)],
    })),
  }
}

export function placeholderThumb(title: string) {
  const safe = encodeURIComponent(title || 'Course')
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'><defs><linearGradient id='g' x1='0' x2='1'><stop stop-color='%236C5CE7'/><stop offset='1' stop-color='%2322C7D6'/></linearGradient></defs><rect width='1600' height='900' fill='url(%23g)'/><text x='80' y='480' fill='white' font-size='72' font-family='Arial'>${safe}</text></svg>`
}

export function moveItem<T>(list: T[], from: number, dir: -1 | 1) {
  const to = from + dir
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}

export function formatUpdated(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function validCategory(cat: string) {
  return (COURSE_CATEGORIES as readonly string[]).includes(cat)
}
