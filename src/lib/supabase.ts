import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn(
    "[Sutrra] Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.",
  )
}

// A single shared client. When env is missing we still create a client with
// placeholder values so imports don't crash; calls will fail gracefully and
// the UI surfaces a "not configured" state instead of a white screen.
export const supabase: SupabaseClient = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "public-anon-key-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/** Logged-in user id from the Supabase auth token in localStorage. Does not change session handling. */
export function peekAuthUserId(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('sb-') || !key.includes('auth-token')) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as {
        user?: { id?: string }
        currentSession?: { user?: { id?: string } }
      }
      const id = parsed.user?.id ?? parsed.currentSession?.user?.id
      if (typeof id === 'string' && id.length > 0) return id
    }
  } catch {
    /* ignore */
  }
  return null
}

export type UserRole = 'student' | 'tutor' | 'admin'

export type PlanId = 'free' | 'student_pro' | 'career_pro'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  headline: string | null
  plan: PlanId
  created_at: string
}
