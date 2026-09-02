import type { SupabaseClient } from "npm:@supabase/supabase-js@2"

export interface MarketplacePaymentRefundRow {
  id: string
  booking_id: string | null
  amount_minor: number
  refund_amount_minor: number
  status: string
  tutor_earning_minor: number
  platform_fee_minor: number
}

export async function applyMarketplaceRefundToEarnings(
  admin: SupabaseClient,
  payment: MarketplacePaymentRefundRow,
  refundAmountMinor: number,
  fullyRefunded: boolean,
): Promise<void> {
  const { data: earning } = await admin
    .from("tutor_earnings")
    .select("id, net_minor, gross_minor, payout_status, payout_id")
    .eq("marketplace_payment_id", payment.id)
    .maybeSingle()

  if (!earning) return

  const netMinor = Number(earning.net_minor) || 0
  const grossMinor = Number(earning.gross_minor) || payment.amount_minor
  const refundAdjustment = Math.min(netMinor, Math.max(0, refundAmountMinor))
  const activePayout = earning.payout_id as string | null

  if (activePayout) {
    const { data: payout } = await admin
      .from("tutor_payouts")
      .select("id, status")
      .eq("id", activePayout)
      .maybeSingle()

    if (payout && !["paid", "cancelled", "rejected", "failed"].includes(String(payout.status))) {
      await admin
        .from("tutor_payouts")
        .update({
          status: "cancelled",
          failure_reason: fullyRefunded ? "Cancelled due to refund" : "Cancelled due to partial refund",
          updated_at: new Date().toISOString(),
        })
        .eq("id", activePayout)

      await admin
        .from("tutor_earnings")
        .update({ payout_id: null, updated_at: new Date().toISOString() })
        .eq("payout_id", activePayout)
    }
  }

  const nextStatus = fullyRefunded || refundAdjustment >= netMinor
    ? "cancelled"
    : "held"

  await admin
    .from("tutor_earnings")
    .update({
      payout_status: nextStatus,
      refund_adjustment_minor: refundAdjustment,
      payout_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", earning.id)

  if (fullyRefunded && payment.booking_id) {
    await admin
      .from("bookings")
      .update({ payment_status: "refunded" })
      .eq("id", payment.booking_id)
      .neq("payment_status", "refunded")
  }

  void grossMinor
}
