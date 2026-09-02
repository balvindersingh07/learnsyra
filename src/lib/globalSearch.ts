import {
  careerInterviewPath,
  careerJobPath,
  careerJobsPath,
  careerResumePath,
  coursePath,
  projectPath,
  tutorCoursePath,
  tutorPath,
  tutorStudentPath,
} from './paths'
import {
  ADMIN_LINKS,
  ADMIN_SYSTEM_LINKS,
  ADMIN_TRUST_LINKS,
  TUTOR_LINKS,
} from './roleAccess'
import { isSupabaseConfigured, peekAuthUserId, supabase, type UserRole } from './supabase'

export type GlobalSearchCategory =
  | 'courses'
  | 'tutors'
  | 'projects'
  | 'jobs'
  | 'career'
  | 'pages'
  | 'users'
  | 'students'

export interface GlobalSearchResult {
  id: string
  category: GlobalSearchCategory
  title: string
  subtitle?: string
  href: string
}

export interface GlobalSearchPayload {
  query: string
  results: GlobalSearchResult[]
  error: string | null
}

export const SEARCH_DEBOUNCE_MS = 300
export const MIN_QUERY_LENGTH = 2

const STUDENT_PAGES: { title: string; subtitle: string; href: string; keywords: string[] }[] = [
  { title: 'Explore Courses', subtitle: 'Browse the course catalog', href: '/courses', keywords: ['courses', 'learn', 'catalog'] },
  { title: 'Find Tutors', subtitle: 'Book 1-on-1 tutoring sessions', href: '/tutors', keywords: ['tutors', 'mentor', 'book'] },
  { title: 'AI Learning', subtitle: 'Practice with the AI tutor', href: '/ai-learning', keywords: ['ai', 'learning', 'practice'] },
  { title: 'Projects', subtitle: 'Hands-on project workspace', href: '/projects', keywords: ['projects', 'build'] },
  { title: 'Live Classes', subtitle: 'Join live sessions', href: '/live', keywords: ['live', 'class'] },
  { title: 'Career Center', subtitle: 'Interview prep and job search', href: '/career', keywords: ['career', 'jobs'] },
  { title: 'Interview Prep', subtitle: 'Mock interviews and feedback', href: careerInterviewPath(), keywords: ['interview', 'mock'] },
  { title: 'Resume Builder', subtitle: 'Improve your resume', href: careerResumePath(), keywords: ['resume', 'cv'] },
  { title: 'Job Board', subtitle: 'Browse open roles', href: careerJobsPath(), keywords: ['jobs', 'hiring'] },
  { title: 'Pricing', subtitle: 'Plans and subscriptions', href: '/pricing', keywords: ['pricing', 'plan', 'pro'] },
  { title: 'Dashboard', subtitle: 'Your learning home', href: '/dashboard', keywords: ['dashboard', 'home'] },
  { title: 'Profile', subtitle: 'Account settings', href: '/profile', keywords: ['profile', 'account'] },
]

const TUTOR_PAGES = [
  ...TUTOR_LINKS.map(l => ({ title: l.label, subtitle: 'Tutor workspace', href: l.to, keywords: [l.label.toLowerCase()] })),
  { title: 'Payout Settings', subtitle: 'Manage withdrawal account', href: '/tutor/payout-settings', keywords: ['payout', 'earnings', 'bank'] },
  { title: 'Tutor Profile', subtitle: 'Public tutor profile', href: '/tutor/profile', keywords: ['profile', 'availability', 'pricing'] },
]

const ADMIN_PAGES = [
  ...ADMIN_LINKS.map(l => ({ title: l.label, subtitle: 'Admin', href: l.to, keywords: [l.label.toLowerCase()] })),
  ...ADMIN_TRUST_LINKS.map(l => ({ title: l.label, subtitle: 'Trust & verification', href: l.to, keywords: [l.label.toLowerCase()] })),
  ...ADMIN_SYSTEM_LINKS.map(l => ({ title: l.label, subtitle: 'System', href: l.to, keywords: [l.label.toLowerCase()] })),
  { title: 'Admin Profile', subtitle: 'Your admin account', href: '/admin/profile', keywords: ['profile', 'account'] },
]

export function categoryLabel(category: GlobalSearchCategory) {
  if (category === 'courses') return 'Courses'
  if (category === 'tutors') return 'Tutors'
  if (category === 'projects') return 'Projects'
  if (category === 'jobs') return 'Jobs'
  if (category === 'career') return 'Career'
  if (category === 'pages') return 'Pages'
  if (category === 'users') return 'Users'
  if (category === 'students') return 'Students'
  return category
}

