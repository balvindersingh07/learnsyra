-- Phase 1: Tutor marketplace payment foundation (session pricing + ledgers).
-- Does NOT modify public.payments, profiles.plan, or subscription Razorpay flows.

-- ---------------------------------------------------------------------------
-- platform_settings
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

insert into public.platform_settings (key, value)
values ('marketplace_fee_bps', '1000')
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings read" on public.platform_settings;
create policy "platform_settings read"
  on public.platform_settings
  for select
  using (auth.uid() is not null);

drop policy if exists "platform_settings admin write" on public.platform_settings;
create policy "platform_settings admin write"
  on public.platform_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- tutor_session_offers (server-side session pricing)
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_session_offers (
  id                  uuid primary key default gen_random_uuid(),
  tutor_listing_id    uuid not null references public.tutor_listings (id) on delete cascade,
  offer_key           text not null check (offer_key in ('1on1', 'project', 'interview', 'career')),
  label               text not null,
  enabled             boolean not null default false,
  hourly_rate_minor   integer not null default 0 check (hourly_rate_minor >= 0),
  duration_minutes    integer not null default 60 check (duration_minutes > 0 and duration_minutes <= 480),
  currency            text not null default 'INR' check (currency = 'INR'),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint tutor_session_offers_listing_key unique (tutor_listing_id, offer_key),
  constraint tutor_session_offers_paid_rate check (not enabled or hourly_rate_minor > 0)
);

create index if not exists tutor_session_offers_listing_idx
  on public.tutor_session_offers (tutor_listing_id);

create index if not exists tutor_session_offers_enabled_idx
  on public.tutor_session_offers (tutor_listing_id)
  where enabled = true;

alter table public.tutor_session_offers enable row level security;

drop policy if exists "session_offers public read" on public.tutor_session_offers;
create policy "session_offers public read"
  on public.tutor_session_offers
  for select
  using (
    enabled = true
    and exists (
      select 1
      from public.tutor_listings tl
      where tl.id = tutor_listing_id
        and tl.available = true
    )
  );

drop policy if exists "session_offers tutor read" on public.tutor_session_offers;
create policy "session_offers tutor read"
  on public.tutor_session_offers
  for select
  using (
    exists (
      select 1
      from public.tutor_listings tl
      where tl.id = tutor_listing_id
        and tl.profile_id = auth.uid()
    )
  );

drop policy if exists "session_offers admin read" on public.tutor_session_offers;
create policy "session_offers admin read"
  on public.tutor_session_offers
  for select
  using (public.is_admin());

drop policy if exists "session_offers tutor insert" on public.tutor_session_offers;
create policy "session_offers tutor insert"
  on public.tutor_session_offers
  for insert
  with check (
    public.is_tutor()
    and exists (
      select 1
      from public.tutor_listings tl
      where tl.id = tutor_listing_id
        and tl.profile_id = auth.uid()
    )
  );

drop policy if exists "session_offers tutor update" on public.tutor_session_offers;
create policy "session_offers tutor update"
  on public.tutor_session_offers
  for update
  using (
    exists (
      select 1
      from public.tutor_listings tl
      where tl.id = tutor_listing_id
        and tl.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tutor_listings tl
      where tl.id = tutor_listing_id
        and tl.profile_id = auth.uid()
    )
  );

drop policy if exists "session_offers tutor delete" on public.tutor_session_offers;
create policy "session_offers tutor delete"
  on public.tutor_session_offers
  for delete
  using (
    exists (
      select 1
      from public.tutor_listings tl
      where tl.id = tutor_listing_id
        and tl.profile_id = auth.uid()
    )
  );

