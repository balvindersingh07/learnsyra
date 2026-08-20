-- Restrict lesson_progress writes to enrolled course lessons.
-- Restrict certificate INSERT to verified 100% lesson completion.
-- Does not change certificates SELECT. Does not add admin minting.
-- Does not add a unique certificate constraint.

-- ---------------------------------------------------------------------------
-- lesson_progress: split FOR ALL so SELECT stays own-row, writes require
-- enrollment in the course that owns the lesson.
-- ---------------------------------------------------------------------------
drop policy if exists "progress own" on public.lesson_progress;

create policy "progress select own"
on public.lesson_progress
for select
using (student_id = auth.uid());

create policy "progress insert enrolled"
on public.lesson_progress
for insert
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    join public.enrollments e on e.course_id = m.course_id
    where l.id = lesson_progress.lesson_id
      and e.student_id = lesson_progress.student_id
  )
);

create policy "progress update enrolled"
on public.lesson_progress
for update
using (
  student_id = auth.uid()
  and exists (
    select 1
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    join public.enrollments e on e.course_id = m.course_id
    where l.id = lesson_progress.lesson_id
      and e.student_id = lesson_progress.student_id
  )
)
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    join public.enrollments e on e.course_id = m.course_id
    where l.id = lesson_progress.lesson_id
      and e.student_id = lesson_progress.student_id
  )
);

create policy "progress delete own"
on public.lesson_progress
for delete
using (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- certificates: INSERT only after every DB lesson for that course is done.
-- Does not trust enrollments.progress or client-provided completion flags.
-- ---------------------------------------------------------------------------
drop policy if exists "certs insert own" on public.certificates;

create policy "certs insert own"
on public.certificates
for insert
with check (
  student_id = auth.uid()
  and course_id is not null
  and exists (
    select 1 from public.courses c
    where c.id = certificates.course_id
  )
  and exists (
    select 1 from public.enrollments e
    where e.student_id = certificates.student_id
      and e.course_id = certificates.course_id
  )
  and (
    select count(*)
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    where m.course_id = certificates.course_id
  ) > 0
  and (
    select count(*)
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    where m.course_id = certificates.course_id
  ) = (
    select count(*)
    from public.course_lessons l
    join public.course_modules m on m.id = l.module_id
    join public.lesson_progress p
      on p.lesson_id = l.id
     and p.student_id = certificates.student_id
    where m.course_id = certificates.course_id
  )
);
