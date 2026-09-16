-- Harden OAuth signup role assignment: clearer profile detection and Google provider checks.

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
  profile_exists boolean;
  is_google boolean;
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

  profile_exists := found;

  select exists (
    select 1
    from auth.identities i
    where i.user_id = uid
      and i.provider = 'google'
  )
  or coalesce(
    (select u.raw_app_meta_data ->> 'provider' from auth.users u where u.id = uid),
    ''
  ) = 'google'
  or coalesce(
    (select u.raw_app_meta_data -> 'providers' from auth.users u where u.id = uid),
    '[]'::jsonb
  ) ? 'google'
  into is_google;

  if not is_google then
    return coalesce(current_role, 'student'::public.user_role);
  end if;

  if not profile_exists then
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

grant execute on function public.apply_oauth_signup_role(text) to authenticated;
