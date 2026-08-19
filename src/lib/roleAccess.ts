import type { UserRole } from './supabase'

export const TUTOR_HOME = '/tutor'
export const ADMIN_HOME = '/admin'
export const STUDENT_HOME = '/dashboard'

export const TUTOR_LINKS = [
  { label: 'Dashboard', to: '/tutor' },
  { label: 'Students', to: '/tutor/students' },
  { label: 'Courses', to: '/tutor/courses' },
  { label: 'Projects', to: '/tutor/projects' },
  { label: 'Sessions', to: '/tutor/sessions' },
  { label: 'Live', to: '/tutor/live' },
  { label: 'AI Teaching', to: '/tutor/ai' },
  { label: 'Earnings', to: '/tutor/earnings' },
  { label: 'Analytics', to: '/tutor/analytics' },
] as const

const STUDENT_ONLY_PREFIXES = [
  '/dashboard',
  '/ai-learning',
  '/career',
  '/profile',
  '/tutors',
  '/pricing',
]

export function roleHome(role: UserRole | null | undefined) {
  if (role === 'tutor') return TUTOR_HOME
  if (role === 'admin') return ADMIN_HOME
  return STUDENT_HOME
}

export function getDashboardPath(role: UserRole | null | undefined) {
  return roleHome(role)
}

export function getWorkspacePath(role: UserRole | null | undefined) {
  return roleHome(role)
}

export function isTutorRole(role: UserRole | null | undefined) {
  return role === 'tutor'
}

export function isAdminRole(role: UserRole | null | undefined) {
  return role === 'admin'
}

export function isStudentRole(role: UserRole | null | undefined) {
  return role === 'student'
}

export function displayInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function postLoginPath(from: string | undefined, role: UserRole) {
  const dest = from && from !== '/' && from !== '/login' && from !== '/signup' ? from : roleHome(role)
  if (role === 'admin') {
    if (dest.startsWith('/admin')) return dest
    return ADMIN_HOME
  }
  if (role === 'tutor' && isStudentOnlyPath(dest)) return TUTOR_HOME
  if (role === 'student' && dest.startsWith('/tutor')) return STUDENT_HOME
  if (role === 'student' && dest.startsWith('/admin')) return STUDENT_HOME
  if (role === 'tutor' && dest.startsWith('/admin')) return TUTOR_HOME
  return dest
}

export function isStudentOnlyPath(pathname: string) {
  return STUDENT_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

export function tutorTabFromPath(pathname: string) {
  if (pathname.startsWith('/tutor/students')) return 'students'
  if (pathname.startsWith('/tutor/courses')) return 'courses'
  if (pathname.startsWith('/tutor/projects')) return 'reviews'
  if (pathname.startsWith('/tutor/sessions')) return 'sessions'
  if (pathname.startsWith('/tutor/live')) return 'live'
  return 'overview'
}

export function tutorPathForTab(tab: string) {
  if (tab === 'overview') return '/tutor'
  if (tab === 'reviews') return '/tutor/projects'
  return `/tutor/${tab}`
}

export function tutorLinkActive(pathname: string, to: string) {
  if (to === '/tutor') return pathname === '/tutor' || pathname === '/tutor/dashboard'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export const ADMIN_LINKS = [
  { label: 'Overview', to: '/admin' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Tutors', to: '/admin/tutors' },
  { label: 'Courses', to: '/admin/courses' },
  { label: 'Projects', to: '/admin/projects' },
  { label: 'Sessions', to: '/admin/sessions' },
  { label: 'Payments', to: '/admin/payments' },
  { label: 'Reports', to: '/admin/reports' },
  { label: 'Analytics', to: '/admin/analytics' },
] as const

export const ADMIN_TRUST_LINKS = [
  { label: 'Tutor Verification', to: '/admin/verification' },
  { label: 'Course Moderation', to: '/admin/courses' },
] as const

export const ADMIN_SYSTEM_LINKS = [
  { label: 'Platform Settings', to: '/admin/settings' },
  { label: 'Audit Logs', to: '/admin/audit' },
] as const

export function adminLinkActive(pathname: string, to: string) {
  if (to === '/admin') return pathname === '/admin'
  return pathname === to || pathname.startsWith(`${to}/`)
}
