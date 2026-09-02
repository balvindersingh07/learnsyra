export type EmailEventType =
  | "booking_status"
  | "booking_confirmed"
  | "project_review"
  | "moderation"
  | "payout"
  | "account"

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}

export interface EmailSendResult {
  ok: boolean
  skipped?: boolean
  provider?: string
  error?: string
}

function appBaseUrl() {
  return (Deno.env.get("APP_BASE_URL") ?? "https://learnsyra.com").replace(/\/$/, "")
}

function absoluteHref(href: string | null | undefined) {
  if (!href?.trim()) return appBaseUrl()
  if (href.startsWith("http://") || href.startsWith("https://")) return href
  return `${appBaseUrl()}${href.startsWith("/") ? href : `/${href}`}`
}

function wrapTemplate(title: string, body: string, href: string | null | undefined) {
  const link = absoluteHref(href)
  const text = `${title}\n\n${body}\n\nOpen LearnSyra: ${link}\n\n— LearnSyra`
  const html = `<!DOCTYPE html>
<html><body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#172033;max-width:560px;margin:0 auto;padding:24px;">
  <div style="font-weight:800;font-size:20px;margin-bottom:8px;">LearnSyra</div>
  <h1 style="font-size:18px;margin:0 0 12px;">${escapeHtml(title)}</h1>
  <p style="margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(body)}</p>
  <p style="margin:0 0 24px;"><a href="${escapeAttr(link)}" style="color:#6C5CE7;font-weight:600;">Open in LearnSyra</a></p>
  <p style="font-size:12px;color:#64748b;margin:0;">You received this email because of activity on your LearnSyra account.</p>
</body></html>`
  return { html, text }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function escapeAttr(value: string) {
  return escapeHtml(value).replaceAll("'", "&#39;")
}

export function buildNotificationEmail(input: {
  eventType: EmailEventType
  title: string
  body: string
  href?: string | null
  recipientName?: string | null
}): Omit<EmailPayload, "to" | "idempotencyKey"> {
  const greeting = input.recipientName?.trim() ? `Hi ${input.recipientName.trim()},` : "Hi,"
  const detail = input.body.trim() || "Sign in to LearnSyra for details."
  const subjectPrefix =
    input.eventType === "booking_confirmed" ? "Booking confirmed"
    : input.eventType === "booking_status" ? "Booking update"
    : input.eventType === "project_review" ? "Project review"
    : input.eventType === "moderation" ? "Account update"
    : input.eventType === "payout" ? "Payout update"
    : input.eventType === "account" ? "Account update"
    : "LearnSyra notification"
  const subject = `${subjectPrefix} — ${input.title}`
  const body = `${greeting}\n\n${detail}`
  const wrapped = wrapTemplate(input.title, body, input.href)
  return { subject, html: wrapped.html, text: wrapped.text }
}

export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim()
  const from = Deno.env.get("EMAIL_FROM")?.trim()
  const enabled = Deno.env.get("NOTIFICATIONS_EMAIL_ENABLED") !== "false"

  if (!enabled || !apiKey || !from) {
    console.info("notification email skipped: provider not configured")
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": payload.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    })

    if (!res.ok) {
      console.error("resend send failed", res.status)
      return { ok: false, error: "email_provider_failed" }
    }

    return { ok: true, provider: "resend" }
  } catch (e) {
    console.error("resend send error", e instanceof Error ? e.message : "unknown")
    return { ok: false, error: "email_provider_failed" }
  }
}
