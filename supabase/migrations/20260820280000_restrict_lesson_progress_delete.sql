-- Restrict lesson_progress DELETE to own rows that still belong to an
-- enrolled course lesson. SELECT/INSERT/UPDATE and certificates are unchanged.

drop policy if exists "progress delete own" on public.lesson_progress;

create policy "progress delete own"
on public.lesson_progress
for delete
using (
  student_id = auth.uid()
  and exists (
    select 1
    from public.course_lessons cl
    join public.course_modules cm on cm.id = cl.module_id
    join public.enrollments e on e.course_id = cm.course_id
    where cl.id = lesson_progress.lesson_id
      and e.student_id = auth.uid()
  )
);
