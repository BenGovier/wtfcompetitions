import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } }

export async function POST(request: Request) {
  // 1) Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, ...NO_STORE })
  }

  // 2) Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, ...NO_STORE })
  }

  const campaignId = body.campaignId as string | undefined
  const qty = typeof body.qty === 'number' ? body.qty : parseInt(String(body.qty || ''), 10)

  if (!campaignId || typeof campaignId !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid campaignId' }, { status: 400, ...NO_STORE })
  }

  if (!qty || qty < 1 || !Number.isFinite(qty)) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid qty' }, { status: 400, ...NO_STORE })
  }

  // 3) Fetch campaign for price
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, ticket_price_pence')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 400, ...NO_STORE })
  }

  const totalPence = qty * (campaign.ticket_price_pence ?? 0)
  const ref = `CHK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const providerSessionId = randomUUID()

  // 4) Insert checkout_intent
  const { error: insertErr } = await supabase
    .from('checkout_intents')
    .insert({
      ref,
      idempotency_key: randomUUID(),
      user_id: user.id,
      campaign_id: campaignId,
      qty,
      total_pence: totalPence,
      currency: 'GBP',
      provider: 'debug',
      provider_session_id: providerSessionId,
      state: 'pending',
    })

  if (insertErr) {
    console.error('[checkout/create] Insert error:', insertErr)
    return NextResponse.json({ ok: false, error: 'Failed to create checkout intent' }, { status: 500, ...NO_STORE })
  }

  return NextResponse.json({ ok: true, ref, providerSessionId }, NO_STORE)
}
