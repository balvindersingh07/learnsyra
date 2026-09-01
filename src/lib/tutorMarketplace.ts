import type { TutorListing } from './api'
import { formatInr } from './courseCatalog'
import {
  decodeAvailabilityFromTags,
  isListingDateAvailable,
  listingSlotsForDate,
  skillTagsFromListing,
  weeklyHoursFromAvailability,
  type ListingAvailabilityMeta,
} from './tutorListingProfile'
import { userStorageKey } from './supabase'
import {
  applyPublishedHubs,
  catalogTutorFromHub,
  findHubByPublicId,
  hubSlotsForDate,
  isHubDateAvailable,
  sessionTypesFromHub,
} from './tutorProfile'

export type TutorSubject =
  | 'Programming'
  | 'AI & Machine Learning'
  | 'Data Analytics'
  | 'Business'
  | 'MBA'
  | 'English'
  | 'Finance'
  | 'Career'
  | 'Interview Prep'

export type TutorBadge =
  | 'AI Recommended'
  | 'Top Rated'
  | 'Project Expert'
  | 'Career Mentor'
  | 'Project Specialist'
  | 'Available Today'

export type SupportFlag = 'project' | 'ai' | 'interview' | 'career'

export interface TutorReview {
  name: string
  rating: number
  body: string
  context: string
}

export interface CatalogTutor {
  id: string
  name: string
  title: string
  bio: string
  intro: string
  expertise: string[]
  skills: string[]
  subject: TutorSubject
  rating: number
  reviewCount: number
  students: number
  experienceYears: number
  hourlyRate: number
  languages: string[]
  industries: string[]
  teachingStyle: { icon: string; label: string }[]
  badges: TutorBadge[]
  courses: { title: string; href: string }[]
  projects: { title: string; href: string }[]
  careerSpecialties: string[]
  support: SupportFlag[]
  aiMatch: number
  aiMatchReason: string
  matchReasons: string[]
  availability: {
    today: boolean
    thisWeek: boolean
    onlineNow: boolean
    slotsToday: string[]
    weekly: { day: string; hours: string }[]
  }
  reviews: TutorReview[]
  avatarUrl?: string | null
  fromTutorHub?: boolean
  demo?: boolean
  availabilityMeta?: ListingAvailabilityMeta
}

export interface SessionType {
  id: '1on1' | 'project' | 'interview' | 'career'
  label: string
  minutes: number
  price: number
}

export interface TutorBooking {
  id: string
  tutorId: string
  studentId: string | null
  sessionType: SessionType['id']
  sessionLabel: string
  date: string
  time: string
  duration: number
  price: number
  goal: string
  aiBrief: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  createdAt: string
}

export const TUTOR_CATEGORIES: Array<'All Tutors' | TutorSubject> = [
  'All Tutors',
  'Programming',
  'AI & Machine Learning',
  'Data Analytics',
  'Business',
  'MBA',
  'English',
  'Finance',
  'Career',
  'Interview Prep',
]

export const TUTOR_SKILLS = [
  'React',
  'JavaScript',
  'Python',
  'Node.js',
  'SQL',
  'Machine Learning',
  'Excel',
  'Communication',
] as const

export const EXPERIENCE_FILTERS = [
  { id: '1to3', label: '1–3 years', min: 1, max: 3 },
  { id: '3to5', label: '3–5 years', min: 3, max: 5 },
  { id: '5to10', label: '5–10 years', min: 5, max: 10 },
  { id: '10plus', label: '10+ years', min: 10, max: 99 },
] as const

export const PRICE_FILTERS = [
  { id: 'under500', label: 'Under ₹500/hr' },
  { id: '500to1000', label: '₹500–₹1,000/hr' },
  { id: '1000to2000', label: '₹1,000–₹2,000/hr' },
  { id: 'over2000', label: '₹2,000+/hr' },
] as const

export const RATING_FILTERS = [
  { id: 4.8, label: '4.8+' },
  { id: 4.5, label: '4.5+' },
  { id: 4.0, label: '4.0+' },
] as const

export const AVAIL_FILTERS = [
  { id: 'today', label: 'Available Today' },
  { id: 'week', label: 'Available This Week' },
  { id: 'now', label: 'Online Now' },
] as const

