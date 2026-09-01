import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { validatePasswordMatch } from '../lib/authValidation'
import { formatInr } from '../lib/courseCatalog'
import { tutorBookPath, tutorPath } from '../lib/paths'
import { displayInitials } from '../lib/roleAccess'
import {
  BUFFER_OPTIONS,
  SESSION_DURATIONS,
  SKILL_LEVELS,
  STUDENT_LEVELS,
  SUGGESTED_SKILLS,
  TEACHING_STYLE_TAGS,
  WEEKDAYS,
  emptyHub,
  loadOrCreateHub,
  publishBlockers,
  saveTutorHub,
  toDisplayTime,
  uid,
  type ProfileVisibility,
  type SessionOffer,
  type SkillLevel,
  type TeachingStyleTag,
  type TutorHub,
} from '../lib/tutorProfile'
import {
  NOTIFY_CATEGORIES,
  SECTION_FROM_HASH,
  SETTINGS_NAV,
  addExtraRange,
  availabilityStatus,
  defaultNotifyPrefs,
  loadNotifyPrefs,
  previewSlots,
  pricingStatus,
  saveNotifyPrefs,
  settingsChecklist,
  setupSnapshot,
  toggleLevel,
  validateAvailability,
  validateBlocked,
  validatePricing,
  verificationDisplay,
  visibilityHelp,
  visibilityLabel,
  type NotifyPrefs,
  type SettingsSection,
} from '../lib/tutorSettings'
import { syncPublishedTutorPricing, syncTutorListingAvailability } from '../lib/tutorSessionOffers'
import './tutor-settings.css'

