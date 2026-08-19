import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createCourse, getProjects, setCoursePublished } from '../lib/api'
import { formatInr } from '../lib/courseCatalog'
import { tutorCoursePreviewPath } from '../lib/paths'
import { buildProjectCatalog } from '../lib/projectWorkspace'
import { loadTutorHub } from '../lib/tutorProfile'
import {
  COURSE_CATEGORIES,
  COURSE_LANGUAGES,
  COURSE_LEVELS,
  PLATFORM_SKILLS,
  STUDIO_STEPS,
  SUBCATEGORIES,
  applyOutline,
  curriculumHealth,
  deleteStudioCourse,
  duplicateCourse,
  emptyCourse,
  emptyLesson,
  emptyModule,
  emptyPractice,
  emptyQuiz,
  getStudioCourse,
  improveDescription,
  moveItem,
  ownsStudioCourse,
  placeholderThumb,
  publishChecklist,
  qualityScore,
  readinessPct,
  saveStudioCourse,
  statusLabel,
  suggestMissingLessons,
  suggestOutcomes,
  suggestOutline,
  suggestPractice,
  suggestQuiz,
  type CourseLevel,
  type LessonKind,
  type StudioCourse,
  type StudioLesson,
  type StudioModule,
  type StudioPractice,
  type StudioQuiz,
  type StudioQuizQuestion,
} from '../lib/tutorCourses'
import './tutor-courses.css'

type SaveState = 'saved' | 'saving' | 'unsaved'

const KINDS: LessonKind[] = ['video', 'article', 'code', 'quiz', 'assignment', 'project']

