import { useNavigate } from 'react-router-dom'
import { displayInitials } from '../../lib/roleAccess'
import { tutorStudentPath } from '../../lib/paths'
import { formatWhen, statusDot, statusLabel, type TutorStudent } from '../../lib/tutorStudents'

export default function StudentCard({
  student,
  onPrepare,
}: {
  student: TutorStudent
  onPrepare: () => void
}) {
  const navigate = useNavigate()
  const course = student.courses[0]
  const skills = student.skills.slice(0, 2)

  return (
    <article className="ts-card glass rounded-2xl p-5 flex flex-col">
      <div className="flex gap-3 mb-3">
        <div className="ts-avatar w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center text-white font-black flex-shrink-0">
          {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" /> : displayInitials(student.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-ink truncate" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {student.name}
            </h3>
            {student.demo ? <span className="badge text-[10px]">Demo</span> : null}
          </div>
          <div className="text-xs text-muted truncate">{student.headline || 'Learner'}</div>
          <div className="text-xs mt-1">
            {statusDot(student.status)} {statusLabel(student.status)}
          </div>
        </div>
      </div>
      {course && (
        <div className="mb-3">
          <div className="text-[11px] text-muted">Course</div>
          <div className="text-sm font-semibold text-ink">{course.title}</div>
          <div className="flex justify-between text-xs text-muted mt-2 mb-1">
            <span>Progress</span>
            <span className="font-bold text-ink">{student.overallProgress}%</span>
          </div>
          <div className="ts-progress" aria-hidden>
            <span style={{ width: `${student.overallProgress}%` }} />
          </div>
        </div>
      )}
      {student.currentFocus && (
        <div className="text-xs text-muted mb-2">
          Current focus: <span className="font-semibold text-ink">{student.currentFocus}</span>
        </div>
      )}
      {skills.length > 0 && (
        <div className="space-y-1 mb-3">
          {skills.map(sk => (
            <div key={sk.name} className="text-xs text-muted flex justify-between gap-2">
              <span>{sk.name}</span>
              <span className="font-semibold text-ink">{sk.score != null ? `${sk.score}%` : 'In course'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-muted mb-4">
        Next session: {student.nextSession ? formatWhen(student.nextSession.when) : 'None upcoming'}
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-sm py-2 flex-1" onClick={() => navigate(tutorStudentPath(student.id))}>
          View Student →
        </button>
        <button type="button" className="btn-glass text-sm py-2" onClick={onPrepare}>
          Prepare Session
        </button>
      </div>
    </article>
  )
}
