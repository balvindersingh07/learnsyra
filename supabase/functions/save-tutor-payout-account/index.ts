import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type AccountType = "bank" | "upi"

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

    const body = (await req.json()) as {
      account_type?: AccountType
      masked_account?: string
      account_holder_name?: string
    }

    const accountType = body.account_type
    if (accountType !== "bank" && accountType !== "upi") {
      return Response.json({ error: "Choose bank or UPI payout type" }, { status: 400, headers: cors })
    }

    const masked = sanitizeMaskedAccount(body.masked_account, accountType)
    if (!masked) {
      return Response.json({
        error: accountType === "upi"
          ? "Enter a masked UPI ID (for example name@bank)"
          : "Enter a masked bank account (last 4 digits only)",
      }, { status: 400, headers: cors })
    }

    const holder = body.account_holder_name?.trim().slice(0, 120) || null
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: existing } = await admin
      .from("tutor_payout_accounts")
      .select("id, status")
      .eq("tutor_id", userData.user.id)
      .in("status", ["pending", "verified"])
      .maybeSingle()

    const now = new Date().toISOString()
    const row = {
      tutor_id: userData.user.id,
      provider: "razorpay",
      account_type: accountType,
      masked_account: masked,
      account_holder_name: holder,
      status: "pending",
      verification_metadata: {
        submitted_at: now,
        route_enabled: Boolean(Deno.env.get("RAZORPAY_ROUTE_ENABLED")?.trim()),
      },
      updated_at: now,
    }

    if (existing?.id) {
      if (existing.status === "verified") {
        return Response.json({
          error: "A verified payout account already exists. Contact support to update it.",
        }, { status: 400, headers: cors })
      }
      const { data, error } = await admin
        .from("tutor_payout_accounts")
        .update(row)
        .eq("id", existing.id)
        .select("id, status, account_type, masked_account, account_holder_name, created_at, updated_at")
        .single()
      if (error) return Response.json({ error: error.message }, { status: 500, headers: cors })
      return Response.json({ ok: true, account: data }, { headers: cors })
    }

    const { data, error } = await admin
      .from("tutor_payout_accounts")
      .insert(row)
      .select("id, status, account_type, masked_account, account_holder_name, created_at, updated_at")
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500, headers: cors })

    return Response.json({
      ok: true,
      account: data,
      message:
        "Payout details saved securely. Verification with Razorpay Route is required before withdrawals are enabled.",
    }, { headers: cors })
  } catch (e) {
    console.error("save-tutor-payout-account error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Could not save payout account" }, { status: 500, headers: cors })
  }
})

function sanitizeMaskedAccount(raw: string | undefined, type: AccountType) {
  const value = raw?.trim() ?? ""
  if (!value) return null
  if (type === "upi") {
    if (value.length > 80) return null
    if (!/^[\w.\-@]+$/.test(value)) return null
    return value
  }
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 4) return null
  return `****${digits}`
}
