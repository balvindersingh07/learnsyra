import { getAllProfiles, type ProfileLite } from './api'
import { formatWhen, paginate } from './adminUsers'
import { isSupabaseConfigured, supabase } from './supabase'

export type ReportTab = 'all' | 'open' | 'investigating' | 'resolved' | 'dismissed'
export type ReportSort = 'newest' | 'oldest' | 'priority' | 'status'
export type ReportDateFilter = 'any' | 'today' | '7d' | '30d' | '3m' | '6m' | '1y' | 'custom'

export interface AdminReportRow {
  id: string
  status: string | null
  type: string | null
  priority: string | null
  reason: string | null
  description: string | null
  reporterId: string | null
  reporterName: string | null
  entityType: string | null
  entityId: string | null
  entityName: string | null
  createdAt: string | null
  evidence: string | null
  demo: boolean
}

export interface AdminReportIndex {
  available: boolean
  rows: AdminReportRow[]
  profiles: ProfileLite[]
}

export interface ReportQuery {
  tab: ReportTab
  q: string
  status: string
  priority: string
  type: string
  entity: string
  date: ReportDateFilter
  customFrom: string
  customTo: string
  sort: ReportSort
}

const NOTES_KEY = 'learnsyra_admin_report_notes'
const PAGE_SIZE = 20

export { formatWhen, paginate }

export function reportsPageSize() {
  return PAGE_SIZE
}

export function isReportModerationAvailable() {
  return false
}

export function isReportEscalationAvailable() {
  return false
}

export function isReportAuditAvailable() {
  return false
}

export function isAiModerationAvailable() {
  return false
}

export function loadReportNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function saveReportNote(reportId: string, note: string) {
  const map = loadReportNotes()
  const next = note.trim()
  if (next) map[reportId] = next
  else delete map[reportId]
  localStorage.setItem(NOTES_KEY, JSON.stringify(map))
}

function asStr(v: unknown) {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k]
  }
  return null
}

function normalize(raw: Record<string, unknown>, profiles: ProfileLite[]): AdminReportRow | null {
  const id = asStr(pick(raw, ['id', 'report_id']))
  if (!id) return null
  const reporterId = asStr(pick(raw, ['reporter_id', 'created_by']))
  const entityId = asStr(pick(raw, ['entity_id', 'target_id', 'subject_id']))
  return {
    id,
    status: asStr(pick(raw, ['status'])),
    type: asStr(pick(raw, ['type', 'category', 'entity_type'])),
    priority: asStr(pick(raw, ['priority'])),
    reason: asStr(pick(raw, ['reason', 'title'])),
    description: asStr(pick(raw, ['description', 'details', 'body'])),
    reporterId,
    reporterName: reporterId ? profiles.find(p => p.id === reporterId)?.full_name ?? null : null,
    entityType: asStr(pick(raw, ['entity_type', 'target_type', 'subject_type', 'type'])),
    entityId,
    entityName: asStr(pick(raw, ['entity_name', 'target_name', 'subject_name'])),
    createdAt: asStr(pick(raw, ['created_at', 'createdAt'])),
    evidence: asStr(pick(raw, ['evidence', 'evidence_url', 'attachment'])),
    demo: id.startsWith('demo-'),
  }
}

async function probeReports(profiles: ProfileLite[]): Promise<{ available: boolean; rows: AdminReportRow[] }> {
  if (!isSupabaseConfigured) return { available: false, rows: [] }
  const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) return { available: false, rows: [] }
  const rows = ((data as Record<string, unknown>[] | null) ?? []).map(r => normalize(r, profiles)).filter((r): r is AdminReportRow => r != null)
  return { available: true, rows }
}

export async function loadAdminReportIndex(): Promise<AdminReportIndex> {
  const profiles = await getAllProfiles().catch(() => [] as ProfileLite[])
  const pack = await probeReports(profiles)
  return { available: pack.available, rows: pack.rows, profiles }
}

export function reportStats(index: AdminReportIndex) {
  if (!index.available) {
    return { total: '—', open: '—', investigating: '—', resolved: '—', dismissed: '—', high: '—' }
  }
  const real = index.rows.filter(r => !r.demo)
  const s = (row: AdminReportRow) => (row.status || '').toLowerCase()
  const p = (row: AdminReportRow) => (row.priority || '').toLowerCase()
  return {
    total: String(real.length),
    open: String(real.filter(r => /open|new|pending/.test(s(r))).length),
    investigating: String(real.filter(r => /investigat/.test(s(r))).length),
    resolved: String(real.filter(r => /resolv/.test(s(r))).length),
    dismissed: String(real.filter(r => /dismiss/.test(s(r))).length),
    high: real.some(r => r.priority) ? String(real.filter(r => /high|critical/.test(p(r))).length) : '—',
  }
}

function matchesTab(row: AdminReportRow, tab: ReportTab) {
  const s = (row.status || '').toLowerCase()
  if (tab === 'all') return true
  if (tab === 'open') return /open|new|pending/.test(s)
  if (tab === 'investigating') return /investigat/.test(s)
  if (tab === 'resolved') return /resolv/.test(s)
  if (tab === 'dismissed') return /dismiss/.test(s)
  return true
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function inDate(iso: string | null, query: ReportQuery, now: Date) {
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

export function filterReports(rows: AdminReportRow[], query: ReportQuery) {
  const q = query.q.trim().toLowerCase()
  const now = new Date()
  let list = rows.filter(r => matchesTab(r, query.tab) && inDate(r.createdAt, query, now))
  if (query.status) list = list.filter(r => r.status === query.status)
  if (query.priority) list = list.filter(r => r.priority === query.priority)
  if (query.type) list = list.filter(r => r.type === query.type)
  if (query.entity) list = list.filter(r => r.entityId === query.entity || r.entityType === query.entity)
  if (q) {
    list = list.filter(r =>
      r.id.toLowerCase().includes(q) ||
      (r.entityName && r.entityName.toLowerCase().includes(q)) ||
      (r.entityType && r.entityType.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q)) ||
      (r.entityId && r.entityId.toLowerCase().includes(q)) ||
      (r.reporterName && r.reporterName.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list]
  if (query.sort === 'oldest') sorted.sort((a, b) => +(new Date(a.createdAt || 0)) - +(new Date(b.createdAt || 0)))
  else if (query.sort === 'priority') sorted.sort((a, b) => (a.priority || '').localeCompare(b.priority || ''))
  else if (query.sort === 'status') sorted.sort((a, b) => (a.status || '').localeCompare(b.status || ''))
  else sorted.sort((a, b) => +(new Date(b.createdAt || 0)) - +(new Date(a.createdAt || 0)))
  return sorted
}

export function uniqueReportValues(rows: AdminReportRow[], key: 'status' | 'priority' | 'type') {
  return [...new Set(rows.map(r => r[key]).filter(Boolean) as string[])].sort()
}

export function uniqueReportEntities(rows: AdminReportRow[]) {
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.entityId) map.set(r.entityId, r.entityName || r.entityId)
    else if (r.entityType) map.set(r.entityType, r.entityType)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function entityAdminHref(row: AdminReportRow) {
  if (!row.entityId) return null
  const t = (row.entityType || row.type || '').toLowerCase()
  if (/tutor/.test(t)) return `/admin/tutors/${row.entityId}`
  if (/course/.test(t)) return `/admin/courses/${row.entityId}`
  if (/project/.test(t)) return `/admin/projects/${row.entityId}`
  if (/session|booking/.test(t)) return `/admin/sessions/${row.entityId}`
  if (/user|student|account/.test(t)) return `/admin/users/${row.entityId}`
  return null
}
