import { useState } from 'react'
import type { CatalogTutor } from '../../lib/tutorMarketplace'
import { formatHourly, formatStudentsPlus } from '../../lib/tutorMarketplace'
import TutorAvatar from './TutorAvatar'

export default function TutorCard({
  tutor,
  wished,
  showMatch = false,
  onProfile,
  onBook,
  onWish,
}: {
  tutor: CatalogTutor
  wished: boolean
  showMatch?: boolean
  onProfile: () => void
  onBook: () => void
  onWish: () => void
}) {
  const [why, setWhy] = useState(false)
  const visible = tutor.badges.filter(b =>
    ['AI Recommended', 'Top Rated', 'Project Expert', 'Career Mentor', 'Project Specialist'].includes(b),
  )

  return (
    <article className="tutor-card glass rounded-2xl p-5 card-hover flex flex-col">
      <div className="flex gap-4 mb-3">
        <div className="relative flex-shrink-0">
          <TutorAvatar name={tutor.name} src={tutor.avatarUrl} />
          {tutor.availability.today && (
            <span className="absolute -bottom-0.5 -right-0.5 tm-avail" aria-label="Available today" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-ink truncate" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {tutor.name}
            </h3>
            <button
              type="button"
              aria-label={wished ? `Remove ${tutor.name} from saved tutors` : `Save ${tutor.name}`}
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
          <div className="text-xs text-muted mb-1">{tutor.expertise.join(' · ')}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {tutor.demo && <span className="badge badge-amber">Demo Tutor — Not Production Data</span>}
            {tutor.fromTutorHub && tutor.reviewCount === 0 ? (
              <span>New tutor</span>
            ) : tutor.rating > 0 ? (
              <span className="font-semibold text-ink">⭐ {tutor.rating.toFixed(1)}</span>
            ) : (
              <span>—</span>
            )}
            {tutor.students > 0 ? <span>{formatStudentsPlus(tutor.students)}</span> : tutor.fromTutorHub ? null : tutor.demo ? null : <span>No student data yet.</span>}
            {tutor.experienceYears > 0 ? <span>{tutor.experienceYears} years</span> : null}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted leading-relaxed mb-3">{tutor.intro}</p>
      <div className="flex flex-wrap gap-1 mb-3">
        {visible.slice(0, 3).map(b => (
          <span key={b} className="badge badge-primary">
            {b}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {formatHourly(tutor.hourlyRate)}
        </span>
        <span className="text-xs text-muted flex items-center gap-1.5">
          {tutor.availability.today && <span className="tm-avail" />}
          {tutor.availability.today ? 'Available Today' : tutor.availability.thisWeek ? 'Available this week' : 'Schedule on request'}
        </span>
      </div>
      {showMatch && tutor.aiMatch > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold text-primary">{tutor.aiMatch}% Match</div>
          <button
            type="button"
            className="text-xs font-semibold text-primary cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0 }}
            onClick={() => setWhy(v => !v)}
            aria-expanded={why}
          >
            Why this tutor? {why ? '▴' : '▾'}
          </button>
          {why && <p className="text-xs text-muted mt-1 leading-relaxed">&ldquo;{tutor.aiMatchReason}&rdquo;</p>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-sm py-2 flex-1" onClick={onBook}>
          Book Session →
        </button>
        <button type="button" className="btn-glass text-sm py-2" onClick={onProfile}>
          View Profile →
        </button>
      </div>
    </article>
  )
}
