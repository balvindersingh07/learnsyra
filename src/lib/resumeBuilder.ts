export type ResumeSectionId =
  | 'contact'
  | 'summary'
  | 'target'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certs'
  | 'achievements'
  | 'extra'

export type ResumeTemplate = 'minimal' | 'modern' | 'professional' | 'technical'
export type SkillCategory = 'Technical' | 'Tools' | 'Languages' | 'Soft Skills'

export const RESUME_ROLES = [
  'Frontend Developer',
  'React Developer',
  'Full Stack Developer',
  'Software Engineer',
  'Data Analyst',
  'Business Analyst',
  'Product Analyst',
] as const

export type ResumeRole = (typeof RESUME_ROLES)[number]

export interface ResumeContact {
  name: string
  title: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
  portfolio: string
}

export interface ResumeExperience {
  id: string
  title: string
  company: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  bullets: string[]
}

export interface ResumeEducation {
  id: string
  degree: string
  institution: string
  location: string
  startDate: string
  endDate: string
  grade: string
  coursework: string
}

export interface ResumeSkill {
  id: string
  name: string
  category: SkillCategory
  verified: boolean
  included: boolean
}

export interface ResumeProject {
  projectId: string
  title: string
  description: string
  skills: string[]
  score: number
  bullets: string[]
  included: boolean
  portfolioReady: boolean
}

export interface ResumeCert {
  id: string
  title: string
  issuer: string
  completed: string
  official: boolean
  included: boolean
}

export interface ResumeAchievement {
  id: string
  label: string
  included: boolean
}

export interface ResumeExtra {
  languages: string
  interests: string
  volunteer: string
  publications: string
  awards: string
  opensource: string
  links: string
}

export interface JobSuggestion {
  id: string
  area: 'summary' | 'skills' | 'projects'
  text: string
  applied: boolean
}

export interface JobTarget {
  id: string
  title: string
  company: string
  description: string
  matchedSkills: string[]
  missingSkills: string[]
  matchScore: number
  suggestions: JobSuggestion[]
  resumeVersionId: string
}

export interface ResumeScores {
  completeness: number
  contact: boolean
  summary: boolean
  skills: boolean
  projects: boolean
  experience: number
  education: boolean
  achievements: number
  ats: number
  keywords: number
  structure: number
  readability: number
  roleMatch: number
  missingKeywords: string[]
}

export interface ResumeDoc {
  id: string
  versionName: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  template: ResumeTemplate
  targetRole: string
  contact: ResumeContact
  summary: string
  experience: ResumeExperience[]
  education: ResumeEducation[]
  skills: ResumeSkill[]
  projects: ResumeProject[]
  certifications: ResumeCert[]
  achievements: ResumeAchievement[]
  extra: ResumeExtra
  extraOpen: boolean
  jobTarget: JobTarget | null
}

export interface ResumeCareerOverlay {
  resumeScore: number
  atsScore: number
  completeness: number
  targetRole: string
  roleMatch: number
  checks: { label: string; ok: boolean }[]
}

const STORE_KEY = 'learnsyra_resume_docs'
const ACTIVE_KEY = 'learnsyra_resume_active'
const OVERLAY_KEY = 'learnsyra_resume_career'

export const SECTIONS: { id: ResumeSectionId; label: string }[] = [
  { id: 'contact', label: 'Contact' },
  { id: 'summary', label: 'Professional Summary' },
  { id: 'target', label: 'Target Role' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'certs', label: 'Certifications' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'extra', label: 'Additional Information' },
]

export const TEMPLATES: { id: ResumeTemplate; title: string; desc: string }[] = [
  { id: 'minimal', title: 'Minimal', desc: 'Clean ATS-first layout.' },
  { id: 'modern', title: 'Modern', desc: 'Subtle LearnSyra visual style.' },
  { id: 'professional', title: 'Professional', desc: 'Traditional corporate layout.' },
  { id: 'technical', title: 'Technical', desc: 'Developer-focused layout.' },
]

const KNOWN_SKILLS = [
  'React',
  'JavaScript',
  'TypeScript',
  'REST APIs',
  'Node.js',
  'MongoDB',
  'HTML',
  'CSS',
  'Testing',
  'Accessibility',
  'Git',
  'SQL',
  'Python',
]

