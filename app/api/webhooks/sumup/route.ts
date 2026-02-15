import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const PAID_STATUSES = new Set(['paid', 'successful', 'completed'])
const FAILED_STATUSES = new Set(['failed', 'cancelled', 'expired'])

export async function POST(request: NextRequest) {
  // 1) Auth
  const secret = request.headers.get('x-webhook-secret')
  const expected = process.env.WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    console.error('[webhooks/sumup] unauthorized request')
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // 2) Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const eventType = body.event_type as string | undefined
  const checkoutId = body.id as string | undefined

  if (!eventType || !checkoutId) {
    return NextResponse.json({ ok: true })
  }

  // 3) Only handle CHECKOUT_STATUS_CHANGED
  if (eventType !== 'CHECKOUT_STATUS_CHANGED') {
    return NextResponse.json({ ok: true })
  }

  console.log('[webhooks/sumup] processing checkout:', checkoutId)

  // 4) Verify with SumUp API
  const sumupToken = process.env.SUMUP_ACCESS_TOKEN
  if (!sumupToken) {
    console.error('[webhooks/sumup] SUMUP_ACCESS_TOKEN not configured')
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  let sumupStatus: string
  try {
    const verifyRes = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
      headers: { Authorization: `Bearer ${sumupToken}` },
    })

    if (!verifyRes.ok) {
      console.error('[webhooks/sumup] SumUp verify failed:', verifyRes.status)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    const verifyData = await verifyRes.json()
    sumupStatus = (verifyData.status as string || '').toLowerCase()

    if (!PAID_STATUSES.has(sumupStatus) && !FAILED_STATUSES.has(sumupStatus)) {
      console.log('[webhooks/sumup] status_raw=', verifyData.status, 'payload_keys=', Object.keys(verifyData || {}))
    }
  } catch (err: any) {
    console.error('[webhooks/sumup] SumUp API error:', err?.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const supabase = getServiceSupabase()

  // 5) Lookup intent by provider_session_id
  const { data: intent, error: lookupErr } = await supabase
    .from('checkout_intents')
    .select('ref, user_id, state')
    .eq('provider', 'sumup')
    .eq('provider_session_id', checkoutId)
    .limit(1)
    .maybeSingle()

  if (lookupErr) {
    console.error('[webhooks/sumup] lookup error:', lookupErr)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  if (!intent) {
    return NextResponse.json({ ok: true })
  }

  // 6a) Handle failed/cancelled
  if (FAILED_STATUSES.has(sumupStatus)) {
    if (intent.state !== 'failed') {
      await supabase
        .from('checkout_intents')
        .update({
          state: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: `sumup_status:${sumupStatus}`,
        })
        .eq('ref', intent.ref)
    }
    console.log('[webhooks/sumup] marked failed:', intent.ref, sumupStatus)
    return NextResponse.json({ ok: true })
  }

  // 6b) Handle paid/successful
  if (!PAID_STATUSES.has(sumupStatus)) {
    console.log('[webhooks/sumup] unhandled status:', sumupStatus)
    return NextResponse.json({ ok: true })
  }

  // 7) Confirm + award via RPC (idempotent, forward-compatible)
  const { error: rpcErr } = await supabase.rpc('confirm_payment_and_award', {
    p_ref: intent.ref,
  })

  if (rpcErr) {
    const msg = rpcErr.message || ''
    if (msg.includes('function') || msg.includes('p_user_id') || msg.includes('parameters')) {
      // Retry with p_user_id for older RPC signature
      const { error: retryErr } = await supabase.rpc('confirm_payment_and_award', {
        p_ref: intent.ref,
        p_user_id: intent.user_id,
      })
      if (retryErr) {
        console.error('[webhooks/sumup] RPC retry error:', retryErr)
        return NextResponse.json({ ok: false }, { status: 500 })
      }
    } else {
      console.error('[webhooks/sumup] RPC error:', rpcErr)
      return NextResponse.json({ ok: false }, { status: 500 })
    }
  }

  console.log('[webhooks/sumup] confirmed:', intent.ref)
  return NextResponse.json({ ok: true })
}
