import { getCourseCurriculum, setCoursePublished, type CourseModule, type CourseRow } from './api'
import { formatWhen, loadAdminUserIndex, paginate, type AdminUserIndex } from './adminUsers'
import { curriculumHealth, findStudioByAnyId, qualityScore, studioCurriculum, type StudioCourse } from './tutorCourses'

export type CourseTab = 'all' | 'published' | 'draft' | 'review' | 'flagged' | 'paused'
export type CourseSort = 'recommended' | 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'students' | 'rating'
export type PublishFilter = 'all' | 'published' | 'unpublished'
export type PriceFilter = 'all' | 'free' | 'paid'

export interface AdminCourseRow {
  id: string
  title: string
  description: string | null
  category: string | null
  level: string | null
  priceCents: number
  published: boolean
  createdAt: string
  tutorId: string | null
  tutorName: string
  tutorHeadline: string | null
  studentCount: number
  skills: string[]
  demo: boolean
}

export interface AdminCourseIndex extends AdminUserIndex {
  courseRows: AdminCourseRow[]
}

const NOTES_KEY = 'learnsyra_admin_course_notes'
const PAGE_SIZE = 20

export { formatWhen, paginate }

export function coursesPageSize() {
  return PAGE_SIZE
}

export function isCoursePublishBackendAvailable() {
  return true
}

export function isCourseModerationBackendAvailable() {
  return false
}

export function loadCourseNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function saveCourseNote(courseId: string, note: string) {
  const map = loadCourseNotes()
  const next = note.trim()
  if (next) map[courseId] = next
  else delete map[courseId]
  localStorage.setItem(NOTES_KEY, JSON.stringify(map))
}

function isDemoCourse(c: CourseRow) {
  return c.id.startsWith('demo-')
}

function toCourse(c: CourseRow, index: AdminUserIndex): AdminCourseRow {
  const tutor = c.tutor_id ? index.profiles.find(p => p.id === c.tutor_id) : null
  const studio = isDemoCourse(c) ? null : studioReference(c.id)
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    level: c.level,
    priceCents: c.price_cents,
    published: c.published,
    createdAt: c.created_at,
    tutorId: c.tutor_id,
    tutorName: tutor?.full_name || 'Unnamed tutor',
    tutorHeadline: tutor?.headline ?? null,
    studentCount: index.enrollments.filter(e => e.course_id === c.id).length,
    skills: studio ? [...studio.primarySkills, ...studio.secondarySkills] : [],
    demo: isDemoCourse(c),
  }
}

export async function loadAdminCourseIndex(): Promise<AdminCourseIndex> {
  const index = await loadAdminUserIndex()
  return { ...index, courseRows: index.courses.map(c => toCourse(c, index)) }
}

export function courseStats(rows: AdminCourseRow[]) {
  const real = rows.filter(r => !r.demo)
  return {
    total: String(real.length),
    published: String(real.filter(r => r.published).length),
    draft: String(real.filter(r => !r.published).length),
    underReview: '—',
    flagged: '—',
    paused: '—',
  }
}

export interface CourseQuery {
  tab: CourseTab
  q: string
  publish: PublishFilter
  category: string
  tutorId: string
  level: string
  price: PriceFilter
  sort: CourseSort
}

export function filterCourses(rows: AdminCourseRow[], query: CourseQuery) {
  const q = query.q.trim().toLowerCase()
  let list = rows
  if (query.tab === 'published') list = list.filter(r => r.published)
  else if (query.tab === 'draft') list = list.filter(r => !r.published)
  else if (query.tab === 'review' || query.tab === 'flagged' || query.tab === 'paused') list = []
  if (query.publish === 'published') list = list.filter(r => r.published)
  if (query.publish === 'unpublished') list = list.filter(r => !r.published)
  if (query.category) list = list.filter(r => r.category === query.category)
  if (query.tutorId) list = list.filter(r => r.tutorId === query.tutorId)
  if (query.level) list = list.filter(r => r.level === query.level)
  if (query.price === 'free') list = list.filter(r => r.priceCents <= 0)
  if (query.price === 'paid') list = list.filter(r => r.priceCents > 0)
  if (q) {
    list = list.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.tutorName.toLowerCase().includes(q) ||
      (r.category && r.category.toLowerCase().includes(q)) ||
      r.skills.some(s => s.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list]
  if (query.sort === 'newest') sorted.sort((a, b) => +(new Date(b.createdAt)) - +(new Date(a.createdAt)))
  else if (query.sort === 'oldest') sorted.sort((a, b) => +(new Date(a.createdAt)) - +(new Date(b.createdAt)))
  else if (query.sort === 'title_asc') sorted.sort((a, b) => a.title.localeCompare(b.title))
  else if (query.sort === 'title_desc') sorted.sort((a, b) => b.title.localeCompare(a.title))
  else if (query.sort === 'students') sorted.sort((a, b) => b.studentCount - a.studentCount)
  else {
    sorted.sort((a, b) => {
      const pend = Number(!a.published) - Number(!b.published)
      if (pend) return pend
      return +(new Date(b.createdAt)) - +(new Date(a.createdAt))
    })
  }
  return sorted
}

export function uniqueCourseValues(rows: AdminCourseRow[], key: 'category' | 'level') {
  return [...new Set(rows.map(r => r[key]).filter(Boolean) as string[])].sort()
}

export function uniqueTutors(rows: AdminCourseRow[]) {
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.tutorId) map.set(r.tutorId, r.tutorName)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function courseStatusLabel(published: boolean) {
  return published ? 'Published' : 'Draft'
}

export async function publishCourse(id: string, published: boolean) {
  const { error } = await setCoursePublished(id, published)
  if (error) return { ok: false, message: error }
  return {
    ok: true,
    message: published
      ? 'Course published using the existing catalog publish API. Existing records are preserved.'
      : 'Course unpublished using the existing catalog publish API. Enrollments and progress are not deleted.',
  }
}

export async function loadCurriculum(courseId: string): Promise<{ modules: CourseModule[]; source: 'catalog' | 'studio' | 'none' }> {
  const fromApi = await getCourseCurriculum(courseId).catch(() => [] as CourseModule[])
  if (fromApi.length) return { modules: fromApi, source: 'catalog' }
  const studio = studioReference(courseId)
  if (studio && studio.modules.length) return { modules: studioCurriculum(studio), source: 'studio' }
  return { modules: [], source: 'none' }
}

export function studioReference(courseId: string): StudioCourse | null {
  const studio = findStudioByAnyId(courseId)
  if (!studio || studio.demo) return null
  return studio
}

export function qualityEstimate(courseId: string) {
  const studio = studioReference(courseId)
  if (!studio) return null
  return qualityScore(studio)
}

export function structureInsights(courseId: string) {
  const studio = studioReference(courseId)
  if (!studio) return []
  return curriculumHealth(studio).filter(h => h.tone === 'warn')
}
