-- Restrict course INSERT to tutors (own tutor_id) and admins.
-- Students must not be able to create a course by setting tutor_id = auth.uid().

drop policy if exists "courses insert own" on public.courses;

create policy "courses insert own"
on public.courses
for insert
with check (
  (tutor_id = auth.uid() and public.is_tutor())
  or public.is_admin()
);