export const SUPPORT_FILTERS = [
  { id: 'project', label: 'Project Help' },
  { id: 'ai', label: 'AI-Assisted' },
  { id: 'interview', label: 'Interview Prep' },
  { id: 'career', label: 'Career Mentoring' },
] as const

export const POPULAR_TUTOR_SEARCHES = ['React', 'Python', 'Data Analytics', 'AI', 'English', 'Interview Prep']

const WISH_KEY = 'learnsyra_tutor_wish'
const BOOK_KEY = 'learnsyra_tutor_bookings'

const STYLE_DEFAULT = [
  { icon: '🧠', label: 'Concept-first' },
  { icon: '💻', label: 'Hands-on coding' },
  { icon: '🚀', label: 'Project-based' },
  { icon: '🎯', label: 'Interview-focused' },
]

const WEEKLY_DEFAULT = [
  { day: 'Monday', hours: '6 PM – 9 PM' },
  { day: 'Tuesday', hours: '6 PM – 9 PM' },
  { day: 'Wednesday', hours: '7 PM – 10 PM' },
  { day: 'Thursday', hours: '6 PM – 9 PM' },
  { day: 'Friday', hours: '5 PM – 8 PM' },
  { day: 'Saturday', hours: '10 AM – 1 PM' },
  { day: 'Sunday', hours: 'Unavailable' },
]

export function formatStudentsPlus(n: number) {
  if (n <= 0) return 'No student data yet.'
  return `${n.toLocaleString('en-IN')} students`
}

export function formatHourly(rate: number) {
  return `${formatInr(rate)}/hr`
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(p => !['Dr.', 'Dr'].includes(p))
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function firstName(name: string) {
  const parts = name.replace(/^Dr\.\s*/, '').split(' ')
  return parts[0] ?? name
}

export function priceBucket(rate: number) {
  if (rate < 500) return 'under500'
  if (rate <= 1000) return '500to1000'
  if (rate <= 2000) return '1000to2000'
  return 'over2000'
}

export function experienceBucket(years: number) {
  if (years < 3) return '1to3'
  if (years < 5) return '3to5'
  if (years < 10) return '5to10'
  return '10plus'
}

export function sessionTypesFor(tutor: CatalogTutor): SessionType[] {
  const hub = findHubByPublicId(tutor.id)
  if (hub) {
    const fromHub = sessionTypesFromHub(hub)
    if (fromHub.length) return fromHub
  }
  const rate = tutor.hourlyRate
  return [
    { id: '1on1', label: '1-on-1 Learning', minutes: 45, price: Math.round(rate * 0.75) },
    { id: 'project', label: 'Project Help', minutes: 60, price: rate },
    { id: 'interview', label: 'Interview Preparation', minutes: 45, price: Math.round(rate * 0.875) },
  ]
}

export function loadTutorWishlist(): string[] {
  const key = userStorageKey(WISH_KEY)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveTutorWishlist(ids: string[]) {
  const key = userStorageKey(WISH_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(ids))
}

export function loadTutorBookings(): TutorBooking[] {
  const key = userStorageKey(BOOK_KEY)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as TutorBooking[]) : []
  } catch {
    return []
  }
}

export function saveTutorBookings(rows: TutorBooking[]) {
  const key = userStorageKey(BOOK_KEY)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(rows))
}

export function getBookingById(id: string) {
  return loadTutorBookings().find(b => b.id === id) ?? null
}

function reviewsFor(name: string, subject: string): TutorReview[] {
  const first = firstName(name)
  return [
    {
      name: 'Aisha R.',
      rating: 5,
      body: `${first} explained the hard parts clearly and helped me ship the next milestone the same week.`,
      context: subject === 'Programming' ? 'React Expense Tracker' : `${subject} coaching`,
    },
    {
      name: 'Rohan K.',
      rating: 5,
      body: 'Patient, structured, and practical. I finally understood what I was missing.',
      context: '1-on-1 Learning',
    },
    {
      name: 'Meera S.',
      rating: 4,
      body: 'Great project review. I left with a clear list of what to improve before submitting.',
      context: 'Project Help',
    },
    {
      name: 'Dev P.',
      rating: 5,
      body: 'Interview prep felt like a real loop — questions, feedback, then a better answer.',
      context: 'Interview Preparation',
    },
  ]
}

