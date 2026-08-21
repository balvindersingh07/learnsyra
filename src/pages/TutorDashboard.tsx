import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { categoryStyle, createCourse, createLiveClass, getTutorLiveClasses, getTutorReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents, reviewProject, setBookingStatus, setCoursePublished, setLiveClassStatus, setLiveRecording, type BookingRow, type CourseRow, type LiveClass, type ProfileLite, type ProjectRow, type StudentProjectRow } from '../lib/api'
import { liveClassPath } from '../lib/paths'
import { tutorPathForTab, tutorTabFromPath } from '../lib/roleAccess'

export default function TutorDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [tab, setTab] = useState(() => tutorTabFromPath(location.pathname))
  const [courses, setCourses] = useState<(CourseRow & { students: number })[]>([])
  const [students, setStudents] = useState<{ progress: number; enrolled_at: string; student: ProfileLite | null; course: { id: string; title: string } | null }[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [reviews, setReviews] = useState<(StudentProjectRow & { project: ProjectRow | null; student: ProfileLite | null })[]>([])
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Programming')
  const [level, setLevel] = useState('Beginner')
  const [price, setPrice] = useState('0')
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [liveTitle, setLiveTitle] = useState('')
  const [liveDesc, setLiveDesc] = useState('')
  const [liveCourse, setLiveCourse] = useState('')
  const [liveWhen, setLiveWhen] = useState('')
  const [liveMeet, setLiveMeet] = useState('')
  const [recordings, setRecordings] = useState<Record<string, string>>({})

  const load = async () => {
    try {
      const [c, s, b, r, live] = await Promise.all([getTutorCourses(), getTutorStudents(), getTutorBookings(), getTutorReviewQueue(), getTutorLiveClasses()])
      setCourses(c)
      setStudents(s)
      setBookings(b)
      setReviews(r)
      setLiveClasses(live.filter(row => !profile?.id || row.tutor_id === profile.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tutor data')
    }
  }

  useEffect(() => {
    setTab(tutorTabFromPath(location.pathname))
  }, [location.pathname])

  useEffect(() => {
    load()
  }, [profile?.id])

  const pending = bookings.filter(b => b.status === 'pending')
  const studentCount = students.length
  const avgRating = courses.length
    ? (courses.reduce((s, c) => s + Number(c.rating), 0) / courses.length).toFixed(2)
    : '—'

  const saveCourse = async () => {
    if (!title.trim()) return
    setBusy(true)
    const { error: err } = await createCourse({
      title: title.trim(),
      description,
      category,
      level,
      price_cents: Math.round(Number(price) * 100) || 0,
    })
    setBusy(false)
    if (err) setError(err)
    else {
      setShowCreate(false)
      setTitle('')
      setDescription('')
      await load()
      setTab('courses')
      navigate('/tutor/courses')
    }
  }

  return (
    <div className="pt-20 px-6 pb-16 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            {profile?.full_name || 'Tutor'}
          </h1>
          <div className="text-muted text-sm">{profile?.headline || 'Tutor dashboard'}</div>
        </div>
        <button className="btn-primary px-5 py-2.5" onClick={() => setShowCreate(true)}>+ Create New Course</button>
      </div>

      {error && <div className="glass rounded-2xl p-4 mb-4 text-rose-500 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: '👥', label: 'Students', value: String(studentCount), color: '#6C5CE7' },
          { icon: '📚', label: 'Courses', value: String(courses.length), color: '#22C7D6' },
          { icon: '📅', label: 'Pending sessions', value: String(pending.length), color: '#f59e0b' },
          { icon: '⭐', label: 'Avg rating', value: String(avgRating), color: '#20C997' },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-5">
            <div className="text-xs text-muted mb-2">{s.icon} {s.label}</div>
            <div className="text-3xl font-black" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['overview', 'students', 'courses', 'live', 'sessions', 'reviews'].map(t => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              const next = tutorPathForTab(t)
              if (location.pathname !== next) navigate(next)
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer capitalize"
            style={{
              fontFamily: 'Plus Jakarta Sans,sans-serif',
              background: tab === t ? 'rgba(108,92,231,0.2)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${tab === t ? 'rgba(108,92,231,0.4)' : 'rgba(99,102,241,0.12)'}`,
              color: tab === t ? '#6C5CE7' : '#667085',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="glass rounded-2xl p-6 mb-6">
          <h3 className="text-base font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>New course</h3>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full mb-3 px-3 py-2 rounded-xl text-sm" style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }} />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" rows={3} className="w-full mb-3 px-3 py-2 rounded-xl text-sm" style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }} />
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 rounded-xl text-sm" style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}>
              {['Programming', 'AI & ML', 'Data Analytics', 'Business', 'English', 'Finance', 'Career Skills'].map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={level} onChange={e => setLevel(e.target.value)} className="px-3 py-2 rounded-xl text-sm" style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}>
              {['Beginner', 'Intermediate', 'Advanced'].map(c => <option key={c}>{c}</option>)}
            </select>
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Price USD (0 = free)" className="px-3 py-2 rounded-xl text-sm" style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }} />
          </div>
          <div className="flex gap-2">
            <button className="btn-glass text-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn-primary text-sm" disabled={busy} onClick={saveCourse}>{busy ? '…' : 'Create (pending admin publish)'}</button>
          </div>
        </div>
      )}

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Incoming sessions</h3>
            {pending.length === 0 && <p className="text-sm text-muted">No pending bookings.</p>}
            {pending.slice(0, 5).map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-ink">{b.student?.full_name ?? 'Student'}</div>
                  <div className="text-xs text-muted">{b.message || b.listing?.expertise}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs px-3 py-1.5" onClick={async () => { await setBookingStatus(b.id, 'confirmed', b.student_id); load() }}>Accept</button>
                  <button className="btn-glass text-xs px-3 py-1.5" onClick={async () => { await setBookingStatus(b.id, 'cancelled', b.student_id); load() }}>Decline</button>
                </div>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-6">
            <h3 className="text-sm font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Submitted projects</h3>
            {reviews.filter(r => r.status === 'submitted').length === 0 && <p className="text-sm text-muted">Nothing to review.</p>}
            {reviews.filter(r => r.status === 'submitted').slice(0, 5).map(r => (
              <div key={r.id} className="text-sm py-2">
                <span className="font-semibold">{r.student?.full_name}</span> · {r.project?.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'students' && (
        <div className="glass rounded-2xl overflow-hidden">
          {students.length === 0 && <p className="p-6 text-sm text-muted">No enrollments on your courses yet.</p>}
          {students.map((s, i) => (
            <div key={`${s.student?.id}-${s.course?.id}-${i}`} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}>
                {(s.student?.full_name || 'S').charAt(0)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-ink">{s.student?.full_name ?? 'Student'}</div>
                <div className="text-xs text-muted">{s.course?.title}</div>
              </div>
              <div className="text-sm font-bold text-primary">{s.progress}%</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'courses' && (
        <div className="grid md:grid-cols-3 gap-5">
          {courses.map(c => {
            const style = categoryStyle(c.category)
            return (
              <div key={c.id} className="glass rounded-2xl p-5">
                <div className="text-3xl mb-3">{style.icon}</div>
                <h3 className="text-sm font-bold text-ink mb-2">{c.title}</h3>
                <div className="text-xs text-muted mb-3">{c.students} students · {c.published ? 'Live' : 'Draft'}</div>
                <button
                  className="w-full btn-glass text-xs py-2"
                  onClick={async () => { await setCoursePublished(c.id, !c.published); load() }}
                >
                  {c.published ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'live' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-base font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              Start a live class
            </h3>
            <p className="text-sm text-muted mb-4">
              Students join from Live Classes. After you end, paste a YouTube (unlisted) or video link so missed students can watch the recording.
            </p>
            <input
              value={liveTitle}
              onChange={e => setLiveTitle(e.target.value)}
              placeholder="Class title"
              className="w-full mb-3 px-3 py-2 rounded-xl text-sm"
              style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}
            />
            <textarea
              value={liveDesc}
              onChange={e => setLiveDesc(e.target.value)}
              placeholder="What will you cover?"
              rows={2}
              className="w-full mb-3 px-3 py-2 rounded-xl text-sm"
              style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}
            />
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <select
                value={liveCourse}
                onChange={e => setLiveCourse(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}
              >
                <option value="">All students (no course)</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={liveWhen}
                onChange={e => setLiveWhen(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}
              />
            </div>
            <input
              value={liveMeet}
              onChange={e => setLiveMeet(e.target.value)}
              placeholder="Optional Zoom / Meet link (leave blank for built-in classroom)"
              className="w-full mb-4 px-3 py-2 rounded-xl text-sm"
              style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-primary text-sm"
                disabled={busy || !liveTitle.trim()}
                onClick={async () => {
                  setBusy(true)
                  const { error: err, id } = await createLiveClass({
                    title: liveTitle.trim(),
                    description: liveDesc,
                    course_id: liveCourse || null,
                    starts_at: liveWhen ? new Date(liveWhen).toISOString() : new Date().toISOString(),
                    meeting_url: liveMeet,
                    goLive: true,
                  })
                  setBusy(false)
                  if (err) setError(err)
                  else {
                    setLiveTitle('')
                    setLiveDesc('')
                    await load()
                    if (id) navigate(liveClassPath(id))
                  }
                }}
              >
                {busy ? '…' : 'Start live now'}
              </button>
              <button
                className="btn-glass text-sm"
                disabled={busy || !liveTitle.trim() || !liveWhen}
                onClick={async () => {
                  setBusy(true)
                  const { error: err } = await createLiveClass({
                    title: liveTitle.trim(),
                    description: liveDesc,
                    course_id: liveCourse || null,
                    starts_at: new Date(liveWhen).toISOString(),
                    meeting_url: liveMeet,
                    goLive: false,
                  })
                  setBusy(false)
                  if (err) setError(err)
                  else {
                    setLiveTitle('')
                    setLiveDesc('')
                    await load()
                  }
                }}
              >
                Schedule
              </button>
            </div>
          </div>

          {liveClasses.length === 0 && <div className="glass rounded-2xl p-8 text-center text-muted">No live classes yet.</div>}
          {liveClasses.map(c => (
            <div key={c.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-ink">{c.title}</span>
                    <span className={`badge ${c.status === 'live' ? 'badge-green' : c.status === 'scheduled' ? 'badge-amber' : 'badge-primary'}`}>
                      {c.status === 'live' ? '● Live' : c.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {c.course?.title ?? 'Open class'} · {new Date(c.starts_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(c.status === 'scheduled' || c.status === 'ended') && (
                    <button
                      className="btn-primary text-xs px-3 py-1.5"
                      onClick={async () => {
                        await setLiveClassStatus(c.id, 'live', c.course_id, c.title)
                        await load()
                        navigate(liveClassPath(c.id))
                      }}
                    >
                      Go live
                    </button>
                  )}
                  {c.status === 'live' && (
                    <>
                      <button className="btn-primary text-xs px-3 py-1.5" onClick={() => navigate(liveClassPath(c.id))}>
                        Open classroom
                      </button>
                      <button
                        className="btn-glass text-xs px-3 py-1.5"
                        onClick={async () => {
                          await setLiveClassStatus(c.id, 'ended')
                          await load()
                        }}
                      >
                        End class
                      </button>
                    </>
                  )}
                </div>
              </div>
              {c.status !== 'scheduled' && (
                <div>
                  <input
                    value={recordings[c.id] ?? c.recording_url ?? ''}
                    onChange={e => setRecordings(m => ({ ...m, [c.id]: e.target.value }))}
                    placeholder="Recording URL (YouTube unlisted / mp4) for students who missed class"
                    className="w-full mb-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}
                  />
                  <button
                    className="btn-glass text-xs px-3 py-1.5"
                    onClick={async () => {
                      const url = (recordings[c.id] ?? c.recording_url ?? '').trim()
                      const { error: err } = await setLiveRecording(c.id, url)
                      if (err) setError(err)
                      else await load()
                    }}
                  >
                    Save recording
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'sessions' && (
        <div className="space-y-3">
          {bookings.length === 0 && <div className="glass rounded-2xl p-8 text-center text-muted">No bookings yet.</div>}
          {bookings.map(b => (
            <div key={b.id} className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-ink">{b.student?.full_name ?? 'Student'}</div>
                <div className="text-xs text-muted">{b.message || b.listing?.name} · {new Date(b.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-amber capitalize">{b.status}</span>
                {b.status === 'pending' && (
                  <>
                    <button className="btn-primary text-xs px-3 py-1.5" onClick={async () => { await setBookingStatus(b.id, 'confirmed', b.student_id); load() }}>Accept</button>
                    <button className="btn-glass text-xs px-3 py-1.5" onClick={async () => { await setBookingStatus(b.id, 'cancelled', b.student_id); load() }}>Decline</button>
                  </>
                )}
                {b.status === 'confirmed' && (
                  <button className="btn-glass text-xs px-3 py-1.5" onClick={async () => { await setBookingStatus(b.id, 'completed', b.student_id); load() }}>Mark done</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 && <div className="glass rounded-2xl p-8 text-center text-muted">No submitted projects.</div>}
          {reviews.map(r => (
            <div key={r.id} className="glass rounded-2xl p-5">
              <div className="flex justify-between gap-3 mb-2">
                <div>
                  <div className="text-sm font-bold text-ink">{r.project?.title}</div>
                  <div className="text-xs text-muted">{r.student?.full_name} · {r.status}</div>
                </div>
                {r.submission_url && (
                  <a href={r.submission_url} target="_blank" rel="noreferrer" className="text-xs text-primary">Open link</a>
                )}
              </div>
              <textarea
                value={notes[r.id] ?? r.review_note ?? ''}
                onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                placeholder="Feedback for the student"
                className="w-full mb-3 px-3 py-2 rounded-xl text-sm"
                rows={2}
                style={{ background: '#fff', border: '1px solid rgba(99,102,241,0.16)' }}
              />
              {r.status === 'submitted' && (
                <button
                  className="btn-primary text-sm"
                  onClick={async () => {
                    await reviewProject(r.id, r.student_id, notes[r.id] ?? '', true)
                    load()
                  }}
                >
                  Approve as complete
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
