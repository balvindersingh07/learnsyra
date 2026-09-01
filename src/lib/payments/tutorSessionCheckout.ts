import { supabase } from '../supabase'

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

export interface TutorSessionCheckoutInput {
  tutorListingId: string
  offerKey: string
  scheduledAt: string
  message: string
  idempotencyKey?: string
}

export interface TutorSessionCheckoutResult {
  error: string | null
  cancelled?: boolean
  verified?: boolean
  bookingId?: string
  orderId?: string
  amountMinor?: number
  currency?: string
}

interface OrderResponse {
  keyId: string
  orderId: string
  amount: number
  currency: string
  bookingId: string
  marketplacePaymentId: string
}

export async function startTutorSessionCheckout(
  input: TutorSessionCheckoutInput,
): Promise<TutorSessionCheckoutResult> {
  const { data, error } = await supabase.functions.invoke('create-tutor-session-order', {
    body: {
      tutor_listing_id: input.tutorListingId,
      offer_key: input.offerKey,
      scheduled_at: input.scheduledAt,
      message: input.message,
      idempotency_key: input.idempotencyKey,
    },
  })

  const message = invokeError(data, error)
  if (message) {
    return { error: /payments unavailable/i.test(message) ? 'Payments unavailable. Coming soon.' : message }
  }

  const session = data as OrderResponse | null
  if (!session?.keyId || !session.orderId || !session.bookingId) {
    return { error: 'Could not start payment. Try again.' }
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
    const finish = (result: TutorSessionCheckoutResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const rzp = new window.Razorpay!({
      key: session.keyId,
      order_id: session.orderId,
      amount: session.amount,
      currency: session.currency,
      name: 'LearnSyra',
      description: 'Tutor session booking',
      handler: async (response: {
        razorpay_order_id: string
        razorpay_payment_id: string
        razorpay_signature: string
      }) => {
        const { data: verified, error: verifyErr } = await supabase.functions.invoke('verify-tutor-session-payment', {
          body: {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            booking_id: session.bookingId,
          },
        })
        const verifyMessage = invokeError(verified, verifyErr)
        if (verifyMessage) {
          finish({ error: verifyMessage, bookingId: session.bookingId })
          return
        }
        finish({
          error: null,
          verified: true,
          bookingId: session.bookingId,
          orderId: session.orderId,
          amountMinor: session.amount,
          currency: session.currency,
        })
      },
      modal: {
        ondismiss: () => finish({ error: null, cancelled: true, bookingId: session.bookingId }),
      },
    })

    rzp.on('payment.failed', () => {
      finish({ error: 'Payment failed. Your session was not booked.', bookingId: session.bookingId })
    })

    rzp.open()
  })
}
