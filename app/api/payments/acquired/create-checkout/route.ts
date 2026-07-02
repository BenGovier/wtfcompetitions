import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const noStore = { 'Cache-Control': 'no-store' }

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(request: Request) {
  // 1) Staging/Preview only.
  const isStaging =
    process.env.VERCEL_ENV === 'preview' ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? '').includes('staging.wtf-giveaways.co.uk')

  if (!isStaging) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: noStore })
  }

  // 2) Parse body and validate checkout ref.
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Missing or invalid checkout ref' },
      { status: 400, headers: noStore },
    )
  }

  const ref = (body.checkout_ref ?? body.ref) as string | undefined
  if (!ref || typeof ref !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Missing or invalid checkout ref' },
      { status: 400, headers: noStore },
    )
  }

  // 3) Service-role client.
  const svc = getServiceSupabase()

  // 4) Fetch the matching checkout_intents row.
  const { data: intent, error: intentErr } = await svc
    .from('checkout_intents')
    .select('id, ref, user_id, total_pence, currency, state, campaign_id, provider_customer_id')
    .eq('ref', ref)
    .single()

  if (intentErr || !intent) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, headers: noStore })
  }

  // 5) Validate the intent.
  if (intent.state !== 'pending') {
    return NextResponse.json(
      { ok: false, error: 'Intent is not pending' },
      { status: 409, headers: noStore },
    )
  }

  if (!intent.total_pence || intent.total_pence <= 0) {
    return NextResponse.json(
      { ok: false, error: 'Invalid amount' },
      { status: 422, headers: noStore },
    )
  }

  if ((intent.currency || 'GBP') !== 'GBP') {
    return NextResponse.json(
      { ok: false, error: 'Unsupported currency' },
      { status: 422, headers: noStore },
    )
  }

  if (!intent.campaign_id) {
    return NextResponse.json(
      { ok: false, error: 'Missing campaign' },
      { status: 422, headers: noStore },
    )
  }

  // 6) Env vars. Per Acquired support, Hosted Checkout payment-links must NOT
  //    specify a MID, so ACQUIRED_MID is no longer read or required.
  const appId = process.env.ACQUIRED_APP_ID
  const appKey = process.env.ACQUIRED_APP_KEY
  const companyId = process.env.ACQUIRED_COMPANY_ID

  if (!appId || !appKey || !companyId) {
    // Build a list of names only (never values/lengths). This block is only
    // reachable in staging/preview because of the early 404 guard above.
    const missing = [
      ['ACQUIRED_APP_ID', appId],
      ['ACQUIRED_APP_KEY', appKey],
      ['ACQUIRED_COMPANY_ID', companyId],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name)

    console.error('[payments/acquired] Missing Acquired configuration', { missing })
    return NextResponse.json(
      { ok: false, error: 'Server configuration error', missing },
      { status: 500, headers: noStore },
    )
  }

  // 7) Login to Acquired test API for a server-side-only access token.
  let accessToken = ''
  try {
    const loginRes = await fetch('https://test-api.acquired.com/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_key: appKey }),
    })

    if (!loginRes.ok) {
      console.error('[payments/acquired] login failed', loginRes.status)
      return NextResponse.json(
        { ok: false, error: 'acquired_login_failed', status: loginRes.status },
        { status: 502, headers: noStore },
      )
    }

    const loginData = await loginRes.json().catch(() => ({}))
    accessToken = (loginData.access_token as string) || ''
  } catch (err: any) {
    console.error('[payments/acquired] login fetch error', String(err?.message || err))
    return NextResponse.json(
      { ok: false, error: 'acquired_login_failed' },
      { status: 502, headers: noStore },
    )
  }

  if (!accessToken) {
    console.error('[payments/acquired] login returned no access token')
    return NextResponse.json(
      { ok: false, error: 'acquired_login_failed' },
      { status: 502, headers: noStore },
    )
  }

  // 7b) Resolve an Acquired customer_id (staging QA). We either reuse a
  //     previously-created customer for this user, or create a new one from the
  //     safe data we already hold. Failures to CREATE are fatal (we do not
  //     create a payment link without a customer). Failures to *enrich* the
  //     payload (auth/profile lookups) are soft — reference is the only hard
  //     requirement. No secrets, email, name, mobile, or user_id are ever
  //     returned to the client.
  let customerId = ''
  let customerSource: 'reused' | 'created' | 'none' = 'none'
  let customerPayloadKeys: string[] = []

  // A) Reuse the most recent acquired customer_id for this user, if any.
  if (intent.user_id) {
    const { data: priorIntent } = await svc
      .from('checkout_intents')
      .select('provider_customer_id')
      .eq('user_id', intent.user_id)
      .eq('provider', 'acquired')
      .not('provider_customer_id', 'is', null)
      .neq('provider_customer_id', '')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (priorIntent?.provider_customer_id) {
      customerId = priorIntent.provider_customer_id as string
      customerSource = 'reused'
    }
  }

  // B) No reusable customer → create one from safe available data.
  if (!customerId) {
    // Soft-fetch auth email + metadata (never blocks on failure).
    let email = ''
    let metaFirstName = ''
    let metaLastName = ''
    let metaDisplayName = ''
    if (intent.user_id) {
      try {
        const { data: authData } = await svc.auth.admin.getUserById(intent.user_id)
        const authUser = authData?.user
        email = (authUser?.email as string) || ''
        const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>
        metaFirstName = typeof meta.first_name === 'string' ? meta.first_name : ''
        metaLastName = typeof meta.last_name === 'string' ? meta.last_name : ''
        metaDisplayName = typeof meta.display_name === 'string' ? meta.display_name : ''
      } catch {
        // Ignore — continue with whatever we have.
      }
    }

    // Soft-fetch profile real_name (never blocks on failure).
    let realName = ''
    if (intent.user_id) {
      try {
        const { data: profile } = await svc
          .from('profiles_private')
          .select('real_name, mobile')
          .eq('user_id', intent.user_id)
          .maybeSingle()
        realName = typeof profile?.real_name === 'string' ? profile.real_name : ''
      } catch {
        // Ignore — continue with whatever we have.
      }
    }

    // Derive first/last name from the best available source, split safely.
    const nameSource = (realName || metaDisplayName).trim()
    let firstName = metaFirstName.trim()
    let lastName = metaLastName.trim()
    if ((!firstName || !lastName) && nameSource) {
      const parts = nameSource.split(/\s+/).filter(Boolean)
      if (parts.length > 0) {
        if (!firstName) firstName = parts[0]
        if (!lastName && parts.length > 1) lastName = parts.slice(1).join(' ')
      }
    }

    // Build the customer payload. `reference` is always present; everything
    // else is included only when non-empty. No address/postcode/phone is sent
    // in this first QA pass.
    const customerPayload: Record<string, unknown> = {
      reference: `wtf_user_${intent.user_id ?? intent.id}`,
    }
    if (firstName) customerPayload.first_name = firstName
    if (lastName) customerPayload.last_name = lastName
    if (email) customerPayload.billing = { email }
    customerPayloadKeys = Object.keys(customerPayload)

    try {
      const customerRes = await fetch('https://test-api.acquired.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Company-Id': companyId,
        },
        body: JSON.stringify(customerPayload),
      })

      const customerRaw = await customerRes.text().catch(() => '')

      if (!customerRes.ok) {
        let acquiredError: unknown
        try {
          acquiredError = JSON.parse(customerRaw || '')
        } catch {
          acquiredError = (customerRaw || '').slice(0, 1000)
        }
        console.error('[payments/acquired] customer creation failed', customerRes.status)
        return NextResponse.json(
          {
            ok: false,
            error: 'acquired_customer_create_failed',
            status: customerRes.status,
            acquired_error: acquiredError,
          },
          { status: 502, headers: noStore },
        )
      }

      let customerData: Record<string, any> = {}
      try {
        customerData = JSON.parse(customerRaw || '{}')
      } catch {
        customerData = {}
      }
      customerId = (customerData.customer_id as string) || ''
      customerSource = 'created'
    } catch (err: any) {
      console.error('[payments/acquired] customer fetch error', String(err?.message || err))
      return NextResponse.json(
        { ok: false, error: 'acquired_customer_create_failed' },
        { status: 502, headers: noStore },
      )
    }

    if (!customerId) {
      console.error('[payments/acquired] customer creation returned no customer_id')
      return NextResponse.json(
        { ok: false, error: 'acquired_customer_create_failed' },
        { status: 502, headers: noStore },
      )
    }

    // Persist the freshly-created customer_id on the intent immediately (in
    // addition to the later provider_session_id/status/payload update).
    await svc
      .from('checkout_intents')
      .update({
        provider_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('ref', ref)
  }

  // 7c) Tracking only: copy a previously-stored provider_card_id forward.
  //     Acquired's card_new webhook only fires the FIRST time a card is stored
  //     for a customer, so later reuse checkouts would otherwise leave
  //     provider_card_id null even though a stored card exists. We look up the
  //     latest existing provider_card_id for this user + customer and copy it
  //     onto the current row for audit/QA. This is NOT sent to Acquired (the
  //     stored card is selected via customer.customer_id at Hosted Checkout) and
  //     it never blocks checkout. If none is found we leave it null so card_new
  //     can still populate it later.
  let existingCardId = ''
  if (intent.user_id && customerId) {
    try {
      const { data: priorCard } = await svc
        .from('checkout_intents')
        .select('provider_card_id')
        .eq('user_id', intent.user_id)
        .eq('provider', 'acquired')
        .eq('provider_customer_id', customerId)
        .not('provider_card_id', 'is', null)
        .neq('provider_card_id', '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (priorCard?.provider_card_id) {
        existingCardId = priorCard.provider_card_id as string
      }
    } catch {
      // Soft-fail: tracking only, never blocks checkout.
    }
  }

  // 8) Create Acquired payment link.
  const amountDecimal = parseFloat((intent.total_pence / 100).toFixed(2))

  // Minimum Hosted Checkout request per Acquired support: Company-Id only,
  // no MID/public key/signing keys, and only the transaction object (no
  // is_recurring/tds or other optional fields). Defined as variables so the
  // staging diagnostic below can describe exactly what was sent (key names and
  // booleans only — never values).
  const linkHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Company-Id': companyId,
  }
  // Acquired will POST status updates to this URL (source of truth). The
  // redirect_url is where the customer's browser is returned after paying — it
  // points at the existing WTF success page and ALWAYS includes
  // provider=acquired so the success page can never fall back to its unverified
  // "debug" provider default. Both URLs are built from the current request
  // origin so they follow whichever staging/preview host served this request.
  // Still no template_id/MID/public key/signing key in the body.
  const origin = new URL(request.url).origin
  const webhookUrl = `${origin}/api/webhooks/acquired`
  const redirectUrl = `${origin}/checkout/success?ref=${encodeURIComponent(intent.ref)}&provider=acquired`
  // is_recurring:true instructs Acquired Hosted Checkout to store the card
  // credential against the customer (returning a card_id via the card_new
  // webhook) so it can be reused for QA. tds.is_active:true enables 3-D Secure
  // (PSD2/SCA) on the Hosted Checkout as required by Acquired QA. Still no MID
  // header / public key / signing key / template_id / payment_methods /
  // address / postcode / phone in the body.
  const linkPayload = {
    transaction: {
      order_id: intent.ref,
      amount: amountDecimal,
      currency: 'GBP',
    },
    customer: {
      customer_id: customerId,
    },
    tds: {
      is_active: true,
      challenge_preference: 'no_preference',
    },
    is_recurring: true,
    webhook_url: webhookUrl,
    redirect_url: redirectUrl,
  }

  let linkData: Record<string, any> = {}
  try {
    const linkRes = await fetch('https://test-api.acquired.com/v1/payment-links', {
      method: 'POST',
      headers: linkHeaders,
      body: JSON.stringify(linkPayload),
    })

    const raw = await linkRes.text().catch(() => '')

    if (!linkRes.ok) {
      // Build a safe diagnostic from Acquired's RESPONSE only. This never
      // contains our app key, access token, Authorization header, Company-Id,
      // or outgoing request body — only what Acquired returned to us.
      let acquiredError: unknown
      try {
        acquiredError = JSON.parse(raw || '')
      } catch {
        acquiredError = (raw || '').slice(0, 1000)
      }

      // Safe staging-only diagnostic: key names and booleans only, derived from
      // the actual outgoing headers/payload. Never includes the app key, access
      // token, Authorization header, Company-Id value, any MID value, or the
      // outgoing field values themselves.
      const ACQUIRED_SUPPORT_COMPANY_ID = '019e081a-d351-714b-b676-6c2c1c08dd63'
      const requestDebug = {
        company_id_present: Boolean(process.env.ACQUIRED_COMPANY_ID),
        company_id_matches_support_value:
          process.env.ACQUIRED_COMPANY_ID === ACQUIRED_SUPPORT_COMPANY_ID,
        mid_header_sent: Object.prototype.hasOwnProperty.call(linkHeaders, 'Mid'),
        payload_top_level_keys: Object.keys(linkPayload),
        transaction_keys: Object.keys(linkPayload.transaction),
      }

      console.error('[payments/acquired] payment-link creation failed', linkRes.status)
      return NextResponse.json(
        {
          ok: false,
          error: 'acquired_payment_link_failed',
          status: linkRes.status,
          acquired_error: acquiredError,
          request_debug: requestDebug,
        },
        { status: 502, headers: noStore },
      )
    }

    linkData = JSON.parse(raw || '{}')
  } catch (err: any) {
    console.error('[payments/acquired] payment-link fetch error', String(err?.message || err))
    return NextResponse.json(
      { ok: false, error: 'acquired_payment_link_failed' },
      { status: 502, headers: noStore },
    )
  }

  // 9) Parse response for link_id.
  const linkId = (linkData.link_id as string) || ''
  if (!linkId) {
    console.error('[payments/acquired] missing link_id in response')
    return NextResponse.json(
      { ok: false, error: 'acquired_missing_link_id' },
      { status: 502, headers: noStore },
    )
  }

  const checkoutUrl = `https://test-pay.acquired.com/v1/${linkId}`

  // 10) Update the existing checkout_intents row at runtime only.
  //     provider_customer_id is ALWAYS included here (for both "created" and
  //     "reused" sources) so the current row is guaranteed to carry its own
  //     customer_id and the final update can never accidentally clear it. It is
  //     only set when we actually have a customerId (always true at this point,
  //     since a missing customer aborts earlier with 502).
  const finalUpdate: Record<string, unknown> = {
    provider: 'acquired',
    provider_session_id: linkId,
    provider_status: 'payment_link_created',
    provider_payload: linkData,
    updated_at: new Date().toISOString(),
  }
  if (customerId) {
    finalUpdate.provider_customer_id = customerId
  }
  // Tracking only: carry the previously-stored card forward when we found one.
  // If none was found we leave provider_card_id untouched so the card_new
  // webhook can still populate it later.
  if (existingCardId) {
    finalUpdate.provider_card_id = existingCardId
  }

  const { data: updated, error: updateErr } = await svc
    .from('checkout_intents')
    .update(finalUpdate)
    .eq('ref', ref)
    .select('ref, provider_session_id, provider_customer_id, provider_card_id')
    .maybeSingle()

  if (updateErr || !updated?.provider_session_id) {
    console.error('[payments/acquired] DB update failed', updateErr?.message)
    return NextResponse.json(
      { ok: false, error: 'Failed to update intent' },
      { status: 500, headers: noStore },
    )
  }

  // 11) Success. Include a safe diagnostic so we can prove the deployed
  //     payment-link request included webhook_url. Derived from the actual
  //     linkPayload/webhookUrl — origin + pathname only (never the query
  //     string), and key names only (no secrets, MID, or field values).
  const webhookUrlSent =
    typeof (linkPayload as Record<string, unknown>).webhook_url === 'string'
  let webhookUrlOrigin: string | null = null
  let webhookUrlPathname: string | null = null
  if (webhookUrlSent) {
    try {
      const parsed = new URL((linkPayload as { webhook_url: string }).webhook_url)
      webhookUrlOrigin = parsed.origin
      webhookUrlPathname = parsed.pathname
    } catch {
      // Leave origin/pathname null if the URL is somehow unparseable.
    }
  }

  // Safe redirect_url diagnostic: pathname + the provider value only. We never
  // echo the full query string (which contains the checkout ref).
  const redirectUrlSent =
    typeof (linkPayload as Record<string, unknown>).redirect_url === 'string'
  let redirectUrlPathname: string | null = null
  let redirectUrlProvider: string | null = null
  if (redirectUrlSent) {
    try {
      const parsed = new URL((linkPayload as { redirect_url: string }).redirect_url)
      redirectUrlPathname = parsed.pathname
      redirectUrlProvider = parsed.searchParams.get('provider')
    } catch {
      // Leave pathname/provider null if the URL is somehow unparseable.
    }
  }

  return NextResponse.json(
    {
      ok: true,
      checkout_url: checkoutUrl,
      provider: 'acquired',
      provider_session_id: linkId,
      request_debug: {
        webhook_url_was_sent: webhookUrlSent,
        webhook_url_origin: webhookUrlOrigin,
        webhook_url_pathname: webhookUrlPathname,
        redirect_url_was_sent: redirectUrlSent,
        redirect_url_pathname: redirectUrlPathname,
        redirect_url_provider: redirectUrlProvider,
        is_recurring_was_sent:
          (linkPayload as Record<string, unknown>).is_recurring === true,
        tds_was_sent:
          typeof (linkPayload as Record<string, unknown>).tds === 'object' &&
          (linkPayload as Record<string, unknown>).tds !== null,
        tds_is_active_was_sent: linkPayload.tds?.is_active === true,
        tds_challenge_preference_was_sent:
          typeof linkPayload.tds?.challenge_preference === 'string' &&
          linkPayload.tds.challenge_preference.length > 0,
        customer_id_was_sent: Boolean(customerId),
        customer_id_source: customerSource,
        customer_payload_keys: customerPayloadKeys,
        // The current row's provider_customer_id is confirmed stored: we only
        // reach this success branch after the final update succeeded, and that
        // update includes provider_customer_id whenever a customerId exists.
        // Verified against the returned row rather than assumed.
        current_intent_customer_id_was_stored: Boolean(updated?.provider_customer_id),
        // Saved-card reuse tracking (booleans only — never the actual card_id).
        existing_card_id_found: Boolean(existingCardId),
        current_intent_card_id_was_stored: Boolean(updated?.provider_card_id),
        payload_top_level_keys: Object.keys(linkPayload),
        transaction_keys: Object.keys(linkPayload.transaction),
      },
    },
    { status: 200, headers: noStore },
  )
}
