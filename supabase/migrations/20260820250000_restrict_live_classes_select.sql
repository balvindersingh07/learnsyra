-- Restrict live_classes SELECT so unrelated authenticated users cannot
-- read meeting_url / recording_url or other class rows.
-- INSERT / UPDATE / DELETE policies are unchanged.

drop policy if exists "live_classes read" on public.live_classes;

create policy "live_classes read"
on public.live_classes
for select
using (
  public.is_admin()
  or tutor_id = auth.uid()
  or (
    course_id is not null
    and exists (
      select 1
      from public.enrollments e
      where e.student_id = auth.uid()
        and e.course_id = live_classes.course_id
    )
  )
  or exists (
    select 1
    from public.bookings b
    join public.tutor_listings t on t.id = b.tutor_listing_id
    where b.student_id = auth.uid()
      and t.profile_id = live_classes.tutor_id
  )
);
