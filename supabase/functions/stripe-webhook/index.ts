import "jsr:@supabase/functions-js/edge-runtime.d.ts"
/** Legacy Stripe webhook (worldwide — deferred). India uses razorpay-webhook. */
import { createClient } from "npm:@supabase/supabase-js@2"
import Stripe from "npm:stripe@18.5.0"

const PAID_PLANS = new Set(["student_pro", "career_pro"])

function paidPlan(value: unknown): string | null {
  return typeof value === "string" && PAID_PLANS.has(value) ? value : null
}

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
    if (session.status !== "complete") {
      return Response.json({ received: true })
    }
    const userId = session.metadata?.user_id ?? session.client_reference_id
    const plan = paidPlan(session.metadata?.plan)
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

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.user_id
    const status = sub.status
    if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
      if (userId) {
        await admin.from("profiles").update({ plan: "free" }).eq("id", userId)
      } else if (typeof sub.customer === "string") {
        await admin.from("profiles").update({ plan: "free" }).eq("stripe_customer_id", sub.customer)
      }
    } else if ((status === "active" || status === "trialing") && userId) {
      const plan = paidPlan(sub.metadata?.plan)
      if (plan) {
        await admin.from("profiles").update({ plan }).eq("id", userId)
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.user_id
    if (userId) {
      await admin.from("profiles").update({ plan: "free" }).eq("id", userId)
    } else if (typeof sub.customer === "string") {
      await admin.from("profiles").update({ plan: "free" }).eq("stripe_customer_id", sub.customer)
    }
  }

  return Response.json({ received: true })
})
