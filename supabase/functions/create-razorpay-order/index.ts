import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  paidPlan,
  razorpayBasicAuth,
  razorpayPlanIdFor,
} from "../_shared/razorpay.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUBSCRIPTION_TOTAL_COUNT = 120

async function findOrCreateCustomer(
  admin: ReturnType<typeof createClient>,
  keyId: string,
  keySecret: string,
  userId: string,
  email: string,
  name: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("payments")
    .select("external_customer_id")
    .eq("user_id", userId)
    .not("external_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.external_customer_id) return existing.external_customer_id as string

  const custRes = await fetch("https://api.razorpay.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name || undefined,
      email: email || undefined,
      notes: { user_id: userId },
    }),
  })

  if (!custRes.ok) {
    console.error("razorpay customer failed", custRes.status)
    return null
  }

  const customer = await custRes.json() as { id?: string }
  return customer.id ?? null
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

    const { planId } = (await req.json()) as { planId?: string }
    const plan = paidPlan(planId)
    if (!plan) {
      return Response.json({ error: "Invalid plan" }, { status: 400, headers: cors })
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")
    if (!keyId || !keySecret) {
      return Response.json({ error: "Payments unavailable. Coming soon." }, { status: 503, headers: cors })
    }

    const razorpayPlanId = razorpayPlanIdFor(plan.planId)
    if (!razorpayPlanId) {
      console.error("missing razorpay plan id for", plan.planId)
      return Response.json({ error: "Payments unavailable. Coming soon." }, { status: 503, headers: cors })
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: profileRow } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", userData.user.id)
      .maybeSingle()

    const customerName = (profileRow?.full_name as string | null) ?? ""
    const customerEmail = userData.user.email ?? ""
    const customerId = await findOrCreateCustomer(
      admin,
      keyId,
      keySecret,
      userData.user.id,
      customerEmail,
      customerName,
    )
    if (!customerId) {
      return Response.json({ error: "Could not start subscription. Try again." }, { status: 502, headers: cors })
    }

    const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        customer_id: customerId,
        total_count: SUBSCRIPTION_TOTAL_COUNT,
        quantity: 1,
        customer_notify: 1,
        notes: {
          user_id: userData.user.id,
          plan_id: plan.planId,
        },
      }),
    })

    if (!subRes.ok) {
      console.error("razorpay subscription failed", subRes.status)
      return Response.json({ error: "Could not start subscription. Try again." }, { status: 502, headers: cors })
    }

    const subscription = await subRes.json() as { id?: string; status?: string; plan_id?: string }
    if (!subscription.id) {
      return Response.json({ error: "Could not start subscription. Try again." }, { status: 502, headers: cors })
    }

    if (subscription.plan_id !== razorpayPlanId) {
      console.error("razorpay subscription plan mismatch", subscription.id)
      return Response.json({ error: "Could not start subscription. Try again." }, { status: 502, headers: cors })
    }

    const { error: insertErr } = await admin.from("payments").insert({
      user_id: userData.user.id,
      plan_id: plan.planId,
      provider: "razorpay",
      billing_mode: "subscription",
      currency: plan.currency,
      amount_minor: plan.amountMinor,
      external_subscription_id: subscription.id,
      external_customer_id: customerId,
      status: "created",
      subscription_status: subscription.status ?? "created",
      metadata: {
        plan_name: plan.name,
        razorpay_plan_id: razorpayPlanId,
        billing_period: plan.period,
      },
    })

    if (insertErr) {
      console.error("payment row insert failed", insertErr.code)
      return Response.json({ error: "Could not start subscription. Try again." }, { status: 500, headers: cors })
    }

    return Response.json(
      {
        provider: "razorpay",
        mode: "subscription",
        keyId,
        subscriptionId: subscription.id,
        planId: plan.planId,
        planName: plan.name,
        prefill: {
          email: customerEmail,
          name: customerName,
        },
      },
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (e) {
    console.error("create-razorpay-order error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Could not start subscription. Try again." }, { status: 400, headers: cors })
  }
})
