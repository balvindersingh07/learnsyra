import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { loadAccountStatus, setAccountStatus } from '../lib/adminUsers'
import {
  entityAdminHref,
  formatWhen,
  isAiModerationAvailable,
  isReportAuditAvailable,
  isReportEscalationAvailable,
  isReportModerationAvailable,
  loadAdminReportIndex,
  loadReportNotes,
  saveReportNote,
  type AdminReportIndex,
  type AdminReportRow,
} from '../lib/adminReports'
import './admin-control.css'

export default function AdminReportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminReportIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [explain, setExplain] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminReportIndex()
      .then(setIndex)
      .catch(() => setError("Report details couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (id) setNote(loadReportNotes()[id] ?? '')
  }, [id])
  useEffect(() => {
    if (!explain) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setExplain(null)
        return
      }
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (explain === 'suspend' && id) {
        const reportId = index?.rows.find(r => r.id === id)?.entityId
        if (reportId) {
          setAccountStatus(reportId, 'suspended')
          setMsg('Account marked suspended in Admin view. This is the existing User Management overlay until account status is connected server-side.')
        }
        setExplain(null)
        return
      }
      if (explain === 'reactivate' && id) {
        const reportId = index?.rows.find(r => r.id === id)?.entityId
        if (reportId) {
          setAccountStatus(reportId, 'active')
          setMsg('Account marked active in Admin view. This is the existing User Management overlay until account status is connected server-side.')
        }
        setExplain(null)
        return
      }
      setExplain(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [explain, id, index])

  const report: AdminReportRow | null = index?.rows.find(r => r.id === id) ?? null
  const href = report ? entityAdminHref(report) : null
  const entityKind = ((report?.entityType || report?.type) || '').toLowerCase()
  const entityProfile = report?.entityId ? index?.profiles.find(p => p.id === report.entityId) ?? null : null
  const accountStatus = report?.entityId ? (loadAccountStatus()[report.entityId] ?? 'active') : null
  const isCourse = /course/.test(entityKind)
  const isProject = /project/.test(entityKind)
  const isSession = /session|booking/.test(entityKind)
  const isTutorEntity = /tutor/.test(entityKind) || (!isCourse && !isProject && !isSession && entityProfile?.role === 'tutor')
  const isUserEntity = /user|student|account/.test(entityKind) || (!isCourse && !isProject && !isSession && !isTutorEntity && !!entityProfile)
  const actions = isReportModerationAvailable()
  const escalate = isReportEscalationAvailable()
  const audit = isReportAuditAvailable()
  const ai = isAiModerationAvailable()
  const blocked = 'Moderation actions are not connected.'

  const applyAccount = (status: 'active' | 'suspended') => {
    if (!report?.entityId) return
    setAccountStatus(report.entityId, status)
    setMsg(status === 'suspended'
      ? 'Account marked suspended in Admin view. This is the existing User Management overlay until account status is connected server-side.'
      : 'Account marked active in Admin view. This is the existing User Management overlay until account status is connected server-side.')
    setExplain(null)
  }

  return (
    <AdminShell>
      <div className="ac-dash">
        <button type="button" className="btn-glass text-xs mb-3" onClick={() => navigate('/admin/reports')}>← Reports</button>
        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {loading && <div className="ac-skel mb-4" aria-busy="true" />}
        {!loading && !index?.available && !error && (
          <section className="glass rounded-2xl p-5">
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Reporting infrastructure unavailable</h1>
            <p className="text-[13px] text-muted">Report details couldn't be loaded. No report records are available from the current platform backend.</p>
            <button type="button" className="btn-primary text-xs mt-3" onClick={load}>Retry</button>
          </section>
        )}
        {!loading && index?.available && !report && !error && (
          <p className="text-[13px] text-muted">Report details couldn't be loaded. This ID is not in the reporting records.</p>
        )}
        {report && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{report.id}</h1>
                <p className="text-[13px] text-muted">
                  {report.status || 'Status unavailable'} · {report.type || 'Type unavailable'} · {report.priority || 'Priority unavailable'} · {report.createdAt ? formatWhen(report.createdAt) : 'Created unavailable'}
                </p>
              </div>
              {href && <button type="button" className="btn-glass text-xs" onClick={() => navigate(href)}>View entity →</button>}
            </div>
            {report.demo && <div className="glass rounded-2xl p-3 mb-3 text-sm ac-warn">Demo Report Data — Not Production Data</div>}
            {msg && <p className="text-[13px] mb-3" style={{ color: '#0F8A68' }}>{msg}</p>}

            <div className="grid lg:grid-cols-2 gap-3 mb-3">
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Report</h2>
                <dl className="grid gap-1.5 text-[13px]">
                  <KV k="Report ID" v={report.id} />
                  <KV k="Status" v={report.status || '—'} />
                  <KV k="Type" v={report.type || '—'} />
                  <KV k="Priority" v={report.priority || '—'} />
                  <KV k="Created" v={report.createdAt ? formatWhen(report.createdAt) : '—'} />
                  <KV k="Reported entity" v={report.entityName || report.entityId || '—'} />
                  <KV k="Entity type" v={report.entityType || '—'} />
                  <KV k="Reporter" v={report.reporterName || report.reporterId || '—'} />
                  <KV k="Reason" v={report.reason || '—'} />
                  <KV k="Description" v={report.description || 'Not provided'} />
                </dl>
                <h2 className="font-black text-ink mt-3">Evidence</h2>
                <p className="text-[13px] text-muted">{report.evidence || 'Evidence unavailable.'}</p>
                {(isUserEntity || isTutorEntity) && (
                  <>
                    <h2 className="font-black text-ink mt-3">{isTutorEntity ? 'Tutor' : 'User'}</h2>
                    <dl className="grid gap-1.5 text-[13px]">
                      <KV k="Name" v={entityProfile?.full_name || report.entityName || '—'} />
                      <KV k="Role" v={entityProfile?.role || (isTutorEntity ? 'tutor' : '—')} />
                      {isTutorEntity && <KV k="Headline" v={entityProfile?.headline || '—'} />}
                      <KV k="Account status" v={accountStatus || '—'} />
                    </dl>
                    <p className="text-[11px] text-muted mt-2">Operational context only. Private notes, AI chats, verification documents, and credentials are not shown.</p>
                    {report.entityId && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button type="button" className="btn-glass text-xs" onClick={() => setExplain('suspend')}>Suspend</button>
                        <button type="button" className="btn-glass text-xs" onClick={() => setExplain('reactivate')}>Reactivate</button>
                      </div>
                    )}
                  </>
                )}
              </section>
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Status</h2>
                <div className="ac-health"><span>Status</span><span>{report.status || '—'}</span></div>
                <div className="ac-health"><span>Priority</span><span>{report.priority || '—'}</span></div>
                <h2 className="font-black text-ink mt-3">Actions</h2>
                <p className="text-[13px] text-muted mb-2">{blocked}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button type="button" className="btn-glass text-xs" aria-disabled={!actions} onClick={() => setExplain(blocked)}>Mark Investigating</button>
                  <button type="button" className="btn-glass text-xs" aria-disabled={!actions} onClick={() => setExplain(blocked)}>Resolve</button>
                  <button type="button" className="btn-glass text-xs" aria-disabled={!actions} onClick={() => setExplain(blocked)}>Dismiss</button>
                  <button type="button" className="btn-glass text-xs" aria-disabled={!escalate} onClick={() => setExplain('Escalation workflow unavailable.')}>Escalate</button>
                </div>
                <h2 className="font-black text-ink">AI Moderation Insight</h2>
                <p className="text-[13px] text-muted">{ai ? 'Advisory only.' : 'AI moderation insights unavailable.'}</p>
              </section>
            </div>
            <section className="glass rounded-2xl p-3.5">
              <h2 className="font-black text-ink">Related records</h2>
              <p className="text-[13px] text-muted mb-3">{href ? 'Open the matching Admin record for operational context. Student and Tutor workspaces are not used for moderation.' : 'No related Admin record is linked on this report.'}</p>
              <h2 className="font-black text-ink">History</h2>
              <p className="text-[13px] text-muted mb-3">No moderation history available.</p>
              <h2 className="font-black text-ink">Audit</h2>
              <p className="text-[13px] text-muted mb-3">{audit ? 'See /admin/audit for recorded events.' : 'Audit persistence is unavailable. Actions are not claimed as audited.'}</p>
              <label className="block text-[12px] font-semibold text-muted">
                Admin notes
                <textarea className="field mt-1 w-full px-3 py-2 text-sm" rows={3} value={note} onChange={e => setNote(e.target.value)} />
              </label>
              <button type="button" className="btn-glass text-xs mt-2" onClick={() => { saveReportNote(report.id, note); setMsg('Admin note saved in the Admin-only report notes store.') }}>Save note</button>
            </section>
          </>
        )}
      </div>

      {explain && (
        <div className="ac-drawer fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="rpt-mod-title">
          <button type="button" className="absolute inset-0" aria-label="Close" style={{ background: 'transparent', border: 'none' }} onClick={() => setExplain(null)} />
          <div className="glass rounded-3xl p-6 relative z-10 w-full max-w-md">
            <h2 id="rpt-mod-title" className="text-lg font-black text-ink mb-2">
              {explain === 'suspend' ? 'Suspend account?' : explain === 'reactivate' ? 'Reactivate account?' : 'Unavailable'}
            </h2>
            <p className="text-sm text-muted mb-4">
              {explain === 'suspend' && 'This uses the existing Admin User Management overlay. It does not create a separate account-status system, and it is not a server-side ban until that overlay is connected.'}
              {explain === 'reactivate' && 'This restores the existing Admin User Management overlay to active. Platform-wide login blocks apply only when account status is connected server-side.'}
              {explain !== 'suspend' && explain !== 'reactivate' && explain}
            </p>
            <div className="flex flex-wrap gap-2">
              {(explain === 'suspend' || explain === 'reactivate') && (
                <button type="button" className="btn-primary text-sm" onClick={() => applyAccount(explain === 'suspend' ? 'suspended' : 'active')}>Confirm</button>
              )}
              <button type="button" className={explain === 'suspend' || explain === 'reactivate' ? 'btn-glass text-sm' : 'btn-primary text-sm'} onClick={() => setExplain(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted shrink-0">{k}</dt><dd className="font-medium text-right break-all">{v}</dd></div>
}
