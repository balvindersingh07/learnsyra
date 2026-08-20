-- Require is_tutor() (or admin) for courses UPDATE and tutor_listings
-- UPDATE/DELETE so leftover student-owned rows cannot be modified.
-- SELECT and INSERT policies are unchanged. Courses DELETE stays denied.

drop policy if exists "courses update own" on public.courses;

create policy "courses update own"
on public.courses
for update
using (
  (tutor_id = auth.uid() and public.is_tutor())
  or public.is_admin()
)
with check (
  (tutor_id = auth.uid() and public.is_tutor())
  or public.is_admin()
);

drop policy if exists "listings update own" on public.tutor_listings;

create policy "listings update own"
on public.tutor_listings
for update
using (
  (profile_id = auth.uid() and public.is_tutor())
  or public.is_admin()
)
with check (
  (profile_id = auth.uid() and public.is_tutor())
  or public.is_admin()
);

drop policy if exists "listings delete own" on public.tutor_listings;

create policy "listings delete own"
on public.tutor_listings
for delete
using (
  (profile_id = auth.uid() and public.is_tutor())
  or public.is_admin()
);
