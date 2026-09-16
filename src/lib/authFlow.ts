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

export function isSignupAuthRole(value: string | null | undefined): value is SignupAuthRole {
  return value === 'student' || value === 'tutor'
}

/** Role chosen before OAuth redirect; survives the callback via sessionStorage. */
export function readPendingOAuthRole(): SignupAuthRole | null {
  try {
    const stored = sessionStorage.getItem(AUTH_ROLE_KEY)
    return isSignupAuthRole(stored) ? stored : null
  } catch {
    return null
  }
}

export function clearPendingOAuthRole() {
  try {
    sessionStorage.removeItem(AUTH_ROLE_KEY)
  } catch {
    /* ignore */
  }
}

/** Prefer sessionStorage; fall back to the OAuth redirect URL query param. */
export function resolvePendingOAuthRole(search = ''): SignupAuthRole | null {
  return readPendingOAuthRole() ?? parseAuthRole(search)
}
