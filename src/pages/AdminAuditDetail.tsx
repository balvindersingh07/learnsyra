import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  auditEntityHref,
  formatWhen,
  loadAdminAuditIndex,
  type AdminAuditEvent,
  type AdminAuditIndex,
} from '../lib/adminAudit'
import './admin-control.css'

export default function AdminAuditDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [index, setIndex] = useState<AdminAuditIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    setLoading(true)
    loadAdminAuditIndex()
      .then(setIndex)
      .catch(() => setError("Audit event couldn't be loaded."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const event: AdminAuditEvent | null = index?.rows.find(r => r.id === id) ?? null
  const href = event ? auditEntityHref(event) : null

  return (
    <AdminShell>
      <div className="ac-dash">
        <button type="button" className="btn-glass text-xs mb-3" onClick={() => navigate('/admin/audit')}>← Audit Logs</button>
        {error && (
          <div className="glass rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#e11d48' }}>
            {error}
            <button type="button" className="btn-primary text-xs ml-3" onClick={load}>Retry</button>
          </div>
        )}
        {loading && <div className="ac-skel mb-4" aria-busy="true" />}
        {!loading && !index?.available && !error && (
          <section className="glass rounded-2xl p-5">
            <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Audit infrastructure unavailable</h1>
            <p className="text-[13px] text-muted">Audit event couldn't be loaded. No persisted audit events are available from the current backend.</p>
            <button type="button" className="btn-primary text-xs mt-3" onClick={load}>Retry</button>
          </section>
        )}
        {!loading && index?.available && !event && !error && (
          <p className="text-[13px] text-muted">Audit event couldn't be loaded. This ID is not in the persisted audit records.</p>
        )}
        {event && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h1 className="font-black text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{event.action || event.id}</h1>
                <p className="text-[13px] text-muted">{event.createdAt ? formatWhen(event.createdAt) : 'Timestamp unavailable'} · {event.status || 'Status unavailable'}</p>
              </div>
              {href && <button type="button" className="btn-glass text-xs" onClick={() => navigate(href)}>View entity →</button>}
            </div>
            {event.demo && <div className="glass rounded-2xl p-3 mb-3 text-sm ac-warn">Demo Audit Data — Not Production Activity</div>}
            <div className="grid lg:grid-cols-2 gap-3 mb-3">
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Event</h2>
                <dl className="grid gap-1.5 text-[13px]">
                  <KV k="Event ID" v={event.id} />
                  <KV k="Timestamp" v={event.createdAt ? formatWhen(event.createdAt) : '—'} />
                  <KV k="Action" v={event.action || '—'} />
                  <KV k="Status" v={event.status || '—'} />
                  <KV k="Source" v={event.source || '—'} />
                  <KV k="Description" v={event.description || 'Not provided'} />
                </dl>
              </section>
              <section className="glass rounded-2xl p-3.5">
                <h2 className="font-black text-ink">Actor</h2>
                <dl className="grid gap-1.5 text-[13px]">
                  <KV k="Actor" v={event.actorName || 'Actor unavailable'} />
                  <KV k="Actor ID" v={event.actorId || '—'} />
                  <KV k="Role" v={event.actorRole || '—'} />
                </dl>
                <h2 className="font-black text-ink mt-3">Entity</h2>
                <dl className="grid gap-1.5 text-[13px]">
                  <KV k="Type" v={event.entityType || '—'} />
                  <KV k="Name" v={event.entityName || '—'} />
                  <KV k="Entity ID" v={event.entityId || '—'} />
                </dl>
              </section>
            </div>
            <section className="glass rounded-2xl p-3.5">
              <h2 className="font-black text-ink">Before / After</h2>
              {event.changes.length === 0 && <p className="text-[13px] text-muted">No before/after values are stored on this event.</p>}
              {event.changes.map(c => (
                <div key={c.field} className="ac-health">
                  <span>{c.field}</span>
                  <span>{c.before} → {c.after}</span>
                </div>
              ))}
              <h2 className="font-black text-ink mt-3">Metadata</h2>
              {event.metadata.length === 0 && <p className="text-[13px] text-muted">No safe metadata is attached to this event.</p>}
              {event.metadata.map(m => <KV key={m.key} k={m.key} v={m.value} />)}
              <p className="text-[11px] text-muted mt-3">Sensitive fields such as passwords, tokens, and private notes are omitted. This event cannot be edited or deleted from Admin.</p>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 text-[13px]"><dt className="text-muted shrink-0">{k}</dt><dd className="font-medium text-right break-all">{v}</dd></div>
}
