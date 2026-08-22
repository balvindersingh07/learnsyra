/**
 * Legacy Stripe checkout (worldwide — deferred).
 * Kept isolated for future re-enablement. Not used by the active India payment path.
 */
import { supabase } from '../supabase'
import type { PlanId } from '../supabase'

function invokeError(data: unknown, error: { message: string } | null): string | null {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: unknown }).error
    if (typeof message === 'string' && message.trim()) return message
  }
  return error?.message ?? null
}

/** @deprecated Use startPlanCheckout() — Stripe worldwide flow is deferred. */
export async function startStripeCheckout(
  planId: PlanId,
): Promise<{ error: string | null; url?: string; unavailable?: boolean }> {
  if (planId === 'free') return { error: null }
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { planId, origin: window.location.origin },
  })
  const message = invokeError(data, error)
  if (message) {
    const unavailable = /payments unavailable/i.test(message)
    return { error: unavailable ? 'Payments unavailable / Coming soon.' : message, unavailable }
  }
  const url = data && typeof data === 'object' ? (data as { url?: unknown }).url : null
  if (typeof url === 'string' && url) return { error: null, url }
  return { error: 'Checkout failed' }
}
