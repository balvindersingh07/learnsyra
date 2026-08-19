import type { CourseLesson, CourseModule, CourseRow } from './api'
import { getCourseDetailPack, resolveCatalogCourse, type CourseDetailPack } from './courseDetail'

export interface LessonChapter {
  t: number
  label: string
}

export interface LessonQuizQ {
  q: string
  options: string[]
  answer: number
  explain: string
}

export interface LessonWorkspace {
  subtitle: string
  durationLabel: string
  lessonNo: number
  level: string
  skill: string
  chapters: LessonChapter[]
  objectives: string[]
  takeaway: string
  practice: {
    title: string
    difficulty: string
    minutes: number
    description: string
    starter: string
    hint: string
    successChecks: string[]
    feedback: string
  }
  quiz: LessonQuizQ[]
  quizFeedback: string
  insight: string
  nextTitle: string
  nextMinutes: number
  nextSkills: string[]
}

const NOTES_KEY = (courseId: string, lessonId: string) => `learnsyra_notes_${courseId}_${lessonId}`
const DONE_KEY = (courseId: string) => `learnsyra_done_${courseId}`
const WATCH_KEY = (courseId: string, lessonId: string) => `learnsyra_watch_${courseId}_${lessonId}`

export function loadNotes(courseId: string, lessonId: string) {
  return localStorage.getItem(NOTES_KEY(courseId, lessonId)) ?? ''
}

export function saveNotes(courseId: string, lessonId: string, text: string) {
  localStorage.setItem(NOTES_KEY(courseId, lessonId), text)
}

