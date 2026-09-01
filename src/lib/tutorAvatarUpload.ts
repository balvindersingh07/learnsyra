import { isSupabaseConfigured, supabase } from './supabase'

const MAX_BYTES = 5 * 1024 * 1024

export async function uploadTutorAvatar(
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { url: null, error: 'Profile photo upload is unavailable.' }
  if (!userId) return { url: null, error: 'Not logged in.' }
  if (!file.type.startsWith('image/')) return { url: null, error: 'Please choose an image file (JPG, PNG, or WebP).' }
  if (file.size > MAX_BYTES) return { url: null, error: 'Image must be under 5 MB.' }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${userId}/avatar.${ext}`

  const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })
  if (uploadErr) {
    console.warn('avatar upload failed', uploadErr.message)
    return { url: null, error: 'Could not upload photo. Try again or paste an image URL.' }
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return { url: data.publicUrl || null, error: data.publicUrl ? null : 'Could not upload photo. Try again.' }
}
