import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

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

    const body = (await req.json().catch(() => ({}))) as { idempotency_key?: string }
    const idempotencyKey = body.idempotency_key?.trim()
    if (!idempotencyKey) {
      return Response.json({ error: "Idempotency key is required" }, { status: 400, headers: cors })
    }

    const { data: payoutId, error } = await supabase.rpc("create_tutor_payout_request", {
      p_tutor_id: userData.user.id,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      const message = error.message || "Could not create payout request"
      const status =
        message.includes("payout_account_not_verified") ? 400
        : message.includes("no_available_balance") ? 400
        : message.includes("below_minimum_payout") ? 400
        : 500
      return Response.json({ error: humanize(message) }, { status, headers: cors })
    }

    return Response.json({
      ok: true,
      payout_id: payoutId,
      status: "approved",
      provider_execution: "pending",
      message:
        "Payout request recorded. Razorpay Route/transfer execution is not enabled yet; funds remain reserved until provider integration is activated.",
    }, { headers: cors })
  } catch (e) {
    console.error("request-tutor-payout error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Could not create payout request" }, { status: 500, headers: cors })
  }
})

function humanize(code: string) {
  if (code.includes("payout_account_not_verified")) {
    return "Connect and verify a payout account before requesting a withdrawal."
  }
  if (code.includes("no_available_balance")) {
    return "No earnings are available for payout yet. Completed paid sessions become available after the session is marked completed."
  }
  if (code.includes("below_minimum_payout")) {
    return "Available balance is below the minimum payout threshold."
  }
  return code
}
