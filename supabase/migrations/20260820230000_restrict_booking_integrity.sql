-- Split bookings FOR ALL into role-specific policies.
-- Students insert pending bookings for themselves only.
-- Students cannot update (no student cancel/confirm UI).
-- Tutors update status on their own listing; cannot insert for others.
-- Admin can update any booking status (cancelAdminBooking).
-- student_id and tutor_listing_id are frozen after insert.
-- No DELETE policy: the product never deletes bookings.

-- ---------------------------------------------------------------------------
-- Identity freeze: RLS cannot compare OLD vs NEW.
-- ---------------------------------------------------------------------------
create or replace function public.protect_booking_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.student_id := old.student_id;
  new.tutor_listing_id := old.tutor_listing_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_protect_booking_integrity on public.bookings;
create trigger trg_protect_booking_integrity
  before update on public.bookings
  for each row
  execute function public.protect_booking_integrity();

revoke all on function public.protect_booking_integrity() from public;
revoke all on function public.protect_booking_integrity() from anon;
grant execute on function public.protect_booking_integrity() to authenticated;

-- ---------------------------------------------------------------------------
-- Replace the broad FOR ALL policy.
-- ---------------------------------------------------------------------------
drop policy if exists "bookings own" on public.bookings;

create policy "bookings select own"
on public.bookings
for select
using (student_id = auth.uid());

create policy "bookings select listing"
on public.bookings
for select
using (
  exists (
    select 1
    from public.tutor_listings t
    where t.id = tutor_listing_id
      and t.profile_id = auth.uid()
  )
);

create policy "bookings select admin"
on public.bookings
for select
using (public.is_admin());

create policy "bookings insert student"
on public.bookings
for insert
with check (
  student_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1
    from public.tutor_listings t
    where t.id = tutor_listing_id
  )
);

-- Tutor UI: pending → confirmed | cancelled; confirmed → completed.
create policy "bookings update listing"
on public.bookings
for update
using (
  exists (
    select 1
    from public.tutor_listings t
    where t.id = tutor_listing_id
      and t.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tutor_listings t
    where t.id = tutor_listing_id
      and t.profile_id = auth.uid()
  )
  and status in ('confirmed', 'cancelled', 'completed')
);

-- Admin UI: cancelAdminBooking → cancelled via setBookingStatus.
create policy "bookings update admin"
on public.bookings
for update
using (public.is_admin())
with check (public.is_admin());
