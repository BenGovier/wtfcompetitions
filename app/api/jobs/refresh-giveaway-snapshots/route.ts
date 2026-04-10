import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // 1) Auth
  const token = request.nextUrl.searchParams.get('token')
  const expected = process.env.CRON_SECRET
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2) Require campaignId
  const campaignId = request.nextUrl.searchParams.get('campaignId')
  if (!campaignId) {
    return NextResponse.json({ error: 'Missing campaignId query param' }, { status: 400 })
  }

  // 3) Supabase service role client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // 4) Fetch campaign
  const { data: campaign, error: campaignErr } = await supabase
    .from('campaigns')
    .select('id, slug, title, summary, description, status, start_at, end_at, main_prize_title, main_prize_description, hero_image_url, ticket_price_pence, max_tickets_total, max_tickets_per_user, bundles')
    .eq('id', campaignId)
    .single()

  if (campaignErr || !campaign) {
    console.error('[refresh-giveaway-snapshots] campaign not found', campaignId, campaignErr)
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // 5) Fetch instant win prizes + awards
  const { data: prizes } = await supabase
    .from('instant_win_prizes')
    .select('id, prize_title, image_url, quantity, created_at')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: true })

  const { data: awards } = await supabase
    .from('instant_win_awards')
    .select('prize_id')
    .eq('campaign_id', campaign.id)

  // Count awards per prize_id for grouped quantity tracking
  const awardCountByPrize: Record<string, number> = {}
  for (const a of awards ?? []) {
    awardCountByPrize[a.prize_id] = (awardCountByPrize[a.prize_id] || 0) + 1
  }

  const instantWins = (prizes ?? []).map((p: any) => {
    const quantity = p.quantity ?? 1
    const awardedCount = awardCountByPrize[p.id] ?? 0
    const remainingCount = Math.max(quantity - awardedCount, 0)
    return {
      id: p.id,
      title: p.prize_title,
      image_url: p.image_url ?? null,
      quantity,
      awarded_count: awardedCount,
      remaining_count: remainingCount,
      is_won: remainingCount === 0,
    }
  })

  console.log('[refresh-giveaway-snapshots] campaignId=', campaign.id, 'slug=', campaign.slug, 'instant_wins=', Array.isArray(instantWins) ? instantWins.length : 'MISSING_KEY')

  // 5b) Fetch ticket counter (try campaign_ticket_counters first, fallback to giveaway_ticket_counters)
  let nextTicket = 1

  const { data: campaignCounter } = await supabase
    .from('campaign_ticket_counters')
    .select('next_ticket')
    .eq('campaign_id', campaign.id)
    .maybeSingle()

  if (campaignCounter?.next_ticket) {
    nextTicket = campaignCounter.next_ticket
  } else {
    // Fallback to legacy giveaway_ticket_counters table
    const { data: giveawayCounter } = await supabase
      .from('giveaway_ticket_counters')
      .select('next_ticket')
      .eq('giveaway_id', campaign.id)
      .maybeSingle()

    if (giveawayCounter?.next_ticket) {
      nextTicket = giveawayCounter.next_ticket
    }
  }

  const ticketsSold = Math.max(nextTicket - 1, 0)

  console.log(
    '[refresh-giveaway-snapshots] counter',
    'next_ticket=',
    nextTicket,
    'tickets_sold=',
    ticketsSold
  )

  // 6) Build payloads
  const listPayload = {
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    prize_title: campaign.main_prize_title,
    prize_value_text: null,
    hero_image_url: campaign.hero_image_url,
    ends_at: campaign.end_at,
    base_ticket_price_pence: campaign.ticket_price_pence,
    status: campaign.status,
    tickets_sold: ticketsSold,
    next_ticket: nextTicket,
    bundles: campaign.bundles ?? null,
    hard_cap_total_tickets: campaign.max_tickets_total,
  }

  const detailPayload = {
    id: campaign.id,
    slug: campaign.slug,
    title: campaign.title,
    prize_title: campaign.main_prize_title,
    prize_description: campaign.main_prize_description ?? null,
    description: campaign.description ?? null,
    prize_value_text: null,
    hero_image_url: campaign.hero_image_url,
    images: null,
    variant: 'raffle',
    status: campaign.status,
    starts_at: campaign.start_at,
    ends_at: campaign.end_at,
    currency: 'GBP',
    base_ticket_price_pence: campaign.ticket_price_pence,
    bundles: campaign.bundles ?? null,
    hard_cap_total_tickets: campaign.max_tickets_total,
    instant_wins: instantWins,
    tickets_sold: ticketsSold,
    next_ticket: nextTicket,
  }

  // 7) Upsert snapshots (atomic - no delete required)
  const generatedAt = new Date().toISOString()

  const { error: listErr } = await supabase
    .from('giveaway_snapshots')
    .upsert({
      giveaway_id: campaign.id,
      kind: 'list',
      generated_at: generatedAt,
      payload: listPayload,
    }, { onConflict: 'giveaway_id,kind' })

  if (listErr) {
    console.error('[refresh-giveaway-snapshots] list insert failed', listErr)
    return NextResponse.json({ error: 'Failed to insert list snapshot' }, { status: 500 })
  }

  const { error: detailErr } = await supabase
    .from('giveaway_snapshots')
    .upsert({
      giveaway_id: campaign.id,
      kind: 'detail',
      generated_at: generatedAt,
      payload: detailPayload,
    }, { onConflict: 'giveaway_id,kind' })

  if (detailErr) {
    console.error('[refresh-giveaway-snapshots] detail insert failed', detailErr)
    return NextResponse.json({ error: 'Failed to insert detail snapshot' }, { status: 500 })
  }

  console.log('[refresh-giveaway-snapshots] wrote list+detail snapshots')

  return NextResponse.json({ ok: true, campaignId: campaign.id, instantWinsCount: instantWins.length })
}
