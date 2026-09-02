-- Tutor payout foundation: accounts, payout requests, earning linkage, availability sync.
-- Does not modify marketplace checkout/order functions or subscription payments.

-- ---------------------------------------------------------------------------
-- Extend tutor_earnings for partial refund adjustments (withdrawable net).
-- ---------------------------------------------------------------------------
alter table public.tutor_earnings
  add column if not exists refund_adjustment_minor integer not null default 0
    check (refund_adjustment_minor >= 0);

-- ---------------------------------------------------------------------------
-- tutor_payout_accounts
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_payout_accounts (
  id                        uuid primary key default gen_random_uuid(),
  tutor_id                  uuid not null references public.profiles (id) on delete cascade,
  provider                  text not null default 'razorpay',
  provider_account_id       text,
  provider_contact_id       text,
  provider_fund_account_id    text,
  account_type              text not null check (account_type in ('bank', 'upi')),
  masked_account            text not null,
  account_holder_name       text,
  status                    text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'disabled')),
  verification_metadata     jsonb not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create unique index if not exists tutor_payout_accounts_tutor_active_idx
  on public.tutor_payout_accounts (tutor_id)
  where status in ('pending', 'verified');

create index if not exists tutor_payout_accounts_status_idx
  on public.tutor_payout_accounts (status, updated_at desc);

-- ---------------------------------------------------------------------------
-- tutor_payouts
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_payouts (
  id                        uuid primary key default gen_random_uuid(),
  tutor_id                  uuid not null references public.profiles (id) on delete cascade,
  payout_account_id         uuid references public.tutor_payout_accounts (id) on delete set null,
  amount_minor              bigint not null check (amount_minor > 0),
  currency                  text not null default 'INR',
  status                    text not null default 'requested'
    check (status in ('requested', 'approved', 'processing', 'paid', 'failed', 'rejected', 'cancelled')),
  provider                  text not null default 'razorpay',
  provider_payout_id        text,
  provider_transfer_id      text,
  idempotency_key           text not null,
  requested_at              timestamptz not null default now(),
  processed_at              timestamptz,
  failure_reason            text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint tutor_payouts_idempotency_key unique (idempotency_key)
);

create index if not exists tutor_payouts_tutor_requested_idx
  on public.tutor_payouts (tutor_id, requested_at desc);

create index if not exists tutor_payouts_status_idx
  on public.tutor_payouts (status, requested_at desc);

-- Link tutor_earnings.payout_id to tutor_payouts (column existed without FK).
alter table public.tutor_earnings
  drop constraint if exists tutor_earnings_payout_id_fkey;

alter table public.tutor_earnings
  add constraint tutor_earnings_payout_id_fkey
  foreign key (payout_id) references public.tutor_payouts (id) on delete set null;

-- ---------------------------------------------------------------------------
-- payout_earnings junction (many earnings → one payout)
-- ---------------------------------------------------------------------------
create table if not exists public.payout_earnings (
  id              uuid primary key default gen_random_uuid(),
  payout_id       uuid not null references public.tutor_payouts (id) on delete cascade,
  earning_id      uuid not null references public.tutor_earnings (id) on delete cascade,
  amount_minor    bigint not null check (amount_minor > 0),
  created_at      timestamptz not null default now(),
  constraint payout_earnings_earning_id unique (earning_id)
);

create index if not exists payout_earnings_payout_idx
  on public.payout_earnings (payout_id);

-- ---------------------------------------------------------------------------
-- Platform settings: minimum payout threshold (₹100 default).
-- ---------------------------------------------------------------------------
insert into public.platform_settings (key, value)
values ('payout_minimum_minor', '10000')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.tutor_earning_withdrawable_net(te public.tutor_earnings)
returns bigint
language sql
immutable
as $$
  select greatest(0::bigint, te.net_minor::bigint - te.refund_adjustment_minor::bigint);
$$;

