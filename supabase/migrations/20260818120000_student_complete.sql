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

-- Seed curriculum for existing courses (idempotent-ish)
insert into public.course_modules (course_id, title, sort_order)
select c.id, m.title, m.ord
from public.courses c
cross join (values
  (1, 'Module 1: Foundations'),
  (2, 'Module 2: Core Skills'),
  (3, 'Module 3: Projects & Career')
) as m(ord, title)
where not exists (select 1 from public.course_modules cm where cm.course_id = c.id);

insert into public.course_lessons (module_id, title, lesson_type, duration_min, sort_order, is_free)
select cm.id, l.title, l.typ, l.dur, l.ord, l.free
from public.course_modules cm
join public.courses c on c.id = cm.course_id
cross join lateral (
  select * from (values
    (1, 'Welcome & overview', 'video', 12, true),
    (2, 'Core concepts explained', 'video', 28, cm.sort_order = 1),
    (3, 'Hands-on practice', 'project', 45, false),
    (4, 'Knowledge check', 'quiz', 15, false)
  ) as x(ord, title, typ, dur, free)
) l
where not exists (select 1 from public.course_lessons cl where cl.module_id = cm.id);

insert into public.tutor_listings (name, expertise, intro, subject, tags, hourly_rate_cents, rating, reviews, students_taught, available, image_key)
select * from (values
  ('Dr. Sarah Kim', 'Full Stack Development · React · Node.js', 'Ex-Google engineer. I make complex concepts simple.', 'Programming', array['React','Node.js','TypeScript'], 6500, 4.98, 342, 1840, true, 'photo-1494790108755-2616b612b786'),
  ('Prof. James Wright', 'Machine Learning · Python · Data Science', 'PhD CS. Helped 2000+ students break into data careers.', 'Data Science', array['Python','TensorFlow','SQL'], 8000, 4.95, 289, 2100, true, 'photo-1472099645785-5658abf4ff4e'),
  ('Emma Clarke', 'Business English · Communication', '8 years teaching executives at Fortune 500 companies.', 'English', array['Business English','Presentation'], 4500, 4.92, 198, 890, false, 'photo-1438761681033-6461ffad8d80'),
  ('Ravi Patel', 'Finance · MBA · Business Analytics', 'Former banker. I simplify finance and MBA cases.', 'Business', array['Finance','Excel','MBA'], 5500, 4.88, 156, 670, true, 'photo-1507003211169-0a1dd7228f2d'),
  ('Priya Sharma', 'iOS · Swift · Mobile Design', 'Shipped apps used by millions. Patient iOS mentor.', 'Programming', array['Swift','SwiftUI','iOS'], 7000, 4.91, 112, 445, true, 'photo-1534528741775-53994a69daeb'),
  ('Carlos Rivera', 'Career Coaching · Resume · Interviews', 'Ex-FAANG recruiter. I help you tell your story.', 'Career', array['Resume','Interviews','LinkedIn'], 5000, 4.96, 420, 2100, true, 'photo-1506794778202-cad84cf45f1d')
) as v(name, expertise, intro, subject, tags, hourly_rate_cents, rating, reviews, students_taught, available, image_key)
where not exists (select 1 from public.tutor_listings t where t.name = v.name);
