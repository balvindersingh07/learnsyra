-- Step 2G-10: least-privilege table/function grants for Phase 0 objects.
-- Does not change RLS policies, table data, or function bodies.
-- Does not touch notify_user, provision_profile_role, is_admin, or is_tutor.
-- postgres / service_role keep existing privileges (including trigger EXECUTE).

-- ---------------------------------------------------------------------------
-- 1. TRUNCATE / REFERENCES / TRIGGER are unused by PostgREST and the SPA.
--    TRUNCATE ignores RLS, so it must not remain on Data API roles.
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on table
  public.profiles,
  public.courses,
  public.enrollments,
  public.projects,
  public.ai_conversations,
  public.ai_messages,
  public.course_modules,
  public.course_lessons,
  public.student_projects,
  public.tutor_listings,
  public.bookings,
  public.career_profiles,
  public.notifications,
  public.certificates,
  public.bookmarks,
  public.jobs,
  public.course_reviews,
  public.live_classes,
  public.live_class_attendance,
  public.lesson_progress
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Anon never writes. All SPA DML uses an authenticated session.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on table
  public.profiles,
  public.courses,
  public.enrollments,
  public.projects,
  public.ai_conversations,
  public.ai_messages,
  public.course_modules,
  public.course_lessons,
  public.student_projects,
  public.tutor_listings,
  public.bookings,
  public.career_profiles,
  public.notifications,
  public.certificates,
  public.bookmarks,
  public.jobs,
  public.course_reviews,
  public.live_classes,
  public.live_class_attendance,
  public.lesson_progress
from anon;

-- ---------------------------------------------------------------------------
-- 3. Anon SELECT only on the public catalog. profiles already has no anon
--    SELECT (column grants are authenticated-only). Keep SELECT on:
--    courses, course_modules, course_lessons, projects, tutor_listings,
--    course_reviews.
-- ---------------------------------------------------------------------------
revoke select on table
  public.enrollments,
  public.bookings,
  public.notifications,
  public.certificates,
  public.bookmarks,
  public.career_profiles,
  public.ai_conversations,
  public.ai_messages,
  public.lesson_progress,
  public.live_classes,
  public.live_class_attendance,
  public.student_projects,
  public.jobs
from anon;

-- ---------------------------------------------------------------------------
-- 4. Authenticated: revoke only privileges the current SPA never uses.
--    KEEP (required by src/ PostgREST calls):
--      profiles: UPDATE (column SELECT unchanged)
--      courses: SELECT, INSERT, UPDATE
--      course_modules / course_lessons: SELECT, INSERT
--      projects / tutor_listings / jobs: SELECT
--      course_reviews: SELECT, INSERT, UPDATE
--      enrollments / bookings: SELECT, INSERT, UPDATE
--      student_projects: SELECT, INSERT, UPDATE
--      notifications: SELECT, INSERT, UPDATE
--      certificates: SELECT, INSERT
--      bookmarks: SELECT, INSERT, DELETE
--      career_profiles: SELECT, INSERT, UPDATE
--      ai_conversations: SELECT, INSERT, UPDATE
--      ai_messages: SELECT, INSERT
--      live_classes: SELECT, INSERT, UPDATE
--      live_class_attendance: SELECT, INSERT, UPDATE
--      lesson_progress: SELECT, INSERT, UPDATE
-- ---------------------------------------------------------------------------
revoke insert, delete on table public.profiles from authenticated;
revoke delete on table public.courses from authenticated;
revoke update, delete on table public.course_modules, public.course_lessons from authenticated;
revoke insert, update, delete on table public.projects from authenticated;
revoke insert, update, delete on table public.tutor_listings from authenticated;
revoke insert, update, delete on table public.jobs from authenticated;
revoke delete on table public.course_reviews from authenticated;
revoke delete on table public.enrollments from authenticated;
revoke delete on table public.bookings from authenticated;
revoke delete on table public.student_projects from authenticated;
revoke delete on table public.notifications from authenticated;
revoke update, delete on table public.certificates from authenticated;
revoke update on table public.bookmarks from authenticated;
revoke delete on table public.career_profiles from authenticated;
revoke delete on table public.ai_conversations from authenticated;
revoke update, delete on table public.ai_messages from authenticated;
revoke delete on table public.live_classes from authenticated;
revoke delete on table public.live_class_attendance from authenticated;
revoke delete on table public.lesson_progress from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Trigger functions are not RPCs. Table owners / service_role keep EXECUTE
--    so attached triggers still fire.
-- ---------------------------------------------------------------------------
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

revoke all on function public.protect_profile_role() from public;
revoke all on function public.protect_profile_role() from anon;
revoke all on function public.protect_profile_role() from authenticated;

revoke all on function public.protect_enrollment_integrity() from authenticated;
revoke all on function public.protect_booking_integrity() from authenticated;
revoke all on function public.protect_course_review_integrity() from authenticated;
