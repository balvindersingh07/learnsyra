import { isSupabaseConfigured, supabase } from './supabase'

const BUCKET = 'avatars'
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_DIMENSION = 1024
const SKIP_PREP_MAX_BYTES = 512 * 1024
const JPEG_WEBP_QUALITY = 0.85

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
    return 'Upload failed. The image could not be stored. Try choosing a different photo.'
  }
  if (lower.includes('invalid') && lower.includes('mime')) {
    return 'Please choose a JPG, PNG, WebP, or GIF image.'
  }
  return message
}

function isAllowedAvatarType(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp' || ext === 'gif'
}

function mimeFromFile(file: File): string {
  if (ALLOWED_TYPES.has(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

function extForFile(file: File): string {
  return extForMime(mimeFromFile(file))
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(
      blob => resolve(blob),
      type,
      type === 'image/jpeg' || type === 'image/webp' ? JPEG_WEBP_QUALITY : undefined,
    )
  })
}

async function prepareAvatarForUpload(file: File): Promise<{ file: File; error: null } | { file: null; error: string }> {
  if (!isAllowedAvatarType(file)) {
    return { file: null, error: 'Please choose a JPG, PNG, WebP, or GIF image.' }
  }

  const outputMime = mimeFromFile(file) === 'image/gif' ? 'image/jpeg' : mimeFromFile(file)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { file: null, error: 'Could not read this image. Try a different JPG, PNG, or WebP file.' }
  }

  const maxSide = Math.max(bitmap.width, bitmap.height)
  const needsResize = maxSide > MAX_DIMENSION
  const needsCompress = file.size > SKIP_PREP_MAX_BYTES || needsResize

  if (!needsCompress) {
    bitmap.close()
    return { file, error: null }
  }

  const scale = needsResize ? MAX_DIMENSION / maxSide : 1
  const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale))

  let source = bitmap
  if (needsResize) {
    try {
      source = await createImageBitmap(bitmap, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: 'high',
      })
      bitmap.close()
    } catch {
      bitmap.close()
      return { file: null, error: 'Could not process this image. Try a different photo.' }
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    source.close()
    return { file: null, error: 'Could not process this image. Try a different photo.' }
  }

  ctx.drawImage(source, 0, 0)
  source.close()

  const blob = await canvasToBlob(canvas, outputMime)
  if (!blob) {
    return { file: null, error: 'Could not process this image. Try a different photo.' }
  }

  const ext = extForMime(outputMime)
  const prepared = new File([blob], `avatar.${ext}`, { type: outputMime, lastModified: Date.now() })
  return { file: prepared, error: null }
}

export async function uploadTutorAvatar(
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { url: null, error: 'Profile photo upload is unavailable (Supabase not configured).' }
  if (!userId) return { url: null, error: 'Not logged in.' }

  const prepared = await prepareAvatarForUpload(file)
  if (prepared.error || !prepared.file) {
    return { url: null, error: prepared.error }
  }
  const uploadFile = prepared.file

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) return { url: null, error: formatUploadError(sessionError.message) }
  if (!session?.user) return { url: null, error: 'Your session expired. Sign in again and retry.' }
  if (session.user.id !== userId) return { url: null, error: 'Account mismatch. Sign out and sign in again.' }

  const ext = extForFile(uploadFile)
  const path = `${session.user.id}/avatar.${ext}`

  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, uploadFile, {
    upsert: true,
    contentType: uploadFile.type,
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
