import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  BOOKING_EXPIRY_MINUTES,
  SESSION_OFFER_KEYS,
  computeMarketplaceFees,
  computeSessionAmountMinor,
  loadMarketplaceFeeBps,
  razorpayBasicAuth,
} from "../_shared/marketplace.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const OPEN_PAYMENT_STATUSES = new Set(["created", "pending"])

function checkoutPayload(
  keyId: string,
  orderId: string,
  amountMinor: number,
  currency: string,
  bookingId: string,
  marketplacePaymentId: string,
) {
  return {
    keyId,
    orderId,
    amount: amountMinor,
    currency,
    bookingId,
    marketplacePaymentId,
  }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const authHeader = req.headers.get("Authorization") ?? ""
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return Response.json({ error: "Not logged in" }, { status: 401, headers: cors })
    }

    const body = (await req.json()) as {
      tutor_listing_id?: string
      offer_key?: string
      scheduled_at?: string
      message?: string
      idempotency_key?: string
    }

    const tutorListingId = body.tutor_listing_id?.trim()
    const offerKey = body.offer_key?.trim()
    const scheduledAtRaw = body.scheduled_at?.trim()
    const message = body.message?.trim() || null
    const idempotencyKey = body.idempotency_key?.trim() || null

    if (!tutorListingId || !offerKey || !scheduledAtRaw) {
      return Response.json({ error: "Missing booking details" }, { status: 400, headers: cors })
    }
    if (!SESSION_OFFER_KEYS.has(offerKey)) {
      return Response.json({ error: "Invalid session type" }, { status: 400, headers: cors })
    }

    const scheduledAt = new Date(scheduledAtRaw)
    if (Number.isNaN(scheduledAt.getTime())) {
      return Response.json({ error: "Invalid session time" }, { status: 400, headers: cors })
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) {
      return Response.json({ error: "Payments unavailable. Coming soon." }, { status: 503, headers: cors })
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    if (idempotencyKey) {
      const { data: existingPay } = await admin
        .from("marketplace_payments")
        .select("id, booking_id, amount_minor, currency, status, external_order_id, student_id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle()

      if (existingPay?.student_id && existingPay.student_id !== userData.user.id) {
        return Response.json({ error: "Invalid checkout request" }, { status: 403, headers: cors })
      }

      if (
        existingPay?.external_order_id &&
        existingPay.booking_id &&
        OPEN_PAYMENT_STATUSES.has(existingPay.status)
      ) {
        return Response.json(
          checkoutPayload(
            keyId,
            existingPay.external_order_id,
            existingPay.amount_minor,
            existingPay.currency ?? "INR",
            existingPay.booking_id,
            existingPay.id,
          ),
          { headers: { ...cors, "Content-Type": "application/json" } },
        )
      }
    }

    const { data: listing, error: listingErr } = await admin
      .from("tutor_listings")
      .select("id, profile_id, available, name")
      .eq("id", tutorListingId)
      .maybeSingle()

    if (listingErr || !listing?.profile_id) {
      return Response.json({ error: "Tutor not available" }, { status: 404, headers: cors })
    }
    if (!listing.available) {
      return Response.json({ error: "Tutor is not available for booking" }, { status: 400, headers: cors })
    }

    const { data: offer, error: offerErr } = await admin
      .from("tutor_session_offers")
      .select("offer_key, label, enabled, hourly_rate_minor, duration_minutes, currency")
      .eq("tutor_listing_id", tutorListingId)
      .eq("offer_key", offerKey)
      .maybeSingle()

    if (offerErr || !offer?.enabled || offer.hourly_rate_minor <= 0) {
      return Response.json({ error: "Session type is not available" }, { status: 400, headers: cors })
    }

    const amountMinor = computeSessionAmountMinor(offer.hourly_rate_minor, offer.duration_minutes)
    if (amountMinor <= 0) {
      return Response.json({ error: "Session price is not configured" }, { status: 400, headers: cors })
    }

    const feeBps = await loadMarketplaceFeeBps(admin)
    const { platformFeeMinor, tutorEarningMinor } = computeMarketplaceFees(amountMinor, feeBps)
    const currency = offer.currency ?? "INR"
    const expiresAt = new Date(Date.now() + BOOKING_EXPIRY_MINUTES * 60 * 1000).toISOString()

    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .insert({
        student_id: userData.user.id,
        tutor_listing_id: tutorListingId,
        message,
        status: "pending",
        payment_status: "awaiting_payment",
        offer_key: offerKey,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: offer.duration_minutes,
        amount_minor: amountMinor,
        currency,
        expires_at: expiresAt,
      })
      .select("id")
      .single()

    if (bookingErr || !booking?.id) {
      console.error("booking insert failed", bookingErr?.code)
      return Response.json({ error: "Could not create booking. Try again." }, { status: 500, headers: cors })
    }

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency,
        receipt: String(booking.id).replace(/-/g, "").slice(0, 40),
        notes: {
          booking_id: booking.id,
          student_id: userData.user.id,
          tutor_listing_id: tutorListingId,
          offer_key: offerKey,
          kind: "tutor_session",
        },
      }),
    })

    if (!orderRes.ok) {
      console.error("razorpay order failed", orderRes.status)
      await admin.from("bookings").update({ payment_status: "failed", status: "cancelled" }).eq("id", booking.id)
      return Response.json({ error: "Could not start payment. Try again." }, { status: 502, headers: cors })
    }

    const order = await orderRes.json() as { id?: string; amount?: number; currency?: string }
    if (!order.id || order.amount !== amountMinor) {
      console.error("razorpay order mismatch", order.id)
      await admin.from("bookings").update({ payment_status: "failed", status: "cancelled" }).eq("id", booking.id)
      return Response.json({ error: "Could not start payment. Try again." }, { status: 502, headers: cors })
    }

    const { data: paymentRow, error: payErr } = await admin
      .from("marketplace_payments")
      .insert({
        kind: "tutor_session",
        booking_id: booking.id,
        student_id: userData.user.id,
        tutor_id: listing.profile_id,
        provider: "razorpay",
        currency,
        amount_minor: amountMinor,
        platform_fee_minor: platformFeeMinor,
        tutor_earning_minor: tutorEarningMinor,
        fee_bps_snapshot: feeBps,
        external_order_id: order.id,
        status: "created",
        idempotency_key: idempotencyKey,
        metadata: {
          offer_key: offerKey,
          offer_label: offer.label,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: offer.duration_minutes,
        },
      })
      .select("id")
      .single()

    if (payErr || !paymentRow?.id) {
      console.error("marketplace payment insert failed", payErr?.code)
      await admin.from("bookings").update({ payment_status: "failed", status: "cancelled" }).eq("id", booking.id)
      return Response.json({ error: "Could not start payment. Try again." }, { status: 500, headers: cors })
    }

    const { error: linkErr } = await admin
      .from("bookings")
      .update({ marketplace_payment_id: paymentRow.id })
      .eq("id", booking.id)

    if (linkErr) {
      console.error("booking payment link failed", linkErr.code)
      return Response.json({ error: "Could not start payment. Try again." }, { status: 500, headers: cors })
    }

    return Response.json(
      checkoutPayload(keyId, order.id, amountMinor, currency, booking.id, paymentRow.id),
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (e) {
    console.error("create-tutor-session-order error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Could not start payment. Try again." }, { status: 400, headers: cors })
  }
})