type Seed = {
  slug: string
  name: string
  title: string
  intro: string
  bio: string
  expertise: string[]
  skills: string[]
  subject: TutorSubject
  rating: number
  reviewCount: number
  students: number
  experienceYears: number
  hourlyRate: number
  languages?: string[]
  industries?: string[]
  badges?: TutorBadge[]
  support?: SupportFlag[]
  courses?: { title: string; href: string }[]
  projects?: { title: string; href: string }[]
  careerSpecialties?: string[]
  aiMatch?: number
  aiMatchReason?: string
  matchReasons?: string[]
  today?: boolean
  week?: boolean
  onlineNow?: boolean
  slotsToday?: string[]
}

function expand(seed: Seed): CatalogTutor {
  const support = seed.support ?? ['ai']
  const badges = [...(seed.badges ?? [])]
  if (seed.today && !badges.includes('Available Today')) badges.push('Available Today')
  if (seed.rating >= 4.8 && !badges.includes('Top Rated')) badges.push('Top Rated')
  if (support.includes('project') && !badges.includes('Project Expert')) badges.push('Project Expert')
  if (support.includes('career') && !badges.includes('Career Mentor')) badges.push('Career Mentor')
  return {
    id: `catalog-${seed.slug}`,
    name: seed.name,
    title: seed.title,
    intro: seed.intro,
    bio: seed.bio,
    expertise: seed.expertise,
    skills: seed.skills,
    subject: seed.subject,
    rating: seed.rating,
    reviewCount: seed.reviewCount,
    students: seed.students,
    experienceYears: seed.experienceYears,
    hourlyRate: seed.hourlyRate,
    languages: seed.languages ?? ['English'],
    industries: seed.industries ?? ['Education', 'Technology'],
    teachingStyle: STYLE_DEFAULT,
    badges,
    courses: seed.courses ?? [{ title: `${seed.subject} fundamentals`, href: `/courses?q=${encodeURIComponent(seed.skills[0] ?? seed.subject)}` }],
    projects: seed.projects ?? [],
    careerSpecialties: seed.careerSpecialties ?? [],
    support,
    aiMatch: seed.aiMatch ?? Math.round(seed.rating * 18),
    aiMatchReason:
      seed.aiMatchReason ??
      `${firstName(seed.name)} matches your ${seed.expertise.slice(0, 2).join(' + ')} learning path.`,
    matchReasons: seed.matchReasons ?? [
      `You're currently building skills in ${seed.skills[0]}`,
      `${firstName(seed.name)} specializes in ${seed.expertise[0]}`,
    ],
    availability: {
      today: seed.today !== false,
      thisWeek: seed.week !== false,
      onlineNow: Boolean(seed.onlineNow),
      slotsToday: seed.slotsToday ?? (seed.today === false ? [] : ['6:30 PM', '8:00 PM', '9:30 PM']),
      weekly: WEEKLY_DEFAULT,
    },
    reviews: reviewsFor(seed.name, seed.subject),
    demo: true,
  }
}

