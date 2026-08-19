export type JobRole =
  | 'Frontend Developer'
  | 'React Developer'
  | 'Full Stack Developer'
  | 'Software Engineer'
  | 'Data Analyst'
  | 'Business Analyst'

export type ExperienceBand = 'Entry Level' | 'Junior' | 'Mid Level' | 'Senior'
export type WorkMode = 'Remote' | 'Hybrid' | 'On-site'
export type JobType = 'Full Time' | 'Part Time' | 'Internship' | 'Contract'
export type CareerFit = 'High Match' | 'Skill Gap' | 'Stretch Role'
export type AppStatus = 'Saved' | 'Applied' | 'Interview' | 'Offer' | 'Rejected'

export interface CatalogJob {
  id: string
  title: string
  company: string
  companyLogo: string
  industry: string
  companySize: string
  location: string
  workMode: WorkMode
  salaryMin: number
  salaryMax: number
  salaryCurrency: 'INR'
  experience: ExperienceBand
  yearsLabel: string
  jobType: JobType
  postedAt: string
  source: 'mock'
  externalUrl: string | null
  description: string
  responsibilities: string[]
  requirements: string[]
  niceToHave: string[]
  benefits: string[]
  skills: string[]
  role: JobRole
  relatedCourses: { title: string; query: string; hours: number; lift: number }[]
  relatedProjects: { title: string; href: string; skills: string[]; hours: number }[]
}

export interface StudentJobProfile {
  targetRole: string
  skills: string[]
  gapSkills: string[]
  projects: { id: string; title: string; skills: string[] }[]
  interviewScore: number
  resumeScore: number
}

export interface RankedJob extends CatalogJob {
  matchScore: number
  matchReasons: string[]
  skillGaps: string[]
  careerFit: CareerFit
}

export interface JobApplication {
  jobId: string
  status: AppStatus
  saved: boolean
  appliedAt: string | null
  notes: string
  updatedAt: string
}

export interface JobFilters {
  search: string
  roles: JobRole[]
  experience: ExperienceBand[]
  workMode: WorkMode[]
  location: string
  salary: string
  matchFloor: number
  jobType: JobType[]
  careerFit: CareerFit[]
}

const APPS_KEY = 'learnsyra_job_apps'
const FILTER_KEY = 'learnsyra_job_filters'
const ROLE_KEY = 'learnsyra_job_target_role'

export const JOB_ROLES: JobRole[] = [
  'Frontend Developer',
  'React Developer',
  'Full Stack Developer',
  'Software Engineer',
  'Data Analyst',
  'Business Analyst',
]

export const EXPERIENCE: ExperienceBand[] = ['Entry Level', 'Junior', 'Mid Level', 'Senior']
export const WORK_MODES: WorkMode[] = ['Remote', 'Hybrid', 'On-site']
export const JOB_TYPES: JobType[] = ['Full Time', 'Part Time', 'Internship', 'Contract']
export const CAREER_FITS: CareerFit[] = ['High Match', 'Skill Gap', 'Stretch Role']
export const STATUSES: AppStatus[] = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected']
export const SALARY_BANDS = ['Any Salary', '₹3–5 LPA', '₹5–8 LPA', '₹8–12 LPA', '₹12 LPA+'] as const
export const MATCH_BANDS = [
  { label: '90%+', floor: 90 },
  { label: '80%+', floor: 80 },
  { label: '70%+', floor: 70 },
  { label: 'All Matches', floor: 0 },
]
export const LOCATIONS = ['Any location', 'India', 'Remote', 'Bengaluru', 'Hyderabad', 'Pune', 'Mumbai']
export const SORTS = ['Recommended', 'Highest Match', 'Newest', 'Salary', 'Experience'] as const
export type JobSort = (typeof SORTS)[number]

export const EMPTY_FILTERS: JobFilters = {
  search: '',
  roles: [],
  experience: [],
  workMode: [],
  location: 'Any location',
  salary: 'Any Salary',
  matchFloor: 0,
  jobType: [],
  careerFit: [],
}

const TS_COURSE = { title: 'TypeScript for React Developers', query: 'TypeScript', hours: 4, lift: 8 }
const TEST_COURSE = { title: 'Frontend Testing with Jest', query: 'Testing', hours: 3, lift: 6 }
const ACC_COURSE = { title: 'Frontend Testing with Jest', query: 'Accessibility', hours: 3, lift: 5 }

