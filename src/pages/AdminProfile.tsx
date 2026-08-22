import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { useAuth } from '../context/AuthContext'
import { validatePasswordMatch } from '../lib/authValidation'
import { displayInitials } from '../lib/roleAccess'
import './admin-control.css'

function when(iso: string | null | undefined) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function AdminProfile() {
  const navigate = useNavigate()
  const { session, profile, loading, configured, reloadProfile, updateProfile, updatePassword, signOut } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setEditName(profile?.full_name ?? '')
  }, [profile?.full_name])

  const displayName = profile?.full_name?.trim() || 'Admin'
  const email = session?.user.email || null
  const dirty = editOpen && editName.trim() !== (profile?.full_name ?? '').trim()
  const canEditName = Boolean(profile && session?.user.id)
  const lastSignIn = when(session?.user.last_sign_in_at)
  const created = when(profile?.created_at || session?.user.created_at)
  const provider = typeof session?.user.app_metadata?.provider === 'string' ? session.user.app_metadata.provider : null
  const emailState = email
    ? (session?.user.email_confirmed_at ? 'Verified' : 'Not verified')
    : null
  useEffect(() => {
    if (!dirty) return
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  useEffect(() => {
    const open = editOpen || pwOpen || leaveOpen
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (leaveOpen) {
          setLeaveOpen(false)
        } else if (editOpen && dirty) setLeaveOpen(true)
        else {
          setEditOpen(false)
          setPwOpen(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editOpen, pwOpen, leaveOpen, dirty])

  const retry = () => {
    setErr(null)
    reloadProfile().catch(() => setErr("Your admin profile couldn't be loaded."))
  }

  const openEdit = () => {
    setErr(null)
    setMsg(null)
    setEditName(profile?.full_name ?? '')
    setEditOpen(true)
  }

  const closeEdit = () => {
    if (dirty) {
      setLeaveOpen(true)
      return
    }
    setEditOpen(false)
  }

  const discard = () => {
    setEditName(profile?.full_name ?? '')
    setLeaveOpen(false)
    setEditOpen(false)
  }

  const keepEditing = () => {
    setLeaveOpen(false)
  }

  const saveName = async () => {
    setBusy(true)
    setErr(null)
    setMsg(null)
    const { error } = await updateProfile({ full_name: editName.trim() })
    setBusy(false)
    if (error) {
      setErr('Profile changes could not be saved.')
      return
    }
    setMsg('Saved')
    setEditOpen(false)
  }

  const savePassword = async () => {
    setErr(null)
    setMsg(null)
    const validation = validatePasswordMatch(pw, pw2)
    if (validation) {
      setErr(validation)
      return
    }
    setBusy(true)
    const { error } = await updatePassword(pw)
    setBusy(false)
    if (error) {
      setErr(error)
      return
    }
    setPw('')
    setPw2('')
    setPwOpen(false)
    setMsg('Saved')
  }

  const logout = async () => {
    await signOut()
    navigate('/home')
  }

  return (
    <AdminShell>
      <div className="ac-dash max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Admin Profile</h1>
            <p className="text-[13px] text-muted">Manage your administrator identity and account access.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditName && <button type="button" className="btn-primary text-xs" onClick={openEdit}>Edit Profile</button>}
            <button type="button" className="btn-glass text-xs" onClick={retry}>Refresh</button>
          </div>
        </div>

        {loading && (
          <p className="text-[13px] text-muted mb-3" aria-live="polite">Loading profile...</p>
        )}
        {err && !editOpen && !pwOpen && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {err}
            <button type="button" className="btn-primary text-xs ml-3" onClick={retry}>Retry</button>
          </div>
        )}
        {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}

        {loading && (
          <div className="glass rounded-2xl p-4 mb-3" aria-busy="true">
            <div className="ac-skel mb-2" />
            <div className="ac-skel h-16" />
          </div>
        )}

        {!loading && !profile && (
          <section className="glass rounded-2xl p-5 mb-4">
            <h2 className="font-black text-ink">Your admin profile couldn't be loaded.</h2>
            <p className="text-[13px] text-muted">No signed-in admin identity is available from authentication.</p>
            <button type="button" className="btn-primary text-xs mt-3" onClick={retry}>Retry</button>
          </section>
        )}

        {!loading && profile && (
          <>
            <section className="glass rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }} aria-hidden>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    : displayInitials(displayName)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-black text-ink mb-0 truncate">{displayName}</h2>
                  <p className="text-[13px] text-muted truncate">{email || 'Email unavailable'}</p>
                  <span className="ac-chip inline-block rounded-full px-2 py-0.5 text-[10px] font-bold mt-1" data-on="true">Admin</span>
                </div>
              </div>
            </section>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Personal Information</h2>
                <dl className="text-[13px]">
                  <Row k="Full name" v={profile.full_name?.trim() || 'Admin'} />
                  <Row k="Email" v={email || '—'} note="Managed by authentication" />
                  <Row k="Avatar" v={profile.avatar_url ? 'On file' : 'Initials'} note="Profile photo management is not connected." />
                </dl>
              </section>
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Account Information</h2>
                <dl className="text-[13px]">
                  <Row k="Account ID" v={profile.id} />
                  <Row k="Created" v={created || '—'} />
                  <Row k="Role" v="Admin" />
                  <Row k="Authentication provider" v={configured ? 'Supabase' : 'Not configured'} />
                  {provider && provider !== 'email' && <Row k="Sign-in method" v={provider} />}
                  <Row k="Email status" v={emailState || 'Verification status unavailable.'} />
                  <Row k="Account status" v="Account status unavailable." />
                </dl>
              </section>
            </div>

            <section className="glass rounded-2xl p-3.5 mb-3">
              <h2 className="font-black text-ink">Security</h2>
              <div className="ac-health">
                <span>Password</span>
                {configured
                  ? <button type="button" className="btn-glass text-xs" onClick={() => { setErr(null); setPw(''); setPw2(''); setPwOpen(true) }}>Change Password</button>
                  : <span className="text-muted">Password management is handled by the authentication provider.</span>}
              </div>
              <div className="ac-health">
                <span>Two-factor authentication</span>
                <span className="text-muted">Not connected</span>
              </div>
              <div className="ac-health">
                <span>Active sessions</span>
                <span className="text-muted">Active session information unavailable.</span>
              </div>
              <div className="ac-health">
                <span>Last sign-in</span>
                <span className="text-muted">{lastSignIn || 'Last sign-in information unavailable.'}</span>
              </div>
            </section>

            <section className="glass rounded-2xl p-3.5 mb-3">
              <h2 className="font-black text-ink">Access</h2>
              <div className="ac-health"><span>Role</span><span>Admin</span></div>
              <div className="ac-health"><span>Permissions</span><span>Platform administration</span></div>
              <p className="text-[11px] text-muted mt-2">Role cannot be changed from this page.</p>
            </section>

            <section className="glass rounded-2xl p-3.5 mb-3">
              <h2 className="font-black text-ink">Administration</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  ['Platform Settings →', '/admin/settings'],
                  ['Audit Logs →', '/admin/audit'],
                  ['User Management →', '/admin/users'],
                  ['Tutor Management →', '/admin/tutors'],
                ].map(([label, href]) => (
                  <button key={href} type="button" className="btn-glass text-xs" onClick={() => navigate(href)}>{label}</button>
                ))}
              </div>
            </section>

            <button type="button" className="btn-glass text-sm w-full sm:w-auto" onClick={logout}>Log out</button>
          </>
        )}
      </div>

      {editOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ap-edit-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={closeEdit} />
          <form className="glass rounded-3xl p-6 relative z-10 w-full max-w-md" onSubmit={e => { e.preventDefault(); saveName() }}>
            <h2 id="ap-edit-title" className="text-lg font-black text-ink mb-3">Edit Profile</h2>
            <label className="block text-[12px] font-semibold text-muted mb-3">
              Full name
              <input className="field mt-1 w-full px-3 py-2 text-sm" value={editName} onChange={e => setEditName(e.target.value)} autoComplete="name" autoFocus />
            </label>
            {busy && <p className="text-[13px] text-muted mb-2">Saving...</p>}
            {err && (editOpen) && <p className="text-[12px] mb-2" style={{ color: '#e11d48' }}>{err}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary text-sm" disabled={busy}>Save</button>
              <button type="button" className="btn-glass text-sm" onClick={closeEdit}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {pwOpen && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ap-pw-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setPwOpen(false)} />
          <form className="glass rounded-3xl p-6 relative z-10 w-full max-w-md" onSubmit={e => { e.preventDefault(); savePassword() }}>
            <h2 id="ap-pw-title" className="text-lg font-black text-ink mb-3">Change Password</h2>
            <label className="block text-[12px] font-semibold text-muted mb-2">
              New password
              <input type="password" className="field mt-1 w-full px-3 py-2 text-sm" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="block text-[12px] font-semibold text-muted mb-3">
              Confirm password
              <input type="password" className="field mt-1 w-full px-3 py-2 text-sm" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" />
            </label>
            {busy && <p className="text-[13px] text-muted mb-2">Saving...</p>}
            {err && pwOpen && <p className="text-[12px] mb-2" style={{ color: '#e11d48' }}>{err}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary text-sm" disabled={busy}>Save</button>
              <button type="button" className="btn-glass text-sm" onClick={() => setPwOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {leaveOpen && (
        <div className="ac-drawer fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="ap-leave-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={keepEditing} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="ap-leave-title" className="text-lg font-black text-ink mb-2">You have unsaved changes.</h2>
            <p className="text-[13px] text-muted mb-4">Discard your unsaved changes?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={discard}>Discard</button>
              <button type="button" className="btn-glass text-sm" onClick={keepEditing}>Keep editing</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="ac-health items-start">
      <dt className="text-muted shrink-0">{k}</dt>
      <dd className="text-right min-w-0">
        <span className="font-medium break-all">{v}</span>
        {note && <span className="block text-[11px] text-muted font-normal">{note}</span>}
      </dd>
    </div>
  )
}
