import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  GRANTING_SUBSCRIPTION_STATUSES,
  grantPlanEntitlement,
  paidPlan,
  razorpayBasicAuth,
  verifySubscriptionSignature,
} from "../_shared/razorpay.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) {
      return Response.json({ error: "Payments unavailable. Coming soon." }, { status: 503, headers: cors })
    }

    const body = (await req.json()) as {
      subscriptionId?: string
      paymentId?: string
      signature?: string
    }
    const subscriptionId = body.subscriptionId?.trim()
    const paymentId = body.paymentId?.trim()
    const signature = body.signature?.trim()
    if (!subscriptionId || !paymentId || !signature) {
      return Response.json({ error: "Invalid payment response" }, { status: 400, headers: cors })
    }

    const valid = await verifySubscriptionSignature(paymentId, subscriptionId, signature, keySecret)
    if (!valid) {
      return Response.json({ error: "Payment verification failed" }, { status: 400, headers: cors })
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: row, error: rowErr } = await admin
      .from("payments")
      .select("id, user_id, plan_id, amount_minor, status, subscription_status")
      .eq("provider", "razorpay")
      .eq("external_subscription_id", subscriptionId)
      .maybeSingle()

    if (rowErr || !row) {
      return Response.json({ error: "Subscription not found" }, { status: 404, headers: cors })
    }
    if (row.user_id !== userData.user.id) {
      return Response.json({ error: "Payment verification failed" }, { status: 403, headers: cors })
    }

    const plan = paidPlan(row.plan_id)
    if (!plan) {
      return Response.json({ error: "Invalid plan on subscription record" }, { status: 400, headers: cors })
    }

    const subRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}` },
    })
    if (!subRes.ok) {
      return Response.json({ error: "Could not confirm subscription. Try again." }, { status: 502, headers: cors })
    }

    const remoteSub = await subRes.json() as { status?: string; plan_id?: string; notes?: Record<string, string> }
    const remoteStatus = remoteSub.status ?? ""
    const remotePlanId = remoteSub.notes?.plan_id ?? row.plan_id

    if (remotePlanId !== row.plan_id) {
      return Response.json({ error: "Subscription plan mismatch" }, { status: 400, headers: cors })
    }

    if (!GRANTING_SUBSCRIPTION_STATUSES.has(remoteStatus)) {
      return Response.json(
        { ok: false, status: remoteStatus, pending: true },
        { headers: cors },
      )
    }

    const now = new Date().toISOString()
    if (row.status !== "paid" || row.subscription_status !== remoteStatus) {
      const { error: payErr } = await admin
        .from("payments")
        .update({
          status: "paid",
          subscription_status: remoteStatus,
          external_payment_id: paymentId,
          paid_at: now,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", row.id)

      if (payErr) {
        console.error("subscription update failed", payErr.code)
        return Response.json({ error: "Could not confirm subscription" }, { status: 500, headers: cors })
      }
    }

    await grantPlanEntitlement(admin, row.user_id, plan.planId)

    return Response.json(
      { ok: true, planId: plan.planId, status: remoteStatus, subscriptionStatus: remoteStatus },
      { headers: cors },
    )
  } catch (e) {
    console.error("verify-razorpay-payment error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Could not confirm subscription" }, { status: 400, headers: cors })
  }
})
