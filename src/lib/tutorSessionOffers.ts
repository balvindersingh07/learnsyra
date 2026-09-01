import type { TutorHub } from './tutorProfile'
import { isSupabaseConfigured, supabase } from './supabase'

export type SessionOfferKey = '1on1' | 'project' | 'interview' | 'career'

export type BookingPaymentStatus =
  | 'not_required'
  | 'awaiting_payment'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'

export interface TutorSessionOfferRow {
  id: string
  tutor_listing_id: string
  offer_key: SessionOfferKey
  label: string
  enabled: boolean
  hourly_rate_minor: number
  duration_minutes: number
  currency: string
  created_at: string
  updated_at: string
}

export interface MarketplacePaymentRow {
  id: string
  kind: 'tutor_session' | 'course'
  booking_id: string | null
  student_id: string
  tutor_id: string
  provider: string
  currency: string
  amount_minor: number
  platform_fee_minor: number
  tutor_earning_minor: number
  fee_bps_snapshot: number
  external_order_id: string | null
  external_payment_id: string | null
  status: string
  idempotency_key: string | null
  webhook_event_id: string | null
  failure_reason: string | null
  refund_amount_minor: number
  metadata: Record<string, unknown>
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface TutorEarningRow {
  id: string
  marketplace_payment_id: string
  tutor_id: string
  booking_id: string | null
  gross_minor: number
  platform_fee_minor: number
  net_minor: number
  currency: string
  payout_status: 'pending' | 'available' | 'paid' | 'held' | 'cancelled'
  payout_id: string | null
  earned_at: string
  created_at: string
  updated_at: string
}

function rupeesToMinor(rupees: number) {
  if (!Number.isFinite(rupees) || rupees <= 0) return 0
  return Math.round(rupees * 100)
}

function primaryHourlyMinor(hub: TutorHub) {
  const enabled = hub.sessionOffers.filter(o => o.enabled && o.hourlyRate > 0)
  const primary = enabled.find(o => o.id === '1on1') ?? enabled[0]
  return primary ? rupeesToMinor(primary.hourlyRate) : 0
}

function listingPayload(hub: TutorHub, available: boolean) {
  const tags = hub.skills.map(s => s.name).filter(Boolean)
  const subject = hub.categories[0] ?? 'Programming'
  return {
    profile_id: hub.userId,
    name: hub.identity.name.trim() || 'LearnSyra Tutor',
    expertise: hub.identity.headline.trim() || null,
    intro: hub.bio.trim().slice(0, 500) || hub.identity.headline.trim() || null,
    subject,
    tags,
    hourly_rate_cents: primaryHourlyMinor(hub) || 5000,
    available,
  }
}

function offerRows(hub: TutorHub, listingId: string) {
  return hub.sessionOffers.map(offer => ({
    tutor_listing_id: listingId,
    offer_key: offer.id,
    label: offer.label,
    enabled: offer.enabled,
    hourly_rate_minor: rupeesToMinor(offer.hourlyRate),
    duration_minutes: hub.sessionDuration,
    currency: 'INR',
    updated_at: new Date().toISOString(),
  }))
}

async function findListingId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tutor_listings')
    .select('id')
    .eq('profile_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as { id: string } | null)?.id ?? null
}

/** Sync published tutor hub pricing to Postgres (listings + session offers). */
export async function syncPublishedTutorPricing(hub: TutorHub): Promise<{ error: string | null; listingId?: string }> {
  if (!isSupabaseConfigured) return { error: null }
  if (hub.visibility !== 'published') return { error: null }

  const available = !hub.vacationMode
  const payload = listingPayload(hub, available)
  let listingId = await findListingId(hub.userId)

  if (listingId) {
    const { error } = await supabase.from('tutor_listings').update(payload).eq('id', listingId)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await supabase.from('tutor_listings').insert(payload).select('id').single()
    if (error) return { error: error.message }
    listingId = (data as { id: string }).id
  }

  const rows = offerRows(hub, listingId)
  const { error: offerErr } = await supabase
    .from('tutor_session_offers')
    .upsert(rows, { onConflict: 'tutor_listing_id,offer_key' })
  if (offerErr) return { error: offerErr.message }

  return { error: null, listingId }
}

/** Mark server listing unavailable when tutor pauses or drafts (offers remain stored). */
export async function syncTutorListingAvailability(userId: string, available: boolean): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: null }
  const listingId = await findListingId(userId)
  if (!listingId) return { error: null }
  const { error } = await supabase.from('tutor_listings').update({ available }).eq('id', listingId)
  return { error: error?.message ?? null }
}

