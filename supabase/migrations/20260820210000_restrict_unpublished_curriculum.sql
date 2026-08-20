-- Restrict course_modules and course_lessons SELECT so unpublished
-- curriculum is visible only to the course owner or an admin.
-- Published curriculum stays publicly readable (anon + authenticated).
-- Does not change INSERT/UPDATE/DELETE policies.

drop policy if exists "modules read" on public.course_modules;
create policy "modules read"
on public.course_modules
for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.courses c
    where c.id = course_modules.course_id
      and (
        c.published
        or c.tutor_id = auth.uid()
      )
  )
);

drop policy if exists "lessons read" on public.course_lessons;
create policy "lessons read"
on public.course_lessons
for select
using (
  public.is_admin()
  or exists (
    select 1
    from public.course_modules m
    join public.courses c on c.id = m.course_id
    where m.id = course_lessons.module_id
      and (
        c.published
        or c.tutor_id = auth.uid()
      )
  )
);
