import type { CourseLesson, CourseModule, CourseRow } from './api'
import { getCourseDetailPack, resolveCatalogCourse, type CourseDetailPack } from './courseDetail'
import { userStorageKey } from './supabase'

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

export function loadNotes(courseId: string, lessonId: string, userId?: string | null) {
  return loadWorkspaceSnapshot(courseId, lessonId, userId).notes
}

export function saveNotes(courseId: string, lessonId: string, text: string, userId?: string | null) {
  return saveWorkspaceSnapshot(courseId, lessonId, { notes: text }, userId)
}

export function loadLocalDone(courseId: string, userId?: string | null): string[] {
  const key = userStorageKey('learnsyra_done', userId, courseId)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(key)
      return []
    }
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    return []
  }
}

export function saveLocalDone(courseId: string, ids: string[], userId?: string | null) {
  const key = userStorageKey('learnsyra_done', userId, courseId)
  if (!key) return { ok: false as const, error: 'Not signed in' }
  try {
    const clean = [...new Set(ids.filter(id => typeof id === 'string' && id.length > 0))]
    localStorage.setItem(key, JSON.stringify(clean))
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Save failed' }
  }
}

export function loadWatched(courseId: string, lessonId: string, userId?: string | null) {
  return loadWorkspaceSnapshot(courseId, lessonId, userId).watched
}

export function saveWatched(courseId: string, lessonId: string, userId?: string | null) {
  return saveWorkspaceSnapshot(courseId, lessonId, { watched: true }, userId)
}

export interface LessonWorkspaceSnapshot {
  v: 1
  notes: string
  watched: boolean
  practiceDone: boolean
  practiceCode: string
  quizDone: boolean
  qScore: number
}

export type WorkspaceSaveResult = { ok: true } | { ok: false; error: string }

function emptyWorkspaceSnapshot(): LessonWorkspaceSnapshot {
  return {
    v: 1,
    notes: '',
    watched: false,
    practiceDone: false,
    practiceCode: '',
    quizDone: false,
    qScore: 0,
  }
}

function normalizeWorkspaceSnapshot(input: Partial<LessonWorkspaceSnapshot>): LessonWorkspaceSnapshot {
  return {
    v: 1,
    notes: typeof input.notes === 'string' ? input.notes : '',
    watched: Boolean(input.watched),
    practiceDone: Boolean(input.practiceDone),
    practiceCode: typeof input.practiceCode === 'string' ? input.practiceCode : '',
    quizDone: Boolean(input.quizDone),
    qScore:
      typeof input.qScore === 'number' && Number.isFinite(input.qScore)
        ? Math.max(0, Math.floor(input.qScore))
        : 0,
  }
}

function workspaceStorageKey(courseId: string, lessonId: string, userId?: string | null) {
  return userStorageKey('learnsyra_workspace', userId, `${courseId}_${lessonId}`)
}

function legacyNotesKey(courseId: string, lessonId: string, userId?: string | null) {
  return userStorageKey('learnsyra_notes', userId, `${courseId}_${lessonId}`)
}

function legacyWatchKey(courseId: string, lessonId: string, userId?: string | null) {
  return userStorageKey('learnsyra_watch', userId, `${courseId}_${lessonId}`)
}

function parseWorkspaceSnapshot(raw: string | null): LessonWorkspaceSnapshot | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<LessonWorkspaceSnapshot>
    if (parsed.v !== 1) return null
    return normalizeWorkspaceSnapshot(parsed)
  } catch {
    return null
  }
}

function syncLegacyWorkspaceKeys(
  courseId: string,
  lessonId: string,
  snapshot: LessonWorkspaceSnapshot,
  userId?: string | null,
) {
  const notesKey = legacyNotesKey(courseId, lessonId, userId)
  const watchKey = legacyWatchKey(courseId, lessonId, userId)
  if (notesKey) localStorage.setItem(notesKey, snapshot.notes)
  if (watchKey) localStorage.setItem(watchKey, snapshot.watched ? '1' : '0')
}

export function loadWorkspaceSnapshot(
  courseId: string,
  lessonId: string,
  userId?: string | null,
): LessonWorkspaceSnapshot {
  const key = workspaceStorageKey(courseId, lessonId, userId)
  const empty = emptyWorkspaceSnapshot()
  if (!key) return empty

  const unified = parseWorkspaceSnapshot(localStorage.getItem(key))
  if (unified) return unified
  if (localStorage.getItem(key)) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }

  const notesKey = legacyNotesKey(courseId, lessonId, userId)
  const watchKey = legacyWatchKey(courseId, lessonId, userId)
  const legacyNotes = notesKey ? localStorage.getItem(notesKey) ?? '' : ''
  const legacyWatched = watchKey ? localStorage.getItem(watchKey) === '1' : false
  if (!legacyNotes && !legacyWatched) return empty

  const migrated = normalizeWorkspaceSnapshot({
    notes: legacyNotes,
    watched: legacyWatched,
  })
  saveWorkspaceSnapshot(courseId, lessonId, migrated, userId)
  return migrated
}

