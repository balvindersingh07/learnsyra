import { getAllProfiles, type ProfileLite } from './api'
import { formatWhen, paginate } from './adminUsers'
import { isSupabaseConfigured, supabase } from './supabase'

export type AuditDateFilter = 'any' | 'today' | '7d' | '30d' | '3m' | '6m' | '1y' | 'custom'
export type AuditSort = 'newest' | 'oldest' | 'action' | 'actor' | 'entity'

export interface AuditChange {
  field: string
  before: string
  after: string
}

export interface AuditMeta {
  key: string
  value: string
}

export interface AdminAuditEvent {
  id: string
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  action: string | null
  entityType: string | null
  entityId: string | null
  entityName: string | null
  status: string | null
  source: string | null
  description: string | null
  createdAt: string | null
  changes: AuditChange[]
  metadata: AuditMeta[]
  demo: boolean
}

export interface AdminAuditIndex {
  available: boolean
  rows: AdminAuditEvent[]
  profiles: ProfileLite[]
}

export interface AuditQuery {
  q: string
  actor: string
  action: string
  entity: string
  status: string
  date: AuditDateFilter
  customFrom: string
  customTo: string
  sort: AuditSort
}

const PAGE_SIZE = 20
const SENSITIVE = /password|passwd|token|secret|api[_-]?key|authorization|bearer|jwt|cvv|cvc|pan|iban|bank|card|private|note|chat|resume|ssn|service.?role/i

export { formatWhen, paginate }

export function auditPageSize() {
  return PAGE_SIZE
}

export function isAuditExportAvailable() {
  return false
}

export function isAuditRealtimeAvailable() {
  return false
}

function asStr(v: unknown) {
  if (typeof v === 'string' && v.trim()) return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k]
  }
  return null
}

function safeValue(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

function sanitizeMeta(raw: unknown): AuditMeta[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const out: AuditMeta[] = []
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (SENSITIVE.test(key)) continue
    const text = safeValue(value)
    if (!text || SENSITIVE.test(text)) continue
    out.push({ key, value: text })
  }
  return out
}

function changesFrom(raw: Record<string, unknown>, meta: AuditMeta[]): AuditChange[] {
  const before = asStr(pick(raw, ['old_status', 'previous_status', 'old_value', 'before']))
  const after = asStr(pick(raw, ['new_status', 'next_status', 'new_value', 'after']))
  const field = asStr(pick(raw, ['changed_field', 'field'])) || 'Status'
  const out: AuditChange[] = []
  if (before && after) out.push({ field, before, after })
  const beforeMeta = meta.find(m => /^(before|old)/i.test(m.key))
  const afterMeta = meta.find(m => /^(after|new)/i.test(m.key))
  if (beforeMeta && afterMeta && !out.length) out.push({ field: 'Change', before: beforeMeta.value, after: afterMeta.value })
  return out
}

function normalize(raw: Record<string, unknown>, profiles: ProfileLite[]): AdminAuditEvent | null {
  const id = asStr(pick(raw, ['id', 'event_id', 'audit_id']))
  if (!id) return null
  const actorId = asStr(pick(raw, ['actor_id', 'admin_id', 'user_id', 'created_by']))
  const actorFromProfile = actorId ? profiles.find(p => p.id === actorId) : null
  const meta = sanitizeMeta(pick(raw, ['metadata', 'meta', 'payload', 'details', 'changes']))
  return {
    id,
    actorId,
    actorName: asStr(pick(raw, ['actor_name', 'admin_name', 'user_name'])) || actorFromProfile?.full_name || null,
    actorRole: asStr(pick(raw, ['actor_role', 'role'])) || actorFromProfile?.role || null,
    action: asStr(pick(raw, ['action', 'event_type', 'type', 'event'])),
    entityType: asStr(pick(raw, ['entity_type', 'target_type', 'resource_type', 'object_type'])),
    entityId: asStr(pick(raw, ['entity_id', 'target_id', 'resource_id', 'object_id'])),
    entityName: asStr(pick(raw, ['entity_name', 'target_name', 'resource_name'])),
    status: asStr(pick(raw, ['status', 'result', 'outcome'])),
    source: asStr(pick(raw, ['source', 'origin', 'channel'])),
    description: asStr(pick(raw, ['description', 'message', 'summary'])),
    createdAt: asStr(pick(raw, ['created_at', 'occurred_at', 'timestamp', 'createdAt'])),
    changes: changesFrom(raw, meta),
    metadata: meta,
    demo: id.startsWith('demo-') || actorId?.startsWith('demo-') === true,
  }
}

async function probeTable(name: string): Promise<Record<string, unknown>[] | null> {
  if (!isSupabaseConfigured) return null
  const ordered = await supabase.from(name).select('*').order('created_at', { ascending: false }).limit(200)
  if (!ordered.error) return (ordered.data as Record<string, unknown>[] | null) ?? []
  const plain = await supabase.from(name).select('*').limit(200)
  if (plain.error) return null
  return (plain.data as Record<string, unknown>[] | null) ?? []
}

async function probeAudit(profiles: ProfileLite[]): Promise<{ available: boolean; rows: AdminAuditEvent[] }> {
  const data = await probeTable('audit_logs')
  if (!data) return { available: false, rows: [] }
  const rows = data.map(r => normalize(r, profiles)).filter((r): r is AdminAuditEvent => r != null)
  return { available: true, rows }
}