drop policy if exists "session_offers admin write" on public.tutor_session_offers;
create policy "session_offers admin write"
  on public.tutor_session_offers
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Extend bookings (payment metadata — writes via service role in later phases)
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists offer_key text check (offer_key is null or offer_key in ('1on1', 'project', 'interview', 'career')),
  add column if not exists scheduled_at timestamptz,
  add column if not exists duration_minutes integer check (duration_minutes is null or (duration_minutes > 0 and duration_minutes <= 480)),
  add column if not exists amount_minor integer check (amount_minor is null or amount_minor >= 0),
  add column if not exists currency text not null default 'INR',
  add column if not exists payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'awaiting_payment', 'paid', 'failed', 'expired', 'refunded')),
  add column if not exists marketplace_payment_id uuid,
  add column if not exists expires_at timestamptz;

create index if not exists bookings_payment_status_idx
  on public.bookings (payment_status, created_at desc);

create index if not exists bookings_scheduled_at_idx
  on public.bookings (scheduled_at)
  where scheduled_at is not null;

-- Freeze payment-sensitive booking columns for authenticated clients.
create or replace function public.protect_booking_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.offer_key := old.offer_key;
  new.scheduled_at := old.scheduled_at;
  new.duration_minutes := old.duration_minutes;
  new.amount_minor := old.amount_minor;
  new.currency := old.currency;
  new.payment_status := old.payment_status;
  new.marketplace_payment_id := old.marketplace_payment_id;
  new.expires_at := old.expires_at;
  return new;
end;
$$;

drop trigger if exists trg_protect_booking_payment_fields on public.bookings;
create trigger trg_protect_booking_payment_fields
  before update on public.bookings
  for each row
  execute function public.protect_booking_payment_fields();

revoke all on function public.protect_booking_payment_fields() from public;
revoke all on function public.protect_booking_payment_fields() from anon;
grant execute on function public.protect_booking_payment_fields() to authenticated;

-- Students may only insert legacy/free bookings without payment metadata.
drop policy if exists "bookings insert student" on public.bookings;
create policy "bookings insert student"
on public.bookings
for insert
with check (
  student_id = auth.uid()
  and status = 'pending'
  and payment_status = 'not_required'
  and amount_minor is null
  and marketplace_payment_id is null
  and expires_at is null
  and exists (
    select 1
    from public.tutor_listings t
    where t.id = tutor_listing_id
  )
);

