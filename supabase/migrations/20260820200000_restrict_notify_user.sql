-- Restrict notify_user so a tutor can only notify a student who already
-- has an enrollment, booking, or live-class relationship with that tutor.
-- Self-notify and admin-notify-any are unchanged.
-- Does not change notifications RLS or other functions.

create or replace function public.notify_user(
  p_user uuid,
  p_title text,
  p_body text default null,
  p_href text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  related boolean := false;
begin
  if caller is null then
    raise exception 'not allowed'
      using errcode = '42501';
  end if;

  -- 1. A user may notify themselves.
  if caller = p_user then
    insert into public.notifications (user_id, title, body, href)
    values (p_user, p_title, p_body, p_href);
    return;
  end if;

  -- 2. Admin may notify any user.
  if public.is_admin() then
    insert into public.notifications (user_id, title, body, href)
    values (p_user, p_title, p_body, p_href);
    return;
  end if;

  -- 3. Tutor may notify only a related student.
  if public.is_tutor() then
    related :=
      -- A. Enrollment: recipient is enrolled in a course taught by caller.
      exists (
        select 1
        from public.enrollments e
        join public.courses c on c.id = e.course_id
        where e.student_id = p_user
          and c.tutor_id = caller
      )
      -- B. Booking: recipient booked a listing owned by caller.
      or exists (
        select 1
        from public.bookings b
        join public.tutor_listings t on t.id = b.tutor_listing_id
        where b.student_id = p_user
          and t.profile_id = caller
      )
      -- C. Live class owned by caller, and recipient is a legitimate
      --    student of that class: attendance on the class, or enrollment
      --    in that class's course (course also taught by caller).
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
  values (p_user, p_title, p_body, p_href);
end;
$$;

revoke all on function public.notify_user(uuid, text, text, text) from public;
revoke all on function public.notify_user(uuid, text, text, text) from anon;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;
