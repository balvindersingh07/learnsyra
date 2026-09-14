import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import {
  getRazorpayRouteCredentials,
  isRazorpayRouteEnabled,
  mapActivationStatus,
  maskBankAccount,
  payoutStatusFromActivation,
  razorpayRouteRequest,
  safeRequirements,
  sanitizeBankAccountNumber,
  sanitizeIfsc,
  sanitizeIndianPhone,
  sanitizePan,
  sanitizePostalCode,
  type RouteOnboardingMeta,
  type SafeRequirement,
} from "../_shared/razorpayRoute.ts"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface OnboardBody {
  contact_name?: string
  phone?: string
  email?: string
  street?: string
  city?: string
  state?: string
  postal_code?: string
  pan?: string
  account_number?: string
  ifsc?: string
  beneficiary_name?: string
  tnc_accepted?: boolean
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    if (!isRazorpayRouteEnabled()) {
      return Response.json({
        error: "Razorpay Route onboarding is not enabled yet.",
        code: "route_disabled",
      }, { status: 503, headers: cors })
    }

    const creds = getRazorpayRouteCredentials()
    if (!creds) {
      return Response.json({
        error: "Payout onboarding is temporarily unavailable.",
        code: "razorpay_not_configured",
      }, { status: 503, headers: cors })
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return Response.json({ error: "Not logged in" }, { status: 401, headers: cors })
    }

    const tutorId = userData.user.id
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", tutorId)
      .maybeSingle()

    if (!profile || profile.role !== "tutor") {
      return Response.json({ error: "Only tutors can onboard payout accounts" }, { status: 403, headers: cors })
    }

    const body = (await req.json()) as OnboardBody
    if (body.tnc_accepted !== true) {
      return Response.json({ error: "Please accept Razorpay Route terms to continue." }, { status: 400, headers: cors })
    }

    const contactName = (body.contact_name || profile.full_name || "").trim().slice(0, 120)
    const beneficiaryName = (body.beneficiary_name || contactName).trim().slice(0, 120)
    const email = (body.email || userData.user.email || "").trim().toLowerCase()
    const phone = sanitizeIndianPhone(body.phone || "")
    const street = (body.street || "").trim().slice(0, 255)
    const city = (body.city || "").trim().slice(0, 64)
    const state = (body.state || "").trim().slice(0, 64)
    const postalCode = sanitizePostalCode(body.postal_code || "")
    const pan = sanitizePan(body.pan || "")
    const accountNumber = sanitizeBankAccountNumber(body.account_number || "")
    const ifsc = sanitizeIfsc(body.ifsc || "")

    if (!contactName || contactName.length < 2) {
      return Response.json({ error: "Enter your full legal name" }, { status: 400, headers: cors })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "A valid email is required" }, { status: 400, headers: cors })
    }
    if (!phone) {
      return Response.json({ error: "Enter a valid 10-digit Indian mobile number" }, { status: 400, headers: cors })
    }
    if (street.length < 10) {
      return Response.json({ error: "Enter a complete street address (at least 10 characters)" }, { status: 400, headers: cors })
    }
    if (city.length < 2) {
      return Response.json({ error: "Enter your city" }, { status: 400, headers: cors })
    }
    if (state.length < 2) {
      return Response.json({ error: "Enter your state" }, { status: 400, headers: cors })
    }
    if (!postalCode) {
      return Response.json({ error: "Enter a valid 6-digit PIN code" }, { status: 400, headers: cors })
    }
    if (!pan) {
      return Response.json({ error: "Enter a valid individual PAN (4th character must be P)" }, { status: 400, headers: cors })
    }
    if (!accountNumber) {
      return Response.json({ error: "Enter a valid bank account number" }, { status: 400, headers: cors })
    }
    if (!ifsc) {
      return Response.json({ error: "Enter a valid IFSC code" }, { status: 400, headers: cors })
    }
    if (!beneficiaryName || beneficiaryName.length < 2) {
      return Response.json({ error: "Enter the bank beneficiary name" }, { status: 400, headers: cors })
    }

    const { data: existing } = await admin
      .from("tutor_payout_accounts")
      .select("id, tutor_id, status, provider_account_id, verification_metadata, masked_account, account_holder_name")
      .eq("tutor_id", tutorId)
      .in("status", ["pending", "verified", "failed"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing && existing.tutor_id !== tutorId) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: cors })
    }

    if (existing?.status === "verified" && existing.provider_account_id) {
      const meta = asMeta(existing.verification_metadata)
      return Response.json({
        ok: true,
        already_verified: true,
        account: publicAccount(existing),
        onboarding: {
          phase: "activated",
          activation_status: meta.activation_status || "activated",
          provider_account_id: existing.provider_account_id,
          product_id: meta.product_id || null,
          requirements: meta.requirements || [],
        },
        message: "Your Razorpay Route account is already active.",
      }, { headers: cors })
    }

    const now = new Date().toISOString()
    const existingMeta = asMeta(existing?.verification_metadata)
    let accountId = typeof existing?.provider_account_id === "string" && existing.provider_account_id.startsWith("acc_")
      ? existing.provider_account_id
      : null
    let stakeholderId = typeof existingMeta.stakeholder_id === "string" ? existingMeta.stakeholder_id : null
    let productId = typeof existingMeta.product_id === "string" ? existingMeta.product_id : null
    let activationStatus: string | null = existingMeta.activation_status || null
    let accountStatus: string | null = existingMeta.account_status || null
    let requirements: SafeRequirement[] = existingMeta.requirements || []

    // 1) Create or reuse Linked Account
    if (!accountId) {
      const createAccount = await razorpayRouteRequest<{ id?: string; status?: string }>(
        creds.keyId,
        creds.keySecret,
        "POST",
        "/v2/accounts",
        {
          email,
          phone,
          type: "route",
          reference_id: tutorId,
          legal_business_name: contactName,
          business_type: "individual",
          contact_name: contactName,
          profile: {
            category: "education",
            subcategory: "coaching",
            addresses: {
              registered: {
                street1: street,
                street2: ".",
                city,
                state,
                postal_code: postalCode,
                country: "IN",
              },
            },
          },
        },
      )

      if (!createAccount.ok || !createAccount.data?.id) {
        console.error("route linked account create failed", createAccount.status, createAccount.errorMessage)
        return await failAndRespond(admin, existing?.id ?? null, tutorId, {
          contactName,
          masked: maskBankAccount(accountNumber),
          now,
          accountId: null,
          stakeholderId: null,
          productId: null,
          accountStatus: null,
          activationStatus: "failed",
          requirements: [],
          lastError: createAccount.errorMessage || "Could not create Linked Account",
          referenceId: tutorId,
        }, createAccount.errorMessage || "Could not create Razorpay Linked Account")
      }

      accountId = createAccount.data.id
      accountStatus = createAccount.data.status || "created"
    } else {
      const fetched = await razorpayRouteRequest<{ id?: string; status?: string }>(
        creds.keyId,
        creds.keySecret,
        "GET",
        `/v2/accounts/${accountId}`,
      )
      if (fetched.ok && fetched.data) {
        accountStatus = fetched.data.status || accountStatus
      }
    }

    // 2) Stakeholder (Route allows only one)
    if (!stakeholderId) {
      const listed = await razorpayRouteRequest<{ items?: Array<{ id?: string }> } | Array<{ id?: string }>>(
        creds.keyId,
        creds.keySecret,
        "GET",
        `/v2/accounts/${accountId}/stakeholders`,
      )
      const items = Array.isArray(listed.data)
        ? listed.data
        : Array.isArray((listed.data as { items?: Array<{ id?: string }> } | null)?.items)
        ? (listed.data as { items: Array<{ id?: string }> }).items
        : []
      const existingStakeholderId = items.find(s => typeof s.id === "string")?.id || null

      if (existingStakeholderId) {
        stakeholderId = existingStakeholderId
      } else {
        const createStakeholder = await razorpayRouteRequest<{ id?: string }>(
          creds.keyId,
          creds.keySecret,
          "POST",
          `/v2/accounts/${accountId}/stakeholders`,
          {
            name: contactName,
            email,
            addresses: {
              residential: {
                street,
                city,
                state,
                postal_code: postalCode,
                country: "IN",
              },
            },
            kyc: { pan },
            notes: { tutor_id: tutorId },
          },
        )

        if (!createStakeholder.ok || !createStakeholder.data?.id) {
          console.error("route stakeholder create failed", createStakeholder.status, createStakeholder.errorMessage)
          return await failAndRespond(admin, existing?.id ?? null, tutorId, {
            contactName,
            masked: maskBankAccount(accountNumber),
            now,
            accountId,
            stakeholderId: null,
            productId,
            accountStatus,
            activationStatus: "needs_clarification",
            requirements: [],
            lastError: createStakeholder.errorMessage || "Could not create stakeholder",
            referenceId: tutorId,
          }, createStakeholder.errorMessage || "Could not complete stakeholder KYC step")
        }
        stakeholderId = createStakeholder.data.id
      }
    }

    // 3) Request Route product configuration (idempotent: reuse stored product_id)
    if (!productId) {
      const requestProduct = await razorpayRouteRequest<{
        id?: string
        activation_status?: string
        requirements?: unknown
      }>(
        creds.keyId,
        creds.keySecret,
        "POST",
        `/v2/accounts/${accountId}/products`,
        {
          product_name: "route",
          tnc_accepted: true,
        },
      )

      if (!requestProduct.ok || !requestProduct.data?.id) {
        console.error("route product request failed", requestProduct.status, requestProduct.errorMessage)
        return await failAndRespond(admin, existing?.id ?? null, tutorId, {
          contactName,
          masked: maskBankAccount(accountNumber),
          now,
          accountId,
          stakeholderId,
          productId: null,
          accountStatus,
          activationStatus: "failed",
          requirements: [],
          lastError: requestProduct.errorMessage || "Could not request Route product",
          referenceId: tutorId,
        }, requestProduct.errorMessage || "Could not request Razorpay Route product configuration")
      }

      productId = requestProduct.data.id
      activationStatus = requestProduct.data.activation_status || activationStatus
      requirements = safeRequirements(requestProduct.data.requirements)
    }

    // 4) Update product configuration with bank settlement details
    const updateProduct = await razorpayRouteRequest<{
      id?: string
      activation_status?: string
      requirements?: unknown
    }>(
      creds.keyId,
      creds.keySecret,
      "PATCH",
      `/v2/accounts/${accountId}/products/${productId}`,
      {
        settlements: {
          account_number: accountNumber,
          ifsc_code: ifsc,
          beneficiary_name: beneficiaryName,
        },
        tnc_accepted: true,
      },
    )

    if (!updateProduct.ok) {
      console.error("route product update failed", updateProduct.status, updateProduct.errorMessage)
      return await failAndRespond(admin, existing?.id ?? null, tutorId, {
        contactName,
        masked: maskBankAccount(accountNumber),
        now,
        accountId,
        stakeholderId,
        productId,
        accountStatus,
        activationStatus: "needs_clarification",
        requirements,
        lastError: updateProduct.errorMessage || "Could not update settlement details",
        referenceId: tutorId,
      }, updateProduct.errorMessage || "Could not submit bank details to Razorpay")
    }

    activationStatus = updateProduct.data?.activation_status || activationStatus || "needs_clarification"
    requirements = safeRequirements(updateProduct.data?.requirements)
    const phase = mapActivationStatus(activationStatus)
    const payoutStatus = payoutStatusFromActivation(phase)

    const meta: RouteOnboardingMeta = {
      route_enabled: true,
      onboarding_phase: phase,
      provider_account_id: accountId,
      product_id: productId,
      stakeholder_id: stakeholderId,
      account_status: accountStatus,
      activation_status: activationStatus,
      requirements,
      last_error: null,
      submitted_at: existingMeta.submitted_at || now,
      last_synced_at: now,
      reference_id: tutorId,
    }

    const row = {
      tutor_id: tutorId,
      provider: "razorpay",
      provider_account_id: accountId,
      account_type: "bank" as const,
      masked_account: maskBankAccount(accountNumber),
      account_holder_name: beneficiaryName,
      status: payoutStatus,
      verification_metadata: meta,
      updated_at: now,
    }

    let saved: Record<string, unknown> | null = null
    if (existing?.id) {
      const { data, error } = await admin
        .from("tutor_payout_accounts")
        .update(row)
        .eq("id", existing.id)
        .eq("tutor_id", tutorId)
        .select("id, status, account_type, masked_account, account_holder_name, provider_account_id, verification_metadata, created_at, updated_at")
        .single()
      if (error) {
        console.error("payout account update failed", error.code)
        return Response.json({ error: "Could not save onboarding status" }, { status: 500, headers: cors })
      }
      saved = data
    } else {
      const { data, error } = await admin
        .from("tutor_payout_accounts")
        .insert(row)
        .select("id, status, account_type, masked_account, account_holder_name, provider_account_id, verification_metadata, created_at, updated_at")
        .single()
      if (error) {
        console.error("payout account insert failed", error.code)
        return Response.json({ error: "Could not save onboarding status" }, { status: 500, headers: cors })
      }
      saved = data
    }

    return Response.json({
      ok: true,
      account: publicAccount(saved),
      onboarding: {
        phase,
        activation_status: activationStatus,
        provider_account_id: accountId,
        product_id: productId,
        requirements,
      },
      message: phase === "activated"
        ? "Razorpay Route account is active. Withdrawals unlock once transfers are enabled."
        : phase === "needs_clarification"
        ? "Onboarding submitted. Razorpay needs additional clarification before activation."
        : "Onboarding submitted to Razorpay Route. Activation is pending review.",
    }, { headers: cors })
  } catch (e) {
    console.error("onboard-tutor-route-account error", e instanceof Error ? e.message : "unknown")
    return Response.json({ error: "Could not complete payout onboarding" }, { status: 500, headers: cors })
  }
})

