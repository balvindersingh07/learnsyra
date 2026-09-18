# LearnSyra Jobs Platform

## Overview

LearnSyra Career Jobs reads live listings from the Supabase `public.jobs` table. The student Jobs page (`/career/jobs`) shows only **active** rows posted within the last **7 days** with valid outbound application or source URLs.

**Production uses IndianAPI** (`source=indianapi`) as the authorized server-side job provider. The `sync-jobs` Edge Function fetches listings, applies a deterministic IT relevance gate, validates and deduplicates rows, then upserts into `public.jobs`.

Mock/demo listings are **disabled in production**. For local development only, set `VITE_DEV_MOCK_JOBS=true` in `.env.local` to enable the legacy practice catalog when the database is empty.

## Architecture

```
IndianAPI (jobs.indianapi.in)  →  sync-jobs Edge Function  →  public.jobs  →  Frontend (getJobs)
         ↑                              ↑
   INDIANAPI_API_KEY (secret)    SYNC_JOBS_CRON_SECRET
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

### IndianAPI provider

- **Endpoint:** `https://jobs.indianapi.in/jobs`
- **Auth:** `x-api-key` header from `INDIANAPI_API_KEY` (Supabase secret only)
- **Source identifier:** `indianapi`
- **Rotation:** 14 IT role queries, 4 per sync slot, slot advances every 4 hours
- **Request budget:** up to 6 HTTP calls per sync (`MAX_REQUESTS_PER_SYNC`)
- **Field mapping:** `apply_link` → `apply_url` / `source_url` (preserved exactly), `posted_date` → `posted_at`

### Deterministic IT relevance gate

Before any upsert, each IndianAPI row passes `assessJobRelevance()` in `supabase/functions/_shared/jobIngest.ts`. Rejected jobs are never inserted or updated.

**Decision order:**

1. **Mandatory validation** (unchanged): required fields, ≤7-day freshness, valid HTTPS apply URL, `example.com` blocked.
2. **Title hard reject** (`reject:title`): HR/recruitment/sales/marketing/finance/legal/non-IT support patterns in `title` + `job_title`. Uses word boundaries (e.g. `\bhr\b` does **not** match **HRIS**).
3. **Title accept:** strong IT title phrases (`IT_ROLE_PHRASES`, software engineer/developer, SDE, software development/testing, etc.) or tier-2 IT support (`IT Helpdesk`, `IT Support`, technical support with IT context).
4. **Domain reject** (`reject:domain`): same reject patterns scanned across the full listing when the title is weak.
5. **Body accept:** at least **2 distinct** hits from `IT_SKILL_LEXICON` (react, javascript, python, docker, etc.) anywhere in the listing text.
6. **Otherwise** (`reject:no_it_signal`).

**Seniority is neutral:** fresher, graduate, trainee, intern, junior, and associate titles are never rejected solely because of seniority. Generic roles like *Graduate Engineer Trainee* require IT evidence (title or body) to pass.

**Examples:**

| Listing | Result |
|---------|--------|
| Associate Software Engineer | Accept (title) |
| Software Development and Testing Intern | Accept (title) |
| IT Helpdesk Analyst | Accept (tier-2 IT support) |
| HRIS Developer | Accept (HRIS not caught by `\bhr\b`) |
| Recruitment Coordinator | Reject (`reject:title`) |
| HR Apprentice Trainee | Reject (`reject:title`) |
| Graduate Engineer Trainee (no IT body signals) | Reject (`reject:no_it_signal`) |

**Observability:** sync responses and logs include `relevanceRejected` and `relevanceRejectReasons` counts. No database columns are added for reject tracking.

## Environment variables

### Edge Function secrets (Supabase Dashboard → Edge Functions → Secrets)

| Secret | Required | Description |
|--------|----------|-------------|
| `SYNC_JOBS_CRON_SECRET` | **Yes** (for scheduled sync) | Shared secret for `x-sync-jobs-secret` header |
| `INDIANAPI_API_KEY` | **Yes** (production ingest) | IndianAPI `x-api-key` — never commit or expose to the frontend |
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
