-- Notification email delivery idempotency + notify_user returns notification id.

create table if not exists public.notification_email_deliveries (
  idempotency_key text primary key,
  notification_id uuid references public.notifications (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now()
);

alter table public.notification_email_deliveries enable row level security;

revoke all on table public.notification_email_deliveries from anon, authenticated;
grant select, insert on table public.notification_email_deliveries to service_role;

create or replace function public.notify_user(
  p_user uuid,
  p_title text,
  p_body text default null,
  p_href text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  related boolean := false;
  new_id uuid;
begin
  if caller is null then
    raise exception 'not allowed'
      using errcode = '42501';
  end if;

  if caller = p_user then
    insert into public.notifications (user_id, title, body, href)
    values (p_user, p_title, p_body, p_href)
    returning id into new_id;
    return new_id;
  end if;

  if public.is_admin() then
    insert into public.notifications (user_id, title, body, href)
    values (p_user, p_title, p_body, p_href)
    returning id into new_id;
    return new_id;
  end if;

  if public.is_tutor() then
    related :=
      exists (
        select 1
        from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.student_id = p_user
          and c.tutor_id = caller
      )
      or exists (
        select 1
        from public.bookings b
        join public.tutor_listings t on t.id = b.tutor_listing_id
        where b.student_id = p_user
          and t.profile_id = caller
      )
      or exists (
        select 1
        from public.live_classes lc
        where lc.tutor_id = caller
          and (
            exists (
              select 1
              from public.live_class_attendance a
              where a.class_id = lc.id
                and a.student_id = p_user
            )
            or (
              lc.course_id is not null
              and exists (
                select 1
                from public.enrollments e
                join public.courses c on c.id = e.course_id
                where e.student_id = p_user
                  and e.course_id = lc.course_id
                  and c.tutor_id = caller
              )
            )
          )
      );
  end if;

  if not related then
    raise exception 'not allowed'
      using errcode = '42501';
  end if;

  insert into public.notifications (user_id, title, body, href)
  values (p_user, p_title, p_body, p_href)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.notify_user(uuid, text, text, text) from public;
revoke all on function public.notify_user(uuid, text, text, text) from anon;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;
