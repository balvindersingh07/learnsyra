-- Razorpay payment ledger (India). Paid entitlements on profiles.plan are updated
-- only by trusted Edge Functions using the service_role key (auth.uid() is null).
-- Does not weaken protect_profile_plan, RLS on profiles, or existing grants.

create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  plan_id             text not null check (plan_id in ('student_pro', 'career_pro')),
  provider            text not null default 'razorpay',
  currency            text not null default 'INR',
  amount_minor        integer not null check (amount_minor > 0),
  external_order_id   text not null,
  external_payment_id text,
  status              text not null default 'created'
    check (status in ('created', 'pending', 'paid', 'failed', 'refunded')),
  webhook_event_id    text,
  failure_reason      text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  paid_at             timestamptz,
  completed_at        timestamptz,
  constraint payments_provider_order unique (provider, external_order_id)
);

create unique index if not exists payments_external_payment_id_key
  on public.payments (external_payment_id)
  where external_payment_id is not null;

create unique index if not exists payments_webhook_event_id_key
  on public.payments (webhook_event_id)
  where webhook_event_id is not null;

create index if not exists payments_user_created_idx
  on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

drop policy if exists "payments read own" on public.payments;
create policy "payments read own"
  on public.payments
  for select
  using (user_id = auth.uid() or public.is_admin());

revoke all on table public.payments from anon;
revoke insert, update, delete, truncate, references, trigger on table public.payments from authenticated;
grant select on table public.payments to authenticated;
