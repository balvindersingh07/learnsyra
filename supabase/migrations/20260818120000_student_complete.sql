-- Student platform: curriculum, progress, projects, bookings, career, notifs, certs, bookmarks, plans

alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.enrollments
  add column if not exists last_lesson_id uuid;

create table if not exists public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null,
  sort_order  integer not null default 0
);

create table if not exists public.course_lessons (
  id            uuid primary key default gen_random_uuid(),
  module_id     uuid not null references public.course_modules (id) on delete cascade,
  title         text not null,
  lesson_type   text not null default 'video' check (lesson_type in ('video', 'quiz', 'project')),
  duration_min  integer not null default 15,
  sort_order    integer not null default 0,
  is_free       boolean not null default false
);

alter table public.enrollments
  drop constraint if exists enrollments_last_lesson_id_fkey;
alter table public.enrollments
  add constraint enrollments_last_lesson_id_fkey
  foreign key (last_lesson_id) references public.course_lessons (id) on delete set null;

create table if not exists public.lesson_progress (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles (id) on delete cascade,
  lesson_id      uuid not null references public.course_lessons (id) on delete cascade,
  completed_at   timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create table if not exists public.student_projects (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  status          text not null default 'started' check (status in ('started', 'submitted', 'completed')),
  submission_url  text,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (student_id, project_id)
);

create table if not exists public.tutor_listings (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid references public.profiles (id) on delete set null,
  name               text not null,
  expertise          text,
  intro              text,
  subject            text,
  tags               text[] default '{}',
  hourly_rate_cents  integer not null default 5000,
  rating             numeric(3,2) not null default 4.8,
  reviews            integer not null default 0,
  students_taught    integer not null default 0,
  available          boolean not null default true,
  image_key          text,
  created_at         timestamptz not null default now()
);

create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.profiles (id) on delete cascade,
  tutor_listing_id  uuid not null references public.tutor_listings (id) on delete cascade,
  message           text,
  status            text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at        timestamptz not null default now()
);

create table if not exists public.career_profiles (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  readiness_score   integer not null default 40,
  target_role       text,
  resume_text       text,
  skills            text[] default '{}',
  updated_at        timestamptz not null default now()
);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  body        text,
  href        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.certificates (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid references public.courses (id) on delete cascade,
  project_id  uuid references public.projects (id) on delete cascade,
  title       text not null,
  issued_at   timestamptz not null default now()
);

create table if not exists public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid references public.courses (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (student_id, course_id)
);

-- RLS
alter table public.course_modules    enable row level security;
alter table public.course_lessons    enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.student_projects  enable row level security;
alter table public.tutor_listings    enable row level security;
alter table public.bookings          enable row level security;
alter table public.career_profiles   enable row level security;
alter table public.notifications     enable row level security;
alter table public.certificates      enable row level security;
alter table public.bookmarks         enable row level security;

drop policy if exists "modules read" on public.course_modules;
create policy "modules read" on public.course_modules for select using (true);

drop policy if exists "lessons read" on public.course_lessons;
create policy "lessons read" on public.course_lessons for select using (true);

drop policy if exists "progress own" on public.lesson_progress;
create policy "progress own" on public.lesson_progress
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "student projects own" on public.student_projects;
create policy "student projects own" on public.student_projects
  for all using (student_id = auth.uid() or public.is_admin()) with check (student_id = auth.uid());

drop policy if exists "listings read" on public.tutor_listings;
create policy "listings read" on public.tutor_listings for select using (true);

drop policy if exists "bookings own" on public.bookings;
create policy "bookings own" on public.bookings
  for all using (student_id = auth.uid() or public.is_admin()) with check (student_id = auth.uid());

drop policy if exists "career own" on public.career_profiles;
create policy "career own" on public.career_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifs own" on public.notifications;
create policy "notifs own" on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "certs own" on public.certificates;
create policy "certs own" on public.certificates
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists "certs insert own" on public.certificates;
create policy "certs insert own" on public.certificates
  for insert with check (student_id = auth.uid());

drop policy if exists "bookmarks own" on public.bookmarks;
create policy "bookmarks own" on public.bookmarks
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

grant select on public.course_modules, public.course_lessons, public.tutor_listings to anon, authenticated;
grant select, insert, update, delete on public.lesson_progress, public.student_projects, public.bookings,
  public.career_profiles, public.notifications, public.bookmarks to authenticated;
grant select, insert on public.certificates to authenticated;
