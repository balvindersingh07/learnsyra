-- Real job platform: extend jobs table for Adzuna/Jooble ingestion, freshness, deduplication.

-- New columns (keep legacy salary/tags/logo/created_at for compatibility)
alter table public.jobs
  add column if not exists source text,
  add column if not exists source_job_id text,
  add column if not exists source_url text,
  add column if not exists work_mode text,
  add column if not exists job_type text,
  add column if not exists description text,
  add column if not exists requirements text[] default '{}',
  add column if not exists skills text[] default '{}',
  add column if not exists salary_min numeric,
  add column if not exists salary_max numeric,
  add column if not exists currency text default 'INR',
  add column if not exists posted_at timestamptz,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists is_active boolean not null default true,
  add column if not exists ingested_at timestamptz,
  add column if not exists content_hash text;

-- Backfill posted_at from created_at for legacy rows, then deactivate unknown-source rows
update public.jobs
set
  posted_at = coalesce(posted_at, created_at),
  is_active = false
where source is null;

-- Unique per provider job id
create unique index if not exists jobs_source_source_job_id_uidx
  on public.jobs (source, source_job_id)
  where source is not null and source_job_id is not null;

-- Cross-source deduplication hash
create unique index if not exists jobs_content_hash_uidx
  on public.jobs (content_hash)
  where content_hash is not null;

create index if not exists jobs_posted_at_idx on public.jobs (posted_at desc);
create index if not exists jobs_is_active_idx on public.jobs (is_active) where is_active = true;
create index if not exists jobs_expires_at_idx on public.jobs (expires_at) where expires_at is not null;
create index if not exists jobs_location_idx on public.jobs (location);
create index if not exists jobs_company_idx on public.jobs (company);

-- Students only see active, fresh listings with a valid outbound URL
drop policy if exists "jobs read" on public.jobs;
create policy "jobs read" on public.jobs
  for select using (
    is_active = true
    and posted_at is not null
    and posted_at >= (now() - interval '7 days')
    and (
      (apply_url is not null and apply_url <> '' and apply_url not ilike '%example.com%')
      or (source_url is not null and source_url <> '' and source_url not ilike '%example.com%')
    )
  );

comment on column public.jobs.source is 'Job provider: adzuna, jooble, etc.';
comment on column public.jobs.content_hash is 'SHA-256 of normalized title|company|location|url for cross-source dedup';
comment on column public.jobs.posted_at is 'Provider posting time — never ingestion time';
