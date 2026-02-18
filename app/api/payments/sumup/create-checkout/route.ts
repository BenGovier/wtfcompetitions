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

  // TEMP DEBUG — disable ownership check
  // if (intent.user_id !== user.id) {
  //   return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  // }

  // 5) State check
  if (intent.state !== 'pending') {
    return NextResponse.json({ ok: false, error: 'Intent is not pending' }, { status: 409 })
  }

  // 6) Env vars
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const sumupToken = process.env.SUMUP_ACCESS_TOKEN

  const sumupMerchantCode = process.env.SUMUP_MERCHANT_CODE

  if (!sumupToken) {
    console.error('[payments/sumup] Missing SUMUP_ACCESS_TOKEN')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
  }

  if (!sumupMerchantCode) {
    console.error('[payments/sumup] Missing SUMUP_MERCHANT_CODE')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
  }

  if (!siteUrl) {
    console.error('[payments/sumup] Missing NEXT_PUBLIC_SITE_URL')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500 })
  }

  const redirectUrl = `${siteUrl}/checkout/success?ref=${encodeURIComponent(ref)}&provider=sumup`
  const expectedSecret = process.env.WEBHOOK_SECRET
  const baseWebhookUrl = `${siteUrl}/api/webhooks/sumup`
  const webhookUrl = expectedSecret ? `${baseWebhookUrl}?secret=${encodeURIComponent(expectedSecret)}` : baseWebhookUrl

  // 7) If provider_session_id already exists, return hosted URL directly
  if (intent.provider_session_id) {
    const checkoutUrl = `https://checkout.sumup.com/pay/${encodeURIComponent(intent.provider_session_id)}`
    return NextResponse.json({ ok: true, checkoutUrl })
  }

  // 8) Create new SumUp checkout
  const amountDecimal = parseFloat((intent.total_pence / 100).toFixed(2))

  let sumupData: Record<string, unknown>
  try {
    const payload = {
      merchant_code: sumupMerchantCode,
      amount: amountDecimal,
      currency: intent.currency || 'GBP',
      checkout_reference: ref,
      redirect_url: redirectUrl,
      return_url: webhookUrl,
      hosted_checkout: { enabled: true },
    }

    console.log('[payments/sumup] CREATE PAYLOAD:', payload)

    const sumupRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sumupToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const raw = await sumupRes.text().catch(() => '')
    console.log('[payments/sumup] RAW CREATE RESPONSE:', sumupRes.status, raw)

    if (!sumupRes.ok) {
      return NextResponse.json(
        { ok: false, error: 'sumup_checkout_creation_failed', sumup_status: sumupRes.status, sumup_body: raw },
        { status: 502 },
      )
    }

    sumupData = JSON.parse(raw || '{}')
  } catch (err: any) {
    console.error('[payments/sumup] SumUp POST fetch error:', err)

    return NextResponse.json(
      {
        ok: false,
        error: 'sumup_checkout_creation_failed',
        fetch_error: String(err?.message || err || 'unknown_fetch_error'),
      },
      { status: 502 },
    )
  }

  console.log('[payments/sumup] create response keys:', Object.keys(sumupData))
  console.log('[payments/sumup] create response id fields:', {
    id: (sumupData as any).id,
    checkout_id: (sumupData as any).checkout_id,
    uuid: (sumupData as any).uuid,
  })
  console.log('[payments/sumup] create response raw:', sumupData)

  const checkoutId = (sumupData.id as string) || ''
  console.log('@@SUMUP_VERIFY_START@@', { ref, checkoutId })

  // Validate checkoutId is a real SumUp checkout (prevents storing garbage IDs)
  if (!checkoutId) {
    console.error('[payments/sumup] Missing checkout id in response:', sumupData)
    return NextResponse.json({ ok: false, error: 'sumup_missing_checkout_id' }, { status: 502 })
  }

  const verifyRes = await fetch(
    `https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(checkoutId)}`,
    { headers: { Authorization: `Bearer ${sumupToken}` } }
  )

  console.log('@@SUMUP_VERIFY_RESULT@@', { ref, checkoutId, status: verifyRes.status, ok: verifyRes.ok })

  if (!verifyRes.ok) {
    const verifyText = await verifyRes.text().catch(() => '')
    console.error(
      '[payments/sumup] Created id not retrievable:',
      verifyRes.status,
      verifyText,
      { checkoutId, ref }
    )
    return NextResponse.json(
      {
        ok: false,
        error: 'sumup_created_id_not_retrievable',
        sumup_status: verifyRes.status,
        sumup_body: verifyText,
      },
      { status: 502 }
    )
  }

  const fallbackUrl = `https://checkout.sumup.com/pay/${encodeURIComponent(checkoutId)}`
  const checkoutUrl =
    (sumupData.hosted_checkout_url as string) ||
    (sumupData.checkout_url as string) ||
    ((sumupData.hosted_checkout as any)?.hosted_checkout_url as string) ||
    (sumupData.url as string) ||
    fallbackUrl

  // 9) Update checkout_intent with provider details
  const { data: updated, error: updateErr } = await svc
    .from('checkout_intents')
    .update({
      provider: 'sumup',
      provider_session_id: checkoutId,
      updated_at: new Date().toISOString(),
    })
    .eq('ref', ref)
    .select('ref, provider_session_id')
    .maybeSingle()

  console.log('[payments/sumup] update result:', { updateErr, updated, ref, checkoutId })
  console.log('@@SUMUP_DB_SAVED@@', { ref, checkoutId })

  if (updateErr || !updated?.provider_session_id) {
    return NextResponse.json(
      { ok: false, error: 'Failed to update intent' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, checkoutUrl })
}