export function loadLocalDone(courseId: string): string[] {
  try {
    const raw = localStorage.getItem(DONE_KEY(courseId))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveLocalDone(courseId: string, ids: string[]) {
  localStorage.setItem(DONE_KEY(courseId), JSON.stringify(ids))
}

export function loadWatched(courseId: string, lessonId: string) {
  return localStorage.getItem(WATCH_KEY(courseId, lessonId)) === '1'
}

export function saveWatched(courseId: string, lessonId: string) {
  localStorage.setItem(WATCH_KEY(courseId, lessonId), '1')
}

const USEEFFECT: LessonWorkspace = {
  subtitle: 'Understand side effects and lifecycle behavior in React.',
  durationLabel: '18 min',
  lessonNo: 9,
  level: 'Intermediate',
  skill: 'React Hooks',
  chapters: [
    { t: 0, label: 'Introduction' },
    { t: 130, label: 'What is a side effect?' },
    { t: 320, label: 'useEffect syntax' },
    { t: 510, label: 'Dependency array' },
    { t: 720, label: 'Common mistakes' },
    { t: 930, label: 'Practical example' },
  ],
  objectives: [
    'What side effects are',
    'When useEffect runs',
    'How dependency arrays work',
    'Common useEffect mistakes',
    'How to use cleanup functions',
  ],
  takeaway: '`useEffect` lets your component synchronize with systems outside React.',
  practice: {
    title: 'Create a component that uses useEffect to update the document title.',
    difficulty: 'Beginner',
    minutes: 10,
    description: 'When count changes, the browser tab title should show the latest count. Do not update the title during render.',
    starter: `import { useEffect, useState } from "react"

export default function TitleCounter() {
  const [count, setCount] = useState(0)

  // TODO: update document.title with useEffect

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Clicked {count}
    </button>
  )
}
`,
    hint: 'Start by importing `useEffect` from React, then create an effect that updates `document.title`.',
    successChecks: ['useEffect', 'dependency array'],
    feedback: 'Your logic is correct. Try adding a cleanup function when working with subscriptions or event listeners.',
  },
  quiz: [
    {
      q: 'When does an effect with an empty dependency array usually run?',
      options: ['Every render', 'Once after initial render', 'Only when props change', 'Never'],
      answer: 1,
      explain: '[] means no values to watch, so the effect runs once after mount.',
    },
    {
      q: 'What is a side effect in React?',
      options: ['Returning JSX', 'Updating something outside render, like the DOM or a fetch', 'Declaring a variable', 'Styling a button'],
      answer: 1,
      explain: 'Effects sync React with the outside world after paint.',
    },
    {
      q: 'Why include values in the dependency array?',
      options: ['To skip TypeScript', 'So the effect re-runs when those values change', 'To make it run never', 'To replace useState'],
      answer: 1,
      explain: 'Any value the effect reads from render should be listed.',
    },
    {
      q: 'What does the cleanup function do?',
      options: ['Deletes the component file', 'Runs before the next effect or unmount', 'Replaces return JSX', 'Stops React'],
      answer: 1,
      explain: 'Cleanup cancels timers, listeners, and subscriptions.',
    },
    {
      q: 'Which pattern often causes an infinite loop?',
      options: ['Empty []', 'Setting state inside an effect with no deps', 'A cleanup function', 'A comment'],
      answer: 1,
      explain: 'An effect that sets state and has no (or unstable) deps can retrigger itself.',
    },
  ],
  quizFeedback: "You're strong on useEffect basics. Review dependency arrays before continuing.",
  insight: 'You performed well on React state questions, but your recent quiz suggests you need more practice with effect dependencies.',
  nextTitle: 'Context API in React',
  nextMinutes: 12,
  nextSkills: ['React', 'State Management'],
}

function genericWorkspace(lesson: CourseLesson, index: number): LessonWorkspace {
  return {
    ...USEEFFECT,
    subtitle: lesson.body || `Learn ${lesson.title} with a short video, practice, and a knowledge check.`,
    durationLabel: `${lesson.duration_min} min`,
    lessonNo: index + 1,
    nextTitle: 'Next lesson',
    chapters: USEEFFECT.chapters.map((c, i) => ({
      ...c,
      label: i === 0 ? 'Introduction' : c.label,
    })),
    takeaway: `Master ${lesson.title} by watching, practicing, and checking your understanding.`,
  }
}

export function getLessonWorkspace(lesson: CourseLesson, index: number): LessonWorkspace {
  if (/useeffect|side effect/i.test(lesson.title)) return { ...USEEFFECT, lessonNo: index + 1, durationLabel: `${lesson.duration_min || 18} min` }
  return genericWorkspace(lesson, index)
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function mockModulesFromPack(courseId: string, pack: CourseDetailPack): CourseModule[] {
  return pack.sections.map((sec, si) => ({
    id: `${courseId}-mod-${si}`,
    course_id: courseId,
    title: sec.title,
    sort_order: si,
    lessons: sec.lessons.map((l, li) => ({
      id: `${courseId}-l-${si}-${li}`,
      module_id: `${courseId}-mod-${si}`,
      title: l.title,
      lesson_type: 'video' as const,
      duration_min: l.minutes,
      sort_order: li,
      is_free: Boolean(l.preview),
      body: null,
      video_url: null,
      quiz: null,
    })),
  }))
}

export function nameDemoLessons(modules: CourseModule[]): CourseModule[] {
  const js = ['Variables & Data Types', 'Functions', 'ES6 Fundamentals', 'Async JavaScript', 'Arrays & Objects', 'Modules', 'Error Handling', 'JSON', 'Fetch basics', 'Debouncing', 'Local storage', 'Practice lab']
  const react = ['Components', 'Props & State', 'useState', 'useEffect', 'Context API', 'Custom Hooks', 'Performance', 'Lists & keys', 'Forms', 'Lifting state', 'Refs', 'Portals', 'Error boundaries', 'Patterns']
  return modules.map(m => {
    const titles = /javascript foundations/i.test(m.title) ? js : /react fundamentals/i.test(m.title) ? react : null
    if (!titles) return m
    return {
      ...m,
      lessons: m.lessons.map((l, i) => ({ ...l, title: titles[i] || l.title })),
    }
  })
}

export function seedDemoDone(modules: CourseModule[], currentId?: string): string[] {
  const ids: string[] = []
  modules.forEach((m, mi) => {
    if (mi === 0) ids.push(...m.lessons.map(l => l.id))
    if (mi === 1) ids.push(...m.lessons.slice(0, 3).map(l => l.id))
  })
  return ids.filter(id => id !== currentId)
}

export function resolveWorkspaceCourse(
  id: string,
  apiRow: CourseRow | null,
  apiCourses: CourseRow[],
) {
  const cat = resolveCatalogCourse(id, apiCourses, apiRow)
  const pack = cat ? getCourseDetailPack(cat) : null
  return { cat, pack, title: cat?.title || apiRow?.title || 'Full Stack Web Development' }
}

export function sectionProgress(mod: CourseModule, done: Set<string>) {
  const n = mod.lessons.filter(l => done.has(l.id)).length
  return { n, total: mod.lessons.length, all: n === mod.lessons.length && mod.lessons.length > 0 }
}

export function isSectionLocked(modules: CourseModule[], index: number, done: Set<string>) {
  if (index === 0) return false
  return !sectionProgress(modules[index - 1], done).all
}
