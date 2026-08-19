-- Protect profiles.role from client-side privilege escalation.
-- Safe to apply on an existing production database. Does not rewrite or delete rows.

-- ---------------------------------------------------------------------------
-- Signup: student/tutor from metadata only. Never admin.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text;
  assigned public.user_role;
begin
  requested := lower(trim(coalesce(new.raw_user_meta_data ->> 'role', 'student')));
  if requested = 'tutor' then
    assigned := 'tutor';
  else
    assigned := 'student';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    assigned
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE: freeze role unless an admin JWT or a privileged session
-- (SQL Editor / migrations / service_role — auth.uid() is null).
-- Other profile columns (full_name, avatar_url, headline, plan, …) are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Dashboard SQL, migrations, and service_role have no end-user JWT.
  if auth.uid() is null then
    return new;
  end if;

  -- An existing admin may change another profile's role via the Data API.
  if public.is_admin() then
    return new;
  end if;

  raise exception 'profiles.role cannot be changed by this user'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before update on public.profiles
  for each row
  execute function public.protect_profile_role();

grant execute on function public.protect_profile_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Operator helper for first-admin (and later role) provisioning.
-- Not granted to anon/authenticated. Run in the Supabase SQL Editor:
--
--   select public.provision_profile_role(
--     (select id from auth.users where email = 'owner@example.com'),
--     'admin'
--   );
--
-- Equivalent direct SQL (also allowed: no end-user JWT):
--
--   update public.profiles
--   set role = 'admin'
--   where id = (select id from auth.users where email = 'owner@example.com');
-- ---------------------------------------------------------------------------
create or replace function public.provision_profile_role(
  p_user_id uuid,
  p_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'not allowed to provision roles'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception 'profile not found for %', p_user_id;
  end if;
end;
$$;

revoke all on function public.provision_profile_role(uuid, public.user_role) from public;
revoke all on function public.provision_profile_role(uuid, public.user_role) from anon;
revoke all on function public.provision_profile_role(uuid, public.user_role) from authenticated;