-- ---------------------------------------------------------------------------
-- marketplace_payments (separate from subscription public.payments)
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_payments (
  id                      uuid primary key default gen_random_uuid(),
  kind                    text not null default 'tutor_session'
    check (kind in ('tutor_session', 'course')),
  booking_id              uuid references public.bookings (id) on delete set null,
  student_id              uuid not null references public.profiles (id) on delete cascade,
  tutor_id                uuid not null references public.profiles (id) on delete cascade,
  provider                text not null default 'razorpay',
  currency                text not null default 'INR',
  amount_minor            integer not null check (amount_minor > 0),
  platform_fee_minor      integer not null default 0 check (platform_fee_minor >= 0),
  tutor_earning_minor     integer not null default 0 check (tutor_earning_minor >= 0),
  fee_bps_snapshot        integer not null default 0 check (fee_bps_snapshot >= 0 and fee_bps_snapshot <= 10000),
  external_order_id       text,
  external_payment_id     text,
  status                  text not null default 'created'
    check (status in ('created', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  idempotency_key         text,
  webhook_event_id        text,
  failure_reason          text,
  refund_amount_minor     integer not null default 0 check (refund_amount_minor >= 0),
  metadata                jsonb not null default '{}'::jsonb,
  paid_at                 timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint marketplace_payments_provider_order unique (provider, external_order_id),
  constraint marketplace_payments_earning_lte_gross check (tutor_earning_minor + platform_fee_minor <= amount_minor)
);

create unique index if not exists marketplace_payments_external_payment_id_key
  on public.marketplace_payments (external_payment_id)
  where external_payment_id is not null;

create unique index if not exists marketplace_payments_webhook_event_id_key
  on public.marketplace_payments (webhook_event_id)
  where webhook_event_id is not null;

create unique index if not exists marketplace_payments_idempotency_key
  on public.marketplace_payments (idempotency_key)
  where idempotency_key is not null;

create index if not exists marketplace_payments_student_created_idx
  on public.marketplace_payments (student_id, created_at desc);

create index if not exists marketplace_payments_tutor_created_idx
  on public.marketplace_payments (tutor_id, created_at desc);

create index if not exists marketplace_payments_booking_idx
  on public.marketplace_payments (booking_id)
  where booking_id is not null;

alter table public.marketplace_payments enable row level security;

drop policy if exists "marketplace_payments read student" on public.marketplace_payments;
create policy "marketplace_payments read student"
  on public.marketplace_payments
  for select
  using (student_id = auth.uid());

drop policy if exists "marketplace_payments read tutor" on public.marketplace_payments;
create policy "marketplace_payments read tutor"
  on public.marketplace_payments
  for select
  using (tutor_id = auth.uid());

drop policy if exists "marketplace_payments read admin" on public.marketplace_payments;
create policy "marketplace_payments read admin"
  on public.marketplace_payments
  for select
  using (public.is_admin());

alter table public.bookings
  add constraint bookings_marketplace_payment_id_fkey
  foreign key (marketplace_payment_id) references public.marketplace_payments (id) on delete set null;

-- ---------------------------------------------------------------------------
-- tutor_earnings (payout-ready; populated in later phases)
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_earnings (
  id                      uuid primary key default gen_random_uuid(),
  marketplace_payment_id  uuid not null unique references public.marketplace_payments (id) on delete cascade,
  tutor_id                uuid not null references public.profiles (id) on delete cascade,
  booking_id              uuid references public.bookings (id) on delete set null,
  gross_minor             integer not null check (gross_minor >= 0),
  platform_fee_minor      integer not null default 0 check (platform_fee_minor >= 0),
  net_minor               integer not null check (net_minor >= 0),
  currency                text not null default 'INR',
  payout_status           text not null default 'pending'
    check (payout_status in ('pending', 'available', 'paid', 'held', 'cancelled')),
  payout_id               uuid,
  earned_at               timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint tutor_earnings_net_lte_gross check (net_minor + platform_fee_minor <= gross_minor)
);

create index if not exists tutor_earnings_tutor_earned_idx
  on public.tutor_earnings (tutor_id, earned_at desc);

create index if not exists tutor_earnings_payout_status_idx
  on public.tutor_earnings (payout_status, earned_at desc);

alter table public.tutor_earnings enable row level security;

drop policy if exists "tutor_earnings read tutor" on public.tutor_earnings;
create policy "tutor_earnings read tutor"
  on public.tutor_earnings
  for select
  using (tutor_id = auth.uid());

drop policy if exists "tutor_earnings read admin" on public.tutor_earnings;
create policy "tutor_earnings read admin"
  on public.tutor_earnings
  for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants (mirror subscription payments: authenticated read-only on ledgers)
-- ---------------------------------------------------------------------------
revoke all on table public.platform_settings from anon;
grant select on table public.platform_settings to authenticated;

grant select on table public.tutor_session_offers to anon;
grant select, insert, update, delete on table public.tutor_session_offers to authenticated;

revoke all on table public.marketplace_payments from anon;
revoke insert, update, delete, truncate, references, trigger on table public.marketplace_payments from authenticated;
grant select on table public.marketplace_payments to authenticated;

revoke all on table public.tutor_earnings from anon;
revoke insert, update, delete, truncate, references, trigger on table public.tutor_earnings from authenticated;
grant select on table public.tutor_earnings to authenticated;

-- Restore tutor_listings write for pricing sync (revoked in harden_phase0_grants).
grant select, insert, update on table public.tutor_listings to authenticated;

revoke truncate, references, trigger on table
  public.platform_settings,
  public.tutor_session_offers,
  public.marketplace_payments,
  public.tutor_earnings
from anon, authenticated;
