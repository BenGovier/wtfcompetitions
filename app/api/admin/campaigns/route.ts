import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function toDbRow(body: Record<string, any>) {
  return {
    status: body.status,
    title: body.title,
    slug: body.slug,
    summary: body.summary,
    description: body.description,
    start_at: body.startAt,
    end_at: body.endAt,
    main_prize_title: body.mainPrizeTitle,
    main_prize_description: body.mainPrizeDescription,
    hero_image_url: body.heroImageUrl,
    ticket_price_pence: body.ticketPricePence,
    max_tickets_total: body.maxTicketsTotal ?? null,
    max_tickets_per_user: body.maxTicketsPerUser ?? null,
    bundles: body.bundles ?? null,
    presentation_type: body.presentation_type ?? body.presentationType ?? null,
  }
}

async function authorize(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { user: null, error: 'Not authenticated' }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role,is_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow || adminRow.is_enabled !== true) return { user: null, error: 'Not authorized' }

  return { user, error: null }
}

async function refreshSnapshotsNow(campaignId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[snapshots] missing supabaseUrl or service role key')
    return
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { data: c, error: fetchError } = await svc
    .from('campaigns')
    .select('id, slug, title, summary, description, status, start_at, end_at, main_prize_title, main_prize_description, hero_image_url, ticket_price_pence, max_tickets_total, max_tickets_per_user, bundles')
    .eq('id', campaignId)
    .single()

  if (fetchError) throw new Error(`Failed to fetch campaign: ${fetchError.message}`)
  if (!c) return

  // Fetch instant win prizes + awards for this campaign
  const { data: prizes } = await svc
    .from('instant_win_prizes')
    .select('id, prize_title, image_url, created_at')
    .eq('campaign_id', c.id)
    .order('created_at', { ascending: true })

  const { data: awards } = await svc
    .from('instant_win_awards')
    .select('prize_id')
    .eq('campaign_id', c.id)

  const wonSet = new Set((awards ?? []).map((a: any) => a.prize_id))

  // Fetch ticket counter for this campaign
  const { data: counter } = await svc
    .from('giveaway_ticket_counters')
    .select('next_ticket')
    .eq('giveaway_id', c.id)
    .maybeSingle()

  const ticketsSold = Math.max((counter?.next_ticket ?? 1) - 1, 0)

  const instantWins = (prizes ?? []).map((p: any) => ({
    id: p.id,
    title: p.prize_title,
    image_url: p.image_url ?? null,
    is_won: wonSet.has(p.id),
  }))

  console.log('[admin/campaigns/refreshSnapshotsNow] campaignId=', c.id, 'slug=', c.slug, 'instant_wins=', instantWins.length)

  const generatedAt = new Date().toISOString()

  const listPayload = {
    id: c.id,
    slug: c.slug,
    title: c.title,
    prize_title: c.main_prize_title,
    prize_value_text: null,
    hero_image_url: c.hero_image_url,
    ends_at: c.end_at,
    base_ticket_price_pence: c.ticket_price_pence,
    status: c.status,
    tickets_sold: ticketsSold,
  }

  const detailPayload = {
    id: c.id,
    slug: c.slug,
    title: c.title,
    prize_title: c.main_prize_title,
    prize_description: c.main_prize_description ?? null,
    description: c.description ?? null,
    prize_value_text: null,
    hero_image_url: c.hero_image_url,
    images: null,
    variant: 'raffle',
    status: c.status,
    starts_at: c.start_at,
    ends_at: c.end_at,
    currency: 'GBP',
    base_ticket_price_pence: c.ticket_price_pence,
    bundles: c.bundles ?? null,
    hard_cap_total_tickets: c.max_tickets_total,
    tickets_sold: ticketsSold,
    instant_wins: instantWins,
  }

  // Use UPSERT instead of DELETE+INSERT for atomic snapshot updates
  const { error: upsert1 } = await svc.from('giveaway_snapshots').upsert(
    { giveaway_id: c.id, kind: 'list', generated_at: generatedAt, payload: listPayload },
    { onConflict: 'giveaway_id,kind' }
  )
  if (upsert1) throw new Error(`Failed to upsert list snapshot for ${c.id}: ${upsert1.message}`)

  const { error: upsert2 } = await svc.from('giveaway_snapshots').upsert(
    { giveaway_id: c.id, kind: 'detail', generated_at: generatedAt, payload: detailPayload },
    { onConflict: 'giveaway_id,kind' }
  )
  if (upsert2) throw new Error(`Failed to upsert detail snapshot for ${c.id}: ${upsert2.message}`)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await authorize(supabase)
  if (!user) return NextResponse.json({ ok: false, error: authError }, { status: authError === 'Not authenticated' ? 401 : 403 })

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const row = toDbRow(body)

  const { data, error } = await supabase
    .from('campaigns')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
  }

  refreshSnapshotsNow(data.id).catch((e) => console.error('[snapshots] refresh failed', e))

  return NextResponse.json({ ok: true, id: data.id })
}

export async function PUT(request: Request) {
  console.log('[instant-debug][campaign-api] PUT hit')
  const supabase = await createClient()
  const { user, error: authError } = await authorize(supabase)
  if (!user) {
    console.log('[instant-debug][campaign-api] PUT auth failed:', authError)
    return NextResponse.json({ ok: false, error: authError }, { status: authError === 'Not authenticated' ? 401 : 403 })
  }

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    console.log('[instant-debug][campaign-api] PUT invalid JSON body')
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  console.log('[instant-debug][campaign-api] PUT payload: id=', body.id, 'title=', body.title, 'status=', body.status)

  if (!body.id) {
    console.log('[instant-debug][campaign-api] PUT missing campaign id')
    return NextResponse.json({ ok: false, error: 'Missing campaign id' }, { status: 400 })
  }

  const row = toDbRow(body)

  const { error } = await supabase
    .from('campaigns')
    .update(row)
    .eq('id', body.id)

  if (error) {
    console.log('[instant-debug][campaign-api] PUT DB error:', error)
    return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 500 })
  }

  console.log('[instant-debug][campaign-api] PUT DB update success for id=', body.id)
  console.log('[instant-debug][campaign-api] starting snapshot refresh (fire-and-forget)')
  refreshSnapshotsNow(body.id).catch((e) => console.error('[snapshots] refresh failed', e))

  console.log('[instant-debug][campaign-api] PUT returning ok=true for id=', body.id)
  return NextResponse.json({ ok: true, id: body.id })
}
