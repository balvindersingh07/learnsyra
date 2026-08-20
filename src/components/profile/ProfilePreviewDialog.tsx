import { initials, type StudentHub } from '../../lib/studentProfile'

export default function ProfilePreviewDialog({ hub, onClose }: { hub: StudentHub; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(23,32,51,0.45)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        className="glass rounded-3xl p-5 sm:p-6 w-full max-w-lg max-h-[88vh] overflow-y-auto career-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">Public portfolio preview</p>
        <h2 id="preview-title" className="text-lg font-black text-ink mb-4" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>How others would see you</h2>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}>
            {hub.avatar ? <img src={hub.avatar} alt="" className="w-full h-full object-cover" /> : initials(hub.name)}
          </div>
          <div>
            <div className="font-black text-ink">{hub.name}</div>
            <div className="text-sm text-muted">{hub.headline}</div>
            <div className="text-sm font-semibold text-primary">{hub.targetRole}</div>
          </div>
        </div>
        <h3 className="text-sm font-bold text-ink mb-1">Skills</h3>
        <p className="text-sm text-muted mb-3">{hub.verified.map(s => s.name).join(' · ') || hub.career.haveSkills.join(' · ')}</p>
        <h3 className="text-sm font-bold text-ink mb-1">Projects</h3>
        <ul className="text-sm text-muted mb-3 space-y-1">
          {hub.projects.map(p => <li key={p.id}>{p.title} · {p.score} / 100</li>)}
        </ul>
        <h3 className="text-sm font-bold text-ink mb-1">Achievements</h3>
        <p className="text-sm text-muted mb-3">{hub.achievements.filter(a => a.earned).map(a => a.label).join(' · ') || 'None earned yet'}</p>
        <h3 className="text-sm font-bold text-ink mb-1">Career goal</h3>
        <p className="text-sm text-muted mb-4">{hub.targetRole ? `Become a job-ready ${hub.targetRole}` : 'Choose a career goal to get started'}</p>
        <p className="text-xs text-muted mb-4">Email, phone, tutor sessions, AI chats, and analytics stay private.</p>
        <button type="button" className="btn-glass text-sm" onClick={onClose}>Close preview</button>
      </div>
    </div>
  )
}