function normalizeQuery(raw: string) {
  return raw.trim().slice(0, 80)
}

function ilikePattern(q: string) {
  const safe = q.replace(/[%_\\]/g, '').trim()
  return `%${safe}%`
}

function matchesQuery(q: string, parts: (string | null | undefined)[]) {
  const needle = q.toLowerCase()
  return parts.some(p => p && p.toLowerCase().includes(needle))
}

function pageResults(
  q: string,
  pages: { title: string; subtitle: string; href: string; keywords: string[] }[],
): GlobalSearchResult[] {
  if (!q) return []
  return pages
    .filter(p => matchesQuery(q, [p.title, p.subtitle, ...p.keywords]))
    .slice(0, 6)
    .map(p => ({
      id: `page:${p.href}`,
      category: p.href.startsWith('/career') ? 'career' as const : 'pages' as const,
      title: p.title,
      subtitle: p.subtitle,
      href: p.href,
    }))
}

async function searchPublicCourses(q: string): Promise<GlobalSearchResult[]> {
  const pattern = ilikePattern(q)
  const rows: GlobalSearchResult[] = []

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, category, level')
      .eq('published', true)
      .or(`title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern}`)
      .order('title')
      .limit(8)
    if (!error) {
      for (const c of data ?? []) {
        rows.push({
          id: `course:${c.id}`,
          category: 'courses',
          title: c.title,
          subtitle: [c.category, c.level].filter(Boolean).join(' · ') || 'Course',
          href: coursePath(String(c.id)),
        })
      }
    }
  }

  const { publishedStudioRows } = await import('./tutorCourses')
  for (const c of publishedStudioRows()) {
    if (rows.some(r => r.id === `course:${c.id}`)) continue
    if (!matchesQuery(q, [c.title, c.description, c.category, c.level])) continue
    rows.push({
      id: `course:${c.id}`,
      category: 'courses',
      title: c.title,
      subtitle: [c.category, c.level].filter(Boolean).join(' · ') || 'Course',
      href: coursePath(c.id),
    })
    if (rows.length >= 10) break
  }

  return rows.slice(0, 8)
}

async function searchTutors(q: string): Promise<GlobalSearchResult[]> {
  if (!isSupabaseConfigured) return []
  const pattern = ilikePattern(q)
  const { data, error } = await supabase
    .from('tutor_listings')
    .select('id, name, expertise, subject, intro, tags')
    .or(`name.ilike.${pattern},expertise.ilike.${pattern},subject.ilike.${pattern},intro.ilike.${pattern}`)
    .order('rating', { ascending: false })
    .limit(8)
  if (error) return []
  return (data ?? []).map(t => ({
    id: `tutor:${t.id}`,
    category: 'tutors' as const,
    title: String(t.name),
    subtitle: t.expertise || t.subject || 'Tutor',
    href: tutorPath(String(t.id)),
  }))
}

