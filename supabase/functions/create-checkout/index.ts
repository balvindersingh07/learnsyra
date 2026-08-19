import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@18.5.0"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const catalog: Record<string, { name: string; amount: number }> = {
  student_pro: { name: "LearnSyra Student Pro", amount: 2900 },
  career_pro: { name: "LearnSyra Career Pro", amount: 5900 },
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

    const { planId, origin } = (await req.json()) as { planId?: string; origin?: string }
    if (!planId || !catalog[planId]) {
      return Response.json({ error: "Invalid plan" }, { status: 400, headers: cors })
    }

    const secret = Deno.env.get("STRIPE_SECRET_KEY")
    if (!secret) {
      return Response.json(
        { mode: "local", plan: planId },
        { headers: { ...cors, "Content-Type": "application/json" } },
      )
    }

    const stripe = new Stripe(secret)
    const item = catalog[planId]
    const site = (origin ?? Deno.env.get("SITE_URL") ?? "http://localhost:8443").replace(/\/$/, "")
    const suffix = Math.random().toString(36).slice(2, 10)

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: userData.user.email ?? undefined,
      client_reference_id: userData.user.id,
      integration_identifier: `learnsyra-pricing-${suffix}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: item.amount,
            recurring: { interval: "month" },
            product_data: { name: item.name },
          },
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: userData.user.id, plan: planId },
      },
      metadata: { user_id: userData.user.id, plan: planId },
      success_url: `${site}/pricing?paid=1`,
      cancel_url: `${site}/pricing?canceled=1`,
    })

    return Response.json(
      { mode: "stripe", url: session.url },
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    )
  }
})
