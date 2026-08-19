import { useNavigate } from 'react-router-dom'
import { categoryStyle } from '../../lib/api'
import { formatInr } from '../../lib/courseCatalog'
import { tutorCoursePreviewPath } from '../../lib/paths'
import {
  formatUpdated,
  lessonCount,
  statusLabel,
  type StudioCourse,
} from '../../lib/tutorCourses'

export default function StudioCourseCard({
  course,
  students,
  rating,
  onEdit,
  onDuplicate,
  onPause,
  onArchive,
  onDelete,
}: {
  course: StudioCourse
  students: number | null
  rating: number | null
  onEdit: () => void
  onDuplicate: () => void
  onPause: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const style = categoryStyle(course.category === 'AI & Machine Learning' ? 'AI & ML' : course.category)
  const published = course.status === 'published'

  return (
    <article className="tc-card glass rounded-2xl p-4 flex flex-col">
      <div className="tc-thumb mb-3">
        {course.thumbnail ? <img src={course.thumbnail} alt="" /> : <div className="w-full h-full flex items-center justify-center text-4xl text-white">{style.icon}</div>}
      </div>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {course.title || 'Untitled course'}
        </h3>
        {course.demo && <span className="badge text-[10px]">Sample</span>}
      </div>
      <div className="text-xs text-muted mb-2">
        {course.category} · {course.level} · {statusLabel(course.status)}
      </div>
      <div className="text-xs text-muted mb-3 space-y-0.5">
        <div>{students != null && students > 0 ? `${students} students` : 'No student data yet'}</div>
        <div>{rating != null && rating > 0 ? `⭐ ${rating.toFixed(1)}` : 'No reviews yet'}</div>
        <div>Completion: no student data yet</div>
        <div>{course.pricing.mode === 'paid' ? formatInr(course.pricing.priceInr) : 'Free'}</div>
        <div>Updated {formatUpdated(course.updatedAt)} · {lessonCount(course)} lessons</div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {published ? (
          <button type="button" className="btn-primary text-xs" onClick={onEdit}>
            Manage Course
          </button>
        ) : (
          <button type="button" className="btn-primary text-xs" onClick={onEdit}>
            Continue Editing
          </button>
        )}
        <button type="button" className="btn-glass text-xs" onClick={onEdit}>
          Edit Course
        </button>
        <button type="button" className="btn-glass text-xs" onClick={() => navigate(tutorCoursePreviewPath(course.id))}>
          Preview
        </button>
        <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/tutor/courses/${course.id}?step=9`)}>
          Analytics
        </button>
        <button type="button" className="btn-glass text-xs" onClick={onDuplicate}>
          Duplicate
        </button>
        {published && (
          <button type="button" className="btn-glass text-xs" onClick={onPause}>
            Pause
          </button>
        )}
        {course.status !== 'archived' && course.status !== 'draft' && (
          <button type="button" className="btn-glass text-xs" onClick={onArchive}>
            Archive
          </button>
        )}
        {course.status === 'draft' && !course.demo && (
          <button type="button" className="btn-glass text-xs" onClick={onDelete}>
            Delete Draft
          </button>
        )}
      </div>
    </article>
  )
}
