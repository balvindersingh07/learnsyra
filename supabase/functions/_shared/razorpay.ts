/** Server-side plan catalog for India (INR). Amounts are in paise. */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2"

export const PAID_PLAN_IDS = new Set(["student_pro", "career_pro"])

export type PaidPlanId = "student_pro" | "career_pro"

export interface PlanCatalogItem {
  planId: PaidPlanId
  name: string
  amountMinor: number
  currency: "INR"
  period: "monthly"
  interval: 1
}

export const RAZORPAY_PLAN_CATALOG: Record<PaidPlanId, PlanCatalogItem> = {
  student_pro: {
    planId: "student_pro",
    name: "LearnSyra Student Pro",
    amountMinor: 39900,
    currency: "INR",
    period: "monthly",
    interval: 1,
  },
  career_pro: {
    planId: "career_pro",
    name: "LearnSyra Career Pro",
    amountMinor: 79900,
    currency: "INR",
    period: "monthly",
    interval: 1,
  },
}

/** Subscription states that should grant paid access. */
export const GRANTING_SUBSCRIPTION_STATUSES = new Set(["authenticated", "active"])

/** Subscription states that revoke paid access when no other active sub exists. */
export const REVOKING_SUBSCRIPTION_STATUSES = new Set(["halted", "completed", "paused"])

export function paidPlan(planId: unknown): PlanCatalogItem | null {
  if (typeof planId !== "string" || !PAID_PLAN_IDS.has(planId)) return null
  return RAZORPAY_PLAN_CATALOG[planId as PaidPlanId]
}

export function razorpayPlanIdFor(planId: PaidPlanId): string | null {
  const envKey = planId === "student_pro"
    ? "RAZORPAY_PLAN_ID_STUDENT_PRO"
    : "RAZORPAY_PLAN_ID_CAREER_PRO"
  const value = Deno.env.get(envKey)?.trim()
  return value || null
}

export function razorpayBasicAuth(keyId: string, keySecret: string): string {
  return btoa(`${keyId}:${keySecret}`)
}

export async function verifySubscriptionSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const payload = `${paymentId}|${subscriptionId}`
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  const expected = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("")
  return timingSafeEqual(expected, signature)
}

export async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))
  const expected = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("")
  return timingSafeEqual(expected, signature)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

export async function userHasGrantingSubscription(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("payments")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "razorpay")
    .in("subscription_status", [...GRANTING_SUBSCRIPTION_STATUSES])
    .neq("status", "cancelled")
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function grantPlanEntitlement(
  admin: SupabaseClient,
  userId: string,
  planId: string,
): Promise<void> {
  const plan = paidPlan(planId)
  if (!plan) return
  await admin.from("profiles").update({ plan: plan.planId }).eq("id", userId)
}

export async function revokePlanEntitlementIfNeeded(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const stillActive = await userHasGrantingSubscription(admin, userId)
  if (!stillActive) {
    await admin.from("profiles").update({ plan: "free" }).eq("id", userId)
  }
}
