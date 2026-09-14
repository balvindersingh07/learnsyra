import { razorpayBasicAuth } from "./razorpay.ts"

export type RouteActivationStatus =
  | "submitted"
  | "needs_clarification"
  | "under_review"
  | "activated"
  | "failed"
  | "unknown"

export interface SafeRequirement {
  field_reference: string
  reason_code: string
  status: string
}

export interface RouteOnboardingMeta {
  route_enabled: boolean
  onboarding_phase: RouteActivationStatus
  provider_account_id?: string
  product_id?: string | null
  stakeholder_id?: string | null
  account_status?: string | null
  activation_status?: string | null
  requirements?: SafeRequirement[]
  last_error?: string | null
  submitted_at?: string
  last_synced_at?: string
  reference_id?: string
}

export function isRazorpayRouteEnabled(): boolean {
  const raw = Deno.env.get("RAZORPAY_ROUTE_ENABLED")?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on"
}

export function getRazorpayRouteCredentials(): { keyId: string; keySecret: string } | null {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim()
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim()
  if (!keyId || !keySecret) return null
  return { keyId, keySecret }
}

export function maskBankAccount(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "")
  if (digits.length < 4) return "****"
  return `****${digits.slice(-4)}`
}

export function sanitizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  const ten = digits.length === 12 && digits.startsWith("91")
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0")
    ? digits.slice(1)
    : digits
  if (!/^[6-9]\d{9}$/.test(ten)) return null
  return ten
}

export function sanitizePan(raw: string): string | null {
  const pan = raw.trim().toUpperCase()
  // Stakeholder PAN: 4th character must be P (individual).
  if (!/^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(pan)) return null
  return pan
}

export function sanitizeIfsc(raw: string): string | null {
  const ifsc = raw.trim().toUpperCase()
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return null
  return ifsc
}

export function sanitizeBankAccountNumber(raw: string): string | null {
  const digits = raw.replace(/\s+/g, "").replace(/\D/g, "")
  if (digits.length < 5 || digits.length > 35) return null
  return digits
}

export function sanitizePostalCode(raw: string): string | null {
  const code = raw.trim()
  if (!/^\d{6}$/.test(code)) return null
  return code
}

export function mapActivationStatus(raw: string | null | undefined): RouteActivationStatus {
  const value = (raw || "").trim().toLowerCase()
  if (!value) return "submitted"
  if (value === "activated" || value === "active") return "activated"
  if (value === "needs_clarification") return "needs_clarification"
  if (
    value === "under_review" ||
    value === "pending" ||
    value === "requested" ||
    value === "in_review" ||
    value === "processing"
  ) {
    return "under_review"
  }
  if (value === "rejected" || value === "failed" || value === "suspended") return "failed"
  return "unknown"
}

export function payoutStatusFromActivation(phase: RouteActivationStatus): "pending" | "verified" | "failed" {
  if (phase === "activated") return "verified"
  if (phase === "failed") return "failed"
  return "pending"
}

export function safeRequirements(raw: unknown): SafeRequirement[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(item => {
      if (!item || typeof item !== "object") return null
      const row = item as Record<string, unknown>
      const field = typeof row.field_reference === "string" ? row.field_reference : ""
      const reason = typeof row.reason_code === "string" ? row.reason_code : ""
      const status = typeof row.status === "string" ? row.status : ""
      if (!field) return null
      return { field_reference: field, reason_code: reason, status }
    })
    .filter((x): x is SafeRequirement => Boolean(x))
}

/** Strip secrets from Razorpay error bodies before logging or returning. */
export function sanitizeRazorpayError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Razorpay request failed"
  const err = (payload as { error?: { description?: string; code?: string; reason?: string } }).error
  const description = err?.description || err?.reason || err?.code
  if (typeof description === "string" && description.trim()) {
    return description.trim().slice(0, 240)
  }
  return "Razorpay request failed"
}

export async function razorpayRouteRequest<T = Record<string, unknown>>(
  keyId: string,
  keySecret: string,
  method: string,
  path: string,
  body?: Record<string, unknown> | null,
): Promise<{ ok: boolean; status: number; data: T | null; errorMessage: string | null }> {
  const res = await fetch(`https://api.razorpay.com${path}`, {
    method,
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: null,
      errorMessage: sanitizeRazorpayError(parsed) || `Razorpay HTTP ${res.status}`,
    }
  }

  return {
    ok: true,
    status: res.status,
    data: (parsed as T) ?? null,
    errorMessage: null,
  }
}
