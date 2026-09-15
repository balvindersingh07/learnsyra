import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function serviceAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? ""
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!url || !serviceKey) {
    throw new Error("Server configuration is incomplete.")
  }
  return createClient(url, serviceKey)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: cors })
}

async function assertCallerIsAdmin(supabase: SupabaseClient) {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return { ok: false as const, status: 401, message: "Not logged in" }
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userData.user.id)
    .maybeSingle()

  if (profileErr) {
    return { ok: false as const, status: 500, message: profileErr.message }
  }
  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, message: "Admin access required." }
  }

  return {
    ok: true as const,
    callerId: userData.user.id,
    callerName: profile.full_name ?? null,
    callerRole: profile.role ? String(profile.role) : null,
  }
}

async function financialRetentionReason(admin: SupabaseClient, userId: string) {
  const { count: paymentCount, error: paymentErr } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  if (paymentErr) {
    return { status: 500, message: `Could not verify payment records: ${paymentErr.message}` }
  }
  if ((paymentCount ?? 0) > 0) {
    return { status: 400, message: "This account has subscription payment records and cannot be deleted." }
  }

  const { count: marketplaceCount, error: marketplaceErr } = await admin
    .from("marketplace_payments")
    .select("id", { count: "exact", head: true })
    .or(`student_id.eq.${userId},tutor_id.eq.${userId}`)
  if (marketplaceErr) {
    return { status: 500, message: `Could not verify marketplace payment records: ${marketplaceErr.message}` }
  }
  if ((marketplaceCount ?? 0) > 0) {
    return { status: 400, message: "This account has marketplace payment records and cannot be deleted." }
  }

  const { count: payoutCount, error: payoutErr } = await admin
    .from("tutor_payouts")
    .select("id", { count: "exact", head: true })
    .eq("tutor_id", userId)
  if (payoutErr) {
    return { status: 500, message: `Could not verify tutor payout records: ${payoutErr.message}` }
  }
  if ((payoutCount ?? 0) > 0) {
    return { status: 400, message: "This account has tutor payout records and cannot be deleted." }
  }

  return null
}

async function recordDeletionAudit(
  admin: SupabaseClient,
  gate: { callerId: string; callerName: string | null; callerRole: string | null },
  targetUserId: string,
  targetName: string,
  targetRole: string,
) {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: gate.callerId,
    actor_name: gate.callerName,
    actor_role: gate.callerRole,
    action: "user.delete",
    entity_type: "user",
    entity_id: targetUserId,
    entity_name: targetName,
    status: "success",
    source: "admin",
    description: `Admin deleted user account (${targetRole}).`,
    old_status: targetRole,
    new_status: "deleted",
    changed_field: "account",
    metadata: { deleted_role: targetRole },
  })

  if (!error) return null

  const message = error.message || "Could not record audit log before deletion."
  if (/audit_logs|log_admin_audit_event|schema cache/i.test(message)) {
    return {
      status: 503,
      message: "Audit logging is not available. Apply the latest database migrations, then retry.",
    }
  }
  return { status: 500, message: `Could not record audit log before deletion: ${message}` }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    if (!url || !anonKey) {
      return jsonError("Server configuration is incomplete.", 503)
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const gate = await assertCallerIsAdmin(supabase)
    if (!gate.ok) {
      return jsonError(gate.message, gate.status)
    }

    const body = (await req.json().catch(() => ({}))) as { userId?: string }
    const targetUserId = body.userId?.trim() ?? ""
    if (!isUuid(targetUserId)) {
      return jsonError("A valid user ID is required.", 400)
    }

    if (targetUserId === gate.callerId) {
      return jsonError("You cannot delete your own account.", 400)
    }

    const admin = serviceAdmin()

    const { data: target, error: targetErr } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", targetUserId)
      .maybeSingle()

    if (targetErr) {
      return jsonError(targetErr.message, 500)
    }
    if (!target) {
      return jsonError("User not found.", 404)
    }

    if (target.role === "admin") {
      const { count: adminCount, error: adminCountErr } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
      if (adminCountErr) {
        return jsonError(adminCountErr.message, 500)
      }
      if ((adminCount ?? 0) <= 1) {
        return jsonError("The last remaining admin account cannot be deleted.", 400)
      }
    }

    const retentionReason = await financialRetentionReason(admin, targetUserId)
    if (retentionReason) {
      return jsonError(retentionReason.message, retentionReason.status)
    }

    const targetRole = String(target.role ?? "student")
    const targetName = typeof target.full_name === "string" && target.full_name.trim()
      ? target.full_name.trim()
      : targetUserId

    const auditFailure = await recordDeletionAudit(admin, gate, targetUserId, targetName, targetRole)
    if (auditFailure) {
      return jsonError(auditFailure.message, auditFailure.status)
    }

    const { error: deleteErr } = await admin.auth.admin.deleteUser(targetUserId)
    if (deleteErr) {
      const message = deleteErr.message || "Could not delete user."
      const status = /not found/i.test(message) ? 404 : 500
      return jsonError(message, status)
    }

    return Response.json({ ok: true, userId: targetUserId }, { headers: cors })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete user."
    console.error("admin-delete-user", message)
    const status = /configuration is incomplete/i.test(message) ? 503 : 500
    return jsonError(message, status)
  }
})