create or replace function public.sync_tutor_earning_availability(p_tutor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tutor_earnings te
  set
    payout_status = 'available',
    updated_at = now()
  where te.tutor_id = p_tutor_id
    and te.payout_status = 'pending'
    and te.payout_id is null
    and public.tutor_earning_withdrawable_net(te) > 0
    and exists (
      select 1
      from public.bookings b
      join public.marketplace_payments mp on mp.booking_id = b.id
      where b.id = te.booking_id
        and b.status = 'completed'
        and mp.status = 'paid'
        and mp.refund_amount_minor = 0
    );

  update public.tutor_earnings te
  set
    payout_status = 'held',
    updated_at = now()
  where te.tutor_id = p_tutor_id
    and te.payout_status in ('pending', 'available')
    and te.payout_id is null
    and exists (
      select 1
      from public.marketplace_payments mp
      where mp.id = te.marketplace_payment_id
        and mp.refund_amount_minor > 0
        and mp.status in ('partially_refunded', 'refunded')
    );
end;
$$;

create or replace function public.get_tutor_payout_summary(p_tutor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pending bigint := 0;
  v_available bigint := 0;
  v_paid bigint := 0;
  v_held bigint := 0;
  v_cancelled bigint := 0;
  v_gross bigint := 0;
  v_fee bigint := 0;
  v_net bigint := 0;
begin
  if auth.uid() is distinct from p_tutor_id and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  perform public.sync_tutor_earning_availability(p_tutor_id);

  select
    coalesce(sum(case when te.payout_status = 'pending' and te.payout_id is null then public.tutor_earning_withdrawable_net(te) else 0 end), 0),
    coalesce(sum(case when te.payout_status = 'available' and te.payout_id is null then public.tutor_earning_withdrawable_net(te) else 0 end), 0),
    coalesce(sum(case when te.payout_status = 'paid' then public.tutor_earning_withdrawable_net(te) else 0 end), 0),
    coalesce(sum(case when te.payout_status = 'held' then public.tutor_earning_withdrawable_net(te) else 0 end), 0),
    coalesce(sum(case when te.payout_status = 'cancelled' then te.net_minor::bigint else 0 end), 0),
    coalesce(sum(te.gross_minor::bigint), 0),
    coalesce(sum(te.platform_fee_minor::bigint), 0),
    coalesce(sum(public.tutor_earning_withdrawable_net(te)), 0)
  into v_pending, v_available, v_paid, v_held, v_cancelled, v_gross, v_fee, v_net
  from public.tutor_earnings te
  where te.tutor_id = p_tutor_id;

  return jsonb_build_object(
    'pending_minor', v_pending,
    'available_minor', v_available,
    'paid_minor', v_paid,
    'held_minor', v_held,
    'cancelled_minor', v_cancelled,
    'gross_minor', v_gross,
    'platform_fee_minor', v_fee,
    'net_minor', v_net,
    'minimum_payout_minor', coalesce(
      (select value::bigint from public.platform_settings where key = 'payout_minimum_minor'),
      10000::bigint
    )
  );
end;
$$;

create or replace function public.create_tutor_payout_request(
  p_tutor_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_account_id uuid;
  v_minimum bigint;
  v_available bigint;
  v_payout_id uuid;
  v_earning record;
begin
  if auth.uid() is distinct from p_tutor_id and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key_required';
  end if;

  select id into v_existing
  from public.tutor_payouts
  where idempotency_key = p_idempotency_key
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  perform public.sync_tutor_earning_availability(p_tutor_id);

  select id into v_account_id
  from public.tutor_payout_accounts
  where tutor_id = p_tutor_id
    and status = 'verified'
  order by updated_at desc
  limit 1;

  if v_account_id is null then
    raise exception 'payout_account_not_verified';
  end if;

  select coalesce(value::bigint, 10000::bigint) into v_minimum
  from public.platform_settings
  where key = 'payout_minimum_minor';

  select coalesce(sum(public.tutor_earning_withdrawable_net(te)), 0) into v_available
  from public.tutor_earnings te
  where te.tutor_id = p_tutor_id
    and te.payout_status = 'available'
    and te.payout_id is null;

  if v_available <= 0 then
    raise exception 'no_available_balance';
  end if;

  if v_available < v_minimum then
    raise exception 'below_minimum_payout';
  end if;

  insert into public.tutor_payouts (
    tutor_id,
    payout_account_id,
    amount_minor,
    currency,
    status,
    provider,
    idempotency_key
  )
  values (
    p_tutor_id,
    v_account_id,
    v_available,
    'INR',
    'requested',
    'razorpay',
    p_idempotency_key
  )
  returning id into v_payout_id;

  for v_earning in
    select te.id, public.tutor_earning_withdrawable_net(te) as amount_minor
    from public.tutor_earnings te
    where te.tutor_id = p_tutor_id
      and te.payout_status = 'available'
      and te.payout_id is null
    order by te.earned_at asc
    for update
  loop
    insert into public.payout_earnings (payout_id, earning_id, amount_minor)
    values (v_payout_id, v_earning.id, v_earning.amount_minor);

    update public.tutor_earnings
    set payout_id = v_payout_id, updated_at = now()
    where id = v_earning.id;
  end loop;

  update public.tutor_payouts
  set status = 'approved', updated_at = now()
  where id = v_payout_id;

  return v_payout_id;
end;
$$;

revoke all on function public.sync_tutor_earning_availability(uuid) from public;
revoke all on function public.get_tutor_payout_summary(uuid) from public;
revoke all on function public.create_tutor_payout_request(uuid, text) from public;
grant execute on function public.sync_tutor_earning_availability(uuid) to service_role;
grant execute on function public.get_tutor_payout_summary(uuid) to authenticated;
grant execute on function public.create_tutor_payout_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tutor_payout_accounts enable row level security;
alter table public.tutor_payouts enable row level security;
alter table public.payout_earnings enable row level security;

drop policy if exists "tutor_payout_accounts select own" on public.tutor_payout_accounts;
create policy "tutor_payout_accounts select own"
  on public.tutor_payout_accounts
  for select
  using (tutor_id = auth.uid());

drop policy if exists "tutor_payout_accounts select admin" on public.tutor_payout_accounts;
create policy "tutor_payout_accounts select admin"
  on public.tutor_payout_accounts
  for select
  using (public.is_admin());

drop policy if exists "tutor_payouts select own" on public.tutor_payouts;
create policy "tutor_payouts select own"
  on public.tutor_payouts
  for select
  using (tutor_id = auth.uid());

drop policy if exists "tutor_payouts select admin" on public.tutor_payouts;
create policy "tutor_payouts select admin"
  on public.tutor_payouts
  for select
  using (public.is_admin());

drop policy if exists "payout_earnings select own" on public.payout_earnings;
create policy "payout_earnings select own"
  on public.payout_earnings
  for select
  using (
    exists (
      select 1
      from public.tutor_payouts p
      where p.id = payout_id
        and p.tutor_id = auth.uid()
    )
  );

drop policy if exists "payout_earnings select admin" on public.payout_earnings;
create policy "payout_earnings select admin"
  on public.payout_earnings
  for select
  using (public.is_admin());

-- Writes via service role only (edge functions).
revoke all on table public.tutor_payout_accounts from anon;
revoke insert, update, delete, truncate, references, trigger on table public.tutor_payout_accounts from authenticated;
grant select on table public.tutor_payout_accounts to authenticated;

revoke all on table public.tutor_payouts from anon;
revoke insert, update, delete, truncate, references, trigger on table public.tutor_payouts from authenticated;
grant select on table public.tutor_payouts to authenticated;

revoke all on table public.payout_earnings from anon;
revoke insert, update, delete, truncate, references, trigger on table public.payout_earnings from authenticated;
grant select on table public.payout_earnings to authenticated;
