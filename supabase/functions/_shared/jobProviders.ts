import {
  assessJobRelevance,
  buildContentHash,
  formatSalaryLabel,
  isFreshPostedAt,
  isValidHttpUrl,
  IT_ROLE_QUERIES,
  normalizeEmploymentType,
  normalizeWorkMode,
  parseIsoDate,
  type JobRelevanceRejectReason,
  type NormalizedJob,
} from './jobIngest.ts'

const INDIANAPI_JOBS_URL = 'https://jobs.indianapi.in/jobs'
const PROVIDER_SOURCE = 'indianapi'

/** Max provider HTTP calls per sync run (4-hour cron × 6 ≈ 36/day). */
export const MAX_REQUESTS_PER_SYNC = 6
const QUERIES_PER_SYNC = 4
const JOBS_LIMIT = '10'

export type ProviderFetchResult = {
  jobs: NormalizedJob[]
  errors: string[]
  providerRequests: number
  rateLimitRemaining: number | null
  relevanceRejected: number
  relevanceRejectReasons: Record<JobRelevanceRejectReason, number>
}

type IndianApiJob = {
  id?: number | string
  title?: string | null
  company?: string | null
  about_company?: string | null
  job_description?: string | null
  job_title?: string | null
  job_type?: string | null
  location?: string | null
  experience?: string | null
  role_and_responsibility?: string | null
  education_and_skills?: string | null
  apply_link?: string | null
  posted_date?: string | null
  salary?: string | number | null
  salary_min?: number | null
  salary_max?: number | null
}

