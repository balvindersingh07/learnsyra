import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import {
  AUTH_ROLE_KEY,
  isSignupAuthRole,
  parseAuthRole,
  parseAuthRoleFromPath,
  type SignupAuthRole,
} from './authFlow'

const AUTH_ROLE_TS_KEY = 'learnsyra_auth_role_ts'
const ROLE_TTL_MS = 30 * 60 * 1000

let applyInFlight: Promise<SignupAuthRole | null> | null = null
let lastAppliedKey: string | null = null

function devLog(message: string, detail?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.info(`[oauth-role] ${message}`, detail ?? '')
  }
}

export function persistPendingOAuthRole(role: SignupAuthRole) {
  const payload = { role, ts: Date.now() }
  try {
    sessionStorage.setItem(AUTH_ROLE_KEY, role)
    sessionStorage.setItem(AUTH_ROLE_TS_KEY, String(payload.ts))
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(AUTH_ROLE_KEY, role)
    localStorage.setItem(AUTH_ROLE_TS_KEY, String(payload.ts))
  } catch {
    /* ignore */
  }
  devLog('persisted pending role', { role })
}

function readStoredRole(): SignupAuthRole | null {
  const read = (storage: Storage): SignupAuthRole | null => {
    try {
      const role = storage.getItem(AUTH_ROLE_KEY)
      const ts = Number(storage.getItem(AUTH_ROLE_TS_KEY) ?? 0)
      if (!isSignupAuthRole(role)) return null
      if (!ts || Date.now() - ts > ROLE_TTL_MS) return null
      return role
    } catch {
      return null
    }
  }
  return read(sessionStorage) ?? read(localStorage)
}

/** Recover role from path, query, then durable browser storage. */
export function resolvePendingOAuthRole(location?: Pick<Location, 'pathname' | 'search'>): SignupAuthRole | null {
  const pathname = location?.pathname ?? window.location.pathname
  const search = location?.search ?? window.location.search
  const role =
    parseAuthRoleFromPath(pathname) ??
    parseAuthRole(search) ??
    readStoredRole()
  devLog('resolved pending role', { role, pathname, search })
  return role
}

export function clearPendingOAuthRole() {
  try {
    sessionStorage.removeItem(AUTH_ROLE_KEY)
    sessionStorage.removeItem(AUTH_ROLE_TS_KEY)
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(AUTH_ROLE_KEY)
    localStorage.removeItem(AUTH_ROLE_TS_KEY)
  } catch {
    /* ignore */
  }
}

export function isGoogleOAuthUser(user: User) {
  if (user.app_metadata?.provider === 'google') return true
  const providers = user.app_metadata?.providers
  if (Array.isArray(providers) && providers.includes('google')) return true
  return user.identities?.some(identity => identity.provider === 'google') ?? false
}

export async function applyOAuthSignupRoleForUser(user: User): Promise<SignupAuthRole | null> {
  if (!isGoogleOAuthUser(user)) return null

  const pendingRole = resolvePendingOAuthRole()
  if (!pendingRole) {
    devLog('skip apply — no pending role', { userId: user.id })
    return null
  }

  const dedupeKey = `${user.id}:${pendingRole}`
  if (lastAppliedKey === dedupeKey) {
    devLog('skip apply — already applied this session', { dedupeKey })
    return pendingRole
  }

  if (applyInFlight) return applyInFlight

  applyInFlight = (async () => {
    devLog('calling apply_oauth_signup_role', { userId: user.id, pendingRole })
    const { data, error } = await supabase.rpc('apply_oauth_signup_role', { p_role: pendingRole })
    if (error) {
      devLog('apply_oauth_signup_role failed', { message: error.message, code: error.code })
      return null
    }
    devLog('apply_oauth_signup_role succeeded', { assigned: data })
    lastAppliedKey = dedupeKey
    clearPendingOAuthRole()
    return pendingRole
  })()

  try {
    return await applyInFlight
  } finally {
    applyInFlight = null
  }
}