const COMPANIES = [
  { name: 'TechNova Solutions', industry: 'Technology', size: '500–1,000 employees', loc: 'India / Remote' },
  { name: 'PixelForge Labs', industry: 'Product Software', size: '200–500 employees', loc: 'Bengaluru / Hybrid' },
  { name: 'CloudMint India', industry: 'Cloud Services', size: '1,000–5,000 employees', loc: 'Hyderabad / Remote' },
  { name: 'Nimbus Retail Tech', industry: 'E-commerce', size: '500–1,000 employees', loc: 'Pune / On-site' },
  { name: 'Saffron Analytics', industry: 'Data & Analytics', size: '80–200 employees', loc: 'Mumbai / Hybrid' },
  { name: 'Harbor Fintech', industry: 'Fintech', size: '200–500 employees', loc: 'India / Remote' },
  { name: 'Lotus Health Apps', industry: 'Health Tech', size: '100–300 employees', loc: 'Remote' },
  { name: 'Cedar Learning Co', industry: 'EdTech', size: '50–150 employees', loc: 'Bengaluru / Remote' },
]

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function job(partial: Omit<CatalogJob, 'source' | 'salaryCurrency' | 'companyLogo' | 'relatedCourses' | 'relatedProjects'> & {
  relatedCourses?: CatalogJob['relatedCourses']
  relatedProjects?: CatalogJob['relatedProjects']
}): CatalogJob {
  const gaps = partial.skills.filter(s => /TypeScript|Testing|Accessibility|Node|SQL|Python/i.test(s))
  const courses = partial.relatedCourses ?? [
    ...(gaps.some(s => /TypeScript/i.test(s)) ? [TS_COURSE] : []),
    ...(gaps.some(s => /Testing/i.test(s)) ? [TEST_COURSE] : []),
    ...(gaps.some(s => /Access/i.test(s)) ? [ACC_COURSE] : []),
  ]
  return {
    source: 'mock',
    salaryCurrency: 'INR',
    companyLogo: partial.company.slice(0, 2).toUpperCase(),
    relatedCourses: courses,
    relatedProjects: partial.relatedProjects ?? [
      {
        title: 'React Expense Tracker',
        href: '/projects/catalog-react-expense',
        skills: ['React', 'JavaScript', 'REST API'],
        hours: 3,
      },
    ],
    ...partial,
  }
}