const FEATURED: Seed[] = [
  {
    slug: 'sarah-kim',
    name: 'Dr. Sarah Kim',
    title: 'Senior Full Stack Engineer & Educator',
    intro:
      'Senior Full Stack Engineer helping students build production-ready applications and prepare for technical interviews.',
    bio: "Sarah has spent 8 years shipping product at scale and teaching engineers how to think in systems. Her sessions start with the concept, then move into the student's actual codebase — courses, projects, and interview loops included.",
    expertise: ['React', 'Node.js', 'Full Stack'],
    skills: ['React', 'JavaScript', 'Node.js'],
    subject: 'Programming',
    rating: 4.9,
    reviewCount: 2400,
    students: 2400,
    experienceYears: 8,
    hourlyRate: 800,
    languages: ['English', 'Korean'],
    industries: ['SaaS', 'EdTech', 'FinTech'],
    badges: ['AI Recommended', 'Project Specialist', 'Career Mentor', 'Top Rated'],
    support: ['project', 'ai', 'interview', 'career'],
    courses: [
      { title: 'Full Stack Web Development', href: '/courses?q=Full%20Stack' },
      { title: 'Advanced React', href: '/courses?q=React' },
    ],
    projects: [
      { title: 'React Expense Tracker', href: '/projects/catalog-react-expense' },
      { title: 'Full Stack Authentication', href: '/projects/catalog-fullstack-auth' },
      { title: 'REST API Dashboard', href: '/projects?q=REST%20API' },
    ],
    careerSpecialties: ['Technical interviews', 'Career planning', 'Resume'],
    aiMatch: 94,
    aiMatchReason:
      'Sarah matches your React + Node.js learning path and your current project requirements.',
    matchReasons: [
      "You're currently learning React",
      'Your project uses REST APIs',
      'You need help with backend architecture',
      'Sarah specializes in these skills',
    ],
    today: true,
    onlineNow: true,
    slotsToday: ['6:30 PM', '8:00 PM', '9:30 PM'],
  },
  {
    slug: 'rahul-mehta',
    name: 'Rahul Mehta',
    title: 'Data Analyst & Python Mentor',
    intro: 'Turns messy datasets into decisions, then teaches students to do the same with SQL and Python.',
    bio: 'Rahul coaches analysts who need more than dashboards — clean queries, honest metrics, and a story a stakeholder can use. He has led analytics teams in retail and fintech.',
    expertise: ['Python', 'Data Analytics'],
    skills: ['Python', 'SQL', 'Excel'],
    subject: 'Data Analytics',
    rating: 4.8,
    reviewCount: 860,
    students: 1280,
    experienceYears: 7,
    hourlyRate: 650,
    support: ['project', 'ai', 'career'],
    today: true,
    slotsToday: ['6:00 PM', '7:30 PM'],
    aiMatch: 81,
  },
  {
    slug: 'priya-sharma',
    name: 'Priya Sharma',
    title: 'AI Engineer & Machine Learning Mentor',
    intro: 'Helps students go from Python notebooks to models they can explain in an interview.',
    bio: 'Priya builds applied ML systems and mentors students who want to understand the math, the pipeline, and the product constraint — not just the library.',
    expertise: ['AI', 'Machine Learning'],
    skills: ['Python', 'Machine Learning'],
    subject: 'AI & Machine Learning',
    rating: 4.9,
    reviewCount: 640,
    students: 980,
    experienceYears: 9,
    hourlyRate: 1200,
    support: ['project', 'ai', 'interview'],
    today: true,
    slotsToday: ['8:00 PM', '9:30 PM'],
    aiMatch: 76,
  },
  {
    slug: 'arjun-kapoor',
    name: 'Arjun Kapoor',
    title: 'Staff Backend Engineer',
    intro: 'System design and backend architecture for students ready to think beyond CRUD.',
    bio: 'Arjun has designed high-traffic APIs and coaches students through system design interviews with diagrams, trade-offs, and honest constraints.',
    expertise: ['System Design', 'Backend'],
    skills: ['Node.js', 'JavaScript', 'SQL'],
    subject: 'Programming',
    rating: 4.8,
    reviewCount: 410,
    students: 720,
    experienceYears: 11,
    hourlyRate: 1000,
    support: ['project', 'interview'],
    today: false,
    week: true,
    aiMatch: 72,
  },
  {
    slug: 'ananya-patel',
    name: 'Ananya Patel',
    title: 'Career Coach · Interview Mentor',
    intro: 'Career coaching for students who can build — and now need to tell that story in interviews.',
    bio: 'Ananya works with engineers and analysts on resumes, narrative, and interview loops. Sessions are practical: a better story, a tighter answer, a next-step plan.',
    expertise: ['Career Coach', 'Interview Mentor'],
    skills: ['Communication'],
    subject: 'Career',
    rating: 4.9,
    reviewCount: 520,
    students: 1100,
    experienceYears: 10,
    hourlyRate: 900,
    support: ['career', 'interview'],
    careerSpecialties: ['Resume', 'Interview', 'Career planning', 'Communication', 'Technical interviews'],
    badges: ['Career Mentor', 'Top Rated'],
    today: true,
    slotsToday: ['6:30 PM', '8:00 PM'],
    aiMatch: 70,
  },
  {
    slug: 'emily-chen',
    name: 'Emily Chen',
    title: 'English Communication Coach',
    intro: 'Clear professional English for presentations, interviews, and stakeholder conversations.',
    bio: 'Emily coaches learners who already have the ideas — and need the language to land them. Sessions mix speaking drills with real workplace scenarios.',
    expertise: ['English', 'Communication'],
    skills: ['Communication', 'English'],
    subject: 'English',
    rating: 4.8,
    reviewCount: 390,
    students: 860,
    experienceYears: 6,
    hourlyRate: 550,
    support: ['career', 'interview'],
    today: true,
  },
  {
    slug: 'vikram-rao',
    name: 'Vikram Rao',
    title: 'MBA Strategy Mentor',
    intro: 'Case method, frameworks, and the judgment to use them under time pressure.',
    bio: 'Vikram taught case interviews after a decade in consulting. He focuses on structure, numbers, and how to sound like you belong in the room.',
    expertise: ['MBA', 'Strategy'],
    skills: ['Excel', 'Communication'],
    subject: 'MBA',
    rating: 4.7,
    reviewCount: 210,
    students: 340,
    experienceYears: 12,
    hourlyRate: 1500,
    support: ['career', 'interview'],
    today: false,
    week: true,
  },
  {
    slug: 'sana-qureshi',
    name: 'Sana Qureshi',
    title: 'Finance & Markets Educator',
    intro: 'Markets, models, and the language of finance without the intimidation.',
    bio: 'Sana spent years in equity research and now teaches students how statements, ratios, and valuation actually connect.',
    expertise: ['Finance', 'Valuation'],
    skills: ['Excel', 'SQL'],
    subject: 'Finance',
    rating: 4.8,
    reviewCount: 180,
    students: 410,
    experienceYears: 8,
    hourlyRate: 950,
    support: ['career', 'ai'],
    today: true,
    slotsToday: ['7:00 PM', '8:30 PM'],
  },
  {
    slug: 'daniel-okonkwo',
    name: 'Daniel Okonkwo',
    title: 'Business Analytics Lead',
    intro: 'Helps operators turn KPIs into a weekly decision rhythm.',
    bio: 'Daniel coaches product and ops students on dashboards that people actually use — north-star metrics, commentary, and a point of view.',
    expertise: ['Business', 'Analytics'],
    skills: ['Excel', 'SQL', 'Python'],
    subject: 'Business',
    rating: 4.7,
    reviewCount: 260,
    students: 530,
    experienceYears: 9,
    hourlyRate: 700,
    support: ['project', 'career'],
    today: true,
  },
  {
    slug: 'kavya-nair',
    name: 'Kavya Nair',
    title: 'Interview Prep Specialist',
    intro: 'Technical and behavioral interview loops with feedback you can reuse next week.',
    bio: 'Kavya ran university recruiting and now drills students through realistic loops: system design, coding, and the story of their projects.',
    expertise: ['Interview Prep', 'System Design'],
    skills: ['JavaScript', 'Communication'],
    subject: 'Interview Prep',
    rating: 4.9,
    reviewCount: 310,
    students: 640,
    experienceYears: 7,
    hourlyRate: 850,
    support: ['interview', 'career', 'project'],
    today: true,
    slotsToday: ['6:00 PM', '8:00 PM', '9:30 PM'],
  },
  {
    slug: 'hiro-tanaka',
    name: 'Hiro Tanaka',
    title: 'Applied AI Mentor',
    intro: 'LLMs, retrieval, and product sense for students building AI features.',
    bio: 'Hiro ships AI features in production and teaches students how to evaluate models, design prompts, and know when not to use one.',
    expertise: ['AI', 'LLMs'],
    skills: ['Python', 'Machine Learning', 'AI'],
    subject: 'AI & Machine Learning',
    rating: 4.8,
    reviewCount: 150,
    students: 290,
    experienceYears: 6,
    hourlyRate: 1400,
    support: ['project', 'ai'],
    today: false,
    week: true,
  },
  {
    slug: 'marcus-webb',
    name: 'Marcus Webb',
    title: 'Career Strategist',
    intro: 'Role targeting, portfolio narrative, and a 90-day plan that is actually doable.',
    bio: 'Marcus coaches career switchers who have skills but no map. Sessions produce a target role, a gap list, and a project plan.',
    expertise: ['Career planning', 'Resume'],
    skills: ['Communication'],
    subject: 'Career',
    rating: 4.6,
    reviewCount: 140,
    students: 270,
    experienceYears: 14,
    hourlyRate: 1100,
    support: ['career'],
    careerSpecialties: ['Resume', 'Career planning', 'Communication'],
    today: false,
    week: true,
  },
]

