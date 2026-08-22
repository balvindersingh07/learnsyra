-- Freeze profiles.plan and stripe_customer_id from client Data API writes.
-- Paid entitlements are applied only by trusted server-side Stripe verification
-- (stripe-webhook uses the service_role key; auth.uid() is null).
-- Does not change RLS row policies. Does not weaken other table grants.

-- ---------------------------------------------------------------------------
-- Column privileges: authenticated may update identity fields only.
-- service_role / table owner keep existing table-level UPDATE.
-- ---------------------------------------------------------------------------
revoke update on table public.profiles from authenticated;

grant update (
  full_name,
  avatar_url,
  headline
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE: freeze plan and stripe_customer_id unless this is a
-- privileged session (SQL Editor / migrations / service_role).
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan is not distinct from old.plan
     and new.stripe_customer_id is not distinct from old.stripe_customer_id then
    return new;
  end if;

  -- Dashboard SQL, migrations, and service_role have no end-user JWT.
  if auth.uid() is null then
    return new;
  end if;

  raise exception 'profiles.plan cannot be changed by this user'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_protect_profile_plan on public.profiles;
create trigger trg_protect_profile_plan
  before update on public.profiles
  for each row
  execute function public.protect_profile_plan();

revoke all on function public.protect_profile_plan() from public;
revoke all on function public.protect_profile_plan() from anon;
revoke all on function public.protect_profile_plan() from authenticated;
