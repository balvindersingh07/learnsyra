import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { razorpayBasicAuth, verifyOrderPaymentSignature } from "../_shared/marketplace.ts"

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
      razorpay_payment_id?: string
      razorpay_order_id?: string
      razorpay_signature?: string
      booking_id?: string
    }

    const paymentId = body.razorpay_payment_id?.trim()
    const orderId = body.razorpay_order_id?.trim()
    const signature = body.razorpay_signature?.trim()
    const bookingId = body.booking_id?.trim()

    if (!paymentId || !orderId || !signature || !bookingId) {
      return Response.json({ error: "Invalid payment response" }, { status: 400, headers: cors })
    }

    const valid = await verifyOrderPaymentSignature(paymentId, orderId, signature, keySecret)
    if (!valid) {
      return Response.json({ error: "Payment verification failed" }, { status: 400, headers: cors })
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select("id, student_id, payment_status, status, marketplace_payment_id, amount_minor")
      .eq("id", bookingId)
      .maybeSingle()

    if (bookingErr || !booking) {
      return Response.json({ error: "Booking not found" }, { status: 404, headers: cors })
    }
    if (booking.student_id !== userData.user.id) {
      return Response.json({ error: "Payment verification failed" }, { status: 403, headers: cors })
    }

    const { data: paymentRow, error: payErr } = await admin
      .from("marketplace_payments")
      .select(
        "id, booking_id, student_id, tutor_id, amount_minor, platform_fee_minor, tutor_earning_minor, currency, status, external_order_id",
      )
      .eq("booking_id", bookingId)
      .maybeSingle()

    if (payErr || !paymentRow) {
      return Response.json({ error: "Payment record not found" }, { status: 404, headers: cors })
    }
    if (paymentRow.student_id !== userData.user.id) {
      return Response.json({ error: "Payment verification failed" }, { status: 403, headers: cors })
    }
    if (paymentRow.external_order_id !== orderId) {
      return Response.json({ error: "Payment order mismatch" }, { status: 400, headers: cors })
    }

    if (paymentRow.status === "paid" && booking.payment_status === "paid") {
      return Response.json({ ok: true, bookingId, alreadyPaid: true }, { headers: cors })
    }

    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}` },
    })
    if (!payRes.ok) {
      return Response.json({ error: "Could not confirm payment. Try again." }, { status: 502, headers: cors })
    }

    const remotePay = await payRes.json() as {
      status?: string
      amount?: number
      order_id?: string
      currency?: string
    }

    if (remotePay.order_id !== orderId || remotePay.order_id !== paymentRow.external_order_id) {
      return Response.json({ error: "Payment order mismatch" }, { status: 400, headers: cors })
    }
    if (remotePay.amount !== paymentRow.amount_minor) {
      return Response.json({ error: "Payment amount mismatch" }, { status: 400, headers: cors })
    }
    if (remotePay.status !== "captured") {
      return Response.json({ error: "Payment not completed" }, { status: 400, headers: cors })
    }

    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}` },
    })
    if (!orderRes.ok) {
      return Response.json({ error: "Could not confirm payment. Try again." }, { status: 502, headers: cors })
    }

    const remoteOrder = await orderRes.json() as { id?: string; amount?: number; amount_paid?: number; status?: string }
    if (remoteOrder.id !== orderId || remoteOrder.amount !== paymentRow.amount_minor) {
      return Response.json({ error: "Payment amount mismatch" }, { status: 400, headers: cors })
    }

    const now = new Date().toISOString()

    const { error: mpUpdateErr } = await admin
      .from("marketplace_payments")
      .update({
        status: "paid",
        external_payment_id: paymentId,
        paid_at: now,
        updated_at: now,
      })
      .eq("id", paymentRow.id)
      .neq("status", "paid")

    if (mpUpdateErr) {
      console.error("marketplace payment update failed", mpUpdateErr.code)
      return Response.json({ error: "Could not confirm payment" }, { status: 500, headers: cors })
    }

    const { error: bookingUpdateErr } = await admin
      .from("bookings")
      .update({
        payment_status: "paid",
        status: "confirmed",
      })
      .eq("id", bookingId)

    if (bookingUpdateErr) {
      console.error("booking update failed", bookingUpdateErr.code)
      return Response.json({ error: "Could not confirm booking" }, { status: 500, headers: cors })
    }

    const { data: existingEarn } = await admin
      .from("tutor_earnings")
      .select("id")
      .eq("marketplace_payment_id", paymentRow.id)
      .maybeSingle()

    if (!existingEarn) {
      const { error: earnErr } = await admin.from("tutor_earnings").insert({
        marketplace_payment_id: paymentRow.id,
        tutor_id: paymentRow.tutor_id,
        booking_id: bookingId,
        gross_minor: paymentRow.amount_minor,
        platform_fee_minor: paymentRow.platform_fee_minor,
        net_minor: paymentRow.tutor_earning_minor,
        currency: paymentRow.currency ?? "INR",
        payout_status: "pending",
        earned_at: now,
      })
      if (earnErr) {
        console.error("tutor earning insert failed", earnErr.code)
        return Response.json({ error: "Could not record tutor earning" }, { status: 500, headers: cors })
      }
    }

    return Response.json({ ok: true, bookingId }, { headers: cors })
  } catch (e) {
    console.error("verify-tutor-session-payment error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Could not confirm payment" }, { status: 400, headers: cors })
  }
})