export function saveWorkspaceSnapshot(
  courseId: string,
  lessonId: string,
  patch: Partial<LessonWorkspaceSnapshot>,
  userId?: string | null,
): WorkspaceSaveResult {
  const key = workspaceStorageKey(courseId, lessonId, userId)
  if (!key) return { ok: false, error: 'Not signed in' }
  try {
    const current = loadWorkspaceSnapshot(courseId, lessonId, userId)
    const next = normalizeWorkspaceSnapshot({ ...current, ...patch, v: 1 })
    localStorage.setItem(key, JSON.stringify(next))
    syncLegacyWorkspaceKeys(courseId, lessonId, next, userId)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' }
  }
}

export function buildWorkspaceSnapshot(input: {
  notes: string
  watched: boolean
  practiceDone: boolean
  practiceCode: string
  quizDone: boolean
  qScore: number
}): LessonWorkspaceSnapshot {
  return normalizeWorkspaceSnapshot({ ...input, v: 1 })
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
  quizFeedback: 'Review dependency arrays if any question felt unclear.',
  insight: '',
  nextTitle: 'Context API in React',
  nextMinutes: 12,
  nextSkills: ['React', 'State Management'],
}

function genericWorkspace(lesson: CourseLesson, index: number): LessonWorkspace {
  const title = lesson.title || 'Lesson'
  return {
    subtitle: lesson.body || `Learn ${title} with a short video, practice, and a knowledge check.`,
    durationLabel: `${lesson.duration_min || 0} min`,
    lessonNo: index + 1,
    level: 'Lesson',
    skill: title,
    chapters: [
      { t: 0, label: 'Introduction' },
      { t: 120, label: 'Core idea' },
      { t: 300, label: 'Practice' },
      { t: 480, label: 'Check your understanding' },
    ],
    objectives: [`Understand ${title}`, 'Practice the idea', 'Check your understanding'],
    takeaway: `Master ${title} by watching, practicing, and checking your understanding.`,
    practice: {
      title: `Practice: ${title}`,
      difficulty: 'Beginner',
      minutes: 10,
      description: `Write a small example that uses what you learned in ${title}.`,
      starter: `// Practice for ${title}\n\nexport default function Practice() {\n  return <div>${title}</div>\n}\n`,
      hint: 'Start with a small working example, then add one improvement.',
      successChecks: ['export'],
      feedback: 'Nice start. Keep iterating on this lesson.',
    },
    quiz: [
      {
        q: `What is the main idea of ${title}?`,
        options: ['Skip the lesson', 'Apply the concept from this lesson', 'Ignore practice', 'Guess randomly'],
        answer: 1,
        explain: 'Use this check to confirm you understood the lesson topic.',
      },
    ],
    quizFeedback: 'Review the lesson notes if any question felt unclear.',
    insight: '',
    nextTitle: 'Next lesson',
    nextMinutes: 0,
    nextSkills: [],
  }
}

export function getLessonWorkspace(lesson: CourseLesson, index: number): LessonWorkspace {
  if (/useeffect|side effect/i.test(lesson.title)) {
    return {
      ...USEEFFECT,
      lessonNo: index + 1,
      durationLabel: `${lesson.duration_min || 18} min`,
      insight: '',
      quizFeedback: 'Review dependency arrays if any question felt unclear.',
    }
  }
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

export function seedDemoDone(_modules: CourseModule[], _currentId?: string): string[] {
  return []
}

export function resolveWorkspaceCourse(
  id: string,
  apiRow: CourseRow | null,
  apiCourses: CourseRow[],
) {
  const cat = resolveCatalogCourse(id, apiCourses, apiRow)
  const pack = cat ? getCourseDetailPack(cat) : null
  return { cat, pack, title: cat?.title || apiRow?.title || 'Course' }
}

export function sectionProgress(mod: CourseModule, done: Set<string>) {
  const n = mod.lessons.filter(l => done.has(l.id)).length
  return { n, total: mod.lessons.length, all: n === mod.lessons.length && mod.lessons.length > 0 }
}

export function isSectionLocked(modules: CourseModule[], index: number, done: Set<string>) {
  if (index === 0) return false
  return !sectionProgress(modules[index - 1], done).all
}
