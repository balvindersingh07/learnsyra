import { supabase } from '../supabase'
import type { PlanId } from '../supabase'
import { ACTIVE_PAYMENT_PROVIDER } from '../paymentPlans'
import { startStripeCheckout } from './stripeLegacy'
import { startRazorpayCheckout } from './razorpayCheckout'

export type CheckoutResult =
  | { error: string | null; unavailable?: boolean; pending?: boolean; verified?: boolean }
  | { error: null; url: string }

/** Active checkout entry point. India uses Razorpay; Stripe remains legacy/deferred. */
export async function startPlanCheckout(planId: PlanId): Promise<CheckoutResult> {
  if (planId === 'free') return { error: null }
  if (ACTIVE_PAYMENT_PROVIDER === 'razorpay') {
    return startRazorpayCheckout(planId)
  }
  return startStripeCheckout(planId)
}

/** @deprecated Use startPlanCheckout */
export const startCheckout = startPlanCheckout
