import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizeAdminApi } from '@/lib/admin/auth'
import {
  NO_STORE,
  getServiceSupabase,
  validateItemsForSetup,
  normalizeStoredItems,
  mapEventRow,
} from '@/lib/admin/live-board'

const RECENT_EVENTS_LIMIT = 20

/**
 * GET /api/admin/campaigns/[campaignId]/live-board
 *
 * Admin-only. Returns the campaign summary, its live board (or null), and the
 * most recent board events. Read-only — does not require Balloon Pop so the
 * admin UI can always inspect state.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403, ...NO_STORE },
    )
  }

  const { campaignId } = await params
  if (!campaignId) {
    return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 400, ...NO_STORE })
  }

  try {
    const svc = getServiceSupabase()

    const { data: campaign, error: campaignErr } = await svc
      .from('campaigns')
      .select('id, slug, title, status, presentation_type')
      .eq('id', campaignId)
      .maybeSingle()

    if (campaignErr) {
      console.error('[admin/live-board] campaign query error:', campaignErr.message)
      return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
    }
    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404, ...NO_STORE })
    }

    const { data: boardRow, error: boardErr } = await svc
      .from('campaign_live_boards')
      .select('id, enabled, items, last_event_label, last_event_at, updated_at')
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (boardErr) {
      console.error('[admin/live-board] board query error:', boardErr.message)
      return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
    }

    let recentEvents: ReturnType<typeof mapEventRow>[] = []
    if (boardRow) {
      const { data: events, error: eventsErr } = await svc
        .from('campaign_live_board_events')
        .select('id, action_type, item_id, label, delta, before_remaining, after_remaining, created_at')
        .eq('board_id', boardRow.id)
        .order('created_at', { ascending: false })
        .limit(RECENT_EVENTS_LIMIT)

      if (eventsErr) {
        console.error('[admin/live-board] events query error:', eventsErr.message)
        return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
      }
      recentEvents = (events ?? []).map(mapEventRow)
    }

    return NextResponse.json(
      {
        ok: true,
        campaign: {
          id: campaign.id,
          slug: campaign.slug,
          title: campaign.title,
          status: campaign.status,
          presentationType: campaign.presentation_type ?? null,
        },
        board: boardRow
          ? {
              id: boardRow.id,
              enabled: boardRow.enabled === true,
              items: normalizeStoredItems(boardRow.items),
              lastEventLabel: boardRow.last_event_label ?? null,
              lastEventAt: boardRow.last_event_at ?? null,
              updatedAt: boardRow.updated_at,
            }
          : null,
        recentEvents,
      },
      NO_STORE,
    )
  } catch (err: any) {
    console.error('[admin/live-board] GET unexpected error:', err?.message)
    return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
  }
}

/**
 * Create/update (setup or edit) the live board for a campaign.
 *
 * Admin-only. Campaign must exist and be Balloon Pop. Items are validated and
 * normalized. Writes a `setup` event on first create, `edit` thereafter.
 */
async function saveBoard(request: NextRequest, campaignId: string, userId: string) {
  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_items' }, { status: 400, ...NO_STORE })
  }

  const itemsResult = validateItemsForSetup(body.items)
  if (!itemsResult.ok) {
    return NextResponse.json({ ok: false, error: itemsResult.error }, { status: 400, ...NO_STORE })
  }
  const enabled = body.enabled === true

  try {
    const svc = getServiceSupabase()

    const { data: campaign, error: campaignErr } = await svc
      .from('campaigns')
      .select('id, presentation_type')
      .eq('id', campaignId)
      .maybeSingle()

    if (campaignErr) {
      console.error('[admin/live-board] save campaign query error:', campaignErr.message)
      return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
    }
    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404, ...NO_STORE })
    }
    if (campaign.presentation_type !== 'balloon_pop') {
      return NextResponse.json({ ok: false, error: 'not_balloon_pop' }, { status: 400, ...NO_STORE })
    }

    const { data: existing, error: existingErr } = await svc
      .from('campaign_live_boards')
      .select('id')
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (existingErr) {
      console.error('[admin/live-board] save existing query error:', existingErr.message)
      return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
    }

    const nowIso = new Date().toISOString()
    const isFirstCreate = !existing
    const label = isFirstCreate ? 'Board setup saved' : 'Board updated'

    let boardId: string
    if (existing) {
      const { data: updated, error: updateErr } = await svc
        .from('campaign_live_boards')
        .update({
          enabled,
          items: itemsResult.items,
          updated_at: nowIso,
          updated_by: userId,
        })
        .eq('id', existing.id)
        .select('id')
        .single()
      if (updateErr || !updated) {
        console.error('[admin/live-board] board update error:', updateErr?.message)
        return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
      }
      boardId = updated.id
    } else {
      const { data: inserted, error: insertErr } = await svc
        .from('campaign_live_boards')
        .insert({
          campaign_id: campaignId,
          enabled,
          items: itemsResult.items,
          updated_at: nowIso,
          updated_by: userId,
        })
        .select('id')
        .single()
      if (insertErr || !inserted) {
        console.error('[admin/live-board] board insert error:', insertErr?.message)
        return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
      }
      boardId = inserted.id
    }

    const { error: eventErr } = await svc.from('campaign_live_board_events').insert({
      campaign_id: campaignId,
      board_id: boardId,
      action_type: isFirstCreate ? 'setup' : 'edit',
      label,
      note: label,
      created_by: userId,
    })
    if (eventErr) {
      console.error('[admin/live-board] setup event insert error:', eventErr.message)
      // Board already saved; surface a soft error but don't fail the save outright.
    }

    return NextResponse.json({ ok: true, boardId, isFirstCreate }, NO_STORE)
  } catch (err: any) {
    console.error('[admin/live-board] save unexpected error:', err?.message)
    return NextResponse.json({ ok: false, error: 'live_board_action_failed' }, { status: 500, ...NO_STORE })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403, ...NO_STORE },
    )
  }
  const { campaignId } = await params
  if (!campaignId) {
    return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 400, ...NO_STORE })
  }
  return saveBoard(request, campaignId, user.id)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403, ...NO_STORE },
    )
  }
  const { campaignId } = await params
  if (!campaignId) {
    return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 400, ...NO_STORE })
  }
  return saveBoard(request, campaignId, user.id)
}
