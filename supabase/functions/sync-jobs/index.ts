import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { fetchProviderJobs } from '../_shared/jobProviders.ts'
import { isFreshPostedAt, JOB_FRESHNESS_DAYS, validateNormalizedJob, type NormalizedJob } from '../_shared/jobIngest.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-jobs-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: cors })
}

function authorize(req: Request): boolean {
  const cronSecret = Deno.env.get('SYNC_JOBS_CRON_SECRET')
  const headerSecret = req.headers.get('x-sync-jobs-secret')
  if (cronSecret && headerSecret && cronSecret === headerSecret) return true

  const auth = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (serviceKey && auth === `Bearer ${serviceKey}`) return true
  return false
}

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) throw new Error('Missing Supabase service configuration')
  return createClient(url, key)
}

async function upsertJob(admin: ReturnType<typeof createClient>, job: NormalizedJob) {
  const reason = validateNormalizedJob(job)
  if (reason) return { action: 'skipped' as const, reason }

  const { data: bySource } = await admin
    .from('jobs')
    .select('id, updated_at')
    .eq('source', job.source)
    .eq('source_job_id', job.source_job_id)
    .maybeSingle()

  const nowIso = new Date().toISOString()
  const payload = {
    source: job.source,
    source_job_id: job.source_job_id,
    source_url: job.source_url,
    apply_url: job.apply_url,
    company: job.company,
    title: job.title,
    location: job.location,
    work_mode: job.work_mode,
    job_type: job.job_type,
    description: job.description,
    requirements: job.requirements,
    skills: job.skills,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    currency: job.currency,
    posted_at: job.posted_at,
    updated_at: job.updated_at ?? nowIso,
    is_active: true,
    ingested_at: nowIso,
    content_hash: job.content_hash,
    salary: job.salary,
    tags: job.tags,
    logo: job.company.slice(0, 2).toUpperCase(),
  }

  if (bySource?.id) {
    const providerUpdated = job.updated_at ? Date.parse(job.updated_at) : 0
    const existingUpdated = bySource.updated_at ? Date.parse(String(bySource.updated_at)) : 0
    if (providerUpdated && existingUpdated && providerUpdated <= existingUpdated) {
      await admin.from('jobs').update({ is_active: true, ingested_at: nowIso }).eq('id', bySource.id)
      return { action: 'refreshed' as const }
    }
    await admin.from('jobs').update(payload).eq('id', bySource.id)
    return { action: 'updated' as const }
  }

  const { data: byHash } = await admin.from('jobs').select('id').eq('content_hash', job.content_hash).maybeSingle()
  if (byHash?.id) {
    return { action: 'duplicate' as const }
  }

  const { error } = await admin.from('jobs').insert(payload)
  if (error) {
    if (error.code === '23505') return { action: 'duplicate' as const }
    throw error
  }
  return { action: 'inserted' as const }
}

async function deactivateStaleJobs(admin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - JOB_FRESHNESS_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('jobs')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('is_active', true)
    .lt('posted_at', cutoff)
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!authorize(req)) return json({ error: 'Unauthorized' }, 401)

  const started = Date.now()
  const stats = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    refreshed: 0,
    skipped: 0,
    duplicates: 0,
    deactivated: 0,
    providerRequests: 0,
    providerErrors: [] as string[],
  }

  try {
    const admin = serviceClient()
    const { jobs, errors, providerRequests } = await fetchProviderJobs()
    stats.providerErrors = errors
    stats.fetched = jobs.length
    stats.providerRequests = providerRequests

    const seenHash = new Set<string>()
    for (const job of jobs) {
      if (seenHash.has(job.content_hash)) {
        stats.duplicates++
        continue
      }
      seenHash.add(job.content_hash)
      if (!isFreshPostedAt(job.posted_at)) {
        stats.skipped++
        continue
      }
      const result = await upsertJob(admin, job)
      if (result.action === 'inserted') stats.inserted++
      else if (result.action === 'updated') stats.updated++
      else if (result.action === 'refreshed') stats.refreshed++
      else if (result.action === 'duplicate') stats.duplicates++
      else stats.skipped++
    }

    stats.deactivated = await deactivateStaleJobs(admin)

    console.log(
      JSON.stringify({
        event: 'sync-jobs',
        provider: 'indianapi',
        durationMs: Date.now() - started,
        ...stats,
      }),
    )

    return json({ ok: true, durationMs: Date.now() - started, stats })
  } catch (err) {
    console.error('sync-jobs failed', err instanceof Error ? err.message : err)
    return json({ error: err instanceof Error ? err.message : 'Sync failed' }, 500)
  }
})