function asMeta(raw: unknown): RouteOnboardingMeta {
  if (!raw || typeof raw !== "object") {
    return { route_enabled: true, onboarding_phase: "unknown" }
  }
  const m = raw as Record<string, unknown>
  return {
    route_enabled: Boolean(m.route_enabled),
    onboarding_phase: mapActivationStatus(typeof m.onboarding_phase === "string" ? m.onboarding_phase : typeof m.activation_status === "string" ? m.activation_status : null),
    provider_account_id: typeof m.provider_account_id === "string" ? m.provider_account_id : undefined,
    product_id: typeof m.product_id === "string" ? m.product_id : null,
    stakeholder_id: typeof m.stakeholder_id === "string" ? m.stakeholder_id : null,
    account_status: typeof m.account_status === "string" ? m.account_status : null,
    activation_status: typeof m.activation_status === "string" ? m.activation_status : null,
    requirements: safeRequirements(m.requirements),
    last_error: typeof m.last_error === "string" ? m.last_error : null,
    submitted_at: typeof m.submitted_at === "string" ? m.submitted_at : undefined,
    last_synced_at: typeof m.last_synced_at === "string" ? m.last_synced_at : undefined,
    reference_id: typeof m.reference_id === "string" ? m.reference_id : undefined,
  }
}

