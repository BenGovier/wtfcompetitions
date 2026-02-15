import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(request: Request) {
  // 1) Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  // 2) Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Missing or invalid ref' }, { status: 400 })
  }

  const ref = body.ref as string | undefined
  if (!ref || typeof ref !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid ref' }, { status: 400 })
  }

  // 3) Fetch checkout_intent via service role
  const svc = getServiceSupabase()
  const { data: intent, error: intentErr } = await svc
    .from('checkout_intents')
    .select('ref, user_id, total_pence, currency, state, provider_session_id')
    .eq('ref', ref)
    .single()

  if (intentErr || !intent) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  // 4) Ownership check
  if (intent.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  // 5) State check
  if (intent.state !== 'pending') {
    return NextResponse.json({ ok: false, error: 'Intent is not pending' }, { status: 409 })
  }

  // 6) Env vars
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const sumupToken = process.env.SUMUP_ACCESS_TOKEN

  if (!sumupToken) {
    console.error('[payments/sumup] Missing SUMUP_ACCESS_TOKEN')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
  }

  if (!siteUrl) {
    console.error('[payments/sumup] Missing NEXT_PUBLIC_SITE_URL')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
  }

  const redirectUrl = `${siteUrl}/checkout/success?ref=${encodeURIComponent(ref)}&provider=sumup`
  const webhookUrl = `${siteUrl}/api/webhooks/sumup`

  // 7) If provider_session_id already exists, retrieve existing checkout
  if (intent.provider_session_id) {
    try {
      const getRes = await fetch(
        `https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(intent.provider_session_id)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${sumupToken}` },
        },
      )

      if (!getRes.ok) {
        console.error('[payments/sumup] SumUp GET error:', getRes.status)
        return NextResponse.json({ ok: false, error: 'sumup_checkout_retrieval_failed' }, { status: 502 })
      }

      const getData = await getRes.json()
      const checkoutUrl =
        (getData.hosted_checkout_url as string) ||
        (getData.checkout_url as string) ||
        (getData.url as string) ||
        ''

      if (!checkoutUrl) {
        return NextResponse.json({ ok: false, error: 'sumup_missing_checkout_url' }, { status: 502 })
      }

      return NextResponse.json({ ok: true, checkoutUrl })
    } catch (err: any) {
      console.error('[payments/sumup] SumUp GET fetch error:', err?.message)
      return NextResponse.json({ ok: false, error: 'sumup_checkout_retrieval_failed' }, { status: 502 })
    }
  }

  // 8) Create new SumUp checkout
  const amountDecimal = parseFloat((intent.total_pence / 100).toFixed(2))

  let sumupData: Record<string, unknown>
  try {
    const sumupRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sumupToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountDecimal,
        currency: intent.currency || 'GBP',
        checkout_reference: ref,
        redirect_url: redirectUrl,
        webhook_url: webhookUrl,
      }),
    })

    if (!sumupRes.ok) {
      console.error('[payments/sumup] SumUp POST error:', sumupRes.status)
      return NextResponse.json({ ok: false, error: 'sumup_checkout_creation_failed' }, { status: 502 })
    }

    sumupData = await sumupRes.json()
  } catch (err: any) {
    console.error('[payments/sumup] SumUp POST fetch error:', err?.message)
    return NextResponse.json({ ok: false, error: 'sumup_checkout_creation_failed' }, { status: 502 })
  }

  const checkoutId = (sumupData.id as string) || ''
  const checkoutUrl =
    (sumupData.hosted_checkout_url as string) ||
    (sumupData.checkout_url as string) ||
    (sumupData.url as string) ||
    ''

  if (!checkoutId || !checkoutUrl) {
    console.error('[payments/sumup] Missing id or checkout_url in response:', Object.keys(sumupData))
    return NextResponse.json({ ok: false, error: 'sumup_checkout_creation_failed' }, { status: 502 })
  }

  // 9) Update checkout_intent with provider details
  const { error: updateErr } = await svc
    .from('checkout_intents')
    .update({
      provider: 'sumup',
      provider_session_id: checkoutId,
      updated_at: new Date().toISOString(),
    })
    .eq('ref', ref)

  if (updateErr) {
    console.error('[payments/sumup] DB update error:', updateErr)
    return NextResponse.json({ ok: false, error: 'Failed to update intent' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, checkoutUrl })
}