export default function TutorSettings() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile, signOut, updatePassword } = useAuth()
  const userId = session?.user.id || profile?.id || null
  const email = session?.user.email || ''
  const [hub, setHub] = useState<TutorHub>(() =>
    emptyHub('__awaiting_auth__', {
      name: profile?.full_name || email || 'Tutor',
      headline: profile?.headline || '',
      avatarUrl: profile?.avatar_url || null,
      email,
    }),
  )
  const [saved, setSaved] = useState<TutorHub>(hub)
  const [notify, setNotify] = useState(() => defaultNotifyPrefs())
  const [savedNotify, setSavedNotify] = useState(notify)
  const [section, setSection] = useState<SettingsSection>(() => SECTION_FROM_HASH[location.hash.replace('#', '')] || 'overview')
  const [drawer, setDrawer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [skillQuery, setSkillQuery] = useState('')
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [blockFrom, setBlockFrom] = useState('')
  const [blockTo, setBlockTo] = useState('')
  const [blockReason, setBlockReason] = useState('')

  const dirty = JSON.stringify(hub) !== JSON.stringify(saved) || JSON.stringify(notify) !== JSON.stringify(savedNotify)

  useEffect(() => {
    if (!userId) return
    const next = loadOrCreateHub(userId, {
      name: profile?.full_name || email || 'Tutor',
      headline: profile?.headline || '',
      avatarUrl: profile?.avatar_url || null,
      email,
    })
    setHub(next)
    setSaved(next)
    const prefs = loadNotifyPrefs(userId)
    setNotify(prefs)
    setSavedNotify(prefs)
  }, [userId, email, profile?.full_name, profile?.headline, profile?.avatar_url])

  useEffect(() => {
    const id = SECTION_FROM_HASH[location.hash.replace('#', '')]
    if (id) setSection(id)
  }, [location.hash])

  useEffect(() => {
    if (!drawer && !pauseOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawer(false)
        setPauseOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, pauseOpen])

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  const go = (id: SettingsSection) => {
    setSection(id)
    setDrawer(false)
    const hash = id === 'overview' ? '' : `#${id}`
    window.history.replaceState(null, '', `/tutor/settings${hash}`)
  }

  const patch = (partial: Partial<TutorHub>) => {
    setHub(h => ({ ...h, ...partial }))
    setStatus('idle')
    setMsg(null)
  }

  const persist = async (next = hub, note?: string) => {
    if (!userId) return false
    const availErr = validateAvailability(next)
    const priceErr = validatePricing(next)
    const blockErr = validateBlocked(next)
    if (availErr || priceErr || blockErr) {
      setErr(availErr || priceErr || blockErr)
      return false
    }
    setBusy(true)
    setErr(null)
    setStatus('saving')
    try {
      saveTutorHub(next)
      saveNotifyPrefs(userId, notify)
      if (next.visibility === 'published') {
        const sync = await syncPublishedTutorPricing(next)
        if (sync.error) {
          setErr(sync.error)
          setStatus('idle')
          return false
        }
      } else {
        const sync = await syncTutorListingAvailability(next.userId, false)
        if (sync.error) {
          setErr(sync.error)
          setStatus('idle')
          return false
        }
      }
      setHub(next)
      setSaved(next)
      setSavedNotify(notify)
      setStatus('saved')
      setMsg(note || '✓ Changes saved')
      return true
    } catch {
      setErr('Could not save settings. Try again.')
      setStatus('idle')
      return false
    } finally {
      setBusy(false)
    }
  }

  const name = hub.identity.name || email || 'Tutor'
  const initials = displayInitials(name)
  const snap = setupSnapshot(hub)
  const checks = settingsChecklist(hub)
  const verify = verificationDisplay()
  const slots = previewSlots(hub)
  const emailVerified = Boolean(session?.user.email_confirmed_at)
  const suggested = SUGGESTED_SKILLS.filter(
    s => s.toLowerCase().includes(skillQuery.toLowerCase()) && !hub.skills.some(x => x.name.toLowerCase() === s.toLowerCase()),
  )
  const saveLabel = status === 'saving' ? 'Saving...' : dirty ? 'Unsaved Changes' : status === 'saved' ? 'Saved' : 'Saved'

  const addSkill = (raw: string) => {
    const match = SUGGESTED_SKILLS.find(s => s.toLowerCase() === raw.trim().toLowerCase())
    if (!match || hub.skills.some(s => s.name === match)) return
    patch({ skills: [...hub.skills, { name: match, level: 'Intermediate', primary: hub.skills.length === 0 }] })
    setSkillQuery('')
  }

  const pauseAccount = () => {
    persist({ ...hub, visibility: 'paused' }, 'Tutor account paused. Existing students, courses, and earnings are unchanged.')
    setPauseOpen(false)
  }

  const resumeAccount = () => {
    const blockers = publishBlockers({ ...hub, visibility: 'published' })
    persist(
      { ...hub, visibility: blockers.length ? 'draft' : 'published', vacationMode: false },
      blockers.length ? 'Account resumed as Draft. Complete required fields to publish.' : '✓ Tutor profile published',
    )
  }

  const publish = () => {
    const blockers = publishBlockers(hub)
    if (blockers.length) {
      setErr(`Complete required fields: ${blockers.join(', ')}`)
      go('visibility')
      return
    }
    persist({ ...hub, visibility: 'published', onboarding: { ...hub.onboarding, completed: true } }, '✓ Tutor profile published')
  }

  const changePassword = async () => {
    setErr(null)
    const validation = validatePasswordMatch(pw, pw2)
    if (validation) {
      setErr(validation)
      return
    }
    setBusy(true)
    const { error } = await updatePassword(pw)
    setBusy(false)
    if (error) setErr(error)
    else {
      setPw('')
      setPw2('')
      setMsg('Password updated.')
    }
  }

  const logout = async () => {
    await signOut()
    navigate('/home')
  }

  const navList = (
    <nav aria-label="Settings sections">
      <button type="button" className="tst-nav w-full text-left px-3 py-2 rounded-xl text-sm font-semibold mb-3" data-on={section === 'overview'} onClick={() => go('overview')}>
        Your Tutor Setup
      </button>
      {SETTINGS_NAV.map(group => (
        <div key={group.group} className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted px-3 mb-1">{group.group}</p>
          {group.items.map(item => (
            <button key={item.id} type="button" className="tst-nav w-full text-left px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: 'none', border: 'none' }} data-on={section === item.id} onClick={() => go(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      ))}
      <button type="button" className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: 'none', border: 'none', color: '#E11D48' }} onClick={logout}>
        Log Out
      </button>
    </nav>
  )

  if (!userId) {
    return (
      <div className="tst-page pt-20 px-4 sm:px-6 pb-24 max-w-6xl mx-auto">
        <p className="text-sm text-muted">Loading tutor settings…</p>
      </div>
    )
  }

  return (
    <div className="tst-page pt-20 px-4 sm:px-6 pb-24 max-w-6xl mx-auto overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className="tst-avatar w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-white font-black shrink-0">
            {hub.identity.avatarUrl ? <img src={hub.identity.avatarUrl} alt="" className="w-full h-full object-cover" /> : initials}
          </div>
          <div>
            <h1 className="text-3xl font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Tutor Settings</h1>
            <p className="text-muted">Manage your professional presence, teaching preferences, availability, and account.</p>
            <p className="text-xs text-muted mt-1">{name} · Marketplace: {visibilityLabel(hub.visibility)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm lg:hidden" onClick={() => setDrawer(true)}>Settings menu</button>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate(tutorPath(hub.publicId))}>Preview Public Profile</button>
        </div>
      </div>

      {hub.visibility === 'paused' && (
        <div className="glass rounded-2xl p-4 mb-5">
          <h2 className="text-lg font-black text-ink">Tutor Account Paused</h2>
          <p className="text-sm text-muted mb-3">You are hidden from new discovery and bookings. Existing data remains intact.</p>
          <button type="button" className="btn-primary text-sm" onClick={resumeAccount}>Resume Tutor Account</button>
        </div>
      )}

      {err && (
        <div className="glass rounded-2xl p-4 mb-5 text-sm" style={{ color: '#e11d48' }}>
          {err}
          <button type="button" className="btn-glass text-xs ml-3" onClick={() => setErr(null)}>Continue</button>
        </div>
      )}

      <div className="grid lg:grid-cols-[16rem_1fr] gap-6">
        <aside className="tst-side glass rounded-3xl p-4 h-fit lg:sticky lg:top-24">{navList}</aside>
        <div>
          {section === 'overview' && <Overview hub={hub} snap={snap} onGo={go} />}
          {section === 'profile' && <ProfileCard hub={hub} onEdit={() => navigate('/tutor/profile')} />}
          {section === 'expertise' && (
            <ExpertiseCard hub={hub} skillQuery={skillQuery} suggested={suggested} onQuery={setSkillQuery} onAdd={addSkill} onPatch={patch} />
          )}
          {section === 'preferences' && <PreferencesCard hub={hub} onPatch={patch} />}
          {section === 'availability' && (
            <AvailabilityCard
              hub={hub}
              slots={slots}
              blockFrom={blockFrom}
              blockTo={blockTo}
              blockReason={blockReason}
              onFrom={setBlockFrom}
              onTo={setBlockTo}
              onReason={setBlockReason}
              onPatch={patch}
              onPreview={() => navigate(tutorBookPath(hub.publicId))}
              onSaved={(next, note) => persist(next, note)}
            />
          )}
          {section === 'pricing' && <PricingCard hub={hub} onPatch={patch} onSaved={() => persist(hub, '✓ Pricing updated')} />}
          {section === 'notifications' && <NotifyCard notify={notify} onChange={n => { setNotify(n); setStatus('idle') }} />}
          {section === 'security' && (
            <SecurityCard email={email} pw={pw} pw2={pw2} busy={busy} onPw={setPw} onPw2={setPw2} onSave={changePassword} />
          )}
          {section === 'privacy' && <PrivacyCard hub={hub} />}
          {section === 'verification' && <VerifyCard email={email} emailVerified={emailVerified} copy={verify} />}
          {section === 'visibility' && <VisibilityCard hub={hub} checks={checks} blockers={snap.blockers} onPatch={patch} onPublish={publish} />}
          {section === 'account' && (
            <AccountCard paused={hub.visibility === 'paused'} onPause={() => setPauseOpen(true)} onResume={resumeAccount} onLogout={logout} />
          )}
        </div>
      </div>

      <div className="tst-sticky -mx-4 sm:-mx-6 mt-6 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary text-sm" disabled={busy || !dirty} onClick={() => persist()}>
          {busy ? 'Saving...' : 'Save Changes'}
        </button>
        <span className="text-xs text-muted">{saveLabel}</span>
        {msg && <span className="text-sm" style={{ color: '#0F8A68' }}>{msg}</span>}
      </div>

      {drawer && (
        <div className="tst-drawer fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Settings menu">
          <div className="glass w-72 max-w-[85vw] h-full p-4 overflow-y-auto">{navList}</div>
          <button type="button" className="flex-1" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setDrawer(false)} />
        </div>
      )}

      {pauseOpen && (
        <Confirm
          title="Pause your tutor account?"
          body="You will stop receiving new discovery/bookings. Existing data remains intact. Students, courses, projects, sessions, earnings, and profile data are not deleted."
          confirm="Pause Account"
          onCancel={() => setPauseOpen(false)}
          onConfirm={pauseAccount}
        />
      )}
    </div>
  )
}

function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="tst-chip rounded-full px-3 py-1.5 text-xs font-semibold" data-on={on} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" className="tst-toggle" data-on={on} role="switch" aria-checked={on} aria-label={label} onClick={onChange}>
      <span />
    </button>
  )
}

function Overview({ hub, snap, onGo }: { hub: TutorHub; snap: ReturnType<typeof setupSnapshot>; onGo: (id: SettingsSection) => void }) {
  return (
    <section className="tst-hero glass rounded-3xl p-5">
      <h2 className="text-lg font-black text-ink mb-1">Your Tutor Setup</h2>
      <p className="text-sm text-muted mb-4">Professional identity, teaching availability, and how students discover you.</p>
      <div className="tst-progress mb-4" role="progressbar" aria-valuenow={snap.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile strength">
        <span style={{ width: `${snap.percent}%` }} />
      </div>
      <dl className="grid sm:grid-cols-2 gap-3 text-sm">
        {[
          ['Profile Strength', snap.profile],
          ['Verification Status', snap.verification],
          ['Marketplace Status', snap.marketplace],
          ['Availability Status', snap.availability],
          ['Pricing Status', snap.pricing],
        ].map(([k, v]) => (
          <div key={k} className="glass rounded-2xl p-4">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-semibold text-ink mt-1">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" className="btn-glass text-xs" onClick={() => onGo('visibility')}>Marketplace</button>
        <button type="button" className="btn-glass text-xs" onClick={() => onGo('availability')}>Availability</button>
        <button type="button" className="btn-glass text-xs" onClick={() => onGo('pricing')}>Pricing</button>
        {hub.visibility === 'draft' && <button type="button" className="btn-primary text-xs" onClick={() => onGo('visibility')}>Ready to Publish?</button>}
      </div>
      <p className="text-xs text-muted mt-4 flex flex-wrap gap-3">
        <Link to="/tutor/profile" className="text-primary">Tutor Profile</Link>
        <Link to="/tutor/sessions" className="text-primary">Sessions</Link>
        <Link to="/tutor/earnings" className="text-primary">Earnings</Link>
        <Link to="/tutor/ai" className="text-primary">AI Teaching</Link>
        <Link to="/tutor/analytics" className="text-primary">Analytics</Link>
      </p>
    </section>
  )
}

function ProfileCard({ hub, onEdit }: { hub: TutorHub; onEdit: () => void }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-1">Professional Profile</h2>
      <p className="text-sm text-muted mb-4">This is the same tutor profile students see. Edit it in the profile workspace.</p>
      <dl className="grid sm:grid-cols-2 gap-2 text-sm">
        <KV k="Name" v={hub.identity.name || 'No data yet'} />
        <KV k="Headline" v={hub.identity.headline || 'No data yet'} />
        <KV k="Languages" v={hub.languages.map(l => `${l.name} (${l.level})`).join(', ') || 'No data yet'} />
        <KV k="Teaching style" v={hub.teachingStyles.join(', ') || 'No data yet'} />
        <KV k="Intro video" v={hub.introVideoUrl.trim() ? 'Added' : 'Not added'} />
        <KV k="Portfolio" v={hub.portfolioProjectIds.length ? `${hub.portfolioProjectIds.length} linked` : 'None'} />
        <KV k="Courses" v={hub.publicCourses.length ? String(hub.publicCourses.length) : 'None'} />
        <KV k="Links" v={[hub.links.website, hub.links.linkedin].filter(Boolean).join(' · ') || 'None'} />
      </dl>
      <p className="text-sm text-muted mt-3">{hub.bio || 'Bio not written yet.'}</p>
      <div className="flex flex-wrap gap-1 mt-3">
        {hub.skills.map(s => <span key={s.name} className="badge badge-primary">{s.name} · {s.level}</span>)}
      </div>
      <button type="button" className="btn-primary text-sm mt-4" onClick={onEdit}>Edit Professional Profile</button>
    </section>
  )
}

function ExpertiseCard({
  hub, skillQuery, suggested, onQuery, onAdd, onPatch,
}: {
  hub: TutorHub
  skillQuery: string
  suggested: string[]
  onQuery: (v: string) => void
  onAdd: (name: string) => void
  onPatch: (p: Partial<TutorHub>) => void
}) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-1">Expertise</h2>
      <p className="text-sm text-muted mb-4">Skills from the existing LearnSyra taxonomy. These update tutor discovery.</p>
      {hub.skills.length === 0 && <p className="text-sm text-muted mb-3">No skills yet.</p>}
      {hub.skills.map(s => (
        <div key={s.name} className="flex flex-wrap items-center justify-between gap-2 mb-2 glass rounded-xl p-3">
          <span className="font-semibold text-sm">{s.name}</span>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-xs text-muted">
              Level
              <select className="field ml-2 px-2 py-1 text-sm" value={s.level} onChange={e => onPatch({ skills: hub.skills.map(x => x.name === s.name ? { ...x, level: e.target.value as SkillLevel } : x) })}>
                {SKILL_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </label>
            <button type="button" className="btn-glass text-xs" onClick={() => onPatch({ skills: hub.skills.filter(x => x.name !== s.name) })}>Remove</button>
          </div>
        </div>
      ))}
      <label className="text-xs font-semibold text-muted block mt-3" htmlFor="skill-add">Add Skill</label>
      <div className="flex gap-2 mt-1">
        <input id="skill-add" className="field flex-1 px-3 py-2 text-sm" value={skillQuery} onChange={e => onQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(skillQuery) } }} placeholder="Search taxonomy" />
        <button type="button" className="btn-primary text-sm" onClick={() => onAdd(skillQuery)}>Add</button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {suggested.slice(0, 8).map(s => <Chip key={s} on={false} onClick={() => onAdd(s)}>{s}</Chip>)}
      </div>
    </section>
  )
}

function PreferencesCard({ hub, onPatch }: { hub: TutorHub; onPatch: (p: Partial<TutorHub>) => void }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-1">Teaching Preferences</h2>
      <p className="text-sm text-muted mb-4">These update your public profile and matching signals. They do not change student records automatically.</p>
      <fieldset className="mb-4">
        <legend className="text-xs font-semibold text-muted mb-2">Teaching Style</legend>
        <div className="flex flex-wrap gap-2">
          {TEACHING_STYLE_TAGS.map(tag => (
            <Chip key={tag} on={hub.teachingStyles.includes(tag)} onClick={() => onPatch({ teachingStyles: hub.teachingStyles.includes(tag) ? hub.teachingStyles.filter(t => t !== tag) : [...hub.teachingStyles, tag as TeachingStyleTag] })}>{tag}</Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="mb-4">
        <legend className="text-xs font-semibold text-muted mb-2">Preferred Student Levels</legend>
        <div className="flex flex-wrap gap-2">
          {STUDENT_LEVELS.map(l => (
            <Chip key={l} on={hub.preferredStudentLevels.includes(l)} onClick={() => onPatch({ preferredStudentLevels: toggleLevel(hub.preferredStudentLevels, l) })}>{l}</Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="mb-4">
        <legend className="text-xs font-semibold text-muted mb-2">Preferred Session Types</legend>
        <div className="flex flex-wrap gap-2">
          {hub.sessionOffers.map(o => (
            <Chip key={o.id} on={o.enabled} onClick={() => onPatch({ sessionOffers: hub.sessionOffers.map(x => x.id === o.id ? { ...x, enabled: !x.enabled } : x) })}>{o.label}</Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold text-muted mb-2">Preferred Topics</legend>
        <p className="text-sm text-muted">{hub.skills.length ? hub.skills.map(s => s.name).join(' · ') : 'Add expertise to use as preferred topics.'}</p>
      </fieldset>
    </section>
  )
}

function AvailabilityCard({
  hub, slots, blockFrom, blockTo, blockReason, onFrom, onTo, onReason, onPatch, onPreview, onSaved,
}: {
  hub: TutorHub
  slots: { date: Date; time: string }[]
  blockFrom: string
  blockTo: string
  blockReason: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  onReason: (v: string) => void
  onPatch: (p: Partial<TutorHub>) => void
  onPreview: () => void
  onSaved: (hub: TutorHub, note: string) => void
}) {
  const setDay = (day: (typeof WEEKDAYS)[number], next: Partial<TutorHub['availability'][number]>) => {
    onPatch({ availability: hub.availability.map(d => d.day === day ? { ...d, ...next } : d) })
  }
  return (
    <div className="space-y-5">
      <section className="glass rounded-2xl p-5">
        <h2 className="text-lg font-black text-ink mb-1">Availability</h2>
        <p className="text-sm text-muted mb-4">Same weekly schedule used by student booking. Status: {availabilityStatus(hub)}.</p>
        {WEEKDAYS.map(day => {
          const row = hub.availability.find(d => d.day === day)!
          return (
            <div key={day} className="glass rounded-xl p-3 mb-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <Chip on={row.enabled} onClick={() => setDay(day, { enabled: !row.enabled })}>{day} · {row.enabled ? 'Available' : 'Unavailable'}</Chip>
                {row.enabled && (
                  <button type="button" className="btn-glass text-xs" onClick={() => setDay(day, { extraRanges: [...(row.extraRanges ?? []), addExtraRange()] })}>Add Time Slot</button>
                )}
              </div>
              {row.enabled && (
                <div className="space-y-2">
                  <SlotRow start={row.start} end={row.end} onStart={v => setDay(day, { start: v })} onEnd={v => setDay(day, { end: v })} />
                  {(row.extraRanges ?? []).map(r => (
                    <SlotRow
                      key={r.id}
                      start={r.start}
                      end={r.end}
                      onStart={v => setDay(day, { extraRanges: (row.extraRanges ?? []).map(x => x.id === r.id ? { ...x, start: v } : x) })}
                      onEnd={v => setDay(day, { extraRanges: (row.extraRanges ?? []).map(x => x.id === r.id ? { ...x, end: v } : x) })}
                      onRemove={() => setDay(day, { extraRanges: (row.extraRanges ?? []).filter(x => x.id !== r.id) })}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-muted mb-2">Session duration</legend>
          <div className="flex flex-wrap gap-2">
            {SESSION_DURATIONS.map(n => <Chip key={n} on={hub.sessionDuration === n} onClick={() => onPatch({ sessionDuration: n })}>{n} min</Chip>)}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-muted mb-2">Buffer time</legend>
          <div className="flex flex-wrap gap-2">
            {BUFFER_OPTIONS.map(n => <Chip key={n} on={hub.bufferMinutes === n} onClick={() => onPatch({ bufferMinutes: n })}>{n === 0 ? 'No buffer' : `${n} minutes`}</Chip>)}
          </div>
        </fieldset>
        <button type="button" className="btn-primary text-sm mt-4" onClick={() => onSaved(hub, '✓ Availability updated')}>Save availability</button>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-lg font-black text-ink mb-2">Blocked Dates</h2>
        {(hub.blockedDates ?? []).length === 0 && <p className="text-sm text-muted mb-3">No blocked dates yet.</p>}
        {(hub.blockedDates ?? []).map(b => (
          <div key={b.id} className="flex flex-wrap justify-between gap-2 mb-2 text-sm">
            <span>{b.from} – {b.to}{b.reason ? ` · ${b.reason}` : ''}</span>
            <button type="button" className="btn-glass text-xs" onClick={() => onPatch({ blockedDates: hub.blockedDates.filter(x => x.id !== b.id) })}>Remove</button>
          </div>
        ))}
        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          <label className="text-xs font-semibold text-muted">From<input type="date" className="field mt-1 w-full px-3 py-2 text-sm" value={blockFrom} onChange={e => onFrom(e.target.value)} /></label>
          <label className="text-xs font-semibold text-muted">To<input type="date" className="field mt-1 w-full px-3 py-2 text-sm" value={blockTo} onChange={e => onTo(e.target.value)} /></label>
          <label className="text-xs font-semibold text-muted">Reason (optional)<input className="field mt-1 w-full px-3 py-2 text-sm" value={blockReason} onChange={e => onReason(e.target.value)} /></label>
        </div>
        <button
          type="button"
          className="btn-glass text-sm mt-3"
          onClick={() => {
            if (!blockFrom || !blockTo) return
            onPatch({ blockedDates: [...hub.blockedDates, { id: uid('block'), from: blockFrom, to: blockTo, reason: blockReason.trim() }] })
            onFrom('')
            onTo('')
            onReason('')
          }}
        >
          Add blocked date
        </button>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-lg font-black text-ink mb-2">Student View</h2>
        <p className="text-sm text-muted mb-3">Your next available sessions</p>
        {slots.length === 0 ? <p className="text-sm text-muted">No open slots from the current availability rules.</p> : slots.map(s => (
          <div key={`${s.date.toISOString()}-${s.time}`} className="text-sm mb-1">{s.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.time}</div>
        ))}
        <button type="button" className="btn-glass text-sm mt-3" onClick={onPreview}>Preview Booking</button>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-lg font-black text-ink mb-2">Vacation Mode</h2>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Pause new bookings</p>
            {hub.vacationMode && <p className="text-xs text-muted mt-1">Students will not be able to book new sessions during this period. Existing booked sessions are not cancelled.</p>}
          </div>
          <Toggle on={hub.vacationMode} label="Pause new bookings" onChange={() => onPatch({ vacationMode: !hub.vacationMode })} />
        </div>
      </section>
    </div>
  )
}

function SlotRow({ start, end, onStart, onEnd, onRemove }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void; onRemove?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-muted">Start<input type="time" className="field ml-1 px-2 py-1 text-sm" value={start} onChange={e => onStart(e.target.value)} /></label>
      <label className="text-xs text-muted">End<input type="time" className="field ml-1 px-2 py-1 text-sm" value={end} onChange={e => onEnd(e.target.value)} /></label>
      <span className="text-xs text-muted">{toDisplayTime(start)} – {toDisplayTime(end)}</span>
      {onRemove && <button type="button" className="btn-glass text-xs" onClick={onRemove}>Remove</button>}
    </div>
  )
}

function PricingCard({ hub, onPatch, onSaved }: { hub: TutorHub; onPatch: (p: Partial<TutorHub>) => void; onSaved: () => void }) {
  const missing = hub.sessionOffers.some(s => s.enabled && s.hourlyRate <= 0)
  const setOffer = (id: SessionOffer['id'], next: Partial<SessionOffer>) => {
    onPatch({ sessionOffers: hub.sessionOffers.map(o => o.id === id ? { ...o, ...next } : o) })
  }
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-1">Session Pricing</h2>
      <p className="text-sm text-muted mb-4">INR ₹ · same rates used on the public booking page. {pricingStatus(hub)}</p>
      {missing && <p className="text-sm mb-3" style={{ color: '#B45309' }}>Add pricing before accepting paid bookings.</p>}
      {hub.sessionOffers.map(o => (
        <div key={o.id} className="glass rounded-xl p-3 mb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Chip on={o.enabled} onClick={() => setOffer(o.id, { enabled: !o.enabled })}>{o.label}</Chip>
            {o.enabled && (
              <label className="text-xs text-muted">
                Price / hour
                <input
                  type="number"
                  min={0}
                  className="field ml-2 px-3 py-1.5 text-sm w-28"
                  value={o.hourlyRate || ''}
                  onChange={e => setOffer(o.id, { hourlyRate: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
            )}
          </div>
          {o.enabled && <p className="text-xs text-muted mt-2">Current rate: {o.hourlyRate > 0 ? `${formatInr(o.hourlyRate)}/hr` : 'Not set'}</p>}
        </div>
      ))}
      <p className="text-xs text-muted mt-2">Free booking is not offered as a separate product. A ₹0 rate is not bookable.</p>
      <button type="button" className="btn-primary text-sm mt-4" onClick={onSaved}>Save pricing</button>
    </section>
  )
}

function NotifyCard({ notify, onChange }: { notify: NotifyPrefs; onChange: (n: NotifyPrefs) => void }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-1">Notifications</h2>
      <p className="text-sm text-muted mb-4">These are delivery preferences only. LearnSyra does not send email from this screen.</p>
      {NOTIFY_CATEGORIES.map(cat => {
        const row = notify[cat.id]
        return (
          <div key={cat.id} className="glass rounded-xl p-3 mb-2">
            <div className="font-semibold text-sm">{cat.title}</div>
            <p className="text-xs text-muted mb-2">{cat.items}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.email} onChange={() => onChange({ ...notify, [cat.id]: { ...row, email: !row.email } })} /> Email</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.inApp} onChange={() => onChange({ ...notify, [cat.id]: { ...row, inApp: !row.inApp } })} /> In-App</label>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function SecurityCard({ email, pw, pw2, busy, onPw, onPw2, onSave }: { email: string; pw: string; pw2: string; busy: boolean; onPw: (v: string) => void; onPw2: (v: string) => void; onSave: () => void }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-3">Security</h2>
      <KV k="Email" v={email || 'Not available'} />
      <div className="mt-4">
        <label className="text-xs font-semibold text-muted block" htmlFor="new-pw">Change Password</label>
        <input id="new-pw" type="password" className="field w-full mt-1 mb-2 px-3 py-2 text-sm" value={pw} onChange={e => onPw(e.target.value)} autoComplete="new-password" />
        <label className="text-xs font-semibold text-muted block" htmlFor="new-pw2">Confirm password</label>
        <input id="new-pw2" type="password" className="field w-full mt-1 mb-3 px-3 py-2 text-sm" value={pw2} onChange={e => onPw2(e.target.value)} autoComplete="new-password" />
        <button type="button" className="btn-primary text-sm" disabled={busy} onClick={onSave}>Change Password</button>
      </div>
      <div className="mt-5 text-sm">
        <h3 className="font-semibold mb-1">Active Sessions</h3>
        <p className="text-muted">Session management is handled by the authentication provider.</p>
      </div>
      <div className="mt-4 text-sm">
        <h3 className="font-semibold mb-1">Two-Factor Authentication</h3>
        <p className="text-muted">Two-factor authentication will be available when supported by the authentication system.</p>
      </div>
    </section>
  )
}

function PrivacyCard({ hub }: { hub: TutorHub }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-2">Privacy</h2>
      <p className="text-sm text-muted mb-4">Marketplace status: {visibilityLabel(hub.visibility)}. Public tutor pages follow existing profile rules.</p>
      <h3 className="font-semibold text-sm mb-1">Public Profile</h3>
      <p className="text-sm text-muted mb-3">Name, headline, bio, skills, rating if real, pricing, and availability.</p>
      <h3 className="font-semibold text-sm mb-1">Private</h3>
      <p className="text-sm text-muted">Email, phone, private notes, financial information, and verification documents are not shown on the public profile.</p>
    </section>
  )
}

function VerifyCard({ email, emailVerified, copy }: { email: string; emailVerified: boolean; copy: ReturnType<typeof verificationDisplay> }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-1">Verification Center</h2>
      <p className="text-sm text-muted mb-4">Build trust with students by completing supported verification steps.</p>
      <p className="text-xs text-muted mb-4">{copy.badgeCopy}</p>
      <div className="glass rounded-xl p-4 mb-3">
        <h3 className="font-semibold text-sm">Identity Verification</h3>
        <p className="text-xs text-muted mt-1">Not available</p>
        <p className="text-sm mt-2">{copy.identityCopy}</p>
      </div>
      <div className="glass rounded-xl p-4 mb-3">
        <h3 className="font-semibold text-sm">Email</h3>
        <p className="text-sm mt-1">{email || 'Not available'} · {emailVerified ? 'Verified' : 'Not Verified'}</p>
      </div>
      <div className="glass rounded-xl p-4 mb-3">
        <h3 className="font-semibold text-sm">Phone</h3>
        <p className="text-sm mt-1">{copy.phoneCopy}</p>
      </div>
      <div className="glass rounded-xl p-4">
        <h3 className="font-semibold text-sm">Professional Credentials</h3>
        <p className="text-sm mt-1">{copy.documentsCopy}</p>
      </div>
    </section>
  )
}

function VisibilityCard({ hub, checks, blockers, onPatch, onPublish }: { hub: TutorHub; checks: ReturnType<typeof settingsChecklist>; blockers: string[]; onPatch: (p: Partial<TutorHub>) => void; onPublish: () => void }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-3">Marketplace Visibility</h2>
      {(['published', 'draft', 'paused'] as ProfileVisibility[]).map(v => (
        <label key={v} className="flex items-start gap-2 mb-3 text-sm">
          <input type="radio" name="vis" checked={hub.visibility === v} onChange={() => onPatch({ visibility: v === 'published' && blockers.length ? hub.visibility : v })} />
          <span>
            <span className="font-semibold capitalize">{visibilityLabel(v)}</span>
            <span className="block text-xs text-muted">{visibilityHelp(v)}</span>
          </span>
        </label>
      ))}
      <h3 className="text-base font-black text-ink mt-5 mb-2">Ready to Publish?</h3>
      <ul className="space-y-2 text-sm mb-4">
        {checks.map(c => (
          <li key={c.id} className="flex gap-2">
            <span aria-hidden>{c.done ? '✓' : '○'}</span>
            {c.label}{c.optional ? ' (optional)' : ''}
          </li>
        ))}
      </ul>
      {blockers.length > 0 ? (
        <p className="text-sm mb-3" style={{ color: '#e11d48' }}>Complete Required Fields: {blockers.join(', ')}</p>
      ) : null}
      <button type="button" className="btn-primary text-sm" disabled={blockers.length > 0} onClick={onPublish}>Publish Profile</button>
    </section>
  )
}

function AccountCard({ paused, onPause, onResume, onLogout }: { paused: boolean; onPause: () => void; onResume: () => void; onLogout: () => void }) {
  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="text-lg font-black text-ink mb-2">Pause Tutor Account</h2>
      <p className="text-sm text-muted mb-3">Pause new student discovery. Existing students, courses, projects, sessions, earnings, and profile data stay in place.</p>
      {paused ? (
        <button type="button" className="btn-primary text-sm" onClick={onResume}>Resume Tutor Account</button>
      ) : (
        <button type="button" className="btn-glass text-sm" onClick={onPause}>Pause Tutor Account</button>
      )}
      <div className="mt-6">
        <h3 className="font-semibold mb-2">Log Out</h3>
        <button type="button" className="btn-glass text-sm" onClick={onLogout}>Log Out</button>
      </div>
      <div className="mt-6">
        <h3 className="font-semibold mb-1" style={{ color: '#E11D48' }}>Danger Zone</h3>
        <p className="text-sm text-muted">Account deletion is managed by platform support.</p>
      </div>
    </section>
  )
}

function Confirm({ title, body, confirm, extra, onCancel, onConfirm, onExtra }: { title: string; body: string; confirm: string; extra?: string; onCancel: () => void; onConfirm: () => void; onExtra?: () => void }) {
  return (
    <div className="tst-drawer fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tst-confirm">
      <button type="button" className="absolute inset-0" aria-label="Stay" style={{ background: 'transparent', border: 'none' }} onClick={onCancel} />
      <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
        <h2 id="tst-confirm" className="text-lg font-black text-ink mb-2">{title}</h2>
        <p className="text-sm text-muted mb-4">{body}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-glass text-sm" onClick={onCancel}>Stay</button>
          {onExtra && extra && <button type="button" className="btn-primary text-sm" onClick={onExtra}>{extra}</button>}
          <button type="button" className="btn-glass text-sm" style={{ color: '#E11D48' }} onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 mb-1"><dt className="text-muted">{k}</dt><dd className="font-medium text-right">{v}</dd></div>
}
