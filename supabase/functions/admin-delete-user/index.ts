import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { serviceAdmin } from "../_shared/notificationEmail.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function assertCallerIsAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return { ok: false as const, status: 401, message: "Not logged in" }
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userData.user.id)
    .maybeSingle()

  if (profileErr || profile?.role !== "admin") {
    return { ok: false as const, status: 403, message: "Admin access required." }
  }

  return {
    ok: true as const,
    callerId: userData.user.id,
    callerName: profile.full_name ?? null,
  }
}

async function financialRetentionReason(admin: ReturnType<typeof serviceAdmin>, userId: string) {
  const { count: paymentCount, error: paymentErr } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  if (paymentErr) return "Could not verify payment records for this account."
  if ((paymentCount ?? 0) > 0) {
    return "This account has subscription payment records and cannot be deleted."
  }

  const { count: marketplaceCount, error: marketplaceErr } = await admin
    .from("marketplace_payments")
    .select("id", { count: "exact", head: true })
    .or(`student_id.eq.${userId},tutor_id.eq.${userId}`)
  if (marketplaceErr) return "Could not verify marketplace payment records for this account."
  if ((marketplaceCount ?? 0) > 0) {
    return "This account has marketplace payment records and cannot be deleted."
  }

  const { count: payoutCount, error: payoutErr } = await admin
    .from("tutor_payouts")
    .select("id", { count: "exact", head: true })
    .eq("tutor_id", userId)
  if (payoutErr) return "Could not verify tutor payout records for this account."
  if ((payoutCount ?? 0) > 0) {
    return "This account has tutor payout records and cannot be deleted."
  }

  return null
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

    const gate = await assertCallerIsAdmin(supabase)
    if (!gate.ok) {
      return Response.json({ error: gate.message }, { status: gate.status, headers: cors })
    }

    const body = (await req.json().catch(() => ({}))) as { userId?: string }
    const targetUserId = body.userId?.trim() ?? ""
    if (!isUuid(targetUserId)) {
      return Response.json({ error: "A valid user ID is required." }, { status: 400, headers: cors })
    }

    if (targetUserId === gate.callerId) {
      return Response.json({ error: "You cannot delete your own account." }, { status: 400, headers: cors })
    }

    const admin = serviceAdmin()

    const { data: target, error: targetErr } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", targetUserId)
      .maybeSingle()

    if (targetErr) {
      return Response.json({ error: targetErr.message }, { status: 500, headers: cors })
    }
    if (!target) {
      return Response.json({ error: "User not found." }, { status: 404, headers: cors })
    }

    if (target.role === "admin") {
      const { count: adminCount, error: adminCountErr } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
      if (adminCountErr) {
        return Response.json({ error: adminCountErr.message }, { status: 500, headers: cors })
      }
      if ((adminCount ?? 0) <= 1) {
        return Response.json({ error: "The last remaining admin account cannot be deleted." }, { status: 400, headers: cors })
      }
    }

    const retentionReason = await financialRetentionReason(admin, targetUserId)
    if (retentionReason) {
      return Response.json({ error: retentionReason }, { status: 400, headers: cors })
    }

    const targetRole = String(target.role ?? "student")
    const targetName = typeof target.full_name === "string" && target.full_name.trim()
      ? target.full_name.trim()
      : targetUserId

    const { error: auditErr } = await supabase.rpc("log_admin_audit_event", {
      p_action: "user.delete",
      p_entity_type: "user",
      p_entity_id: targetUserId,
      p_entity_name: targetName,
      p_status: "success",
      p_source: "admin",
      p_description: `Admin deleted user account (${targetRole}).`,
      p_old_status: targetRole,
      p_new_status: "deleted",
      p_changed_field: "account",
      p_metadata: { deleted_role: targetRole },
    })
    if (auditErr) {
      return Response.json({ error: "Could not record audit log before deletion." }, { status: 500, headers: cors })
    }

    const { error: deleteErr } = await admin.auth.admin.deleteUser(targetUserId)
    if (deleteErr) {
      return Response.json({ error: deleteErr.message || "Could not delete user." }, { status: 500, headers: cors })
    }

    return Response.json({ ok: true, userId: targetUserId }, { headers: cors })
  } catch (err) {
    console.error("admin-delete-user", err instanceof Error ? err.message : "unknown")
    return Response.json({ error: "Could not delete user." }, { status: 500, headers: cors })
  }
})
