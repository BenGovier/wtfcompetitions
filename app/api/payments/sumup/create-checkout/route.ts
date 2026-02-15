import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } }

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
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, ...NO_STORE })
  }

  // 2) Validate body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, ...NO_STORE })
  }

  const ref = body.ref as string | undefined
  if (!ref || typeof ref !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing ref' }, { status: 400, ...NO_STORE })
  }

  // 3) Load checkout_intent (anon cookie client, scoped to user)
  const { data: intent, error: intentErr } = await supabase
    .from('checkout_intents')
    .select('ref, user_id, total_pence, currency, state')
    .eq('ref', ref)
    .eq('user_id', user.id)
    .single()

  if (intentErr || !intent) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404, ...NO_STORE })
  }

  // 4) Already confirmed
  if (intent.state === 'confirmed') {
    return NextResponse.json({ ok: true, alreadyConfirmed: true }, NO_STORE)
  }

  // 5) Call SumUp API
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const sumupToken = process.env.SUMUP_ACCESS_TOKEN

  if (!siteUrl || !sumupToken) {
    console.error('[payments/sumup] Missing NEXT_PUBLIC_SITE_URL or SUMUP_ACCESS_TOKEN')
    return NextResponse.json({ ok: false }, { status: 500, ...NO_STORE })
  }

  const amountDecimal = (intent.total_pence / 100).toFixed(2)

  let sumupData: Record<string, unknown>
  try {
    const sumupRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sumupToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: parseFloat(amountDecimal),
        currency: 'GBP',
        checkout_reference: ref,
        description: `WTF Giveaways entry (${ref})`,
        redirect_url: `${siteUrl}/checkout/success?ref=${encodeURIComponent(ref)}&provider=sumup`,
        return_url: `${siteUrl}/api/webhooks/sumup`,
      }),
    })

    if (!sumupRes.ok) {
      const errText = await sumupRes.text().catch(() => '')
      console.error('[payments/sumup] SumUp API error:', sumupRes.status, errText)
      return NextResponse.json({ ok: false }, { status: 502, ...NO_STORE })
    }

    sumupData = await sumupRes.json()
  } catch (err: any) {
    console.error('[payments/sumup] SumUp fetch error:', err?.message)
    return NextResponse.json({ ok: false }, { status: 502, ...NO_STORE })
  }

  const checkoutId = (sumupData.id as string) || ''
  const checkoutUrl =
    (sumupData.hosted_checkout_url as string) ||
    (sumupData.checkout_url as string) ||
    (sumupData.url as string) ||
    ''

  if (!checkoutId) {
    console.error('[payments/sumup] No checkout id in SumUp response:', Object.keys(sumupData))
    return NextResponse.json({ ok: false }, { status: 502, ...NO_STORE })
  }

  // 6) Update checkout_intent with provider details (service role)
  const svc = getServiceSupabase()
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
    return NextResponse.json({ ok: false }, { status: 500, ...NO_STORE })
  }

  // 7) Success
  return NextResponse.json({ ok: true, checkoutId, checkoutUrl }, NO_STORE)
}
