import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { displayInitials } from '../../lib/roleAccess'
import { tutorSessionPath, tutorStudentPath } from '../../lib/paths'
import {
  formatWhen,
  joinableNow,
  startsInLabel,
  statusDot,
  statusLabel,
  type TutorSessionView,
} from '../../lib/tutorSessions'

export default function SessionCard({
  session,
  onPrepare,
  compact,
}: {
  session: TutorSessionView
  onPrepare: () => void
  compact?: boolean
}) {
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const canJoin = joinableNow(session)
  const wait = startsInLabel(session.scheduledAt)
  void now

  return (
    <article className="tx-card glass rounded-2xl p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}>
          {session.studentAvatar ? <img src={session.studentAvatar} alt="" className="w-full h-full object-cover rounded-2xl" /> : displayInitials(session.studentName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {session.topic}
            </h3>
            {session.demo ? <span className="badge text-[10px]">Demo</span> : null}
          </div>
          <div className="text-sm text-muted">{session.studentName}</div>
          <div className="text-xs text-muted mt-1">
            {formatWhen(session.scheduledAt)}
            {session.duration ? ` · ${session.duration} min` : ''} · {session.kindLabel}
          </div>
        </div>
      </div>
      <div className="text-xs mb-3">
        {statusDot(session.status)} {statusLabel(session.status)}
      </div>
      {!compact && (
        <>
          {session.courseTitle && <div className="text-xs text-muted mb-1">Course: {session.courseTitle}</div>}
          {session.lessonTitle && <div className="text-xs text-muted mb-1">Current lesson: {session.lessonTitle}</div>}
          {session.projectTitle && <div className="text-xs text-muted mb-1">Project: {session.projectTitle}</div>}
          {session.studentProgress != null && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>Student progress</span>
                <span className="font-semibold text-ink">{session.studentProgress}%</span>
              </div>
              <div className="tx-progress">
                <span style={{ width: `${session.studentProgress}%` }} />
              </div>
            </div>
          )}
          {session.aiSummary && (
            <div className="glass rounded-xl p-3 mb-3">
              <div className="text-[11px] font-semibold text-primary mb-1">AI Brief</div>
              <p className="text-xs text-ink">{session.aiSummary}</p>
              {session.aiFocus.length > 0 && (
                <>
                  <div className="text-[11px] font-semibold text-muted mt-2 mb-1">Recommended focus</div>
                  <ul className="text-xs text-muted list-disc pl-4">
                    {session.aiFocus.map(f => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
      {!canJoin && wait && session.status !== 'completed' && session.status !== 'cancelled' && (
        <p className="text-xs text-muted mb-2">{wait}</p>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" className="btn-glass text-xs" onClick={onPrepare}>
          Prepare With AI
        </button>
        {session.studentId && (
          <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorStudentPath(session.studentId!))}>
            View Student
          </button>
        )}
        <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorSessionPath(session.id))}>
          View Session
        </button>
        {session.status !== 'completed' && session.status !== 'cancelled' && (
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={!canJoin}
            aria-disabled={!canJoin}
            onClick={() => canJoin && navigate(canJoin && session.kind !== 'group' ? `${session.joinHref}&join=1` : session.joinHref)}
          >
            {canJoin ? 'Join Session →' : `Join Session`}
          </button>
        )}
      </div>
    </article>
  )
}
