/** Shared normalization, validation, and hashing for job ingestion (Edge Functions). */

export const JOB_FRESHNESS_DAYS = 7

/** IT role keywords for provider search rotation when a job source is configured. */
export const IT_ROLE_QUERIES = [
  'Frontend Developer',
  'React Developer',
  'React Native Developer',
  'Full Stack Developer',
  'Backend Developer',
  'Node.js Developer',
  'JavaScript Developer',
  'TypeScript Developer',
  'Software Engineer',
  'Mobile App Developer',
  'DevOps Engineer',
  'Cloud Engineer',
  'AI Engineer',
  'Data Engineer',
] as const

export type JobSource = string

export interface NormalizedJob {
  source: JobSource
  source_job_id: string
  source_url: string
  apply_url: string
  company: string
  title: string
  location: string
  work_mode: string | null
  job_type: string | null
  description: string
  requirements: string[]
  skills: string[]
  salary_min: number | null
  salary_max: number | null
  currency: string
  posted_at: string
  updated_at: string | null
  salary: string | null
  tags: string[]
  content_hash: string
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim())
    u.hash = ''
    const host = u.hostname.replace(/^www\./, '')
    const path = u.pathname.replace(/\/+$/, '')
    return `${host}${path}${u.search}`
  } catch {
    return normalizeText(url)
  }
}

export function dedupeFingerprint(title: string, company: string, location: string, url: string): string {
  return [normalizeText(title), normalizeText(company), normalizeText(location), normalizeUrl(url)].join('|')
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (/example\.com$/i.test(u.hostname) || u.hostname === 'example.com') return false
    return true
  } catch {
    return false
  }
}