export function uid(prefix = 'r') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function emptyExperience(): ResumeExperience {
  return {
    id: uid('ex'),
    title: '',
    company: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    bullets: [''],
  }
}

export function emptyEducation(): ResumeEducation {
  return {
    id: uid('ed'),
    degree: '',
    institution: '',
    location: '',
    startDate: '',
    endDate: '',
    grade: '',
    coursework: '',
  }
}

export function emptyExtra(): ResumeExtra {
  return {
    languages: '',
    interests: '',
    volunteer: '',
    publications: '',
    awards: '',
    opensource: '',
    links: '',
  }
}

export function createResume(input: {
  name: string
  email: string
  headline?: string
  targetRole: string
  verifiedSkills: string[]
  suggestedSkills: string[]
  projects: ResumeProject[]
  certifications: ResumeCert[]
  achievements: ResumeAchievement[]
  summary?: string
  versionName?: string
}): ResumeDoc {
  const now = new Date().toISOString()
  const skills: ResumeSkill[] = []
  const seen = new Set<string>()
  input.verifiedSkills.forEach(name => {
    if (seen.has(name.toLowerCase())) return
    seen.add(name.toLowerCase())
    skills.push({ id: uid('sk'), name, category: 'Technical', verified: true, included: true })
  })
  input.suggestedSkills.forEach(name => {
    if (seen.has(name.toLowerCase())) return
    seen.add(name.toLowerCase())
    skills.push({ id: uid('sk'), name, category: 'Technical', verified: false, included: false })
  })
  return {
    id: uid('rs'),
    versionName: input.versionName ?? 'General Resume',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    template: 'minimal',
    targetRole: input.targetRole,
    contact: {
      name: input.name,
      title: input.headline || input.targetRole,
      email: input.email,
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      portfolio: '',
    },
    summary: input.summary ?? '',
    experience: [],
    education: [],
    skills,
    projects: input.projects,
    certifications: input.certifications,
    achievements: input.achievements,
    extra: emptyExtra(),
    extraOpen: false,
    jobTarget: null,
  }
}

export function scoreResume(doc: ResumeDoc): ResumeScores {
  const contact = Boolean(doc.contact.name.trim() && doc.contact.email.trim())
  const summary = doc.summary.trim().length >= 40
  const skills = doc.skills.filter(s => s.included).length >= 3
  const projects = doc.projects.some(p => p.included)
  const expFilled = doc.experience.filter(e => e.title.trim() && e.company.trim())
  const expBullets = expFilled.flatMap(e => e.bullets.filter(b => b.trim().length > 12))
  const experience = expFilled.length === 0 ? 60 : Math.min(100, 60 + expBullets.length * 10)
  const education = doc.education.some(e => e.institution.trim() && e.degree.trim())
  const ach = doc.achievements.filter(a => a.included).length
  const achievements = ach === 0 ? 40 : Math.min(100, 40 + ach * 20)

  const have = doc.skills.filter(s => s.included).map(s => s.name.toLowerCase())
  const roleNeed: Record<string, string[]> = {
    'Frontend Developer': ['react', 'javascript', 'typescript', 'testing', 'accessibility'],
    'React Developer': ['react', 'javascript', 'typescript'],
    'Full Stack Developer': ['react', 'javascript', 'rest apis', 'node.js'],
    'Software Engineer': ['javascript', 'git', 'rest apis'],
    'Data Analyst': ['sql', 'python'],
    'Business Analyst': ['sql'],
    'Product Analyst': ['sql'],
  }
  const needed = roleNeed[doc.targetRole] ?? roleNeed['Frontend Developer']
  const matched = needed.filter(n => have.some(h => h.includes(n) || n.includes(h)))
  const labelFor = (n: string) => {
    if (n === 'rest apis') return 'REST APIs'
    if (n === 'node.js') return 'Node.js'
    if (n === 'typescript') return 'TypeScript'
    return n.replace(/\b\w/g, c => c.toUpperCase())
  }
  const missingKeywords = needed.filter(n => !matched.includes(n)).map(labelFor)
  const keywords = Math.round((matched.length / needed.length) * 100)
  const structure = [contact, summary, skills, projects, education || true].filter(Boolean).length * 18
  const readability = Math.min(100, 50 + Math.min(40, Math.floor(doc.summary.trim().length / 8)))
  const roleMatch = Math.round(keywords * 0.7 + (projects ? 20 : 0) + (summary ? 10 : 0))
  const ats = Math.round(keywords * 0.3 + Math.min(90, structure) * 0.25 + readability * 0.2 + roleMatch * 0.25)
  const completeness = Math.round(
    (contact ? 14 : 0) +
      (summary ? 14 : 4) +
      (skills ? 14 : 0) +
      (projects ? 14 : 0) +
      experience * 0.14 +
      (education ? 12 : 0) +
      achievements * 0.1 +
      8,
  )
  return {
    completeness: Math.max(12, Math.min(96, completeness)),
    contact,
    summary,
    skills,
    projects,
    experience,
    education,
    achievements,
    ats: Math.max(40, Math.min(96, ats)),
    keywords,
    structure: Math.min(100, structure),
    readability,
    roleMatch: Math.min(96, roleMatch),
    missingKeywords,
  }
}

