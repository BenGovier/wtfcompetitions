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

async function sendResendEmail(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
  html: string
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '(unable to read body)')
    console.error('[webhooks/sumup][email] Resend API error:', { status: res.status, body: errorBody })
    throw new Error(`Resend API returned ${res.status}`)
  }

  return res.json()
}

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
    .select('id, ref, user_id, state, campaign_id, qty, confirmation_email_sent_at')
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

  // === POST-PURCHASE CONFIRMATION EMAIL (best-effort, non-blocking, race-safe) ===
  try {
    // Step 1: Atomically claim the send right BEFORE any email work
    const claimedAt = new Date().toISOString()
    const { data: claimResult } = await supabase
      .from('checkout_intents')
      .update({ confirmation_email_sent_at: claimedAt })
      .eq('id', intent.id)
      .is('confirmation_email_sent_at', null)
      .select('id')

    if (!claimResult || claimResult.length === 0) {
      // Another request already claimed or sent
      console.log('[webhooks/sumup][email] already claimed/sent for:', intent.ref)
    } else {
      // This request owns the send - proceed with email
      let sendSucceeded = false

      try {
        // a) Fetch purchaser email from auth
        const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(intent.user_id)
        const purchaserEmail = authUserData?.user?.email ?? null

        if (authUserError) {
          console.error('[webhooks/sumup][email] auth lookup error:', authUserError.message)
        }

        if (!purchaserEmail) {
          console.log('[webhooks/sumup][email] no email found for user:', intent.user_id)
          sendSucceeded = true // No email to send, but not a failure
        } else {
          // b) Fetch campaign title
          const { data: emailCampaign } = await supabase
            .from('campaigns')
            .select('title')
            .eq('id', intent.campaign_id)
            .single()

          const campaignTitle = emailCampaign?.title ?? 'WTF Giveaway'

          // c) Fetch entry by checkout_intent_id
          const { data: entry } = await supabase
            .from('entries')
            .select('id')
            .eq('checkout_intent_id', intent.id)
            .single()

          let ticketLabel = ''
          if (entry) {
            // d) Fetch ticket allocation
            const { data: allocation } = await supabase
              .from('ticket_allocations')
              .select('start_ticket, end_ticket')
              .eq('entry_id', entry.id)
              .single()

            if (allocation) {
              if (allocation.start_ticket === allocation.end_ticket) {
                ticketLabel = `Ticket number: ${allocation.start_ticket}`
              } else {
                ticketLabel = `Ticket numbers: ${allocation.start_ticket}-${allocation.end_ticket}`
              }
            }
          }

          // e) Build email content
          const qty = intent.qty ?? 1
          const subject = 'Your WTF Giveaways tickets are confirmed'
          const text = `Thank you for your purchase!\n\nCampaign: ${campaignTitle}\nQuantity: ${qty} ticket${qty > 1 ? 's' : ''}\n${ticketLabel}\n\nGood luck!`
          const html = `
            <p>Thank you for your purchase!</p>
            <p><strong>Campaign:</strong> ${campaignTitle}</p>
            <p><strong>Quantity:</strong> ${qty} ticket${qty > 1 ? 's' : ''}</p>
            ${ticketLabel ? `<p><strong>${ticketLabel}</strong></p>` : ''}
            <p>Good luck!</p>
          `.trim()

          const resendApiKey = process.env.RESEND_API_KEY
          const resendFrom = process.env.RESEND_FROM

          if (!resendApiKey || !resendFrom) {
            console.warn('[webhooks/sumup][email] RESEND_API_KEY or RESEND_FROM not configured')
            sendSucceeded = true // Config issue, not a send failure
          } else {
            // f) Send email
            await sendResendEmail({
              apiKey: resendApiKey,
              from: resendFrom,
              to: purchaserEmail,
              subject,
              text,
              html,
            })

            console.log('[webhooks/sumup][email] sent to:', purchaserEmail)
            sendSucceeded = true
          }
        }
      } catch (sendErr: any) {
        console.error('[webhooks/sumup][email] send failed:', sendErr?.message)
        sendSucceeded = false
      }

      // Step 2: If send failed, rollback the claim so another retry can attempt
      if (!sendSucceeded) {
        await supabase
          .from('checkout_intents')
          .update({ confirmation_email_sent_at: null })
          .eq('id', intent.id)
        console.log('[webhooks/sumup][email] rolled back claim for retry:', intent.ref)
      }
    }
  } catch (emailErr: any) {
    // Log but do NOT fail the webhook response
    console.error('[webhooks/sumup][email] error (non-fatal):', emailErr?.message)
  }
  // === END POST-PURCHASE CONFIRMATION EMAIL ===

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
