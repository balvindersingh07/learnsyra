import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { verifyMarketplaceWebhookSignature } from "../_shared/marketplace.ts"
import {
  fetchDirectTransfer,
  reconcilePayoutWithTransfer,
  type TutorPayoutRow,
} from "../_shared/routeTransfers.ts"

const cors = { "Access-Control-Allow-Origin": "*" }

interface RazorpayTransferWebhook {
  event?: string
  id?: string
  payload?: {
    transfer?: {
      entity?: {
        id?: string
        status?: string
        amount?: number
        currency?: string
        recipient?: string
        notes?: Record<string, unknown> | unknown[]
      }
    }
  }
}

type Admin = ReturnType<typeof createClient>

Deno.serve(async req => {
  // Prefer dedicated Route webhook secret; fall back to marketplace secret only if unset.
  const webhookSecret =
    Deno.env.get("RAZORPAY_ROUTE_WEBHOOK_SECRET")?.trim() ||
    Deno.env.get("RAZORPAY_MARKETPLACE_WEBHOOK_SECRET")?.trim()

  if (!webhookSecret) {
    return Response.json({ error: "Route webhook not configured" }, { status: 501, headers: cors })
  }

  const signature = req.headers.get("x-razorpay-signature")
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400, headers: cors })

  const rawBody = await req.text()
  const valid = await verifyMarketplaceWebhookSignature(rawBody, signature, webhookSecret)
  if (!valid) return Response.json({ error: "Bad signature" }, { status: 400, headers: cors })

  let event: RazorpayTransferWebhook
  try {
    event = JSON.parse(rawBody) as RazorpayTransferWebhook
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400, headers: cors })
  }

  const eventName = event.event ?? ""
  const entity = event.payload?.transfer?.entity
  const transferId = entity?.id?.trim()

  // Acknowledge unrelated events so Razorpay does not retry endlessly.
  if (!transferId || !eventName.startsWith("transfer.")) {
    return Response.json({ received: true }, { headers: cors })
  }

  if (
    eventName !== "transfer.processed" &&
    eventName !== "transfer.failed" &&
    eventName !== "transfer.reversed" &&
    // Some accounts emit generic transfer updates.
    eventName !== "transfer.updated"
  ) {
    return Response.json({ received: true }, { headers: cors })
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  try {
    const { data: payout } = await admin
      .from("tutor_payouts")
      .select("id, tutor_id, payout_account_id, amount_minor, currency, status, provider_transfer_id, provider_payout_id, failure_reason, idempotency_key")
      .eq("provider_transfer_id", transferId)
      .maybeSingle()

    if (!payout) {
      // Not a LearnSyra payout transfer (or not yet linked). Ack.
      return Response.json({ received: true }, { headers: cors })
    }

    // Idempotent: already terminal in a matching state.
    if (payout.status === "paid" && (eventName === "transfer.processed")) {
      return Response.json({ received: true, duplicate: true }, { headers: cors })
    }
    if (payout.status === "failed" && (eventName === "transfer.failed" || eventName === "transfer.reversed")) {
      return Response.json({ received: true, duplicate: true }, { headers: cors })
    }

    // Never trust webhook body alone — fetch transfer from Razorpay.
    const remote = await fetchDirectTransfer(transferId)
    if (!remote.ok) {
      return Response.json({ error: "Could not verify transfer" }, { status: 502, headers: cors })
    }

    await reconcilePayoutWithTransfer(admin, payout as TutorPayoutRow, remote.transfer)
    return Response.json({ received: true }, { headers: cors })
  } catch (e) {
    console.error("razorpay-route-webhook error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Webhook processing failed" }, { status: 500, headers: cors })
  }
})
