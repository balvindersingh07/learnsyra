-- Freeze enrollments student_id + course_id after insert.
-- Block self-enroll into unpublished courses.
-- Ignore client-supplied progress; recompute from lesson_progress.
-- Does not change SELECT or DELETE policies.
-- Does not change certificates (they already ignore enrollments.progress).

-- ---------------------------------------------------------------------------
-- INSERT: own student_id, empty progress, published course (admin may
-- self-enroll in a draft they can already see). Cannot enroll another user.
-- ---------------------------------------------------------------------------
drop policy if exists "enrollments insert own" on public.enrollments;

create policy "enrollments insert own"
on public.enrollments
for insert
with check (
  student_id = auth.uid()
  and progress = 0
  and last_lesson_id is null
  and exists (
    select 1
    from public.courses c
    where c.id = enrollments.course_id
      and (c.published or public.is_admin())
  )
);

-- ---------------------------------------------------------------------------
-- UPDATE: own row only. WITH CHECK keeps student_id = caller.
-- course_id / progress immutability is enforced by the trigger below
-- because RLS cannot compare OLD and NEW.
-- ---------------------------------------------------------------------------
drop policy if exists "enrollments update own" on public.enrollments;

create policy "enrollments update own"
on public.enrollments
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE: freeze identity; set progress from lesson_progress counts.
-- completeLesson() upserts lesson_progress first, then updates enrollments,
-- so the denormalized progress stays in sync without trusting the client.
-- ---------------------------------------------------------------------------
create or replace function public.protect_enrollment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lesson_count integer;
  done_count integer;
begin
  new.student_id := old.student_id;
  new.course_id := old.course_id;

  select count(*)::integer
    into lesson_count
  from public.course_lessons l
  join public.course_modules m on m.id = l.module_id
  where m.course_id = new.course_id;

  select count(*)::integer
    into done_count
  from public.course_lessons l
  join public.course_modules m on m.id = l.module_id
  join public.lesson_progress p
    on p.lesson_id = l.id
   and p.student_id = new.student_id
  where m.course_id = new.course_id;

  if lesson_count > 0 then
    new.progress := round((done_count::numeric / lesson_count) * 100)::integer;
  else
    new.progress := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_enrollment_integrity on public.enrollments;
create trigger trg_protect_enrollment_integrity
  before update on public.enrollments
  for each row
  execute function public.protect_enrollment_integrity();

revoke all on function public.protect_enrollment_integrity() from public;
revoke all on function public.protect_enrollment_integrity() from anon;
grant execute on function public.protect_enrollment_integrity() to authenticated;