const FIRST = [
  'Aarav', 'Diya', 'Ishaan', 'Kiara', 'Rohan', 'Tara', 'Aditya', 'Nisha', 'Kabir', 'Leela',
  'Yash', 'Pooja', 'Neil', 'Rhea', 'Aman', 'Sneha', 'Farhan', 'Isha', 'Varun', 'Maya',
  'Kunal', 'Anika', 'Ravi', 'Sofia', 'Harsh', 'Lara', 'Om', 'Zara', 'Vivek', 'Nina',
  'Sameer', 'Alia', 'Gaurav', 'Freya', 'Nikhil', 'Inaaya', 'Raj', 'Hana',
]
const LAST = [
  'Sharma', 'Patel', 'Iyer', 'Nair', 'Khan', 'Das', 'Reddy', 'Gupta', 'Banerjee', 'Joshi',
  'Malhotra', 'Singh', 'Chawla', 'Desai', 'Bose', 'Menon',
]
const TRACKS: Array<{
  subject: TutorSubject
  skills: string[]
  expertise: string[]
  title: string
  support: SupportFlag[]
}> = [
  { subject: 'Programming', skills: ['React', 'JavaScript'], expertise: ['React', 'Frontend'], title: 'Frontend Mentor', support: ['project', 'ai'] },
  { subject: 'Programming', skills: ['Node.js', 'JavaScript'], expertise: ['Node.js', 'APIs'], title: 'Backend Mentor', support: ['project', 'interview'] },
  { subject: 'AI & Machine Learning', skills: ['Python', 'Machine Learning'], expertise: ['ML', 'Python'], title: 'ML Coach', support: ['ai', 'project'] },
  { subject: 'Data Analytics', skills: ['SQL', 'Python'], expertise: ['SQL', 'Analytics'], title: 'Analytics Mentor', support: ['project', 'career'] },
  { subject: 'Business', skills: ['Excel', 'Communication'], expertise: ['Business', 'Ops'], title: 'Business Coach', support: ['career'] },
  { subject: 'MBA', skills: ['Excel', 'Communication'], expertise: ['MBA', 'Cases'], title: 'Case Mentor', support: ['interview', 'career'] },
  { subject: 'English', skills: ['Communication', 'English'], expertise: ['English', 'Speaking'], title: 'English Coach', support: ['career', 'interview'] },
  { subject: 'Finance', skills: ['Excel', 'SQL'], expertise: ['Finance', 'Models'], title: 'Finance Mentor', support: ['career'] },
  { subject: 'Career', skills: ['Communication'], expertise: ['Career', 'Resume'], title: 'Career Guide', support: ['career', 'interview'] },
  { subject: 'Interview Prep', skills: ['JavaScript', 'Communication'], expertise: ['Interviews', 'DSA'], title: 'Interview Coach', support: ['interview', 'project'] },
]
const RATES = [420, 480, 560, 640, 720, 880, 980, 1250, 1600, 2100]
const YEARS = [2, 3, 4, 6, 8, 11, 13]
const SLOTS = [
  ['6:00 PM', '7:00 PM'],
  ['6:30 PM', '8:00 PM', '9:30 PM'],
  ['7:30 PM', '9:00 PM'],
  [],
]

