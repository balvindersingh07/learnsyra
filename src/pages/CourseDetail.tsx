import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Page } from '../App'
import { useAuth } from '../context/AuthContext'
import {
  categoryStyle,
  enrollInCourse,
  getBookmarks,
  getCompletedLessonIds,
  getCourse,
  getCourseCurriculum,
  getCourseReviews,
  getCourses,
  getMyEnrollments,
  submitCourseReview,
  toggleBookmark,
  type CourseLesson,
  type CourseModule,
  type CourseReview,
  type CourseRow,
} from '../lib/api'
import { setPendingAiPrompt } from '../lib/dashboardIntel'
import {
  formatInr,
  formatStudents,
  loadLocalWishlist,
  saveLocalWishlist,
  type CatalogCourse,
} from '../lib/courseCatalog'
import {
  getCourseDetailPack,
  loadLocalEnroll,
  modulesToFallback,
  resolveCatalogCourse,
  saveLocalEnroll,
  type CourseDetailPack,
  type DetailSection,
} from '../lib/courseDetail'
import { lessonPath } from '../lib/paths'
import './course-detail.css'

interface Props {
  onNav: (p: Page, extra?: string) => void
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xl font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
      {children}
    </h2>
  )
}

export default function CourseDetail({ onNav }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [apiCourse, setApiCourse] = useState<CourseRow | null>(null)
  const [packCourse, setPackCourse] = useState<CatalogCourse | null>(null)
  const [pack, setPack] = useState<CourseDetailPack | null>(null)
  const [modules, setModules] = useState<CourseModule[]>([])
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [enrolled, setEnrolled] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(0)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [preview, setPreview] = useState<{ title: string; minutes: number } | null>(null)
  const [certOpen, setCertOpen] = useState(false)
  const [reviews, setReviews] = useState<CourseReview[]>([])
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const ping = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }

  useEffect(() => {
    if (!id) return
    let alive = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const [row, curr, all, revs] = await Promise.all([
          getCourse(id).catch(() => null),
          getCourseCurriculum(id).catch(() => [] as CourseModule[]),
          getCourses().catch(() => [] as CourseRow[]),
          getCourseReviews(id).catch(() => [] as CourseReview[]),
        ])
        if (!alive) return
        const resolved = resolveCatalogCourse(id, all, row)
        setApiCourse(row)
        setPackCourse(resolved)
        setPack(resolved ? getCourseDetailPack(resolved) : null)
        setModules(curr)
        setReviews(revs)
        const localWish = new Set(loadLocalWishlist())
        const localEnroll = loadLocalEnroll()
        setBookmarked(localWish.has(id) || localWish.has(resolved?.id ?? ''))
        setEnrolled(localEnroll.includes(id))
        if (session && row) {
          const [done, marks, ens] = await Promise.all([
            getCompletedLessonIds(id).catch(() => [] as string[]),
            getBookmarks().catch(() => [] as string[]),
            getMyEnrollments().catch(() => []),
          ])
          if (!alive) return
          setCompleted(new Set(done))
          setBookmarked(marks.includes(id) || localWish.has(id))
          const mine = ens.find(e => e.course_id === id)
          setEnrolled(Boolean(mine) || localEnroll.includes(id))
          if (mine) setProgress(mine.progress)
          else if (done.length && curr.length) {
            const total = curr.flatMap(m => m.lessons).length
            setProgress(total ? Math.round((done.length / total) * 100) : 0)
          }
        } else if (localEnroll.includes(id)) {
          setProgress(0)
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load course')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [id, session?.user.id])

  const allLessons = useMemo(() => modules.flatMap(m => m.lessons), [modules])
  const fallbackSections = pack?.sections ?? []
  const apiSections = modulesToFallback(modules)
  const sections: DetailSection[] = apiSections && apiSections.length ? apiSections : fallbackSections
  const course = packCourse
  const { icon, color } = categoryStyle(
    course?.category === 'AI & Machine Learning' ? 'AI & ML' : course?.category ?? null,
  )

  const hours = course?.durationHours || pack?.sections.reduce((s, sec) => s + sec.hours, 0) || 0
  const lessonCount = allLessons.length || pack?.lessonCount || 0
  const rating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : (course?.rating && course.rating > 0 ? course.rating : null)
  const students = course?.students ?? null
  const price = course?.price ?? 0
  const original = course?.originalPrice
  const off = original && price > 0 ? Math.round((1 - price / original) * 100) : 0
  const displayProgress = enrolled ? progress || 0 : 0

  const goAi = (prompt: string) => {
    setPendingAiPrompt(prompt)
    onNav('ai-learning')
  }

  const continueLearning = () => {
    if (!id) return
    const next = allLessons.find(l => !completed.has(l.id)) ?? allLessons[0]
    if (next) navigate(lessonPath(id, next.id))
    else ping('Lessons unlock after this course is published in your account.')
  }

  const handleSubmitReview = async () => {
    if (!id || !apiCourse) return
    setReviewBusy(true)
    const { error: revErr } = await submitCourseReview(id, reviewRating, reviewBody.trim())
    setReviewBusy(false)
    if (revErr) {
      ping(revErr)
      return
    }
    const revs = await getCourseReviews(id).catch(() => [] as CourseReview[])
    setReviews(revs)
    ping('Review saved')
  }

  const handleEnroll = async () => {
    if (!id) return
    if (!session) {
      onNav('login')
      return
    }
    setBusy(true)
    setError(null)
    if (id.startsWith('catalog-') || !apiCourse) {
      saveLocalEnroll([...new Set([...loadLocalEnroll(), id])])
      setEnrolled(true)
      if (/full stack/i.test(course?.title ?? '')) setProgress(67)
      setBusy(false)
      ping('You are enrolled')
      return
    }
    const { error: err } = await enrollInCourse(id)
    setBusy(false)
    if (err) setError(err)
    else {
      setEnrolled(true)
      continueLearning()
    }
  }

  const handlePreviewLesson = (lesson: CourseLesson) => {
    if (lesson.is_free || enrolled) void (enrolled ? continueTo(lesson) : setPreview({ title: lesson.title, minutes: lesson.duration_min }))
  }

  const continueTo = async (lesson: CourseLesson) => {
    if (!id || !session) {
      onNav('login')
      return
    }
    navigate(lessonPath(id, lesson.id))
  }

  const handleBookmark = async () => {
    if (!id) return
    const on = !bookmarked
    setBookmarked(on)
    const ids = new Set(loadLocalWishlist())
    if (on) ids.add(id)
    else ids.delete(id)
    saveLocalWishlist([...ids])
    ping(on ? 'Saved to wishlist' : 'Removed from wishlist')
    if (session && apiCourse) {
      try {
        await toggleBookmark(id)
      } catch {
        /* local already updated */
      }
    }
  }

  if (loading) {
    return (
      <div className="pt-24 px-6 max-w-5xl mx-auto">
        <div className="dash-skel h-8 w-64 mb-6" />
        <div className="dash-skel h-40 w-full mb-4" />
        <div className="dash-skel h-24 w-full" />
      </div>
    )
  }

  if (!course || !pack) {
    return (
      <div className="pt-24 px-6 max-w-3xl mx-auto">
        <div className="glass rounded-2xl p-10 text-center">
          <p className="text-muted mb-4">{error ?? 'Course not found.'}</p>
          <button type="button" className="btn-primary" onClick={() => onNav('courses')}>
            Back to catalog
          </button>
        </div>
      </div>
    )
  }

  const primary = enrolled ? (
    <button type="button" className="w-full btn-primary text-sm py-3" onClick={continueLearning}>
      Continue Learning →
    </button>
  ) : (
    <button type="button" className="w-full btn-primary text-sm py-3" disabled={busy} onClick={handleEnroll}>
      {busy ? '…' : 'Enroll Now →'}
    </button>
  )

  return (
    <div className="pt-20 px-6 pb-28 max-w-7xl mx-auto overflow-x-hidden">
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-2 text-sm font-semibold text-ink">
          {toast}
        </div>
      )}

      <nav className="text-sm text-muted mb-6 flex flex-wrap gap-1">
        <button type="button" className="hover:text-primary cursor-pointer" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => onNav('courses')}>
          Explore Courses
        </button>
        <span>→</span>
        <button
          type="button"
          className="hover:text-primary cursor-pointer"
          style={{ background: 'none', border: 'none', padding: 0 }}
          onClick={() => onNav('courses')}
        >
          {course.category}
        </button>
        <span>→</span>
        <span className="text-ink">{course.title}</span>
      </nav>

      <section className="grid lg:grid-cols-3 gap-8 items-start mb-10">
            <div className="lg:col-span-2">
          <div className="flex flex-wrap gap-2 mb-3">
            {(course.aiRecommended ? ['AI Recommended', 'Career Relevant'] : []).concat(course.tutorSupport ? ['Tutor Supported'] : []).map(b => (
              <span key={b} className="badge badge-primary">{b}</span>
            ))}
            {course.price === 0 && <span className="badge badge-green">Free</span>}
              </div>
              <h1
            className="text-3xl md:text-4xl font-black text-ink leading-tight mb-3"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
              >
            {course.title}
              </h1>
          {course.demo && <div className="badge badge-amber mb-3">Demo Course — Not Production Data</div>}
          <p className="text-muted text-base md:text-lg leading-relaxed mb-4">{pack.subtitle}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted mb-4">
            <span className="font-semibold text-ink">{rating != null ? `⭐ ${rating.toFixed(1)}` : '—'}</span>
            <span>{formatStudents(students)}</span>
            {hours > 0 && <span>{hours} hours</span>}
            <span>{course.level}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {course.skills.map(s => (
              <span key={s} className="badge badge-primary">{s}</span>
            ))}
                </div>
          <div className="text-xs text-subtle">{pack.updated}</div>
              </div>

        <aside className="glass rounded-2xl p-5 lg:sticky lg:top-24 dash-elevate">
          <button
            type="button"
            className="relative w-full rounded-xl h-36 mb-4 overflow-hidden cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${color}33, ${color}10)`, border: 'none' }}
            onClick={() => setPreview({ title: 'Introduction to Full Stack Development', minutes: 8 })}
            aria-label="Preview course"
          >
            <span className="text-5xl">{icon}</span>
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-sm font-semibold">
              ▶ Preview Course
            </span>
          </button>
          {price === 0 ? (
            <div className="text-3xl font-black text-success mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Free</div>
          ) : (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{formatInr(price)}</span>
              {original && <span className="text-sm text-subtle line-through">{formatInr(original)}</span>}
              {off > 0 && <span className="badge badge-amber">{off}% OFF</span>}
                  </div>
          )}
          {enrolled && (
            <div className="text-sm text-muted mb-3">
              <span className="font-semibold text-ink">{displayProgress}% Complete</span>
              <div>Continue where you left off</div>
            </div>
          )}
          <div className="mb-2">{primary}</div>
          <button
            type="button"
            className={`w-full btn-glass text-sm py-2.5 mb-3 ${bookmarked ? 'wish-pop' : ''}`}
            onClick={handleBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {bookmarked ? '♥ Saved' : '♡ Add to Wishlist'}
              </button>
          {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
          <ul className="text-sm text-muted space-y-1.5">
            <li>30-day learning access</li>
            <li>Certificate included</li>
            <li>AI Tutor included</li>
            <li>Tutor support available</li>
          </ul>
        </aside>
      </section>

      {pack.matchCopy ? (
      <section className="glass rounded-2xl p-5 md:p-6 mb-8">
        <SectionTitle>Explore this course</SectionTitle>
        {course.demo && <div className="badge badge-amber mb-2">Demo Course — Not Production Data</div>}
        <p className="text-sm text-muted leading-relaxed mb-4">{pack.matchCopy}</p>
        {pack.match > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-semibold text-ink mb-1">Your Match</div>
            <div className="text-3xl font-black gradient-text mb-2">{pack.match}%</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pack.match}%` }} />
            </div>
          </div>
          <ul className="text-sm space-y-1">
            {pack.skillBreakdown.map(s => (
              <li key={s.name} className={s.state === 'have' ? 'text-success' : 'text-muted'}>
                {s.name} {s.state === 'have' ? '✓' : '→ Improve'}
              </li>
            ))}
          </ul>
        </div>
        )}
        <button type="button" className="btn-primary text-sm mt-4" onClick={() => onNav('career')}>
          View career center →
        </button>
      </section>
      ) : null}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        {[
          { v: hours > 0 ? `${hours} Hours` : '—', l: 'Course duration' },
          { v: lessonCount > 0 ? `${lessonCount} Lessons` : '—', l: 'Lessons' },
          { v: pack.projectCount > 0 ? `${pack.projectCount} Projects` : '—', l: 'Practical work' },
          { v: rating != null ? `${rating.toFixed(1)} ⭐` : '—', l: 'Student rating' },
          { v: students == null ? '—' : formatStudents(students).replace(' students', '').replace('No student data yet.', '—'), l: 'Students' },
        ].map(s => (
          <div key={s.l} className="glass rounded-2xl p-4 text-center">
            <div className="text-sm font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{s.v}</div>
            <div className="text-xs text-muted mt-1">{s.l}</div>
                  </div>
        ))}
      </section>

      {pack.outcomes.length > 0 && (
      <section className="mb-10">
        <SectionTitle>🎯 What You&apos;ll Learn</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-2">
          {pack.outcomes.map(o => (
            <div key={o} className="glass rounded-xl px-4 py-3 text-sm text-ink">✓ {o}</div>
                ))}
              </div>
      </section>
      )}

      {pack.skillLevels.length > 0 && (
      <section className="mb-10">
        <SectionTitle>🧬 Skills You&apos;ll Gain</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {pack.skillLevels.map(s => (
            <div key={s.name} className="glass rounded-2xl p-4 card-hover">
              <div className="text-sm font-bold text-ink">{s.name}</div>
              <div className="text-xs text-primary mt-1">{s.level}</div>
                      </div>
                    ))}
                  </div>
      </section>
      )}

      <section className="mb-10">
        <SectionTitle>📚 Course Curriculum</SectionTitle>
        <p className="text-sm text-muted mb-4">
          {sections.length > 0 ? `${sections.length} Sections · ${lessonCount} Lessons${hours > 0 ? ` · ${hours}h total` : ''}` : 'Curriculum not published yet.'}
        </p>
        <div className="space-y-2">
          {sections.map((sec, i) => (
            <div key={sec.title} className="glass rounded-2xl overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                style={{ background: 'none', border: 'none' }}
                onClick={() => setExpanded(expanded === i ? null : i)}
                aria-expanded={expanded === i}
              >
                  <div>
                  <div className="text-sm font-bold text-ink">
                    {String(i + 1).padStart(2, '0')} — {sec.title}
                  </div>
                  <div className="text-xs text-muted">{sec.lessons.length} lessons · {sec.hours}h</div>
                </div>
                <span className="text-muted">{expanded === i ? '▴' : '▾'}</span>
                  </button>
              <div className="cd-acc" data-open={expanded === i}>
                <div>
                  {sec.lessons.map((lesson, li) => {
                    const apiLesson = modules[i]?.lessons[li]
                    const done = apiLesson ? completed.has(apiLesson.id) : false
                    const canOpen = Boolean(lesson.preview || (apiLesson?.is_free) || enrolled)
                    return (
                      <div
                        key={`${sec.title}-${li}`}
                        className="flex items-center gap-3 px-5 py-2.5"
                        style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}
                      >
                        <span className="text-xs text-subtle w-6">{String(li + 1).padStart(2, '0')}</span>
                        <div className="flex-1 min-w-0 text-sm text-ink truncate">{lesson.title}</div>
                        {(lesson.preview || apiLesson?.is_free) && <span className="badge badge-green">FREE PREVIEW</span>}
                        {done && <span className="text-xs text-success">Done</span>}
                        <span className="text-xs text-muted">{lesson.minutes} min</span>
                        {canOpen ? (
                    <button
                            type="button"
                            className="text-xs font-semibold text-primary cursor-pointer"
                      style={{ background: 'none', border: 'none' }}
                            onClick={() => {
                              if (apiLesson && enrolled) void continueTo(apiLesson)
                              else if (apiLesson && apiLesson.is_free) handlePreviewLesson(apiLesson)
                              else setPreview({ title: lesson.title, minutes: lesson.minutes })
                            }}
                          >
                            {enrolled && apiLesson ? 'Open' : 'Watch Preview'}
                          </button>
                        ) : (
                          <span className="text-xs text-subtle">Locked</span>
                        )}
                      </div>
                    )
                  })}
                            </div>
                            </div>
                          </div>
                        ))}
                      </div>
      </section>

      {pack.projects.length > 0 && (
      <section className="mb-10">
        <SectionTitle>🚀 Build Real Projects</SectionTitle>
        <p className="text-sm text-muted mb-4">Don&apos;t just watch. Build.</p>
        <div className="grid md:grid-cols-3 gap-3">
          {pack.projects.map((p, i) => (
            <div key={p.title} className="glass rounded-2xl p-4 card-hover">
              <div className="text-xs text-primary font-semibold mb-1">Project {i + 1}</div>
              <div className="text-sm font-bold text-ink mb-2">{p.title}</div>
              <div className="text-xs text-muted mb-1">Difficulty: {p.difficulty}</div>
              <div className="text-xs text-muted mb-1">{p.skills.join(' · ')}</div>
              <div className="text-xs text-muted mb-3">Estimated: {p.hours} hours</div>
              <div className="text-xs text-muted mb-3">🤖 AI Assistance · 👨‍🏫 Tutor Support</div>
              <button type="button" className="btn-primary text-sm" onClick={() => onNav('projects')}>
                View Project →
              </button>
                  </div>
                ))}
              </div>
      </section>
      )}

      <section className="grid md:grid-cols-2 gap-4 mb-10">
        <div className="glass rounded-2xl p-5">
          <SectionTitle>🤖 Learn With Your AI Tutor</SectionTitle>
          <p className="text-sm text-muted mb-3">Your AI tutor is available while you learn this course.</p>
          <ul className="text-sm text-muted space-y-1 mb-4">
            {['Explain lessons', 'Summarize topics', 'Quiz you', 'Give practice tasks', 'Debug code', 'Generate examples', 'Prepare interview questions'].map(x => (
              <li key={x}>• {x}</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => goAi(`I am taking ${course.title}. Help me learn the current topics, quiz me, and suggest practice.`)}
          >
            Ask LearnSyra AI →
          </button>
        </div>
        <div className="glass rounded-2xl p-5">
          <SectionTitle>👨‍🏫 Need Human Help?</SectionTitle>
          <p className="text-sm text-muted mb-3">Get one-on-one guidance from experienced professionals.</p>
          <div className="text-sm font-bold text-ink">{pack.instructor.name}</div>
          <div className="text-xs text-muted mb-1">{pack.instructor.expertise.slice(0, 3).join(' · ') || 'Tutor support'}</div>
          <div className="text-xs text-muted mb-3">
            {pack.instructor.rating > 0 ? `⭐ ${pack.instructor.rating}` : '—'}
            {pack.instructor.students > 0 ? ` · ${formatStudents(pack.instructor.students)}` : ' · No student data yet.'}
            {pack.instructor.rate > 0 ? ` · ₹${pack.instructor.rate}/hr` : ''}
                    </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-sm" onClick={() => onNav('tutors')}>View Tutor →</button>
            <button type="button" className="btn-glass text-sm" onClick={() => onNav('tutors')}>Book Session →</button>
                    </div>
                  </div>
      </section>

      <section className="glass rounded-2xl p-5 md:p-6 mb-10">
        <SectionTitle>💼 Where This Course Can Take You</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm mb-5">
          {[
            ['Learn', 'React + Node.js'],
            ['Practice', 'AI exercises'],
            ['Build', 'Real projects'],
            ['Prepare', 'Interview practice'],
            ['Career', pack.careerRole],
          ].map(([k, v], i, arr) => (
            <div key={k} className="flex items-center gap-2">
              <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(108,92,231,0.08)' }}>
                <div className="text-xs font-semibold text-primary">{k}</div>
                <div className="text-ink font-medium">{v}</div>
                        </div>
              {i < arr.length - 1 && <span className="text-subtle hidden sm:inline">↓</span>}
                      </div>
                    ))}
                  </div>
        <div className="text-sm font-bold text-ink mb-1">{pack.careerRole}</div>
          {pack.match > 0 && <div className="text-primary font-semibold mb-3">{pack.match}% match</div>}
        <ul className="text-sm space-y-1 mb-4">
          {pack.skillBreakdown.filter(s => s.state === 'have').map(s => (
            <li key={s.name} className="text-success">{s.name} ✓</li>
          ))}
          {pack.nextSkills.map(s => (
            <li key={s} className="text-muted">{s} → Recommended next</li>
          ))}
        </ul>
        <button type="button" className="btn-primary text-sm" onClick={() => onNav('career')}>
          Prepare for This Career →
        </button>
      </section>

      <section className="glass rounded-2xl p-5 mb-10">
        <SectionTitle>🏆 Certificate of Completion</SectionTitle>
        <p className="text-sm text-muted leading-relaxed mb-3">
          Student receives a LearnSyra Certificate after completing course lessons, required quizzes, projects, and the final assessment.
        </p>
        <button type="button" className="btn-glass text-sm" onClick={() => setCertOpen(true)}>
          See Certificate Example
        </button>
      </section>

      <section className="glass rounded-2xl p-5 mb-10">
        <SectionTitle>👨‍🏫 Your Instructor</SectionTitle>
        <div className="text-lg font-bold text-ink">{pack.instructor.name}</div>
        {pack.instructor.role && <div className="text-sm text-muted mb-2">{pack.instructor.role}</div>}
        <div className="text-sm text-muted mb-3">
          {pack.instructor.rating > 0 ? `⭐ ${pack.instructor.rating}` : '—'}
          {pack.instructor.students > 0 ? ` · ${formatStudents(pack.instructor.students)}` : ' · No student data yet.'}
          {pack.instructor.years > 0 ? ` · ${pack.instructor.years} years experience` : ''}
                        </div>
        {pack.instructor.bio && <p className="text-sm text-muted leading-relaxed mb-3">"{pack.instructor.bio}"</p>}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {pack.instructor.expertise.map(x => (
            <span key={x} className="badge badge-primary">{x}</span>
                ))}
              </div>
        <button type="button" className="btn-primary text-sm" onClick={() => onNav('tutors')}>
          View Instructor Profile →
        </button>
      </section>

      <section className="mb-10">
        <SectionTitle>⭐ What Students Say</SectionTitle>
        <div className="text-sm text-muted mb-4">
          {rating != null ? (
            <span className="text-2xl font-black text-ink">{rating.toFixed(1)} / 5</span>
          ) : (
            <span className="text-2xl font-black text-ink">—</span>
          )}
          <span className="ml-2">{reviews.length > 0 ? `${reviews.length} reviews` : 'No reviews yet.'}</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {reviews.length > 0 ? reviews.slice(0, 3).map(r => (
            <div key={r.id} className="glass rounded-2xl p-4">
              <div className="text-amber-500 text-sm mb-2">{'★'.repeat(r.rating)}</div>
              <p className="text-sm text-muted leading-relaxed mb-3">"{r.body || '—'}"</p>
              <div className="text-sm font-semibold text-ink">{r.student?.full_name || 'Student'}</div>
          </div>
          )) : course.demo ? pack.reviews.map(r => (
            <div key={r.name + r.body.slice(0, 12)} className="glass rounded-2xl p-4">
              <div className="badge badge-amber mb-2">Demo Course — Not Production Data</div>
              <div className="text-amber-500 text-sm mb-2">{'★'.repeat(r.rating)}</div>
              <p className="text-sm text-muted leading-relaxed mb-3">"{r.body}"</p>
              <div className="text-sm font-semibold text-ink">{r.name}</div>
            </div>
          )) : (
            <p className="text-sm text-muted">No student reviews yet.</p>
          )}
        </div>
        {enrolled && apiCourse && !course?.demo && session && (
          <div className="glass rounded-2xl p-4 mt-4 max-w-xl">
            <div className="text-sm font-bold text-ink mb-2">Leave a review</div>
            <p className="text-xs text-muted mb-3">Share feedback for this course. You can update your review anytime.</p>
            <div className="flex items-center gap-2 mb-3">
              <label htmlFor="course-review-rating" className="text-xs text-muted">Rating</label>
              <select
                id="course-review-rating"
                value={reviewRating}
                onChange={e => setReviewRating(Number(e.target.value))}
                className="text-sm rounded-lg px-2 py-1"
              >
                {[5, 4, 3, 2, 1].map(n => (
                  <option key={n} value={n}>{n} stars</option>
                ))}
              </select>
            </div>
            <textarea
              value={reviewBody}
              onChange={e => setReviewBody(e.target.value)}
              rows={3}
              placeholder="What did you learn? What could be improved?"
              className="w-full text-sm rounded-xl px-3 py-2 mb-3"
            />
            <button type="button" className="btn-primary text-sm" disabled={reviewBusy} onClick={() => void handleSubmitReview()}>
              {reviewBusy ? 'Saving…' : 'Submit review'}
            </button>
          </div>
        )}
      </section>

      {pack.faqs.length > 0 && (
      <section className="mb-10">
        <SectionTitle>FAQ</SectionTitle>
        <div className="space-y-2">
          {pack.faqs.map((f, i) => (
            <div key={f.q} className="glass rounded-2xl overflow-hidden">
              <button
                type="button"
                className="w-full text-left px-5 py-4 text-sm font-semibold text-ink cursor-pointer"
                style={{ background: 'none', border: 'none' }}
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                aria-expanded={faqOpen === i}
              >
                {f.q}
              </button>
              <div className="cd-acc" data-open={faqOpen === i}>
                <div className="px-5 pb-4 text-sm text-muted leading-relaxed">{f.a}</div>
              </div>
                  </div>
                ))}
              </div>
      </section>
      )}

      <section className="glass rounded-2xl p-6 md:p-8 text-center mb-6">
        <h2 className="text-xl font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Ready to build real skills?
        </h2>
        <div className="text-sm font-semibold text-primary mb-2">Learn. Practice. Build. Prepare.</div>
        <p className="text-sm text-muted mb-4">Start this course and move one step closer to your career goal.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {enrolled ? (
            <button type="button" className="btn-primary text-sm" onClick={continueLearning}>Continue Learning →</button>
          ) : (
            <button type="button" className="btn-primary text-sm" disabled={busy} onClick={handleEnroll}>Enroll Now →</button>
          )}
          <button type="button" className="btn-glass text-sm" onClick={() => goAi(`Help me decide if ${course.title} is the right next course for a ${pack.careerRole} path.`)}>
            Ask LearnSyra AI
          </button>
        </div>
      </section>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-4 py-3 flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.94)', borderTop: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="font-black text-ink">{formatInr(price)}</div>
        {enrolled ? (
          <button type="button" className="btn-primary text-sm" onClick={continueLearning}>Continue →</button>
        ) : (
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={handleEnroll}>Enroll Now →</button>
        )}
            </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.4)' }} onClick={() => setPreview(null)} role="presentation">
          <div className="glass rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <div id="preview-title" className="text-sm font-bold text-ink mb-1">{preview.title}</div>
            <div className="text-xs text-muted mb-4">Duration: 08:32 · FREE PREVIEW</div>
            <div
              className="rounded-xl h-44 flex items-center justify-center mb-4 text-white"
              style={{ background: `linear-gradient(135deg, ${color}, #22C7D6)` }}
            >
              ▶ Preview
                    </div>
            <p className="text-sm text-muted mb-4">This is a sample preview. Full lessons open after you enroll.</p>
            <div className="flex gap-2">
              <button type="button" className="btn-glass text-sm" onClick={() => setPreview(null)}>Close</button>
              {!enrolled && (
                <button type="button" className="btn-primary text-sm" onClick={() => { setPreview(null); void handleEnroll() }}>
                  Enroll Now →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {certOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.4)' }} onClick={() => setCertOpen(false)} role="presentation">
          <div className="glass rounded-2xl p-8 w-full max-w-lg text-center" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="text-xs tracking-widest text-primary mb-2">LEARNSYRA</div>
            <div className="text-lg font-bold text-ink mb-1">Certificate of Completion</div>
            <p className="text-sm text-muted mb-4">{course.title}</p>
            <div className="rounded-xl p-6 mb-4" style={{ border: '1px solid rgba(108,92,231,0.25)', background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(108,92,231,0.06))' }}>
              <div className="text-sm text-muted">Awarded to</div>
              <div className="text-xl font-black gradient-text my-1">Your Name</div>
              <div className="text-xs text-subtle">Lessons · Quizzes · Projects · Final assessment</div>
            </div>
            <button type="button" className="btn-primary text-sm" onClick={() => setCertOpen(false)}>Close</button>
        </div>
      </div>
      )}
    </div>
  )
}
