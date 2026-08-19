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

update public.course_lessons
set body = coalesce(body, format(
  E'This lesson is **%s**.\n\nWhat you will do:\n1. Understand the idea in plain language.\n2. See a short example you can reuse.\n3. Try one practice step before the next lesson.\n\nTip: if you get stuck, open AI Tutor and paste this lesson title.',
  title
)),
video_url = coalesce(video_url, case sort_order % 4
  when 1 then 'https://www.youtube.com/embed/pQN-pnXPaVg'
  when 2 then 'https://www.youtube.com/embed/PkZNo7MFNFg'
  when 3 then 'https://www.youtube.com/embed/Ke90Tje7VS0'
  else 'https://www.youtube.com/embed/W6NZfCO5SIk'
end)
where lesson_type = 'video';

update public.course_lessons
set body = coalesce(body, format(
  'Hands-on: %s. Build a small version, then submit a GitHub or demo link from the Projects page so a tutor can review it.',
  title
))
where lesson_type = 'project';

update public.course_lessons
set body = coalesce(body, format('Knowledge check for: %s. Score at least 2 of 3 to complete.', title)),
    quiz = coalesce(quiz, jsonb_build_object(
      'pass', 2,
      'questions', jsonb_build_array(
        jsonb_build_object(
          'q', format('What is the main goal of "%s"?', title),
          'options', jsonb_build_array('Memorize syntax only', 'Apply the idea in a real task', 'Skip practice', 'Avoid asking questions'),
          'answer', 1
        ),
        jsonb_build_object(
          'q', 'When you are stuck, what should you do first?',
          'options', jsonb_build_array('Quit the course', 'Ask AI Tutor or rewatch the lesson', 'Ignore errors', 'Delete your project'),
          'answer', 1
        ),
        jsonb_build_object(
          'q', 'How do you prove you learned it?',
          'options', jsonb_build_array('Watch only', 'Build or quiz, then mark complete', 'Never open Projects', 'Skip reviews'),
          'answer', 1
        )
      )
    ))
where lesson_type = 'quiz';

insert into public.jobs (title, company, location, salary, logo, tags, apply_url)
select * from (values
  ('Frontend Developer', 'Stripe', 'Remote', '$120–150k', '💳', array['React','TypeScript','CSS'], 'https://stripe.com/jobs'),
  ('Full Stack Engineer', 'Notion', 'San Francisco', '$130–160k', '📝', array['React','Node.js','PostgreSQL'], 'https://notion.so'),
  ('React Developer', 'Linear', 'Remote', '$100–130k', '⚡', array['React','TypeScript'], 'https://linear.app'),
  ('Software Engineer', 'Vercel', 'Remote', '$110–140k', '▲', array['React','Next.js','TypeScript'], 'https://vercel.com/careers'),
  ('Data Analyst', 'Meta', 'Remote', '$95–125k', '📊', array['Python','SQL','Statistics'], 'https://metacareers.com'),
  ('ML Engineer', 'OpenAI', 'San Francisco', '$160–220k', '🤖', array['Python','TensorFlow','SQL'], 'https://openai.com/careers')
) as v(title, company, location, salary, logo, tags, apply_url)
where not exists (select 1 from public.jobs j where j.title = v.title and j.company = v.company);

insert into public.course_reviews (course_id, student_id, rating, body)
select c.id, p.id, 5, 'Clear lessons and progress actually saves. Great for getting started.'
from public.courses c
cross join public.profiles p
where p.role = 'student'
  and not exists (select 1 from public.course_reviews r where r.course_id = c.id and r.student_id = p.id)
limit 8;
