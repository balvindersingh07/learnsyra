import type { CourseRow, TutorListing } from './api'

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
  const course = input.enrolled.find(c => /full.?stack|web|react/i.test(c.title)) || input.enrolled[0]
  return {
    firstName: input.firstName || 'Alex',
    courseTitle: course?.title || 'Full Stack Web Development',
    lesson: 'React Hooks',
    topic: 'React Hooks',
    progress: course?.progress || 17,
    skills: [
      { name: 'React', score: 88 },
      { name: 'JavaScript', score: 76 },
      { name: 'Node.js', score: 58 },
      { name: 'TypeScript', score: 35 },
      { name: 'System Design', score: 21 },
    ],
    focusSkill: 'TypeScript',
    focusScore: 35,
    insight: 'You understand React components well, but you frequently struggle with asynchronous state updates.',
    careerGoal: input.careerGoal || 'Junior Frontend Developer',
  }
}

export function welcomeMessage(ctx: AiStudentContext): ChatMsg {
  return {
    id: uid(),
    role: 'ai',
    text: `Hey ${ctx.firstName} 👋

You're currently working on **${ctx.lesson}**.

I noticed you had some difficulty with \`useEffect\` in your recent practice.

What would you like to do?`,
  }
}

export function seedConversations(): SeedConversation[] {
  return [
    {
      id: 'seed-hooks',
      title: 'React Hooks Explained',
      messages: [
        { id: 's1', role: 'user', text: "Explain React useEffect like I'm a beginner." },
        { id: 's2', role: 'ai', text: explainUseEffectReply() },
      ],
    },
    {
      id: 'seed-rest',
      title: 'REST API Practice',
      messages: [
        { id: 's3', role: 'user', text: 'Give me a beginner exercise for REST APIs.' },
        {
          id: 's4',
          role: 'ai',
          text: `**REST API practice**

Build a tiny client that:

1. \`GET /posts\` and list titles
2. \`POST /posts\` with a title + body
3. Handle a loading and error state

**Hint:** start with \`fetch\` and \`useEffect\`, then extract a \`usePosts()\` hook.`,
        },
      ],
    },
    {
      id: 'seed-closures',
      title: 'JavaScript Closures',
      messages: [
        { id: 's5', role: 'user', text: 'Explain closures simply.' },
        {
          id: 's6',
          role: 'ai',
          text: `A **closure** is a function that remembers variables from the place it was created.

\`\`\`javascript
function makeCounter() {
  let n = 0
  return () => ++n
}
\`\`\`

Each counter keeps its own \`n\`. That private memory is the closure.`,
        },
      ],
    },
    {
      id: 'seed-node',
      title: 'Node.js Interview Questions',
      messages: [
        { id: 's7', role: 'user', text: 'Interview me on Node.js.' },
        {
          id: 's8',
          role: 'ai',
          text: `**Question 1**

What is the event loop, and why does it matter when handling many HTTP requests?

Answer in 4–6 sentences, then I will score technical depth and clarity.`,
        },
      ],
    },
  ]
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
    return `**Beginner exercise — ${ctx.lesson}**

Build a counter with \`useState\`: increment, decrement, and reset.

Estimated time: **10 min**

Open **Practice** in the sidebar when you are ready to try it with a starter file, or type your code here and I will review it.`
  }
  if (/mini project|give me a project/.test(q)) {
    return `**Mini project:** a Notes board.

* Add a note
* List notes
* Delete a note

Use \`useState\` for the list and \`useEffect\` to save to \`localStorage\`. This maps directly to ${ctx.courseTitle}.`
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
    return `I can run a **Junior Frontend Developer** mock interview on React.

Open **Interview Practice** for a timed session, or answer this now:

**What is the difference between state and props in React?**`
  }
  if (/next skill|choose my next/.test(q)) {
    return `Your snapshot says **${ctx.focusSkill}** is the gap (${ctx.focusScore}%).

React is already strong. Fifteen focused minutes on TypeScript fundamentals will unlock your next Full Stack project.`
  }
  if (/typescript/.test(q)) {
    return `**TypeScript fundamentals (15 min)**

1. Annotate props: \`type Props = { count: number }\`
2. Type a \`useState\` value: \`useState<number>(0)\`
3. Type an event: \`React.ChangeEvent<HTMLInputElement>\`

You are at **${ctx.focusScore}%**. Practice this next — it is the fastest lift for ${ctx.careerGoal}.`
  }
  if (/asynchronous state|async state/.test(q)) {
    return ctx.insight + '\n\nTry updating state from a fetch inside `useEffect`, and never use the old count like `count + 1` after an await — use the functional updater: `setCount(c => c + 1)`.'
  }
  return null
}

export function coachPrompt(ctx: AiStudentContext, question: string) {
  return `Student: ${ctx.firstName}. Course: ${ctx.courseTitle}. Current lesson: ${ctx.lesson}. Progress: ${ctx.progress}%. Weak area: ${ctx.focusSkill} (${ctx.focusScore}%). Career goal: ${ctx.careerGoal}. Insight: ${ctx.insight}. Question: ${question}`
}

export function loadSavedLessons(): SavedLesson[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as SavedLesson[]) : []
  } catch {
    return []
  }
}

export function saveLesson(item: Omit<SavedLesson, 'id' | 'savedAt'>): SavedLesson[] {
  const next = [
    { ...item, id: uid(), savedAt: new Date().toISOString() },
    ...loadSavedLessons(),
  ].slice(0, 40)
  localStorage.setItem(SAVED_KEY, JSON.stringify(next))
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
  score: 78,
  breakdown: [
    { label: 'Technical Knowledge', v: 82 },
    { label: 'Communication', v: 76 },
    { label: 'Problem Solving', v: 80 },
    { label: 'Confidence', v: 72 },
  ],
  rec: 'Practice React architecture questions.',
}

export function pickTutor(list: TutorListing[]): TutorListing | null {
  return (
    list.find(t => /sarah kim/i.test(t.name)) ||
    list.find(t => /react|node|full.?stack/i.test(`${t.name} ${t.expertise ?? ''} ${t.subject ?? ''}`)) ||
    list[0] ||
    null
  )
}

export const MOCK_TUTOR: TutorListing = {
  id: 'mock-sarah',
  profile_id: null,
  name: 'Dr. Sarah Kim',
  expertise: 'React & Node.js',
  intro: null,
  subject: 'Programming',
  tags: ['React', 'Node.js'],
  hourly_rate_cents: 80000,
  rating: 4.9,
  reviews: 128,
  students_taught: 320,
  available: true,
  image_key: null,
}
