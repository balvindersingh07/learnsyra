import { logAdminAuditEvent } from './adminAudit'
import { notifyUser, setCoursePublished, setUserRole } from './api'
import { isSupabaseConfigured, supabase } from './supabase'

export type ModerationResult = { ok: boolean; message: string }

export function isModerationBackendAvailable() {
  return isSupabaseConfigured
}

export async function assertAdminActor(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'Supabase is not configured.' }
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const uid = authData.user?.id
  if (authError || !uid) return { ok: false, message: 'You must be signed in as an admin.' }
  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (error || profile?.role !== 'admin') return { ok: false, message: 'Admin access required.' }
  return { ok: true, userId: uid }
}

async function listingIdForProfile(profileId: string): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.from('tutor_listings').select('id').eq('profile_id', profileId).maybeSingle()
  if (error) return { id: null, error: error.message }
  return { id: data?.id ?? null, error: null }
}

export async function adminSetTutorListingAvailable(
  profileId: string,
  available: boolean,
  notify?: { title: string; body: string; href?: string },
): Promise<ModerationResult> {
  const gate = await assertAdminActor()
  if (!gate.ok) return { ok: false, message: gate.message }
  const found = await listingIdForProfile(profileId)
  if (found.error) return { ok: false, message: found.error }
  if (!found.id) {
    return { ok: false, message: 'No marketplace listing exists for this tutor yet.' }
  }
  const { data: before, error: readErr } = await supabase
    .from('tutor_listings')
    .select('available, name')
    .eq('id', found.id)
    .maybeSingle()
  if (readErr) return { ok: false, message: readErr.message }

  const { error } = await supabase.from('tutor_listings').update({ available }).eq('id', found.id)
  if (error) return { ok: false, message: error.message }

  await logAdminAuditEvent({
    action: available ? 'tutor.listing.approve' : 'tutor.listing.hide',
    entityType: 'tutor',
    entityId: profileId,
    entityName: typeof before?.name === 'string' ? before.name : profileId,
    description: available
      ? 'Tutor listing approved and marked available in the marketplace.'
      : 'Tutor listing hidden from the marketplace.',
    oldStatus: before?.available == null ? null : before.available ? 'available' : 'hidden',
    newStatus: available ? 'available' : 'hidden',
    changedField: 'available',
  })

  if (notify) {
    await notifyUser(profileId, notify.title, notify.body, notify.href, {
      emailEvent: 'moderation',
      idempotencyKey: `moderation:tutor:${profileId}:${available ? 'approved' : 'hidden'}`,
    }).catch(() => {})
  }
  return {
    ok: true,
    message: available
      ? 'Tutor listing approved and marked available in the marketplace.'
      : 'Tutor listing hidden from the marketplace.',
  }
}

export async function adminApproveTutor(profileId: string): Promise<ModerationResult> {
  return adminSetTutorListingAvailable(profileId, true, {
    title: 'Tutor profile approved',
    body: 'Your tutor listing is now visible in the marketplace.',
    href: '/tutor/account',
  })
}

export async function adminRejectTutor(profileId: string): Promise<ModerationResult> {
  return adminSetTutorListingAvailable(profileId, false, {
    title: 'Tutor verification update',
    body: 'Your tutor listing was not approved. Review your profile and try again.',
    href: '/tutor/account',
  })
}

export async function adminSuspendTutor(profileId: string): Promise<ModerationResult> {
  return adminSetTutorListingAvailable(profileId, false, {
    title: 'Marketplace listing suspended',
    body: 'Your tutor listing was suspended by an administrator.',
    href: '/tutor/account',
  })
}

export async function adminModerateCourse(
  courseId: string,
  action: 'approve' | 'reject' | 'unpublish',
  tutorId?: string | null,
): Promise<ModerationResult> {
  const gate = await assertAdminActor()
  if (!gate.ok) return { ok: false, message: gate.message }
  const published = action === 'approve'
  const { data: before, error: readErr } = await supabase
    .from('courses')
    .select('title, published')
    .eq('id', courseId)
    .maybeSingle()
  if (readErr) return { ok: false, message: readErr.message }

  const { error } = await setCoursePublished(courseId, published)
  if (error) return { ok: false, message: error }

  await logAdminAuditEvent({
    action: published ? 'course.publish' : action === 'unpublish' ? 'course.unpublish' : 'course.reject',
    entityType: 'course',
    entityId: courseId,
    entityName: typeof before?.title === 'string' ? before.title : courseId,
    description: published
      ? 'Course published to the catalog.'
      : 'Course removed from the public catalog.',
    oldStatus: before?.published == null ? null : before.published ? 'published' : 'unpublished',
    newStatus: published ? 'published' : 'unpublished',
    changedField: 'published',
  })

  if (tutorId) {
    const title = published ? 'Course approved' : action === 'unpublish' ? 'Course unpublished' : 'Course not approved'
    const body = published
      ? 'An administrator approved your course for the catalog.'
      : 'An administrator removed your course from the public catalog.'
    await notifyUser(tutorId, title, body, '/tutor/courses', {
      emailEvent: 'moderation',
      idempotencyKey: `moderation:course:${courseId}:${published ? 'approved' : 'rejected'}`,
    }).catch(() => {})
  }
  return {
    ok: true,
    message: published
      ? 'Course published to the catalog.'
      : 'Course unpublished. Enrollments and progress are preserved.',
  }
}

function invokeFunctionError(data: unknown, error: { message: string } | null): string | null {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: unknown }).error
    if (typeof message === 'string' && message.trim()) return message
  }
  return error?.message ?? null
}

export async function adminDeleteUser(userId: string): Promise<ModerationResult> {
  const gate = await assertAdminActor()
  if (!gate.ok) return { ok: false, message: gate.message }
  if (gate.userId === userId) {
    return { ok: false, message: 'You cannot delete your own account.' }
  }

  const { data, error } = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  })
  const message = invokeFunctionError(data, error)
  if (message) return { ok: false, message }
  if (!data || typeof data !== 'object' || !('ok' in data) || !(data as { ok?: boolean }).ok) {
    return { ok: false, message: 'Could not delete user.' }
  }
  return { ok: true, message: 'User account deleted.' }
}

export async function adminChangeUserRole(
  userId: string,
  role: 'student' | 'tutor' | 'admin',
): Promise<ModerationResult> {
  const gate = await assertAdminActor()
  if (!gate.ok) return { ok: false, message: gate.message }
  if (userId === gate.userId && role !== 'admin') {
    return { ok: false, message: 'You cannot remove your own admin access.' }
  }
  const { data: before, error: readErr } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (readErr) return { ok: false, message: readErr.message }

  const { error } = await setUserRole(userId, role)
  if (error) return { ok: false, message: error }

  await logAdminAuditEvent({
    action: 'user.role.change',
    entityType: 'user',
    entityId: userId,
    entityName: typeof before?.full_name === 'string' ? before.full_name : userId,
    description: `Account role updated to ${role}.`,
    oldStatus: typeof before?.role === 'string' ? before.role : null,
    newStatus: role,
    changedField: 'role',
  })

  await notifyUser(userId, 'Account role updated', `Your account role is now ${role}.`, '/profile', {
    emailEvent: 'account',
    idempotencyKey: `account:role:${userId}:${role}`,
  }).catch(() => {})
  return { ok: true, message: `Role updated to ${role}.` }
}
