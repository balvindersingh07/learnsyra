import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import {
  getRazorpayRouteCredentials,
  isRazorpayRouteEnabled,
  razorpayRouteRequest,
} from "./razorpayRoute.ts"

export type RazorpayTransferStatus =
  | "created"
  | "pending"
  | "processed"
  | "failed"
  | "reversed"
  | "partially_reversed"
  | "unknown"

export interface TutorPayoutRow {
  id: string
  tutor_id: string
  payout_account_id: string | null
  amount_minor: number
  currency: string
  status: string
  provider_transfer_id: string | null
  provider_payout_id: string | null
  failure_reason: string | null
  idempotency_key: string
}

export interface TransferEntity {
  id?: string
  status?: string
  amount?: number
  currency?: string
  recipient?: string
  amount_reversed?: number
  notes?: Record<string, unknown> | unknown[]
  error?: { description?: string | null; code?: string | null; reason?: string | null } | null
}

export function mapTransferStatus(raw: string | null | undefined): RazorpayTransferStatus {
  const value = (raw || "").trim().toLowerCase()
  if (value === "created") return "created"
  if (value === "pending") return "pending"
  if (value === "processed") return "processed"
  if (value === "failed") return "failed"
  if (value === "reversed") return "reversed"
  if (value === "partially_reversed") return "partially_reversed"
  return "unknown"
}

export function payoutStatusFromTransfer(status: RazorpayTransferStatus): "processing" | "paid" | "failed" {
  if (status === "processed") return "paid"
  if (status === "failed" || status === "reversed" || status === "partially_reversed") return "failed"
  return "processing"
}

export function isLinkedAccountEligible(
  account: {
    status: string
    provider_account_id: string | null
    verification_metadata?: Record<string, unknown> | null
  } | null,
): { ok: true; accountId: string } | { ok: false; error: string } {
  if (!account) return { ok: false, error: "Connect and verify a payout account before requesting a withdrawal." }
  if (account.status !== "verified") {
    return { ok: false, error: "Your Razorpay Route account must be verified before withdrawals." }
  }
  const accountId = account.provider_account_id?.trim() || ""
  if (!accountId.startsWith("acc_")) {
    return { ok: false, error: "Razorpay Linked Account is missing. Complete Route onboarding first." }
  }
  const meta = account.verification_metadata || {}
  const phase = String(meta.onboarding_phase || meta.activation_status || "").toLowerCase()
  if (phase === "failed" || phase === "rejected" || phase === "suspended") {
    return { ok: false, error: "Your Razorpay Route account is not active. Retry onboarding or contact support." }
  }
  return { ok: true, accountId }
}

export async function createDirectTransfer(input: {
  linkedAccountId: string
  amountMinor: number
  currency: string
  payoutId: string
  tutorId: string
}): Promise<{ ok: true; transfer: TransferEntity } | { ok: false; error: string }> {
  const creds = getRazorpayRouteCredentials()
  if (!creds) return { ok: false, error: "Payout transfers are temporarily unavailable." }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, error: "Invalid payout amount." }
  }
  if (input.currency !== "INR") return { ok: false, error: "Only INR payouts are supported." }

  const result = await razorpayRouteRequest<TransferEntity>(
    creds.keyId,
    creds.keySecret,
    "POST",
    "/v1/transfers",
    {
      account: input.linkedAccountId,
      amount: input.amountMinor,
      currency: "INR",
      notes: {
        learnsyra_payout_id: input.payoutId,
        learnsyra_tutor_id: input.tutorId,
      },
    },
    {
      // Razorpay Route idempotent direct transfer header.
      "X-Transfer-Idempotency": input.payoutId,
    },
  )

  if (!result.ok || !result.data?.id) {
    return { ok: false, error: result.errorMessage || "Could not create Razorpay transfer." }
  }
  return { ok: true, transfer: result.data }
}

export async function fetchDirectTransfer(
  transferId: string,
): Promise<{ ok: true; transfer: TransferEntity } | { ok: false; error: string }> {
  const creds = getRazorpayRouteCredentials()
  if (!creds) return { ok: false, error: "Payout transfers are temporarily unavailable." }
  if (!transferId.startsWith("trf_")) return { ok: false, error: "Invalid transfer id." }

  const result = await razorpayRouteRequest<TransferEntity>(
    creds.keyId,
    creds.keySecret,
    "GET",
    `/v1/transfers/${transferId}`,
  )
  if (!result.ok || !result.data?.id) {
    return { ok: false, error: result.errorMessage || "Could not fetch transfer status." }
  }
  return { ok: true, transfer: result.data }
}

