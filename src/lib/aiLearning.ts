import type { CourseRow, TutorListing } from './api'
import { userStorageKey } from './supabase'

export type AiRole = 'user' | 'ai'

export interface ChatMsg {
  id: string
  role: AiRole
  text: string
}

export interface SkillSnap {
  name: string
  score: number
}

export interface AiStudentContext {
  firstName: string
  courseTitle: string
  lesson: string
  topic: string
  progress: number
  skills: SkillSnap[]
  focusSkill: string
  focusScore: number
  insight: string
  careerGoal: string
}

export interface SavedLesson {
  id: string
  title: string
  body: string
  tags: string[]
  savedAt: string
}

export interface SeedConversation {
  id: string
  title: string
  messages: ChatMsg[]
}

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
  explain: string
}

export type AiView =
  | 'tutor'
  | 'saved'
  | 'courses'
  | 'practice'
  | 'quizzes'
  | 'coding'
  | 'interview'
  | 'career'

export const SIDEBAR_LEARN: { id: AiView | 'recent'; icon: string; label: string }[] = [
  { id: 'tutor', icon: '🤖', label: 'AI Tutor' },
  { id: 'recent', icon: '💬', label: 'Recent Conversations' },
  { id: 'saved', icon: '⭐', label: 'Saved Lessons' },
  { id: 'courses', icon: '📚', label: 'My Courses' },
]

export const SIDEBAR_PRACTICE: { id: AiView; icon: string; label: string }[] = [
  { id: 'practice', icon: '🧠', label: 'Practice' },
  { id: 'quizzes', icon: '🎯', label: 'Quizzes' },
  { id: 'coding', icon: '💻', label: 'Coding Practice' },
]

export const SIDEBAR_CAREER: { id: AiView; icon: string; label: string }[] = [
  { id: 'interview', icon: '🎤', label: 'Interview Practice' },
  { id: 'career', icon: '💼', label: 'Career Prep' },
]

export const EMPTY_PROMPTS = [
  'Explain React Hooks',
  'Quiz me on JavaScript',
  'Give me a project',
  'Debug my code',
  'Prepare me for an interview',
  'Help me choose my next skill',
]

export const COMPOSER_CHIPS = [
  'Explain this lesson',
  'Quiz me',
  'Give me a project',
  'Prepare me for interview',
]

export const WELCOME_ACTIONS = [
  { id: 'explain', label: 'Explain', prompt: 'Explain useEffect simply', hint: 'Explain useEffect simply' },
  { id: 'practice', label: 'Practice', prompt: 'Give me a beginner exercise', hint: 'Give me a beginner exercise' },
  { id: 'quiz', label: 'Quiz', prompt: 'Test my knowledge', hint: 'Test my knowledge' },
  { id: 'build', label: 'Build', prompt: 'Give me a mini project', hint: 'Give me a mini project' },
  { id: 'debug', label: 'Debug', prompt: 'Help me debug my code', hint: 'Help me debug my code' },
  { id: 'interview', label: 'Interview', prompt: 'Interview me on React', hint: 'Interview me on React' },
] as const

const SAVED_KEY = 'learnsyra_saved_lessons'

