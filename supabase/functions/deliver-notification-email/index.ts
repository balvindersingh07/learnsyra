import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  callerMayNotifyRecipient,
  deliverNotificationEmail,
  isEmailEventType,
  serviceAdmin,
} from "../_shared/notificationEmail.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors })
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return Response.json({ error: "Not logged in" }, { status: 401, headers: cors })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return Response.json({ error: "Not logged in" }, { status: 401, headers: cors })
    }

    const body = await req.json().catch(() => null) as {
      notificationId?: string
      eventType?: string
      idempotencyKey?: string
    } | null

    const notificationId = body?.notificationId?.trim()
    const eventType = body?.eventType?.trim() ?? ""
    const idempotencyKey = body?.idempotencyKey?.trim()

    if (!notificationId || !idempotencyKey || !isEmailEventType(eventType)) {
      return Response.json({ error: "Invalid request" }, { status: 400, headers: cors })
    }

    const admin = serviceAdmin()
    const { data: notification, error: loadErr } = await admin
      .from("notifications")
      .select("id, user_id, title, body, href, created_at")
      .eq("id", notificationId)
      .maybeSingle()

    if (loadErr || !notification) {
      return Response.json({ error: "Notification not found" }, { status: 404, headers: cors })
    }

    const row = notification as {
      id: string
      user_id: string
      title: string
      body: string | null
      href: string | null
      created_at: string
    }

    const createdAt = new Date(row.created_at).getTime()
    if (Number.isNaN(createdAt) || Date.now() - createdAt > 10 * 60 * 1000) {
      return Response.json({ error: "Notification is too old for email delivery" }, { status: 400, headers: cors })
    }

    const allowed = await callerMayNotifyRecipient(admin, userData.user.id, row.user_id)
    if (!allowed && userData.user.id !== row.user_id) {
      return Response.json({ error: "Not allowed" }, { status: 403, headers: cors })
    }

    const result = await deliverNotificationEmail(admin, {
      notificationId: row.id,
      userId: row.user_id,
      title: row.title,
      body: row.body,
      href: row.href,
      eventType,
      idempotencyKey,
    })

    return Response.json(
      { ok: result.ok, skipped: result.skipped ?? false },
      { status: result.ok || result.skipped ? 200 : 502, headers: cors },
    )
  } catch (e) {
    console.error("deliver-notification-email failed", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Email delivery failed" }, { status: 500, headers: cors })
  }
})
