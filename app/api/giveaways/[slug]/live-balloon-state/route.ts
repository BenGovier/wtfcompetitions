import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } }

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

// VIP detection for v1 is based purely on the prize title matching /vip/i.
// This is intentionally a heuristic that matches the current data model.
// TODO: replace with structured data (e.g. a dedicated `tier`/`is_vip`
// column on instant_win_prizes) so VIP status is not inferred from text.
function isVipTitle(title: string | null | undefined): boolean {
  return !!title && /vip/i.test(title)
}

function notBalloonPopResponse(opts: {
  slug: string
  title: string
  status: string
  presentationType: string | null
  revealType: string | null
}) {
  return {
    ok: true as const,
    slug: opts.slug,
    title: opts.title,
    status: opts.status,
    presentationType: opts.presentationType,
    revealType: opts.revealType,
    isBalloonPop: false as const,
    remainingStandardBalloons: 0,
    remainingVipBalloons: 0,
    totalRemainingBalloons: 0,
    claimedStandardBalloons: 0,
    claimedVipBalloons: 0,
    totalClaimedBalloons: 0,
    lastClaimedPrizeTitle: null,
    lastClaimedBalloonType: null,
    lastClaimedAt: null,
    updatedAt: new Date().toISOString(),
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  if (!slug) {
    return NextResponse.json(
      { ok: false, error: 'campaign_not_found' },
      { status: 404, ...NO_STORE },
    )
  }

  try {
    const supabase = getServiceSupabase()

    // 1) Load the campaign by slug. Only the safe, known columns.
    const { data: campaign, error: campaignErr } = await supabase
      .from('campaigns')
      .select('id, slug, title, status, presentation_type, reveal_type')
      .eq('slug', slug)
      .maybeSingle()

    if (campaignErr) {
      console.error('[live-balloon-state] campaign query error:', campaignErr.message)
      return NextResponse.json(
        { ok: false, error: 'live_balloon_state_failed' },
        { status: 500, ...NO_STORE },
      )
    }

    // 2) No campaign -> 404.
    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: 'campaign_not_found' },
        { status: 404, ...NO_STORE },
      )
    }

    const presentationType = campaign.presentation_type ?? null
    const revealType = campaign.reveal_type ?? null

    // 3) Not a Balloon Pop campaign -> zeroed, safe response.
    if (presentationType !== 'balloon_pop') {
      return NextResponse.json(
        notBalloonPopResponse({
          slug: campaign.slug,
          title: campaign.title,
          status: campaign.status,
          presentationType,
          revealType,
        }),
        NO_STORE,
      )
    }

    // 4) Load instant-win prizes for this campaign/giveaway.
    const { data: prizes, error: prizesErr } = await supabase
      .from('instant_win_prizes')
      .select('id, prize_title')
      .eq('giveaway_id', campaign.id)

    if (prizesErr) {
      console.error('[live-balloon-state] prizes query error:', prizesErr.message)
      return NextResponse.json(
        { ok: false, error: 'live_balloon_state_failed' },
        { status: 500, ...NO_STORE },
      )
    }

    // Map prize_id -> { title, isVip } for classification and labelling.
    const prizeById = new Map<string, { title: string | null; isVip: boolean }>()
    for (const p of prizes ?? []) {
      prizeById.set(p.id, { title: p.prize_title ?? null, isVip: isVipTitle(p.prize_title) })
    }

    // 5) Load instant-win slots for this giveaway. Only safe columns:
    // never select winning_ticket or claimed_by_checkout_intent_id.
    const { data: slots, error: slotsErr } = await supabase
      .from('instant_win_slots')
      .select('id, prize_id, claimed_at')
      .eq('giveaway_id', campaign.id)

    if (slotsErr) {
      console.error('[live-balloon-state] slots query error:', slotsErr.message)
      return NextResponse.json(
        { ok: false, error: 'live_balloon_state_failed' },
        { status: 500, ...NO_STORE },
      )
    }

    // 6) Count remaining/claimed by standard vs VIP in server code.
    let remainingStandardBalloons = 0
    let remainingVipBalloons = 0
    let claimedStandardBalloons = 0
    let claimedVipBalloons = 0

    // 7) Track the most recent claimed slot by latest claimed_at.
    let lastClaimedAt: string | null = null
    let lastClaimedPrizeId: string | null = null
    let lastClaimedIsVip = false

    for (const slot of slots ?? []) {
      const prize = slot.prize_id ? prizeById.get(slot.prize_id) : undefined
      const isVip = prize?.isVip ?? false
      const claimed = slot.claimed_at != null

      if (claimed) {
        if (isVip) claimedVipBalloons++
        else claimedStandardBalloons++

        if (lastClaimedAt === null || (slot.claimed_at as string) > lastClaimedAt) {
          lastClaimedAt = slot.claimed_at as string
          lastClaimedPrizeId = slot.prize_id ?? null
          lastClaimedIsVip = isVip
        }
      } else {
        if (isVip) remainingVipBalloons++
        else remainingStandardBalloons++
      }
    }

    // 8) Map the most-recent claimed slot's prize_id to its title.
    const lastClaimedPrizeTitle = lastClaimedPrizeId
      ? prizeById.get(lastClaimedPrizeId)?.title ?? null
      : null
    const lastClaimedBalloonType: 'STANDARD' | 'VIP' | null =
      lastClaimedAt === null ? null : lastClaimedIsVip ? 'VIP' : 'STANDARD'

    // 9) Return only the safe aggregate response.
    return NextResponse.json(
      {
        ok: true,
        slug: campaign.slug,
        title: campaign.title,
        status: campaign.status,
        presentationType,
        revealType,
        isBalloonPop: true,

        remainingStandardBalloons,
        remainingVipBalloons,
        totalRemainingBalloons: remainingStandardBalloons + remainingVipBalloons,

        claimedStandardBalloons,
        claimedVipBalloons,
        totalClaimedBalloons: claimedStandardBalloons + claimedVipBalloons,

        lastClaimedPrizeTitle,
        lastClaimedBalloonType,
        lastClaimedAt,

        updatedAt: new Date().toISOString(),
      },
      NO_STORE,
    )
  } catch (err: any) {
    console.error('[live-balloon-state] unexpected error:', err?.message)
    return NextResponse.json(
      { ok: false, error: 'live_balloon_state_failed' },
      { status: 500, ...NO_STORE },
    )
  }
}