export async function markPayoutPaid(
  admin: SupabaseClient,
  payoutId: string,
  transferId: string,
  transferStatus: string,
): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .from("tutor_payouts")
    .update({
      status: "paid",
      provider_transfer_id: transferId,
      provider_payout_id: transferStatus.slice(0, 80),
      failure_reason: null,
      processed_at: now,
      updated_at: now,
    })
    .eq("id", payoutId)
    .neq("status", "paid")

  await admin
    .from("tutor_earnings")
    .update({
      payout_status: "paid",
      updated_at: now,
    })
    .eq("payout_id", payoutId)
}

/** Failed/reversed: unlock earnings for a later retry. Never mark as paid. */
export async function markPayoutFailedAndRelease(
  admin: SupabaseClient,
  payoutId: string,
  transferId: string | null,
  reason: string,
): Promise<void> {
  const now = new Date().toISOString()
  const safeReason = reason.replace(/\s+/g, " ").trim().slice(0, 240)

  await admin
    .from("tutor_payouts")
    .update({
      status: "failed",
      provider_transfer_id: transferId,
      failure_reason: safeReason || "Transfer failed",
      processed_at: now,
      updated_at: now,
    })
    .eq("id", payoutId)
    .neq("status", "paid")

  // Release reserved earnings back to available (unless already paid elsewhere).
  await admin
    .from("tutor_earnings")
    .update({
      payout_id: null,
      payout_status: "available",
      updated_at: now,
    })
    .eq("payout_id", payoutId)
    .neq("payout_status", "paid")
}

export async function markPayoutProcessing(
  admin: SupabaseClient,
  payoutId: string,
  transferId: string,
  transferStatus: string,
): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .from("tutor_payouts")
    .update({
      status: "processing",
      provider_transfer_id: transferId,
      provider_payout_id: transferStatus.slice(0, 80),
      failure_reason: null,
      updated_at: now,
    })
    .eq("id", payoutId)
    .in("status", ["approved", "processing", "requested"])
}

/**
 * Reconcile a payout against a Razorpay transfer entity (from create/fetch/webhook).
 * Does not mark paid unless status is processed.
 */
export async function reconcilePayoutWithTransfer(
  admin: SupabaseClient,
  payout: TutorPayoutRow,
  transfer: TransferEntity,
): Promise<{ status: string; transferStatus: RazorpayTransferStatus }> {
  const transferId = transfer.id || payout.provider_transfer_id
  if (!transferId) {
    return { status: payout.status, transferStatus: "unknown" }
  }

  if (typeof transfer.amount === "number" && transfer.amount !== Number(payout.amount_minor)) {
    console.error("route transfer amount mismatch", payout.id)
    await markPayoutFailedAndRelease(admin, payout.id, transferId, "Transfer amount mismatch")
    return { status: "failed", transferStatus: "failed" }
  }

  const transferStatus = mapTransferStatus(transfer.status)
  const next = payoutStatusFromTransfer(transferStatus)

  if (next === "paid") {
    await markPayoutPaid(admin, payout.id, transferId, transferStatus)
    return { status: "paid", transferStatus }
  }

  if (next === "failed") {
    const reason =
      transfer.error?.description ||
      transfer.error?.reason ||
      (transferStatus === "reversed" ? "Transfer reversed" : "Transfer failed")
    await markPayoutFailedAndRelease(admin, payout.id, transferId, String(reason))
    return { status: "failed", transferStatus }
  }

  await markPayoutProcessing(admin, payout.id, transferId, transferStatus)
  return { status: "processing", transferStatus }
}

/**
 * After reservation RPC: create/reconcile Route direct transfer for this payout.
 * Idempotent if provider_transfer_id already exists.
 */
