import { useRef, useState } from 'react'
import { uploadProfileAvatar } from '../../../lib/tutorAvatarUpload'

export default function ResumePhotoUpload({
  userId,
  photoUrl,
  usePhoto,
  onChange,
}: {
  userId: string
  photoUrl?: string | null
  usePhoto?: boolean
  onChange: (next: { photoUrl: string | null; usePhoto: boolean }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (file: File) => {
    setBusy(true)
    setError(null)
    const { url, error: uploadError } = await uploadProfileAvatar(userId, file)
    setBusy(false)
    if (uploadError || !url) {
      setError(uploadError || 'Could not upload photo.')
      return
    }
    onChange({ photoUrl: url, usePhoto: true })
  }

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted uppercase mb-2">Profile Photo (optional)</p>
      <div className="flex items-center gap-3">
        <div
          className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-sm font-bold"
          style={{ border: '2px solid rgba(99,102,241,0.18)', background: 'rgba(108,92,231,0.06)' }}
        >
          {photoUrl && usePhoto ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : 'Photo'}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-xs" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Upload photo'}
          </button>
          {photoUrl && (
            <>
              <button type="button" className="btn-glass text-xs" onClick={() => onChange({ photoUrl, usePhoto: !usePhoto })}>
                {usePhoto ? 'Hide on resume' : 'Show on resume'}
              </button>
              <button type="button" className="btn-glass text-xs" onClick={() => onChange({ photoUrl: null, usePhoto: false })}>
                Remove
              </button>
            </>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
      {error && <p className="text-xs mt-2" style={{ color: '#e11d48' }}>{error}</p>}
      <p className="text-xs text-muted mt-2">Large images are resized automatically before upload. Photo appears only on templates that support it.</p>
    </div>
  )
}
