import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, type Profile, type UserRole } from '../lib/supabase'
import { mapAuthError } from '../lib/authErrors'
import {
  authSiteOrigin,
  normalizeEmail,
  validatePassword,
  validateSignupInput,
} from '../lib/authValidation'

const AUTH_RETURN_KEY = 'learnsyra_auth_return'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  recoveryMode: boolean
  isEmailVerified: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: (returnPath?: string) => Promise<{ error: string | null }>
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

    const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') setRecoveryMode(false)
      setSession(next)
      if (next?.user) {
        setProfile(null)
        loadProfile(next.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const normalized = normalizeEmail(email)
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password })
    return { error: mapAuthError(error) }
  }

  const signInWithGoogle: AuthContextValue['signInWithGoogle'] = async returnPath => {
    if (returnPath) sessionStorage.setItem(AUTH_RETURN_KEY, returnPath)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${authSiteOrigin()}/login` },
    })
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
    signInWithGoogle,
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

export function consumeAuthReturnPath(): string | undefined {
  try {
    const value = sessionStorage.getItem(AUTH_RETURN_KEY)
    if (value) sessionStorage.removeItem(AUTH_RETURN_KEY)
    return value ?? undefined
  } catch {
    return undefined
  }
}
