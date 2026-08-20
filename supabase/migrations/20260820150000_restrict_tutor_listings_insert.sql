-- Restrict tutor listing INSERT to tutors (own profile_id) and admins.
-- Students must not be able to create a listing by setting profile_id = auth.uid().
-- UPDATE/DELETE remain own-profile or admin. SELECT policy is unchanged.

drop policy if exists "listings write own" on public.tutor_listings;

create policy "listings insert own"
on public.tutor_listings
for insert
with check (
  (profile_id = auth.uid() and public.is_tutor())
  or public.is_admin()
);

create policy "listings update own"
on public.tutor_listings
for update
using (
  profile_id = auth.uid()
  or public.is_admin()
)
with check (
  profile_id = auth.uid()
  or public.is_admin()
);

create policy "listings delete own"
on public.tutor_listings
for delete
using (
  profile_id = auth.uid()
  or public.is_admin()
);
