import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleHome } from '../lib/roleAccess'

export default function NotFound() {
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const workspace = profile ? roleHome(profile.role) : '/home'

  return (
    <div className="pt-24 px-6 pb-16 max-w-lg mx-auto">
      <section className="glass rounded-3xl p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">404</p>
        <h1 className="text-2xl font-black text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Not Found</h1>
        <p className="text-sm text-muted mb-6">This page does not exist. The URL may be mistyped or the resource may have been moved.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary text-sm" onClick={() => navigate('/home')}>Go Home</button>
          {session && profile && (
            <button type="button" className="btn-glass text-sm" onClick={() => navigate(workspace)}>Go to Workspace</button>
          )}
        </div>
      </section>
    </div>
  )
}
