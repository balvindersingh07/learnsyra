-- Lesson content, quizzes, jobs, course reviews

alter table public.course_lessons
  add column if not exists body text,
  add column if not exists video_url text,
  add column if not exists quiz jsonb;

create table if not exists public.jobs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  company     text not null,
  location    text,
  salary      text,
  logo        text,
  tags        text[] default '{}',
  apply_url   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.course_reviews (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  body        text,
  created_at  timestamptz not null default now(),
  unique (course_id, student_id)
);

alter table public.jobs enable row level security;
alter table public.course_reviews enable row level security;

drop policy if exists "jobs read" on public.jobs;
create policy "jobs read" on public.jobs for select using (true);

drop policy if exists "reviews read" on public.course_reviews;
create policy "reviews read" on public.course_reviews for select using (true);

drop policy if exists "reviews write own" on public.course_reviews;
create policy "reviews write own" on public.course_reviews
  for insert with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.enrollments e
      where e.student_id = auth.uid() and e.course_id = course_reviews.course_id
    )
  );

drop policy if exists "reviews update own" on public.course_reviews;
create policy "reviews update own" on public.course_reviews
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());

grant select on public.jobs to anon, authenticated;
grant select on public.course_reviews to anon, authenticated;
grant insert, update on public.course_reviews to authenticated;
