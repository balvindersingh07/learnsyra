export const MIN_PASSWORD_LENGTH = 8

/** Production auth redirects use learnsyra.com; local dev uses the current origin. */
export function authSiteOrigin(): string {
  if (import.meta.env.PROD) return 'https://learnsyra.com'
  return window.location.origin
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validateEmail(email: string): string | null {
  const value = normalizeEmail(email)
  if (!value) return 'Email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
  const passwordErr = validatePassword(password)
  if (passwordErr) return passwordErr
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

export function validateFullName(name: string): string | null {
  const value = name.trim()
  if (value.length < 2) return 'Enter your full name (at least 2 characters).'
  if (value.length > 80) return 'Name is too long.'
  return null
}

export function validateSignupInput(email: string, password: string, fullName: string): string | null {
  return validateFullName(fullName) ?? validateEmail(email) ?? validatePassword(password)
}