function generatedTutors(count: number): CatalogTutor[] {
  const out: CatalogTutor[] = []
  for (let i = 0; i < count; i++) {
    const track = TRACKS[i % TRACKS.length]
    const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`
    const years = YEARS[i % YEARS.length]
    const rate = RATES[i % RATES.length]
    const today = i % 4 !== 3
    out.push(
      expand({
        slug: `t-${i}`,
        name,
        title: track.title,
        intro: `${track.title} helping students grow in ${track.expertise.join(' and ')}.`,
        bio: `${name} has ${years} years of experience and teaches with a calm, structured style. Sessions stay tied to the student's current course, project, or interview goal.`,
        expertise: track.expertise,
        skills: track.skills,
        subject: track.subject,
        rating: Number((4.2 + ((i * 7) % 8) / 10).toFixed(1)),
        reviewCount: 40 + (i * 13) % 400,
        students: 80 + (i * 37) % 900,
        experienceYears: years,
        hourlyRate: rate,
        support: track.support,
        today,
        week: true,
        onlineNow: i % 9 === 0,
        slotsToday: today ? SLOTS[i % SLOTS.length] : [],
        aiMatch: 52 + (i % 28),
      }),
    )
  }
  return out
}

const MOCK_TUTORS: CatalogTutor[] = FEATURED.map(expand)

