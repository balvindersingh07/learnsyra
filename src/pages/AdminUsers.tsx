import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { displayInitials } from '../lib/roleAccess'
import {
  filterUsers,
  formatWhen,
  loadAdminUserIndex,
  paginate,
  roleLabel,
  userStats,
  usersPageSize,
  type ActivityFilter,
  type AdminUserIndex,
  type AdminUserRow,
  type JoinedFilter,
  type UserQuery,
  type UserSort,
  type UserTab,
} from '../lib/adminUsers'
import './admin-control.css'

const TABS: { id: UserTab; label: string }[] = [
  { id: 'all', label: 'All Users' },
  { id: 'students', label: 'Students' },
  { id: 'tutors', label: 'Tutors' },
  { id: 'suspended', label: 'Suspended' },
]

export default function AdminUsers() {
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminUserIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<UserTab>('all')
  const [q, setQ] = useState('')
  const [role, setRole] = useState<UserQuery['role']>('all')
  const [status, setStatus] = useState<UserQuery['status']>('all')
  const [joined, setJoined] = useState<JoinedFilter>('any')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [activity, setActivity] = useState<ActivityFilter>('any')
  const [sort, setSort] = useState<UserSort>('recommended')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminUserIndex()
      .then(setIndex)
      .catch(() => setError("Users couldn't be loaded right now."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [tab, q, role, status, joined, from, to, activity, sort])

  useEffect(() => {
    if (!filtersOpen && !exportOpen && !menuId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltersOpen(false)
        setExportOpen(false)
        setMenuId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtersOpen, exportOpen, menuId])

  const query: UserQuery = useMemo(() => ({
    tab, q, role, status, joined, custom: { from, to }, activity, sort,
  }), [tab, q, role, status, joined, from, to, activity, sort])

  const filtered = useMemo(() => filterUsers(index?.rows ?? [], query), [index, query])
  const pager = paginate(filtered, page)
  const stats = userStats(index?.rows ?? [], joined, { from, to })
  const hasActivityData = (index?.rows ?? []).some(r => r.lastActiveAt)
  const hasEmail = (index?.rows ?? []).some(r => r.email)
  const hasDemo = (index?.rows ?? []).some(r => r.demo)

  const emptyCopy = () => {
    if (q.trim()) return 'No users match your search.'
    if (tab === 'students') return 'No students found.'
    if (tab === 'tutors') return 'No tutors found.'
    if (tab === 'suspended') return 'No users found.'
    return 'No users found.'
  }

  const filters = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <label className="text-xs font-semibold text-muted">
        Role
        <select className="field mt-1 w-full px-3 py-2 text-sm" value={role} onChange={e => setRole(e.target.value as UserQuery['role'])} disabled={tab === 'students' || tab === 'tutors'}>
          <option value="all">All</option>
          <option value="student">Student</option>
          <option value="tutor">Tutor</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        Status
        <select className="field mt-1 w-full px-3 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value as UserQuery['status'])}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        Joined
        <select className="field mt-1 w-full px-3 py-2 text-sm" value={joined} onChange={e => setJoined(e.target.value as JoinedFilter)}>
          <option value="any">Any time</option>
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
          <option value="3m">3 Months</option>
          <option value="1y">1 Year</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {hasActivityData && (
        <label className="text-xs font-semibold text-muted">
          Activity
          <select className="field mt-1 w-full px-3 py-2 text-sm" value={activity} onChange={e => setActivity(e.target.value as ActivityFilter)}>
            <option value="any">Any</option>
            <option value="recent">Active recently</option>
            <option value="inactive">Inactive</option>
            <option value="none">No activity data</option>
          </select>
        </label>
      )}
      <label className="text-xs font-semibold text-muted">
        Sort
        <select className="field mt-1 w-full px-3 py-2 text-sm" value={sort} onChange={e => setSort(e.target.value as UserSort)}>
          <option value="recommended">Recommended</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          {hasActivityData && <option value="last_active">Last Active</option>}
        </select>
      </label>
    </div>
  )

  return (
    <AdminShell>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>User Management</h1>
          <p className="text-muted">View and manage student and tutor accounts across LearnSyra.</p>
          <p className="text-xs text-muted mt-1">Admin status is stored locally until server-side account controls are connected.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm lg:hidden" onClick={() => setFiltersOpen(true)}>Filters</button>
          <button type="button" className="btn-glass text-sm" onClick={() => setExportOpen(true)}>Export Users</button>
        </div>
      </div>

      {error && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm" style={{ color: '#e11d48' }}>
          {error}
          <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
        </div>
      )}
      {hasDemo && (
        <div className="glass rounded-2xl p-3 mb-5 text-sm ac-warn">Demo Users — Not Production Accounts. Demo records are labeled and are not treated as verified or financial accounts.</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        {[
          ['Total Users', loading ? null : String(stats.total)],
          ['Students', loading ? null : String(stats.students)],
          ['Tutors', loading ? null : String(stats.tutors)],
          ['Active Users', loading ? null : String(stats.active)],
          ['Suspended Users', loading ? null : String(stats.suspended)],
          ['New Users', loading ? null : String(stats.newUsers)],
        ].map(([k, v]) => (
          <div key={k} className="glass rounded-2xl p-3">
            <div className="text-xs text-muted">{k}</div>
            {v == null ? <div className="ac-skel mt-2" /> : <div className="text-xl font-black text-ink mt-1">{v}</div>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="User type">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="ac-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={tab === t.id} onClick={() => { setTab(t.id); setRole(t.id === 'students' ? 'student' : t.id === 'tutors' ? 'tutor' : 'all') }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <label className="sr-only" htmlFor="user-search">Search users</label>
        <input id="user-search" className="field flex-1 min-w-[12rem] px-3 py-2 text-sm" value={q} onChange={e => setQ(e.target.value)} placeholder="Search users..." />
        {q && <button type="button" className="btn-glass text-sm" onClick={() => setQ('')}>Clear Search</button>}
      </div>
      <div className="hidden lg:block mb-5">{filters}</div>
      {joined === 'custom' && (
        <div className="flex flex-wrap gap-3 mb-4">
          <label className="text-xs font-semibold text-muted">From<input type="date" className="field ml-2 px-3 py-2 text-sm" value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="text-xs font-semibold text-muted">To<input type="date" className="field ml-2 px-3 py-2 text-sm" value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
      )}

      {loading && (
        <div className="space-y-3 mb-4" aria-busy="true" aria-label="Loading users">
          <div className="ac-skel h-16" />
          <div className="ac-skel h-16" />
          <div className="ac-skel h-16" />
        </div>
      )}
      {!loading && pager.total === 0 && !error && <p className="text-sm text-muted mb-4">{emptyCopy()}</p>}

      {!loading && pager.total > 0 && (
      <div className="ac-desktop-table glass rounded-2xl ac-table mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="p-3">Name</th>
              <th className="p-3">Role</th>
              {hasEmail && <th className="p-3">Email</th>}
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              {hasActivityData && <th className="p-3">Last Active</th>}
              <th className="p-3">Courses</th>
              <th className="p-3">Sessions</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pager.slice.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
                <td className="p-3"><UserId user={u} /></td>
                <td className="p-3">{roleLabel(u.role)}</td>
                {hasEmail && <td className="p-3 text-muted">{u.email || '—'}</td>}
                <td className="p-3"><Status status={u.status} /></td>
                <td className="p-3">{formatWhen(u.joinedAt)}</td>
                {hasActivityData && <td className="p-3">{formatWhen(u.lastActiveAt)}</td>}
                <td className="p-3">{u.courseCount}</td>
                <td className="p-3">{u.sessionCount}</td>
                <td className="p-3 relative">
                  <button type="button" className="btn-glass text-xs mr-2" onClick={() => navigate(`/admin/users/${u.id}`)}>View</button>
                  <button type="button" className="btn-glass text-xs" aria-haspopup="menu" aria-expanded={menuId === u.id} onClick={() => setMenuId(menuId === u.id ? null : u.id)}>More</button>
                  {menuId === u.id && (
                    <div role="menu" className="glass rounded-xl p-2 mt-2 absolute z-10 right-3">
                      <button type="button" role="menuitem" className="block w-full text-left text-xs px-2 py-1" style={{ background: 'none', border: 'none' }} onClick={() => { setMenuId(null); navigate(`/admin/users/${u.id}`) }}>Open user</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {!loading && (
      <div className="ac-mobile-cards space-y-3 mb-4">
        {pager.slice.map(u => (
          <article key={u.id} className="glass rounded-2xl p-4">
            <UserId user={u} />
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted">
              <Status status={u.status} />
              <span>Courses {u.courseCount}</span>
              <span>Sessions {u.sessionCount}</span>
              <span>Joined {formatWhen(u.joinedAt)}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" className="btn-primary text-xs" onClick={() => navigate(`/admin/users/${u.id}`)}>View</button>
              <button type="button" className="btn-glass text-xs" onClick={() => navigate(`/admin/users/${u.id}`)}>More</button>
            </div>
          </article>
        ))}
      </div>
      )}

      {pager.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">Showing {pager.from}–{pager.to} of {pager.total}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-glass text-xs" disabled={pager.page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="text-xs py-2">Page {pager.page} of {pager.pages}</span>
            <button type="button" className="btn-glass text-xs" disabled={pager.page >= pager.pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted mt-3">Page size {usersPageSize()}. Suspend and reactivate happen on the user detail page.</p>

      {filtersOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="glass w-80 max-w-[90vw] h-full p-5 overflow-y-auto">
            <h2 className="text-lg font-black text-ink mb-3">Filters</h2>
            {filters}
            <button type="button" className="btn-primary w-full text-sm mt-4" onClick={() => setFiltersOpen(false)}>Apply</button>
          </div>
          <button type="button" className="flex-1" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setFiltersOpen(false)} />
        </div>
      )}
      {exportOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExportOpen(false)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="export-title" className="text-lg font-black text-ink mb-2">Export Users</h2>
            <p className="text-sm text-muted mb-4">User export will be available when reporting is connected.</p>
            <button type="button" className="btn-primary text-sm" onClick={() => setExportOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function Status({ status }: { status: AdminUserRow['status'] }) {
  return (
    <span className="ac-status" data-s={status}>
      <i aria-hidden />
      {status === 'suspended' ? 'Suspended' : 'Active'}
    </span>
  )
}

function UserId({ user }: { user: AdminUserRow }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[10px] text-white font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : displayInitials(user.name)}
      </div>
      <div className="min-w-0">
        <div className="font-semibold truncate">{user.name}</div>
        <div className="text-[11px] text-muted truncate">{roleLabel(user.role)}{user.demo ? ' · Demo' : ''}</div>
      </div>
    </div>
  )
}