export async function getTutorSessionOffers(listingId: string): Promise<TutorSessionOfferRow[]> {
  if (!isSupabaseConfigured || !listingId) return []
  const { data, error } = await supabase
    .from('tutor_session_offers')
    .select('*')
    .eq('tutor_listing_id', listingId)
    .order('offer_key')
  if (error) throw error
  return (data as TutorSessionOfferRow[]) ?? []
}

export async function getTutorSessionOffersForProfile(profileId: string): Promise<TutorSessionOfferRow[]> {
  if (!isSupabaseConfigured || !profileId) return []
  const listingId = await findListingId(profileId)
  if (!listingId) return []
  return getTutorSessionOffers(listingId)
}

export async function getMarketplaceFeeBps(): Promise<number | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'marketplace_fee_bps')
    .maybeSingle()
  if (error) return null
  const n = Number((data as { value: string } | null)?.value)
  if (!Number.isFinite(n) || n < 0 || n > 10000) return null
  return n
}

export function profileIdFromSelfTutorPublicId(publicId: string): string | null {
  if (!publicId.startsWith('self-')) return null
  const id = publicId.slice(5).trim()
  return id || null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string) {
  return UUID_RE.test(value)
}

export async function resolveTutorListingId(catalogTutorId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !catalogTutorId) return null
  if (isUuid(catalogTutorId)) {
    const { data, error } = await supabase.from('tutor_listings').select('id').eq('id', catalogTutorId).maybeSingle()
    if (error) throw error
    return (data as { id: string } | null)?.id ?? null
  }
  const profileId = profileIdFromSelfTutorPublicId(catalogTutorId)
  if (!profileId) return null
  return findListingId(profileId)
}

export function buildScheduledAtIso(date: Date, timeLabel: string): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const m = timeLabel.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (m) {
    let h = Number(m[1]) % 12
    if (/pm/i.test(m[3])) h += 12
    d.setHours(h, Number(m[2]), 0, 0)
  }
  return d.toISOString()
}

export async function createTutorSessionOrder(input: {
  tutorListingId: string
  offerKey: SessionOfferKey
  scheduledAt: string
  message: string
  idempotencyKey?: string
}): Promise<{ error: string | null; data?: Record<string, unknown> }> {
  const { data, error } = await supabase.functions.invoke('create-tutor-session-order', {
    body: {
      tutor_listing_id: input.tutorListingId,
      offer_key: input.offerKey,
      scheduled_at: input.scheduledAt,
      message: input.message,
      idempotency_key: input.idempotencyKey,
    },
  })
  const message = typeof (data as { error?: unknown } | null)?.error === 'string'
    ? String((data as { error: string }).error)
    : error?.message ?? null
  if (message) return { error: message }
  return { error: null, data: (data as Record<string, unknown>) ?? undefined }
}

export async function verifyTutorSessionPayment(input: {
  razorpayPaymentId: string
  razorpayOrderId: string
  razorpaySignature: string
  bookingId: string
}): Promise<{ error: string | null; ok?: boolean }> {
  const { data, error } = await supabase.functions.invoke('verify-tutor-session-payment', {
    body: {
      razorpay_payment_id: input.razorpayPaymentId,
      razorpay_order_id: input.razorpayOrderId,
      razorpay_signature: input.razorpaySignature,
      booking_id: input.bookingId,
    },
  })
  const message = typeof (data as { error?: unknown } | null)?.error === 'string'
    ? String((data as { error: string }).error)
    : error?.message ?? null
  if (message) return { error: message }
  return { error: null, ok: Boolean((data as { ok?: boolean } | null)?.ok) }
}

export async function getTutorEarningsRecords(tutorId: string): Promise<TutorEarningRow[]> {
  if (!isSupabaseConfigured || !tutorId) return []
  const { data, error } = await supabase
    .from('tutor_earnings')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('earned_at', { ascending: false })
  if (error) throw error
  return (data as TutorEarningRow[]) ?? []
}

export async function getTutorMarketplacePayments(tutorId: string): Promise<MarketplacePaymentRow[]> {
  if (!isSupabaseConfigured || !tutorId) return []
  const { data, error } = await supabase
    .from('marketplace_payments')
    .select('*')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as MarketplacePaymentRow[]) ?? []
}

export function sessionTypesFromOffers(offers: TutorSessionOfferRow[]) {
  return offers
    .filter(o => o.enabled && o.hourly_rate_minor > 0)
    .map(o => ({
      id: o.offer_key,
      label: o.label,
      minutes: o.duration_minutes,
      price: Math.round(o.hourly_rate_minor / 100),
    }))
}