const SEEDS: Array<Parameters<typeof job>[0]> = [
  { id: 'frontend-001', title: 'Frontend Developer', company: 'TechNova Solutions', industry: 'Technology', companySize: '500–1,000 employees', location: 'Remote · India', workMode: 'Remote', salaryMin: 6, salaryMax: 9, experience: 'Junior', yearsLabel: '1–3 years', jobType: 'Full Time', postedAt: daysAgo(2), externalUrl: 'https://example.com/jobs/technova-frontend', description: 'Build customer-facing React interfaces for a mock India-based product team. This listing is sample data for LearnSyra career practice.', responsibilities: ['Build reusable React components', 'Integrate REST APIs', 'Collaborate with design on accessible UI'], requirements: ['React', 'JavaScript', 'REST APIs', 'Git'], niceToHave: ['TypeScript', 'Testing'], benefits: ['Remote-first', 'Learning stipend'], skills: ['React', 'JavaScript', 'REST APIs', 'Git', 'TypeScript', 'Testing'], role: 'Frontend Developer' },
  { id: 'react-001', title: 'React Developer', company: 'PixelForge Labs', industry: 'Product Software', companySize: '200–500 employees', location: 'Bengaluru · Hybrid', workMode: 'Hybrid', salaryMin: 8, salaryMax: 12, experience: 'Junior', yearsLabel: '1–3 years', jobType: 'Full Time', postedAt: daysAgo(1), externalUrl: 'https://example.com/jobs/pixelforge-react', description: 'Own React feature work on an internal dashboard. Sample listing for practice only.', responsibilities: ['Ship React features weekly', 'Review pull requests', 'Improve UI performance'], requirements: ['React', 'JavaScript', 'Git'], niceToHave: ['TypeScript', 'Testing'], benefits: ['Hybrid office', 'Health cover'], skills: ['React', 'JavaScript', 'Git', 'TypeScript'], role: 'React Developer' },
  { id: 'frontend-002', title: 'Junior Frontend Developer', company: 'Cedar Learning Co', industry: 'EdTech', companySize: '50–150 employees', location: 'Bengaluru · Remote', workMode: 'Remote', salaryMin: 4, salaryMax: 7, experience: 'Entry Level', yearsLabel: '0–1 years', jobType: 'Full Time', postedAt: daysAgo(3), externalUrl: null, description: 'Entry frontend role supporting a learning product. Demo listing — no real hiring pipeline.', responsibilities: ['Implement UI from Figma', 'Fix bugs in React pages', 'Write basic tests over time'], requirements: ['JavaScript', 'React', 'HTML', 'CSS'], niceToHave: ['Accessibility'], benefits: ['Mentorship'], skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Accessibility'], role: 'Frontend Developer' },
  { id: 'fe-eng-001', title: 'Frontend Engineer', company: 'CloudMint India', industry: 'Cloud Services', companySize: '1,000–5,000 employees', location: 'Hyderabad · Remote', workMode: 'Remote', salaryMin: 10, salaryMax: 16, experience: 'Mid Level', yearsLabel: '3–5 years', jobType: 'Full Time', postedAt: daysAgo(4), externalUrl: 'https://example.com/jobs/cloudmint-fe', description: 'Mid-level frontend engineering on cloud consoles. Mock data.', responsibilities: ['Lead UI modules', 'Partner with backend APIs', 'Raise frontend quality bar'], requirements: ['React', 'TypeScript', 'REST APIs', 'Testing'], niceToHave: ['Accessibility'], benefits: ['ESOPs (illustrative)'], skills: ['React', 'TypeScript', 'REST APIs', 'Testing', 'Git'], role: 'Frontend Developer' },
  { id: 'fs-001', title: 'Full Stack Developer', company: 'Harbor Fintech', industry: 'Fintech', companySize: '200–500 employees', location: 'India · Remote', workMode: 'Remote', salaryMin: 8, salaryMax: 14, experience: 'Junior', yearsLabel: '1–3 years', jobType: 'Full Time', postedAt: daysAgo(5), externalUrl: null, description: 'React plus Node APIs for a payments dashboard. Sample role.', responsibilities: ['Build React screens', 'Extend REST endpoints', 'Handle auth flows'], requirements: ['React', 'JavaScript', 'REST APIs', 'Node.js'], niceToHave: ['MongoDB'], benefits: ['Remote'], skills: ['React', 'JavaScript', 'REST APIs', 'Node.js'], role: 'Full Stack Developer' },
  { id: 'se-001', title: 'Software Engineer', company: 'Nimbus Retail Tech', industry: 'E-commerce', companySize: '500–1,000 employees', location: 'Pune · On-site', workMode: 'On-site', salaryMin: 7, salaryMax: 11, experience: 'Junior', yearsLabel: '1–3 years', jobType: 'Full Time', postedAt: daysAgo(2), externalUrl: 'https://example.com/jobs/nimbus-se', description: 'Generalist engineering supporting storefront tools. Mock listing.', responsibilities: ['Ship features across the stack', 'Debug production issues', 'Write documentation'], requirements: ['JavaScript', 'Git', 'REST APIs'], niceToHave: ['React', 'SQL'], benefits: ['Office meals'], skills: ['JavaScript', 'Git', 'REST APIs', 'React'], role: 'Software Engineer' },
  { id: 'da-001', title: 'Data Analyst', company: 'Saffron Analytics', industry: 'Data & Analytics', companySize: '80–200 employees', location: 'Mumbai · Hybrid', workMode: 'Hybrid', salaryMin: 5, salaryMax: 9, experience: 'Junior', yearsLabel: '1–3 years', jobType: 'Full Time', postedAt: daysAgo(6), externalUrl: null, description: 'SQL and dashboard analysis for retail clients. Sample data.', responsibilities: ['Write SQL', 'Build dashboards', 'Present insights'], requirements: ['SQL', 'Python'], niceToHave: ['Excel'], benefits: ['Hybrid'], skills: ['SQL', 'Python', 'Excel'], role: 'Data Analyst' },
  { id: 'ba-001', title: 'Business Analyst', company: 'Lotus Health Apps', industry: 'Health Tech', companySize: '100–300 employees', location: 'Remote', workMode: 'Remote', salaryMin: 6, salaryMax: 10, experience: 'Junior', yearsLabel: '1–3 years', jobType: 'Full Time', postedAt: daysAgo(8), externalUrl: null, description: 'Translate product needs into tickets. Mock role.', responsibilities: ['Gather requirements', 'Map user journeys', 'Support UAT'], requirements: ['Communication', 'SQL'], niceToHave: ['Excel'], benefits: ['Remote'], skills: ['Communication', 'SQL', 'Excel'], role: 'Business Analyst' },
]

function moreJobs(): CatalogJob[] {
  const titles: Array<{ title: string; role: JobRole; skills: string[]; exp: ExperienceBand; years: string; type: JobType }> = [
    { title: 'React Developer', role: 'React Developer', skills: ['React', 'JavaScript', 'REST APIs', 'Testing'], exp: 'Junior', years: '1–3 years', type: 'Full Time' },
    { title: 'Frontend Developer Intern', role: 'Frontend Developer', skills: ['React', 'JavaScript', 'HTML', 'CSS'], exp: 'Entry Level', years: '0–1 years', type: 'Internship' },
    { title: 'UI Engineer', role: 'Frontend Developer', skills: ['React', 'JavaScript', 'Accessibility', 'CSS'], exp: 'Mid Level', years: '3–5 years', type: 'Full Time' },
    { title: 'Full Stack Engineer', role: 'Full Stack Developer', skills: ['React', 'Node.js', 'REST APIs', 'MongoDB'], exp: 'Mid Level', years: '3–5 years', type: 'Full Time' },
    { title: 'Software Engineer Intern', role: 'Software Engineer', skills: ['JavaScript', 'Git'], exp: 'Entry Level', years: '0–1 years', type: 'Internship' },
    { title: 'Contract Frontend Developer', role: 'Frontend Developer', skills: ['React', 'TypeScript', 'REST APIs'], exp: 'Mid Level', years: '3–5 years', type: 'Contract' },
    { title: 'Part-Time React Tutor-Engineer', role: 'React Developer', skills: ['React', 'JavaScript'], exp: 'Junior', years: '1–3 years', type: 'Part Time' },
    { title: 'Junior Software Engineer', role: 'Software Engineer', skills: ['JavaScript', 'REST APIs', 'Git', 'SQL'], exp: 'Junior', years: '1–2 years', type: 'Full Time' },
    { title: 'Product Analyst', role: 'Business Analyst', skills: ['SQL', 'Communication'], exp: 'Junior', years: '1–3 years', type: 'Full Time' },
    { title: 'Analytics Engineer', role: 'Data Analyst', skills: ['SQL', 'Python'], exp: 'Mid Level', years: '3–5 years', type: 'Full Time' },
    { title: 'Senior Frontend Developer', role: 'Frontend Developer', skills: ['React', 'TypeScript', 'Testing', 'Accessibility'], exp: 'Senior', years: '5+ years', type: 'Full Time' },
    { title: 'React Native-ready Frontend', role: 'React Developer', skills: ['React', 'JavaScript', 'REST APIs'], exp: 'Junior', years: '1–3 years', type: 'Full Time' },
  ]
  return titles.flatMap((t, i) => {
    const co = COMPANIES[i % COMPANIES.length]
    const modes: WorkMode[] = ['Remote', 'Hybrid', 'On-site']
    const a = job({
      id: `gen-${i}-a`,
      title: t.title,
      company: co.name,
      industry: co.industry,
      companySize: co.size,
      location: co.loc,
      workMode: modes[i % 3],
      salaryMin: t.exp === 'Entry Level' ? 3 : t.exp === 'Junior' ? 5 : t.exp === 'Mid Level' ? 9 : 14,
      salaryMax: t.exp === 'Entry Level' ? 5 : t.exp === 'Junior' ? 8 : t.exp === 'Mid Level' ? 14 : 22,
      experience: t.exp,
      yearsLabel: t.years,
      jobType: t.type,
      postedAt: daysAgo((i % 12) + 1),
      externalUrl: i % 3 === 0 ? `https://example.com/jobs/${co.name.split(' ')[0].toLowerCase()}-${i}` : null,
      description: `Sample ${t.title} opening at ${co.name}. Created for LearnSyra practice — not a live employer listing.`,
      responsibilities: ['Deliver assigned product work', 'Collaborate with a small squad', 'Document what you ship'],
      requirements: t.skills.slice(0, 3),
      niceToHave: t.skills.slice(3),
      benefits: ['Learning budget (illustrative)'],
      skills: t.skills,
      role: t.role,
    })
    const b = job({
      ...a,
      id: `gen-${i}-b`,
      company: COMPANIES[(i + 3) % COMPANIES.length].name,
      industry: COMPANIES[(i + 3) % COMPANIES.length].industry,
      companySize: COMPANIES[(i + 3) % COMPANIES.length].size,
      location: COMPANIES[(i + 3) % COMPANIES.length].loc,
      postedAt: daysAgo((i % 9) + 2),
      salaryMin: a.salaryMin + 1,
      salaryMax: a.salaryMax + 1,
      externalUrl: null,
      title: i % 2 === 0 ? `Associate ${t.title}` : t.title,
    })
    const extra = i < 10
      ? [job({
          ...a,
          id: `gen-${i}-c`,
          company: COMPANIES[(i + 5) % COMPANIES.length].name,
          industry: COMPANIES[(i + 5) % COMPANIES.length].industry,
          companySize: COMPANIES[(i + 5) % COMPANIES.length].size,
          location: 'Remote · India',
          workMode: 'Remote',
          postedAt: daysAgo(i + 1),
          jobType: 'Full Time',
        })]
      : []
    return [a, b, ...extra]
  })
}

let CATALOG: CatalogJob[] | null = null

export function getJobCatalog(): CatalogJob[] {
  if (!CATALOG) {
    CATALOG = [...SEEDS.map(job), ...moreJobs()]
  }
  return CATALOG
}

export function getJobById(id: string) {
  return getJobCatalog().find(j => j.id === id) ?? null
}

export function relativePosted(iso: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export function salaryLabel(job: CatalogJob) {
  return `₹${job.salaryMin}–${job.salaryMax} LPA`
}

function overlap(have: string[], need: string[]) {
  const h = have.map(s => s.toLowerCase())
  return need.filter(n => h.some(x => x.includes(n.toLowerCase()) || n.toLowerCase().includes(x)))
}

export function rankJob(job: CatalogJob, profile: StudentJobProfile): RankedJob {
  const have = overlap(profile.skills, job.skills)
  const gaps = job.skills.filter(s => !have.includes(s))
  const skillPct = job.skills.length ? have.length / job.skills.length : 0
  const projectHit = profile.projects.some(p => p.skills.some(s => job.skills.some(js => js.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(js.toLowerCase()))))
  const roleAlign = job.role === profile.targetRole || job.title.toLowerCase().includes(profile.targetRole.split(' ')[0].toLowerCase()) ? 1 : job.role.includes('Developer') && /developer|engineer/i.test(profile.targetRole) ? 0.6 : 0.25
  const matchScore = Math.round(
    Math.min(
      96,
      Math.max(
        48,
        skillPct * 35 +
          (projectHit ? 20 : 8) +
          (profile.resumeScore / 100) * 15 +
          (profile.interviewScore / 100) * 15 +
          roleAlign * 15,
      ),
    ),
  )
  const careerFit: CareerFit = matchScore >= 85 ? 'High Match' : matchScore >= 70 ? 'Skill Gap' : 'Stretch Role'
  const matchReasons = [
    ...have.slice(0, 4),
    ...(projectHit ? ['Your project experience'] : []),
  ]
  return { ...job, matchScore, matchReasons, skillGaps: gaps.slice(0, 4), careerFit }
}

export function rankCatalog(profile: StudentJobProfile): RankedJob[] {
  return getJobCatalog().map(j => rankJob(j, profile))
}

export function defaultExperience(readiness: number): ExperienceBand {
  if (readiness < 55) return 'Entry Level'
  if (readiness < 80) return 'Junior'
  if (readiness < 92) return 'Mid Level'
  return 'Senior'
}

export function emptyFilters(experience?: ExperienceBand): JobFilters {
  return { ...EMPTY_FILTERS, experience: experience ? [experience] : [] }
}

export function salaryInBand(job: CatalogJob, band: string) {
  if (band === 'Any Salary') return true
  const mid = (job.salaryMin + job.salaryMax) / 2
  if (band === '₹3–5 LPA') return mid >= 3 && mid <= 5.5
  if (band === '₹5–8 LPA') return mid >= 5 && mid <= 8.5
  if (band === '₹8–12 LPA') return mid >= 8 && mid <= 12.5
  if (band === '₹12 LPA+') return job.salaryMax >= 12
  return true
}

export function locationOk(job: CatalogJob, loc: string) {
  if (loc === 'Any location') return true
  const blob = `${job.location} ${job.workMode}`.toLowerCase()
  return blob.includes(loc.toLowerCase())
}

export function filterJobs(jobs: RankedJob[], f: JobFilters) {
  const q = f.search.trim().toLowerCase()
  return jobs.filter(j => {
    if (q) {
      const blob = `${j.title} ${j.company} ${j.skills.join(' ')} ${j.location} ${j.workMode}`.toLowerCase()
      if (!blob.includes(q)) return false
    }
    if (f.roles.length && !f.roles.includes(j.role)) return false
    if (f.experience.length && !f.experience.includes(j.experience)) return false
    if (f.workMode.length && !f.workMode.includes(j.workMode)) return false
    if (!locationOk(j, f.location)) return false
    if (!salaryInBand(j, f.salary)) return false
    if (j.matchScore < f.matchFloor) return false
    if (f.jobType.length && !f.jobType.includes(j.jobType)) return false
    if (f.careerFit.length && !f.careerFit.includes(j.careerFit)) return false
    return true
  })
}

export function sortJobs(jobs: RankedJob[], sort: JobSort) {
  const rows = jobs.slice()
  const expRank = (e: ExperienceBand) => EXPERIENCE.indexOf(e)
  if (sort === 'Highest Match') rows.sort((a, b) => b.matchScore - a.matchScore)
  else if (sort === 'Newest') rows.sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt))
  else if (sort === 'Salary') rows.sort((a, b) => b.salaryMax - a.salaryMax)
  else if (sort === 'Experience') rows.sort((a, b) => expRank(a.experience) - expRank(b.experience))
  else rows.sort((a, b) => b.matchScore * 2 + +new Date(b.postedAt) / 1e12 - (a.matchScore * 2 + +new Date(a.postedAt) / 1e12))
  return rows
}

