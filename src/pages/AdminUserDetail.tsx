import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { displayInitials } from '../lib/roleAccess'
import { loadTutorHub, profileStrength } from '../lib/tutorProfile'
import {
  bookingsForUser,
  formatWhen,
  loadAdminUserIndex,
  roleLabel,
  userEvents,
  type AdminUserIndex,
} from '../lib/adminUsers'
import { adminChangeUserRole, isModerationBackendAvailable } from '../lib/adminModeration'
import './admin-control.css'

type DetailTab = 'overview' | 'learning' | 'sessions' | 'projects' | 'activity' | 'account'
type RoleChoice = 'student' | 'tutor' | 'admin'

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminUserIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [roleChoice, setRoleChoice] = useState<RoleChoice>('student')
  const [roleConfirm, setRoleConfirm] = useState(false)
  const [roleMsg, setRoleMsg] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [roleBusy, setRoleBusy] = useState(false)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminUserIndex()
      .then(setIndex)
      .catch(() => setError("User details couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const user = index?.rows.find(r => r.id === id) ?? null

  useEffect(() => {
    if (user?.role === 'student' || user?.role === 'tutor' || user?.role === 'admin') {
      setRoleChoice(user.role)
    }
  }, [user?.id, user?.role])
  const hub = user?.role === 'tutor' ? loadTutorHub(user.id) : null
  const events = user && index ? userEvents(user, index) : []
  const enrolls = index && user ? index.enrollments.filter(e => e.student_id === user.id) : []
  const taught = index && user ? index.courses.filter(c => c.tutor_id === user.id) : []
  const books = index && user ? bookingsForUser(user.id, user.role, index) : []
  const projs = index && user ? index.projects.filter(p => p.student_id === user.id) : []
  const taughtStudentCount = index && user
    ? new Set(index.enrollments.filter(e => taught.some(c => c.id === e.course_id)).map(e => e.student_id)).size
    : 0

  const tabs: { id: DetailTab; label: string }[] = user?.role === 'tutor'
    ? [
      { id: 'overview', label: 'Overview' },
      { id: 'learning', label: 'Courses' },
      { id: 'sessions', label: 'Sessions' },
      { id: 'projects', label: 'Projects' },
      { id: 'activity', label: 'Activity' },
      { id: 'account', label: 'Account' },
    ]
    : [
      { id: 'overview', label: 'Overview' },
      { id: 'learning', label: 'Learning' },
      { id: 'sessions', label: 'Sessions' },
      { id: 'projects', label: 'Projects' },
      { id: 'activity', label: 'Activity' },
      { id: 'account', label: 'Account' },
    ]

  return (
    <AdminShell>
      <button type="button" className="btn-glass text-xs mb-4" onClick={() => navigate('/admin/users')}>← Users</button>
      {error && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm" style={{ color: '#e11d48' }}>
          {error}
          <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
        </div>
      )}
      {loading && <div className="ac-skel mb-4" />}
      {!loading && !user && !error && <p className="text-sm text-muted">No users found.</p>}
      {user && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-white font-black shrink-0" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}>
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : displayInitials(user.name)}
              </div>
              <div>
                <h1 className="text-2xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{user.name}</h1>
                <p className="text-sm text-muted">{roleLabel(user.role)} · Joined {formatWhen(user.joinedAt)}{user.demo ? ' · Demo' : ''}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-glass text-sm" onClick={() => setTab('activity')}>View Activity</button>
            </div>
          </div>
          {user.demo && (
            <div className="glass rounded-2xl p-3 mb-5 text-sm ac-warn">Demo Users — Not Production Accounts. Demo records are not treated as verified or financial accounts.</div>
          )}

          <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="User sections">
            {tabs.map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {tab === 'overview' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-lg font-black text-ink mb-3">User Overview</h2>
              <dl className="grid sm:grid-cols-2 gap-2 text-sm">
                <KV k="Role" v={roleLabel(user.role)} />
                <KV k="Joined" v={formatWhen(user.joinedAt)} />
                <KV k="Last active" v={formatWhen(user.lastActiveAt)} />
                <KV k="Profile completion" v={hub ? `${profileStrength(hub).percent}%` : 'Data unavailable'} />
                <KV k="Course activity" v={String(user.courseCount)} />
                <KV k="Session activity" v={String(user.sessionCount)} />
                <KV k="Project activity" v={String(user.projectCount)} />
                {user.role === 'student' && <KV k="Career activity" v="Data unavailable" />}
                <KV k="Headline" v={user.headline || '—'} />
              </dl>
              <p className="text-xs text-muted mt-3">Passwords, tokens, bank details, private notes, private AI conversations, and verification documents are not shown.</p>
            </section>
          )}

          {tab === 'learning' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-lg font-black text-ink mb-3">{user.role === 'tutor' ? 'Courses' : 'Learning'}</h2>
              {user.role === 'tutor' ? (
                <>
                  {taught.length === 0 && <p className="text-sm text-muted">No course activity yet.</p>}
                  {taught.map(c => (
                    <div key={c.id} className="text-sm mb-2">{c.title} · {c.published ? 'Published' : 'Draft'}</div>
                  ))}
                  {taught.length > 0 && <p className="text-sm text-muted mt-2">Students enrolled in catalog courses: {taughtStudentCount}</p>}
                  <p className="text-xs text-muted mt-3">Teaching activity is based on catalog courses owned by this tutor.</p>
                </>
              ) : (
                <>
                  {enrolls.length === 0 && <p className="text-sm text-muted">No course activity yet.</p>}
                  {enrolls.map(e => {
                    const course = index?.courses.find(c => c.id === e.course_id)
                    return <div key={e.id} className="text-sm mb-2">{course?.title || 'Course'} · {e.progress}% progress</div>
                  })}
                  <p className="text-xs text-muted mt-3">Career activity: Data unavailable. Completed lesson counts are not shown unless a lesson-level record exists.</p>
                </>
              )}
            </section>
          )}

          {tab === 'sessions' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-lg font-black text-ink mb-3">Sessions</h2>
              {books.length === 0 && <p className="text-sm text-muted">No session activity yet.</p>}
              {books.length > 0 && (
                <>
                  <p className="text-sm mb-2">Upcoming {books.filter(b => b.status === 'pending' || b.status === 'confirmed').length} · Completed {books.filter(b => b.status === 'completed').length} · Cancelled {books.filter(b => b.status === 'cancelled').length}</p>
                  {books.map(b => (
                    <div key={b.id} className="text-sm mb-1">{b.status} · {formatWhen(b.created_at)}</div>
                  ))}
                </>
              )}
            </section>
          )}

          {tab === 'projects' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-lg font-black text-ink mb-3">Projects</h2>
              {projs.length === 0 && <p className="text-sm text-muted">No project activity yet.</p>}
              {projs.map(p => {
                const title = index?.catalog.find(c => c.id === p.project_id)?.title
                return <div key={p.id} className="text-sm mb-1">{title || 'Project'} · {p.status}</div>
              })}
            </section>
          )}

          {tab === 'activity' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-lg font-black text-ink mb-3">Activity</h2>
              {events.length === 0 && <p className="text-sm text-muted">No activity history available.</p>}
              {events.map(ev => (
                <div key={ev.id} className="flex justify-between gap-3 text-sm py-2" style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                  <span>{ev.label}</span>
                  <span className="text-xs text-muted whitespace-nowrap">{new Date(ev.at).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </section>
          )}

          {tab === 'account' && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-lg font-black text-ink mb-3">Account</h2>
              <dl className="grid sm:grid-cols-2 gap-2 text-sm mb-4">
                <KV k="Role" v={roleLabel(user.role)} />
                <KV k="Joined" v={formatWhen(user.joinedAt)} />
                <KV k="Last active" v={formatWhen(user.lastActiveAt)} />
                <KV k="User ID" v={user.id} />
              </dl>
              {isModerationBackendAvailable() && !user.demo ? (
                <>
                  <p className="text-sm text-muted mb-3">Change account role using the existing profiles.role field. Suspend/ban status is not available in the current schema.</p>
                  <label className="block text-xs font-semibold text-muted mb-1" htmlFor="admin-role-select">Role</label>
                  <select
                    id="admin-role-select"
                    className="field w-full max-w-xs px-3 py-2 text-sm mb-3"
                    value={roleChoice}
                    onChange={e => setRoleChoice(e.target.value as RoleChoice)}
                  >
                    <option value="student">Student</option>
                    <option value="tutor">Tutor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={roleBusy || roleChoice === user.role}
                    onClick={() => setRoleConfirm(true)}
                  >
                    Update role
                  </button>
                  {roleMsg && <p className="text-sm mt-3" style={{ color: '#0F8A68' }}>{roleMsg}</p>}
                  {roleError && <p className="text-sm mt-3" style={{ color: '#e11d48' }} role="alert">{roleError}</p>}
                </>
              ) : (
                <p className="text-xs text-muted mt-3">
                  {user.demo ? 'Demo accounts cannot be moderated.' : 'Account moderation requires Supabase.'} No password or security secrets are displayed.
                </p>
              )}
            </section>
          )}
        </>
      )}

      {roleConfirm && user && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="role-confirm">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setRoleConfirm(false)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="role-confirm" className="text-lg font-black text-ink mb-2">Change user role?</h2>
            <p className="text-sm text-muted mb-4">
              Set {user.name} to {roleLabel(roleChoice)}. This uses the existing profile role update path protected by admin authorization.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-glass text-sm" disabled={roleBusy} onClick={() => setRoleConfirm(false)}>Cancel</button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={roleBusy}
                onClick={() => {
                  setRoleBusy(true)
                  setRoleError(null)
                  void adminChangeUserRole(user.id, roleChoice).then(result => {
                    setRoleBusy(false)
                    setRoleConfirm(false)
                    if (result.ok) {
                      setRoleMsg(result.message)
                      load()
                    } else {
                      setRoleError(result.message)
                    }
                  })
                }}
              >
                {roleBusy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-medium text-right break-all">{v}</dd></div>
}
