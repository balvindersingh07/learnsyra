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

export function validateNormalizedJob(job: NormalizedJob): string | null {
  if (!job.title.trim()) return 'missing title'
  if (!job.company.trim()) return 'missing company'
  if (!job.posted_at || !isFreshPostedAt(job.posted_at)) return 'stale or invalid posted_at'
  if (!isValidHttpUrl(job.apply_url) && !isValidHttpUrl(job.source_url)) return 'invalid urls'
  if (!job.description.trim()) return 'missing description'
  return null
}
