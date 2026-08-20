-- Restrict profiles SELECT to own row, admin, and existing relationships.
-- Does not change UPDATE policy or column grants.

drop policy if exists "profiles read" on public.profiles;

create policy "profiles read"
on public.profiles
for select
using (
  id = auth.uid()

  or public.is_admin()

  or exists (
    select 1
    from public.enrollments e
    join public.courses c
      on c.id = e.course_id
    where e.student_id = profiles.id
      and c.tutor_id = auth.uid()
  )

  or exists (
    select 1
    from public.bookings b
    join public.tutor_listings t
      on t.id = b.tutor_listing_id
    where b.student_id = profiles.id
      and t.profile_id = auth.uid()
  )

  or exists (
    select 1
    from public.live_classes lc
    where lc.tutor_id = profiles.id
  )

  or exists (
    select 1
    from public.course_reviews r
    join public.courses rc
      on rc.id = r.course_id
    where r.student_id = profiles.id
      and (
        rc.tutor_id = auth.uid()
        or exists (
          select 1
          from public.enrollments re
          where re.course_id = r.course_id
            and re.student_id = auth.uid()
        )
      )
  )
);
