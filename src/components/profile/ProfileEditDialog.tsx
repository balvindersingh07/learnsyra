import type { ChangeEvent } from 'react'
import { PROFILE_EXPERIENCE, PROFILE_MODES, PROFILE_ROLES, type ProfileExtras } from '../../lib/studentProfile'

const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item]
}

export default function ProfileEditDialog({
  name,
  headline,
  avatar,
  email,
  extras,
  busy,
  avatarBusy,
  avatarError,
  onName,
  onHeadline,
  onAvatarUpload,
  onRemoveAvatar,
  onExtras,
  onClose,
  onSave,
}: {
  name: string
  headline: string
  avatar: string
  email: string
  extras: ProfileExtras
  busy: boolean
  avatarBusy?: boolean
  avatarError?: string | null
  onName: (v: string) => void
  onHeadline: (v: string) => void
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => void
  onRemoveAvatar?: () => void
  onExtras: (v: ProfileExtras) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="glass rounded-3xl p-5 sm:p-6 w-full max-w-lg max-h-[88vh] overflow-y-auto career-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="edit-profile-title" className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Edit Profile</h2>

        <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Basic</h3>
        <label className="block text-xs font-semibold text-muted mb-3">
          Name
          <input className="field w-full mt-1 px-3 py-2 text-sm" value={name} onChange={e => onName(e.target.value)} autoComplete="name" />
        </label>
        <label className="block text-xs font-semibold text-muted mb-3">
          Professional headline
          <input className="field w-full mt-1 px-3 py-2 text-sm" value={headline} onChange={e => onHeadline(e.target.value)} placeholder="e.g. Aspiring Frontend Developer" />
        </label>
        <label className="block text-xs font-semibold text-muted mb-3">
          Email
          <input className="field w-full mt-1 px-3 py-2 text-sm" value={email} readOnly aria-readonly="true" />
        </label>
        <label className="block text-xs font-semibold text-muted mb-3">
          Phone
          <input className="field w-full mt-1 px-3 py-2 text-sm" value={extras.phone} onChange={e => onExtras({ ...extras, phone: e.target.value })} autoComplete="tel" />
        </label>
        <label className="block text-xs font-semibold text-muted mb-4">
          Location
          <input className="field w-full mt-1 px-3 py-2 text-sm" value={extras.location} onChange={e => onExtras({ ...extras, location: e.target.value })} placeholder="City, country" />
        </label>

        <p className="text-xs font-semibold text-muted mb-2">Avatar</p>
        <div className="flex gap-2 mb-2 flex-wrap">
          <label
            className="w-12 h-12 rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer"
            style={{
              border: avatar ? '2px solid #6C5CE7' : '2px solid rgba(99,102,241,0.18)',
              background: avatar ? 'transparent' : 'rgba(108,92,231,0.06)',
              opacity: avatarBusy ? 0.7 : 1,
            }}
            aria-label="Upload photo"
          >
            {avatar ? (
              <img src={avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-[9px] font-semibold text-primary leading-none mt-0.5">Upload</span>
              </>
            )}
            <input
              type="file"
              accept={AVATAR_ACCEPT}
              className="sr-only"
              onChange={onAvatarUpload}
              disabled={avatarBusy || busy}
            />
          </label>
        </div>
        {avatarBusy && <p className="text-xs text-muted mb-2">Uploading photo…</p>}
        {avatarError && (
          <p className="text-xs mb-2" style={{ color: '#E11D48' }} role="alert">
            {avatarError}
          </p>
        )}
        {avatar && onRemoveAvatar && (
          <button
            type="button"
            className="text-xs font-semibold mb-5 cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0, color: '#667085' }}
            disabled={avatarBusy || busy}
            onClick={onRemoveAvatar}
          >
            Remove photo
          </button>
        )}
        {!avatar && <div className="mb-5" />}

        <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Career</h3>
        <fieldset className="mb-3">
          <legend className="text-xs font-semibold text-muted mb-1">Target role</legend>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_ROLES.map(r => (
              <button key={r} type="button" className="sp-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={extras.targetRole === r} aria-pressed={extras.targetRole === r} onClick={() => onExtras({ ...extras, targetRole: r })}>{r}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mb-3">
          <legend className="text-xs font-semibold text-muted mb-1">Experience level</legend>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_EXPERIENCE.map(r => (
              <button key={r} type="button" className="sp-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={extras.experienceLevel === r} aria-pressed={extras.experienceLevel === r} onClick={() => onExtras({ ...extras, experienceLevel: r })}>{r}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mb-3">
          <legend className="text-xs font-semibold text-muted mb-1">Work mode</legend>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_MODES.map(r => (
              <button key={r} type="button" className="sp-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={extras.workMode === r} aria-pressed={extras.workMode === r} onClick={() => onExtras({ ...extras, workMode: r })}>{r}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mb-4">
          <legend className="text-xs font-semibold text-muted mb-1">Career interests</legend>
          <div className="flex flex-wrap gap-1.5">
            {PROFILE_ROLES.map(r => (
              <button key={r} type="button" className="sp-choice px-2 py-1 rounded-lg text-xs font-semibold" data-on={extras.interests.includes(r)} aria-pressed={extras.interests.includes(r)} onClick={() => onExtras({ ...extras, interests: toggle(extras.interests, r) })}>{r}</button>
            ))}
          </div>
        </fieldset>

        <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Professional links</h3>
        <label className="block text-xs font-semibold text-muted mb-3">
          LinkedIn
          <input className="field w-full mt-1 px-3 py-2 text-sm" value={extras.linkedin} onChange={e => onExtras({ ...extras, linkedin: e.target.value })} />
        </label>
        <label className="block text-xs font-semibold text-muted mb-3">
          GitHub
          <input className="field w-full mt-1 px-3 py-2 text-sm" value={extras.github} onChange={e => onExtras({ ...extras, github: e.target.value })} />
        </label>
        <label className="block text-xs font-semibold text-muted mb-4">
          Portfolio
          <input className="field w-full mt-1 px-3 py-2 text-sm" value={extras.portfolio} onChange={e => onExtras({ ...extras, portfolio: e.target.value })} />
        </label>

        <h3 className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Learning</h3>
        <label className="block text-xs font-semibold text-muted mb-3">
          Learning goals
          <textarea className="field w-full mt-1 px-3 py-2 text-sm" style={{ minHeight: '5rem' }} value={extras.learningGoals} onChange={e => onExtras({ ...extras, learningGoals: e.target.value })} />
        </label>
        <label className="block text-xs font-semibold text-muted mb-5">
          Weekly learning target (hours)
          <input
            type="number"
            min={0}
            max={40}
            className="field w-full mt-1 px-3 py-2 text-sm"
            value={extras.weeklyTargetHours || ''}
            placeholder="Not set"
            onChange={e => onExtras({ ...extras, weeklyTargetHours: Number(e.target.value) || 0 })}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-sm" disabled={busy || avatarBusy} onClick={onSave}>{busy ? 'Saving…' : 'Save profile'}</button>
          <button type="button" className="btn-glass text-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
