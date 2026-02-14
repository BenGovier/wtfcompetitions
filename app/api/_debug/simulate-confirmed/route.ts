import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // Auth
  const tokenParam = request.nextUrl.searchParams.get('token')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken || tokenParam !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // Parse params
  const campaignId = request.nextUrl.searchParams.get('campaignId')
  const userId = request.nextUrl.searchParams.get('userId')
  const qty = parseInt(request.nextUrl.searchParams.get('qty') || '1', 10)

  if (!campaignId || !userId) {
    return NextResponse.json({ error: 'Missing campaignId or userId' }, { status: 400 })
  }

  try {
    // 1) Fetch campaign to get ticket_price_pence and max_tickets_total
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .select('id, ticket_price_pence, max_tickets_total')
      .eq('id', campaignId)
      .single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: 'Campaign not found', details: campErr }, { status: 404 })
    }

    const totalPence = qty * (campaign.ticket_price_pence ?? 0)
    const idempotencyKey = randomUUID()
    const ref = `SIM-${Date.now()}`
    const nowIso = new Date().toISOString()

    // 2) Create checkout_intent
    const { data: intent, error: intentErr } = await supabase
      .from('checkout_intents')
      .insert({
        ref,
        idempotency_key: idempotencyKey,
        user_id: userId,
        campaign_id: campaignId,
        qty,
        total_pence: totalPence,
        currency: 'GBP',
        provider: 'stripe',
        state: 'confirmed',
        confirmed_at: nowIso,
      })
      .select('id')
      .single()

    if (intentErr || !intent) {
      return NextResponse.json({ error: 'Failed to create checkout_intent', details: intentErr }, { status: 500 })
    }

    // 3) Create entries row
    const { error: entryErr } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        checkout_intent_id: intent.id,
        qty,
      })

    if (entryErr) {
      return NextResponse.json({ error: 'Failed to create entry', details: entryErr }, { status: 500 })
    }

    // 4) Compute tickets_sold_so_far
    const { data: sumData, error: sumErr } = await supabase
      .from('entries')
      .select('qty')
      .eq('campaign_id', campaignId)

    if (sumErr) {
      return NextResponse.json({ error: 'Failed to sum entries', details: sumErr }, { status: 500 })
    }

    const ticketsSold = (sumData ?? []).reduce((acc, row) => acc + (row.qty || 0), 0)

    // 5) Compute unlock ratio
    const maxTickets = campaign.max_tickets_total
    const unlockRatio = maxTickets != null && maxTickets > 0
      ? ticketsSold / maxTickets
      : 0

    // 6) Find eligible instant-win prizes
    const { data: allPrizes, error: prizesErr } = await supabase
      .from('instant_win_prizes')
      .select('id, title, value_text, unlock_ratio')
      .eq('campaign_id', campaignId)

    if (prizesErr) {
      return NextResponse.json({ error: 'Failed to fetch prizes', details: prizesErr }, { status: 500 })
    }

    // Filter by unlock_ratio
    const eligible = (allPrizes ?? []).filter(
      (p) => p.unlock_ratio != null && p.unlock_ratio <= unlockRatio
    )

    // 7) Exclude already-awarded prizes
    const { data: awardedRows, error: awardedErr } = await supabase
      .from('instant_win_awards')
      .select('prize_id')
      .eq('campaign_id', campaignId)

    if (awardedErr) {
      return NextResponse.json({ error: 'Failed to fetch awards', details: awardedErr }, { status: 500 })
    }

    const awardedPrizeIds = new Set((awardedRows ?? []).map((r) => r.prize_id))
    const unawarded = eligible.filter((p) => !awardedPrizeIds.has(p.id))

    // 8) Award if eligible
    if (unawarded.length > 0) {
      const prize = unawarded[Math.floor(Math.random() * unawarded.length)]

      const { error: awardErr } = await supabase
        .from('instant_win_awards')
        .insert({
          id: randomUUID(),
          campaign_id: campaignId,
          giveaway_id: null,
          checkout_intent_id: intent.id,
          prize_id: prize.id,
          awarded_at: nowIso,
        })

      if (awardErr) {
        return NextResponse.json({ error: 'Failed to insert award', details: awardErr }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        won: true,
        prize: { id: prize.id, title: prize.title, valueText: prize.value_text },
        ticketsSold,
        unlockRatio,
      })
    }

    return NextResponse.json({
      ok: true,
      won: false,
      ticketsSold,
      unlockRatio,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
