-- Learnsyra — database schema
-- Run this in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- Safe to re-run: uses "if not exists" / "or replace" where possible.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('student', 'tutor', 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        user_role not null default 'student',
  avatar_url  text,
  headline    text,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id            uuid primary key default gen_random_uuid(),
  tutor_id      uuid references public.profiles (id) on delete set null,
  title         text not null,
  description   text,
  category      text,
  level         text,
  price_cents   integer not null default 0,
  is_premium    boolean not null default false,
  rating        numeric(3,2) not null default 0,
  thumbnail_url text,
  published     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Enrollments (student <-> course)
-- ---------------------------------------------------------------------------
create table if not exists public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete cascade,
  progress     integer not null default 0,
  enrolled_at  timestamptz not null default now(),
  unique (student_id, course_id)
);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  difficulty   text,
  skills       text[] default '{}',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI tutor conversations (used later by the AI feature)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'system')),
  content          text not null,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a new auth user signs up.
-- Role + full_name are read from sign-up metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.courses         enable row level security;
alter table public.enrollments     enable row level security;
alter table public.projects        enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages     enable row level security;

-- Profiles: everyone can read; users edit their own; admins do anything.
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- Courses: published courses are public; tutors manage their own; admins all.
drop policy if exists "courses read" on public.courses;
create policy "courses read" on public.courses
  for select using (published or tutor_id = auth.uid() or public.is_admin());

drop policy if exists "courses insert own" on public.courses;
create policy "courses insert own" on public.courses
  for insert with check (tutor_id = auth.uid() or public.is_admin());

drop policy if exists "courses update own" on public.courses;
create policy "courses update own" on public.courses
  for update using (tutor_id = auth.uid() or public.is_admin());

-- Enrollments: a student sees/creates their own; admins see all.
drop policy if exists "enrollments read own" on public.enrollments;
create policy "enrollments read own" on public.enrollments
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists "enrollments insert own" on public.enrollments;
create policy "enrollments insert own" on public.enrollments
  for insert with check (student_id = auth.uid());

drop policy if exists "enrollments update own" on public.enrollments;
create policy "enrollments update own" on public.enrollments
  for update using (student_id = auth.uid());

-- Projects: readable by everyone; only admins write.
drop policy if exists "projects read" on public.projects;
create policy "projects read" on public.projects
  for select using (true);

drop policy if exists "projects admin write" on public.projects;
create policy "projects admin write" on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

-- AI conversations + messages: private to their owner.
drop policy if exists "ai conv own" on public.ai_conversations;
create policy "ai conv own" on public.ai_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "ai msg own" on public.ai_messages;
create policy "ai msg own" on public.ai_messages
  for all using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Table-level grants for the Data API roles. RLS (above) still governs which
-- rows each role can actually see or modify; these grants only expose the
-- tables through PostgREST.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

grant select on public.courses to anon, authenticated;
grant insert, update on public.courses to authenticated;

grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

grant select, insert, update, delete on public.enrollments to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
