-- Tutor + admin operations, notifications RPC, Stripe customer hook

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.student_projects
  add column if not exists review_note text;

create or replace function public.is_tutor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('tutor', 'admin')
  );
$$;

create or replace function public.notify_user(
  p_user uuid,
  p_title text,
  p_body text default null,
  p_href text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (auth.uid() = p_user or public.is_tutor() or public.is_admin()) then
    raise exception 'not allowed';
  end if;
  insert into public.notifications (user_id, title, body, href)
  values (p_user, p_title, p_body, p_href);
end;
$$;

grant execute on function public.is_tutor() to anon, authenticated;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;

-- Tutor can read enrollments for their courses
drop policy if exists "enrollments tutor read" on public.enrollments;
create policy "enrollments tutor read" on public.enrollments
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = course_id and (c.tutor_id = auth.uid() or public.is_admin())
    )
  );

-- Bookings: student + listing tutor + admin
drop policy if exists "bookings own" on public.bookings;
create policy "bookings own" on public.bookings
  for all using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.tutor_listings t
      where t.id = tutor_listing_id and t.profile_id = auth.uid()
    )
  ) with check (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.tutor_listings t
      where t.id = tutor_listing_id and t.profile_id = auth.uid()
    )
  );

-- Tutors can manage their listings
drop policy if exists "listings write own" on public.tutor_listings;
create policy "listings write own" on public.tutor_listings
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- Tutors review submitted projects
drop policy if exists "student projects own" on public.student_projects;
create policy "student projects own" on public.student_projects
  for all using (student_id = auth.uid() or public.is_tutor())
  with check (student_id = auth.uid() or public.is_tutor());

-- Tutors write curriculum for their courses
drop policy if exists "modules write tutor" on public.course_modules;
create policy "modules write tutor" on public.course_modules
  for all using (
    exists (
      select 1 from public.courses c
      where c.id = course_id and (c.tutor_id = auth.uid() or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.courses c
      where c.id = course_id and (c.tutor_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "lessons write tutor" on public.course_lessons;
create policy "lessons write tutor" on public.course_lessons
  for all using (
    exists (
      select 1 from public.course_modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_id and (c.tutor_id = auth.uid() or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.course_modules m
      join public.courses c on c.id = m.course_id
      where m.id = module_id and (c.tutor_id = auth.uid() or public.is_admin())
    )
  );

grant select, insert, update, delete on public.course_modules, public.course_lessons to authenticated;
grant select, insert, update, delete on public.tutor_listings to authenticated;

-- Attach demo tutor to listings + catalog so the tutor dashboard has work
update public.tutor_listings
set profile_id = p.id
from public.profiles p
where p.role = 'tutor' and public.tutor_listings.profile_id is null;

update public.courses
set tutor_id = p.id
from public.profiles p
where p.role = 'tutor' and public.courses.tutor_id is null;
