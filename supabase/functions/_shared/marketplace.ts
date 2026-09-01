import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { razorpayBasicAuth } from "./razorpay.ts"

export const SESSION_OFFER_KEYS = new Set(["1on1", "project", "interview", "career"])

export const BOOKING_EXPIRY_MINUTES = 30

export function computeSessionAmountMinor(hourlyRateMinor: number, durationMinutes: number): number {
  return Math.max(0, Math.round((hourlyRateMinor * durationMinutes) / 60))
}

export function computeMarketplaceFees(amountMinor: number, feeBps: number) {
  const platformFeeMinor = Math.round((amountMinor * feeBps) / 10000)
  const tutorEarningMinor = amountMinor - platformFeeMinor
  return { platformFeeMinor, tutorEarningMinor }
}

export interface MarketplacePaymentRecord {
  id: string
  booking_id: string | null
  student_id: string
  tutor_id: string
  amount_minor: number
  platform_fee_minor: number
  tutor_earning_minor: number
  currency: string | null
  status: string
  external_order_id: string | null
  external_payment_id: string | null
}

export const MARKETPLACE_PAYMENT_COLUMNS =
  "id, booking_id, student_id, tutor_id, amount_minor, platform_fee_minor, tutor_earning_minor, currency, status, external_order_id, external_payment_id"

/**
 * Idempotently mark a marketplace payment as paid, confirm its booking, and
 * create exactly one tutor_earnings row. Safe to call from both the verify
 * endpoint and the webhook, in either order. Returns true when the grant is in
 * a paid state (already or newly). Never touches public.payments or profiles.plan.
 */
export async function grantPaidSession(
  admin: SupabaseClient,
  payment: MarketplacePaymentRecord,
  paymentId: string,
  webhookEventId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString()

  if (payment.status !== "paid") {
    const update: Record<string, unknown> = {
      status: "paid",
      external_payment_id: paymentId,
      paid_at: now,
      updated_at: now,
    }
    if (webhookEventId) update.webhook_event_id = webhookEventId
    const { error: mpErr } = await admin
      .from("marketplace_payments")
      .update(update)
      .eq("id", payment.id)
      .neq("status", "paid")
    if (mpErr) {
      console.error("marketplace payment paid update failed", mpErr.code)
      return { ok: false, error: "marketplace_update_failed" }
    }
  } else if (webhookEventId) {
    await admin
      .from("marketplace_payments")
      .update({ webhook_event_id: webhookEventId, updated_at: now })
      .eq("id", payment.id)
      .is("webhook_event_id", null)
  }

  if (payment.booking_id) {
    const { error: bookingErr } = await admin
      .from("bookings")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", payment.booking_id)
      .neq("payment_status", "paid")
    if (bookingErr) {
      console.error("booking confirm update failed", bookingErr.code)
      return { ok: false, error: "booking_update_failed" }
    }
  }

  const { data: existingEarn } = await admin
    .from("tutor_earnings")
    .select("id")
    .eq("marketplace_payment_id", payment.id)
    .maybeSingle()

  if (!existingEarn) {
    const { error: earnErr } = await admin.from("tutor_earnings").insert({
      marketplace_payment_id: payment.id,
      tutor_id: payment.tutor_id,
      booking_id: payment.booking_id,
      gross_minor: payment.amount_minor,
      platform_fee_minor: payment.platform_fee_minor,
      net_minor: payment.tutor_earning_minor,
      currency: payment.currency ?? "INR",
      payout_status: "pending",
      earned_at: now,
    })
    // Unique constraint on marketplace_payment_id makes a racing insert a safe no-op.
    if (earnErr && earnErr.code !== "23505") {
      console.error("tutor earning insert failed", earnErr.code)
      return { ok: false, error: "earning_insert_failed" }
    }
  }

  return { ok: true }
}

export async function loadMarketplaceFeeBps(admin: SupabaseClient): Promise<number> {
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "marketplace_fee_bps")
    .maybeSingle()
  const n = Number((data as { value?: string } | null)?.value)
  if (!Number.isFinite(n) || n < 0 || n > 10000) return 1000
  return n
}

export async function verifyOrderPaymentSignature(
  paymentId: string,
  orderId: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const payload = `${paymentId}|${orderId}`
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  const expected = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("")
  return timingSafeEqual(expected, signature)
}

/** Verify a Razorpay webhook signature (HMAC-SHA256 over the raw body). */
export async function verifyMarketplaceWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  const expected = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("")
  return timingSafeEqual(expected, signature)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export { razorpayBasicAuth }
