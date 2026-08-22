import { useEffect, useMemo, useRef, useState } from 'react'
import './ai-learning.css'
import { useAuth } from '../context/AuthContext'
import { useNav } from '../lib/useNav'
import {
  askAiTutor,
  createConversation,
  getCareerProfile,
  getConversationMessages,
  getMyEnrolledCourses,
  getTutorListings,
  listConversations,
  renameConversation,
  saveAiMessage,
  type AiConversation,
  type CourseRow,
  type TutorListing,
} from '../lib/api'
import { takePendingAiPrompt } from '../lib/dashboardIntel'
import {
  buildAiStudentContext,
  coachPrompt,
  COMPOSER_CHIPS,
  EMPTY_PROMPTS,
  loadSavedLessons,
  pickTutor,
  saveLesson,
  SIDEBAR_CAREER,
  SIDEBAR_LEARN,
  SIDEBAR_PRACTICE,
  uid,
  welcomeMessage,
  WELCOME_ACTIONS,
  type AiStudentContext,
  type AiView,
  type ChatMsg,
  type SavedLesson,
} from '../lib/aiLearning'
import AiMarkdown from '../components/ai/AiMarkdown'
import PracticeStudio from '../components/ai/PracticeStudio'
import QuizStudio from '../components/ai/QuizStudio'
import InterviewStudio from '../components/ai/InterviewStudio'

type NavId = AiView | 'recent'

function isPersistable(id: string | null) {
  return Boolean(id && !id.startsWith('local-') && !id.startsWith('seed-'))
}

function TutorCard({
  tutor,
  stuck,
  onFind,
}: {
  tutor: TutorListing | null
  stuck: boolean
  onFind: () => void
}) {
  if (!tutor) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Still stuck?
        </div>
        <p className="text-sm text-muted leading-relaxed mb-3">
          Book a tutor session if you want human help.
        </p>
        <button type="button" className="btn-primary text-sm w-full" onClick={onFind}>
          Find a Tutor →
        </button>
      </div>
    )
  }
  const first = tutor.name.split(' ')[0]
  return (
    <div className="glass rounded-2xl p-4" style={{ borderColor: stuck ? 'rgba(108,92,231,0.28)' : undefined }}>
      <div className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
        Still stuck?
      </div>
      <p className="text-sm text-muted leading-relaxed mb-3">
        Recommended tutor from the marketplace — not a personal assignment unless you book them.
      </p>
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}
        >
          {tutor.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink truncate">{tutor.name}</div>
          <div className="text-xs text-muted truncate">{tutor.expertise || 'Tutor'}</div>
          <div className="text-xs text-muted">
            ⭐ {tutor.rating} · ₹{Math.round(tutor.hourly_rate_cents / 100)}/hr
          </div>
        </div>
      </div>
      <button type="button" className="btn-primary text-sm w-full mb-2" onClick={onFind}>
        Ask {first} →
      </button>
      <button type="button" className="btn-glass text-sm w-full" onClick={onFind}>
        Find More Tutors →
      </button>
    </div>
  )
}

