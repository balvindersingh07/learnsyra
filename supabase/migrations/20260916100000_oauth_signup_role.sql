-- OAuth sign-up role assignment.
-- signInWithOAuth cannot pass custom user_metadata, so the client stores the
-- selected student/tutor role in sessionStorage and calls this RPC after callback.
-- Existing accounts are never modified.

create or replace function public.apply_oauth_signup_role(p_role text)
returns public.user_role
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  normalized text;
  requested public.user_role;
  user_created timestamptz;
  current_role public.user_role;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  normalized := lower(trim(coalesce(p_role, '')));
  if normalized = 'tutor' then
    requested := 'tutor';
  elsif normalized = 'student' then
    requested := 'student';
  else
    raise exception 'invalid role: must be student or tutor' using errcode = '22023';
  end if;

  select u.created_at into user_created
  from auth.users u
  where u.id = uid;

  if user_created is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select p.role into current_role
  from public.profiles p
  where p.id = uid;

  -- Only Google OAuth sign-ups may use this path.
  if not exists (
    select 1
    from auth.identities i
    where i.user_id = uid
      and i.provider = 'google'
  ) then
    return coalesce(current_role, 'student'::public.user_role);
  end if;

  if not found then
    insert into public.profiles (id, full_name, role)
    values (uid, '', requested)
    on conflict (id) do nothing;

    select p.role into current_role
    from public.profiles p
    where p.id = uid;

    return coalesce(current_role, requested);
  end if;

  -- Never change roles for established accounts.
  if user_created <= now() - interval '10 minutes' then
    return current_role;
  end if;

  -- New account: apply the selected role once. Never downgrade tutor.
  if current_role = 'tutor' then
    return current_role;
  end if;

  if requested = current_role then
    return current_role;
  end if;

  perform set_config('learnsyra.allow_oauth_role', '1', true);
  update public.profiles
  set role = requested
  where id = uid
    and role = 'student';
  perform set_config('learnsyra.allow_oauth_role', '', true);

  return requested;
end;
$$;

-- Allow the OAuth RPC to perform the one-time role assignment.
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

  if coalesce(current_setting('learnsyra.allow_oauth_role', true), '') = '1' then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  raise exception 'profiles.role cannot be changed by this user'
    using errcode = '42501';
end;
$$;

grant execute on function public.apply_oauth_signup_role(text) to authenticated;
revoke all on function public.apply_oauth_signup_role(text) from anon;
revoke all on function public.apply_oauth_signup_role(text) from public;
