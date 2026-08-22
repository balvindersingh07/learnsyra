import type { AuthError } from '@supabase/supabase-js'

const GENERIC = 'Something went wrong. Please try again.'

export function mapAuthError(error: AuthError | Error | null | undefined): string | null {
  if (!error) return null
  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = error.message ?? ''

  switch (code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.'
    case 'email_not_confirmed':
      return 'Confirm your email before signing in. Check your inbox or resend the verification email.'
    case 'user_already_registered':
      return 'An account with this email already exists. Try signing in instead.'
    case 'weak_password':
      return 'Choose a stronger password (at least 8 characters).'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a few minutes and try again.'
    case 'same_password':
      return 'Choose a different password from your current one.'
    default:
      break
  }

  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (lower.includes('email not confirmed')) {
    return 'Confirm your email before signing in. Check your inbox or resend the verification email.'
  }
  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (lower.includes('password should be at least')) {
    return 'Password must be at least 8 characters.'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Check your connection and try again.'
  }

  return GENERIC
}
