import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNav } from '../lib/useNav'

export default function AskLearnSyra() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  const nav = useNav()
  const hide =
    !session ||
    loading ||
    !profile ||
    profile.role === 'tutor' ||
    profile.role === 'admin' ||
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/ai-learning'
    || location.pathname.startsWith('/tutor')

  if (hide) return null

  return (
    <div className="fixed bottom-5 right-5 z-40 pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        aria-label="Open AI Tutor chat"
        onClick={() => nav('ai-learning')}
        className="btn-primary ask-fab text-sm px-4 py-2.5"
      >
        ✨ Ask LearnSyra
      </button>
    </div>
  )
}