export function parseIsoDate(value: unknown): string | null {
  if (!value) return null
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function parseUnixDate(value: unknown): string | null {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return parseIsoDate(value)
  const ms = n > 1e12 ? n : n * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export function normalizeEmploymentType(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const t = value.trim().toLowerCase()
  if (t.includes('intern')) return 'Internship'
  if (t.includes('part')) return 'Part Time'
  if (t.includes('contract')) return 'Contract'
  if (t.includes('full')) return 'Full Time'
  return value.trim()
}

export function normalizeWorkMode(value: string | null | undefined, location = '', description = ''): string | null {
  if (value?.trim()) {
    const v = value.trim().toLowerCase()
    if (v.includes('hybrid')) return 'Hybrid'
    if (v.includes('remote')) return 'Remote'
    if (v.includes('on-site') || v.includes('onsite') || v.includes('on site')) return 'On-site'
    return value.trim()
  }
  const blob = `${location} ${description}`.toLowerCase()
  if (/\bhybrid\b/.test(blob)) return 'Hybrid'
  if (/\b(on[- ]?site|onsite|in[- ]office)\b/.test(blob)) return 'On-site'
  if (/\bremote\b/.test(blob)) return 'Remote'
  return null
}

export function formatSalaryLabel(min: number | null, max: number | null, currency = 'INR'): string | null {
  if (min == null && max == null) return null
  const cur = currency || 'INR'
  if (min != null && max != null) return `${cur} ${min}–${max}`
  if (min != null) return `${cur} ${min}+`
  return `${cur} up to ${max}`
}

export function isFreshPostedAt(postedAt: string, now = Date.now()): boolean {
  const ms = Date.parse(postedAt)
  if (Number.isNaN(ms)) return false
  return now - ms <= JOB_FRESHNESS_DAYS * 24 * 60 * 60 * 1000
}

export async function buildContentHash(job: Pick<NormalizedJob, 'title' | 'company' | 'location' | 'apply_url' | 'source_url'>): Promise<string> {
  const url = job.apply_url || job.source_url
  return sha256Hex(dedupeFingerprint(job.title, job.company, job.location, url))
}

/** Normalized IT role phrases used for title-level relevance matching. */
export const IT_ROLE_PHRASES: readonly string[] = IT_ROLE_QUERIES.map(role => normalizeText(role))

/** Additional title phrases that indicate software/IT roles (beyond the 14 rotation queries). */
export const IT_TITLE_ALLOW_PHRASES: readonly string[] = [
  ...IT_ROLE_PHRASES,
  'software engineer',
  'software developer',
  'web developer',
  'application developer',
  'associate software engineer',
  'associate software developer',
  'software development',
  'software testing',
  'sde',
  'programmer',
  'programming',
  'fullstack',
  'full stack',
]

/** Body/skill tokens — at least two distinct hits required when the title is weak. */
export const IT_SKILL_LEXICON: readonly string[] = [
  'react',
  'react native',
  'javascript',
  'typescript',
  'node',
  'nodejs',
  'node js',
  'java',
  'python',
  'sql',
  'api',
  'html',
  'css',
  'angular',
  'vue',
  'android',
  'ios',
  'kotlin',
  'swift',
  'docker',
  'kubernetes',
  'aws',
  'azure',
  'gcp',
  'devops',
  'machine learning',
  'ml',
  'data engineer',
  'etl',
  'spark',
  'software',
  'developer',
  'frontend',
  'backend',
  'fullstack',
  'full stack',
  'cloud',
  'microservices',
  'git',
  'testing',
  'automation',
]

export type JobRelevanceRejectReason = 'reject:title' | 'reject:domain' | 'reject:no_it_signal'

export type JobRelevanceInput = {
  title: string
  job_title?: string | null
  job_description?: string | null
  role_and_responsibility?: string | null
  education_and_skills?: string | null
  experience?: string | null
  job_type?: string | null
  company?: string | null
}

export type JobRelevanceResult = {
  accept: boolean
  reason: JobRelevanceRejectReason | null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Hard reject when matched in title / job_title (HRIS is not matched by \\bhr\\b). */
export const REJECT_PATTERNS: readonly RegExp[] = [
  /\bhuman resources\b/i,
  /\bhr\b/i,
  /\brecruit(?:ment|er|ing)\b/i,
  /\btalent acquisition\b/i,
  /\bpeople operations\b/i,
  /\bsales\b/i,
  /\bbusiness development\b/i,
  /\binside sales\b/i,
  /\bmarketing\b/i,
  /\bdigital marketing\b/i,
  /\bbrand\b/i,
  /\bseo\b/i,
  /\bcontent writer\b/i,
  /\bfinance\b/i,
  /\baccounting\b/i,
  /\baccountant\b/i,
  /\baudit\b/i,
  /\bpayroll\b/i,
  /\blegal\b/i,
  /\bcompliance officer\b/i,
  /\bparalegal\b/i,
  /\bcustomer support\b/i,
  /\bcustomer service\b/i,
  /\bcall center\b/i,
  /\bbpo\b/i,
  /\btelecaller\b/i,
]

/** Domain reject for weak titles — scanned across the full listing text. */
export const DOMAIN_REJECT_PATTERNS: readonly RegExp[] = REJECT_PATTERNS

function includesPhrase(haystack: string, phrase: string): boolean {
  const h = normalizeText(haystack)
  const p = normalizeText(phrase)
  if (!p) return false
  if (p.includes(' ')) return h.includes(p)
  return new RegExp(`\\b${escapeRegExp(p)}\\b`, 'i').test(h)
}

function matchesAnyPattern(text: string, patterns: readonly RegExp[]): boolean {
  const normalized = normalizeText(text)
  return patterns.some(pattern => pattern.test(normalized))
}

function matchesItTitleAllow(titleBlob: string): boolean {
  for (const phrase of IT_TITLE_ALLOW_PHRASES) {
    if (includesPhrase(titleBlob, phrase)) return true
  }
  return false
}

/** Tier-2 technical support roles (IT helpdesk / IT support). */
function matchesItSupportTitle(titleBlob: string): boolean {
  const t = normalizeText(titleBlob)
  if (/\bit\s+helpdesk\b/.test(t)) return true
  if (/\bit\s+support\b/.test(t)) return true
  if (/\btechnical\s+support\b/.test(t)) return true
  if (/\bhelpdesk\b/.test(t) && /\bit\b/.test(t)) return true
  if (/\bit\b/.test(t) && /\bhelpdesk\b/.test(t) && /\banalyst\b/.test(t)) return true
  return false
}

function countLexiconHits(blob: string): number {
  const h = normalizeText(blob)
  const hits = new Set<string>()
  for (const term of IT_SKILL_LEXICON) {
    const normalizedTerm = normalizeText(term)
    const pattern = normalizedTerm.includes(' ')
      ? new RegExp(escapeRegExp(normalizedTerm), 'i')
      : new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, 'i')
    if (pattern.test(h)) hits.add(normalizedTerm)
  }
  return hits.size
}

/**
 * Deterministic IT relevance gate for IndianAPI rows.
 * Seniority terms (fresher, intern, trainee, etc.) never cause rejection on their own.
 */
export function assessJobRelevance(input: JobRelevanceInput): JobRelevanceResult {
  const titleBlob = [input.title, input.job_title].filter(Boolean).join(' ').trim()
  const bodyBlob = [
    input.job_description,
    input.role_and_responsibility,
    input.education_and_skills,
    input.experience,
    input.job_type,
    input.company,
  ]
    .filter(Boolean)
    .join(' ')
  const fullBlob = `${titleBlob} ${bodyBlob}`.trim()

  if (matchesAnyPattern(titleBlob, REJECT_PATTERNS)) {
    return { accept: false, reason: 'reject:title' }
  }

  if (matchesItTitleAllow(titleBlob) || matchesItSupportTitle(titleBlob)) {
    return { accept: true, reason: null }
  }

  if (matchesAnyPattern(fullBlob, DOMAIN_REJECT_PATTERNS)) {
    return { accept: false, reason: 'reject:domain' }
  }

  if (countLexiconHits(fullBlob) >= 2) {
    return { accept: true, reason: null }
  }

  return { accept: false, reason: 'reject:no_it_signal' }
}

export function validateNormalizedJob(job: NormalizedJob): string | null {
  if (!job.title.trim()) return 'missing title'
  if (!job.company.trim()) return 'missing company'
  if (!job.posted_at || !isFreshPostedAt(job.posted_at)) return 'stale or invalid posted_at'
  if (!isValidHttpUrl(job.apply_url) && !isValidHttpUrl(job.source_url)) return 'invalid urls'
  if (!job.description.trim()) return 'missing description'
  return null
}