export function uid() {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function buildAiStudentContext(input: {
  firstName: string
  enrolled: (CourseRow & { progress: number })[]
  careerGoal?: string | null
}): AiStudentContext {
  const course = input.enrolled[0]
  const goal = input.careerGoal?.trim() || ''
  return {
    firstName: input.firstName.trim() || 'there',
    courseTitle: course?.title || '',
    lesson: '',
    topic: course?.title || '',
    progress: course?.progress ?? 0,
    skills: [],
    focusSkill: '',
    focusScore: 0,
    insight: '',
    careerGoal: goal,
  }
}

export function welcomeMessage(ctx: AiStudentContext): ChatMsg {
  const greeting = ctx.firstName && ctx.firstName !== 'there' ? `Hey ${ctx.firstName}` : 'Hey'
  if (!ctx.courseTitle && !ctx.careerGoal) {
    return {
      id: uid(),
      role: 'ai',
      text: `${greeting} 👋

Start your AI learning journey.

Ask me to explain a topic, quiz you, or help you pick a first course.`,
    }
  }
  const courseLine = ctx.courseTitle ? `\n\nYou're currently working on **${ctx.courseTitle}**.` : ''
  const goalLine = ctx.careerGoal ? `\n\nTarget role: **${ctx.careerGoal}**.` : ''
  return {
    id: uid(),
    role: 'ai',
    text: `${greeting} 👋${courseLine}${goalLine}

What would you like to do?`,
  }
}

export function seedConversations(): SeedConversation[] {
  return []
}

export function explainUseEffectReply() {
  return `Think of \`useEffect\` as a way to tell React:

"After the screen updates, I want you to do this extra task."

\`\`\`javascript
useEffect(() => {
  console.log("Component loaded");
}, []);
\`\`\`

**1.** React renders the component.

**2.** The effect runs after rendering.

**3.** The empty dependency array means it runs once.

**Try it yourself →**`
}

export function contextualCoachReply(question: string, ctx: AiStudentContext): string | null {
  const q = question.toLowerCase()
  if (/useeffect|hooks like i.m a beginner|explain useeffect|explain react hooks/.test(q)) {
    return explainUseEffectReply()
  }
  if (/explain simpler|simpler/.test(q) && /effect|hook/.test(q)) {
    return `Even simpler: **render first, then do extra work**.

\`useEffect\` is that extra work — fetch data, set a timer, or sync something outside React.

Empty \`[]\` = do it once. No array = do it after every render. Put values in the array = do it when those values change.`
  }
  if (/beginner exercise|give me a (beginner )?exercise|practice/.test(q) && !/typescript|interview/.test(q)) {
    return `**Beginner exercise**${ctx.lesson ? ` — ${ctx.lesson}` : ''}

Build a counter with \`useState\`: increment, decrement, and reset.

Estimated time: **10 min**

Open **Practice** in the sidebar when you are ready to try it with a starter file, or type your code here and I will review it.`
  }
  if (/mini project|give me a project/.test(q)) {
    return `**Mini project:** a Notes board.

* Add a note
* List notes
* Delete a note

Use \`useState\` for the list and \`useEffect\` to save to \`localStorage\`.${ctx.courseTitle ? ` This can pair with **${ctx.courseTitle}**.` : ''}`
  }
  if (/debug/.test(q)) {
    return `Paste the component and the error.

While you do that, the usual \`useEffect\` bugs are:

1. Missing dependencies
2. Setting state on every render (infinite loop)
3. Fetching without a cleanup / ignore flag

Share your snippet and I will walk through it line by line.`
  }
  if (/quiz|test my knowledge/.test(q)) {
    return `Switching you to a short **React Hooks** quiz is the fastest way to check this.

Open **Quizzes** or click **Quiz me** below. We will cover \`useState\`, \`useEffect\`, and dependency arrays.`
  }
  if (/interview/.test(q)) {
    return `I can run a mock interview${ctx.careerGoal ? ` for **${ctx.careerGoal}**` : ''}.

Open **Interview Practice** for a timed session, or answer this now:

**What is the difference between state and props in React?**`
  }
  if (/next skill|choose my next/.test(q)) {
    if (ctx.focusSkill && ctx.focusScore > 0) {
      return `Based on your snapshot, **${ctx.focusSkill}** is ${ctx.focusScore}%.${ctx.careerGoal ? ` That is a useful next step for ${ctx.careerGoal}.` : ''}`
    }
    return `Set a career goal or enroll in a course so I can suggest a next skill from your actual progress.

Meanwhile, pick a topic you want to learn and I will outline a short plan.`
  }
  if (/typescript/.test(q)) {
    return `**TypeScript fundamentals (15 min)**

1. Annotate props: \`type Props = { count: number }\`
2. Type a \`useState\` value: \`useState<number>(0)\`
3. Type an event: \`React.ChangeEvent<HTMLInputElement>\`

Practice this next if you want stronger frontend types.`
  }
  if (/asynchronous state|async state/.test(q)) {
    return `Try updating state from a fetch inside \`useEffect\`, and never use the old count like \`count + 1\` after an await — use the functional updater: \`setCount(c => c + 1)\`.${ctx.insight ? `\n\n${ctx.insight}` : ''}`
  }
  return null
}

export function coachPrompt(ctx: AiStudentContext, question: string) {
  const parts = [`Student: ${ctx.firstName}.`]
  if (ctx.courseTitle) parts.push(`Course: ${ctx.courseTitle}.`)
  if (ctx.lesson) parts.push(`Current lesson: ${ctx.lesson}.`)
  if (ctx.progress > 0) parts.push(`Progress: ${ctx.progress}%.`)
  if (ctx.focusSkill && ctx.focusScore > 0) parts.push(`Focus skill: ${ctx.focusSkill} (${ctx.focusScore}%).`)
  if (ctx.careerGoal) parts.push(`Career goal: ${ctx.careerGoal}.`)
  if (ctx.insight) parts.push(`Insight: ${ctx.insight}.`)
  parts.push(`Question: ${question}`)
  return parts.join(' ')
}

export function loadSavedLessons(): SavedLesson[] {
  const key = userStorageKey(SAVED_KEY)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as SavedLesson[]) : []
  } catch {
    return []
  }
}