function inferSubject(row: TutorListing): TutorSubject {
  const blob = `${row.subject ?? ''} ${row.expertise ?? ''} ${row.tags.join(' ')}`.toLowerCase()
  if (/interview/.test(blob)) return 'Interview Prep'
  if (/career|resume/.test(blob)) return 'Career'
  if (/english|communication/.test(blob) && /program|react|python/.test(blob) === false) return 'English'
  if (/mba|case/.test(blob)) return 'MBA'
  if (/finance|account/.test(blob)) return 'Finance'
  if (/business/.test(blob)) return 'Business'
  if (/data|sql|analytics/.test(blob)) return 'Data Analytics'
  if (/ai|ml|machine/.test(blob)) return 'AI & Machine Learning'
  return 'Programming'
}

function hourlyFromCents(cents: number) {
  const n = cents / 100
  if (n < 200) return Math.round(n * 80)
  return Math.round(n)
}

function fromApi(row: TutorListing): CatalogTutor {
  const tags = row.tags ?? []
  const skills = skillTagsFromListing(tags).length ? skillTagsFromListing(tags) : []
  const rate = hourlyFromCents(row.hourly_rate_cents)
  const subject = inferSubject(row)
  const expertise = row.expertise
    ? row.expertise.split(/[·,&]/).map(s => s.trim()).filter(Boolean)
    : skills.slice(0, 3)
  const availabilityMeta = decodeAvailabilityFromTags(tags)
  const weekly = availabilityMeta ? weeklyHoursFromAvailability(availabilityMeta.availability) : []
  const todayOpen = availabilityMeta
    ? row.available && !availabilityMeta.vacationMode && isListingDateAvailable(availabilityMeta, new Date())
    : Boolean(row.available)
  const slotsToday = availabilityMeta && row.available && !availabilityMeta.vacationMode
    ? listingSlotsForDate(availabilityMeta, new Date()).filter(s => s.open).map(s => s.time)
    : []
  return {
    id: row.id,
    name: row.name,
    title: row.expertise || 'LearnSyra Tutor',
    intro: row.intro || '',
    bio: row.intro || '',
    expertise,
    skills,
    subject,
    rating: Number(row.rating) || 0,
    reviewCount: row.reviews || 0,
    students: row.students_taught || 0,
    experienceYears: 0,
    hourlyRate: rate,
    languages: [],
    industries: [],
    teachingStyle: [],
    badges: [],
    courses: [],
    projects: [],
    careerSpecialties: [],
    support: [],
    aiMatch: 0,
    aiMatchReason: '',
    matchReasons: [],
    availability: {
      today: todayOpen,
      thisWeek: availabilityMeta
        ? row.available && !availabilityMeta.vacationMode && availabilityMeta.availability.some(d => d.enabled)
        : Boolean(row.available),
      onlineNow: false,
      slotsToday,
      weekly,
    },
    reviews: [],
    avatarUrl: row.image_key || null,
    availabilityMeta: availabilityMeta ?? undefined,
    demo: row.id.startsWith('demo-') || row.id.startsWith('catalog-'),
  }
}

export function buildTutorCatalog(apiRows: TutorListing[]): CatalogTutor[] {
  const fromRows = apiRows.map(fromApi)
  const extra = MOCK_TUTORS.filter(m => !fromRows.some(r => r.name.toLowerCase() === m.name.toLowerCase()))
  return applyPublishedHubs([...fromRows, ...extra])
}

