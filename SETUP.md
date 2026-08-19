# Learnsyra — Setup

This project is now a real full-stack app: **React + Vite + React Router** on the
frontend and **Supabase** (Postgres + Auth) on the backend. The AI tutor will use
**OpenAI** via a Supabase Edge Function (added in a later phase).

---

## Already running locally (auto-configured)

A **local Supabase stack** was started with Docker via `npx supabase start`, and
`.env.local` already points to it. The schema + seed data are applied and demo
accounts exist. To use the app right now:

```bash
pnpm dev        # http://localhost:8443/
```

**Demo accounts** (password for all: `password123`):

| Role    | Email               |
| ------- | ------------------- |
| Student | student@sutrra.app  |
| Tutor   | tutor@sutrra.app    |
| Admin   | admin@sutrra.app    |

Local Supabase URLs:

- API: <http://127.0.0.1:54321>
- Studio (DB browser): <http://127.0.0.1:54323>
- Mailpit (test inbox): <http://127.0.0.1:54324>

Managing the local stack:

```bash
npx supabase status     # show URLs + keys
npx supabase stop       # stop containers
npx supabase start      # start again
npx supabase db reset   # re-apply migrations + seed (wipes data + demo users)
```

> Note: `.env.local` uses the well-known local dev keys — fine for local only.
> For production, follow the hosted-project steps below instead.

---

## Hosted Supabase (for deployment)

## 1. Create a Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Once ready, open **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Restart the dev server after changing env vars.

## 3. Create the database schema

Apply **all** files in [`supabase/migrations`](supabase/migrations) **in filename order**
to the production project (`supabase db push`, or paste each file in the SQL Editor).

Do not stop at [`supabase/schema.sql`](supabase/schema.sql) — that file is only the
initial subset. Later migrations add student/tutor tables, RLS, and role protection.

`profiles.role` is enforced in the database: a signed-in student or tutor cannot
change their own role through the Data API. Signup metadata may be `student` or
`tutor` only; `admin` is ignored.

## 4. Auth settings (for quick local testing)

By default Supabase requires email confirmation. To test faster locally:

- **Authentication → Providers → Email** → turn **Confirm email** off
  (turn it back on for production).

## 5. First production admin (SQL Editor only — not in the public UI)

There is no hardcoded admin account and no public “become admin” control.

1. Sign up normally as a **student** or **tutor** (email/password).
2. In the **production** Supabase dashboard, open **SQL Editor**.
3. Run **one** of the following (replace the email). This is an authorized
   operator action, not an app feature:

```sql
select public.provision_profile_role(
  (select id from auth.users where email = 'you@example.com'),
  'admin'
);
```

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

The user must already exist in `auth.users` / `public.profiles`. Do not expose
this SQL in the client. Never put the service-role key in frontend env vars.

## 6. Run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:8443/>.

## What works now (Phase 1 — Foundation)

- Real URL routing for every page (`/`, `/courses`, `/dashboard`, `/tutor`, `/admin`, …).
- Email/password **sign up** with role selection (student / tutor) and **login / logout**.
- Session persistence and a `profiles` table with `student` / `tutor` / `admin` roles.
- **Protected routes**: `/dashboard`, `/ai-learning`, `/career` require login;
  `/tutor` requires tutor/admin; `/admin` requires admin.

## Next phases (not done yet)

- Replace mock page data with live Supabase queries (courses, enrollments, etc.).
- Real AI tutor via a Supabase Edge Function calling OpenAI (keeps the key server-side).
- Stripe subscriptions/payments.

## Deployment note

This is a single-page app using the HTML5 history API. When deploying to static
hosting, add a catch-all rewrite so unknown paths serve `index.html`
(e.g. on Render Static Sites: Rewrite rule `/*` → `/index.html`).
