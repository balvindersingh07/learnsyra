import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, type Profile, type UserRole } from '../lib/supabase'
import { mapAuthError } from '../lib/authErrors'
import {
  authSiteOrigin,
  normalizeEmail,
  validatePassword,
  validateSignupInput,
} from '../lib/authValidation'
import type { SignupAuthRole } from '../lib/authFlow'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  recoveryMode: boolean
  isEmailVerified: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  resendVerificationEmail: () => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
  ) => Promise<{ error: string | null; needsVerification?: boolean }>
  signOut: () => Promise<void>
  reloadProfile: () => Promise<void>
  updateProfile: (patch: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'headline'>>) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, headline, role, plan, created_at')
      .eq('id', userId)
      .single()
    const row = data as Profile | null
    const next = row ? { ...row, plan: row.plan ?? 'free' } : null
    setProfile(next)
    return next
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') setRecoveryMode(false)
      setSession(next)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!isSupabaseConfigured) return

    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    loadProfile(userId).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const normalized = normalizeEmail(email)
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password })
    return { error: mapAuthError(error) }
  }

  const resetPassword: AuthContextValue['resetPassword'] = async email => {
    const normalized = normalizeEmail(email)
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: `${authSiteOrigin()}/reset-password`,
    })
    return { error: mapAuthError(error) }
  }

  const resendVerificationEmail: AuthContextValue['resendVerificationEmail'] = async () => {
    const email = session?.user.email
    if (!email) return { error: 'Not logged in' }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${authSiteOrigin()}/verify-email` },
    })
    return { error: mapAuthError(error) }
  }

  const signUp: AuthContextValue['signUp'] = async (email, password, fullName, role) => {
    const validation = validateSignupInput(email, password, fullName)
    if (validation) return { error: validation }

    const assignedRole: UserRole = role === 'tutor' ? 'tutor' : 'student'
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: { full_name: fullName.trim(), role: assignedRole },
        emailRedirectTo: `${authSiteOrigin()}/verify-email`,
      },
    })
    if (error) return { error: mapAuthError(error) }

    const needsVerification = Boolean(data.user && !data.session)
    return { error: null, needsVerification }
  }

  const signOut: AuthContextValue['signOut'] = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setRecoveryMode(false)
  }

  const reloadProfile: AuthContextValue['reloadProfile'] = async () => {
    const uid = session?.user.id
    if (uid) await loadProfile(uid)
  }

  const updateProfile: AuthContextValue['updateProfile'] = async patch => {
    const uid = session?.user.id
    if (!uid) return { error: 'Not logged in' }
    const safe: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'headline'>> = {}
    if ('full_name' in patch) safe.full_name = patch.full_name
    if ('avatar_url' in patch) safe.avatar_url = patch.avatar_url
    if ('headline' in patch) safe.headline = patch.headline
    if (Object.keys(safe).length === 0) return { error: null }
    const { error } = await supabase.from('profiles').update(safe).eq('id', uid)
    if (!error) await loadProfile(uid)
    return { error: error?.message ? 'Could not save profile. Try again.' : null }
  }

  const updatePassword: AuthContextValue['updatePassword'] = async password => {
    const validation = validatePassword(password)
    if (validation) return { error: validation }
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setRecoveryMode(false)
    return { error: mapAuthError(error) }
  }

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    configured: isSupabaseConfigured,
    recoveryMode,
    isEmailVerified: Boolean(session?.user.email_confirmed_at),
    signIn,
    resetPassword,
    resendVerificationEmail,
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
