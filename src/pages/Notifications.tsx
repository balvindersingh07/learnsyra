import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markNotificationsRead, type NotificationRow } from '../lib/api'

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function Notifications() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNotifications()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
    markNotificationsRead()
  }, [])

  return (
    <div className="pt-20 px-6 pb-16 max-w-3xl mx-auto">
      <h1
        className="text-4xl font-black text-ink mb-2"
        style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
      >
        Notifications
      </h1>
      <p className="text-muted mb-8">Enrollments, bookings, projects, and certificates land here.</p>

      {loading && <div className="glass rounded-2xl p-8 text-center text-muted">Loading…</div>}
      {!loading && rows.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-muted">
          No notifications yet. Enroll in a course or book a tutor to get started.
        </div>
      )}
      <div className="space-y-3">
        {rows.map(n => (
          <button
            key={n.id}
            onClick={() => n.href && navigate(n.href)}
            className="glass rounded-2xl p-4 w-full text-left cursor-pointer"
            style={{ opacity: n.read ? 0.75 : 1 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                  {n.title}
                </div>
                {n.body && <div className="text-sm text-muted mt-1">{n.body}</div>}
              </div>
              <span className="text-xs text-muted flex-shrink-0">{timeAgo(n.created_at)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
