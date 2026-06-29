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
    .select('ref, total_pence, currency, state, campaign_id')
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

  // 8) Create Acquired payment link.
  const amountDecimal = parseFloat((intent.total_pence / 100).toFixed(2))

  let linkData: Record<string, any> = {}
  try {
    const linkRes = await fetch('https://test-api.acquired.com/v1/payment-links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Company-Id': companyId,
      },
      // Minimum Hosted Checkout request per Acquired support: Company-Id only,
      // no MID/public key/signing keys, and only the transaction object (no
      // is_recurring/tds or other optional fields).
      body: JSON.stringify({
        transaction: {
          order_id: intent.ref,
          amount: amountDecimal,
          currency: 'GBP',
        },
      }),
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

      console.error('[payments/acquired] payment-link creation failed', linkRes.status)
      return NextResponse.json(
        {
          ok: false,
          error: 'acquired_payment_link_failed',
          status: linkRes.status,
          acquired_error: acquiredError,
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
  const { data: updated, error: updateErr } = await svc
    .from('checkout_intents')
    .update({
      provider: 'acquired',
      provider_session_id: linkId,
      provider_status: 'payment_link_created',
      provider_payload: linkData,
      updated_at: new Date().toISOString(),
    })
    .eq('ref', ref)
    .select('ref, provider_session_id')
    .maybeSingle()

  if (updateErr || !updated?.provider_session_id) {
    console.error('[payments/acquired] DB update failed', updateErr?.message)
    return NextResponse.json(
      { ok: false, error: 'Failed to update intent' },
      { status: 500, headers: noStore },
    )
  }

  // 11) Success.
  return NextResponse.json(
    {
      ok: true,
      checkout_url: checkoutUrl,
      provider: 'acquired',
      provider_session_id: linkId,
    },
    { status: 200, headers: noStore },
  )
}
