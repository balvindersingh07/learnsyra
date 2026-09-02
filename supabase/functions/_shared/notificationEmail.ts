import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"
import { buildNotificationEmail, sendEmail, type EmailEventType } from "./email.ts"

const EMAIL_EVENTS = new Set<EmailEventType>([
  "booking_status",
  "booking_confirmed",
  "project_review",
  "moderation",
  "payout",
  "account",
])

export function serviceAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )
}

export function isEmailEventType(value: string): value is EmailEventType {
  return EMAIL_EVENTS.has(value as EmailEventType)
}

async function lookupRecipientEmail(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  return data.user.email
}

async function lookupRecipientName(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle()
  return (data as { full_name?: string | null } | null)?.full_name ?? null
}

export async function callerMayNotifyRecipient(
  admin: SupabaseClient,
  callerId: string,
  recipientId: string,
): Promise<boolean> {
  if (callerId === recipientId) return true

  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", callerId).maybeSingle()
  const role = (callerProfile as { role?: string } | null)?.role
  if (role === "admin") return true
  if (role !== "tutor") return false

  const { data: courses } = await admin.from("courses").select("id").eq("tutor_id", callerId)
  const courseIds = ((courses as { id: string }[]) ?? []).map(row => row.id)
  if (courseIds.length) {
    const { count } = await admin
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", recipientId)
      .in("course_id", courseIds)
    if ((count ?? 0) > 0) return true
  }

  const { data: listings } = await admin.from("tutor_listings").select("id").eq("profile_id", callerId)
  const listingIds = ((listings as { id: string }[]) ?? []).map(row => row.id)
  if (listingIds.length) {
    const { count } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("student_id", recipientId)
      .in("tutor_listing_id", listingIds)
    if ((count ?? 0) > 0) return true
  }

  return false
}

async function alreadyDelivered(admin: SupabaseClient, idempotencyKey: string) {
  const { data } = await admin
    .from("notification_email_deliveries")
    .select("idempotency_key")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  return Boolean(data)
}

async function recordDelivery(
  admin: SupabaseClient,
  input: { idempotencyKey: string; notificationId: string | null; userId: string; eventType: EmailEventType },
) {
  await admin.from("notification_email_deliveries").insert({
    idempotency_key: input.idempotencyKey,
    notification_id: input.notificationId,
    user_id: input.userId,
    event_type: input.eventType,
  })
}

export async function deliverNotificationEmail(
  admin: SupabaseClient,
  input: {
    notificationId: string | null
    userId: string
    title: string
    body?: string | null
    href?: string | null
    eventType: EmailEventType
    idempotencyKey: string
  },
): Promise<{ ok: boolean; skipped?: boolean }> {
  if (await alreadyDelivered(admin, input.idempotencyKey)) {
    return { ok: true, skipped: true }
  }

  const to = await lookupRecipientEmail(admin, input.userId)
  if (!to) {
    console.info("notification email skipped: recipient email unavailable", input.userId)
    return { ok: false, skipped: true }
  }

  const recipientName = await lookupRecipientName(admin, input.userId)
  const built = buildNotificationEmail({
    eventType: input.eventType,
    title: input.title,
    body: input.body?.trim() || "Sign in to LearnSyra for details.",
    href: input.href,
    recipientName,
  })

  const result = await sendEmail({
    to,
    subject: built.subject,
    html: built.html,
    text: built.text,
    idempotencyKey: input.idempotencyKey,
  })

  if (result.ok) {
    await recordDelivery(admin, {
      idempotencyKey: input.idempotencyKey,
      notificationId: input.notificationId,
      userId: input.userId,
      eventType: input.eventType,
    })
  }

  return { ok: result.ok, skipped: result.skipped }
}

export async function createNotificationAndEmail(
  admin: SupabaseClient,
  input: {
    userId: string
    title: string
    body?: string | null
    href?: string | null
    eventType: EmailEventType
    idempotencyKey: string
  },
) {
  const { data: row, error } = await admin
    .from("notifications")
    .insert({
      user_id: input.userId,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("notification insert failed", error.code)
    return { ok: false as const }
  }

  const notificationId = (row as { id: string }).id
  void deliverNotificationEmail(admin, {
    notificationId,
    userId: input.userId,
    title: input.title,
    body: input.body,
    href: input.href,
    eventType: input.eventType,
    idempotencyKey: input.idempotencyKey,
  }).catch(err => {
    console.error("notification email failed", err instanceof Error ? err.message : "unknown")
  })

  return { ok: true as const, notificationId }
}
