import { PROFILE_EXPERIENCE, PROFILE_MODES, PROFILE_ROLES, type ProfileExtras } from '../../lib/studentProfile'

const AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=96&h=96&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&fit=crop&auto=format',
]

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
  onName,
  onHeadline,
  onAvatar,
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
  onName: (v: string) => void
  onHeadline: (v: string) => void
  onAvatar: (v: string) => void
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
        <div className="flex gap-2 mb-5 flex-wrap">
          {AVATARS.map(url => (
            <button
              key={url}
              type="button"
              className="w-12 h-12 rounded-xl overflow-hidden"
              style={{ border: avatar === url ? '2px solid #6C5CE7' : '2px solid transparent' }}
              onClick={() => onAvatar(url)}
              aria-label="Choose avatar"
              aria-pressed={avatar === url}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

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
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={onSave}>{busy ? 'Saving…' : 'Save profile'}</button>
          <button type="button" className="btn-glass text-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