export function getTutorById(catalog: CatalogTutor[], id: string) {
  const fromCat = catalog.find(t => t.id === id)
  if (fromCat) return fromCat
  const hub = findHubByPublicId(id)
  if (hub) return catalogTutorFromHub(hub)
  return (
    MOCK_TUTORS.find(t => t.id === id || t.id === `catalog-${id}` || (id === 'mock-sarah' && t.name === 'Dr. Sarah Kim')) ||
    null
  )
}

export function recommendTutor(catalog: CatalogTutor[], query = '') {
  const live = catalog.filter(t => !t.demo)
  const pool = live.length ? live : catalog
  const q = query.toLowerCase()
  const scored = pool.map(t => {
    let score = t.fromTutorHub ? 8 : 0
    if (t.rating > 0) score += t.rating
    if (q) {
      const blob = `${t.name} ${t.title} ${t.skills.join(' ')} ${t.expertise.join(' ')} ${t.subject} ${t.careerSpecialties.join(' ')}`.toLowerCase()
      if (blob.includes(q)) score += 20
      q.split(/\s+/).forEach(w => {
        if (w.length > 2 && blob.includes(w)) score += 4
      })
    }
    return { t, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.t ?? pool[0]
}

export function matchesCategory(tutor: CatalogTutor, cat: string) {
  if (cat === 'All Tutors' || cat === 'All') return true
  return tutor.subject === cat
}

export function generateSessionBrief(tutor: CatalogTutor, goal: string, sessionLabel: string) {
  const topics = tutor.skills.slice(0, 3)
  if (/project|architecture|api/i.test(goal)) {
    return {
      topics: ['React Hooks', 'REST APIs', 'Project Architecture'],
      questions: [
        'What should I improve in my project architecture?',
        'Where is the riskiest part of this design?',
      ],
      text: `Session brief for ${tutor.name} (${sessionLabel}): focus on ${topics.join(', ')}. Goal: ${goal || 'project help'}.`,
    }
  }
  return {
    topics: topics.length ? topics : ['Core concepts', 'Practice', 'Next steps'],
    questions: [
      `What should I practice after this ${sessionLabel.toLowerCase()} session?`,
      'Which misconception should I fix first?',
    ],
    text: `Session brief for ${tutor.name}: ${goal || 'guided learning'} across ${topics.join(', ')}.`,
  }
}

export function upcomingDates(count = 14) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function isDateAvailable(tutor: CatalogTutor, date: Date) {
  const hub = findHubByPublicId(tutor.id)
  if (hub) return isHubDateAvailable(hub, date)
  if (tutor.availabilityMeta) return isListingDateAvailable(tutor.availabilityMeta, date)
  if (tutor.demo) {
    const day = date.getDay()
    if (day === 0) return false
    if (iSameDay(date, new Date())) return tutor.availability.today
    return tutor.availability.thisWeek
  }
  return tutor.availability.today || tutor.availability.thisWeek
}

function iSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function slotsForDate(tutor: CatalogTutor, date: Date) {
  const hub = findHubByPublicId(tutor.id)
  if (hub) return hubSlotsForDate(hub, date)
  if (tutor.availabilityMeta) return listingSlotsForDate(tutor.availabilityMeta, date)
  if (!tutor.demo) {
    return tutor.availability.slotsToday.map(time => ({ time, open: true }))
  }
  const base = ['6:00 PM', '6:30 PM', '7:00 PM', '8:00 PM', '9:30 PM']
  if (iSameDay(date, new Date())) {
    return base.map(time => ({ time, open: tutor.availability.slotsToday.includes(time) }))
  }
  const openSet = new Set(tutor.availability.slotsToday.length ? tutor.availability.slotsToday : ['6:30 PM', '8:00 PM'])
  if (date.getDay() === 3) openSet.add('7:00 PM')
  return base.map(time => ({ time, open: openSet.has(time) || time === '6:30 PM' }))
}

export function formatLongDate(date: Date) {
  return date.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })
}

export function calendarBlob(booking: TutorBooking, tutorName: string) {
  const safe = `${booking.date} ${booking.time}`.replace(/,/g, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LearnSyra//Tutor Session//EN',
    'BEGIN:VEVENT',
    `SUMMARY:LearnSyra · ${booking.sessionLabel} with ${tutorName}`,
    `DESCRIPTION:${booking.goal || 'Tutor session'}`,
    `DTSTART:${safe}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
}
