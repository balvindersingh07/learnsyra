import { isSupabaseConfigured, supabase } from './supabase'

const MAX_BYTES = 5 * 1024 * 1024
const BUCKET = 'avatars'
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function formatUploadError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('bucket') && (lower.includes('not found') || lower.includes('does not exist'))) {
    return (
      'Photo storage is not configured yet. In Supabase Dashboard → Storage, create a public bucket named ' +
      `"${BUCKET}" with policies allowing authenticated users to upload/read files in their own folder (${'{userId}'}/).`
    )
  }
  if (lower.includes('row-level security') || lower.includes('policy') || lower.includes('permission')) {
    return `Photo upload blocked by storage permissions: ${message}`
  }
  if (lower.includes('payload too large') || lower.includes('file size') || lower.includes('too large')) {
    return 'Image must be under 5 MB.'
  }
  if (lower.includes('invalid') && lower.includes('mime')) {
    return 'Please choose a JPG, PNG, WebP, or GIF image.'
  }
  return message
}

function extForFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName === 'jpeg') return 'jpg'
  if (fromName && ['jpg', 'png', 'webp', 'gif'].includes(fromName)) return fromName
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

export async function uploadTutorAvatar(
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { url: null, error: 'Profile photo upload is unavailable (Supabase not configured).' }
  if (!userId) return { url: null, error: 'Not logged in.' }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { url: null, error: 'Please choose a JPG, PNG, WebP, or GIF image under 5 MB.' }
  }
  if (file.size > MAX_BYTES) return { url: null, error: 'Image must be under 5 MB.' }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) return { url: null, error: formatUploadError(sessionError.message) }
  if (!session?.user) return { url: null, error: 'Your session expired. Sign in again and retry.' }
  if (session.user.id !== userId) return { url: null, error: 'Account mismatch. Sign out and sign in again.' }

  const ext = extForFile(file)
  const path = `${session.user.id}/avatar.${ext}`

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })
  if (uploadErr) {
    console.warn('avatar upload failed', uploadErr.message)
    return { url: null, error: formatUploadError(uploadErr.message) }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const base = data.publicUrl?.trim()
  if (!base) return { url: null, error: 'Upload succeeded but the public photo URL could not be generated.' }
  return { url: `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`, error: null }
}

/** Alias for student/tutor profile photos — same bucket, path, and RLS rules. */
export const uploadProfileAvatar = uploadTutorAvatar

export async function removeProfileAvatar(userId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'Profile photo removal is unavailable (Supabase not configured).' }
  if (!userId) return { error: 'Not logged in.' }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) return { error: formatUploadError(sessionError.message) }
  if (!session?.user) return { error: 'Your session expired. Sign in again and retry.' }
  if (session.user.id !== userId) return { error: 'Account mismatch. Sign out and sign in again.' }

  const { data: files, error: listErr } = await supabase.storage.from(BUCKET).list(userId)
  if (listErr) {
    console.warn('avatar list failed', listErr.message)
    return { error: formatUploadError(listErr.message) }
  }

  const paths = (files ?? []).map(file => `${userId}/${file.name}`)
  if (paths.length) {
    const { error: removeErr } = await supabase.storage.from(BUCKET).remove(paths)
    if (removeErr) {
      console.warn('avatar remove failed', removeErr.message)
      return { error: formatUploadError(removeErr.message) }
    }
  }

  return { error: null }
}