async function searchProjects(q: string): Promise<GlobalSearchResult[]> {
  if (!isSupabaseConfigured) return []
  const pattern = ilikePattern(q)
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, description, difficulty, skills')
    .or(`title.ilike.${pattern},description.ilike.${pattern},difficulty.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(8)
  if (error) return []
  return (data ?? []).map(p => ({
    id: `project:${p.id}`,
    category: 'projects' as const,
    title: String(p.title),
    subtitle: p.difficulty || ((p.skills as string[] | null)?.slice(0, 3).join(', ') ?? 'Project'),
    href: projectPath(String(p.id)),
  }))
}

async function searchJobs(q: string): Promise<GlobalSearchResult[]> {
  if (!isSupabaseConfigured) return []
  const pattern = ilikePattern(q)
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, company, location, tags')
    .or(`title.ilike.${pattern},company.ilike.${pattern},location.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(6)
  if (error) return []
  return (data ?? []).map(j => ({
    id: `job:${j.id}`,
    category: 'jobs' as const,
    title: String(j.title),
    subtitle: [j.company, j.location].filter(Boolean).join(' · ') || 'Job opening',
    href: careerJobPath(String(j.id)),
  }))
}

async function searchTutorWorkspace(q: string, uid: string): Promise<GlobalSearchResult[]> {
  const pattern = ilikePattern(q)
  const out: GlobalSearchResult[] = []

  if (isSupabaseConfigured) {
    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, category, level')
      .eq('tutor_id', uid)
      .or(`title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern}`)
      .limit(6)
    for (const c of courses ?? []) {
      out.push({
        id: `tutor-course:${c.id}`,
        category: 'courses',
        title: String(c.title),
        subtitle: 'Your course',
        href: tutorCoursePath(String(c.id)),
      })
    }

    const mine = await supabase.from('courses').select('id').eq('tutor_id', uid)
    const courseIds = (mine.data ?? []).map(c => c.id)
    if (courseIds.length) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student:profiles!student_id(id, full_name, headline), course:courses(id, title)')
        .in('course_id', courseIds)
        .limit(40)
      for (const row of enrollments ?? []) {
        const student = row.student as { id?: string; full_name?: string | null; headline?: string | null } | null
        const course = row.course as { id?: string; title?: string } | null
        if (!student?.id) continue
        if (!matchesQuery(q, [student.full_name, student.headline, course?.title])) continue
        if (out.some(r => r.id === `student:${student.id}`)) continue
        out.push({
          id: `student:${student.id}`,
          category: 'students',
          title: student.full_name || 'Student',
          subtitle: course?.title ? `Enrolled in ${course.title}` : 'Your student',
          href: tutorStudentPath(student.id),
        })
        if (out.filter(r => r.category === 'students').length >= 6) break
      }
    }
  }

  return out.slice(0, 10)
}

async function searchAdminWorkspace(q: string): Promise<GlobalSearchResult[]> {
  if (!isSupabaseConfigured) return []
  const pattern = ilikePattern(q)
  const out: GlobalSearchResult[] = []

  const [profiles, courses] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, headline')
      .or(`full_name.ilike.${pattern},headline.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('courses')
      .select('id, title, category, published')
      .or(`title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  for (const p of profiles.data ?? []) {
    out.push({
      id: `user:${p.id}`,
      category: 'users',
      title: String(p.full_name || 'User'),
      subtitle: `${p.role || 'user'}${p.headline ? ` · ${p.headline}` : ''}`,
      href: `/admin/users/${p.id}`,
    })
  }

  for (const c of courses.data ?? []) {
    out.push({
      id: `admin-course:${c.id}`,
      category: 'courses',
      title: String(c.title),
      subtitle: c.published ? 'Published course' : 'Draft course',
      href: `/admin/courses/${c.id}`,
    })
  }

  return out.slice(0, 10)
}

export async function runGlobalSearch(query: string, role: UserRole | null | undefined): Promise<GlobalSearchPayload> {
  const q = normalizeQuery(query)
  if (q.length < MIN_QUERY_LENGTH) {
    return { query: q, results: [], error: null }
  }

  try {
    const pages =
      role === 'admin'
        ? pageResults(q, ADMIN_PAGES)
        : role === 'tutor'
          ? pageResults(q, TUTOR_PAGES)
          : pageResults(q, STUDENT_PAGES)

    if (role === 'admin') {
      const [workspace] = await Promise.all([searchAdminWorkspace(q)])
      return { query: q, results: [...pages, ...workspace], error: null }
    }

    if (role === 'tutor') {
      const uid = peekAuthUserId()
      const workspace = uid ? await searchTutorWorkspace(q, uid) : []
      return { query: q, results: [...pages, ...workspace], error: null }
    }

    const [courses, tutors, projects, jobs] = await Promise.all([
      searchPublicCourses(q),
      searchTutors(q),
      searchProjects(q),
      searchJobs(q),
    ])

    return {
      query: q,
      results: [...pages, ...courses, ...tutors, ...projects, ...jobs],
      error: null,
    }
  } catch {
    return { query: q, results: [], error: 'Search is temporarily unavailable. Try again.' }
  }
}

export function groupSearchResults(results: GlobalSearchResult[]) {
  const order: GlobalSearchCategory[] = ['pages', 'career', 'courses', 'tutors', 'projects', 'jobs', 'students', 'users']
  const groups = new Map<GlobalSearchCategory, GlobalSearchResult[]>()
  for (const r of results) {
    const list = groups.get(r.category) ?? []
    list.push(r)
    groups.set(r.category, list)
  }
  return order
    .filter(cat => groups.has(cat))
    .map(cat => ({ category: cat, label: categoryLabel(cat), items: groups.get(cat)! }))
}
