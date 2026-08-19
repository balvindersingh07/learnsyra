import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getTutorListings, type TutorListing } from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import {
  buildTutorCatalog,
  firstName,
  formatHourly,
  formatStudentsPlus,
  getTutorById,
  loadTutorWishlist,
  saveTutorWishlist,
} from '../lib/tutorMarketplace'
import TutorAvatar from '../components/tutors/TutorAvatar'
import { tutorBookPath } from '../lib/paths'
import './tutor-market.css'

export default function TutorProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [rows, setRows] = useState<TutorListing[]>([])
  const [loading, setLoading] = useState(true)
  const [wish, setWish] = useState<Set<string>>(() => new Set(loadTutorWishlist()))
  const [toast, setToast] = useState<string | null>(null)

  const catalog = useMemo(() => buildTutorCatalog(rows), [rows])
  const tutor = id ? getTutorById(catalog, id) : null

  useEffect(() => {
    getTutorListings()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const ping = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  const toggleWish = () => {
    if (!tutor) return
    setWish(prev => {
      const next = new Set(prev)
      if (next.has(tutor.id)) next.delete(tutor.id)
      else next.add(tutor.id)
      saveTutorWishlist([...next])
      return next
    })
    ping(wish.has(tutor.id) ? 'Removed from saved' : 'Tutor saved')
  }

  if (loading && !tutor) return <div className="pt-24 px-6 text-muted">Loading tutor…</div>
  if (!tutor) {
    return (
      <div className="pt-24 px-6 max-w-4xl mx-auto">
        <p className="text-muted mb-4">Tutor not found.</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/tutors')}>
          Back to tutors
        </button>
      </div>
    )
  }

  const first = firstName(tutor.name)
  const wished = wish.has(tutor.id)

  return (
    <div className="pt-20 px-6 pb-28 max-w-5xl mx-auto overflow-x-hidden">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-2 text-sm font-semibold text-ink">
          {toast}
        </div>
      )}
      <button
        type="button"
        className="text-sm text-muted cursor-pointer mb-4"
        style={{ background: 'none', border: 'none', padding: 0 }}
        onClick={() => navigate('/tutors')}
      >
        ← All tutors
      </button>

      <section className="glass rounded-3xl p-6 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row gap-5">
          <div className="relative w-fit">
            <TutorAvatar name={tutor.name} src={tutor.avatarUrl} size={96} />
            {tutor.availability.today && <span className="absolute bottom-1 right-1 tm-avail" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {tutor.name}
            </h1>
            {tutor.demo && <div className="badge badge-amber mb-2">Demo Tutor — Not Production Data</div>}
            <p className="text-muted mb-3">{tutor.title}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mb-3">
              {tutor.reviewCount > 0 ? (
                <span className="font-semibold text-ink">⭐ {tutor.rating.toFixed(1)}</span>
              ) : (
                <span>No rating yet</span>
              )}
              {tutor.students > 0 ? <span>{formatStudentsPlus(tutor.students)}</span> : <span>No student data yet.</span>}
              {tutor.experienceYears > 0 ? <span>{tutor.experienceYears} years experience</span> : null}
              {tutor.hourlyRate > 0 ? <span className="font-bold text-ink">{formatHourly(tutor.hourlyRate)}</span> : null}
            </div>
            <div className="text-sm text-muted flex items-center gap-2 mb-4">
              {tutor.availability.today && <span className="tm-avail" />}
              {tutor.availability.today ? 'Available Today' : tutor.availability.thisWeek ? 'Available this week' : 'Availability not listed'}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => navigate(tutorBookPath(tutor.id))}>
                Book a Session →
              </button>
              <button
                type="button"
                className="btn-glass"
                onClick={() => {
                  setPendingAiPrompt(`Help me prepare a message and session goals for ${tutor.name} (${tutor.expertise.join(', ')}).`)
                  navigate('/ai-learning')
                }}
              >
                Message Tutor
              </button>
              <button type="button" className="btn-glass" aria-pressed={wished} onClick={toggleWish}>
                {wished ? '♥ Saved' : '♡ Save Tutor'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_18rem] gap-6">
        <div>
          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-bold text-ink mb-3">Expertise</h2>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...tutor.expertise, ...tutor.skills])).map(s => (
                <span key={s} className="badge badge-primary">
                  {s}
                </span>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-bold text-ink mb-3">About {first}</h2>
            <p className="text-sm text-muted leading-relaxed mb-3">{tutor.bio}</p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted">Experience</span><div className="font-semibold text-ink">{tutor.experienceYears > 0 ? `${tutor.experienceYears} years` : 'Not listed'}</div></div>
              <div><span className="text-muted">Teaching style</span><div className="font-semibold text-ink">{tutor.teachingStyle.map(s => s.label).join(', ') || '—'}</div></div>
              {tutor.industries.length > 0 && (
                <div><span className="text-muted">Industries</span><div className="font-semibold text-ink">{tutor.industries.join(', ')}</div></div>
              )}
              <div><span className="text-muted">Languages</span><div className="font-semibold text-ink">{tutor.languages.join(', ') || '—'}</div></div>
            </div>
          </section>

          {tutor.teachingStyle.length > 0 && (
          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-bold text-ink mb-3">How {first} Teaches</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {tutor.teachingStyle.map(s => (
                <div key={s.label} className="glass rounded-xl p-4">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-sm font-semibold text-ink">{s.label}</div>
                </div>
              ))}
            </div>
          </section>
          )}

          {tutor.aiMatch > 0 && (
          <section className="glass rounded-2xl p-5 mb-5" style={{ borderColor: 'rgba(108,92,231,0.2)' }}>
            <h2 className="text-lg font-bold text-ink mb-2">✨ Why {first} Is a Good Match For You</h2>
            <div className="text-sm font-bold text-primary mb-3">{tutor.aiMatch}% Match</div>
            <ul className="text-sm text-ink space-y-1">
              {tutor.matchReasons.map(r => (
                <li key={r}>✓ {r}</li>
              ))}
            </ul>
          </section>
          )}

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-bold text-ink mb-3">Courses {first} Teaches</h2>
            {tutor.courses.length > 0 ? (
            <ul className="space-y-2 mb-5">
              {tutor.courses.map(c => (
                <li key={c.title} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">{c.title}</span>
                  <button type="button" className="btn-glass text-xs py-1.5" onClick={() => navigate(c.href)}>
                    View Course
                  </button>
                </li>
              ))}
            </ul>
            ) : (
              <p className="text-sm text-muted mb-5">No courses listed yet.</p>
            )}
            {tutor.projects.length > 0 && (
              <>
                <h2 className="text-lg font-bold text-ink mb-3">Projects {first === 'Sarah' ? 'She' : 'They'} Can Help With</h2>
                <ul className="space-y-2">
                  {tutor.projects.map(p => (
                    <li key={p.title} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink">{p.title}</span>
                      <button type="button" className="btn-glass text-xs py-1.5" onClick={() => navigate(p.href)}>
                        View Project
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-bold text-ink mb-2">⭐ Student Reviews</h2>
            {tutor.reviews.length > 0 ? (
              <>
            {tutor.demo && <div className="badge badge-amber mb-3">Demo Tutor — Not Production Data</div>}
            <div className="text-sm text-muted mb-4">
              Average: <span className="font-bold text-ink">{tutor.rating.toFixed(1)} / 5</span> · {tutor.reviewCount} reviews
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {tutor.reviews.map(r => (
                <div key={r.name} className="glass rounded-xl p-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-ink">{r.name}</span>
                    <span>⭐ {r.rating}</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed mb-1">{r.body}</p>
                  <div className="text-[11px] text-subtle">{r.context}</div>
                </div>
              ))}
            </div>
              </>
            ) : (
              <p className="text-sm text-muted">No reviews yet.</p>
            )}
          </section>
        </div>

        <aside>
          <div className="glass rounded-2xl p-5 sticky top-24">
            <h2 className="text-lg font-bold text-ink mb-3">📅 Availability</h2>
            {tutor.availability.weekly.length === 0 ? (
              <p className="text-sm text-muted mb-4">Availability not listed.</p>
            ) : (
            <ul className="text-sm space-y-2 mb-4">
              {tutor.availability.weekly.map(w => (
                <li key={w.day} className="flex justify-between gap-2">
                  <span className="text-muted">{w.day}</span>
                  <span className="text-ink font-medium text-right">{w.hours}</span>
                </li>
              ))}
            </ul>
            )}
            <button type="button" className="btn-primary w-full" onClick={() => navigate(tutorBookPath(tutor.id))}>
              Book a Session →
            </button>
          </div>
        </aside>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 tm-sticky z-30" style={{ background: 'rgba(255,255,255,0.92)' }}>
        <button type="button" className="btn-primary w-full" onClick={() => navigate(tutorBookPath(tutor.id))}>
          Book Session →
        </button>
      </div>
    </div>
  )
}