function ContextPanel({
  ctx,
  tutor,
  stuck,
  onPractice,
  onFindTutor,
}: {
  ctx: AiStudentContext
  tutor: TutorListing | null
  stuck: boolean
  onPractice: () => void
  onFindTutor: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🎯 Your Learning Context
        </h3>
        <div className="text-xs text-muted mb-0.5">Course</div>
        <div className="text-sm font-semibold text-ink mb-2">{ctx.courseTitle || 'No course yet'}</div>
        <div className="text-xs text-muted mb-0.5">Current Lesson</div>
        <div className="text-sm font-semibold text-ink mb-2">{ctx.lesson || 'Not started'}</div>
        <div className="text-xs text-muted mb-1">Progress</div>
        <div className="flex items-center gap-2">
          <div className="progress-bar flex-1">
            <div className="progress-fill" style={{ width: `${ctx.progress}%` }} />
          </div>
          <span className="text-xs font-bold text-ink">{ctx.progress}%</span>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          🧬 Skill Snapshot
        </h3>
        <div className="space-y-2.5">
          {ctx.skills.length === 0 && <p className="text-sm text-muted">Skill snapshot appears after you enroll or set a career goal.</p>}
          {ctx.skills.map(sk => (
            <div key={sk.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ink">{sk.name}</span>
                <span className="text-muted">{sk.score}%</span>
              </div>
              <div className="progress-bar-soft">
                <div className="progress-fill" style={{ width: `${sk.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <h3 className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          ⚠️ Focus Area
        </h3>
        <div className="text-sm font-bold text-ink">{ctx.focusSkill || 'Not set'}</div>
        <div className="text-sm text-muted mb-2">{ctx.focusScore > 0 ? `${ctx.focusScore}% proficiency` : 'No focus score yet'}</div>
        <p className="text-sm text-muted leading-relaxed mb-3">
          {ctx.focusSkill ? `Practice ${ctx.focusSkill} next.` : 'Choose a topic to practice when you are ready.'}
        </p>
        <button type="button" className="btn-primary text-sm w-full" onClick={onPractice}>
          Practice Now →
        </button>
      </div>

      <div className="glass rounded-2xl p-4 dash-elevate">
        <h3 className="text-sm font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          ✨ AI Insight
        </h3>
        <p className="text-sm text-muted leading-relaxed mb-3">
          {ctx.insight || 'Insights appear from your actual lessons and practice — nothing is pre-seeded.'}
        </p>
        <button type="button" className="btn-primary text-sm w-full" onClick={onPractice}>
          Practice This →
        </button>
      </div>

      <TutorCard tutor={tutor} stuck={stuck} onFind={onFindTutor} />
    </div>
  )
}

export default function AILearning() {
  const { profile, session } = useAuth()
  const nav = useNav()
  const firstName = (profile?.full_name || '').split(' ')[0]
  const [view, setView] = useState<NavId>('tutor')
  const [enrolled, setEnrolled] = useState<(CourseRow & { progress: number; last_lesson_id: string | null })[]>([])
  const [careerGoal, setCareerGoal] = useState<string | null>(null)
  const [tutor, setTutor] = useState<TutorListing | null>(null)
  const [convos, setConvos] = useState<AiConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [phase, setPhase] = useState<'empty' | 'welcome' | 'chat'>('empty')
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedLesson[]>(() => loadSavedLessons())
  const [stuck, setStuck] = useState(false)
  const [simplerCount, setSimplerCount] = useState(0)
  const [showAllRecent, setShowAllRecent] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [ctxOpen, setCtxOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const ctx = useMemo(
    () => buildAiStudentContext({ firstName, enrolled, careerGoal }),
    [firstName, enrolled, careerGoal],
  )

  const loadList = async () => {
    try {
      const list = await listConversations()
      setConvos(list)
      return list
    } catch {
      setConvos([])
      return [] as AiConversation[]
    }
  }

  useEffect(() => {
    setSaved(loadSavedLessons())
    loadList()
    getMyEnrolledCourses().then(setEnrolled).catch(() => setEnrolled([]))
    getCareerProfile()
      .then(p => setCareerGoal(p?.target_role ?? null))
      .catch(() => setCareerGoal(null))
    getTutorListings()
      .then(list => setTutor(pickTutor(list)))
      .catch(() => setTutor(null))
    const pending = takePendingAiPrompt()
    if (pending) {
      setPhase('welcome')
      setMessages([welcomeMessage(buildAiStudentContext({ firstName, enrolled: [], careerGoal: null }))])
      setInput(pending)
    }
  }, [session?.user.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, phase])

  useEffect(() => {
    if (simplerCount >= 2 || messages.filter(m => m.role === 'user').length >= 3) setStuck(true)
  }, [simplerCount, messages])

  const goView = (id: NavId) => {
    setView(id)
    setNavOpen(false)
    if (id === 'tutor' && phase === 'empty') {
      setPhase('welcome')
      setMessages([welcomeMessage(ctx)])
    }
  }

  const newChat = async () => {
    setError(null)
    setStuck(false)
    setSimplerCount(0)
    setView('tutor')
    setPhase('welcome')
    setMessages([welcomeMessage(ctx)])
    try {
      const created = await createConversation('New conversation')
      if (created) {
        setActiveId(created.id)
        await loadList()
        return
      }
    } catch {
      /* local fallback */
    }
    setActiveId(`local-${uid()}`)
  }

  const openConvo = async (id: string) => {
    setView('tutor')
    setNavOpen(false)
    setActiveId(id)
    try {
      const rows = await getConversationMessages(id)
      if (rows.length === 0) {
        setMessages([welcomeMessage(ctx)])
        setPhase('welcome')
      } else {
        setMessages(rows.map(r => ({
          id: r.id,
          role: r.role === 'user' ? 'user' : 'ai',
          text: r.content,
        })))
        setPhase('chat')
      }
    } catch {
      setMessages([welcomeMessage(ctx)])
      setPhase('welcome')
    }
  }

  const ensureConvo = async (title: string) => {
    if (activeId) return activeId
    try {
      const created = await createConversation(title.slice(0, 48))
      if (created) {
        setActiveId(created.id)
        await loadList()
        return created.id
      }
    } catch {
      /* local */
    }
    const id = `local-${uid()}`
    setActiveId(id)
    return id
  }

  const send = async (text?: string) => {
    const q = (text || input).trim()
    if (!q || isTyping) return
    const lower = q.toLowerCase()
    if (/quiz me|test my knowledge/.test(lower)) {
      setInput('')
      setView('quizzes')
      return
    }
    if (/interview me|prepare me for an interview|prepare me for interview/.test(lower)) {
      setInput('')
      setView('interview')
      return
    }
    if (/^give me a beginner exercise$/.test(lower) || lower === 'practice') {
      setInput('')
      setView('practice')
      return
    }

    setInput('')
    setError(null)
    setPhase('chat')
    setView('tutor')
    const convoId = await ensureConvo(q)
    const userMsg: ChatMsg = { id: uid(), role: 'user', text: q }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)
    try {
      if (isPersistable(convoId)) {
        await saveAiMessage(convoId, 'user', q)
        const row = convos.find(c => c.id === convoId)
        if (row?.title === 'New conversation') {
          await renameConversation(convoId, q.slice(0, 48))
          await loadList()
        }
      }
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'ai')
        .slice(-8)
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }))
      const res = await askAiTutor(history, coachPrompt(ctx, q))
      if ('error' in res) {
        setError(res.error)
        return
      }
      if (isPersistable(convoId)) await saveAiMessage(convoId, 'assistant', res.reply)
      setMessages(m => [...m, { id: uid(), role: 'ai', text: res.reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message')
    } finally {
      setIsTyping(false)
    }
  }

  const onAction = (id: string, prompt: string) => {
    if (id === 'practice') {
      setView('practice')
      return
    }
    if (id === 'quiz') {
      setView('quizzes')
      return
    }
    if (id === 'interview') {
      setView('interview')
      return
    }
    send(prompt)
  }

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setNotice('Copied')
    window.setTimeout(() => setNotice(null), 1600)
  }

  const onSave = (text: string) => {
    setSaved(saveLesson({
      title: /useEffect/i.test(text) ? 'React useEffect Explained' : `${ctx.lesson} Explained`,
      body: text,
      tags: ['React', 'Hooks', 'Beginner'],
    }))
    setNotice('Saved to lessons')
    window.setTimeout(() => setNotice(null), 1600)
  }

  const explainSimpler = () => {
    setSimplerCount(n => n + 1)
    send('Explain useEffect simpler')
  }

  const recentRows = convos.map(c => ({ id: c.id, title: c.title }))
  const visibleRecent = showAllRecent ? recentRows : recentRows.slice(0, 4)

  return (
    <div className="pt-16 ai-workspace flex overflow-hidden">
      {navOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(23,32,51,0.28)' }}
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={`flex-shrink-0 flex flex-col bg-white/80 border-r z-40 ${
          navOpen ? 'fixed inset-y-0 left-0 pt-16 w-[260px]' : 'hidden lg:flex'
        } lg:static lg:flex w-[260px]`}
        style={{ borderColor: 'rgba(99,102,241,0.12)', minHeight: 0 }}
      >
        <div className="p-4 pb-3">
          <div className="text-sm font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            ✨ AI Learning
          </div>
          <button type="button" className="btn-primary w-full text-sm py-2.5" onClick={newChat}>
            + New Conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider px-2 mb-1">Learn</div>
          {SIDEBAR_LEARN.map(item => (
            <button
              key={item.id}
              type="button"
              className="ai-nav-btn w-full text-left px-3 py-2 rounded-xl mb-0.5 text-sm cursor-pointer"
              data-active={view === item.id}
              style={{ border: 'none', color: '#172033', background: 'transparent' }}
              onClick={() => {
                if (item.id === 'recent') setView('recent')
                else goView(item.id)
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider px-2 mt-3 mb-1">Practice</div>
          {SIDEBAR_PRACTICE.map(item => (
            <button
              key={item.id}
              type="button"
              className="ai-nav-btn w-full text-left px-3 py-2 rounded-xl mb-0.5 text-sm cursor-pointer"
              data-active={view === item.id}
              style={{ border: 'none', color: '#172033', background: 'transparent' }}
              onClick={() => goView(item.id)}
            >
              {item.icon} {item.label}
            </button>
          ))}
          <div className="text-[11px] font-semibold text-muted uppercase tracking-wider px-2 mt-3 mb-1">Career</div>
          {SIDEBAR_CAREER.map(item => (
            <button
              key={item.id}
              type="button"
              className="ai-nav-btn w-full text-left px-3 py-2 rounded-xl mb-0.5 text-sm cursor-pointer"
              data-active={view === item.id}
              style={{ border: 'none', color: '#172033', background: 'transparent' }}
              onClick={() => goView(item.id)}
            >
              {item.icon} {item.label}
            </button>
          ))}

          <div className="flex items-center justify-between px-2 mt-4 mb-1">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">Recent</div>
            <button
              type="button"
              className="text-xs text-primary font-semibold cursor-pointer"
              style={{ background: 'none', border: 'none' }}
              onClick={() => setShowAllRecent(v => !v)}
            >
              View all →
            </button>
          </div>
          {visibleRecent.length === 0 && <p className="px-2 text-xs text-muted">No saved chats yet.</p>}
          {visibleRecent.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => openConvo(c.id)}
              className="w-full text-left px-3 py-2 rounded-xl mb-0.5 cursor-pointer"
              style={{
                background: activeId === c.id ? 'rgba(108,92,231,0.12)' : 'transparent',
                border: 'none',
              }}
            >
              <div className="text-sm truncate font-medium text-ink">{c.title}</div>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden btn-glass text-sm py-1.5 px-2.5"
              aria-label="Open AI Learning menu"
              onClick={() => setNavOpen(true)}
            >
              Menu
            </button>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}
            >
              🤖
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                LearnSyra AI
              </div>
              <div className="text-xs text-success truncate">● Online · Your personal learning assistant</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="xl:hidden btn-glass text-sm py-1.5 px-2.5"
              onClick={() => setCtxOpen(true)}
            >
              View Learning Context
            </button>
            <button type="button" className="btn-glass text-sm py-1.5 px-3" onClick={newChat}>
              New Chat
            </button>
          </div>
        </div>

        {view === 'practice' && <PracticeStudio variant="practice" onAskTutor={() => nav('tutors')} />}
        {view === 'coding' && <PracticeStudio variant="coding" onAskTutor={() => nav('tutors')} />}
        {view === 'quizzes' && <QuizStudio onPractice={() => setView('practice')} />}
        {view === 'interview' && <InterviewStudio targetRole={careerGoal} onPractice={() => setView('practice')} />}

        {view === 'saved' && (
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            <h2 className="text-lg font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Saved Lessons</h2>
            {saved.length === 0 && <p className="text-sm text-muted">Save a useful AI reply to see it here.</p>}
            <div className="space-y-3 max-w-2xl">
              {saved.map(s => (
                <div key={s.id} className="glass rounded-2xl p-4">
                  <div className="text-sm font-bold text-ink mb-1">{s.title}</div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {s.tags.map(t => <span key={t} className="badge badge-primary">{t}</span>)}
                  </div>
                  <p className="text-sm text-muted line-clamp-4 whitespace-pre-wrap">{s.body.slice(0, 280)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'courses' && (
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            <h2 className="text-lg font-bold text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>My Courses</h2>
            {enrolled.length === 0 && (
              <div className="glass rounded-2xl p-6 max-w-lg">
                <p className="text-sm text-muted mb-3">
                  {enrolled.length === 0
                    ? 'You are not enrolled yet. Explore courses to start a real learning path.'
                    : 'Continue from your enrolled courses.'}
                </p>
                <button type="button" className="btn-primary text-sm" onClick={() => nav('courses')}>Explore Courses →</button>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
              {enrolled.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="glass rounded-2xl p-4 text-left card-hover cursor-pointer"
                  onClick={() => nav('course-detail', c.id)}
                >
                  <div className="text-sm font-bold text-ink mb-1">{c.title}</div>
                  <div className="text-xs text-muted mb-2">{c.progress}% complete</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${c.progress}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'career' && (
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            <div className="glass rounded-2xl p-6 max-w-xl">
              <h2 className="text-lg font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>💼 Career Prep</h2>
              <p className="text-sm text-muted leading-relaxed mb-4">
                Target role:{' '}
                <span className="font-semibold text-ink">{ctx.careerGoal || 'Choose a target role'}</span>
                {ctx.skills.length === 0
                  ? '. Skill gaps appear after you add career data or course progress.'
                  : '.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={() => setView('interview')}>Start mock interview →</button>
                <button type="button" className="btn-glass text-sm" onClick={() => send('Help me choose my next skill')}>Plan next skill</button>
                <button type="button" className="btn-glass text-sm" onClick={() => nav('career')}>Open Career Center</button>
              </div>
            </div>
          </div>
        )}

        {(view === 'tutor' || view === 'recent') && (
          <>
            <div className="px-4 md:px-6 pt-3 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">{ctx.courseTitle ? 'Currently learning' : 'Get started'}</span>
                {ctx.courseTitle ? (
                  <>
                    <span className="badge badge-primary">{ctx.courseTitle}</span>
                    {ctx.lesson ? <span className="badge badge-accent">{ctx.lesson}</span> : null}
                  </>
                ) : (
                  <span className="badge badge-primary">Start your AI learning journey</span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 min-h-0">
              {error && <div className="text-sm text-rose-500 mb-3">{error}</div>}
              {notice && <div className="text-sm text-success mb-3">{notice}</div>}

              {phase === 'empty' && messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <h2 className="text-2xl font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                    Start your AI learning journey
                  </h2>
                  <p className="text-sm text-muted mb-6 max-w-md">
                    Ask LearnSyra to explain, practice, build, or prepare you.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                    {EMPTY_PROMPTS.map(p => (
                      <button
                        key={p}
                        type="button"
                        className="glass rounded-xl px-3 py-2.5 text-sm text-left card-hover cursor-pointer"
                        onClick={() => {
                          if (/quiz/i.test(p)) setView('quizzes')
                          else if (/interview/i.test(p)) setView('interview')
                          else send(p)
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(phase === 'welcome' || phase === 'chat') && messages.map((m, idx) => (
                <div key={m.id} className={`ai-msg flex gap-3 mb-5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {m.role === 'ai' && (
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}
                    >
                      ✨
                    </div>
                  )}
                  <div className="max-w-[85%] md:max-w-[70%]">
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{
                        background: m.role === 'user'
                          ? 'linear-gradient(135deg,#6C5CE7,#8B5CF6)'
                          : 'rgba(255,255,255,0.92)',
                        border: m.role === 'ai' ? '1px solid rgba(99,102,241,0.12)' : 'none',
                        color: m.role === 'user' ? '#ffffff' : '#172033',
                        boxShadow: m.role === 'ai' ? '0 10px 24px rgba(23,32,51,0.05)' : undefined,
                      }}
                    >
                      {m.role === 'ai' ? (
                        <AiMarkdown text={m.text} onTry={() => setView('practice')} />
                      ) : (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</div>
                      )}
                    </div>
                    {m.role === 'ai' && idx === messages.length - 1 && phase === 'chat' && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          { l: '📋 Copy', fn: () => copyText(m.text) },
                          { l: '🔖 Save', fn: () => onSave(m.text) },
                          { l: '✨ Explain simpler', fn: explainSimpler },
                          { l: '🧠 Quiz me', fn: () => setView('quizzes') },
                          { l: '💻 Give practice', fn: () => setView('practice') },
                          { l: '👨‍🏫 Ask a tutor', fn: () => nav('tutors') },
                        ].map(a => (
                          <button
                            key={a.l}
                            type="button"
                            className="text-xs px-2 py-1 rounded-lg cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
                            onClick={a.fn}
                          >
                            {a.l}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.role === 'ai' && phase === 'welcome' && idx === 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                        {WELCOME_ACTIONS.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            className="glass rounded-xl px-3 py-2.5 text-left card-hover cursor-pointer"
                            onClick={() => onAction(a.id, a.prompt)}
                          >
                            <div className="text-sm font-semibold text-ink">{a.label}</div>
                            <div className="text-xs text-muted mt-0.5">{a.hint}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}
                  >
                    ✨
                  </div>
                  <div className="rounded-2xl px-4 py-3 glass">
                    <div className="ai-dots" aria-label="LearnSyra is typing">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
              {stuck && phase === 'chat' && (
                <div className="max-w-lg mb-4 xl:hidden">
                  <TutorCard tutor={tutor} stuck onFind={() => nav('tutors')} />
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 md:px-6 pb-4 flex-shrink-0">
              <div className="flex flex-wrap gap-2 mb-2">
                {COMPOSER_CHIPS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className="text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
                    onClick={() => {
                      if (/quiz/i.test(c)) setView('quizzes')
                      else if (/interview/i.test(c)) setView('interview')
                      else send(c)
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div
                className="flex items-end gap-2 rounded-2xl p-2.5"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.14)', boxShadow: '0 10px 28px rgba(23,32,51,0.06)' }}
              >
                <button type="button" className="w-9 h-9 rounded-xl flex items-center justify-center text-muted" style={{ background: 'none', border: 'none' }} aria-label="Attach a file" onClick={() => setNotice('Attachments are coming soon.')}>📎</button>
                <button type="button" className="w-9 h-9 rounded-xl flex items-center justify-center text-muted" style={{ background: 'none', border: 'none' }} aria-label="Insert a code block" onClick={() => setInput(v => `${v}\n\`\`\`javascript\n\n\`\`\``)}>{"</>"}</button>
                <button type="button" className="w-9 h-9 rounded-xl flex items-center justify-center text-muted" style={{ background: 'none', border: 'none' }} aria-label="Voice input" onClick={() => setNotice('Voice input is coming soon.')}>🎤</button>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder="Ask anything about your subject..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-ink outline-none placeholder-muted py-2 resize-none"
                />
                <button
                  type="button"
                  aria-label="Send message"
                  onClick={() => send()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0"
                  style={{ background: input.trim() ? 'linear-gradient(135deg,#6C5CE7,#22C7D6)' : 'rgba(99,102,241,0.12)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                  </svg>
                </button>
              </div>
              <p className="text-[11px] text-subtle mt-2">
                AI can make mistakes. Verify important information. · LearnSyra remembers your learning context
              </p>
            </div>
          </>
        )}
      </div>

      <aside
        className="hidden xl:block w-[300px] flex-shrink-0 overflow-y-auto p-4"
        style={{ borderLeft: '1px solid rgba(99,102,241,0.12)', background: 'rgba(255,255,255,0.45)' }}
      >
        <ContextPanel ctx={ctx} tutor={tutor} stuck={stuck} onPractice={() => setView('practice')} onFindTutor={() => nav('tutors')} />
      </aside>

      {ctxOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex justify-end" style={{ background: 'rgba(23,32,51,0.32)' }} onClick={() => setCtxOpen(false)} role="presentation">
          <div className="ai-drawer h-full w-[min(100%,320px)] overflow-y-auto p-4" style={{ background: '#F7F9FC' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-ink">Learning Context</div>
              <button type="button" className="btn-glass text-sm py-1.5 px-2.5" aria-label="Close learning context" onClick={() => setCtxOpen(false)}>✕</button>
            </div>
            <ContextPanel ctx={ctx} tutor={tutor} stuck={stuck} onPractice={() => { setView('practice'); setCtxOpen(false) }} onFindTutor={() => nav('tutors')} />
          </div>
        </div>
      )}
    </div>
  )
}
