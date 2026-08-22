import { loadAdminStringMap, saveAdminStringMap } from './adminStorage'
import { getAllProfiles, type ProfileLite } from './api'
import { formatWhen, paginate } from './adminUsers'
import { isSupabaseConfigured, supabase } from './supabase'

export type PaymentTab = 'all' | 'completed' | 'pending' | 'failed' | 'refunded'
export type PaymentSort = 'newest' | 'oldest' | 'highest' | 'lowest' | 'status'
export type PaymentDateFilter = 'any' | 'today' | '7d' | '30d' | '3m' | '6m' | '1y' | 'custom'

export interface AdminPaymentTx {
  id: string
  type: string | null
  status: string | null
  amount: number | null
  currency: string | null
  payerId: string | null
  payerName: string | null
  payeeId: string | null
  payeeName: string | null
  source: string | null
  reference: string | null
  createdAt: string | null
  completedAt: string | null
  refund: number | null
  fee: number | null
  net: number | null
  provider: string | null
  failureReason: string | null
  demo: boolean
}

export interface AdminPaymentIndex {
  available: boolean
  rows: AdminPaymentTx[]
  provider: string | null
  profiles: ProfileLite[]
}

export interface PaymentQuery {
  tab: PaymentTab
  q: string
  date: PaymentDateFilter
  customFrom: string
  customTo: string
  status: string
  type: string
  currency: string
  tutorId: string
  studentId: string
  sort: PaymentSort
}

const NOTES_KEY = 'learnsyra_admin_payment_notes'
const PAGE_SIZE = 20

export { formatWhen, paginate }

export function paymentsPageSize() {
  return PAGE_SIZE
}

export function isRefundApiAvailable() {
  return false
}

export function isPayoutInfrastructureAvailable() {
  return false
}

export function isFinancialExportAvailable() {
  return false
}

export function isStatementGenerationAvailable() {
  return false
}

export function loadPaymentNotes(): Record<string, string> {
  return loadAdminStringMap(NOTES_KEY)
}

export function savePaymentNote(paymentId: string, note: string) {
  const map = loadPaymentNotes()
  const next = note.trim()
  if (next) map[paymentId] = next
  else delete map[paymentId]
  saveAdminStringMap(NOTES_KEY, map)
}

function asStr(v: unknown) {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function asNum(v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return row[k]
  }
  return null
}

function normalize(raw: Record<string, unknown>, profiles: ProfileLite[]): AdminPaymentTx | null {
  const id = asStr(pick(raw, ['id', 'transaction_id']))
  if (!id) return null
  const payerId = asStr(pick(raw, ['user_id', 'payer_id', 'student_id', 'customer_id']))
  const payeeId = asStr(pick(raw, ['payee_id', 'tutor_id']))
  const amountMinor = asNum(pick(raw, ['amount_minor']))
  const amountCents = asNum(pick(raw, ['amount_cents']))
  const amount =
    amountMinor != null
      ? amountMinor / 100
      : amountCents != null
        ? amountCents / 100
        : asNum(pick(raw, ['amount', 'gross', 'gross_amount']))
  return {
    id,
    type: asStr(pick(raw, ['plan_id', 'type', 'transaction_type', 'kind'])),
    status: asStr(pick(raw, ['status', 'payment_status'])),
    amount,
    currency: asStr(pick(raw, ['currency'])),
    payerId,
    payerName: asStr(pick(raw, ['payer', 'payer_name'])) || (payerId ? profiles.find(p => p.id === payerId)?.full_name ?? null : null),
    payeeId,
    payeeName: asStr(pick(raw, ['payee', 'payee_name'])) || (payeeId ? profiles.find(p => p.id === payeeId)?.full_name ?? null : null),
    source: asStr(pick(raw, ['source', 'source_type'])),
    reference: asStr(pick(raw, ['external_subscription_id', 'external_order_id', 'reference', 'provider_ref', 'order_id'])),
    createdAt: asStr(pick(raw, ['created_at', 'createdAt'])),
    completedAt: asStr(pick(raw, ['completed_at', 'completedAt'])),
    refund: asNum(pick(raw, ['refund', 'refund_amount'])),
    fee: asNum(pick(raw, ['fee', 'platform_fee'])),
    net: asNum(pick(raw, ['net', 'net_amount'])),
    provider: asStr(pick(raw, ['provider', 'payment_provider'])),
    failureReason: asStr(pick(raw, ['failure_reason', 'error_message'])),
    demo: id.startsWith('demo-'),
  }
}

async function probeLedger(profiles: ProfileLite[]): Promise<{ available: boolean; rows: AdminPaymentTx[] }> {
  if (!isSupabaseConfigured) return { available: false, rows: [] }
  const { data, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) return { available: false, rows: [] }
  const rows = ((data as Record<string, unknown>[] | null) ?? []).map(r => normalize(r, profiles)).filter((r): r is AdminPaymentTx => r != null)
  return { available: true, rows }
}

