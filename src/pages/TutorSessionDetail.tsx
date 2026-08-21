import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import { getTutorLiveClasses, getTutorReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents, setBookingStatus } from '../lib/api'
import { displayInitials } from '../lib/roleAccess'
import { getLiveRecord, saveLiveRecord } from '../lib/liveSession'
import { tutorStudentPath } from '../lib/paths'
import { loadTutorHub, selfTutorId } from '../lib/tutorProfile'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import { buildTutorRoster, deleteNote, notesForStudent, upsertNote, type TutorNote, type TutorStudent } from '../lib/tutorStudents'
import {
  EMPTY_EXTRAS,
  buildAiBrief,
  buildTutorSessions,
  completeLocalBooking,
  formatWhen,
  joinableNow,
  loadSessionExtras,
  preparePrompt,
  previousSession,
  saveSessionExtras,
  startsInLabel,
  statusDot,
  statusLabel,
  type NextStepKind,
  type ProgressSelect,
  type SessionActionItem,
  type SessionExtras,
  type TutorSessionView,
} from '../lib/tutorSessions'
import './tutor-sessions.css'

export default function TutorSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || null
  const publicId = tutorId ? (loadTutorHub(tutorId)?.publicId || selfTutorId(tutorId)) : ''
  const [view, setView] = useState<TutorSessionView | null>(null)
  const [all, setAll] = useState<TutorSessionView[]>([])
  const [roster, setRoster] = useState<TutorStudent[]>([])
  const [extras, setExtras] = useState<SessionExtras>(EMPTY_EXTRAS)
  const [notes, setNotes] = useState<TutorNote[]>([])
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [actionLabel, setActionLabel] = useState('')
  const [doneOpen, setDoneOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = window.setInterval(() => setTick(n => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [])

  const reload = () => {
    if (!id || !tutorId) return
    Promise.all([getTutorStudents(), getTutorBookings(), getTutorReviewQueue(), getTutorCourses(), getTutorLiveClasses()])
      .then(([enrollments, bookings, reviews, apiCourses, liveClasses]) => {
        const builtRoster = buildTutorRoster({ enrollments, bookings, reviews, localBookings: loadTutorBookings(), apiCourses })
        setRoster(builtRoster.students)
        const built = buildTutorSessions({
          local: loadTutorBookings(),
          api: bookings,
          liveClasses,
          roster: builtRoster.students,
          tutorUserId: tutorId,
          tutorPublicId: publicId,
        })
        setAll(built.sessions)
        setView(built.sessions.find(s => s.id === id) ?? null)
        setExtras(loadSessionExtras(tutorId, id))
      })
      .catch(() => {
        const builtRoster = buildTutorRoster({ enrollments: [], bookings: [], reviews: [], localBookings: [], apiCourses: [] })
        setRoster(builtRoster.students)
        const built = buildTutorSessions({
          local: loadTutorBookings(),
          api: [],
          liveClasses: [],
          roster: builtRoster.students,
          tutorUserId: tutorId,
          tutorPublicId: publicId,
        })
        setAll(built.sessions)
        setView(built.sessions.find(s => s.id === id) ?? null)
        if (id) setExtras(loadSessionExtras(tutorId, id))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [id, tutorId])

  useEffect(() => {
    if (view?.studentId) setNotes(notesForStudent(tutorId, view.studentId))
  }, [view?.studentId, tutorId, saved])

  const student = roster.find(s => s.id === view?.studentId)
  const prev = view ? previousSession(all, view) : null
  const brief = view ? buildAiBrief(view, student, prev) : null
  const canJoin = view ? joinableNow(view) : false
  const wait = view ? startsInLabel(view.scheduledAt) : null
  void tick

  const persistExtras = (next: SessionExtras) => {
    if (!id) return
    setExtras(next)
    saveSessionExtras(tutorId, id, next)
  }

  const goAi = () => {
    if (!view) return
    setPendingAiPrompt(preparePrompt(view, student, prev))
    navigate('/tutor/ai')
  }

  const complete = async () => {
    if (!view || !id) return
    const next = { ...extras, completedAt: new Date().toISOString() }
    persistExtras(next)
    if (view.source === 'local') completeLocalBooking(id)
    if (view.source === 'api') await setBookingStatus(id, 'completed', view.studentId ?? undefined)
    const rec = getLiveRecord(id)
    if (rec) {
      saveLiveRecord({
        ...rec,
        status: 'completed',
        phase: 'summary',
        endedAt: new Date().toISOString(),
        summary: extras.covered || rec.summary,
        tutorFeedback: extras.feedback || rec.tutorFeedback,
        actionItems: extras.actionItems.length ? extras.actionItems : rec.actionItems,
      })
    }
    setDoneOpen(true)
    reload()
  }

  if (loading) return <div className="pt-24 px-6 text-muted">Loading session…</div>
  if (!view) {
    return (
      <div className="pt-24 px-6 max-w-xl mx-auto">
        <p className="text-muted mb-4">Session not found.</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/tutor/sessions')}>Back to sessions</button>
      </div>
    )
  }

  const addAction = () => {
    if (!actionLabel.trim()) return
    const item: SessionActionItem = { id: `act-${Date.now()}`, label: actionLabel.trim(), done: false }
    persistExtras({ ...extras, actionItems: [...extras.actionItems, item] })
    setActionLabel('')
  }

  return (
    <div className="tx-page pt-20 px-4 sm:px-6 pb-28 max-w-5xl mx-auto overflow-x-hidden">
      <button type="button" className="text-sm text-muted mb-4 cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => navigate('/tutor/sessions')}>
        ← Sessions
      </button>

      <section className="tx-hero glass rounded-3xl p-5 md:p-8 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {view.demo && <span className="badge">Demo</span>}
          <span className="text-sm">{statusDot(view.status)} {statusLabel(view.status)}</span>
        </div>
        <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{view.topic}</h1>
        <div className="flex items-center gap-3 mt-3 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black" style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}>
            {view.studentAvatar ? <img src={view.studentAvatar} alt="" className="w-full h-full object-cover rounded-2xl" /> : displayInitials(view.studentName)}
          </div>
          <div>
            <div className="font-bold text-ink">{view.studentName}</div>
            <div className="text-sm text-muted">{view.kindLabel} · {formatWhen(view.scheduledAt)}{view.duration ? ` · ${view.duration} min` : ''}</div>
          </div>
        </div>
        {!canJoin && wait && view.status !== 'completed' && view.status !== 'cancelled' && (
          <p className="text-sm font-semibold text-ink mb-3">{wait}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm" onClick={goAi}>Prepare With AI</button>
          {view.studentId && (
            <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorStudentPath(view.studentId!))}>View Student</button>
          )}
          {view.status !== 'completed' && view.status !== 'cancelled' && (
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={!canJoin}
              onClick={() => canJoin && navigate(view.kind === 'group' ? view.joinHref : `${view.joinHref}&join=1`)}
            >
              {canJoin ? 'Join Session →' : 'Join Session'}
            </button>
          )}
        </div>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem] gap-6">
        <div>
          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-2">Session Goal</h2>
            {view.goal || extras.goal ? (
              <p className="text-sm text-ink">{extras.goal || view.goal}</p>
            ) : (
              <p className="text-sm text-muted mb-2">No session goal added yet.</p>
            )}
            <label className="block text-xs font-semibold text-muted mt-3">
              Add or update goal
              <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={2} value={extras.goal} onChange={e => persistExtras({ ...extras, goal: e.target.value })} />
            </label>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">✨ AI Session Brief</h2>
            <h3 className="text-sm font-bold text-ink mb-2">Student Context</h3>
            {brief && brief.skills.length ? (
              <ul className="text-sm text-muted mb-3">
                {brief.skills.map(sk => (
                  <li key={sk.name}>{sk.name}{sk.score != null ? ` — ${sk.score}%` : ''}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted mb-3">No skill snapshot shared for this student yet.</p>
            )}
            <h3 className="text-sm font-bold text-ink mb-1">Recent Activity</h3>
            <p className="text-sm text-muted mb-3">{brief?.recent || 'No recent activity on file.'}</p>
            <h3 className="text-sm font-bold text-ink mb-1">Current Project</h3>
            <p className="text-sm text-muted mb-3">{brief?.project || 'No linked project.'}</p>
            <h3 className="text-sm font-bold text-ink mb-1">Previous Session</h3>
            <p className="text-sm text-muted mb-3">{brief?.prev || 'No previous session with this student.'}</p>
            <h3 className="text-sm font-bold text-ink mb-1">Recommended Focus</h3>
            <ol className="text-sm text-muted list-decimal pl-4 mb-3">
              {(brief?.focus.length ? brief.focus : ['Stay with the booked session goal']).map(f => (
                <li key={f}>{f}</li>
              ))}
            </ol>
            <h3 className="text-sm font-bold text-ink mb-1">Suggested Question</h3>
            <p className="text-sm text-ink mb-4">&ldquo;{brief?.question}&rdquo;</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={goAi}>Open AI Teaching →</button>
              <button
                type="button"
                className="btn-glass text-sm"
                onClick={() => {
                  setPendingAiPrompt(
                    `${preparePrompt(view, student, prev)} Create a short practice exercise the student can complete after this session.`,
                  )
                  navigate('/tutor/ai')
                }}
              >
                Create Practice →
              </button>
            </div>
          </section>

          {prev && (
            <section className="glass rounded-2xl p-5 mb-5">
              <h2 className="text-lg font-black text-ink mb-2">Previous Session</h2>
              <div className="text-sm font-semibold text-ink">{prev.topic}</div>
              <div className="text-xs text-muted mb-2">{formatWhen(prev.scheduledAt)}</div>
              <p className="text-sm text-muted mb-3">{loadSessionExtras(tutorId, prev.id).covered || prev.goal || 'No summary recorded.'}</p>
              <ul className="text-sm space-y-1 mb-3">
                {loadSessionExtras(tutorId, prev.id).actionItems.map(a => (
                  <li key={a.id}>{a.done ? '✓' : '○'} {a.label}</li>
                ))}
              </ul>
              <button type="button" className="btn-glass text-sm" onClick={() => navigate(`/tutor/sessions/${prev.id}`)}>View Previous Session</button>
            </section>
          )}

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-1">Private Tutor Notes</h2>
            <p className="text-xs text-subtle mb-3">Visible only to you. Students cannot see these notes.</p>
            <textarea className="field w-full px-3 py-2 text-sm mb-2" rows={3} value={draft} onChange={e => setDraft(e.target.value)} aria-label="Private note" />
            <button
              type="button"
              className="btn-primary text-sm mb-4"
              onClick={() => {
                if (!draft.trim() || !view.studentId) return
                upsertNote(tutorId, view.studentId, draft.trim(), editId ?? undefined)
                setDraft('')
                setEditId(null)
                setNotes(notesForStudent(tutorId, view.studentId))
                setSaved(true)
                window.setTimeout(() => setSaved(false), 1400)
              }}
              disabled={!view.studentId}
            >
              {editId ? 'Update note' : 'Add Note'}
            </button>
            {saved && <span className="text-sm ml-2" style={{ color: '#0F8A68' }}>Note saved</span>}
            <ul className="space-y-2">
              {notes.map(n => (
                <li key={n.id} className="glass rounded-xl p-3">
                  <p className="text-sm text-ink">{n.body}</p>
                  <div className="text-[11px] text-subtle">{new Date(n.updatedAt).toLocaleString()}</div>
                  <button type="button" className="text-xs font-semibold text-primary mr-3" style={{ background: 'none', border: 'none' }} onClick={() => { setEditId(n.id); setDraft(n.body) }}>Edit</button>
                  <button type="button" className="text-xs font-semibold text-muted" style={{ background: 'none', border: 'none' }} onClick={() => { deleteNote(tutorId, n.id); if (view.studentId) setNotes(notesForStudent(tutorId, view.studentId)) }}>Delete</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">Follow-up Actions</h2>
            <div className="flex gap-2 mb-3">
              <input className="field flex-1 px-3 py-2 text-sm" value={actionLabel} onChange={e => setActionLabel(e.target.value)} placeholder="Add a practice task, lesson, or next-session goal" aria-label="New action item" />
              <button type="button" className="btn-glass text-sm" onClick={addAction}>Add Action</button>
            </div>
            <ul className="space-y-2">
              {extras.actionItems.map(a => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={a.done} aria-label={a.label} onChange={() => persistExtras({ ...extras, actionItems: extras.actionItems.map(x => x.id === a.id ? { ...x, done: !x.done } : x) })} />
                  <span className={a.done ? 'text-muted line-through' : 'text-ink'}>{a.label}</span>
                  <button type="button" className="text-xs text-muted ml-auto" style={{ background: 'none', border: 'none' }} onClick={() => persistExtras({ ...extras, actionItems: extras.actionItems.filter(x => x.id !== a.id) })}>Remove</button>
                </li>
              ))}
            </ul>
          </section>

          {view.status !== 'cancelled' && (
            <section className="glass rounded-2xl p-5 mb-5">
              <h2 className="text-lg font-black text-ink mb-3">Complete Session</h2>
              <p className="text-xs text-muted mb-3">Record what happened after you leave the existing live room. This does not change the /live UI.</p>
              <label className="block text-xs font-semibold text-muted mb-3">
                What we covered
                <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={3} value={extras.covered} onChange={e => persistExtras({ ...extras, covered: e.target.value })} />
              </label>
              <fieldset className="mb-3">
                <legend className="text-xs font-semibold text-muted mb-2">Student progress</legend>
                <div className="flex flex-wrap gap-2">
                  {(['improved', 'on_track', 'needs_practice'] as ProgressSelect[]).map(p => (
                    <button key={p} type="button" className="tx-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={extras.progressSelect === p} onClick={() => persistExtras({ ...extras, progressSelect: p })}>
                      {p === 'improved' ? 'Improved' : p === 'on_track' ? 'On Track' : 'Needs Practice'}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block text-xs font-semibold text-muted mb-3">
                Tutor feedback
                <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={3} value={extras.feedback} onChange={e => persistExtras({ ...extras, feedback: e.target.value })} />
              </label>
              <fieldset className="mb-4">
                <legend className="text-xs font-semibold text-muted mb-2">Recommended next step</legend>
                <div className="flex flex-wrap gap-2">
                  {(['lesson', 'project', 'practice', 'interview', 'session'] as NextStepKind[]).map(p => (
                    <button key={p} type="button" className="tx-chip rounded-full px-3 py-1.5 text-xs font-semibold capitalize" data-on={extras.nextStep === p} onClick={() => persistExtras({ ...extras, nextStep: p })}>
                      {p === 'session' ? 'Next tutor session' : p === 'lesson' ? 'Course lesson' : p}
                    </button>
                  ))}
                </div>
                <input className="field w-full mt-2 px-3 py-2 text-sm" value={extras.nextTopic} onChange={e => persistExtras({ ...extras, nextTopic: e.target.value })} placeholder="Recommended next session topic" />
              </fieldset>
              <button type="button" className="btn-primary text-sm" onClick={complete}>Complete Session</button>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          {(view.courseTitle || view.projectTitle) && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-base font-black text-ink mb-2">Context</h2>
              {view.courseTitle && <div className="text-sm text-muted mb-1">Course: {view.courseTitle}</div>}
              {view.lessonTitle && <div className="text-sm text-muted mb-1">Lesson: {view.lessonTitle}</div>}
              {view.studentProgress != null && <div className="text-sm text-muted mb-2">Progress: {view.studentProgress}%</div>}
              {view.courseTitle && <button type="button" className="btn-glass text-xs mb-2" onClick={() => navigate('/tutor/courses')}>Open Course Context</button>}
              {view.projectTitle && (
                <div className="mt-2">
                  <div className="text-sm text-muted mb-2">Project: {view.projectTitle}</div>
                  <button type="button" className="btn-glass text-xs" onClick={() => navigate('/tutor/projects')}>Review Project</button>
                </div>
              )}
            </section>
          )}
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-2">Earnings</h2>
            {view.price ? <div className="text-sm text-ink mb-1">Session: listed booking amount {view.price}</div> : null}
            <p className="text-xs text-muted mb-3">Earnings available after payment processing. No commission configuration is connected here.</p>
            <button type="button" className="btn-glass text-xs" onClick={() => navigate('/tutor/earnings')}>View Earnings →</button>
          </section>
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-2">Follow-up</h2>
            <p className="text-xs text-muted mb-3">Tutors cannot book as a student. Recommend a follow-up; the student books through the existing marketplace flow.</p>
            <button type="button" className="btn-primary text-sm" onClick={() => persistExtras({ ...extras, followUp: true })}>Recommend Follow-up</button>
            {extras.followUp && <p className="text-xs mt-2" style={{ color: '#0F8A68' }}>Follow-up recommended.</p>}
          </section>
        </aside>
      </div>

      <div className="tx-sticky -mx-4 sm:-mx-6 mt-6 px-4 sm:px-6 py-3 flex flex-wrap gap-2 md:hidden">
        <button type="button" className="btn-glass text-sm flex-1" onClick={goAi}>Prepare</button>
        {view.studentId && <button type="button" className="btn-glass text-sm flex-1" onClick={() => navigate(tutorStudentPath(view.studentId!))}>Student</button>}
        {view.status !== 'completed' && (
          <button type="button" className="btn-primary text-sm flex-1" disabled={!canJoin} onClick={() => canJoin && navigate(view.joinHref)}>Join</button>
        )}
      </div>

      {doneOpen && (
        <div className="tx-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="done-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setDoneOpen(false)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="done-title" className="text-xl font-black text-ink mb-2">Session Complete ✓</h2>
            <p className="text-sm text-muted mb-1">Student: {view.studentName}</p>
            <p className="text-sm text-muted mb-1">{view.duration ? `${view.duration} min` : 'Duration not recorded'} · {view.topic}</p>
            <h3 className="text-sm font-bold text-ink mt-3 mb-1">Summary</h3>
            <p className="text-sm text-muted">{extras.covered || extras.feedback || 'No summary written.'}</p>
            <h3 className="text-sm font-bold text-ink mt-3 mb-1">Student action items</h3>
            <ul className="text-sm text-muted mb-2">
              {extras.actionItems.map(a => <li key={a.id}>• {a.label}</li>)}
              {extras.actionItems.length === 0 && <li>None added.</li>}
            </ul>
            {extras.nextTopic && <p className="text-sm text-ink mb-4">Recommended next session: {extras.nextTopic}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => persistExtras({ ...extras, followUp: true })}>Recommend Follow-up</button>
              {view.studentId && <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorStudentPath(view.studentId!))}>View Student</button>}
              <button type="button" className="btn-glass text-sm" onClick={goAi}>Prepare Next Session</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setDoneOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