export async function executeRouteTransferForPayout(
  admin: SupabaseClient,
  payoutId: string,
  tutorId: string,
): Promise<{
  ok: boolean
  status: string
  provider_transfer_id: string | null
  message: string
  error?: string
}> {
  if (!isRazorpayRouteEnabled()) {
    return {
      ok: true,
      status: "approved",
      provider_transfer_id: null,
      message:
        "Payout reserved. Razorpay Route transfers are not enabled yet; funds remain reserved until transfers are activated.",
    }
  }

  const { data: payout, error: payoutErr } = await admin
    .from("tutor_payouts")
    .select("id, tutor_id, payout_account_id, amount_minor, currency, status, provider_transfer_id, provider_payout_id, failure_reason, idempotency_key")
    .eq("id", payoutId)
    .maybeSingle()

  if (payoutErr || !payout) {
    return { ok: false, status: "failed", provider_transfer_id: null, message: "", error: "Payout not found." }
  }

  if (payout.tutor_id !== tutorId) {
    return { ok: false, status: payout.status, provider_transfer_id: payout.provider_transfer_id, message: "", error: "Forbidden" }
  }

  if (payout.status === "paid") {
    return {
      ok: true,
      status: "paid",
      provider_transfer_id: payout.provider_transfer_id,
      message: "This payout was already paid.",
    }
  }

  // Idempotent path: existing transfer id → fetch + reconcile, never create another.
  if (payout.provider_transfer_id) {
    const fetched = await fetchDirectTransfer(payout.provider_transfer_id)
    if (!fetched.ok) {
      return {
        ok: false,
        status: payout.status,
        provider_transfer_id: payout.provider_transfer_id,
        message: "",
        error: fetched.error,
      }
    }
    const reconciled = await reconcilePayoutWithTransfer(admin, payout as TutorPayoutRow, fetched.transfer)
    return {
      ok: reconciled.status !== "failed",
      status: reconciled.status,
      provider_transfer_id: payout.provider_transfer_id,
      message:
        reconciled.status === "paid"
          ? "Payout transferred successfully."
          : reconciled.status === "failed"
          ? "Transfer failed. Available balance has been restored for retry."
          : "Transfer is processing with Razorpay.",
      error: reconciled.status === "failed" ? "Transfer failed. You can request payout again once available." : undefined,
    }
  }

  if (!["approved", "requested"].includes(payout.status)) {
    return {
      ok: false,
      status: payout.status,
      provider_transfer_id: null,
      message: "",
      error: `Payout is not eligible for transfer (status: ${payout.status}).`,
    }
  }

  const amountMinor = Number(payout.amount_minor)
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, status: payout.status, provider_transfer_id: null, message: "", error: "Invalid payout amount." }
  }

  // Ensure reserved earnings still match payout amount (no refunded/held slips).
  const { data: links } = await admin
    .from("payout_earnings")
    .select("amount_minor, earning_id")
    .eq("payout_id", payoutId)

  const linked = links || []
  if (linked.length === 0) {
    return { ok: false, status: payout.status, provider_transfer_id: null, message: "", error: "No earnings linked to this payout." }
  }

  const earningIds = linked.map(r => r.earning_id as string).filter(Boolean)
  const { data: earnings } = await admin
    .from("tutor_earnings")
    .select("id, payout_status")
    .in("id", earningIds)

  for (const earning of earnings || []) {
    if (earning.payout_status === "held" || earning.payout_status === "cancelled") {
      return {
        ok: false,
        status: payout.status,
        provider_transfer_id: null,
        message: "",
        error: "One or more earnings are held or cancelled and cannot be transferred.",
      }
    }
  }

  const reservedSum = linked.reduce((sum, row) => sum + (Number(row.amount_minor) || 0), 0)
  if (reservedSum !== amountMinor) {
    console.error("payout reserved sum mismatch", payoutId)
    return {
      ok: false,
      status: payout.status,
      provider_transfer_id: null,
      message: "",
      error: "Payout amount does not match reserved earnings.",
    }
  }

  const { data: account } = await admin
    .from("tutor_payout_accounts")
    .select("id, status, provider_account_id, verification_metadata")
    .eq("id", payout.payout_account_id)
    .eq("tutor_id", tutorId)
    .maybeSingle()

  const eligible = isLinkedAccountEligible(account)
  if (!eligible.ok) {
    return { ok: false, status: payout.status, provider_transfer_id: null, message: "", error: eligible.error }
  }

  const created = await createDirectTransfer({
    linkedAccountId: eligible.accountId,
    amountMinor,
    currency: payout.currency || "INR",
    payoutId: payout.id,
    tutorId,
  })

  if (!created.ok) {
    await admin
      .from("tutor_payouts")
      .update({
        status: "failed",
        failure_reason: created.error.slice(0, 240),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payout.id)
      .neq("status", "paid")

    await admin
      .from("tutor_earnings")
      .update({
        payout_id: null,
        payout_status: "available",
        updated_at: new Date().toISOString(),
      })
      .eq("payout_id", payout.id)
      .neq("payout_status", "paid")

    return {
      ok: false,
      status: "failed",
      provider_transfer_id: null,
      message: "",
      error: created.error,
    }
  }

  // Persist transfer id immediately before reconcile to prevent duplicate creates on retry.
  await admin
    .from("tutor_payouts")
    .update({
      status: "processing",
      provider_transfer_id: created.transfer.id,
      provider_payout_id: mapTransferStatus(created.transfer.status),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payout.id)

  const reconciled = await reconcilePayoutWithTransfer(
    admin,
    { ...(payout as TutorPayoutRow), provider_transfer_id: created.transfer.id || null },
    created.transfer,
  )

  return {
    ok: reconciled.status !== "failed",
    status: reconciled.status,
    provider_transfer_id: created.transfer.id || null,
    message:
      reconciled.status === "paid"
        ? "Payout transferred successfully to your Razorpay Linked Account."
        : reconciled.status === "failed"
        ? "Transfer failed. Available balance has been restored for retry."
        : "Payout submitted to Razorpay. Status will update when the transfer is processed.",
    error: reconciled.status === "failed" ? "Transfer failed. You can request payout again once available." : undefined,
  }
}
