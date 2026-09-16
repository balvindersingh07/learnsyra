export type AppMode = 'public' | 'admin'

/** Resolved at build time from VITE_APP_MODE. Defaults to public when unset. */
export function getAppMode(): AppMode {
  return import.meta.env.VITE_APP_MODE === 'admin' ? 'admin' : 'public'
}

export function isPublicApp(): boolean {
  return getAppMode() === 'public'
}

export function isAdminApp(): boolean {
  return getAppMode() === 'admin'
}