export function loadApps(): Record<string, JobApplication> {
  try {
    const raw = localStorage.getItem(APPS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, JobApplication>) : {}
  } catch {
    return {}
  }
}

export function saveApps(map: Record<string, JobApplication>) {
  localStorage.setItem(APPS_KEY, JSON.stringify(map))
}

export function upsertApp(jobId: string, patch: Partial<JobApplication>) {
  const map = loadApps()
  const prev = map[jobId] ?? { jobId, status: 'Saved' as const, saved: false, appliedAt: null, notes: '', updatedAt: new Date().toISOString() }
  map[jobId] = { ...prev, ...patch, jobId, updatedAt: new Date().toISOString() }
  saveApps(map)
  return map[jobId]
}

export function appStats(map: Record<string, JobApplication>) {
  const rows = Object.values(map)
  return {
    saved: rows.filter(r => r.saved).length,
    applied: rows.filter(r => r.status === 'Applied' || r.appliedAt).length,
    interviews: rows.filter(r => r.status === 'Interview').length,
    offers: rows.filter(r => r.status === 'Offer').length,
  }
}

export function loadFilters(): JobFilters | null {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    return raw ? (JSON.parse(raw) as JobFilters) : null
  } catch {
    return null
  }
}

export function saveFilters(f: JobFilters) {
  localStorage.setItem(FILTER_KEY, JSON.stringify(f))
}

