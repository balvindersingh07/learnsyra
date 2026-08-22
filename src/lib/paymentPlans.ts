import type { PlanId } from './supabase'

/** Active provider for India launch. Stripe remains available as legacy/deferred. */
export type PaymentProvider = 'razorpay' | 'stripe'

export const ACTIVE_PAYMENT_PROVIDER: PaymentProvider = 'razorpay'

export interface PaidPlanDisplay {
  planId: Extract<PlanId, 'student_pro' | 'career_pro'>
  name: string
  amountInr: number
  currency: 'INR'
  period: 'month'
}

export const INDIA_PAID_PLANS: Record<PaidPlanDisplay['planId'], PaidPlanDisplay> = {
  student_pro: {
    planId: 'student_pro',
    name: 'Student Pro',
    amountInr: 399,
    currency: 'INR',
    period: 'month',
  },
  career_pro: {
    planId: 'career_pro',
    name: 'Career Pro',
    amountInr: 799,
    currency: 'INR',
    period: 'month',
  },
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
