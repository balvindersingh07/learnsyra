import { supabase } from '../supabase'
import type { PlanId } from '../supabase'

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void
      on: (event: string, handler: () => void) => void
    }
  }
}

let scriptPromise: Promise<void> | null = null

function invokeError(data: unknown, error: { message: string } | null): string | null {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: unknown }).error
    if (typeof message === 'string' && message.trim()) return message
  }
  return error?.message ?? null
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Could not load payment gateway')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load payment gateway'))
    document.body.appendChild(script)
  })
  return scriptPromise
}

interface SubscriptionResponse {
  keyId: string
  subscriptionId: string
  planId: string
  planName: string
  prefill?: { email?: string; name?: string }
}

export async function startRazorpayCheckout(
  planId: PlanId,
): Promise<{ error: string | null; unavailable?: boolean; pending?: boolean; verified?: boolean }> {
  if (planId === 'free') return { error: null }

  const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
    body: { planId },
  })
  const message = invokeError(data, error)
  if (message) {
    const unavailable = /payments unavailable/i.test(message)
    return {
      error: unavailable ? 'Payments unavailable / Coming soon.' : message,
      unavailable,
    }
  }

  const session = data as SubscriptionResponse | null
  if (!session?.keyId || !session.subscriptionId) {
    return { error: 'Could not start subscription. Try again.' }
  }

  try {
    await loadRazorpayScript()
  } catch {
    return { error: 'Could not load payment gateway. Try again.' }
  }

  if (!window.Razorpay) {
    return { error: 'Could not load payment gateway. Try again.' }
  }

  return new Promise(resolve => {
    let settled = false
    const finish = (result: { error: string | null; unavailable?: boolean; pending?: boolean; verified?: boolean }) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const rzp = new window.Razorpay!({
      key: session.keyId,
      subscription_id: session.subscriptionId,
      name: 'LearnSyra',
      description: `${session.planName} — monthly subscription`,
      prefill: {
        email: session.prefill?.email ?? '',
        name: session.prefill?.name ?? '',
      },
      theme: { color: '#6C5CE7' },
      handler: async (response: {
        razorpay_subscription_id: string
        razorpay_payment_id: string
        razorpay_signature: string
      }) => {
        const { data: verified, error: verifyErr } = await supabase.functions.invoke('verify-razorpay-payment', {
          body: {
            subscriptionId: response.razorpay_subscription_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          },
        })
        const verifyMessage = invokeError(verified, verifyErr)
        if (verifyMessage) {
          finish({ error: verifyMessage, pending: true })
          return
        }
        const payload = verified as { ok?: boolean; pending?: boolean } | null
        if (payload?.pending) {
          finish({ error: null, pending: true })
          return
        }
        finish({ error: null, verified: true })
      },
      modal: {
        ondismiss: () => finish({ error: null, pending: false }),
      },
    })

    rzp.on('payment.failed', () => {
      finish({ error: 'Payment failed. Try again or use another method.' })
    })

    rzp.open()
  })
}
