export type Page =
  | 'intro'
  | 'home'
  | 'dashboard'
  | 'ai-learning'
  | 'tutors'
  | 'courses'
  | 'course-detail'
  | 'projects'
  | 'career'
  | 'pricing'
  | 'tutor-dashboard'
  | 'admin'
  | 'login'
  | 'signup'
  | 'profile'
  | 'notifications'
  | 'live'

export const pagePath: Record<Page, string> = {
  intro: '/',
  home: '/home',
  dashboard: '/dashboard',
  'ai-learning': '/ai-learning',
  tutors: '/tutors',
  courses: '/courses',
  'course-detail': '/courses',
  projects: '/projects',
  career: '/career',
  pricing: '/pricing',
  'tutor-dashboard': '/tutor',
  admin: '/admin',
  login: '/',
  signup: '/signup',
  profile: '/profile',
  notifications: '/notifications',
  live: '/live',
}

export function coursePath(id: string) {
  return `/courses/${id}`
}

export function lessonPath(courseId: string, lessonId: string) {
  return `/courses/${courseId}/learn/${lessonId}`
}

export function liveClassPath(id: string) {
  return `/live/${id}`
}

export function projectPath(id: string) {
  return `/projects/${id}`
}

export function projectWorkspacePath(id: string) {
  return `/projects/${id}/workspace`
}

export function tutorPath(id: string) {
  return `/tutors/${id}`
}

export function tutorBookPath(id: string) {
  return `/tutors/${id}/book`
}

export function sessionPath(id: string) {
  return `/sessions/${id}`
}

export function tutorStudentPath(id: string) {
  return `/tutor/students/${id}`
}

export function tutorSessionPath(id: string) {
  return `/tutor/sessions/${id}`
}

export function tutorCoursePath(id: string) {
  return `/tutor/courses/${id}`
}

export function tutorCoursePreviewPath(id: string) {
  return `/tutor/courses/${id}/preview`
}

export function tutorProjectPath(id: string) {
  return `/tutor/projects/${id}`
}

export function tutorProjectWorkspacePath(projectId: string) {
  return `/tutor/projects/workspace/${projectId}`
}

export function careerInterviewPath() {
  return '/career/interview'
}

export function careerResumePath() {
  return '/career/resume'
}

export function careerJobsPath() {
  return '/career/jobs'
}

export function careerJobPath(id: string) {
  return `/career/jobs/${id}`
}
