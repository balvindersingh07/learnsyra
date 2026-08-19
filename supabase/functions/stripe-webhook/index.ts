import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@18.5.0"

Deno.serve(async req => {
  const secret = Deno.env.get("STRIPE_SECRET_KEY")
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")
  if (!secret || !whSecret) {
    return Response.json({ error: "Stripe webhook not configured" }, { status: 501 })
  }

  const stripe = new Stripe(secret)
  const signature = req.headers.get("stripe-signature")
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, signature, whSecret)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Bad signature" }, { status: 400 })
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id ?? session.client_reference_id
    const plan = session.metadata?.plan
    if (userId && plan) {
      await admin
        .from("profiles")
        .update({
          plan,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        })
        .eq("id", userId)
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.user_id
    if (userId) {
      await admin.from("profiles").update({ plan: "free" }).eq("id", userId)
    }
  }

  return Response.json({ received: true })
})