export async function loadAdminAuditIndex(): Promise<AdminAuditIndex> {
  const profiles = await getAllProfiles().catch(() => [] as ProfileLite[])
  const pack = await probeAudit(profiles)
  return { available: pack.available, rows: pack.rows, profiles }
}

function isToday(iso: string | null) {
  if (!iso) return false
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

function isSecurity(row: AdminAuditEvent) {
  const t = `${row.action || ''} ${row.entityType || ''}`.toLowerCase()
  return /login|logout|permission|role|security|auth|2fa|password/.test(t)
}

function isAdminActor(row: AdminAuditEvent) {
  return (row.actorRole || '').toLowerCase() === 'admin'
}

function isUserActor(row: AdminAuditEvent) {
  const r = (row.actorRole || '').toLowerCase()
  return r === 'student' || r === 'user' || r === 'tutor'
}

function isFailed(row: AdminAuditEvent) {
  return /fail|block|error|denied/.test((row.status || '').toLowerCase())
}

export function auditStats(index: AdminAuditIndex) {
  if (!index.available) {
    return { total: '—', today: '—', admin: '—', user: '—', security: '—', failed: '—' }
  }
  const real = index.rows.filter(r => !r.demo)
  const hasTs = real.some(r => r.createdAt)
  const hasRole = real.some(r => r.actorRole)
  const hasSecurity = real.some(isSecurity)
  const hasStatus = real.some(r => r.status)
  return {
    total: String(real.length),
    today: hasTs ? String(real.filter(r => isToday(r.createdAt)).length) : '—',
    admin: hasRole ? String(real.filter(isAdminActor).length) : '—',
    user: hasRole ? String(real.filter(isUserActor).length) : '—',
    security: hasSecurity ? String(real.filter(isSecurity).length) : '—',
    failed: hasStatus ? String(real.filter(isFailed).length) : '—',
  }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function inDate(iso: string | null, query: AuditQuery, now: Date) {
  if (query.date === 'any') return true
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  const today = startOfDay(now).getTime()
  if (query.date === 'today') return t >= today
  if (query.date === '7d') return t >= today - 7 * 86400000
  if (query.date === '30d') return t >= today - 30 * 86400000
  if (query.date === '3m') return t >= today - 90 * 86400000
  if (query.date === '6m') return t >= today - 180 * 86400000
  if (query.date === '1y') return t >= today - 365 * 86400000
  if (query.date === 'custom') {
    if (query.customFrom && t < startOfDay(new Date(query.customFrom)).getTime()) return false
    if (query.customTo && t >= startOfDay(new Date(query.customTo)).getTime() + 86400000) return false
  }
  return true
}

export function filterAudit(rows: AdminAuditEvent[], query: AuditQuery) {
  const q = query.q.trim().toLowerCase()
  const now = new Date()
  let list = rows.filter(r => inDate(r.createdAt, query, now))
  if (query.actor) list = list.filter(r => r.actorId === query.actor || r.actorName === query.actor)
  if (query.action) list = list.filter(r => r.action === query.action)
  if (query.entity) list = list.filter(r => r.entityType === query.entity || r.entityId === query.entity)
  if (query.status) list = list.filter(r => r.status === query.status)
  if (q) {
    list = list.filter(r =>
      r.id.toLowerCase().includes(q) ||
      (r.actorName && r.actorName.toLowerCase().includes(q)) ||
      (r.action && r.action.toLowerCase().includes(q)) ||
      (r.entityType && r.entityType.toLowerCase().includes(q)) ||
      (r.entityName && r.entityName.toLowerCase().includes(q)) ||
      (r.entityId && r.entityId.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list]
  if (query.sort === 'oldest') sorted.sort((a, b) => +(new Date(a.createdAt || 0)) - +(new Date(b.createdAt || 0)))
  else if (query.sort === 'action') sorted.sort((a, b) => (a.action || '').localeCompare(b.action || ''))
  else if (query.sort === 'actor') sorted.sort((a, b) => (a.actorName || a.actorId || '').localeCompare(b.actorName || b.actorId || ''))
  else if (query.sort === 'entity') sorted.sort((a, b) => (a.entityName || a.entityType || '').localeCompare(b.entityName || b.entityType || ''))
  else sorted.sort((a, b) => +(new Date(b.createdAt || 0)) - +(new Date(a.createdAt || 0)))
  return sorted
}

export function uniqueAuditValues(rows: AdminAuditEvent[], key: 'action' | 'entityType' | 'status') {
  return [...new Set(rows.map(r => r[key]).filter(Boolean) as string[])].sort()
}

export function uniqueAuditActors(rows: AdminAuditEvent[]) {
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.actorId) map.set(r.actorId, r.actorName || r.actorId)
    else if (r.actorName) map.set(r.actorName, r.actorName)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function auditEntityHref(row: AdminAuditEvent) {
  const t = (row.entityType || '').toLowerCase()
  if (/setting/.test(t)) return '/admin/settings'
  if (!row.entityId) return null
  if (/tutor/.test(t)) return `/admin/tutors/${row.entityId}`
  if (/course/.test(t)) return `/admin/courses/${row.entityId}`
  if (/project/.test(t)) return `/admin/projects/${row.entityId}`
  if (/session|booking/.test(t)) return `/admin/sessions/${row.entityId}`
  if (/payment/.test(t)) return `/admin/payments/${row.entityId}`
  if (/report/.test(t)) return `/admin/reports/${row.entityId}`
  if (/verif/.test(t)) return `/admin/verification/${row.entityId}`
  if (/user|student|account/.test(t)) return `/admin/users/${row.entityId}`
  return null
}