export function saveLesson(item: Omit<SavedLesson, 'id' | 'savedAt'>): SavedLesson[] {
  const key = userStorageKey(SAVED_KEY)
  if (!key) return []
  const next = [
    { ...item, id: uid(), savedAt: new Date().toISOString() },
    ...loadSavedLessons(),
  ].slice(0, 40)
  localStorage.setItem(key, JSON.stringify(next))
  return next
}

export const PRACTICE_TASK = {
  title: 'Build a counter using useState.',
  difficulty: 'Beginner',
  minutes: 10,
  description: 'Create increment, decrement, and reset. State must be a number. Do not mutate the count directly.',
  starter: `import { useState } from "react"

export default function Counter() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  )
}
`,
  hint: 'Add a decrement button with setCount(count - 1), and a reset button with setCount(0). Prefer setCount(c => c + 1) if the update depends on the previous value.',
  success: 'Good start! Your state logic is correct. Try adding a reset button.',
}

export const CODING_TASK = {
  title: 'Fetch a user list with useEffect.',
  difficulty: 'Beginner',
  minutes: 12,
  description: 'Call a mock API when the component mounts. Show loading, then a list of names. Avoid infinite fetch loops.',
  starter: `import { useEffect, useState } from "react"

export default function Users() {
  const [users, setUsers] = useState([])

  useEffect(() => {
    // fetch users here
  })

  return <ul>{users.map(u => <li key={u}>{u}</li>)}</ul>
}
`,
  hint: 'Pass an empty dependency array [] so the effect runs once. Remember to handle loading and cleanup.',
  success: 'Nice. Add a loading flag and an empty dependency array so this does not refetch forever.',
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    q: 'When should you use useEffect?',
    options: [
      'To declare component state',
      'To run extra work after render (fetch, timers, sync)',
      'To style the component',
      'To replace props',
    ],
    answer: 1,
    explain: 'useEffect is for side effects after React has painted the UI.',
  },
  {
    q: 'What does an empty dependency array [] mean?',
    options: [
      'Run after every render',
      'Never run',
      'Run once after the first render',
      'Run only in production',
    ],
    answer: 2,
    explain: '[] means "no values to watch", so the effect runs once on mount.',
  },
  {
    q: 'What is useState used for?',
    options: [
      'Routing between pages',
      'Keeping values that change over time in a component',
      'Querying the database',
      'Defining CSS',
    ],
    answer: 1,
    explain: 'useState holds local, reactive values. Updating it triggers a re-render.',
  },
  {
    q: 'Can you call hooks inside loops or conditions?',
    options: ['Yes, anytime', 'Only in class components', 'No — only at the top level of a function component', 'Only inside useEffect'],
    answer: 2,
    explain: 'Hooks must run in the same order every render. Keep them at the top level.',
  },
  {
    q: 'Which dependency array should you use if the effect reads `userId`?',
    options: ['[]', '[userId]', 'No array at all, always', '[Math.random()]'],
    answer: 1,
    explain: 'Include every value from render that the effect reads. Here that is userId.',
  },
]

export const INTERVIEW_QUESTIONS = [
  'What is the difference between state and props in React?',
  'How does useEffect work, and when would you skip it?',
  'How would you structure a mid-size React application?',
  'Tell me about a bug you would expect with asynchronous state updates.',
]

export const INTERVIEW_FEEDBACK = {
  score: 0,
  breakdown: [] as { label: string; v: number }[],
  rec: 'Review your answers and practice again when you are ready.',
}

export function pickTutor(list: TutorListing[]): TutorListing | null {
  return list[0] || null
}
