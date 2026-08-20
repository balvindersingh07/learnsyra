-- Restrict client SELECT on public.profiles to columns the app actually reads.
-- Does not change RLS row policies. Does not change INSERT/UPDATE/DELETE grants.
-- service_role keeps existing table-level access.

revoke select on table public.profiles from anon, authenticated;

grant select (
  id,
  full_name,
  avatar_url,
  headline,
  role,
  plan,
  created_at
) on public.profiles to authenticated;
