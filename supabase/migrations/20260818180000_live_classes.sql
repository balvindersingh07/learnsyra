-- Live classes + recordings for missed students

create table if not exists public.live_classes (
  id             uuid primary key default gen_random_uuid(),
  tutor_id       uuid not null references public.profiles (id) on delete cascade,
  course_id      uuid references public.courses (id) on delete set null,
  title          text not null,
  description    text,
  status         text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  starts_at      timestamptz not null default now(),
  ended_at       timestamptz,
  meeting_url    text not null,
  recording_url  text,
  created_at     timestamptz not null default now()
);

create table if not exists public.live_class_attendance (
  class_id    uuid not null references public.live_classes (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (class_id, student_id)
);

alter table public.live_classes enable row level security;
alter table public.live_class_attendance enable row level security;

drop policy if exists "live_classes read" on public.live_classes;
create policy "live_classes read" on public.live_classes
  for select using (auth.uid() is not null);

drop policy if exists "live_classes tutor write" on public.live_classes;
create policy "live_classes tutor write" on public.live_classes
  for insert with check (tutor_id = auth.uid() and public.is_tutor());

drop policy if exists "live_classes tutor update" on public.live_classes;
create policy "live_classes tutor update" on public.live_classes
  for update using (tutor_id = auth.uid() or public.is_admin())
  with check (tutor_id = auth.uid() or public.is_admin());

drop policy if exists "live_classes tutor delete" on public.live_classes;
create policy "live_classes tutor delete" on public.live_classes
  for delete using (tutor_id = auth.uid() or public.is_admin());

drop policy if exists "attendance read" on public.live_class_attendance;
create policy "attendance read" on public.live_class_attendance
  for select using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.live_classes c
      where c.id = class_id and c.tutor_id = auth.uid()
    )
  );

drop policy if exists "attendance write own" on public.live_class_attendance;
create policy "attendance write own" on public.live_class_attendance
  for insert with check (student_id = auth.uid());

grant select, insert, update, delete on public.live_classes to authenticated;
grant select, insert on public.live_class_attendance to authenticated;

-- Demo: one ended class with a recording, one upcoming session
insert into public.live_classes (tutor_id, course_id, title, description, status, starts_at, ended_at, meeting_url, recording_url)
select
  p.id,
  c.id,
  'Live: React Hooks crash course',
  'Replay of a live session. Missed it? Watch the recording here.',
  'ended',
  now() - interval '2 days',
  now() - interval '2 days' + interval '1 hour',
  'https://meet.jit.si/LearnSyraDemoReplay',
  'https://www.youtube.com/watch?v=O6P86uwfdR0'
from public.profiles p
join public.courses c on c.tutor_id = p.id
where p.role = 'tutor'
  and not exists (select 1 from public.live_classes x where x.title = 'Live: React Hooks crash course')
limit 1;

insert into public.live_classes (tutor_id, course_id, title, description, status, starts_at, meeting_url)
select
  p.id,
  c.id,
  'Live office hours',
  'Bring questions from your current course. Tutor will go live from the tutor dashboard.',
  'scheduled',
  now() + interval '1 day',
  'https://meet.jit.si/LearnSyraDemoOfficeHours'
from public.profiles p
join public.courses c on c.tutor_id = p.id
where p.role = 'tutor'
  and not exists (select 1 from public.live_classes x where x.title = 'Live office hours')
limit 1;