export function generateSummary(doc: ResumeDoc) {
  const skills = doc.skills.filter(s => s.included).map(s => s.name)
  const projects = doc.projects.filter(p => p.included).map(p => p.title)
  const parts: string[] = []
  if (doc.targetRole) parts.push(`${doc.contact.title || doc.targetRole} focused on ${doc.targetRole} work`)
  if (skills.length) parts.push(`with strengths in ${skills.slice(0, 4).join(', ')}`)
  if (projects.length) parts.push(`and LearnSyra project work on ${projects.join(' and ')}`)
  const base = parts.join(' ')
  if (!base) return 'Write a short professional summary using your real skills and projects.'
  return `${base}. Looking for a role where these skills can be applied to product work.`
}

export function rewriteSummary(text: string, mode: 'improve' | 'concise' | 'technical' | 'career', doc: ResumeDoc) {
  const raw = text.trim() || generateSummary(doc)
  if (mode === 'concise') {
    return raw
      .replace(/Looking for a role where these skills can be applied to product work\.?/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220)
  }
  if (mode === 'technical') {
    const skills = doc.skills.filter(s => s.included).map(s => s.name).slice(0, 5).join(', ')
    return skills ? `${raw.replace(/\.$/, '')} Comfortable working with ${skills}.` : raw
  }
  if (mode === 'career') {
    return `${raw.replace(/\.$/, '')} Targeting ${doc.targetRole} opportunities that use existing LearnSyra projects and skills.`
  }
  return raw.includes('Looking for') ? raw : `${raw} Looking for a ${doc.targetRole} role aligned with this background.`
}

export function improveBullet(original: string, variant = 0) {
  const text = original.trim()
  if (!text) return ''
  const variants = [
    text
      .replace(/^worked on/i, 'Developed')
      .replace(/^built/i, 'Designed and built')
      .replace(/^made/i, 'Implemented')
      .replace(/^used/i, 'Applied')
      .replace(/^helped/i, 'Supported'),
    text.replace(/\.$/, '') + ' with a focus on maintainable structure.',
    text.replace(/\.$/, '') + ' as part of the existing project scope.',
  ]
  let next = variants[variant % variants.length]
  if (next.toLowerCase() === text.toLowerCase()) {
    next = `Developed ${text.charAt(0).toLowerCase()}${text.slice(1)}`.replace(/\.$/, '.')
  }
  if (!/[.!?]$/.test(next)) next += '.'
  return next
}

export function projectBullets(project: ResumeProject) {
  const skills = project.skills.slice(0, 3).join(', ')
  const lines = [
    `Built ${project.title} using ${skills || 'the project stack'}.`,
    project.description.trim()
      ? `Implemented ${project.description.replace(/^Build /i, '').replace(/\.$/, '')}.`
      : `Implemented core features documented for this LearnSyra project.`,
    skills ? `Integrated ${project.skills[project.skills.length - 1]} within the project scope.` : `Documented the project for portfolio review.`,
  ]
  return lines.slice(0, 3)
}

