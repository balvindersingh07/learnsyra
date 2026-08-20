-- Restrict live_class_attendance INSERT to students related to the class.
-- SELECT is unchanged. No UPDATE/DELETE policies are added.

drop policy if exists "attendance write own" on public.live_class_attendance;

create policy "attendance write own"
on public.live_class_attendance
for insert
with check (
  student_id = auth.uid()
  and (
    exists (
      select 1
      from public.live_classes lc
      join public.enrollments e on e.course_id = lc.course_id
      where lc.id = live_class_attendance.class_id
        and e.student_id = auth.uid()
    )
    or exists (
      select 1
      from public.live_classes lc
      join public.bookings b on b.student_id = auth.uid()
      join public.tutor_listings tl on tl.id = b.tutor_listing_id
      where lc.id = live_class_attendance.class_id
        and tl.profile_id = lc.tutor_id
        and b.status in ('pending', 'confirmed')
    )
  )
);
