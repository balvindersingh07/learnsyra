import { isSupabaseConfigured, supabase } from './supabase'

export interface TutorPayoutSummary {
  pending_minor: number
  available_minor: number
  paid_minor: number
  held_minor: number
  cancelled_minor: number
  gross_minor: number
  platform_fee_minor: number
  net_minor: number
  minimum_payout_minor: number
}

export interface TutorPayoutAccount {
  id: string
  account_type: 'bank' | 'upi'
  masked_account: string
  account_holder_name: string | null
  status: 'pending' | 'verified' | 'failed' | 'disabled'
  provider: string
  created_at: string
  updated_at: string
}

export interface TutorPayoutRecord {
  id: string
  amount_minor: number
  currency: string
  status: string
  provider: string
  provider_payout_id: string | null
  provider_transfer_id: string | null
  requested_at: string
  processed_at: string | null
  failure_reason: string | null
}

export function minorToInr(minor: number) {
  return minor / 100
}

export function formatPayoutInr(minor: number) {
  return `₹${Math.round(minorToInr(minor)).toLocaleString('en-IN')}`
}

export function payoutStatusLabel(status: string) {
  if (status === 'requested') return 'Requested'
  if (status === 'approved') return 'Approved — awaiting provider transfer'
  if (status === 'processing') return 'Processing'
  if (status === 'paid') return 'Paid'
  if (status === 'failed') return 'Failed'
  if (status === 'rejected') return 'Rejected'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

export function payoutAccountStatusLabel(status: TutorPayoutAccount['status']) {
  if (status === 'verified') return 'Verified'
  if (status === 'pending') return 'Pending verification'
  if (status === 'failed') return 'Verification failed'
  if (status === 'disabled') return 'Disabled'
  return status
}

export async function getTutorPayoutSummary(tutorId: string): Promise<TutorPayoutSummary | null> {
  if (!isSupabaseConfigured || !tutorId) return null
  const { data, error } = await supabase.rpc('get_tutor_payout_summary', { p_tutor_id: tutorId })
  if (error || !data) return null
  const row = data as Record<string, unknown>
  return {
    pending_minor: Number(row.pending_minor) || 0,
    available_minor: Number(row.available_minor) || 0,
    paid_minor: Number(row.paid_minor) || 0,
    held_minor: Number(row.held_minor) || 0,
    cancelled_minor: Number(row.cancelled_minor) || 0,
    gross_minor: Number(row.gross_minor) || 0,
    platform_fee_minor: Number(row.platform_fee_minor) || 0,
    net_minor: Number(row.net_minor) || 0,
    minimum_payout_minor: Number(row.minimum_payout_minor) || 10000,
  }
}

export async function getTutorPayoutAccount(): Promise<TutorPayoutAccount | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('tutor_payout_accounts')
    .select('id, account_type, masked_account, account_holder_name, status, provider, created_at, updated_at')
    .in('status', ['pending', 'verified'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as TutorPayoutAccount
}

export async function getTutorPayoutHistory(limit = 50): Promise<TutorPayoutRecord[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('tutor_payouts')
    .select('id, amount_minor, currency, status, provider, provider_payout_id, provider_transfer_id, requested_at, processed_at, failure_reason')
    .order('requested_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as TutorPayoutRecord[]
}

export async function saveTutorPayoutAccount(input: {
  account_type: 'bank' | 'upi'
  masked_account: string
  account_holder_name?: string
}): Promise<{ ok: boolean; account?: TutorPayoutAccount; message?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Payout settings require Supabase to be configured.' }
  }
  const { data, error } = await supabase.functions.invoke('save-tutor-payout-account', { body: input })
  if (error) return { ok: false, error: error.message || 'Could not save payout account' }
  const payload = data as { ok?: boolean; account?: TutorPayoutAccount; message?: string; error?: string }
  if (payload.error) return { ok: false, error: payload.error }
  return { ok: true, account: payload.account, message: payload.message }
}

export async function requestTutorPayout(idempotencyKey: string): Promise<{
  ok: boolean
  payout_id?: string
  status?: string
  message?: string
  error?: string
}> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Payout requests require Supabase to be configured.' }
  }
  const { data, error } = await supabase.functions.invoke('request-tutor-payout', {
    body: { idempotency_key: idempotencyKey },
  })
  if (error) return { ok: false, error: error.message || 'Could not request payout' }
  const payload = data as {
    ok?: boolean
    payout_id?: string
    status?: string
    message?: string
    error?: string
  }
  if (payload.error) return { ok: false, error: payload.error }
  return {
    ok: true,
    payout_id: payload.payout_id,
    status: payload.status,
    message: payload.message,
  }
}

export function canRequestPayout(summary: TutorPayoutSummary | null, account: TutorPayoutAccount | null) {
  if (!summary || !account) return false
  if (account.status !== 'verified') return false
  return summary.available_minor >= summary.minimum_payout_minor
}

export function payoutRequestBlockReason(summary: TutorPayoutSummary | null, account: TutorPayoutAccount | null) {
  if (!summary) return 'Earnings summary unavailable.'
  if (!account) return 'Connect a payout account in Payout Settings first.'
  if (account.status === 'pending') {
    return 'Your payout account is pending Razorpay verification. Withdrawals unlock after verification.'
  }
  if (account.status !== 'verified') {
    return `Payout account status: ${payoutAccountStatusLabel(account.status)}.`
  }
  if (summary.available_minor <= 0) {
    return 'No earnings are available yet. Completed paid sessions become withdrawable after the session is marked completed.'
  }
  if (summary.available_minor < summary.minimum_payout_minor) {
    return `Available balance is below the minimum payout of ${formatPayoutInr(summary.minimum_payout_minor)}.`
  }
  return null
}
