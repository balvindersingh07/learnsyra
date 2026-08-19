import { getAllProfiles, getProjects, type ProfileLite, type ProjectRow, type StudentProjectRow } from './api'
import { formatWhen, paginate } from './adminUsers'
import { isSupabaseConfigured, supabase } from './supabase'

export type ProjectTab = 'all' | 'published' | 'draft' | 'active' | 'completed' | 'review'
export type ProjectSort = 'recommended' | 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'difficulty' | 'builds'
export type BuildFilter = 'all' | 'active' | 'submitted' | 'completed'
export type ReviewFilter = 'all' | 'not_submitted' | 'needs_review' | 'approved'

export interface AdminStudentBuild {
  id: string
  studentId: string
  studentName: string
  projectId: string
  status: 'started' | 'submitted' | 'completed' | string
  submissionUrl: string | null
  submittedAt: string | null
  reviewNote: string | null
  createdAt: string
  demo: boolean
}

export interface AdminProjectRow {
  id: string
  title: string
  description: string | null
  difficulty: string | null
  skills: string[]
  createdAt: string
  demo: boolean
  buildCount: number
  activeCount: number
  submissionCount: number
  needsReviewCount: number
  completedCount: number
}

export interface AdminProjectIndex {
  catalog: AdminProjectRow[]
  builds: AdminStudentBuild[]
  buildsAvailable: boolean
  profiles: ProfileLite[]
}

export interface ProjectQuery {
  tab: ProjectTab
  q: string
  difficulty: string
  skill: string
  build: BuildFilter
  review: ReviewFilter
  sort: ProjectSort
}

const NOTES_KEY = 'learnsyra_admin_project_notes'
const PAGE_SIZE = 20

export { formatWhen, paginate }

export function projectsPageSize() {
  return PAGE_SIZE
}

export function isProjectModerationBackendAvailable() {
  return false
}

export function isProjectReportingAvailable() {
  return false
}

export function loadProjectNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function saveProjectNote(projectId: string, note: string) {
  const map = loadProjectNotes()
  const next = note.trim()
  if (next) map[projectId] = next
  else delete map[projectId]
  localStorage.setItem(NOTES_KEY, JSON.stringify(map))
}

function isDemoId(id: string) {
  return id.startsWith('demo-')
}

function buildStatus(status: string) {
  if (status === 'started') return 'In Progress'
  if (status === 'submitted') return 'Submitted'
  if (status === 'completed') return 'Completed'
  return status || '—'
}

export function studentBuildLabel(status: string) {
  return buildStatus(status)
}

export function studentReviewLabel(status: string) {
  if (status === 'started') return 'Not Submitted'
  if (status === 'submitted') return 'Needs Review'
  if (status === 'completed') return 'Approved'
  return '—'
}

function toBuild(row: StudentProjectRow, profiles: ProfileLite[]): AdminStudentBuild {
  const student = profiles.find(p => p.id === row.student_id)
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: student?.full_name || 'Unnamed student',
    projectId: row.project_id,
    status: row.status,
    submissionUrl: row.submission_url,
    submittedAt: row.submitted_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    demo: isDemoId(row.id) || isDemoId(row.student_id) || isDemoId(row.project_id),
  }
}

async function loadStudentBuilds(profiles: ProfileLite[]): Promise<{ rows: AdminStudentBuild[]; available: boolean }> {
  if (!isSupabaseConfigured) return { rows: [], available: false }
  const { data, error } = await supabase
    .from('student_projects')
    .select('id, student_id, project_id, status, submission_url, submitted_at, review_note, created_at')
    .order('created_at', { ascending: false })
  if (error) return { rows: [], available: false }
  return { rows: ((data as StudentProjectRow[]) ?? []).map(r => toBuild(r, profiles)), available: true }
}

function toCatalog(p: ProjectRow, builds: AdminStudentBuild[]): AdminProjectRow {
  const mine = builds.filter(b => b.projectId === p.id && !b.demo)
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    difficulty: p.difficulty,
    skills: p.skills ?? [],
    createdAt: p.created_at,
    demo: isDemoId(p.id),
    buildCount: mine.length,
    activeCount: mine.filter(b => b.status === 'started').length,
    submissionCount: mine.filter(b => b.status === 'submitted' || b.status === 'completed').length,
    needsReviewCount: mine.filter(b => b.status === 'submitted').length,
    completedCount: mine.filter(b => b.status === 'completed').length,
  }
}

export async function loadAdminProjectIndex(): Promise<AdminProjectIndex> {
  const profiles = await getAllProfiles().catch(() => [] as ProfileLite[])
  const [catalog, buildPack] = await Promise.all([
    getProjects(),
    loadStudentBuilds(profiles),
  ])
  return {
    catalog: catalog.map(p => toCatalog(p, buildPack.rows)),
    builds: buildPack.rows,
    buildsAvailable: buildPack.available,
    profiles,
  }
}