class RequestBudget {
  used = 0
  constructor(public readonly limit: number) {}
  spend() {
    if (this.used >= this.limit) return false
    this.used++
    return true
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function queriesForSyncSlot(): string[] {
  const slots = Math.ceil(IT_ROLE_QUERIES.length / QUERIES_PER_SYNC)
  const slot = Math.floor(Date.now() / (4 * 60 * 60 * 1000)) % slots
  const start = slot * QUERIES_PER_SYNC
  return [...IT_ROLE_QUERIES].slice(start, start + QUERIES_PER_SYNC)
}

function stringList(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return [...new Set(
    value
      .split(/[,;•\n|]/)
      .map(s => s.trim())
      .filter(s => s.length > 1 && s.length < 80),
  )].slice(0, 16)
}

function pickUrls(row: IndianApiJob): { applyUrl: string; sourceUrl: string } | null {
  const apply = row.apply_link?.trim() ?? ''
  if (isValidHttpUrl(apply)) {
    return { applyUrl: apply, sourceUrl: apply }
  }
  return null
}

function buildDescription(row: IndianApiJob): string {
  const parts = [
    row.job_description,
    row.role_and_responsibility,
    row.about_company,
    row.experience ? `Experience: ${row.experience}` : null,
  ]
    .map(p => p?.trim())
    .filter(Boolean)
  return parts.join('\n\n')
}

function parseSalary(row: IndianApiJob): { min: number | null; max: number | null; label: string | null } {
  if (typeof row.salary_min === 'number' || typeof row.salary_max === 'number') {
    const min = typeof row.salary_min === 'number' ? row.salary_min : null
    const max = typeof row.salary_max === 'number' ? row.salary_max : null
    return { min, max, label: formatSalaryLabel(min, max, 'INR') }
  }
  if (row.salary == null || row.salary === '') return { min: null, max: null, label: null }
  if (typeof row.salary === 'number') {
    return { min: row.salary, max: row.salary, label: formatSalaryLabel(row.salary, row.salary, 'INR') }
  }
  const text = String(row.salary).trim()
  return { min: null, max: null, label: text || null }
}

type NormalizeIndianApiResult = {
  job: NormalizedJob | null
  relevanceReject?: JobRelevanceRejectReason
}

async function normalizeIndianApiJob(row: IndianApiJob): Promise<NormalizeIndianApiResult> {
  const jobId = String(row.id ?? '').trim()
  const title = String(row.title ?? row.job_title ?? '').trim()
  const company = String(row.company ?? '').trim()
  const location = String(row.location ?? 'India').trim()
  const description = buildDescription(row)
  const postedAt = parseIsoDate(row.posted_date)
  const urls = pickUrls(row)

  if (!jobId || !title || !company || !postedAt || !description || !urls) return { job: null }
  if (!isFreshPostedAt(postedAt)) return { job: null }

  const relevance = assessJobRelevance({
    title: String(row.title ?? '').trim(),
    job_title: row.job_title,
    job_description: row.job_description,
    role_and_responsibility: row.role_and_responsibility,
    education_and_skills: row.education_and_skills,
    experience: row.experience,
    job_type: row.job_type,
    company: row.company,
  })
  if (!relevance.accept) {
    return { job: null, relevanceReject: relevance.reason ?? 'reject:no_it_signal' }
  }

  const skills = stringList(row.education_and_skills)
  const requirements = skills.length ? skills : stringList(row.experience)
  const salary = parseSalary(row)

  const normalized: NormalizedJob = {
    source: PROVIDER_SOURCE,
    source_job_id: jobId,
    source_url: urls.sourceUrl,
    apply_url: urls.applyUrl,
    company,
    title,
    location,
    work_mode: normalizeWorkMode(null, location, description),
    job_type: normalizeEmploymentType(row.job_type),
    description,
    requirements,
    skills: skills.length ? skills : requirements.slice(0, 8),
    salary_min: salary.min,
    salary_max: salary.max,
    currency: 'INR',
    posted_at: postedAt,
    updated_at: postedAt,
    salary: salary.label,
    tags: skills.length ? skills : requirements.slice(0, 8),
    content_hash: '',
  }
  normalized.content_hash = await buildContentHash(normalized)
  return { job: normalized }
}

async function indianApiSearch(
  apiKey: string,
  title: string,
  budget: RequestBudget,
): Promise<{ rows: IndianApiJob[]; error?: string }> {
  if (!budget.spend()) {
    return { rows: [], error: 'quota:budget exhausted' }
  }

  const params = new URLSearchParams({
    title,
    location: 'India',
    limit: JOBS_LIMIT,
  })

  const res = await fetch(`${INDIANAPI_JOBS_URL}?${params}`, {
    headers: {
      'x-api-key': apiKey,
      Accept: 'application/json',
    },
  })

  if (res.status === 401 || res.status === 403) {
    return { rows: [], error: 'indianapi:unauthorized' }
  }
  if (res.status === 429) {
    return { rows: [], error: 'indianapi:rate limited' }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return {
      rows: [],
      error: `indianapi:search ${res.status} for "${title}": ${body.slice(0, 160)}`,
    }
  }

  const json = await res.json()
  const rows = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
  return { rows: rows as IndianApiJob[] }
}

function emptyRejectReasons(): Record<JobRelevanceRejectReason, number> {
  return {
    'reject:title': 0,
    'reject:domain': 0,
    'reject:no_it_signal': 0,
  }
}

export async function fetchProviderJobs(): Promise<ProviderFetchResult> {
  const apiKey = Deno.env.get('INDIANAPI_API_KEY')?.trim()
  const jobs: NormalizedJob[] = []
  const errors: string[] = []
  const budget = new RequestBudget(MAX_REQUESTS_PER_SYNC)
  const seenIds = new Set<string>()
  let relevanceRejected = 0
  const relevanceRejectReasons = emptyRejectReasons()

  if (!apiKey) {
    return {
      jobs: [],
      errors: ['indianapi:missing INDIANAPI_API_KEY'],
      providerRequests: 0,
      rateLimitRemaining: null,
      relevanceRejected: 0,
      relevanceRejectReasons: emptyRejectReasons(),
    }
  }

  for (const title of queriesForSyncSlot()) {
    const { rows, error } = await indianApiSearch(apiKey, title, budget)
    if (error) {
      errors.push(error)
      if (error.includes('unauthorized') || error.includes('rate limited')) break
      continue
    }

    for (const row of rows) {
      const id = String(row.id ?? '').trim()
      if (!id || seenIds.has(id)) continue
      seenIds.add(id)

      const { job, relevanceReject } = await normalizeIndianApiJob(row)
      if (relevanceReject) {
        relevanceRejected++
        relevanceRejectReasons[relevanceReject]++
        continue
      }
      if (job) jobs.push(job)
    }

    await sleep(200)
  }

  return {
    jobs,
    errors,
    providerRequests: budget.used,
    rateLimitRemaining: null,
    relevanceRejected,
    relevanceRejectReasons,
  }
}
