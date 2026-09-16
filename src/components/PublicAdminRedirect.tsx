import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { adminSubdomainUrl } from '../lib/adminSubdomain'

/** Sends public-site /admin traffic to the admin subdomain, preserving the path. */
export default function PublicAdminRedirect() {
  const location = useLocation()

  useEffect(() => {
    const target = adminSubdomainUrl(`${location.pathname}${location.search}${location.hash}`)
    window.location.replace(target)
  }, [location.pathname, location.search, location.hash])

  return (
    <div className="min-h-screen flex items-center justify-center mesh-bg">
      <div className="glass rounded-2xl px-6 py-4 text-muted">Redirecting to admin workspace…</div>
    </div>
  )
}
