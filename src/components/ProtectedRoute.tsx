import { Fragment } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { isAdminApp } from '../lib/appMode'
import { authAdminLoginPath } from '../lib/authFlow'
import { roleHome } from '../lib/roleAccess'
import type { UserRole } from '../lib/supabase'

interface Props {
  children: ReactNode
  /** If set, only these roles may view the route. */
  roles?: UserRole[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { session, profile, loading, isEmailVerified } = useAuth()
  const location = useLocation()
  const requireVerifiedEmail = import.meta.env.PROD

  if (loading || (session && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading your workspace...</div>
      </div>
    )
  }

  if (!session) {
    const loginPath = isAdminApp() ? authAdminLoginPath() : '/'
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />
  }

  if (requireVerifiedEmail && !isEmailVerified) {
    return <Navigate to="/verify-email" state={{ from: location.pathname }} replace />
  }

  if (roles && profile && !roles.includes(profile.role)) {
    if (isAdminApp()) {
      return (
        <Navigate
          to={authAdminLoginPath()}
          state={{ from: location.pathname, notice: 'Admin access required.' }}
          replace
        />
      )
    }
    return <Navigate to={roleHome(profile.role)} replace />
  }

  return <Fragment key={session.user.id}>{children}</Fragment>
}
