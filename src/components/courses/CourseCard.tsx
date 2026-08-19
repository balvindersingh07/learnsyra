import { useState } from 'react'
import { categoryStyle } from '../../lib/api'
import {
  formatInr,
  formatStudents,
  type CatalogCourse,
} from '../../lib/courseCatalog'

export default function CourseCard({
  course,
  wished,
  comparing,
  onOpen,
  onWish,
  onToggleCompare,
}: {
  course: CatalogCourse
  wished: boolean
  comparing: boolean
  onOpen: () => void
  onWish: () => void
  onToggleCompare: () => void
}) {
  const [why, setWhy] = useState(false)
  const { icon, color } = categoryStyle(
    course.category === 'AI & Machine Learning' ? 'AI & ML' : course.category,
  )
  const visibleBadges = course.badges.filter(b =>
    ['AI Recommended', 'Bestseller', 'New', 'Free', 'Premium'].includes(b),
  )

  return (
    <article className="course-card glass rounded-2xl overflow-hidden card-hover flex flex-col">
      <button type="button" className="text-left cursor-pointer" onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0 }}>
        <div
          className="h-36 flex items-center justify-center text-5xl relative thumb-3d course-thumb"
          style={{ background: `linear-gradient(135deg, ${color}22, ${color}10)` }}
        >
          {course.thumbnail ? (
            <img src={course.thumbnail} alt="" className="thumb-inner w-full h-full object-cover" />
          ) : (
            <div className="thumb-inner flex items-center justify-center w-full h-full text-5xl">{icon}</div>
          )}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1 max-w-[75%]">
            {visibleBadges.slice(0, 2).map(b => (
              <span key={b} className={`badge ${b === 'Free' ? 'badge-green' : b === 'New' || b === 'Premium' ? 'badge-amber' : 'badge-primary'}`}>
                {b}
              </span>
            ))}
          </div>
        </div>
      </button>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="text-sm font-bold text-ink leading-snug"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
          >
            {course.title}
          </h3>
          <button
            type="button"
            aria-label={wished ? `Remove ${course.title} from wishlist` : `Add ${course.title} to wishlist`}
            aria-pressed={wished}
            onClick={onWish}
            className={`w-8 h-8 rounded-lg flex-shrink-0 cursor-pointer ${wished ? 'wish-pop' : ''}`}
            style={{
              background: wished ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(99,102,241,0.12)',
              color: wished ? '#E11D48' : '#667085',
            }}
          >
            {wished ? '♥' : '♡'}
          </button>
        </div>
        <div className="text-xs text-muted mb-2">{course.instructor}</div>
        {course.demo && <div className="badge badge-amber mb-2">Demo Course — Not Production Data</div>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted mb-2">
          <span className="font-semibold text-ink">{course.rating > 0 ? `⭐ ${course.rating}` : '—'}</span>
          <span>{formatStudents(course.students)}</span>
          {course.durationHours > 0 && <span>{course.durationHours} hours</span>}
          <span>{course.level}</span>
        </div>
        <div className="text-xs text-muted mb-3 leading-relaxed">
          {course.skills.slice(0, 4).join(' · ')}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted mb-3">
          {course.aiSupport && <span>🤖 AI Tutor</span>}
          {course.tutorSupport && <span>👨‍🏫 Tutor Support</span>}
          {course.projects && <span>💻 Projects</span>}
        </div>
        {course.aiRecommended && course.aiReason && (
          <div className="mb-3">
            <button
              type="button"
              className="text-xs font-semibold text-primary cursor-pointer"
              style={{ background: 'none', border: 'none', padding: 0 }}
              onClick={() => setWhy(v => !v)}
              aria-expanded={why}
            >
              Why LearnSyra recommends this {why ? '▴' : '▾'}
            </button>
            {why && (
              <p className="text-xs text-muted leading-relaxed mt-1">"{course.aiReason}"</p>
            )}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            {course.price === 0 ? (
              <span className="text-lg font-black text-success" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Free</span>
            ) : (
              <div>
                <span className="text-lg font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                  {formatInr(course.price)}
                </span>
                {course.originalPrice && (
                  <span className="text-xs text-subtle line-through ml-1.5">{formatInr(course.originalPrice)}</span>
                )}
              </div>
            )}
          </div>
          <button type="button" className="btn-primary text-xs py-2 px-3" onClick={onOpen}>
            View Course →
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={comparing}
            onChange={onToggleCompare}
            className="accent-indigo-500"
          />
          Compare
        </label>
      </div>
    </article>
  )
}
