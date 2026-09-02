import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  MARKETPLACE_PAYMENT_COLUMNS,
  grantPaidSession,
  razorpayBasicAuth,
  verifyMarketplaceWebhookSignature,
  type MarketplacePaymentRecord,
} from "../_shared/marketplace.ts"
import { applyMarketplaceRefundToEarnings } from "../_shared/payouts.ts"

const cors = { "Access-Control-Allow-Origin": "*" }

interface RazorpayEntity {
  id?: string
  order_id?: string
  amount?: number
  status?: string
  currency?: string
  error_description?: string
  payment_id?: string
  notes?: Record<string, unknown>
}

interface RazorpayWebhook {
  event?: string
  id?: string
  payload?: {
    payment?: { entity?: RazorpayEntity }
    refund?: { entity?: RazorpayEntity }
  }
}

type Admin = ReturnType<typeof createClient>

/** True when this webhook event id was already processed by the marketplace ledger. */
async function alreadyProcessed(admin: Admin, eventId: string | null): Promise<boolean> {
  if (!eventId) return false
  const { data } = await admin
    .from("marketplace_payments")
    .select("id")
    .eq("webhook_event_id", eventId)
    .maybeSingle()
  return Boolean(data)
}

async function findPaymentByOrder(admin: Admin, orderId: string): Promise<MarketplacePaymentRecord | null> {
  const { data } = await admin
    .from("marketplace_payments")
    .select(MARKETPLACE_PAYMENT_COLUMNS)
    .eq("external_order_id", orderId)
    .maybeSingle()
  return (data as MarketplacePaymentRecord | null) ?? null
}

async function findPaymentByPaymentId(admin: Admin, paymentId: string): Promise<MarketplacePaymentRecord | null> {
  const { data } = await admin
    .from("marketplace_payments")
    .select(MARKETPLACE_PAYMENT_COLUMNS)
    .eq("external_payment_id", paymentId)
    .maybeSingle()
  return (data as MarketplacePaymentRecord | null) ?? null
}

