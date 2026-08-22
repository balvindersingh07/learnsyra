-- Extend payments ledger for Razorpay monthly subscriptions (India).
-- Paid entitlements remain service_role-only; protect_profile_plan unchanged.

alter table public.payments
  alter column external_order_id drop not null;

alter table public.payments
  add column if not exists billing_mode text not null default 'subscription'
    check (billing_mode in ('order', 'subscription'));

alter table public.payments
  add column if not exists external_subscription_id text;

alter table public.payments
  add column if not exists external_customer_id text;

alter table public.payments
  add column if not exists subscription_status text;

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('created', 'pending', 'paid', 'failed', 'refunded', 'cancelled'));

alter table public.payments
  drop constraint if exists payments_subscription_status_check;

alter table public.payments
  add constraint payments_subscription_status_check
  check (
    subscription_status is null
    or subscription_status in (
      'created',
      'pending',
      'authenticated',
      'active',
      'halted',
      'cancelled',
      'completed',
      'paused'
    )
  );

create unique index if not exists payments_provider_subscription_key
  on public.payments (provider, external_subscription_id)
  where external_subscription_id is not null;

create index if not exists payments_user_subscription_status_idx
  on public.payments (user_id, subscription_status);
