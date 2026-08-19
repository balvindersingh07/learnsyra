import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { roleHome } from '../lib/roleAccess'
import type { UserRole } from '../lib/supabase'

interface Props {
  children: ReactNode
  /** If set, only these roles may view the route. */
  roles?: UserRole[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading || (session && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading your workspace...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" state={{ from: location.pathname }} replace />
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to={roleHome(profile.role)} replace />
  }

  return <>{children}</>
}
