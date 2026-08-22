import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  GRANTING_SUBSCRIPTION_STATUSES,
  REVOKING_SUBSCRIPTION_STATUSES,
  grantPlanEntitlement,
  paidPlan,
  revokePlanEntitlementIfNeeded,
  verifyWebhookSignature,
} from "../_shared/razorpay.ts"

const cors = { "Access-Control-Allow-Origin": "*" }

interface RazorpayWebhook {
  event?: string
  id?: string
  payload?: {
    payment?: { entity?: Record<string, unknown> }
    subscription?: { entity?: Record<string, unknown> }
  }
}

function noteValue(notes: unknown, key: string): string | null {
  if (!notes || typeof notes !== "object") return null
  const value = (notes as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

async function findLedgerBySubscription(
  admin: ReturnType<typeof createClient>,
  subscriptionId: string,
) {
  return admin
    .from("payments")
    .select("id, user_id, plan_id, amount_minor, status, subscription_status")
    .eq("provider", "razorpay")
    .eq("external_subscription_id", subscriptionId)
    .maybeSingle()
}

async function markWebhookSeen(
  admin: ReturnType<typeof createClient>,
  eventId: string | null,
): Promise<boolean> {
  if (!eventId) return false
  const { data: seen } = await admin
    .from("payments")
    .select("id")
    .eq("webhook_event_id", eventId)
    .maybeSingle()
  return Boolean(seen)
}

async function activateSubscription(
  admin: ReturnType<typeof createClient>,
  row: { id: string; user_id: string; plan_id: string },
  subscriptionStatus: string,
  paymentId: string | null,
  webhookEventId: string | null,
) {
  const plan = paidPlan(row.plan_id)
  if (!plan) return

  const now = new Date().toISOString()
  await admin
    .from("payments")
    .update({
      status: "paid",
      subscription_status: subscriptionStatus,
      external_payment_id: paymentId ?? undefined,
      paid_at: now,
      updated_at: now,
      webhook_event_id: webhookEventId,
      metadata: { last_activation_at: now },
    })
    .eq("id", row.id)

  await grantPlanEntitlement(admin, row.user_id, plan.planId)
}

async function updateSubscriptionLifecycle(
  admin: ReturnType<typeof createClient>,
  row: { id: string; user_id: string; plan_id: string },
  subscriptionStatus: string,
  paymentStatus: "paid" | "failed" | "cancelled" | "pending",
  webhookEventId: string | null,
  failureReason?: string | null,
) {
  const now = new Date().toISOString()
  await admin
    .from("payments")
    .update({
      status: paymentStatus,
      subscription_status: subscriptionStatus,
      updated_at: now,
      webhook_event_id: webhookEventId,
      failure_reason: failureReason ?? null,
    })
    .eq("id", row.id)

  if (GRANTING_SUBSCRIPTION_STATUSES.has(subscriptionStatus) && paymentStatus === "paid") {
    await grantPlanEntitlement(admin, row.user_id, row.plan_id)
    return
  }

  if (REVOKING_SUBSCRIPTION_STATUSES.has(subscriptionStatus) || paymentStatus === "cancelled") {
    await revokePlanEntitlementIfNeeded(admin, row.user_id)
  }
}

Deno.serve(async req => {
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")
  if (!webhookSecret) {
    return Response.json({ error: "Razorpay webhook not configured" }, { status: 501, headers: cors })
  }

  const signature = req.headers.get("x-razorpay-signature")
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400, headers: cors })

  const body = await req.text()
  const valid = await verifyWebhookSignature(body, signature, webhookSecret)
  if (!valid) return Response.json({ error: "Bad signature" }, { status: 400, headers: cors })

  let event: RazorpayWebhook
  try {
    event = JSON.parse(body) as RazorpayWebhook
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400, headers: cors })
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  const eventId = typeof event.id === "string" ? event.id : null
  if (await markWebhookSeen(admin, eventId)) {
    return Response.json({ received: true, duplicate: true })
  }

  const eventName = event.event ?? ""
  const subEntity = event.payload?.subscription?.entity
  const paymentEntity = event.payload?.payment?.entity

  if (subEntity && typeof subEntity.id === "string") {
    const subscriptionId = subEntity.id
    const { data: row } = await findLedgerBySubscription(admin, subscriptionId)

    if (!row) {
      console.warn("razorpay webhook: unknown subscription", subscriptionId, eventName)
      return Response.json({ received: true })
    }

    const notesPlanId = noteValue(subEntity.notes, "plan_id")
    if (notesPlanId && notesPlanId !== row.plan_id) {
      console.warn("razorpay webhook: plan note mismatch", subscriptionId)
      return Response.json({ received: true })
    }

    const remoteStatus = typeof subEntity.status === "string" ? subEntity.status : ""
    const paymentId = typeof paymentEntity?.id === "string" ? paymentEntity.id : null

    if (eventName === "subscription.authenticated" || eventName === "subscription.activated") {
      if (GRANTING_SUBSCRIPTION_STATUSES.has(remoteStatus)) {
        await activateSubscription(admin, row, remoteStatus, paymentId, eventId)
      }
      return Response.json({ received: true })
    }

    if (eventName === "subscription.charged") {
      const amount = typeof paymentEntity?.amount === "number" ? paymentEntity.amount : null
      if (amount != null && row.amount_minor !== amount) {
        console.warn("razorpay webhook: renewal amount mismatch", subscriptionId)
        return Response.json({ received: true })
      }
      await activateSubscription(admin, row, remoteStatus || "active", paymentId, eventId)
      return Response.json({ received: true })
    }

    if (eventName === "subscription.halted" || eventName === "subscription.completed") {
      await updateSubscriptionLifecycle(admin, row, remoteStatus, "cancelled", eventId)
      return Response.json({ received: true })
    }

    if (eventName === "subscription.paused") {
      await updateSubscriptionLifecycle(admin, row, "paused", "cancelled", eventId)
      return Response.json({ received: true })
    }

    if (eventName === "subscription.cancelled") {
      const cancelAtCycleEnd = subEntity.cancel_at_cycle_end === true
      if (cancelAtCycleEnd && GRANTING_SUBSCRIPTION_STATUSES.has(remoteStatus)) {
        await admin
          .from("payments")
          .update({
            subscription_status: remoteStatus,
            updated_at: new Date().toISOString(),
            webhook_event_id: eventId,
            metadata: { cancel_at_cycle_end: true },
          })
          .eq("id", row.id)
      } else {
        await updateSubscriptionLifecycle(admin, row, "cancelled", "cancelled", eventId)
      }
      return Response.json({ received: true })
    }

    if (eventName === "subscription.pending") {
      await admin
        .from("payments")
        .update({
          status: "pending",
          subscription_status: "pending",
          updated_at: new Date().toISOString(),
          webhook_event_id: eventId,
        })
        .eq("id", row.id)
      return Response.json({ received: true })
    }
  }

  if (eventName === "payment.failed" && paymentEntity) {
    const subscriptionId = typeof paymentEntity.subscription_id === "string"
      ? paymentEntity.subscription_id
      : null
    if (subscriptionId) {
      const { data: row } = await findLedgerBySubscription(admin, subscriptionId)
      if (row) {
        await updateSubscriptionLifecycle(
          admin,
          row,
          row.subscription_status ?? "pending",
          "failed",
          eventId,
          typeof paymentEntity.error_description === "string"
            ? paymentEntity.error_description
            : "Payment failed",
        )
      }
    }
  }

  return Response.json({ received: true })
})
