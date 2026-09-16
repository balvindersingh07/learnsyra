export type BlogSection =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  category: string
  author: string
  publishedAt: string
  readMinutes: number
  coverEmoji: string
  tags: string[]
  sections: BlogSection[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'ai-tutors-and-human-mentors',
    title: 'How AI Tutors and Human Mentors Work Together on LearnSyra',
    excerpt:
      'AI scales practice and feedback. Human tutors add judgment, accountability, and career context. LearnSyra combines both so you learn faster without losing the human edge.',
    category: 'AI Learning',
    author: 'LearnSyra Editorial',
    publishedAt: '2026-09-01',
    readMinutes: 6,
    coverEmoji: '🤖',
    tags: ['AI learning', 'tutors', 'mentorship'],
    sections: [
      {
        type: 'p',
        text:
          'Most learners do not fail because information is unavailable. They fail because practice is unstructured, feedback is delayed, and nobody helps them connect skills to real outcomes. That is the gap LearnSyra is built to close.',
      },
      {
        type: 'h2',
        text: 'What AI does best',
      },
      {
        type: 'p',
        text:
          'The LearnSyra AI tutor is available whenever you are — late-night debugging, last-minute interview prep, or a quick concept recap before a live session. It adapts explanations to your level, generates practice questions, and helps you iterate without waiting for office hours.',
      },
      {
        type: 'ul',
        items: [
          'Instant explanations with follow-up questions',
          'Personalized drills based on your weak spots',
          'Mock interview prompts with structured feedback',
          'Revision loops before projects and assessments',
        ],
      },
      {
        type: 'h2',
        text: 'What human tutors add',
      },
      {
        type: 'p',
        text:
          'Expert tutors bring context AI cannot fully replicate: how hiring managers think, which portfolio projects actually impress, and when to push you past comfortable answers. On LearnSyra, tutors review your work, run live sessions, and help you build a credible learning narrative.',
      },
      {
        type: 'h2',
        text: 'The combined workflow',
      },
      {
        type: 'p',
        text:
          'A typical LearnSyra path looks like this: learn a concept with AI, apply it in a project workspace, book a tutor for a deep-dive session, then return to AI for targeted revision. Students who use both layers consistently report stronger interview confidence and clearer portfolios than those who rely on only one.',
      },
    ],
  },
  {
    slug: 'from-tutorial-hell-to-real-projects',
    title: 'From Tutorial Hell to Real Projects: Building a Portfolio Employers Notice',
    excerpt:
      'Watching courses is not the same as building. Here is how LearnSyra project workspaces turn skills into proof you can show in interviews.',
    category: 'Projects',
    author: 'LearnSyra Editorial',
    publishedAt: '2026-08-22',
    readMinutes: 7,
    coverEmoji: '🛠️',
    tags: ['projects', 'portfolio', 'job readiness'],
    sections: [
      {
        type: 'p',
        text:
          'Tutorial hell feels productive. You finish modules, collect certificates, and still freeze when an interviewer asks, "Walk me through something you built." Employers hire people who can ship — not people who only consumed content.',
      },
      {
        type: 'h2',
        text: 'Why projects matter more than completion badges',
      },
      {
        type: 'p',
        text:
          'Projects force trade-offs: scope, architecture, debugging, and communication. LearnSyra project workspaces guide you from brief to submission with milestones, rubrics, and optional tutor review so your work reads like a real deliverable, not a homework clone.',
      },
      {
        type: 'ul',
        items: [
          'Industry-style briefs with clear success criteria',
          'Workspace tools for notes, code, and deliverables',
          'Tutor feedback on structure, not just syntax',
          'Portfolio-ready summaries you can link on your resume',
        ],
      },
      {
        type: 'h2',
        text: 'How to pick the right project',
      },
      {
        type: 'p',
        text:
          'Choose projects that mirror the roles you want. A frontend candidate should show UI craft and API integration. A data role should show analysis, visualization, and business insight. LearnSyra maps projects to career tracks so you are not guessing what recruiters expect.',
      },
      {
        type: 'h2',
        text: 'Ship small, then compound',
      },
      {
        type: 'p',
        text:
          'One strong project beats five half-finished repos. Finish a vertical slice — auth, core feature, tests or docs — then iterate. Tutors on LearnSyra can help you decide when a project is "good enough to show" versus when it needs one more polish pass.',
      },
    ],
  },
  {
    slug: 'interview-prep-that-works',
    title: 'Interview Prep That Actually Works: Mock Sessions, Feedback Loops, and Confidence',
    excerpt:
      'Confidence in interviews comes from repetition with quality feedback. LearnSyra combines AI mocks with human tutors so you practice the right things before the real conversation.',
    category: 'Interview Prep',
    author: 'LearnSyra Editorial',
    publishedAt: '2026-08-10',
    readMinutes: 5,
    coverEmoji: '🎯',
    tags: ['interviews', 'career', 'mock interviews'],
    sections: [
      {
        type: 'p',
        text:
          'Interview anxiety is rarely about lacking knowledge. It is about performing under pressure without a script. The fix is structured practice — the same way athletes drill before game day.',
      },
      {
        type: 'h2',
        text: 'Start with AI, refine with humans',
      },
      {
        type: 'p',
        text:
          'Use LearnSyra AI Learning for high-volume practice: behavioral questions, system design outlines, and technical warm-ups. When you are ready, book a tutor for a realistic mock that includes follow-up probes, communication coaching, and honest scoring.',
      },
      {
        type: 'ul',
        items: [
          'Timed mock interviews with role-specific prompts',
          'STAR-style behavioral frameworks',
          'Technical deep-dives with whiteboard-style explanations',
          'Actionable feedback you can apply the same week',
        ],
      },
      {
        type: 'h2',
        text: 'Build a weekly prep rhythm',
      },
      {
        type: 'p',
        text:
          'Two short AI sessions plus one tutor mock per week beats a cram session the night before. Track weak answers, rewrite them, and rehearse aloud. Students who follow this cadence on LearnSyra report calmer onsite and virtual interviews.',
      },
    ],
  },
  {
    slug: 'career-switching-skills-and-job-readiness',
    title: 'Career Switching in 2026: Skills, Projects, and Job Readiness',
    excerpt:
      'Changing careers is a systems problem. LearnSyra Career Center connects learning paths, projects, and interview prep into one job-readiness plan.',
    category: 'Career',
    author: 'LearnSyra Editorial',
    publishedAt: '2026-07-28',
    readMinutes: 8,
    coverEmoji: '💼',
    tags: ['career switch', 'skills', 'job board'],
    sections: [
      {
        type: 'p',
        text:
          'Career switchers often spread effort across too many resources — random courses, outdated resume templates, and generic interview tips. Without a plan, momentum fades after the first month.',
      },
      {
        type: 'h2',
        text: 'Define a target role, then reverse-engineer',
      },
      {
        type: 'p',
        text:
          'Pick one role family for the next 90 days: frontend, data, product, cloud, or another track LearnSyra supports. List the skills that appear in real job posts, then map each skill to a course module, project, and mock interview theme.',
      },
      {
        type: 'h2',
        text: 'Make your story coherent',
      },
      {
        type: 'p',
        text:
          'Recruiters connect dots across your resume, LinkedIn, and portfolio. LearnSyra helps you align project titles, tutor session notes, and career center milestones so your narrative sounds intentional — not like a pile of unrelated certificates.',
      },
      {
        type: 'ul',
        items: [
          'Resume builder tuned to tech and career-switch formats',
          'Job board filters by skills you are actively building',
          'Interview prep aligned to your target seniority',
          'Tutor sessions for salary negotiation and offer review',
        ],
      },
      {
        type: 'h2',
        text: 'Measure readiness, not hours watched',
      },
      {
        type: 'p',
        text:
          'Job readiness means you can explain your projects, pass a screen, and pair on a realistic task. Track those outcomes weekly. When all three are green, you are ready to apply aggressively — not when you finish one more passive video.',
      },
    ],
  },
  {
    slug: 'why-expert-tutors-still-matter',
    title: 'Why Expert Tutors Still Matter in the Age of AI Learning',
    excerpt:
      'AI can explain anything in seconds. Great tutors help you know what to learn next, how to present it, and when you are ready to bet on yourself in the market.',
    category: 'Tutoring',
    author: 'LearnSyra Editorial',
    publishedAt: '2026-07-12',
    readMinutes: 5,
    coverEmoji: '👨‍🏫',
    tags: ['tutors', 'mentorship', 'learning'],
    sections: [
      {
        type: 'p',
        text:
          'AI lowered the cost of explanations. It did not lower the cost of judgment. The best tutors on LearnSyra are practitioners — engineers, designers, analysts, and hiring managers who have seen what breaks in production and in interviews.',
      },
      {
        type: 'h2',
        text: 'Tutors compress decision time',
      },
      {
        type: 'p',
        text:
          'Should you learn Next.js or deepen JavaScript first? Is your project too ambitious for two weeks? Tutors answer these questions in minutes, saving you from weeks of tangents.',
      },
      {
        type: 'h2',
        text: 'Accountability changes behavior',
      },
      {
        type: 'p',
        text:
          'A booked session creates a deadline. Students show up prepared, ask sharper questions, and finish modules they would otherwise skip. That accountability layer is why marketplace tutoring remains one of the highest-ROI features on the platform.',
      },
      {
        type: 'h2',
        text: 'Become a tutor on LearnSyra',
      },
      {
        type: 'p',
        text:
          'If you have shipped real work and enjoy coaching, LearnSyra gives you scheduling, payouts, course tools, and AI assistance so you can focus on teaching — not admin. Choose the Tutor profile at sign-up to access the tutor workspace.',
      },
    ],
  },
  {
    slug: 'job-ready-skills-framework',
    title: 'The LearnSyra Framework for Job-Ready Skills',
    excerpt:
      'Job-ready means you can learn, build, communicate, and interview — not just pass quizzes. Here is the four-part framework we use across courses, projects, and career tools.',
    category: 'Skills',
    author: 'LearnSyra Editorial',
    publishedAt: '2026-06-30',
    readMinutes: 6,
    coverEmoji: '📈',
    tags: ['skills', 'framework', 'job readiness'],
    sections: [
      {
        type: 'p',
        text:
          'LearnSyra is not a content library with a chatbot bolted on. Every feature — AI Learning, tutor sessions, projects, live classes, and Career Center — maps to a single outcome: skills you can defend in an interview and apply on the job.',
      },
      {
        type: 'h2',
        text: '1. Learn with structure',
      },
      {
        type: 'p',
        text:
          'Courses and AI paths give you sequenced knowledge with checkpoints. You always know what to study today and why it matters for tomorrow\'s project.',
      },
      {
        type: 'h2',
        text: '2. Build with proof',
      },
      {
        type: 'p',
        text:
          'Projects turn knowledge into artifacts: repos, demos, write-ups, and case studies. Proof beats promises on every hiring loop.',
      },
      {
        type: 'h2',
        text: '3. Communicate with coaches',
      },
      {
        type: 'p',
        text:
          'Tutors and mock interviews train you to explain trade-offs, receive feedback gracefully, and tell your career story clearly.',
      },
      {
        type: 'h2',
        text: '4. Apply with confidence',
      },
      {
        type: 'p',
        text:
          'Resume tools, job listings, and interview prep close the loop. When your pipeline is active, you are not guessing if you are ready — you are testing the market with evidence.',
      },
    ],
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find(p => p.slug === slug)
}

export function blogPostPath(slug: string) {
  return `/blog/${slug}`
}

export function formatBlogDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