export function loadTargetRole(fallback: string) {
  return localStorage.getItem(ROLE_KEY) || fallback
}

export function saveTargetRole(role: string) {
  localStorage.setItem(ROLE_KEY, role)
}

export function buildJobProfile(input: {
  targetRole: string
  haveSkills: string[]
  gapSkills: string[]
  projects: StudentJobProfile['projects']
  interviewScore: number
  resumeScore: number
  resumeSkills?: string[]
}): StudentJobProfile {
  const skills = input.resumeSkills?.length ? input.resumeSkills : input.haveSkills
  return {
    targetRole: input.targetRole,
    skills,
    gapSkills: input.gapSkills,
    projects: input.projects,
    interviewScore: input.interviewScore,
    resumeScore: input.resumeScore,
  }
}

export function fitCopy(fit: CareerFit) {
  if (fit === 'High Match') return 'You have the skills needed to apply now.'
  if (fit === 'Skill Gap') return 'You are close. One or two skill gaps remain.'
  return 'These roles can become realistic targets after targeted learning.'
}

export function applicationReadiness(job: RankedJob, profile: StudentJobProfile) {
  const skills = Math.round((job.matchReasons.filter(r => r !== 'Your project experience').length / Math.max(1, job.skills.length)) * 100)
  const projects = job.matchReasons.includes('Your project experience') ? 90 : 55
  const resume = profile.resumeScore
  const interview = profile.interviewScore
  const overall = Math.round(resume * 0.25 + skills * 0.3 + projects * 0.25 + interview * 0.2)
  return { overall, resume, skills: Math.min(96, skills + 40), projects, interview }
}
