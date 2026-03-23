import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { confirmPaymentAndAward } from '@/lib/payments/confirmPaymentAndAward'
import type { AwardPayload } from '@/lib/payments/confirmPaymentAndAward'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } }
const STAGING_BYPASS_USER_ID = '00000000-0000-0000-0000-000000000000'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env vars for service role client')
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: Request) {
  // 1) Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const allowStagingCheckoutBypass =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.ALLOW_STAGING_CHECKOUT_BYPASS === 'true'

  const resolvedUser = user ?? (allowStagingCheckoutBypass ? { id: STAGING_BYPASS_USER_ID } : null)

  console.log('[checkout/confirm] caller user:', resolvedUser?.id ?? null)

  if (!resolvedUser) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, ...NO_STORE })
  }

  if (!user && allowStagingCheckoutBypass) {
    console.warn('[checkout/confirm] using staging auth bypass', {
      bypassUserId: STAGING_BYPASS_USER_ID,
    })
  }

  // 2) Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, ...NO_STORE })
  }

  const ref = body.ref as string | undefined
  const provider = body.provider as string | undefined

  if (!ref || typeof ref !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid ref' }, { status: 400, ...NO_STORE })
  }

  if (provider !== 'sumup' && provider !== 'paypal' && provider !== 'debug') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid provider' }, { status: 400, ...NO_STORE })
  }

  // 3) Call confirmPaymentAndAward
  console.log('[checkout/confirm] confirm attempt:', {
    ref,
    provider,
    callerUserId: resolvedUser.id,
    bypassedAuth: !user && allowStagingCheckoutBypass,
  })

  try {
    const award: AwardPayload = await confirmPaymentAndAward({
      ref,
      userId: resolvedUser.id,
      provider,
    })

    // === DETACHED BACKGROUND TASKS ===
    // Fully isolated from request lifecycle - cannot cause 500s or slow responses
    queueMicrotask(() => {
      void (async () => {
        try {
          const svc = getServiceSupabase()
          const cronSecret = process.env.CRON_SECRET
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

          // Get campaign_id from checkout_intent
          const { data: intent } = await svc
            .from('checkout_intents')
            .select('campaign_id')
            .eq('ref', ref)
            .single()

          if (!intent?.campaign_id || !cronSecret) return

          const campaignId = intent.campaign_id

          // --- DRAW TRIGGER ---
          try {
            const { data: campaign } = await svc
              .from('campaigns')
              .select('id, end_at, max_tickets_total, status')
              .eq('id', campaignId)
              .single()

            if (campaign && campaign.status !== 'ended') {
              const { data: counter } = await svc
                .from('giveaway_ticket_counters')
                .select('next_ticket')
                .eq('giveaway_id', campaign.id)
                .maybeSingle()

              const sold = Math.max(0, (counter?.next_ticket ?? 1) - 1)
              const cap = campaign.max_tickets_total ?? 0
              const isSoldOut = cap > 0 && sold >= cap
              const isPastEnd = new Date(campaign.end_at) <= new Date()

              if (isSoldOut || isPastEnd) {
                console.log('[checkout/confirm] triggering immediate draw:', {
                  campaignId: campaign.id,
                  isSoldOut,
                  isPastEnd,
                  sold,
                  cap,
                })

                const drawRes = await fetch(`${baseUrl}/api/jobs/run-draws`, {
                  method: 'GET',
                  headers: { Authorization: `Bearer ${cronSecret}` },
                })
                if (!drawRes.ok) {
                  console.error('[checkout/confirm] draw trigger returned non-ok:', drawRes.status)
                } else {
                  console.log('[checkout/confirm] draw trigger succeeded:', drawRes.status)
                }
              }
            }
          } catch (drawErr: any) {
            console.error('[checkout/confirm] draw trigger error (non-fatal):', drawErr?.message)
          }

          // --- SNAPSHOT REFRESH ---
          try {
            const refreshRes = await fetch(
              `${baseUrl}/api/jobs/refresh-giveaway-snapshots?campaignId=${campaignId}&token=${cronSecret}`,
              { method: 'GET' }
            )
            if (!refreshRes.ok) {
              console.error('[checkout/confirm] snapshot refresh returned non-ok:', refreshRes.status)
            } else {
              console.log('[checkout/confirm] snapshot refresh succeeded for campaign:', campaignId)
            }
          } catch (refreshErr: any) {
            console.error('[checkout/confirm] snapshot refresh error (non-fatal):', refreshErr?.message)
          }
        } catch (bgErr: any) {
          console.error('[checkout/confirm] background task error (non-fatal):', bgErr?.message)
        }
      })()
    })
    // === END DETACHED BACKGROUND TASKS ===

    return NextResponse.json({ ok: true, award }, NO_STORE)
  } catch (err: any) {
    const message = err?.message || ''

    if (message.includes('awaiting_provider_confirmation')) {
      return NextResponse.json({ ok: false, error: 'awaiting_provider_confirmation' }, { status: 409, ...NO_STORE })
    }

    if (message.includes('user_id mismatch') || message.includes('caller does not own')) {
      return NextResponse.json({ ok: false, error: 'forbidden_checkout_intent_owner' }, { status: 403, ...NO_STORE })
    }

    console.error('[checkout/confirm] Error detail:', {
      message,
      ref,
      provider,
      callerUserId: resolvedUser.id,
      bypassedAuth: !user && allowStagingCheckoutBypass,
    })
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500, ...NO_STORE })
  }
}
