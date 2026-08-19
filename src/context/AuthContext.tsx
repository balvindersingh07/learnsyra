import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, type Profile, type UserRole } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  reloadProfile: () => Promise<void>
  updateProfile: (patch: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'headline' | 'plan'>>) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    const row = data as Profile | null
    setProfile(row ? { ...row, plan: row.plan ?? 'free' } : null)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) {
        loadProfile(next.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signInWithGoogle: AuthContextValue['signInWithGoogle'] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    return { error: error?.message ?? null }
  }

  const resetPassword: AuthContextValue['resetPassword'] = async email => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    })
    return { error: error?.message ?? null }
  }

  const signUp: AuthContextValue['signUp'] = async (email, password, fullName, role) => {
    const assignedRole: UserRole = role === 'tutor' ? 'tutor' : 'student'
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: assignedRole } },
    })
    return { error: error?.message ?? null }
  }

  const signOut: AuthContextValue['signOut'] = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const reloadProfile: AuthContextValue['reloadProfile'] = async () => {
    const uid = session?.user.id
    if (uid) await loadProfile(uid)
  }

  const updateProfile: AuthContextValue['updateProfile'] = async patch => {
    const uid = session?.user.id
    if (!uid) return { error: 'Not logged in' }
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid)
    if (!error) await loadProfile(uid)
    return { error: error?.message ?? null }
  }

  const updatePassword: AuthContextValue['updatePassword'] = async password => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error?.message ?? null }
  }

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    configured: isSupabaseConfigured,
    signIn,
    signInWithGoogle,
    resetPassword,
    signUp,
    signOut,
    reloadProfile,
    updateProfile,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