export default function TutorCourseStudio() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { session, profile } = useAuth()
  const tutorId = session?.user.id || profile?.id || 'local-tutor'
  const [course, setCourse] = useState<StudioCourse | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [step, setStep] = useState(Number(params.get('step') || 0))
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [error, setError] = useState<string | null>(null)
  const [descDraft, setDescDraft] = useState<string | null>(null)
  const [pending, setPending] = useState<{ kind: string; payload: unknown } | null>(null)
  const [modIdx, setModIdx] = useState(0)
  const [lesIdx, setLesIdx] = useState(0)
  const [projects, setProjects] = useState<{ id: string; title: string; skills: string[] }[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const n = Number(params.get('step') || 0)
    if (!Number.isNaN(n) && n >= 0 && n < STUDIO_STEPS.length) setStep(n)
  }, [params])

  useEffect(() => {
    getProjects()
      .then(rows => setProjects(buildProjectCatalog(rows).map(p => ({ id: p.id, title: p.title, skills: p.skills }))))
      .catch(() => setProjects(buildProjectCatalog([]).map(p => ({ id: p.id, title: p.title, skills: p.skills }))))
  }, [])

  useEffect(() => {
    if (isNew) {
      const blank = emptyCourse(tutorId)
      const raw = sessionStorage.getItem('learnsyra_studio_outline')
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { idea?: string; outline?: string[] }
          sessionStorage.removeItem('learnsyra_studio_outline')
          blank.title = parsed.idea?.slice(0, 80) || ''
          blank.shortDescription = parsed.idea || ''
          if (parsed.outline?.length) Object.assign(blank, applyOutline(blank, parsed.outline))
        } catch {
          /* ignore */
        }
      }
      setCourse(blank)
      return
    }
    const found = getStudioCourse(id)
    if (!found || !ownsStudioCourse(found, tutorId)) {
      setForbidden(true)
      return
    }
    setCourse(found)
  }, [id, isNew, tutorId])

  const persist = (next: StudioCourse, silent = false) => {
    if (next.demo) return next
    if (!silent) setSaveState('saving')
    const saved = saveStudioCourse(next)
    setCourse(saved)
    setSaveState('saved')
    if (isNew) navigate(`/tutor/courses/${saved.id}`, { replace: true })
    return saved
  }

  const update = (patch: Partial<StudioCourse>) => {
    if (!course) return
    setSaveState('unsaved')
    persist({ ...course, ...patch })
  }

  const hub = loadTutorHub(tutorId)
  const profileOk = Boolean(hub && (hub.visibility === 'published' || hub.identity?.name || hub.bio))
  const checks = course ? publishChecklist(course, profileOk) : []
  const missing = checks.filter(c => c.required && !c.ok)
  const quality = course ? qualityScore(course) : null
  const health = course ? curriculumHealth(course).filter(h => !course.ignoredRecs.includes(h.id)) : []
  const canPublish = missing.length === 0 && course && !course.demo

  const goStep = (n: number) => {
    setStep(n)
    setParams({ step: String(n) }, { replace: true })
  }

  if (forbidden) {
    return (
      <div className="pt-24 px-6 max-w-xl mx-auto">
        <p className="text-muted mb-4">You can only edit courses you own.</p>
        <button type="button" className="btn-glass" onClick={() => navigate('/tutor/courses')}>Back to courses</button>
      </div>
    )
  }
  if (!course) return <div className="pt-24 px-6 text-muted">Loading studio…</div>

  const module = course.modules[modIdx]
  const lesson = module?.lessons[lesIdx]
  const subs = SUBCATEGORIES[course.category] ?? PLATFORM_SKILLS.slice(0, 6)

  const setModules = (modules: StudioModule[]) => update({ modules })
  const setLesson = (next: StudioLesson) => {
    if (!module) return
    const lessons = module.lessons.map((l, i) => (i === lesIdx ? next : l))
    setModules(course.modules.map((m, i) => (i === modIdx ? { ...m, lessons } : m)))
  }

  const publish = async () => {
    if (!canPublish) return
    setBusy(true)
    setError(null)
    try {
      let apiId = course.apiId
      if (!apiId) {
        const created = await createCourse({
          title: course.title,
          description: course.shortDescription || course.description,
          category: course.category === 'AI & Machine Learning' ? 'AI & ML' : course.category,
          level: course.level,
          price_cents: course.pricing.mode === 'paid' ? course.pricing.priceInr : 0,
        })
        if (created.error) {
          persist({ ...course, status: 'published' })
        } else if (created.id) {
          apiId = created.id
          await setCoursePublished(created.id, true)
        }
      } else {
        await setCoursePublished(apiId, true)
      }
      persist({ ...course, apiId, status: 'published' })
      goStep(9)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed. Draft is still saved locally.')
      persist({ ...course, status: 'published' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tc-page pt-20 px-4 sm:px-6 pb-28 max-w-6xl mx-auto overflow-x-hidden">
      <button type="button" className="text-sm text-muted mb-4 cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => navigate('/tutor/courses')}>
        ← My Courses
      </button>
      <div className="tc-hero glass rounded-3xl p-5 md:p-7 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {course.demo && <span className="badge">Sample</span>}
          <span className="text-sm text-muted">{statusLabel(course.status)}</span>
          <span className="text-sm text-muted">· {saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved changes' : 'Saved'}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {course.title || 'Untitled course'}
        </h1>
        <p className="text-sm text-muted mt-1">Step {step + 1} of {STUDIO_STEPS.length} · {STUDIO_STEPS[step]}</p>
        <div className="tc-step mt-3"><span style={{ width: `${((step + 1) / STUDIO_STEPS.length) * 100}%` }} /></div>
      </div>

      {error && <div className="glass rounded-2xl p-4 mb-4 text-sm" style={{ color: '#e11d48' }}>{error}</div>}

      <div className="flex gap-2 overflow-x-auto mb-6 pb-1" role="tablist" aria-label="Studio steps">
        {STUDIO_STEPS.map((label, i) => (
          <button key={label} type="button" role="tab" aria-selected={step === i} className="tc-chip rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap" data-on={step === i} onClick={() => goStep(i)}>
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <section className="glass rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-black text-ink">Course Basics</h2>
          <Field label="Course title" value={course.title} onChange={v => update({ title: v })} />
          <Field label="Subtitle" value={course.subtitle} onChange={v => update({ subtitle: v })} />
          <Field label="Short description" value={course.shortDescription} onChange={v => update({ shortDescription: v })} multiline />
          <label className="block text-xs font-semibold text-muted">
            Detailed description
            <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={6} value={course.description} onChange={e => update({ description: e.target.value })} />
          </label>
          <div className="glass rounded-xl p-3">
            <h3 className="text-sm font-bold text-ink mb-2">AI Writing Assist</h3>
            <p className="text-xs text-muted mb-2">Improves wording only. It will not add credentials, student counts, salaries, or guarantees.</p>
            <button type="button" className="btn-glass text-xs" onClick={() => setDescDraft(improveDescription(course.description || course.shortDescription))}>Improve Description</button>
            {descDraft && (
              <div className="mt-3">
                <p className="text-sm text-ink mb-2">{descDraft}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary text-xs" onClick={() => { update({ description: descDraft }); setDescDraft(null) }}>Approve</button>
                  <button type="button" className="btn-glass text-xs" onClick={() => setDescDraft(null)}>Reject</button>
                </div>
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted">
              Category
              <select className="field w-full mt-1 px-3 py-2 text-sm" value={course.category} onChange={e => update({ category: e.target.value, subcategory: (SUBCATEGORIES[e.target.value] ?? [''])[0] || '' })}>
                {COURSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Subcategory
              <select className="field w-full mt-1 px-3 py-2 text-sm" value={course.subcategory} onChange={e => update({ subcategory: e.target.value })}>
                {subs.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Level
              <select className="field w-full mt-1 px-3 py-2 text-sm" value={course.level} onChange={e => update({ level: e.target.value as CourseLevel })}>
                {COURSE_LEVELS.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Language
              <select className="field w-full mt-1 px-3 py-2 text-sm" value={course.language} onChange={e => update({ language: e.target.value })}>
                {COURSE_LANGUAGES.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Estimated duration (hours)
              <input type="number" min={1} className="field w-full mt-1 px-3 py-2 text-sm" value={course.durationHours} onChange={e => update({ durationHours: Number(e.target.value) || 0 })} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Intro video URL (optional)
              <input className="field w-full mt-1 px-3 py-2 text-sm" value={course.introVideo} onChange={e => update({ introVideo: e.target.value })} placeholder="https://" />
            </label>
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink mb-1">Course thumbnail</h3>
            <p className="text-xs text-muted mb-2">Recommended 16:9. Upload an image or use a generated placeholder.</p>
            <div className="tc-thumb max-w-md mb-2">
              {course.thumbnail ? <img src={course.thumbnail} alt="Course thumbnail preview" /> : <div className="w-full h-full flex items-center justify-center text-white text-sm">No thumbnail</div>}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="btn-glass text-xs cursor-pointer">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onerror = () => setError('Upload failed. Try another image or use a placeholder.')
                    reader.onload = () => update({ thumbnail: String(reader.result) })
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
              <button type="button" className="btn-glass text-xs" onClick={() => update({ thumbnail: placeholderThumb(course.title || 'Course') })}>Use placeholder</button>
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">What Students Will Learn</h2>
          <p className="text-sm text-muted mb-3">Add 4–10 outcomes. These map to existing LearnSyra skills.</p>
          {course.outcomes.map((o, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <span className="text-sm pt-2">✓</span>
              <input className="field flex-1 px-3 py-2 text-sm" value={o} onChange={e => update({ outcomes: course.outcomes.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="btn-glass text-xs" aria-label="Move up" onClick={() => update({ outcomes: moveItem(course.outcomes, i, -1) })}>↑</button>
              <button type="button" className="btn-glass text-xs" aria-label="Move down" onClick={() => update({ outcomes: moveItem(course.outcomes, i, 1) })}>↓</button>
              <button type="button" className="btn-glass text-xs" onClick={() => update({ outcomes: course.outcomes.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className="btn-glass text-sm" disabled={course.outcomes.length >= 10} onClick={() => update({ outcomes: [...course.outcomes, ''] })}>Add outcome</button>
            <button type="button" className="btn-glass text-sm" onClick={() => setPending({ kind: 'outcomes', payload: suggestOutcomes(course) })}>Suggest Learning Outcomes</button>
          </div>
          <h3 className="text-base font-black text-ink mt-6 mb-2">Skills Covered</h3>
          <p className="text-xs text-muted mb-2">Choose from the existing platform skill list. Primary skills feed Skill DNA and career matching.</p>
          <SkillPick label="Primary skills" selected={course.primarySkills} onChange={primarySkills => update({ primarySkills })} />
          <SkillPick label="Secondary skills" selected={course.secondarySkills} onChange={secondarySkills => update({ secondarySkills })} />
        </section>
      )}

      {step === 2 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">Course Curriculum</h2>
          {course.modules.length === 0 && <p className="text-sm text-muted mb-3">No modules yet. Add a module to start the outline.</p>}
          {course.modules.map((m, i) => (
            <div key={m.id} className="glass rounded-xl p-4 mb-3">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <strong className="text-ink">Module {i + 1}</strong>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="btn-glass text-xs" onClick={() => { setModIdx(i); goStep(3) }}>Edit</button>
                  <button type="button" className="btn-glass text-xs" onClick={() => setModules([...course.modules.slice(0, i + 1), { ...emptyModule(`${m.title} (copy)`), lessons: m.lessons.map(l => ({ ...l, id: `${l.id}-c` })) }, ...course.modules.slice(i + 1)])}>Duplicate</button>
                  <button type="button" className="btn-glass text-xs" onClick={() => setModules(moveItem(course.modules, i, -1))}>↑</button>
                  <button type="button" className="btn-glass text-xs" onClick={() => setModules(moveItem(course.modules, i, 1))}>↓</button>
                  <button type="button" className="btn-glass text-xs" onClick={() => setModules(course.modules.filter((_, j) => j !== i))}>Delete</button>
                </div>
              </div>
              <input className="field w-full px-3 py-2 text-sm mb-2" value={m.title} onChange={e => setModules(course.modules.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <ul className="text-sm text-muted">
                {m.lessons.map((l, li) => (
                  <li key={l.id}>Lesson {li + 1} · {l.title || 'Untitled'}</li>
                ))}
              </ul>
              <button type="button" className="btn-glass text-xs mt-2" onClick={() => setModules(course.modules.map((x, j) => (j === i ? { ...x, lessons: [...x.lessons, emptyLesson()] } : x)))}>+ Add Lesson</button>
            </div>
          ))}
          <button type="button" className="btn-primary text-sm" onClick={() => setModules([...course.modules, emptyModule(`Module ${course.modules.length + 1}`)])}>+ Add Module</button>
        </section>
      )}

      {step === 3 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">Lesson Editor</h2>
          {course.modules.length === 0 ? (
            <p className="text-sm text-muted">Add a module first.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <label className="text-xs font-semibold text-muted">
                  Module
                  <select className="field w-full mt-1 px-3 py-2 text-sm" value={modIdx} onChange={e => { setModIdx(Number(e.target.value)); setLesIdx(0) }}>
                    {course.modules.map((m, i) => <option key={m.id} value={i}>{m.title}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Lesson
                  <select className="field w-full mt-1 px-3 py-2 text-sm" value={lesIdx} onChange={e => setLesIdx(Number(e.target.value))}>
                    {(module?.lessons ?? []).map((l, i) => <option key={l.id} value={i}>{l.title}</option>)}
                  </select>
                </label>
              </div>
              {module && (
                <div className="glass rounded-xl p-4 mb-4 space-y-2">
                  <h3 className="text-sm font-bold text-ink">Module settings</h3>
                  <Field label="Title" value={module.title} onChange={v => setModules(course.modules.map((m, i) => (i === modIdx ? { ...m, title: v } : m)))} />
                  <Field label="Description" value={module.description} onChange={v => setModules(course.modules.map((m, i) => (i === modIdx ? { ...m, description: v } : m)))} multiline />
                  <Field label="Learning objective" value={module.objective} onChange={v => setModules(course.modules.map((m, i) => (i === modIdx ? { ...m, objective: v } : m)))} />
                  <label className="text-xs font-semibold text-muted">
                    Estimated duration (min)
                    <input type="number" className="field w-full mt-1 px-3 py-2 text-sm" value={module.durationMin} onChange={e => setModules(course.modules.map((m, i) => (i === modIdx ? { ...m, durationMin: Number(e.target.value) || 0 } : m)))} />
                  </label>
                  <label className="text-sm text-ink flex items-center gap-2">
                    <input type="checkbox" checked={module.requireComplete} onChange={e => setModules(course.modules.map((m, i) => (i === modIdx ? { ...m, requireComplete: e.target.checked } : m)))} />
                    Require module completion
                  </label>
                </div>
              )}
              {lesson && (
                <div className="space-y-3">
                  <Field label="Lesson title" value={lesson.title} onChange={v => setLesson({ ...lesson, title: v })} />
                  <Field label="Description" value={lesson.description} onChange={v => setLesson({ ...lesson, description: v })} multiline />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-muted">
                      Estimated duration (min)
                      <input type="number" className="field w-full mt-1 px-3 py-2 text-sm" value={lesson.durationMin} onChange={e => setLesson({ ...lesson, durationMin: Number(e.target.value) || 0 })} />
                    </label>
                    <label className="text-xs font-semibold text-muted">
                      Lesson type
                      <select className="field w-full mt-1 px-3 py-2 text-sm capitalize" value={lesson.kind} onChange={e => setLesson({ ...lesson, kind: e.target.value as LessonKind })}>
                        {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </label>
                  </div>
                  {(lesson.kind === 'article' || lesson.kind === 'assignment' || lesson.kind === 'project') && (
                    <label className="block text-xs font-semibold text-muted">
                      Content (headings, lists, and code can be written in Markdown)
                      <textarea className="field w-full mt-1 px-3 py-2 text-sm font-mono" rows={8} value={lesson.body} onChange={e => setLesson({ ...lesson, body: e.target.value })} />
                    </label>
                  )}
                  {lesson.kind === 'video' && (
                    <div>
                      <Field label="Video URL" value={lesson.videoUrl} onChange={v => setLesson({ ...lesson, videoUrl: v })} />
                      {lesson.videoUrl && /youtube|youtu\.be|vimeo|\.mp4/i.test(lesson.videoUrl) && (
                        <p className="text-xs text-muted mt-1">Preview available on the student lesson player. This studio does not process video files.</p>
                      )}
                    </div>
                  )}
                  {lesson.kind === 'code' && (
                    <div className="space-y-2">
                      <Field label="Language" value={lesson.language} onChange={v => setLesson({ ...lesson, language: v })} />
                      <Field label="Instructions" value={lesson.instructions} onChange={v => setLesson({ ...lesson, instructions: v })} multiline />
                      <Field label="Starter code" value={lesson.starterCode} onChange={v => setLesson({ ...lesson, starterCode: v })} multiline />
                      <Field label="Expected output" value={lesson.expectedOutput} onChange={v => setLesson({ ...lesson, expectedOutput: v })} />
                      <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutor/projects')}>Practice in Workspace →</button>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-ink mb-2">Resources</h3>
                    {lesson.resources.map((r, ri) => (
                      <div key={ri} className="flex gap-2 mb-2">
                        <input className="field flex-1 px-2 py-1 text-sm" value={r.label} placeholder="Label" onChange={e => setLesson({ ...lesson, resources: lesson.resources.map((x, j) => (j === ri ? { ...x, label: e.target.value } : x)) })} />
                        <input className="field flex-1 px-2 py-1 text-sm" value={r.url} placeholder="URL" onChange={e => setLesson({ ...lesson, resources: lesson.resources.map((x, j) => (j === ri ? { ...x, url: e.target.value } : x)) })} />
                      </div>
                    ))}
                    <button type="button" className="btn-glass text-xs" onClick={() => setLesson({ ...lesson, resources: [...lesson.resources, { label: '', url: '' }] })}>Add URL resource</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="space-y-5">
          <div className="glass rounded-2xl p-5">
            <h2 className="text-lg font-black text-ink mb-3">Quiz Builder</h2>
            {course.quizzes.length === 0 && <p className="text-sm text-muted mb-3">No quiz yet.</p>}
            {course.quizzes.map((quiz, qi) => (
              <QuizEditor key={quiz.id} quiz={quiz} onChange={next => update({ quizzes: course.quizzes.map((q, i) => (i === qi ? next : q)) })} onDelete={() => update({ quizzes: course.quizzes.filter((_, i) => i !== qi) })} />
            ))}
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" className="btn-glass text-sm" onClick={() => update({ quizzes: [...course.quizzes, emptyQuiz()] })}>Add quiz</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setPending({ kind: 'quiz', payload: suggestQuiz(course) })}>Generate Quiz</button>
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <h2 className="text-lg font-black text-ink mb-3">Practice Task</h2>
            {course.practices.map((p, i) => (
              <PracticeEditor key={p.id} practice={p} onChange={next => update({ practices: course.practices.map((x, j) => (j === i ? next : x)) })} onDelete={() => update({ practices: course.practices.filter((_, j) => j !== i) })} />
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => update({ practices: [...course.practices, emptyPractice()] })}>Save Practice</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setPending({ kind: 'practice', payload: suggestPractice(course) })}>Create Practice Task</button>
            </div>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">Projects</h2>
          <p className="text-sm text-muted mb-3">Attach an existing LearnSyra project. This does not create a second project system.</p>
          <Field label="Final project title" value={course.projectTitle} onChange={v => update({ projectTitle: v })} />
          <label className="block text-xs font-semibold text-muted mt-3">
            Estimated time (hours)
            <input type="number" className="field w-full mt-1 px-3 py-2 text-sm" value={course.projectHours} onChange={e => update({ projectHours: Number(e.target.value) || 0 })} />
          </label>
          <div className="mt-4 space-y-2">
            {projects.slice(0, 12).map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={course.projectIds.includes(p.id)}
                  onChange={e => {
                    const projectIds = e.target.checked ? [...course.projectIds, p.id] : course.projectIds.filter(x => x !== p.id)
                    update({ projectIds, projectTitle: course.projectTitle || (e.target.checked ? p.title : course.projectTitle) })
                  }}
                />
                <span>{p.title}</span>
              </label>
            ))}
          </div>
          <button type="button" className="btn-primary text-sm mt-4" onClick={() => navigate('/tutor/projects')}>Start Project</button>
          <h3 className="text-base font-black text-ink mt-6 mb-2">Course completion requires</h3>
          <label className="block text-xs font-semibold text-muted mb-2">
            Lessons completed (%)
            <input type="number" className="field w-full mt-1 px-3 py-2 text-sm" value={course.requirements.lessonPct} onChange={e => update({ requirements: { ...course.requirements, lessonPct: Number(e.target.value) || 0 } })} />
          </label>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={course.requirements.requireQuiz} onChange={e => update({ requirements: { ...course.requirements, requireQuiz: e.target.checked } })} />
            Final quiz passed
          </label>
          <label className="block text-xs font-semibold text-muted mb-2">
            Minimum quiz score
            <input type="number" className="field w-full mt-1 px-3 py-2 text-sm" value={course.requirements.minQuizScore} onChange={e => update({ requirements: { ...course.requirements, minQuizScore: Number(e.target.value) || 0 } })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={course.requirements.requireProject} onChange={e => update({ requirements: { ...course.requirements, requireProject: e.target.checked } })} />
            Final project submitted
          </label>
        </section>
      )}

      {step === 6 && (
        <section className="space-y-5">
          <div className="glass rounded-2xl p-5">
            <h2 className="text-lg font-black text-ink mb-2">✨ AI Course Copilot</h2>
            <p className="text-sm text-muted mb-3">Structured actions only. Suggestions never publish themselves and never invent credentials or outcomes.</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'outline', label: 'Generate Course Outline', run: () => setPending({ kind: 'outline', payload: suggestOutline(course.title, course) }) },
                { id: 'outcomes', label: 'Suggest Learning Outcomes', run: () => setPending({ kind: 'outcomes', payload: suggestOutcomes(course) }) },
                { id: 'desc', label: 'Improve Description', run: () => setDescDraft(improveDescription(course.description)) },
                { id: 'missing', label: 'Suggest Missing Lessons', run: () => setPending({ kind: 'missing', payload: suggestMissingLessons(course) }) },
                { id: 'quiz', label: 'Generate Quiz', run: () => setPending({ kind: 'quiz', payload: suggestQuiz(course) }) },
                { id: 'practice', label: 'Create Practice Task', run: () => setPending({ kind: 'practice', payload: suggestPractice(course) }) },
                { id: 'review', label: 'Review Curriculum', run: () => goStep(6) },
                { id: 'diff', label: 'Check Difficulty', run: () => setPending({ kind: 'missing', payload: ['Keep early modules foundational, then add a project before interview prep.'] }) },
              ].map(a => (
                <button key={a.id} type="button" className="btn-glass text-xs" onClick={a.run}>{a.label}</button>
              ))}
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <h2 className="text-lg font-black text-ink mb-3">Curriculum Health</h2>
            {health.map(h => (
              <div key={h.id} className="mb-3">
                <div className={h.tone === 'good' ? 'tc-health-good' : 'tc-health-warn'}>
                  {h.tone === 'good' ? '🟢' : '🟡'} {h.label}: {h.tone === 'good' ? 'Good' : 'Could improve'}
                </div>
                {h.tone === 'warn' && (
                  <div className="mt-1">
                    <div className="text-sm text-muted">{h.rec}</div>
                    <div className="flex gap-2 mt-1">
                      <button type="button" className="btn-primary text-xs" onClick={() => {
                        if (h.id === 'testing') setModules([...course.modules, emptyModule('Testing')])
                        else if (h.id === 'practice') update({ practices: [...course.practices, suggestPractice(course)] })
                        else goStep(2)
                      }}>Apply Recommendation</button>
                      <button type="button" className="btn-glass text-xs" onClick={() => update({ ignoredRecs: [...course.ignoredRecs, h.id] })}>Ignore</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {quality && (
            <div className="glass rounded-2xl p-5">
              <h2 className="text-lg font-black text-ink mb-1">LearnSyra Course Quality Estimate</h2>
              <p className="text-xs text-muted mb-3">This is an internal completeness estimate, not an accreditation or external rating.</p>
              <div className="text-3xl font-black text-ink mb-3">{quality.total} / 100</div>
              {Object.entries({ Content: quality.content, Structure: quality.structure, Practice: quality.practice, Projects: quality.projects, Assessment: quality.assessment, Accessibility: quality.accessibility }).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm text-muted"><span>{k}</span><span>{v}</span></div>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 7 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="text-lg font-black text-ink mb-3">Course Pricing</h2>
          <div className="flex gap-2 mb-4">
            <button type="button" className="tc-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={course.pricing.mode === 'free'} onClick={() => update({ pricing: { ...course.pricing, mode: 'free', priceInr: 0 } })}>Free</button>
            <button type="button" className="tc-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={course.pricing.mode === 'paid'} onClick={() => update({ pricing: { ...course.pricing, mode: 'paid', priceInr: course.pricing.priceInr || 1499 } })}>Paid</button>
          </div>
          {course.pricing.mode === 'paid' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-muted">
                Price (INR)
                <input type="number" className="field w-full mt-1 px-3 py-2 text-sm" value={course.pricing.priceInr} onChange={e => update({ pricing: { ...course.pricing, priceInr: Number(e.target.value) || 0 } })} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Original price (optional)
                <input type="number" className="field w-full mt-1 px-3 py-2 text-sm" value={course.pricing.originalInr} onChange={e => update({ pricing: { ...course.pricing, originalInr: Number(e.target.value) || 0 } })} />
              </label>
            </div>
          )}
          <p className="text-sm text-muted mt-4">Listed price: {course.pricing.mode === 'paid' ? formatInr(course.pricing.priceInr) : 'Free'}</p>
          <h3 className="text-sm font-bold text-ink mt-4">Tutor Earnings Estimate</h3>
          <p className="text-sm text-muted">Revenue estimate available after pricing and commission configuration.</p>
          <button type="button" className="btn-glass text-xs mt-3" onClick={() => navigate('/tutor/earnings')}>View Earnings →</button>
        </section>
      )}

      {step === 8 && (
        <section className="glass rounded-2xl p-5">
          <h2 className="text-lg font-black text-ink mb-2">Student Preview</h2>
          <p className="text-sm text-muted mb-4">Opens the existing student course design. This studio does not create a second visual system.</p>
          <ul className="text-sm text-muted mb-4 list-disc pl-5">
            <li>Hero, instructor, outcomes, curriculum, projects</li>
            <li>AI assistance and tutor support CTAs stay on the student page</li>
          </ul>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate(tutorCoursePreviewPath(course.id))}>Open student preview</button>
        </section>
      )}

      {step === 9 && (
        <section className="space-y-5">
          <div className="glass rounded-2xl p-5">
            <h2 className="text-lg font-black text-ink mb-2">Ready to Publish?</h2>
            <div className="text-sm font-bold text-ink mb-3">Course Readiness {readinessPct(checks)}%</div>
            <ul className="text-sm space-y-1 mb-4">
              {checks.map(c => (
                <li key={c.id}>{c.ok ? '✓' : '⚠'} {c.label}{!c.required ? ' (optional)' : ''}</li>
              ))}
            </ul>
            {missing.length > 0 && (
              <p className="text-sm mb-3" style={{ color: '#b45309' }}>Missing: {missing.map(m => m.label).join(', ')}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" disabled={!canPublish || busy} onClick={publish}>
                {busy ? 'Publishing…' : 'Publish'}
              </button>
              <button type="button" className="btn-glass text-sm" onClick={() => update({ status: 'review' })}>Submit for review</button>
              {course.status === 'published' && (
                <>
                  <button type="button" className="btn-glass text-sm" onClick={() => update({ status: 'paused' })}>Pause</button>
                  <button type="button" className="btn-glass text-sm" onClick={() => update({ status: 'archived' })}>Archive</button>
                </>
              )}
              {course.status === 'draft' && (
                <button type="button" className="btn-glass text-sm" onClick={() => {
                  if (window.confirm('Delete this draft?')) {
                    deleteStudioCourse(course.id, tutorId)
                    navigate('/tutor/courses')
                  }
                }}>Delete Draft</button>
              )}
              <button type="button" className="btn-glass text-sm" onClick={() => {
                const copy = duplicateCourse(course, tutorId)
                navigate(`/tutor/courses/${copy.id}`)
              }}>Duplicate Course</button>
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <h2 className="text-lg font-black text-ink mb-2">Course Performance</h2>
            <p className="text-sm text-muted">No student data yet</p>
            <p className="text-sm text-muted">No reviews yet</p>
            <p className="text-sm text-muted">No revenue yet</p>
            <button type="button" className="btn-glass text-xs mt-3" onClick={() => navigate('/tutor/analytics')}>Open Analytics →</button>
          </div>
          <div className="glass rounded-2xl p-5">
            <h2 className="text-lg font-black text-ink mb-2">Student Questions</h2>
            <p className="text-sm text-muted">Student discussions will appear here when messaging is enabled.</p>
          </div>
        </section>
      )}

      {pending && (
        <div className="tc-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ai-sugg">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setPending(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-lg">
            <h2 id="ai-sugg" className="text-lg font-black text-ink mb-2">AI Suggested</h2>
            <pre className="text-sm text-muted whitespace-pre-wrap mb-4">{Array.isArray(pending.payload) ? (pending.payload as string[]).map((t, i) => `${i + 1}. ${t}`).join('\n') : JSON.stringify(pending.payload, null, 2)}</pre>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => {
                if (pending.kind === 'outline') persist(applyOutline(course, pending.payload as string[]))
                if (pending.kind === 'outcomes') update({ outcomes: pending.payload as string[] })
                if (pending.kind === 'quiz') update({ quizzes: [...course.quizzes, pending.payload as StudioQuiz] })
                if (pending.kind === 'practice') update({ practices: [...course.practices, pending.payload as StudioPractice] })
                if (pending.kind === 'missing') {
                  const titles = pending.payload as string[]
                  const last = course.modules[course.modules.length - 1]
                  if (last) setModules(course.modules.map((m, i) => i === course.modules.length - 1 ? { ...m, lessons: [...m.lessons, ...titles.map(t => emptyLesson(t))] } : m))
                  else setModules(titles.map(t => emptyModule(t)))
                }
                setPending(null)
              }}>Accept</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setPending(null)}>Reject</button>
            </div>
          </div>
        </div>
      )}

      <div className="tc-sticky -mx-4 sm:-mx-6 mt-8 px-4 sm:px-6 py-3 flex flex-wrap gap-2">
        <button type="button" className="btn-glass text-sm" onClick={() => persist(course)}>Save Draft</button>
        <button type="button" className="btn-glass text-sm" onClick={() => navigate(tutorCoursePreviewPath(course.id))}>Preview</button>
        <button type="button" className="btn-glass text-sm" disabled={step === 0} onClick={() => goStep(Math.max(0, step - 1))}>Back</button>
        <button type="button" className="btn-primary text-sm ml-auto" disabled={step >= STUDIO_STEPS.length - 1} onClick={() => goStep(Math.min(STUDIO_STEPS.length - 1, step + 1))}>Continue</button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-muted">
      {label}
      {multiline ? (
        <textarea className="field w-full mt-1 px-3 py-2 text-sm" rows={4} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className="field w-full mt-1 px-3 py-2 text-sm" value={value} onChange={e => onChange(e.target.value)} />
      )}
    </label>
  )
}

function SkillPick({ label, selected, onChange }: { label: string; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="mb-3">
      <legend className="text-xs font-semibold text-muted mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {PLATFORM_SKILLS.map(s => (
          <button
            key={s}
            type="button"
            className="tc-chip rounded-full px-3 py-1.5 text-xs font-semibold"
            data-on={selected.includes(s)}
            aria-pressed={selected.includes(s)}
            onClick={() => onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s])}
          >
            {s}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function QuizEditor({ quiz, onChange, onDelete }: { quiz: StudioQuiz; onChange: (q: StudioQuiz) => void; onDelete: () => void }) {
  const setQ = (i: number, next: StudioQuizQuestion) => onChange({ ...quiz, questions: quiz.questions.map((q, j) => (j === i ? next : q)) })
  return (
    <div className="glass rounded-xl p-4 mb-3">
      <Field label="Quiz title" value={quiz.title} onChange={v => onChange({ ...quiz, title: v })} />
      <div className="grid sm:grid-cols-3 gap-2 my-2">
        <label className="text-xs font-semibold text-muted">Passing score<input type="number" className="field w-full mt-1 px-2 py-1 text-sm" value={quiz.passingScore} onChange={e => onChange({ ...quiz, passingScore: Number(e.target.value) || 0 })} /></label>
        <label className="text-xs font-semibold text-muted">Attempts<input type="number" className="field w-full mt-1 px-2 py-1 text-sm" value={quiz.attempts} onChange={e => onChange({ ...quiz, attempts: Number(e.target.value) || 1 })} /></label>
        <label className="text-sm flex items-center gap-2 mt-5"><input type="checkbox" checked={quiz.randomize} onChange={e => onChange({ ...quiz, randomize: e.target.checked })} /> Randomize</label>
      </div>
      {quiz.questions.map((q, i) => (
        <div key={q.id} className="border-t pt-3 mt-3" style={{ borderColor: 'rgba(99,102,241,0.12)' }}>
          <Field label="Question" value={q.prompt} onChange={v => setQ(i, { ...q, prompt: v })} />
          <label className="text-xs font-semibold text-muted">
            Type
            <select className="field w-full mt-1 px-2 py-1 text-sm mb-2" value={q.kind} onChange={e => setQ(i, { ...q, kind: e.target.value as StudioQuizQuestion['kind'], options: e.target.value === 'tf' ? ['True', 'False'] : q.options })}>
              <option value="mcq">Multiple choice</option>
              <option value="tf">True / False</option>
              <option value="multi">Multiple answer</option>
            </select>
          </label>
          {q.options.map((opt, oi) => (
            <label key={oi} className="flex items-center gap-2 mb-1 text-sm">
              <input
                type={q.kind === 'multi' ? 'checkbox' : 'radio'}
                name={`${q.id}-ans`}
                checked={q.answers.includes(oi)}
                onChange={() => setQ(i, { ...q, answers: q.kind === 'multi' ? (q.answers.includes(oi) ? q.answers.filter(x => x !== oi) : [...q.answers, oi]) : [oi] })}
              />
              <input className="field flex-1 px-2 py-1 text-sm" value={opt} onChange={e => setQ(i, { ...q, options: q.options.map((x, j) => (j === oi ? e.target.value : x)) })} />
            </label>
          ))}
          <Field label="Explanation" value={q.explanation} onChange={v => setQ(i, { ...q, explanation: v })} />
          <div className="flex gap-2 mt-2">
            <button type="button" className="btn-glass text-xs" onClick={() => onChange({ ...quiz, questions: [...quiz.questions.slice(0, i + 1), { ...q, id: `${q.id}-c` }, ...quiz.questions.slice(i + 1)] })}>Duplicate</button>
            <button type="button" className="btn-glass text-xs" onClick={() => onChange({ ...quiz, questions: quiz.questions.filter((_, j) => j !== i) })}>Delete</button>
            <button type="button" className="btn-glass text-xs" onClick={() => onChange({ ...quiz, questions: moveItem(quiz.questions, i, -1) })}>↑</button>
            <button type="button" className="btn-glass text-xs" onClick={() => onChange({ ...quiz, questions: moveItem(quiz.questions, i, 1) })}>↓</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn-glass text-xs mt-2" onClick={() => onChange({ ...quiz, questions: [...quiz.questions, { id: `qq-${Date.now()}`, kind: 'mcq', prompt: '', options: ['', '', '', ''], answers: [0], explanation: '', difficulty: 'Beginner', points: 1 }] })}>Add Question</button>
      <button type="button" className="btn-glass text-xs mt-2 ml-2" onClick={onDelete}>Remove quiz</button>
    </div>
  )
}

function PracticeEditor({ practice, onChange, onDelete }: { practice: StudioPractice; onChange: (p: StudioPractice) => void; onDelete: () => void }) {
  return (
    <div className="glass rounded-xl p-4 mb-3 space-y-2">
      <Field label="Title" value={practice.title} onChange={v => onChange({ ...practice, title: v })} />
      <Field label="Instructions" value={practice.instructions} onChange={v => onChange({ ...practice, instructions: v })} multiline />
      <label className="text-xs font-semibold text-muted">
        Difficulty
        <select className="field w-full mt-1 px-3 py-2 text-sm" value={practice.difficulty} onChange={e => onChange({ ...practice, difficulty: e.target.value as CourseLevel })}>
          {COURSE_LEVELS.map(l => <option key={l}>{l}</option>)}
        </select>
      </label>
      <SkillPick label="Skills" selected={practice.skills} onChange={skills => onChange({ ...practice, skills })} />
      <Field label="Expected outcome" value={practice.expected} onChange={v => onChange({ ...practice, expected: v })} />
      <Field label="Hints" value={practice.hints.join('\n')} onChange={v => onChange({ ...practice, hints: v.split('\n') })} multiline />
      <button type="button" className="btn-glass text-xs" onClick={onDelete}>Remove</button>
    </div>
  )
}