export function analyzeJob(description: string, doc: ResumeDoc): JobTarget {
  const blob = description.toLowerCase()
  const have = doc.skills.filter(s => s.included).map(s => s.name)
  const matched = KNOWN_SKILLS.filter(s => blob.includes(s.toLowerCase()) && have.some(h => h.toLowerCase() === s.toLowerCase()))
  const mentioned = KNOWN_SKILLS.filter(s => blob.includes(s.toLowerCase()))
  const missing = mentioned.filter(s => !have.some(h => h.toLowerCase() === s.toLowerCase()))
  const matchScore = mentioned.length ? Math.round((matched.length / mentioned.length) * 100) : doc.skills.filter(s => s.included).length ? 72 : 40
  const suggestions: JobSuggestion[] = []
  if (have.includes('React') || have.includes('JavaScript')) {
    suggestions.push({
      id: uid('sg'),
      area: 'summary',
      text: 'Highlight your React and API experience.',
      applied: false,
    })
  }
  if (have.includes('React')) {
    suggestions.push({
      id: uid('sg'),
      area: 'skills',
      text: 'Move React and JavaScript higher.',
      applied: false,
    })
  }
  if (doc.projects.some(p => /expense|api/i.test(p.title + p.skills.join(' ')))) {
    suggestions.push({
      id: uid('sg'),
      area: 'projects',
      text: 'Emphasize API integration in your Expense Tracker.',
      applied: false,
    })
  }
  const titleMatch = description.split(/[\n.]/)[0]?.slice(0, 80) || doc.targetRole
  return {
    id: uid('job'),
    title: titleMatch,
    company: '',
    description,
    matchedSkills: matched.length ? matched : have.filter(h => blob.includes(h.toLowerCase())),
    missingSkills: missing.slice(0, 6),
    matchScore: Math.max(40, Math.min(96, matchScore)),
    suggestions,
    resumeVersionId: doc.id,
  }
}

export function applyJobSuggestion(doc: ResumeDoc, suggestion: JobSuggestion): ResumeDoc {
  const next = { ...doc, updatedAt: new Date().toISOString() }
  if (suggestion.area === 'summary') {
    if (!next.summary.toLowerCase().includes('react') && next.skills.some(s => s.name === 'React')) {
      next.summary = `${next.summary.trim()} Highlights React and API work from LearnSyra projects.`.trim()
    }
  }
  if (suggestion.area === 'skills') {
    next.skills = [...next.skills].sort((a, b) => {
      const rank = (n: string) => (n === 'React' ? 0 : n === 'JavaScript' ? 1 : 2)
      return rank(a.name) - rank(b.name)
    })
  }
  if (suggestion.area === 'projects') {
    next.projects = next.projects.map(p => {
      if (!/expense/i.test(p.title)) return p
      const line = 'Integrated REST API calls for expense data within the project scope.'
      if (p.bullets.includes(line)) return p
      return { ...p, included: true, bullets: [...p.bullets.filter(Boolean), line] }
    })
  }
  if (next.jobTarget) {
    next.jobTarget = {
      ...next.jobTarget,
      suggestions: next.jobTarget.suggestions.map(s => (s.id === suggestion.id ? { ...s, applied: true } : s)),
    }
  }
  return next
}

export function applySafeImprovements(doc: ResumeDoc): { next: ResumeDoc; deltas: { label: string; delta: number }[]; from: number; to: number } {
  const from = scoreResume(doc).completeness
  let next = { ...doc }
  if (next.summary.trim().length < 40) next = { ...next, summary: generateSummary(next) }
  else next = { ...next, summary: rewriteSummary(next.summary, 'improve', next) }
  next.skills = [...next.skills].sort((a, b) => Number(b.included) - Number(a.included) || (a.name === 'React' ? -1 : 0))
  next.projects = next.projects.map(p => {
    if (!p.included) return p
    if (p.bullets.filter(Boolean).length >= 2) return p
    return { ...p, bullets: projectBullets(p) }
  })
  next.experience = next.experience.map(e => ({
    ...e,
    bullets: e.bullets.map(b => (b.trim().length > 8 && b.trim().length < 40 ? improveBullet(b, 0) : b)),
  }))
  next.updatedAt = new Date().toISOString()
  const to = scoreResume(next).completeness
  return {
    next,
    from,
    to,
    deltas: [
      { label: 'Summary', delta: 10 },
      { label: 'Skills', delta: 4 },
      { label: 'Projects', delta: 3 },
    ],
  }
}

