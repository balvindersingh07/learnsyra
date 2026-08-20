import { Fragment } from 'react'
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { TUTOR_HOME } from '../lib/roleAccess'

/** Sends logged-in tutors away from student-facing surfaces. */
export default function TutorBounce({ to = TUTOR_HOME, children }: { to?: string; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (session && (loading || !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading your workspace...</div>
      </div>
    )
  }
  if (profile?.role === 'tutor') return <Navigate to={to} replace />
  return <Fragment key={session?.user.id ?? 'anon'}>{children}</Fragment>
}
