import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { getCourseReviews, type CourseModule, type CourseReview, type ProjectRow } from '../lib/api'
import {
  courseStatusLabel,
  formatWhen,
  isCourseModerationBackendAvailable,
  loadAdminCourseIndex,
  loadCourseNotes,
  loadCurriculum,
  publishCourse,
  qualityEstimate,
  saveCourseNote,
  structureInsights,
  studioReference,
  type AdminCourseIndex,
  type AdminCourseRow,
} from '../lib/adminCourses'
import './admin-control.css'

type DetailTab = 'overview' | 'curriculum' | 'reviews' | 'moderation'
type CurriculumSource = 'catalog' | 'studio' | 'none'

export default function AdminCourseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminCourseIndex | null>(null)
  const [modules, setModules] = useState<CourseModule[] | null>(null)
  const [curriculumSource, setCurriculumSource] = useState<CurriculumSource>('none')
  const [reviews, setReviews] = useState<CourseReview[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [confirm, setConfirm] = useState<'publish' | 'unpublish' | null>(null)
  const [explain, setExplain] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminCourseIndex()
      .then(setIndex)
      .catch(() => setError("Course details couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (id) setNote(loadCourseNotes()[id] ?? '')
  }, [id])
  useEffect(() => {
    if (!id) return
    loadCurriculum(id)
      .then(pack => {
        setModules(pack.modules)
        setCurriculumSource(pack.source)
      })
      .catch(() => {
        setModules([])
        setCurriculumSource('none')
      })
  }, [id])
  useEffect(() => {
    if (!id) return
    let live = true
    getCourseReviews(id).then(rows => { if (live) setReviews(rows) }).catch(() => { if (live) setReviews([]) })
    return () => { live = false }
  }, [id])
  const course: AdminCourseRow | null = index?.courseRows.find(c => c.id === id) ?? null
  const studio = course ? studioReference(course.id) : null
  const quality = course ? qualityEstimate(course.id) : null
  const insights = course ? structureInsights(course.id) : []
  const moderation = isCourseModerationBackendAvailable()
  const blocked = 'Moderation actions will be available when the course moderation backend is connected.'
  const duration = durationLabel(studio?.durationHours ?? 0, modules)
  const ratingLabel = reviews == null ? '—' : reviews.length ? `${(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}/5 (${reviews.length})` : 'No reviews yet'
  const linkedProjects: ProjectRow[] = (studio?.projectIds ?? [])
    .map(pid => index?.catalog.find(p => p.id === pid))
    .filter((p): p is ProjectRow => Boolean(p))

  const applyPublish = async (published: boolean) => {
    if (!course) return
    setBusy(true)
    const result = await publishCourse(course.id, published)
    setBusy(false)
    setConfirm(null)
    setMsg(result.message)
    if (result.ok) load()
  }

  useEffect(() => {
    if (!confirm && !explain) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirm(null)
        setExplain(null)
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (explain) setExplain(null)
        else if (confirm && course && !busy) void applyPublish(confirm === 'publish')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, explain, busy, course])

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'curriculum', label: 'Curriculum' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'moderation', label: 'Moderation' },
  ]

  return (
    <AdminShell>
      <div className="ac-dash">
        <button type="button" className="btn-glass text-xs mb-3" onClick={() => navigate('/admin/courses')}>← Courses</button>
        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {loading && <div className="ac-skel mb-4" aria-busy="true" />}
        {!loading && !course && !error && <p className="text-[13px] text-muted">Course details couldn't be loaded. This course is not in the catalog.</p>}
        {course && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{course.title}</h1>
                <p className="text-[13px] text-muted">
                  {course.tutorName} · {courseStatusLabel(course.published)} · Moderation: Unavailable · {course.category || 'Not provided'} · {course.level || 'Not provided'}{duration !== 'Not provided' ? ` · ${duration}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/courses/${course.id}`)}>View Student Preview →</button>
                <button type="button" className="btn-glass text-xs" onClick={() => setTab('curriculum')}>Review Content</button>
                <button type="button" className="btn-glass text-xs" aria-disabled={!moderation} onClick={() => setExplain(blocked)}>Request Changes</button>
                <button type="button" className="btn-glass text-xs" aria-disabled={!moderation} onClick={() => setExplain('Course approval is unavailable because moderation infrastructure is not connected. Use Publish Course for catalog visibility.')}>Approve</button>
                {course.published
                  ? <button type="button" className="btn-glass text-xs" onClick={() => setConfirm('unpublish')}>Unpublish</button>
                  : <button type="button" className="btn-primary text-xs" onClick={() => setConfirm('publish')}>Publish Course</button>}
                <button type="button" className="btn-glass text-xs" aria-disabled onClick={() => setExplain('Pause is unavailable. Catalog courses only support published or unpublished.')}>Pause</button>
                {course.tutorId && <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/tutors/${course.tutorId}`)}>View Tutor →</button>}
              </div>
            </div>
            {course.demo && <div className="glass rounded-2xl p-3 mb-3 text-sm ac-warn">Demo Course Data — Not Production Data</div>}
            {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}

            <div className="flex flex-nowrap gap-1.5 mb-4 overflow-x-auto" role="tablist" aria-label="Course sections">
              {tabs.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="grid lg:grid-cols-2 gap-3">
                <section className="glass rounded-2xl p-3.5">
                  <h2 className="font-black text-ink">Overview</h2>
                  <dl className="grid gap-1.5 text-[13px]">
                    <KV k="Description" v={course.description?.trim() || 'Not provided'} />
                    <KV k="Instructor" v={course.tutorName} />
                    <KV k="Tutor ID" v={course.tutorId || 'Not provided'} />
                    <KV k="Headline" v={course.tutorHeadline || 'Not provided'} />
                    <KV k="Category" v={course.category || 'Not provided'} />
                    <KV k="Difficulty" v={course.level || 'Not provided'} />
                    <KV k="Duration" v={duration} />
                    <KV k="Pricing" v={course.priceCents ? `₹${Math.round(course.priceCents / 100).toLocaleString('en-IN')}` : 'Free / not set'} />
                    <KV k="Students" v={String(course.studentCount)} />
                    <KV k="Rating" v={ratingLabel} />
                    <KV k="Created" v={formatWhen(course.createdAt)} />
                    <KV k="Updated" v="Not provided" />
                    <KV k="Skills" v={course.skills.length ? course.skills.join(', ') : 'Not provided'} />
                    <KV k="Learning outcomes" v={studio?.outcomes.filter(Boolean).join('; ') || 'Not provided'} />
                  </dl>
                  <p className="text-[12px] text-muted mt-2">Financial data unavailable. Enrollment is not treated as a purchase.</p>
                </section>
                <section className="glass rounded-2xl p-3.5">
                  <h2 className="font-black text-ink">LearnSyra Course Quality Estimate</h2>
                  {quality ? (
                    <>
                      <p className="text-[13px] text-ink mb-1">Estimate {quality.total}/100</p>
                      <p className="text-[12px] text-muted mb-2">This is not accreditation, certification, or an official quality score. It is not a student rating.</p>
                      <div className="ac-health"><span>Content</span><span>{quality.content}</span></div>
                      <div className="ac-health"><span>Structure</span><span>{quality.structure}</span></div>
                      <div className="ac-health"><span>Practice</span><span>{quality.practice}</span></div>
                    </>
                  ) : (
                    <p className="text-[13px] text-muted">Quality estimate unavailable.</p>
                  )}
                  <h2 className="font-black text-ink mt-3">AI Review Insights</h2>
                  {insights.length === 0 && <p className="text-[13px] text-muted">Not enough structured course data for a recommendation.</p>}
                  {insights.map(i => (
                    <p key={i.id} className="text-[13px] py-1" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>{i.label}: {i.rec}</p>
                  ))}
                </section>
              </div>
            )}

            {tab === 'curriculum' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Curriculum</h2>
                {curriculumSource === 'studio' && (
                  <p className="text-[12px] text-muted mb-2">Shown from Course Studio on this device. This is not a catalog curriculum record.</p>
                )}
                {modules == null && <div className="ac-skel" />}
                {modules && modules.length === 0 && <p className="text-[13px] text-muted">No curriculum records yet.</p>}
                {modules?.map(m => (
                  <div key={m.id} className="mb-3">
                    <div className="text-[13px] font-semibold">{m.title}</div>
                    {(m.lessons ?? []).map(l => (
                      <div key={l.id} className="py-1.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                        <div className="ac-act">
                          <span>{l.title} · {l.lesson_type}{l.is_free ? ' · Preview' : ' · Locked'}{l.lesson_type === 'quiz' ? ' · Quiz' : ''}{l.lesson_type === 'project' ? ' · Project' : ''}</span>
                          <span className="text-[11px] text-muted">{l.duration_min ? `${l.duration_min} min` : '—'}</span>
                        </div>
                        {(l.body || l.video_url || l.quiz) && (
                          <details className="mt-1">
                            <summary className="text-[12px] text-muted cursor-pointer">Preview content</summary>
                            {l.video_url && <p className="text-[12px] mt-1">Video URL provided.</p>}
                            {l.quiz && <p className="text-[12px] mt-1">Quiz: {l.quiz.questions.length} question{l.quiz.questions.length === 1 ? '' : 's'} · pass {l.quiz.pass}</p>}
                            {l.body && <p className="text-[12px] mt-1 whitespace-pre-wrap">{l.body}</p>}
                          </details>
                        )}
                      </div>
                    ))}
                    {(m.lessons ?? []).length === 0 && <p className="text-[12px] text-muted">No lessons in this module.</p>}
                  </div>
                ))}
                {studio && (
                  <div className="mt-3 text-[13px] text-muted">
                    Practice {studio.practices.length ? `${studio.practices.length} task${studio.practices.length === 1 ? '' : 's'}` : 'not provided'}
                    {' · '}
                    Quizzes {studio.quizzes.length ? `${studio.quizzes.length}` : 'not provided'}
                  </div>
                )}
                <h3 className="text-[13px] font-semibold mt-3">Projects</h3>
                {studio?.projectTitle && <p className="text-[13px] text-muted">{studio.projectTitle}{studio.projectHours ? ` · ${studio.projectHours}h` : ''}</p>}
                {linkedProjects.map(p => (
                  <div key={p.id} className="ac-act">
                    <span>{p.title} · {p.difficulty || 'Not provided'} · {(p.skills ?? []).join(', ') || 'Not provided'}</span>
                    <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/projects/${p.id}`)}>Open project</button>
                  </div>
                ))}
                {!studio?.projectTitle && linkedProjects.length === 0 && modules && <p className="text-[12px] text-muted mt-1">No project review activity yet.</p>}
              </section>
            )}

            {tab === 'reviews' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Student reviews</h2>
                {reviews == null && <div className="ac-skel" />}
                {reviews && reviews.length === 0 && <p className="text-[13px] text-muted">No reviews yet.</p>}
                {reviews?.map(r => (
                  <div key={r.id} className="ac-act">
                    <span>{r.rating}/5 · {r.body || 'No written review'} · {r.student?.full_name || 'Student'}</span>
                    <span className="text-[11px] text-muted">{formatWhen(r.created_at)}</span>
                  </div>
                ))}
              </section>
            )}

            {tab === 'moderation' && (
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Moderation</h2>
                <p className="text-[13px] mb-2">Current state: Unavailable</p>
                <p className="text-[13px] text-muted mb-3">{blocked} Catalog publish/unpublish is available through the existing course publish API.</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button type="button" className="btn-glass text-xs" aria-disabled={!moderation} onClick={() => setExplain('Course approval is unavailable because moderation infrastructure is not connected.')}>Approve</button>
                  <button type="button" className="btn-glass text-xs" aria-disabled={!moderation} onClick={() => setExplain(blocked)}>Request Changes</button>
                  <button type="button" className="btn-glass text-xs" aria-disabled={!moderation} onClick={() => setExplain('Course rejection is unavailable because moderation infrastructure is not connected.')}>Reject</button>
                </div>
                <p className="text-[13px] text-muted mb-3">No moderation history available.</p>
                <label className="block text-[12px] font-semibold text-muted">
                  Admin notes
                  <textarea className="field mt-1 w-full px-3 py-2 text-sm" rows={3} value={note} onChange={e => setNote(e.target.value)} />
                </label>
                <button type="button" className="btn-glass text-xs mt-2" onClick={() => { saveCourseNote(course.id, note); setMsg('Admin note saved in the Admin-only course notes store.') }}>Save note</button>
              </section>
            )}
          </>
        )}
      </div>

      {confirm && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="course-pub-title">
          <button type="button" className="absolute inset-0" aria-label="Cancel" style={{ background: 'transparent', border: 'none' }} onClick={() => setConfirm(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="course-pub-title" className="text-lg font-black text-ink mb-2">{confirm === 'publish' ? 'Publish this course?' : 'Unpublish this course?'}</h2>
            <p className="text-sm text-muted mb-4">
              {confirm === 'publish'
                ? 'This updates catalog visibility using the existing publish API. It is not a separate moderation approval workflow.'
                : 'This affects course availability according to the platform\'s existing publishing rules. Existing enrollments, progress, projects, reviews, and tutor ownership are preserved.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-glass text-sm" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => applyPublish(confirm === 'publish')}>{confirm === 'publish' ? 'Publish Course' : 'Unpublish'}</button>
            </div>
          </div>
        </div>
      )}
      {explain && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="course-mod-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExplain(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="course-mod-title" className="text-lg font-black text-ink mb-2">Course moderation backend unavailable</h2>
            <p className="text-sm text-muted mb-4">{explain}</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setExplain(null)}>Close</button>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function durationLabel(studioHours: number, modules: CourseModule[] | null) {
  if (studioHours > 0) return `${studioHours} hours`
  const mins = (modules ?? []).flatMap(m => m.lessons ?? []).reduce((s, l) => s + (l.duration_min || 0), 0)
  if (mins > 0) return `${mins} min`
  return 'Not provided'
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted shrink-0">{k}</dt><dd className="font-medium text-right break-all">{v}</dd></div>
}
