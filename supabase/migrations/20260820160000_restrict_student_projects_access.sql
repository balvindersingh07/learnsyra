-- Restrict student_projects access.
-- Students own their rows. Tutors may SELECT/UPDATE only via enrollment or booking.
-- Tutors cannot INSERT for other students or DELETE. Admins retain full access.
-- Does not add course_id/tutor_id columns. Does not use is_tutor().

drop policy if exists "student projects own" on public.student_projects;

create policy "student_projects student insert"
on public.student_projects
for insert
with check (
  student_id = auth.uid()
  or public.is_admin()
);

create policy "student_projects select"
on public.student_projects
for select
using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.student_id = student_projects.student_id
      and c.tutor_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.tutor_listings t on t.id = b.tutor_listing_id
    where b.student_id = student_projects.student_id
      and t.profile_id = auth.uid()
  )
);

create policy "student_projects update"
on public.student_projects
for update
using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.student_id = student_projects.student_id
      and c.tutor_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.tutor_listings t on t.id = b.tutor_listing_id
    where b.student_id = student_projects.student_id
      and t.profile_id = auth.uid()
  )
)
with check (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.enrollments e
    join public.courses c on c.id = e.course_id
    where e.student_id = student_projects.student_id
      and c.tutor_id = auth.uid()
  )
  or exists (
    select 1
    from public.bookings b
    join public.tutor_listings t on t.id = b.tutor_listing_id
    where b.student_id = student_projects.student_id
      and t.profile_id = auth.uid()
  )
);

create policy "student_projects delete"
on public.student_projects
for delete
using (
  student_id = auth.uid()
  or public.is_admin()
);