function publicAccount(row: Record<string, unknown> | null) {
  if (!row) return null
  return {
    id: row.id,
    status: row.status,
    account_type: row.account_type,
    masked_account: row.masked_account,
    account_holder_name: row.account_holder_name,
    provider_account_id: row.provider_account_id ?? null,
    verification_metadata: row.verification_metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function failAndRespond(
  admin: ReturnType<typeof createClient>,
  existingId: string | null,
  tutorId: string,
  ctx: {
    contactName: string
    masked: string
    now: string
    accountId: string | null
    stakeholderId: string | null
    productId: string | null
    accountStatus: string | null
    activationStatus: string
    requirements: SafeRequirement[]
    lastError: string
    referenceId: string
  },
  clientError: string,
) {
  const phase = mapActivationStatus(ctx.activationStatus)
  const payoutStatus = payoutStatusFromActivation(phase === "unknown" ? "failed" : phase)
  const meta: RouteOnboardingMeta = {
    route_enabled: true,
    onboarding_phase: phase === "unknown" ? "failed" : phase,
    provider_account_id: ctx.accountId || undefined,
    product_id: ctx.productId,
    stakeholder_id: ctx.stakeholderId,
    account_status: ctx.accountStatus,
    activation_status: ctx.activationStatus,
    requirements: ctx.requirements,
    last_error: ctx.lastError.slice(0, 240),
    submitted_at: ctx.now,
    last_synced_at: ctx.now,
    reference_id: ctx.referenceId,
  }

  const row = {
    tutor_id: tutorId,
    provider: "razorpay",
    provider_account_id: ctx.accountId,
    account_type: "bank" as const,
    masked_account: ctx.masked,
    account_holder_name: ctx.contactName,
    status: payoutStatus === "verified" ? "pending" : payoutStatus,
    verification_metadata: meta,
    updated_at: ctx.now,
  }

  let saved: Record<string, unknown> | null = null
  if (existingId) {
    const { data } = await admin
      .from("tutor_payout_accounts")
      .update(row)
      .eq("id", existingId)
      .eq("tutor_id", tutorId)
      .select("id, status, account_type, masked_account, account_holder_name, provider_account_id, verification_metadata, created_at, updated_at")
      .maybeSingle()
    saved = data
  } else if (ctx.accountId) {
    const { data } = await admin
      .from("tutor_payout_accounts")
      .insert(row)
      .select("id, status, account_type, masked_account, account_holder_name, provider_account_id, verification_metadata, created_at, updated_at")
      .maybeSingle()
    saved = data
  }

  return Response.json({
    ok: false,
    error: clientError,
    account: publicAccount(saved),
    onboarding: {
      phase: meta.onboarding_phase,
      activation_status: ctx.activationStatus,
      provider_account_id: ctx.accountId,
      product_id: ctx.productId,
      requirements: ctx.requirements,
    },
  }, { status: 400, headers: cors })
}
