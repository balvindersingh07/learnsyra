import { useNavigate } from 'react-router-dom'
import { displayInitials } from '../../lib/roleAccess'
import { tutorProjectPath, tutorStudentPath } from '../../lib/paths'
import {
  formatSubmitted,
  statusDot,
  statusLabel,
  type TutorProjectReview,
} from '../../lib/tutorProjects'

export default function ReviewCard({
  row,
  aiSummary,
  onAi,
}: {
  row: TutorProjectReview
  aiSummary: string
  onAi: () => void
}) {
  const navigate = useNavigate()
  return (
    <article className="tp-card glass rounded-2xl p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}>
          {row.studentAvatar ? <img src={row.studentAvatar} alt="" className="w-full h-full object-cover rounded-2xl" /> : displayInitials(row.studentName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{row.title}</h3>
            {row.demo && <span className="badge text-[10px]">Demo Project — Not a Real Student Submission</span>}
          </div>
          <div className="text-sm text-muted">{row.studentName}</div>
          {row.courseTitle && <div className="text-xs text-muted">Course: {row.courseTitle}</div>}
        </div>
      </div>
      <div className="text-xs mb-2">{statusDot(row.status)} {statusLabel(row.status)} · {row.difficulty} · Submitted {formatSubmitted(row.submittedAt)}</div>
      {row.progress != null ? (
        <div className="mb-2">
          <div className="flex justify-between text-xs text-muted mb-1"><span>Progress</span><span>{row.progress}%</span></div>
          <div className="tp-progress"><span style={{ width: `${row.progress}%` }} /></div>
        </div>
      ) : (
        <div className="text-xs text-muted mb-2">No progress data yet</div>
      )}
      <div className="flex flex-wrap gap-1 mb-3">
        {row.skills.slice(0, 4).map(s => (
          <span key={s} className="badge text-[10px]">{s}</span>
        ))}
      </div>
      <p className="text-xs text-ink mb-3"><span className="font-semibold text-primary">AI Pre-Review:</span> {aiSummary}</p>
      {row.priorityReason && <p className="text-xs text-muted mb-3">{row.priorityReason}</p>}
      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-xs" onClick={() => navigate(tutorProjectPath(row.id))}>Review Submission</button>
        <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorStudentPath(row.studentId))}>View Student</button>
        <button type="button" className="btn-glass text-xs" onClick={onAi}>AI Pre-Review</button>
      </div>
    </article>
  )
}