export function cloneResume(doc: ResumeDoc, versionName: string, makeDefault = false): ResumeDoc {
  const id = uid('rs')
  const copy = JSON.parse(JSON.stringify(doc)) as ResumeDoc
  return {
    ...copy,
    id,
    versionName,
    isDefault: makeDefault,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobTarget: copy.jobTarget ? { ...copy.jobTarget, id: uid('job'), resumeVersionId: id } : null,
  }
}

export function loadDocs(): ResumeDoc[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as ResumeDoc[]) : []
  } catch {
    return []
  }
}

export function saveDocs(docs: ResumeDoc[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(docs.slice(0, 12)))
}

export function loadActiveId() {
  return localStorage.getItem(ACTIVE_KEY)
}

export function saveActiveId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id)
}

export function loadResumeCareerOverlay(): ResumeCareerOverlay | null {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY)
    return raw ? (JSON.parse(raw) as ResumeCareerOverlay) : null
  } catch {
    return null
  }
}

export function applyResumeOverlay(doc: ResumeDoc) {
  const scores = scoreResume(doc)
  const overlay: ResumeCareerOverlay = {
    resumeScore: scores.completeness,
    atsScore: scores.ats,
    completeness: scores.completeness,
    targetRole: doc.targetRole,
    roleMatch: scores.roleMatch,
    checks: [
      { label: 'Skills listed', ok: scores.skills },
      { label: 'Education', ok: scores.education },
      { label: 'Project descriptions', ok: scores.projects },
      { label: 'Quantified achievements', ok: scores.achievements >= 60 },
      { label: 'ATS optimization', ok: scores.ats >= 75 },
    ],
  }
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay))
}

export function relativeWhen(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return 'Today'
  if (days < 20) return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function sectionState(doc: ResumeDoc, id: ResumeSectionId): 'done' | 'warn' | 'empty' {
  const s = scoreResume(doc)
  if (id === 'contact') return s.contact ? 'done' : 'warn'
  if (id === 'summary') return s.summary ? 'done' : 'warn'
  if (id === 'target') return doc.targetRole ? 'done' : 'warn'
  if (id === 'experience') return s.experience >= 80 ? 'done' : 'warn'
  if (id === 'education') return s.education ? 'done' : 'empty'
  if (id === 'skills') return s.skills ? 'done' : 'warn'
  if (id === 'projects') return s.projects ? 'done' : 'warn'
  if (id === 'certs') return doc.certifications.some(c => c.included) ? 'done' : 'empty'
  if (id === 'achievements') return s.achievements >= 60 ? 'done' : 'warn'
  return Object.values(doc.extra).some(v => v.trim()) ? 'done' : 'empty'
}

export function exportPlain(doc: ResumeDoc) {
  const skills = doc.skills.filter(s => s.included).map(s => s.name).join(', ')
  const lines = [
    doc.contact.name,
    doc.contact.title,
    [doc.contact.email, doc.contact.phone, doc.contact.location].filter(Boolean).join(' · '),
    '',
    'SUMMARY',
    doc.summary,
    '',
    'SKILLS',
    skills,
    '',
    'PROJECTS',
    ...doc.projects.filter(p => p.included).flatMap(p => [`${p.title} (${p.skills.join(', ')})`, ...p.bullets.map(b => `- ${b}`), '']),
    'EXPERIENCE',
    ...doc.experience.flatMap(e => [`${e.title} — ${e.company}`, ...e.bullets.filter(Boolean).map(b => `- ${b}`), '']),
    'EDUCATION',
    ...doc.education.map(e => `${e.degree}, ${e.institution}`),
    '',
    'CERTIFICATIONS',
    ...doc.certifications.filter(c => c.included).map(c => `${c.title} — ${c.issuer} (${c.completed}${c.official ? '' : ', course record'})`),
  ]
  return lines.join('\n')
}
