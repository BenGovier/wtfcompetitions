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
  // 1) Auth via query param (SumUp cannot send custom headers)
  const expected = process.env.WEBHOOK_SECRET
  const provided = request.nextUrl.searchParams.get('secret')
  if (expected && provided !== expected) {
    console.error('[webhooks/sumup] unauthorized request')
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  if (!expected) {
    console.warn('[webhooks/sumup] WEBHOOK_SECRET not set, allowing request without auth')
  }

  // 2) Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const checkoutId = body.id as string | undefined

  if (!checkoutId) {
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
    .select('ref, user_id, state, campaign_id')
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

  // 7) Confirm + award via RPC (idempotent)
  const { error: rpcErr } = await supabase.rpc('confirm_payment_and_award', {
    p_ref: intent.ref,
    p_user_id: intent.user_id,
  })

  if (rpcErr) {
    console.error('[webhooks/sumup] RPC error:', rpcErr)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  console.log('[webhooks/sumup] confirmed:', intent.ref)

  // === INSTANT MAIN DRAW TRIGGER (best-effort, non-blocking) ===
  // Trigger the existing draw route immediately if sold out OR end time passed
  try {
    const campaignId = intent.campaign_id
    if (campaignId) {
      // Get campaign details
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, end_at, max_tickets_total, status')
        .eq('id', campaignId)
        .single()

      if (campaign && campaign.status !== 'ended') {
        const cap = campaign.max_tickets_total ?? 0

        // Retry loop to handle race condition where counter may not be visible yet
        let sold = 0
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data: counter } = await supabase
            .from('giveaway_ticket_counters')
            .select('next_ticket')
            .eq('giveaway_id', campaign.id)
            .maybeSingle()

          sold = Math.max(0, (counter?.next_ticket ?? 1) - 1)

          // Break early if sold-out detected
          if (cap > 0 && sold >= cap) break

          // Wait 150ms before retry (skip wait on last attempt)
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 150))
          }
        }

        // Check trigger conditions: sold out OR end time passed
        const isSoldOut = cap > 0 && sold >= cap
        const isPastEnd = new Date(campaign.end_at) <= new Date()

        if (isSoldOut || isPastEnd) {
          console.log('[webhooks/sumup] triggering immediate draw:', {
            campaignId: campaign.id,
            isSoldOut,
            isPastEnd,
            sold,
            cap,
          })

          // Trigger draw route with Bearer auth (awaited for reliability)
          const cronSecret = process.env.CRON_SECRET
          if (cronSecret) {
            const baseUrl = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

            const drawRes = await fetch(`${baseUrl}/api/jobs/run-draws`, {
              method: 'GET',
              headers: { Authorization: `Bearer ${cronSecret}` },
            })

            if (!drawRes.ok) {
              const resText = await drawRes.text().catch(() => '(unable to read body)')
              console.error('[webhooks/sumup] draw trigger returned non-ok:', {
                status: drawRes.status,
                body: resText,
              })
            } else {
              console.log('[webhooks/sumup] draw trigger succeeded:', drawRes.status)
            }
          }
        }
      }
    }
  } catch (drawTriggerErr: any) {
    // Log but do NOT fail the webhook response
    console.error('[webhooks/sumup] instant draw trigger error (non-fatal):', drawTriggerErr?.message)
  }
  // === END INSTANT MAIN DRAW TRIGGER ===

  return NextResponse.json({ ok: true })
}
