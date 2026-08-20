import type { CourseModule, CourseRow } from './api'
import { userStorageKey } from './supabase'
import {
  buildCatalog,
  type CatalogCourse,
} from './courseCatalog'
import { findStudioByAnyId } from './tutorCourses'

export interface DetailLesson {
  title: string
  minutes: number
  preview?: boolean
}

export interface DetailSection {
  title: string
  hours: number
  lessons: DetailLesson[]
}

export interface CourseProjectCard {
  title: string
  difficulty: string
  skills: string[]
  hours: number
}

export interface CourseDetailPack {
  subtitle: string
  outcomes: string[]
  skillLevels: { name: string; level: string }[]
  sections: DetailSection[]
  projects: CourseProjectCard[]
  faqs: { q: string; a: string }[]
  reviews: { name: string; rating: number; body: string }[]
  instructor: {
    name: string
    role: string
    bio: string
    expertise: string[]
    years: number
    rating: number
    students: number
    rate: number
  }
  careerRole: string
  match: number
  matchCopy: string
  skillBreakdown: { name: string; state: 'have' | 'improve' }[]
  nextSkills: string[]
  updated: string
  lessonCount: number
  projectCount: number
}

const ENROLL_KEY = 'learnsyra_local_enroll'

export function loadLocalEnroll(): string[] {
  const key = userStorageKey(ENROLL_KEY)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveLocalEnroll(ids: string[]) {
  const key = userStorageKey(ENROLL_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(ids))
}

function makeLessons(count: number, hours: number, topic: string, previewTitle?: string): DetailLesson[] {
  const mins = Math.max(6, Math.round((hours * 60) / count))
  return Array.from({ length: count }, (_, i) => ({
    title: i === 0 && previewTitle ? previewTitle : `${topic} — lesson ${i + 1}`,
    minutes: i === 0 && previewTitle ? 8 : mins,
    preview: i === 0 && Boolean(previewTitle),
  }))
}

const FULLSTACK: CourseDetailPack = {
  subtitle:
    'Build production-ready web applications from frontend to backend and develop the skills needed for a modern Full Stack Developer role.',
  outcomes: [
    'Build responsive React applications',
    'Create REST APIs with Node.js',
    'Work with MongoDB databases',
    'Implement authentication',
    'Connect frontend and backend',
    'Deploy production applications',
    'Debug real-world issues',
    'Follow scalable project architecture',
  ],
  skillLevels: [
    { name: 'React', level: 'Advanced' },
    { name: 'JavaScript', level: 'Advanced' },
    { name: 'Node.js', level: 'Intermediate' },
    { name: 'REST APIs', level: 'Intermediate' },
    { name: 'MongoDB', level: 'Intermediate' },
    { name: 'Authentication', level: 'Intermediate' },
    { name: 'Git & GitHub', level: 'Practical' },
    { name: 'Deployment', level: 'Practical' },
  ],
  sections: [
    { title: 'JavaScript Foundations', hours: 5, lessons: makeLessons(12, 5, 'JavaScript', 'Introduction to Full Stack Development') },
    { title: 'React Fundamentals', hours: 7, lessons: makeLessons(14, 7, 'React') },
    { title: 'Advanced React', hours: 6, lessons: makeLessons(12, 6, 'Advanced React') },
    { title: 'Backend with Node.js', hours: 8, lessons: makeLessons(14, 8, 'Node.js') },
    { title: 'REST APIs', hours: 5, lessons: makeLessons(10, 5, 'REST APIs') },
    { title: 'MongoDB', hours: 4, lessons: makeLessons(10, 4, 'MongoDB') },
    { title: 'Full Stack Project', hours: 5, lessons: makeLessons(8, 5, 'Capstone') },
    { title: 'Deployment & Interview Prep', hours: 2, lessons: makeLessons(6, 2, 'Interview') },
  ],
  projects: [
    { title: 'Responsive E-commerce Website', difficulty: 'Intermediate', skills: ['React', 'APIs', 'CSS'], hours: 6 },
    { title: 'Full Stack Expense Tracker', difficulty: 'Intermediate', skills: ['React', 'Node.js', 'MongoDB'], hours: 8 },
    { title: 'Admin Analytics Dashboard', difficulty: 'Intermediate', skills: ['React', 'REST APIs', 'Charts'], hours: 7 },
  ],
  faqs: [
    { q: 'Is AI Tutor included?', a: 'Yes. Students can use LearnSyra AI throughout the course.' },
    { q: 'Can I ask a human tutor?', a: 'Yes. Tutor sessions can be booked separately.' },
    { q: 'Are projects included?', a: 'Yes. The course includes practical projects.' },
    { q: 'Do I receive a certificate?', a: 'Yes, after meeting completion requirements.' },
    { q: 'Can I learn at my own pace?', a: 'Yes. Course access is designed for self-paced learning.' },
  ],
  reviews: [
    {
      name: 'Ananya Patel',
      rating: 5,
      body: 'The projects made the biggest difference for me. I finally understood how frontend and backend connect.',
    },
    {
      name: 'Rahul Desai',
      rating: 5,
      body: 'AI practice between lessons kept me honest. I stopped skipping the hard parts.',
    },
    {
      name: 'Sofia Mendes',
      rating: 4,
      body: 'Clear path from React to APIs. Booking a tutor session unblocked my deployment issues in one hour.',
    },
  ],
  instructor: {
    name: 'Dr. Sarah Kim',
    role: 'Senior Full Stack Engineer & Educator',
    bio: 'Sarah specializes in modern JavaScript, React, Node.js and scalable web architecture.',
    expertise: ['React', 'Node.js', 'APIs', 'System Design'],
    years: 8,
    rating: 4.9,
    students: 12400,
    rate: 800,
  },
  careerRole: 'Full Stack Developer',
  match: 0,
  matchCopy:
    'Explore this course. Catalog details describe the curriculum — they are not your personal progress.',
  skillBreakdown: [
    { name: 'React', state: 'improve' },
    { name: 'JavaScript', state: 'improve' },
    { name: 'REST APIs', state: 'improve' },
    { name: 'Node.js', state: 'improve' },
    { name: 'TypeScript', state: 'improve' },
  ],
  nextSkills: ['TypeScript', 'Testing'],
  updated: 'Updated Aug 2026',
  lessonCount: 86,
  projectCount: 12,
}

function packFor(course: CatalogCourse): CourseDetailPack {
  if (!course.demo) {
    return {
      subtitle: course.description || course.title,
      outcomes: [],
      skillLevels: course.skills.map(name => ({ name, level: course.level })),
      sections: [],
      projects: [],
      faqs: [],
      reviews: [],
      instructor: {
        name: course.instructor,
        role: '',
        bio: '',
        expertise: course.skills,
        years: 0,
        rating: 0,
        students: 0,
        rate: 0,
      },
      careerRole: '',
      match: 0,
      matchCopy: '',
      skillBreakdown: course.skills.map(name => ({ name, state: 'improve' as const })),
      nextSkills: [],
      updated: course.createdAt ? `Added ${course.createdAt}` : '',
      lessonCount: 0,
      projectCount: 0,
    }
  }
  if (/full stack/i.test(course.title)) return FULLSTACK
  if (/data analytics/i.test(course.title)) {
    return {
      ...FULLSTACK,
      subtitle: 'Analyze real datasets with Python and present insights that teams can act on.',
      careerRole: 'Data Analyst',
      skillLevels: [
        { name: 'Python', level: 'Intermediate' },
        { name: 'pandas', level: 'Intermediate' },
        { name: 'SQL', level: 'Practical' },
        { name: 'Charts', level: 'Practical' },
      ],
      projects: [
        { title: 'Sales Insights Notebook', difficulty: 'Beginner', skills: ['Python', 'pandas'], hours: 4 },
        { title: 'KPI Dashboard', difficulty: 'Intermediate', skills: ['SQL', 'Charts'], hours: 6 },
        { title: 'Cohort Analysis Lab', difficulty: 'Intermediate', skills: ['Python', 'SQL'], hours: 5 },
      ],
      matchCopy:
        'This course is a strong match if you want a data career. It turns Python fundamentals into analysis you can show in interviews.',
    }
  }
  if (/machine learning|ai &/i.test(course.title)) {
    return {
      ...FULLSTACK,
      subtitle: 'Train, evaluate, and ship machine learning models with a clear project path.',
      careerRole: 'AI Engineer',
      matchCopy:
        'A solid next step if you already know Python and want applied machine learning rather than theory alone.',
    }
  }
  return {
    ...FULLSTACK,
    subtitle:
      course.description ||
      `Learn ${course.title} with AI practice, real projects, and tutor support that connect to your career goal.`,
    instructor: {
      ...FULLSTACK.instructor,
      name: course.instructor,
    },
    careerRole: course.category === 'Programming' ? 'Frontend Developer' : FULLSTACK.careerRole,
    matchCopy: course.aiReason || FULLSTACK.matchCopy,
    skillLevels: course.skills.slice(0, 6).map((name, i) => ({
      name,
      level: i < 2 ? 'Advanced' : i < 4 ? 'Intermediate' : 'Practical',
    })),
  }
}

export function resolveCatalogCourse(
  id: string,
  apiCourses: CourseRow[],
  apiRow: CourseRow | null,
): CatalogCourse | null {
  const catalog = buildCatalog(apiCourses)
  const hit =
    catalog.find(c => c.id === id) ||
    (apiRow ? catalog.find(c => c.id === apiRow.id || c.title === apiRow.title) : undefined)
  if (hit) return hit
  if (apiRow) return buildCatalog([apiRow]).find(c => c.id === apiRow.id) ?? null
  return null
}

export function getCourseDetailPack(course: CatalogCourse): CourseDetailPack {
  const pack = packFor(course)
  const studio = findStudioByAnyId(course.id)
  if (studio && !studio.demo) {
    if (studio.subtitle || studio.shortDescription) pack.subtitle = studio.subtitle || studio.shortDescription
    const outcomes = studio.outcomes.map(o => o.trim()).filter(Boolean)
    if (outcomes.length) pack.outcomes = outcomes
    if (studio.primarySkills.length) {
      pack.skillLevels = [...studio.primarySkills, ...studio.secondarySkills].slice(0, 8).map((name, i) => ({
        name,
        level: i < 2 ? 'Advanced' : i < 5 ? 'Intermediate' : 'Practical',
      }))
    }
    if (studio.modules.length) {
      pack.sections = studio.modules.map(m => ({
        title: m.title,
        hours: Math.max(1, Math.round(m.lessons.reduce((s, l) => s + l.durationMin, 0) / 60) || 1),
        lessons: m.lessons.map((l, i) => ({ title: l.title, minutes: l.durationMin, preview: i === 0 })),
      }))
    }
    if (studio.projectTitle) {
      pack.projects = [
        {
          title: studio.projectTitle,
          difficulty: studio.level,
          skills: studio.primarySkills.slice(0, 4),
          hours: studio.projectHours || 4,
        },
      ]
    }
    pack.instructor = { ...pack.instructor, name: course.instructor }
    pack.updated = `Updated ${new Date(studio.updatedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
  }
  const lessonCount = pack.sections.reduce((s, sec) => s + sec.lessons.length, 0)
  return {
    ...pack,
    lessonCount: pack.lessonCount || lessonCount,
    projectCount: pack.projectCount || pack.projects.length,
  }
}

export function modulesToFallback(modules: CourseModule[]): DetailSection[] | null {
  if (!modules.length) return null
  return modules.map(m => ({
    title: m.title,
    hours: Math.max(1, Math.round(m.lessons.reduce((s, l) => s + l.duration_min, 0) / 60)),
    lessons: m.lessons.map(l => ({
      title: l.title,
      minutes: l.duration_min,
      preview: l.is_free,
    })),
  }))
}
