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

## Production authentication (learnsyra.com)

Configure these in the **hosted Supabase dashboard** before go-live. The app code
already uses the routes and redirect URLs below; dashboard settings must match.

### Site URL

**Authentication → URL Configuration → Site URL**

```
https://learnsyra.com
```

### Redirect URLs

Add every URL Supabase Auth may redirect to after sign-in, sign-up, password
reset, or email confirmation:

```
https://learnsyra.com/login
https://learnsyra.com/reset-password
https://learnsyra.com/verify-email
http://localhost:8443/login
http://localhost:8443/reset-password
http://localhost:8443/verify-email
```

(Local URLs are for development; remove them from production-only projects if
you prefer a tighter allow-list.)

### Confirm email

**Authentication → Providers → Email**

- Turn **Confirm email** **ON** for production.
- Unverified users are blocked from protected app routes in production builds
  (`import.meta.env.PROD`). They are sent to `/verify-email`.

For faster local testing, leave confirm email **OFF** on the local stack only.

### Google OAuth (optional)

**Authentication → Providers → Google**

1. Create OAuth credentials in Google Cloud Console.
2. Add the Supabase callback URL shown in the dashboard.
3. Paste Client ID and Client Secret into Supabase.

**Important:** Google sign-in always creates a **student** profile (database
trigger). **Tutor registration** must use email/password signup so the tutor
role is set securely at registration. There is no client-side admin or tutor
role escalation.

### Email templates

Under **Authentication → Email Templates**, review:

- **Confirm signup** — link should land on `/verify-email`
- **Reset password** — link should land on `/reset-password`
- **Magic link** (if enabled)

The app sets `emailRedirectTo` / `redirectTo` in code to
`https://learnsyra.com/...` in production builds.

### First production admin (SQL Editor only — not in the public UI)

There is no hardcoded admin account and no public “become admin” control.

1. Sign up normally as a **student** or **tutor** (email/password) and confirm email.
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

---

## 4. Run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:8443/>.

## What works now (Phase 1 — Foundation)

- Real URL routing for every page (`/`, `/courses`, `/dashboard`, `/tutor`, `/admin`, …).
- Email/password **sign up** with role selection (student / tutor) and **login / logout**.
- **Password reset** (`/reset-password`) and **email verification** (`/verify-email`) flows.
- Session persistence and a `profiles` table with `student` / `tutor` / `admin` roles.
- **Protected routes**: student, tutor, and admin workspaces require login; production
  builds also require a verified email (`email_confirmed_at`).

## Next phases (not done yet)

- Replace mock page data with live Supabase queries (courses, enrollments, etc.).
- Real AI tutor via a Supabase Edge Function calling OpenAI (keeps the key server-side).
- Stripe subscriptions for worldwide payments (legacy functions kept; India uses Razorpay).

## Payments (India — Razorpay Subscriptions)

Active checkout uses **Razorpay Subscriptions** in **INR** (monthly recurring).
Plan prices are defined server-side in `supabase/functions/_shared/razorpay.ts`:

- Student Pro — **₹399/month**
- Career Pro — **₹799/month**

The browser never sets `profiles.plan`. Paid entitlements are granted only after
trusted subscription activation (`verify-razorpay-payment` or verified
`razorpay-webhook` events). Access is revoked when subscriptions become halted,
cancelled (immediate), completed, or paused.

### Supabase Edge Function secrets (Dashboard → Edge Functions → Secrets)

| Secret | Used by |
| --- | --- |
| `RAZORPAY_KEY_ID` | `create-razorpay-order` (returned to Checkout as public key) |
| `RAZORPAY_KEY_SECRET` | `create-razorpay-order`, `verify-razorpay-payment` |
| `RAZORPAY_WEBHOOK_SECRET` | `razorpay-webhook` |
| `RAZORPAY_PLAN_ID_STUDENT_PRO` | `create-razorpay-order` (Razorpay Plan ID for ₹399/month) |
| `RAZORPAY_PLAN_ID_CAREER_PRO` | `create-razorpay-order` (Razorpay Plan ID for ₹799/month) |
| `STRIPE_SECRET_KEY` | `create-checkout` (deferred worldwide) |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` (deferred worldwide) |

Never put Razorpay or Stripe secrets in `VITE_*` frontend variables.

### Deploy Edge Functions

```bash
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy razorpay-webhook
# Legacy Stripe (optional until worldwide launch):
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

### Apply migrations

```bash
supabase db push
```

Required migrations include `20260821100000_protect_profile_plan.sql`,
`20260822100000_razorpay_payments.sql`, and `20260822110000_razorpay_subscriptions.sql`.

### Razorpay Dashboard configuration

1. Create a Razorpay account and enable **UPI**, **Cards**, and **Netbanking**.
2. Create two **Subscription Plans** (monthly, INR):
   - Student Pro — ₹399/month → copy Plan ID to `RAZORPAY_PLAN_ID_STUDENT_PRO`
   - Career Pro — ₹799/month → copy Plan ID to `RAZORPAY_PLAN_ID_CAREER_PRO`
3. Copy **Key ID** and **Key Secret** into Supabase secrets.
4. Add a webhook endpoint:
   `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`
5. Subscribe to subscription lifecycle events:
   - `subscription.authenticated`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.pending`
   - `subscription.halted`
   - `subscription.cancelled`
   - `subscription.completed`
   - `subscription.paused`
   - `payment.failed`
6. Copy the webhook **secret** into `RAZORPAY_WEBHOOK_SECRET`.

## Deployment note

This is a single-page app using the HTML5 history API. When deploying to static
hosting, add a catch-all rewrite so unknown paths serve `index.html`
(e.g. on Render Static Sites: Rewrite rule `/*` → `/index.html`).
