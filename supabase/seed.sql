-- Demo data for local development. Runs on `supabase start` / `supabase db reset`.
-- Courses here have tutor_id = null (public catalog). Enrollments are created
-- per-user at runtime once someone logs in.

insert into public.courses (title, description, category, level, price_cents, is_premium, rating, published)
values
  ('Full Stack Web Development Bootcamp', 'Build production web apps with React, Node.js and PostgreSQL.', 'Programming', 'Beginner', 8900, true, 4.9, true),
  ('Machine Learning A-Z with Python', 'From regression to neural networks, hands-on with Python.', 'AI & ML', 'Intermediate', 7900, true, 4.8, true),
  ('Data Analytics with Python', 'Pandas, visualization and real datasets.', 'Data Analytics', 'Beginner', 0, false, 4.7, true),
  ('Business Analytics Fundamentals', 'Turn data into business decisions and dashboards.', 'Business', 'Beginner', 5900, true, 4.6, true),
  ('English Communication Mastery', 'Speak and write with confidence for the workplace.', 'English', 'Beginner', 0, false, 4.8, true),
  ('Career Skills: Land Your Dream Job', 'Resume, interviews and job search strategy.', 'Career Skills', 'Beginner', 4900, true, 4.9, true)
on conflict do nothing;

insert into public.projects (title, description, difficulty, skills)
values
  ('Build an E-commerce Website', 'Design and develop a full online store with cart, payments and admin dashboard.', 'Intermediate', array['React','Node.js','Stripe API','PostgreSQL']),
  ('Python Data Analysis Project', 'Analyze a real dataset and present insights with visualizations.', 'Beginner', array['Python','Pandas','Matplotlib','Seaborn']),
  ('React Analytics Dashboard', 'Responsive admin dashboard with charts, auth and a REST API.', 'Advanced', array['React','TypeScript','Charts','REST'])
on conflict do nothing;