export async function loadAdminPaymentIndex(): Promise<AdminPaymentIndex> {
  const profiles = await getAllProfiles().catch(() => [] as ProfileLite[])
  const ledger = await probeLedger(profiles)
  const provider = ledger.rows.find(r => r.provider)?.provider ?? null
  return {
    available: ledger.available,
    rows: ledger.rows,
    provider,
    profiles,
  }
}

export function paymentStats(index: AdminPaymentIndex) {
  if (!index.available) {
    return { volume: '—', month: '—', completed: '—', pending: '—', refunded: '—', net: '—' }
  }
  const real = index.rows.filter(r => !r.demo)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const amounts = (rows: AdminPaymentTx[]) => {
    const vals = rows.map(r => r.amount).filter((n): n is number => n != null)
    return vals.length ? vals.reduce((s, n) => s + n, 0) : null
  }
  const volume = amounts(real)
  const thisMonth = amounts(real.filter(r => r.createdAt && +(new Date(r.createdAt)) >= monthStart))
  const nets = real.map(r => r.net).filter((n): n is number => n != null)
  const refunds = real.map(r => r.refund).filter((n): n is number => n != null)
  return {
    volume: volume == null ? '—' : formatMoney(volume, real[0]?.currency),
    month: thisMonth == null ? '—' : formatMoney(thisMonth, real[0]?.currency),
    completed: String(real.filter(r => /complete|paid|success/i.test(r.status || '')).length),
    pending: String(real.filter(r => /pend|process/i.test(r.status || '')).length),
    refunded: refunds.length ? formatMoney(refunds.reduce((s, n) => s + n, 0), real[0]?.currency) : String(real.filter(r => /refund/i.test(r.status || '')).length),
    net: nets.length ? formatMoney(nets.reduce((s, n) => s + n, 0), real[0]?.currency) : '—',
  }
}

export function formatMoney(n: number | null, currency: string | null) {
  if (n == null) return '—'
  const cur = (currency || '').toUpperCase()
  if (cur === 'INR') return `₹${Math.round(n).toLocaleString('en-IN')}`
  if (cur) return `${n.toLocaleString()} ${currency}`
  return n.toLocaleString()
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function inDate(iso: string | null, query: PaymentQuery, now: Date) {
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

function matchesTab(row: AdminPaymentTx, tab: PaymentTab) {
  const s = (row.status || '').toLowerCase()
  if (tab === 'all') return true
  if (tab === 'completed') return /complete|paid|success/.test(s)
  if (tab === 'pending') return /pend|process/.test(s)
  if (tab === 'failed') return /fail|error/.test(s)
  if (tab === 'refunded') return /refund/.test(s) || (row.refund != null && row.refund > 0)
  return true
}

export function filterPayments(rows: AdminPaymentTx[], query: PaymentQuery) {
  const q = query.q.trim().toLowerCase()
  const now = new Date()
  let list = rows.filter(r => matchesTab(r, query.tab) && inDate(r.createdAt, query, now))
  if (query.status) list = list.filter(r => r.status === query.status)
  if (query.type) list = list.filter(r => r.type === query.type)
  if (query.currency) list = list.filter(r => r.currency === query.currency)
  if (query.tutorId) list = list.filter(r => r.payeeId === query.tutorId)
  if (query.studentId) list = list.filter(r => r.payerId === query.studentId)
  if (q) {
    list = list.filter(r =>
      r.id.toLowerCase().includes(q) ||
      (r.reference && r.reference.toLowerCase().includes(q)) ||
      (r.payerName && r.payerName.toLowerCase().includes(q)) ||
      (r.payeeName && r.payeeName.toLowerCase().includes(q)) ||
      (r.type && r.type.toLowerCase().includes(q)) ||
      (r.source && r.source.toLowerCase().includes(q)),
    )
  }
  const sorted = [...list]
  if (query.sort === 'oldest') sorted.sort((a, b) => +(new Date(a.createdAt || 0)) - +(new Date(b.createdAt || 0)))
  else if (query.sort === 'highest') sorted.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1))
  else if (query.sort === 'lowest') sorted.sort((a, b) => (a.amount ?? 1e15) - (b.amount ?? 1e15))
  else if (query.sort === 'status') sorted.sort((a, b) => (a.status || '').localeCompare(b.status || ''))
  else sorted.sort((a, b) => +(new Date(b.createdAt || 0)) - +(new Date(a.createdAt || 0)))
  return sorted
}

export function uniquePaymentValues(rows: AdminPaymentTx[], key: 'status' | 'type' | 'currency') {
  return [...new Set(rows.map(r => r[key]).filter(Boolean) as string[])].sort()
}

export function uniquePayees(rows: AdminPaymentTx[]) {
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.payeeId) map.set(r.payeeId, r.payeeName || r.payeeId)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function uniquePayers(rows: AdminPaymentTx[]) {
  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.payerId) map.set(r.payerId, r.payerName || r.payerId)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}