async function handlePaymentCaptured(
  admin: Admin,
  keyId: string,
  keySecret: string,
  entity: RazorpayEntity,
  eventId: string | null,
): Promise<Response> {
  const paymentId = entity.id
  const orderId = entity.order_id
  if (!paymentId || !orderId) return Response.json({ received: true }, { headers: cors })

  const payment = await findPaymentByOrder(admin, orderId)
  if (!payment) {
    // Not a marketplace order (e.g. subscription payment). Ignore silently.
    return Response.json({ received: true }, { headers: cors })
  }

  // Remote confirmation — never trust the webhook body alone.
  const payRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}` },
  })
  if (!payRes.ok) {
    return Response.json({ error: "Could not verify payment" }, { status: 502, headers: cors })
  }
  const remotePay = await payRes.json() as { status?: string; amount?: number; order_id?: string }

  if (remotePay.order_id !== orderId || remotePay.order_id !== payment.external_order_id) {
    console.warn("marketplace webhook: order mismatch", orderId)
    return Response.json({ received: true }, { headers: cors })
  }
  if (remotePay.amount !== payment.amount_minor) {
    console.warn("marketplace webhook: amount mismatch", orderId)
    return Response.json({ received: true }, { headers: cors })
  }
  if (remotePay.status !== "captured") {
    return Response.json({ received: true, pending: true }, { headers: cors })
  }

  const result = await grantPaidSession(admin, payment, paymentId, eventId)
  if (!result.ok) {
    return Response.json({ error: result.error ?? "grant_failed" }, { status: 500, headers: cors })
  }
  return Response.json({ received: true }, { headers: cors })
}

async function handlePaymentFailed(
  admin: Admin,
  entity: RazorpayEntity,
  eventId: string | null,
): Promise<Response> {
  const orderId = entity.order_id
  if (!orderId) return Response.json({ received: true }, { headers: cors })

  const payment = await findPaymentByOrder(admin, orderId)
  if (!payment) return Response.json({ received: true }, { headers: cors })

  // Never downgrade a payment that already succeeded.
  if (payment.status === "paid") {
    return Response.json({ received: true, alreadyPaid: true }, { headers: cors })
  }

  const now = new Date().toISOString()
  await admin
    .from("marketplace_payments")
    .update({
      status: "failed",
      failure_reason: entity.error_description ?? "Payment failed",
      webhook_event_id: eventId ?? undefined,
      updated_at: now,
    })
    .eq("id", payment.id)
    .neq("status", "paid")

  return Response.json({ received: true }, { headers: cors })
}

async function handleRefund(
  admin: Admin,
  entity: RazorpayEntity,
  eventName: string,
  eventId: string | null,
): Promise<Response> {
  const paymentId = entity.payment_id
  if (!paymentId) return Response.json({ received: true }, { headers: cors })

  const payment = await findPaymentByPaymentId(admin, paymentId)
  if (!payment) return Response.json({ received: true }, { headers: cors })

  const refundAmount = typeof entity.amount === "number" ? entity.amount : 0
  const fullyRefunded = refundAmount >= payment.amount_minor
  // refund.created records intent; refund.processed marks settlement.
  const status = eventName === "refund.processed"
    ? (fullyRefunded ? "refunded" : "partially_refunded")
    : payment.status === "paid"
      ? "partially_refunded"
      : payment.status

  const now = new Date().toISOString()
  await admin
    .from("marketplace_payments")
    .update({
      status,
      refund_amount_minor: refundAmount,
      webhook_event_id: eventId ?? undefined,
      updated_at: now,
    })
    .eq("id", payment.id)

  await applyMarketplaceRefundToEarnings(admin, {
    id: payment.id,
    booking_id: payment.booking_id,
    amount_minor: payment.amount_minor,
    refund_amount_minor: refundAmount,
    status,
    tutor_earning_minor: payment.tutor_earning_minor,
    platform_fee_minor: payment.platform_fee_minor,
  }, refundAmount, fullyRefunded)

  return Response.json({ received: true }, { headers: cors })
}

Deno.serve(async req => {
  const webhookSecret = Deno.env.get("RAZORPAY_MARKETPLACE_WEBHOOK_SECRET")
  if (!webhookSecret) {
    return Response.json({ error: "Marketplace webhook not configured" }, { status: 501, headers: cors })
  }

  const signature = req.headers.get("x-razorpay-signature")
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400, headers: cors })

  const rawBody = await req.text()
  const valid = await verifyMarketplaceWebhookSignature(rawBody, signature, webhookSecret)
  if (!valid) return Response.json({ error: "Bad signature" }, { status: 400, headers: cors })

  let event: RazorpayWebhook
  try {
    event = JSON.parse(rawBody) as RazorpayWebhook
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400, headers: cors })
  }

  const keyId = Deno.env.get("RAZORPAY_KEY_ID")
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")
  if (!keyId || !keySecret) {
    return Response.json({ error: "Payments unavailable" }, { status: 503, headers: cors })
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  const eventId = typeof event.id === "string" ? event.id : null
  if (await alreadyProcessed(admin, eventId)) {
    return Response.json({ received: true, duplicate: true }, { headers: cors })
  }

  const eventName = event.event ?? ""
  const paymentEntity = event.payload?.payment?.entity
  const refundEntity = event.payload?.refund?.entity

  try {
    if (eventName === "payment.captured" && paymentEntity) {
      return await handlePaymentCaptured(admin, keyId, keySecret, paymentEntity, eventId)
    }
    if (eventName === "payment.failed" && paymentEntity) {
      return await handlePaymentFailed(admin, paymentEntity, eventId)
    }
    if ((eventName === "refund.created" || eventName === "refund.processed") && refundEntity) {
      return await handleRefund(admin, refundEntity, eventName, eventId)
    }
  } catch (e) {
    console.error("razorpay-marketplace-webhook error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Webhook processing failed" }, { status: 500, headers: cors })
  }

  // Unhandled event types are acknowledged so Razorpay does not retry.
  return Response.json({ received: true }, { headers: cors })
})
