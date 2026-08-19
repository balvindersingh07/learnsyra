import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import { getReviewQueue, getTutorBookings, getTutorCourses, getTutorStudents } from '../lib/api'
import { buildCatalog } from '../lib/courseCatalog'
import { displayInitials } from '../lib/roleAccess'
import { loadTutorBookings } from '../lib/tutorMarketplace'
import {
  buildTutorRoster,
  deleteNote,
  formatWhen,
  learningJourney,
  notesForStudent,
  relativeActivity,
  statusDot,
  upsertNote,
  type TutorNote,
  type TutorStudent,
} from '../lib/tutorStudents'
import './tutor-students.css'

export default function TutorStudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || 'local-tutor'
  const [student, setStudent] = useState<TutorStudent | null>(null)
  const [catalogCourses, setCatalogCourses] = useState(buildCatalog([]))
  const [notes, setNotes] = useState<TutorNote[]>([])
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [msgOpen, setMsgOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const reloadNotes = () => {
    if (id) setNotes(notesForStudent(tutorId, id))
  }

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([getTutorStudents(), getTutorBookings(), getReviewQueue(), getTutorCourses()])
      .then(([enrollments, bookings, reviews, apiCourses]) => {
        if (!alive) return
        const catalog = buildCatalog(apiCourses)
        setCatalogCourses(catalog)
        const built = buildTutorRoster({
          enrollments,
          bookings,
          reviews,
          localBookings: loadTutorBookings(),
          apiCourses,
        })
        setStudent(built.students.find(s => s.id === id) ?? null)
      })
      .catch(() => {
        if (!alive) return
        const built = buildTutorRoster({ enrollments: [], bookings: [], reviews: [], localBookings: [], apiCourses: [] })
        setStudent(built.students.find(s => s.id === id) ?? null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id, session?.user.id])

  useEffect(() => {
    reloadNotes()
  }, [id, tutorId])

  useEffect(() => {
    if (!msgOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMsgOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [msgOpen])

  const journey = useMemo(() => (student ? learningJourney(student, catalogCourses) : null), [student, catalogCourses])

  const goAi = (prompt: string) => {
    setPendingAiPrompt(prompt)
    navigate('/tutor/ai')
  }

  if (loading) return <div className="pt-24 px-6 text-muted">Loading student…</div>
  if (!student) {
    return (
      <div className="pt-24 px-6 max-w-xl mx-auto">
        <p className="text-muted mb-4">Student not found on your roster.</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/tutor/students')}>
          Back to students
        </button>
      </div>
    )
  }

  const saveNote = () => {
    if (!draft.trim()) return
    upsertNote(tutorId, student.id, draft.trim(), editId ?? undefined)
    setDraft('')
    setEditId(null)
    reloadNotes()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  return (
    <div className="ts-page pt-20 px-4 sm:px-6 pb-28 max-w-6xl mx-auto overflow-x-hidden">
      <button type="button" className="text-sm text-muted mb-4 cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => navigate('/tutor/students')}>
        ← My Students
      </button>

      <section className="ts-hero glass rounded-3xl p-5 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row gap-5">
          <div className="ts-avatar w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-black flex-shrink-0">
            {student.avatarUrl ? <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" /> : displayInitials(student.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                {student.name}
              </h1>
              {student.demo ? <span className="badge">Demo</span> : null}
            </div>
            <p className="text-muted mb-2">{student.career.target || student.headline || 'Target role not shared with tutors'}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mb-3">
              <span>{student.courses[0]?.title || 'No course yet'}</span>
              <span className="font-semibold text-ink">{student.overallProgress}% learning progress</span>
              <span>
                {statusDot(student.status)} {student.relationship}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-glass text-sm" onClick={() => setMsgOpen(true)}>
                Message
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() =>
                  goAi(`Prepare the next session for ${student.name}. Focus: ${student.currentFocus ?? 'course review'}. Gaps: ${student.focusSkills.join(', ') || 'none listed'}.`)
                }
              >
                Prepare Session
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => document.getElementById('notes')?.scrollIntoView({ behavior: 'smooth' })}>
                Add Note
              </button>
              <span className="text-xs text-subtle self-center">No public student profile is available to tutors.</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-6">
        <div>
          {journey && (
            <section className="glass rounded-2xl p-5 mb-5">
              <h2 className="text-lg font-black text-ink mb-3">📚 Learning Journey</h2>
              <div className="font-semibold text-ink mb-1">{journey.title}</div>
              <div className="flex justify-between text-sm text-muted mb-2">
                <span>Progress {journey.progress}%</span>
                <span>
                  {journey.completedLessons != null && journey.totalLessons != null
                    ? `${journey.completedLessons} / ${journey.totalLessons} lessons`
                    : 'Lesson count not available'}
                </span>
              </div>
              <div className="ts-progress mb-3">
                <span style={{ width: `${journey.progress}%` }} />
              </div>
              <div className="text-sm text-muted">Current lesson: {journey.currentLesson || '—'}</div>
              <div className="text-sm text-muted mb-3">Next: {journey.nextLesson || '—'}</div>
              <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutor/courses')}>
                View Course →
              </button>
            </section>
          )}

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">🧬 Skill Snapshot</h2>
            {student.skills.length === 0 ? (
              <p className="text-sm text-muted">No skill signals from courses or projects yet.</p>
            ) : (
              <ul className="space-y-3">
                {student.skills.map(sk => (
                  <li key={sk.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-ink">{sk.name}</span>
                      <span className="text-muted">{sk.score != null ? `${sk.score}%` : 'Seen in coursework'}</span>
                    </div>
                    <div className="ts-skill">
                      <span style={{ width: `${sk.score ?? 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {student.focusSkills.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold text-ink mb-1">Focus Skills</h3>
                <p className="text-sm text-muted">{student.focusSkills.join(' · ')}</p>
              </div>
            )}
            <button type="button" className="btn-glass text-sm mt-3" onClick={() => setSkillsOpen(v => !v)} aria-expanded={skillsOpen}>
              {skillsOpen ? 'Hide skill analysis' : 'View Skill Analysis'}
            </button>
            {skillsOpen && (
              <p className="text-sm text-muted mt-3">
                Scores reflect course or project progress tied to that skill name. They are not independent skill assessments or grades.
              </p>
            )}
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-2">✨ AI Student Insight</h2>
            <p className="text-sm text-ink mb-3">{student.insight}</p>
            <h3 className="text-sm font-bold text-ink mb-1">Recommended Tutor Action</h3>
            <p className="text-sm text-muted mb-3">{student.recommendedAction}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/courses')}>
                Prepare Lesson
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutor/projects')}>
                Assign Practice
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => setMsgOpen(true)}>
                Message Student
              </button>
            </div>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">🎯 Student Goals</h2>
            <div className="text-sm text-muted mb-1">Target</div>
            <div className="font-semibold text-ink mb-3">{student.career.target || 'Not shared with tutors'}</div>
            {student.career.overall != null && (
              <div className="text-sm text-muted mb-3">Progress from tutor-visible work: {student.career.overall}%</div>
            )}
            <ul className="text-sm space-y-1 mb-3">
              {student.skills.map(sk => (
                <li key={sk.name}>
                  {(sk.score ?? 0) >= 70 ? '✓' : '○'} {sk.name}
                </li>
              ))}
              <li>○ Interview Ready</li>
            </ul>
            <p className="text-xs text-subtle">Private career-center details stay on the student side. Tutors only see enrollment, project, and session signals.</p>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">🚀 Student Projects</h2>
            {student.projects.length === 0 ? (
              <p className="text-sm text-muted">No projects submitted to you yet.</p>
            ) : (
              student.projects.map(p => (
                <article key={p.id} className="glass rounded-xl p-4 mb-3">
                  <h3 className="font-bold text-ink">{p.title}</h3>
                  <div className="text-xs text-muted mt-1 capitalize">
                    Status: {p.status.replace('_', ' ')}
                    {p.progress != null ? ` · ${p.progress}%` : ''}
                    {p.score != null ? ` · Score ${p.score} / 100` : ''}
                  </div>
                  <div className="text-xs text-muted mt-1">{p.skills.join(' · ')}</div>
                  {p.needsReview && (
                    <div className="text-sm mt-2" style={{ color: '#B45309' }}>
                      ⚠ Needs Review{p.stallNote ? ` — ${p.stallNote}` : ''}
                    </div>
                  )}
                  <button type="button" className="btn-glass text-xs mt-3" onClick={() => navigate('/tutor/projects')}>
                    {p.needsReview ? 'Review Project →' : 'View Project →'}
                  </button>
                </article>
              ))
            )}
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">📅 Upcoming Sessions</h2>
            {student.nextSession ? (
              <div className="glass rounded-xl p-4">
                <div className="font-semibold text-ink">{student.nextSession.label}</div>
                <div className="text-sm text-muted">
                  {formatWhen(student.nextSession.when)}
                  {student.nextSession.duration ? ` · ${student.nextSession.duration} min` : ''}
                </div>
                <div className="text-xs text-muted mt-1">With you · {student.nextSession.status}</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button type="button" className="btn-primary text-xs" onClick={() => goAi(`Prepare with AI for ${student.name}: ${student.nextSession?.label}`)}>
                    Prepare With AI
                  </button>
                  <button type="button" className="btn-glass text-xs" onClick={() => navigate(student.nextSession!.href)}>
                    View Session
                  </button>
                  {student.nextSession.joinHref && (
                    <button type="button" className="btn-glass text-xs" onClick={() => navigate(student.nextSession!.joinHref!)}>
                      Join Session
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">No upcoming session.</p>
            )}
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">🕘 Recent Sessions</h2>
            {student.sessions.filter(s => !s.upcoming).length === 0 ? (
              <p className="text-sm text-muted">No completed sessions on record.</p>
            ) : (
              student.sessions
                .filter(s => !s.upcoming)
                .slice(0, 8)
                .map(s => (
                  <div key={s.id} className="flex flex-wrap justify-between gap-2 py-2" style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                    <div>
                      <div className="text-sm font-semibold text-ink">{s.label}</div>
                      <div className="text-xs text-muted">
                        {formatWhen(s.when)}
                        {s.duration ? ` · ${s.duration} min` : ''} · {s.status}
                      </div>
                      {s.notes && <div className="text-xs text-subtle mt-1">{s.notes}</div>}
                    </div>
                    <button type="button" className="btn-glass text-xs" onClick={() => navigate(s.href)}>
                      View Session →
                    </button>
                  </div>
                ))
            )}
          </section>

          <section id="notes" className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-1">📝 Private Tutor Notes</h2>
            <p className="text-xs text-subtle mb-3">Only visible to you on this device. Students cannot see these notes.</p>
            <textarea
              className="field w-full px-3 py-2 text-sm mb-2"
              rows={3}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Student understands React fundamentals but needs more practice with TypeScript generics."
              aria-label="Private tutor note"
            />
            <div className="flex gap-2 mb-4">
              <button type="button" className="btn-primary text-sm" onClick={saveNote}>
                {editId ? 'Update note' : 'Add note'}
              </button>
              {editId && (
                <button type="button" className="btn-glass text-sm" onClick={() => { setEditId(null); setDraft('') }}>
                  Cancel
                </button>
              )}
              {saved && <span className="text-sm self-center" style={{ color: '#0F8A68' }}>Note saved</span>}
            </div>
            <ul className="space-y-3">
              {notes.map(n => (
                <li key={n.id} className="glass rounded-xl p-3">
                  <p className="text-sm text-ink">{n.body}</p>
                  <div className="text-[11px] text-subtle mt-1">{new Date(n.updatedAt).toLocaleString()}</div>
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="text-xs font-semibold text-primary cursor-pointer" style={{ background: 'none', border: 'none' }} onClick={() => { setEditId(n.id); setDraft(n.body) }}>
                      Edit
                    </button>
                    <button type="button" className="text-xs font-semibold text-muted cursor-pointer" style={{ background: 'none', border: 'none' }} onClick={() => { deleteNote(tutorId, n.id); reloadNotes() }}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-2xl p-5 mb-5">
            <h2 className="text-lg font-black text-ink mb-3">🎯 Next Session Preparation</h2>
            <div className="text-sm text-muted">Topic: {student.nextSession?.label || student.currentFocus || 'Not scheduled'}</div>
            <div className="text-sm text-muted mt-1">
              Student currently knows: {student.skills.filter(s => (s.score ?? 0) >= 70).map(s => `${s.name}${s.score != null ? ` — ${s.score}%` : ''}`).join(', ') || 'Not enough data'}
            </div>
            <div className="text-sm text-muted mt-1">
              Current difficulty: {student.focusSkills.map(s => {
                const sk = student.skills.find(x => x.name === s)
                return `${s}${sk?.score != null ? ` — ${sk.score}%` : ''}`
              }).join(', ') || 'None listed'}
            </div>
            {student.focusSkills.length > 0 && (
              <div className="text-sm text-ink mt-2">Recommended focus: {student.focusSkills.join(', ')}</div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <button type="button" className="btn-primary text-sm" onClick={() => goAi(`Prepare with AI for ${student.name}`)}>
                Prepare With AI
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => navigate('/tutor/projects')}>
                Create Practice
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => document.getElementById('notes')?.scrollIntoView({ behavior: 'smooth' })}>
                Add Session Note
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => setMsgOpen(true)}>
                Message Student
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 self-start">
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-2">💬 Student Communication</h2>
            <p className="text-xs text-muted mb-3">Direct messaging is not available yet. Use the coming-soon action rather than a separate inbox.</p>
            <button type="button" className="btn-primary w-full text-sm" onClick={() => setMsgOpen(true)}>
              Message Student
            </button>
          </section>
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-3">🏆 Student Achievements</h2>
            <ul className="space-y-2 text-sm">
              {student.achievements.map(a => (
                <li key={a.id} className={a.earned ? 'text-ink' : 'text-subtle'} title={a.hint}>
                  {a.earned ? '🏅' : '○'} {a.label}
                </li>
              ))}
            </ul>
          </section>
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-2">🎯 Career Readiness</h2>
            {student.career.overall != null ? (
              <div className="text-3xl font-black text-ink mb-3">{student.career.overall}%</div>
            ) : (
              <p className="text-sm text-muted mb-3">Not enough shared data to score overall readiness.</p>
            )}
            <ul className="text-sm text-muted space-y-1 mb-3">
              <li>Skills — {student.career.skills != null ? `${student.career.skills}%` : 'Not shared'}</li>
              <li>Projects — {student.career.projects != null ? `${student.career.projects}%` : 'Not shared'}</li>
              <li>Resume — Not shared with tutors</li>
              <li>Interview — {student.career.interview != null ? `${student.career.interview}%` : 'Not shared'}</li>
            </ul>
            {student.career.support && (
              <div className="text-sm text-ink mb-3">
                <span className="font-semibold">Recommended Support</span>
                <p className="text-muted mt-1">{student.career.support}</p>
              </div>
            )}
            <button type="button" className="btn-glass text-sm" onClick={() => goAi(`Prepare an interview-style session for ${student.name} using only listed skills: ${student.skills.map(s => s.name).join(', ')}.`)}>
              Prepare Interview
            </button>
          </section>
          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-black text-ink mb-3">📈 Recent Learning Activity</h2>
            {student.activity.length === 0 ? (
              <p className="text-sm text-muted">No recent learning activity.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {student.activity.slice(0, 8).map(a => (
                  <li key={a.at + a.text}>
                    <div className="text-xs text-subtle">{relativeActivity(a.at)}</div>
                    <div className="text-ink">{a.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <div className="ts-sticky -mx-4 sm:-mx-6 mt-6 px-4 sm:px-6 py-3 flex flex-wrap gap-2 md:hidden">
        <button type="button" className="btn-glass text-sm flex-1" onClick={() => setMsgOpen(true)}>
          Message
        </button>
        <button type="button" className="btn-primary text-sm flex-1" onClick={() => goAi(`Prepare session for ${student.name}`)}>
          Prepare Session
        </button>
      </div>

      {msgOpen && (
        <div className="ts-drawer fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="msg-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setMsgOpen(false)} />
          <div className="glass rounded-3xl p-5 relative z-10 w-full max-w-md">
            <h2 id="msg-title" className="text-lg font-black text-ink mb-2">
              Messaging coming soon
            </h2>
            <p className="text-sm text-muted mb-4">
              LearnSyra does not have a tutor–student inbox yet. This is a placeholder — no separate messaging system was created. Use session notes or live class chat when you meet.
            </p>
            <button type="button" className="btn-primary text-sm" onClick={() => setMsgOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
