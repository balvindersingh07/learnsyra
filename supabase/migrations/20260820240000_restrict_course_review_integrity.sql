-- Keep public SELECT and enrolled INSERT unchanged.
-- UPDATE must re-check enrollment and cannot retarget course_id.
-- Freeze student_id + course_id because RLS cannot compare OLD and NEW.
-- No DELETE policy (product never deletes reviews).

drop policy if exists "reviews update own" on public.course_reviews;

create policy "reviews update own"
on public.course_reviews
for update
using (student_id = auth.uid())
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.enrollments e
    where e.student_id = auth.uid()
      and e.course_id = course_reviews.course_id
  )
);

create or replace function public.protect_course_review_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.student_id := old.student_id;
  new.course_id := old.course_id;
  return new;
end;
$$;

drop trigger if exists trg_protect_course_review_integrity on public.course_reviews;
create trigger trg_protect_course_review_integrity
  before update on public.course_reviews
  for each row
  execute function public.protect_course_review_integrity();

revoke all on function public.protect_course_review_integrity() from public;
revoke all on function public.protect_course_review_integrity() from anon;
grant execute on function public.protect_course_review_integrity() to authenticated;