export function projectStats(index: AdminProjectIndex) {
  const real = index.catalog.filter(r => !r.demo)
  const realBuilds = index.builds.filter(b => !b.demo)
  return {
    total: String(real.length),
    published: '—',
    draft: '—',
    activeBuilds: index.buildsAvailable ? String(realBuilds.filter(b => b.status === 'started').length) : '—',
    submissions: index.buildsAvailable ? String(realBuilds.filter(b => b.status === 'submitted' || b.status === 'completed').length) : '—',
    needsReview: index.buildsAvailable ? String(realBuilds.filter(b => b.status === 'submitted').length) : '—',
  }
}

export function filterProjects(rows: AdminProjectRow[], query: ProjectQuery, buildsAvailable: boolean) {
  const q = query.q.trim().toLowerCase()
  let list = rows
  if (query.tab === 'published' || query.tab === 'draft') list = []
  else if (query.tab === 'active') list = buildsAvailable ? list.filter(r => r.activeCount > 0) : []
  else if (query.tab === 'completed') list = buildsAvailable ? list.filter(r => r.completedCount > 0) : []
  else if (query.tab === 'review') list = buildsAvailable ? list.filter(r => r.needsReviewCount > 0) : []
  if (query.difficulty) list = list.filter(r => r.difficulty === query.difficulty)
  if (query.skill) list = list.filter(r => r.skills.some(s => s === query.skill))
  if (query.build === 'active') list = list.filter(r => r.activeCount > 0)
  if (query.build === 'submitted') list = list.filter(r => r.submissionCount > 0)
  if (query.build === 'completed') list = list.filter(r => r.completedCount > 0)
  if (query.review === 'needs_review') list = list.filter(r => r.needsReviewCount > 0)
  if (query.review === 'approved') list = list.filter(r => r.completedCount > 0)
  if (query.review === 'not_submitted') list = list.filter(r => r.buildCount > 0 && r.needsReviewCount === 0 && r.completedCount === 0)
  if (q) {
    list = list.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.difficulty && r.difficulty.toLowerCase().includes(q)) ||
      r.skills.some(s => s.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list]
  if (query.sort === 'newest') sorted.sort((a, b) => +(new Date(b.createdAt)) - +(new Date(a.createdAt)))
  else if (query.sort === 'oldest') sorted.sort((a, b) => +(new Date(a.createdAt)) - +(new Date(b.createdAt)))
  else if (query.sort === 'title_asc') sorted.sort((a, b) => a.title.localeCompare(b.title))
  else if (query.sort === 'title_desc') sorted.sort((a, b) => b.title.localeCompare(a.title))
  else if (query.sort === 'difficulty') sorted.sort((a, b) => (a.difficulty || '').localeCompare(b.difficulty || ''))
  else if (query.sort === 'builds') sorted.sort((a, b) => b.buildCount - a.buildCount)
  else {
    sorted.sort((a, b) => {
      const pend = b.needsReviewCount - a.needsReviewCount
      if (pend) return pend
      return +(new Date(b.createdAt)) - +(new Date(a.createdAt))
    })
  }
  return sorted
}

export function uniqueProjectValues(rows: AdminProjectRow[], key: 'difficulty') {
  return [...new Set(rows.map(r => r[key]).filter(Boolean) as string[])].sort()
}

export function uniqueProjectSkills(rows: AdminProjectRow[]) {
  return [...new Set(rows.flatMap(r => r.skills).filter(Boolean))].sort()
}

export function projectStatusLabel() {
  return 'Unavailable'
}

export function projectReviewSummary(row: AdminProjectRow, buildsAvailable: boolean) {
  if (!buildsAvailable) return '—'
  if (row.needsReviewCount > 0) return 'Needs Review'
  if (row.completedCount > 0) return 'Approved'
  if (row.buildCount > 0) return 'Not Submitted'
  return '—'
}

export function projectInsights(row: AdminProjectRow) {
  const out: { id: string; label: string; rec: string }[] = []
  if (!row.description?.trim()) out.push({ id: 'desc', label: 'Missing requirements', rec: 'Add a project description so students know what to build.' })
  if (!row.skills.length) out.push({ id: 'skills', label: 'Potential skill gap', rec: 'List the skills this project is meant to practice.' })
  if (!row.difficulty) out.push({ id: 'diff', label: 'Project difficulty mismatch', rec: 'Set a difficulty so students can choose an appropriate challenge.' })
  return out
}

export function buildsForProject(index: AdminProjectIndex, projectId: string) {
  return index.builds.filter(b => b.projectId === projectId && !b.demo)
}
