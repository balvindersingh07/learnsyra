/** Student/tutor only — admin accounts are provisioned separately. */
export type SignupAuthRole = 'student' | 'tutor'

export const AUTH_ROLE_KEY = 'learnsyra_auth_role'

export const ROLE_OPTIONS: {
  id: SignupAuthRole
  label: string
  emoji: string
  headline: string
  description: string
}[] = [
  {
    id: 'student',
    label: 'Student',
    emoji: '🎓',
    headline: 'Learn, build, get hired',
    description: 'Courses, AI practice, projects, and career prep tailored to your goals.',
  },
  {
    id: 'tutor',
    label: 'Tutor',
    emoji: '👨‍🏫',
    headline: 'Teach and earn on LearnSyra',
    description: 'Host sessions, review projects, and grow your teaching business.',
  },
]

export function parseAuthRole(search: string): SignupAuthRole | null {
  const role = new URLSearchParams(search).get('role')
  if (role === 'student' || role === 'tutor') return role
  return null
}

export function authLoginPath(role: SignupAuthRole) {
  return `/login?role=${role}`
}

export function authSignupPath(role: SignupAuthRole) {
  return `/signup?role=${role}`
}

export function roleLabel(role: SignupAuthRole) {
  return ROLE_OPTIONS.find(r => r.id === role)?.label ?? role
}

export function roleEmoji(role: SignupAuthRole) {
  return ROLE_OPTIONS.find(r => r.id === role)?.emoji ?? '✨'
}
