# LearnSyra Jobs Platform

## Overview

LearnSyra Career Jobs reads live listings from the Supabase `public.jobs` table. The student Jobs page (`/career/jobs`) shows only **active** rows posted within the last **7 days** with valid outbound application or source URLs.

**Production has no active external job provider configured today.** The `sync-jobs` Edge Function runs the generic ingest pipeline (validation, deduplication, stale deactivation) but returns an empty provider batch until an authorized source is wired in server-side.

Mock/demo listings are **disabled in production**. For local development only, set `VITE_DEV_MOCK_JOBS=true` in `.env.local` to enable the legacy practice catalog when the database is empty.

## Architecture

```
Authorized job API (future)  →  sync-jobs Edge Function  →  public.jobs  →  Frontend (getJobs)
         ↑                              ↑
   server-side secrets only      SYNC_JOBS_CRON_SECRET
```

### Design principles

| Principle | Detail |
|-----------|--------|
| Central ingestion | Jobs are synced once into Supabase — not fetched per student |
| India focus | Target listings relevant to Indian students (location/filtering at ingest or query time) |
| No fabrication | LearnSyra does not invent jobs, companies, or apply URLs |
| No scraping | **LinkedIn scraping is not used.** Only official, authorized APIs or partner feeds |
| Server-side secrets | Provider credentials live in Supabase Edge Function secrets — never in `VITE_*` frontend vars |
| Production mock-free | Production builds never fall back to the dev mock catalog |

### Future authorized provider integration

When a provider is added:

1. Implement `fetchProviderJobs()` in `supabase/functions/_shared/jobProviders.ts` to call the authorized API and map results to `NormalizedJob`.
2. Set provider credentials as Supabase Edge Function secrets (names depend on the provider).
3. Deploy `sync-jobs` and schedule periodic runs via cron or an external scheduler.
4. Store `source` (e.g. provider identifier string) and `source_job_id` for uniqueness.
5. Preserve employer apply URLs in `apply_url` (preferred) and listing URLs in `source_url`.

The existing schema, RLS, client `getJobs()` / `getJobById()`, matching, and Jobs UI require no structural changes when a provider is connected.

## Environment variables

### Edge Function secrets (Supabase Dashboard → Edge Functions → Secrets)

| Secret | Required | Description |
|--------|----------|-------------|
| `SYNC_JOBS_CRON_SECRET` | **Yes** (for scheduled sync) | Shared secret for `x-sync-jobs-secret` header |
| Provider API key(s) | When a provider is active | Set per provider — never commit or expose to the frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Provided by Supabase runtime |

### Frontend (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_DEV_MOCK_JOBS` | unset | Set to `true` in **development only** for mock catalog fallback |
| `VITE_JOB_MATCH_MIN_SCORE` | `35` | Minimum profile match % when the student has career signals |

## Deployment

```bash
# Apply migrations (if not already applied)
supabase db push

# Set cron secret (replace placeholder — never commit real values)
supabase secrets set SYNC_JOBS_CRON_SECRET=your_random_secret

# Deploy function
supabase functions deploy sync-jobs

# Manual sync (maintenance / ingest when provider is configured)
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/sync-jobs" \
  -H "x-sync-jobs-secret: your_random_secret" \
  -H "Content-Type: application/json"
```

### Scheduled sync (example)

```sql
select cron.schedule(
  'sync-jobs-scheduled',
  '0 */4 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-jobs-secret', 'your_random_secret'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Requires `pg_net` if using SQL cron — otherwise use an external scheduler. Adjust frequency to respect any future provider rate limits.

## Data model

- `source` — provider identifier string (e.g. future authorized feed name)
- Unique per provider: `(source, source_job_id)`
- Cross-source dedup: `content_hash` (SHA-256 of normalized title|company|location|url)
- Students see rows where `is_active = true`, `posted_at >= now() - 7 days`, and a valid `apply_url` or `source_url`
- `example.com` URLs are blocked by RLS and client filters

## Security

- Provider API keys must **never** appear in frontend code or `VITE_*` environment variables.
- `sync-jobs` accepts POST with `x-sync-jobs-secret` or service-role `Authorization` bearer.
- RLS on `public.jobs` enforces freshness, active status, and valid outbound URLs for student reads.

## Matching

Client-side deterministic scoring uses career profile data (target role, skills, projects, resume, interview). No LLM is used on the Jobs page. Match scores are estimates — not hiring predictions.

## Apply flow

LearnSyra does not submit applications. The Apply action opens the stored `apply_url` (or `source_url` fallback) in a new browser tab. Students can mark applications locally for tracking.
