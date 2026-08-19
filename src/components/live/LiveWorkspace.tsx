import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutorAvatar from '../tutors/TutorAvatar'
import { setPendingAiPrompt } from '../../lib/dashboardIntel'
import {
  COPILOT_QUESTIONS,
  elapsedSeconds,
  EXPLAIN_SERVICE_LAYER,
  formatClock,
  remainingSeconds,
  saveLiveRecord,
  type ChatLine,
  type LiveSessionRecord,
} from '../../lib/liveSession'
import type { CatalogTutor } from '../../lib/tutorMarketplace'
import { coursePath, lessonPath, projectWorkspacePath } from '../../lib/paths'

type CopilotTab = 'notes' | 'questions' | 'summary' | 'actions'
type MobileTab = 'video' | 'ai' | 'chat' | 'notes' | 'project'
type NoteTab = 'my' | 'session' | 'actions'

export default function LiveWorkspace({
  record,
  tutor,
  onChange,
  onLeave,
}: {
  record: LiveSessionRecord
  tutor: CatalogTutor
  onChange: (row: LiveSessionRecord) => void
  onLeave: () => void
}) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(Date.now())
  const [cam, setCam] = useState(true)
  const [mic, setMic] = useState(true)
  const [share, setShare] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [reconnect, setReconnect] = useState(false)
  const [copilot, setCopilot] = useState<CopilotTab>('notes')
  const [mobile, setMobile] = useState<MobileTab>('video')
  const [noteTab, setNoteTab] = useState<NoteTab>('my')
  const [chatOpen, setChatOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [explain, setExplain] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const first = tutor.name.replace(/^Dr\.\s*/, '').split(' ')[0]

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    const c = window.setTimeout(() => setConnecting(false), 1200)
    return () => {
      window.clearInterval(t)
      window.clearTimeout(c)
    }
  }, [])

  const ping = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1600)
  }

  const patch = (partial: Partial<LiveSessionRecord> | ((r: LiveSessionRecord) => LiveSessionRecord)) => {
    const next = typeof partial === 'function' ? partial(record) : { ...record, ...partial }
    saveLiveRecord(next)
    onChange(next)
  }

  const remain = remainingSeconds(record)
  const elapsed = elapsedSeconds(record)
  void now

  const sendChat = () => {
    const text = draft.trim()
    if (!text) return
    const you: ChatLine = { id: `c-${Date.now()}`, from: 'you', text }
    patch(r => ({ ...r, chat: [...r.chat, you] }))
    setDraft('')
    window.setTimeout(() => {
      const reply: ChatLine = {
        id: `c-${Date.now()}-t`,
        from: 'tutor',
        text: 'Good question — let’s look at that in the project next.',
      }
      patch(r => ({ ...r, chat: [...r.chat, reply] }))
    }, 800)
  }

  const askTutor = (q: string) => {
    ping('Saved for the tutor — not sent automatically')
    patch(r => ({ ...r, chat: [...r.chat, { id: `c-${Date.now()}`, from: 'you', text: q }] }))
    setChatOpen(true)
    setMobile('chat')
  }

  const copilotPanel = (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-ink">✨ LearnSyra AI Copilot</h2>
        <div className="text-xs text-muted flex items-center gap-1.5">
          <span className="lv-pulse w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Listening for learning context
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3" role="tablist" aria-label="Copilot">
        {(['notes', 'questions', 'summary', 'actions'] as CopilotTab[]).map(t => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={copilot === t}
            className="lv-tab px-2.5 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer"
            data-active={copilot === t}
            style={{ border: '1px solid rgba(99,102,241,0.14)', background: copilot === t ? undefined : 'rgba(255,255,255,0.9)' }}
            onClick={() => setCopilot(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {typing && <p className="text-xs text-primary mb-2">Copilot is thinking…</p>}

      {copilot === 'notes' && (
        <div>
          <h3 className="text-sm font-bold text-ink mb-1">Live Learning Notes</h3>
          <div className="text-xs font-semibold text-ink mb-1">React Architecture</div>
          <ul className="text-sm text-muted space-y-1 mb-3">
            {record.notes.live.map(n => (
              <li key={n.id}>• {n.text}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className="field flex-1 px-3 py-2 text-sm"
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              placeholder="Add note"
              aria-label="Add live note"
            />
            <button
              type="button"
              className="btn-primary text-sm py-2"
              onClick={() => {
                if (!noteDraft.trim()) return
                patch(r => ({
                  ...r,
                  notes: { ...r.notes, live: [...r.notes.live, { id: `n-${Date.now()}`, text: noteDraft.trim() }] },
                }))
                setNoteDraft('')
                ping('Note saved')
              }}
            >
              Add Note
            </button>
          </div>
        </div>
      )}

      {copilot === 'questions' && (
        <div>
          <h3 className="text-sm font-bold text-ink mb-2">Suggested Questions</h3>
          <ul className="space-y-2">
            {(record.questions.length ? record.questions : COPILOT_QUESTIONS).map(q => (
              <li key={q} className="glass rounded-xl p-3">
                <p className="text-sm text-ink mb-2">&ldquo;{q}&rdquo;</p>
                <button type="button" className="btn-glass text-xs py-1.5" onClick={() => askTutor(q)}>
                  Ask Tutor
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {copilot === 'summary' && (
        <div>
          <p className="text-sm text-muted mb-3">
            {record.summary || 'Sarah is walking through a service layer so UI stays focused and APIs stay testable.'}
          </p>
          <button
            type="button"
            className="btn-glass text-sm"
            onClick={() => {
              setTyping(true)
              window.setTimeout(() => {
                setTyping(false)
                patch({ summary: 'Covered React Hooks, REST APIs, and API service architecture so far.' })
                ping('Summary updated')
              }, 700)
            }}
          >
            Summarize So Far
          </button>
        </div>
      )}

      {copilot === 'actions' && (
        <ul className="space-y-2">
          {record.actionItems.map(a => (
            <li key={a.id}>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="lv-check mt-0.5"
                  checked={a.done}
                  onChange={() =>
                    patch(r => ({
                      ...r,
                      actionItems: r.actionItems.map(x => (x.id === a.id ? { ...x, done: !x.done } : x)),
                    }))
                  }
                />
                <span className={a.done ? 'text-muted line-through' : 'text-ink'}>{a.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        {[
          ['Summarize So Far', `Summarize my live session with ${tutor.name} so far. Topics: ${record.aiBrief.topics.join(', ')}.`],
          ['Generate Questions', `Suggest 3 questions I should ask ${tutor.name} about ${record.projectTitle}.`],
          ['Explain Topic', `Explain a service layer for ${record.projectTitle} in simple terms.`],
          ['Create Practice Task', `Create a 10-minute API error handling practice task after this session.`],
          ['Save Key Insight', `Save this insight: ${EXPLAIN_SERVICE_LAYER}`],
        ].map(([label, prompt]) => (
          <button
            key={label}
            type="button"
            className="btn-glass text-xs py-1.5"
            onClick={() => {
              if (label === 'Explain Topic') {
                setExplain(EXPLAIN_SERVICE_LAYER)
                return
              }
              if (label === 'Save Key Insight') {
                patch(r => ({
                  ...r,
                  notes: { ...r.notes, live: [...r.notes.live, { id: `n-${Date.now()}`, text: EXPLAIN_SERVICE_LAYER }] },
                }))
                ping('Insight saved')
                return
              }
              if (label === 'Generate Questions') {
                setTyping(true)
                window.setTimeout(() => {
                  setTyping(false)
                  setCopilot('questions')
                  ping('Questions ready')
                }, 600)
                return
              }
              setPendingAiPrompt(prompt)
              navigate('/ai-learning')
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <button type="button" className="btn-glass text-sm mt-3 w-full" onClick={() => setExplain(EXPLAIN_SERVICE_LAYER)}>
        Explain This
      </button>

      {explain && (
        <div className="glass rounded-xl p-3 mt-3">
          <p className="text-sm text-muted mb-3">&ldquo;{explain}&rdquo;</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary text-xs py-1.5"
              onClick={() => {
                patch(r => ({ ...r, explanations: [...r.explanations, explain], notes: { ...r.notes, session: `${r.notes.session}\n${explain}`.trim() } }))
                ping('Explanation saved')
              }}
            >
              Save Explanation
            </button>
            <button
              type="button"
              className="btn-glass text-xs py-1.5"
              onClick={() => {
                setPendingAiPrompt(`Practice this: ${explain}`)
                navigate('/ai-learning')
              }}
            >
              Practice This
            </button>
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-3 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <TutorAvatar name={tutor.name} size={36} />
          <div>
            <div className="text-sm font-bold text-ink">{tutor.name}</div>
            <div className="text-xs text-muted flex items-center gap-1"><span className="lv-avail" /> Online · ⭐ {tutor.rating.toFixed(1)}</div>
          </div>
        </div>
        <div className="text-xs text-muted">{tutor.expertise.join(' · ')}</div>
        <div className="text-xs font-semibold text-success mt-1">Session active</div>
      </div>
    </div>
  )

  const chatPanel = (
    <div className="p-4 flex flex-col h-full">
      <h3 className="text-sm font-bold text-ink mb-2">Tutor Chat</h3>
      <p className="text-xs text-muted mb-2">Messages go to {first}, not the AI copilot.</p>
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[120px]">
        {record.chat.length === 0 && <p className="text-xs text-muted">No messages yet.</p>}
        {record.chat.map(m => (
          <div key={m.id} className={`text-sm ${m.from === 'you' ? 'text-right' : ''}`}>
            <span className="inline-block glass rounded-xl px-3 py-1.5">{m.text}</span>
            <div className="text-[10px] text-subtle mt-0.5">{m.from === 'you' ? 'You' : first}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="field flex-1 px-3 py-2 text-sm"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Can you explain this again?"
          aria-label="Tutor chat message"
          onKeyDown={e => {
            if (e.key === 'Enter') sendChat()
          }}
        />
        <button type="button" className="btn-primary text-sm" onClick={sendChat}>
          Send
        </button>
      </div>
    </div>
  )

  const notesPanel = (
    <div className="p-4">
      <div className="flex gap-1 mb-3" role="tablist" aria-label="Notes">
        {([['my', 'My Notes'], ['session', 'Session Notes'], ['actions', 'Action Items']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={noteTab === id}
            className="lv-tab px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
            data-active={noteTab === id}
            style={{ border: '1px solid rgba(99,102,241,0.14)' }}
            onClick={() => setNoteTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {noteTab === 'my' && (
        <textarea
          className="field w-full p-3 text-sm"
          rows={8}
          value={record.notes.my}
          onChange={e => patch({ notes: { ...record.notes, my: e.target.value } })}
          placeholder="Important concepts, tutor advice, questions..."
        />
      )}
      {noteTab === 'session' && (
        <textarea
          className="field w-full p-3 text-sm"
          rows={8}
          value={record.notes.session}
          onChange={e => patch({ notes: { ...record.notes, session: e.target.value } })}
          placeholder="Shared session notes..."
        />
      )}
      {noteTab === 'actions' && (
        <ul className="space-y-2">
          {record.actionItems.map(a => (
            <li key={a.id}>
              <label className="flex gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="lv-check"
                  checked={a.done}
                  onChange={() =>
                    patch(r => ({
                      ...r,
                      actionItems: r.actionItems.map(x => (x.id === a.id ? { ...x, done: !x.done } : x)),
                    }))
                  }
                />
                {a.label}
              </label>
            </li>
          ))}
        </ul>
      )}
      <h3 className="text-sm font-bold text-ink mt-4 mb-2">🧠 Learning Board</h3>
      <textarea
        className="field w-full p-3 text-sm font-mono"
        rows={5}
        value={record.board}
        onChange={e => patch({ board: e.target.value })}
        placeholder="Paste code or highlight a concept..."
      />
    </div>
  )

  const contextPanel = (
    <div className="p-4 space-y-3">
      <div className="glass rounded-xl p-3">
        <div className="text-xs font-semibold text-muted mb-1">🚀 Current Project</div>
        <div className="text-sm font-bold text-ink">{record.projectTitle}</div>
        <div className="text-xs text-muted mb-1">Progress {record.projectProgress}%</div>
        <div className="progress-bar mb-2"><div className="progress-fill" style={{ width: `${record.projectProgress}%` }} /></div>
        <div className="text-xs text-muted mb-2">Current task: {record.projectTask}</div>
        <button type="button" className="btn-primary text-sm w-full" onClick={() => navigate(projectWorkspacePath(record.projectId))}>
          Open Project →
        </button>
      </div>
      <div className="glass rounded-xl p-3">
        <div className="text-xs font-semibold text-muted mb-1">📚 Current Course</div>
        <div className="text-sm font-bold text-ink">{record.courseTitle}</div>
        <div className="text-xs text-muted mb-2">Current lesson: {record.lessonTitle}</div>
        <button type="button" className="btn-glass text-sm w-full" onClick={() => navigate(lessonPath(record.courseId, record.lessonId))}>
          Open Lesson →
        </button>
        <button type="button" className="btn-glass text-sm w-full mt-2" onClick={() => navigate(coursePath(record.courseId))}>
          View course
        </button>
      </div>
    </div>
  )

  return (
    <div className="pt-16 lv-workspace flex flex-col overflow-hidden">
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 glass rounded-xl px-4 py-2 text-sm font-semibold text-ink">
          {toast}
        </div>
      )}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(99,102,241,0.12)', background: 'rgba(255,255,255,0.78)' }}>
        <div className="text-sm font-bold text-ink truncate">
          LearnSyra Live · {record.sessionType}
        </div>
        <div className="text-xs font-semibold text-muted tabular-nums">
          {remain > 0 ? `${formatClock(remain)} remaining` : `${formatClock(elapsed)} elapsed`}
        </div>
      </header>

      <div className="md:hidden flex gap-1 px-3 pt-2 overflow-x-auto" role="tablist" aria-label="Session">
        {(['video', 'ai', 'chat', 'notes', 'project'] as MobileTab[]).map(t => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={mobile === t}
            className="lv-tab px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap"
            data-active={mobile === t}
            style={{ border: '1px solid rgba(99,102,241,0.14)' }}
            onClick={() => setMobile(t)}
          >
            {t === 'ai' ? 'AI' : t}
          </button>
        ))}
      </div>

      <div className={`flex-1 min-h-0 flex overflow-hidden ${mobile !== 'video' ? 'hidden md:flex' : ''}`}>
        <section className="flex-1 min-w-0 flex flex-col">
          <div ref={videoRef} className={`relative flex-1 m-3 rounded-2xl overflow-hidden lv-video ${share ? 'lv-share' : ''}`}>
            {connecting && (
              <div className="absolute inset-0 flex items-center justify-center text-white lv-pulse">Connecting to {first}...</div>
            )}
            {reconnect && !connecting && (
              <div className="absolute inset-0 flex items-center justify-center text-white">Connection interrupted · Reconnecting...</div>
            )}
            {!connecting && !reconnect && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                {cam ? (
                  <div className="text-center">
                    <div className="w-40 h-28 mx-auto rounded-2xl mb-3" style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)', opacity: 0.85 }} />
                    <div className="font-bold">{tutor.name}</div>
                    <div className="text-xs text-white/80">Camera on · mock preview</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <TutorAvatar name={tutor.name} size={96} />
                    <div className="font-bold mt-3">{tutor.name}</div>
                    <div className="text-xs text-white/80">Camera off</div>
                  </div>
                )}
              </div>
            )}
            {share && (
              <div className="absolute top-3 left-3 text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(108,92,231,0.9)', color: '#fff' }}>
                You are sharing your screen
              </div>
            )}
            <div className="absolute bottom-3 right-3 w-28 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <div className="h-16 flex items-center justify-center text-white text-xs">{mic && cam ? 'You' : 'You · muted'}</div>
            </div>
          </div>
        </section>

        <aside className="hidden xl:flex w-80 flex-col flex-shrink-0" style={{ borderLeft: '1px solid rgba(99,102,241,0.12)', background: 'rgba(255,255,255,0.55)' }}>
          {copilotPanel}
        </aside>
      </div>

      {mobile === 'ai' && <div className="md:hidden flex-1 overflow-y-auto">{copilotPanel}</div>}
      {mobile === 'chat' && <div className="md:hidden flex-1 overflow-y-auto">{chatPanel}</div>}
      {mobile === 'notes' && <div className="md:hidden flex-1 overflow-y-auto">{notesPanel}</div>}
      {mobile === 'project' && <div className="md:hidden flex-1 overflow-y-auto">{contextPanel}</div>}

      <footer className="lv-sticky flex flex-wrap items-center justify-center gap-2 px-3 py-3" style={{ background: 'rgba(255,255,255,0.92)', borderTop: '1px solid rgba(99,102,241,0.12)' }}>
        <button type="button" className="lv-ctrl" data-on={mic} aria-label={mic ? 'Mute microphone' : 'Unmute microphone'} title={mic ? 'Mute' : 'Unmute'} onClick={() => setMic(v => !v)}>🎤</button>
        <button type="button" className="lv-ctrl" data-on={cam} aria-label={cam ? 'Turn camera off' : 'Turn camera on'} title="Camera" onClick={() => setCam(v => !v)}>📹</button>
        <button type="button" className="lv-ctrl" aria-pressed={share} aria-label="Share screen" title="Share Screen" onClick={() => { setShare(v => !v); ping(share ? 'Stopped sharing' : 'You are sharing your screen') }}>🖥</button>
        <button type="button" className="lv-ctrl xl:hidden" aria-label="AI Copilot" title="AI Copilot" onClick={() => { setAiOpen(true); setMobile('ai') }}>✨</button>
        <button type="button" className="lv-ctrl" aria-label="Tutor chat" title="Chat" onClick={() => { setChatOpen(true); setMobile('chat') }}>💬</button>
        <button type="button" className="lv-ctrl" aria-label="Notes" title="Notes" onClick={() => { setNotesOpen(true); setMobile('notes') }}>📝</button>
        <button
          type="button"
          className="lv-ctrl"
          aria-label="Fullscreen"
          title="Fullscreen"
          onClick={() => {
            const el = videoRef.current
            if (!el) return
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
            else el.requestFullscreen?.().catch(() => ping('Fullscreen not available'))
          }}
        >
          ⛶
        </button>
        <button type="button" className="lv-ctrl" data-danger="true" aria-label="Leave session" title="Leave" onClick={() => setLeaveOpen(true)}>🔴</button>
      </footer>

      {aiOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-label="AI Copilot">
          <button type="button" className="absolute inset-0" style={{ background: 'rgba(23,32,51,0.35)', border: 'none' }} aria-label="Close copilot" onClick={() => setAiOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(100%,22rem)] lv-drawer bg-white overflow-y-auto">
            <div className="flex justify-between p-3"><span className="font-bold">AI Copilot</span><button type="button" className="btn-glass text-sm py-1.5" onClick={() => setAiOpen(false)}>Close</button></div>
            {copilotPanel}
          </div>
        </div>
      )}
      {chatOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Tutor chat">
          <button type="button" className="absolute inset-0" style={{ background: 'rgba(23,32,51,0.35)', border: 'none' }} aria-label="Close chat" onClick={() => setChatOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(100%,22rem)] lv-drawer bg-white overflow-y-auto">{chatPanel}<div className="p-3"><button type="button" className="btn-glass w-full" onClick={() => setChatOpen(false)}>Close</button></div></div>
        </div>
      )}
      {notesOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Notes">
          <button type="button" className="absolute inset-0" style={{ background: 'rgba(23,32,51,0.35)', border: 'none' }} aria-label="Close notes" onClick={() => setNotesOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[min(100%,22rem)] lv-drawer bg-white overflow-y-auto">{notesPanel}<div className="p-3"><button type="button" className="btn-glass w-full" onClick={() => setNotesOpen(false)}>Close</button></div></div>
        </div>
      )}

      {leaveOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-labelledby="leave-title">
          <button type="button" className="absolute inset-0" style={{ background: 'rgba(23,32,51,0.4)', border: 'none' }} aria-label="Stay in session" onClick={() => setLeaveOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[min(100%-2rem,26rem)] -translate-x-1/2 -translate-y-1/2 glass rounded-2xl p-6">
            <h2 id="leave-title" className="text-lg font-bold text-ink mb-2">Leave this session?</h2>
            <p className="text-sm text-muted mb-4">Your learning notes and AI summary will remain available.</p>
            <div className="flex gap-2">
              <button type="button" className="btn-glass flex-1" onClick={() => setLeaveOpen(false)}>Stay in Session</button>
              <button type="button" className="btn-primary flex-1" onClick={onLeave}>Leave Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
