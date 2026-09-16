/** Production admin host — DNS/Vercel configured in a later step. */
export const ADMIN_APP_ORIGIN = 'https://admin.learnsyra.com'

export function adminSubdomainUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${ADMIN_APP_ORIGIN}${normalized}`
}

export function redirectToAdminSubdomain(path = '/') {
  window.location.replace(adminSubdomainUrl(path))
}
