-- Admin reports queue and persisted audit logs for the existing Admin UI.

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  status        text not null default 'open'
                check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  type          text,
  priority      text
                check (priority is null or priority in ('low', 'medium', 'high', 'critical')),
  reason        text,
  description   text,
  reporter_id   uuid references public.profiles (id) on delete set null,
  entity_type   text,
  entity_id     text,
  entity_name   text,
  evidence      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_priority_idx on public.reports (priority);
create index if not exists reports_entity_idx on public.reports (entity_type, entity_id);
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);

alter table public.reports enable row level security;

create policy "reports admin select"
  on public.reports for select
  to authenticated
  using (public.is_admin());

create policy "reports admin update"
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references public.profiles (id) on delete set null,
  actor_name      text,
  actor_role      text,
  action          text not null,
  entity_type     text,
  entity_id       text,
  entity_name     text,
  status          text not null default 'success',
  source          text not null default 'admin',
  description     text,
  old_status      text,
  new_status      text,
  changed_field   text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

create policy "audit_logs admin select"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin-only audit writer (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.log_admin_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_entity_name text default null,
  p_status text default 'success',
  p_source text default 'admin',
  p_description text default null,
  p_old_status text default null,
  p_new_status text default null,
  p_changed_field text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor uuid := auth.uid();
  v_role text;
  v_name text;
  v_meta jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'not allowed'
      using errcode = '42501';
  end if;

  select p.role::text, p.full_name
  into v_role, v_name
  from public.profiles p
  where p.id = v_actor;

  insert into public.audit_logs (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    entity_name,
    status,
    source,
    description,
    old_status,
    new_status,
    changed_field,
    metadata
  )
  values (
    v_actor,
    v_name,
    v_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    coalesce(nullif(trim(p_status), ''), 'success'),
    coalesce(nullif(trim(p_source), ''), 'admin'),
    p_description,
    p_old_status,
    p_new_status,
    p_changed_field,
    v_meta
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_admin_audit_event(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.log_admin_audit_event(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- Least-privilege grants (match Phase 0 hardening pattern)
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on table
  public.reports,
  public.audit_logs
from anon, authenticated;

revoke insert, update, delete on table public.audit_logs
from anon, authenticated;

revoke insert, delete on table public.reports
from anon, authenticated;

grant select, update on table public.reports to authenticated;
grant select on table public.audit_logs to authenticated;
