import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // Auth: token query param must match CRON_SECRET
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

  const summary = { ok: true, processed: 0, ended: 0, extended: 0, errors: [] as string[] }

  try {
    // 1) Fetch eligible campaigns: live + end_at <= now
    const { data: campaigns, error: fetchErr } = await supabase
      .from('campaigns')
      .select('id, title, slug, status, end_at, main_prize_title')
      .eq('status', 'live')
      .lte('end_at', new Date().toISOString())
      .order('end_at', { ascending: true })
      .limit(10)

    if (fetchErr) {
      return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 })
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json(summary)
    }

    // 2) Process each campaign
    for (const campaign of campaigns) {
      summary.processed++

      try {
        // a) Compute tickets_sold
        const { data: sumData, error: sumErr } = await supabase
          .from('entries')
          .select('qty')
          .eq('campaign_id', campaign.id)

        if (sumErr) {
          summary.errors.push(`${campaign.id}: entries query failed - ${sumErr.message}`)
          continue
        }

        const ticketsSold = (sumData ?? []).reduce((acc, row) => acc + (row.qty || 0), 0)

        // b) If zero sales, extend by 7 days
        if (ticketsSold === 0) {
          const currentEnd = new Date(campaign.end_at)
          const newEnd = new Date(currentEnd.getTime() + 7 * 24 * 60 * 60 * 1000)

          const { error: extErr } = await supabase
            .from('campaigns')
            .update({ end_at: newEnd.toISOString() })
            .eq('id', campaign.id)

          if (extErr) {
            summary.errors.push(`${campaign.id}: extend failed - ${extErr.message}`)
          } else {
            summary.extended++
          }
          continue
        }

        // c) Idempotency: check if winner already exists for this campaign
        const { data: existingWinner } = await supabase
          .from('winners')
          .select('id')
          .eq('campaign_id', campaign.id)
          .limit(1)
          .maybeSingle()

        if (existingWinner) {
          // Winner already drawn, just ensure campaign is ended
          await supabase
            .from('campaigns')
            .update({ status: 'ended' })
            .eq('id', campaign.id)
          summary.ended++
          continue
        }

        // d) Pick winner weighted by qty
        const { data: entries, error: entriesErr } = await supabase
          .from('entries')
          .select('user_id, qty')
          .eq('campaign_id', campaign.id)
          .order('created_at', { ascending: true })

        if (entriesErr || !entries || entries.length === 0) {
          summary.errors.push(`${campaign.id}: entries fetch failed - ${entriesErr?.message || 'no entries'}`)
          continue
        }

        // Random integer r in [1..ticketsSold]
        const r = Math.floor(Math.random() * ticketsSold) + 1
        let cumulative = 0
        let winnerUserId: string | null = null

        for (const entry of entries) {
          cumulative += entry.qty || 0
          if (r <= cumulative) {
            winnerUserId = entry.user_id
            break
          }
        }

        if (!winnerUserId) {
          summary.errors.push(`${campaign.id}: could not pick winner (r=${r}, total=${ticketsSold})`)
          continue
        }

        // e) Insert winner
        const { error: winErr } = await supabase
          .from('winners')
          .insert({
            campaign_id: campaign.id,
            user_id: winnerUserId,
            nickname: null,
            prize_title: campaign.main_prize_title || campaign.title || 'Prize',
            announced_at: new Date().toISOString(),
          })

        if (winErr) {
          summary.errors.push(`${campaign.id}: winner insert failed - ${winErr.message}`)
          continue
        }

        // f) Set campaign to ended
        const { error: endErr } = await supabase
          .from('campaigns')
          .update({ status: 'ended' })
          .eq('id', campaign.id)

        if (endErr) {
          summary.errors.push(`${campaign.id}: status update failed - ${endErr.message}`)
        }

        summary.ended++

        // g) Trigger snapshot refreshes (non-blocking, collect errors)
        try {
          const baseUrl = request.nextUrl.origin
          await fetch(`${baseUrl}/api/jobs/refresh-winner-snapshots?token=${expectedToken}`)
        } catch (e: any) {
          summary.errors.push(`${campaign.id}: winner snapshot refresh failed - ${e?.message}`)
        }

        try {
          const baseUrl = request.nextUrl.origin
          await fetch(`${baseUrl}/api/jobs/run?token=${expectedToken}`)
        } catch (e: any) {
          summary.errors.push(`${campaign.id}: giveaway snapshot refresh failed - ${e?.message}`)
        }

      } catch (err: any) {
        summary.errors.push(`${campaign.id}: unexpected - ${err?.message}`)
      }
    }

    return NextResponse.json(summary)
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
