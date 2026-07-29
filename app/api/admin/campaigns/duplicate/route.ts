import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { authorizeAdminApi } from '@/lib/admin/auth'

// Canonical UUID matcher — the source id must be a UUID before any
// service-role read is performed with it.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(raw: unknown): raw is string {
  return typeof raw === 'string' && UUID_RE.test(raw.trim())
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

// Columns copied from the source campaign. This is an EXPLICIT allow-list — we
// never `select('*')` and never spread the source row. Transactional / identity
// / status / timestamp columns are deliberately excluded.
const SOURCE_COLUMNS =
  'title, summary, description, main_prize_title, main_prize_description, hero_image_url, ticket_price_pence, was_price_pence, max_tickets_total, max_tickets_per_user, presentation_type, reveal_type, is_free_entry, free_entry_limit_per_user, bundles'

// Reusable instant-prize DEFINITION columns. Never selects slot/award/claim
// columns (winning_ticket, claimed_*, checkout intent, user, award, payout).
const PRIZE_DEFINITION_COLUMNS =
  'prize_title, prize_value_text, image_url, quantity, is_high_value, fulfilment_type, prize_value_pence'

export async function POST(request: Request) {
  const supabase = await createClient()
  // 1) Authorise BEFORE creating any service-role client.
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403 },
    )
  }

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const sourceId = body.sourceId
  const copyBundles = body.copyBundles === true
  const copyInstantPrizes = body.copyInstantPrizes === true

  // 2) Validate the source id as a UUID.
  if (!isUuid(sourceId)) {
    return NextResponse.json({ ok: false, error: 'invalid_source_id' }, { status: 400 })
  }
  const src = sourceId.trim()

  const svc = getServiceSupabase()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 })
  }

  // 3) Load the source campaign (allow-listed columns only).
  const { data: source, error: sourceError } = await svc
    .from('campaigns')
    .select(SOURCE_COLUMNS)
    .eq('id', src)
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ ok: false, error: 'source_not_found' }, { status: 404 })
  }

  // 4) Build the new draft row through an explicit allow-list. The server
  //    decides ALL reset values — none of them come from the browser.
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const newRow: Record<string, any> = {
    // reset / forced values (server-controlled)
    status: 'draft',
    title: `${source.title ?? 'Untitled'} (Copy)`,
    slug: '', // intentionally blank — not publishable until a valid slug is set
    start_at: now.toISOString(),
    end_at: end.toISOString(),
    // copied reusable setup (explicit allow-list)
    summary: source.summary ?? null,
    description: source.description ?? null,
    main_prize_title: source.main_prize_title ?? null,
    main_prize_description: source.main_prize_description ?? null,
    hero_image_url: source.hero_image_url ?? null,
    ticket_price_pence: source.ticket_price_pence ?? 0,
    was_price_pence: source.was_price_pence ?? null,
    max_tickets_total: source.max_tickets_total ?? null,
    max_tickets_per_user: source.max_tickets_per_user ?? null,
    presentation_type: source.presentation_type ?? null,
    reveal_type: source.reveal_type === 'scratch_card' ? 'scratch_card' : 'normal',
    is_free_entry: source.is_free_entry ?? false,
    free_entry_limit_per_user: source.free_entry_limit_per_user ?? 1,
    // bundles only when explicitly requested
    bundles: copyBundles ? (source.bundles ?? null) : null,
  }

  const { data: inserted, error: insertError } = await svc
    .from('campaigns')
    .insert(newRow)
    .select('id')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ ok: false, error: 'duplicate_failed' }, { status: 500 })
  }

  const newId: string = inserted.id
  const warnings: string[] = [
    'Review the slug, dates, pricing, capacity, artwork and instant-prize positions before publishing.',
    'Artwork is shared with the original until you upload a new image.',
  ]

  let instantPrizeDefinitionsCreated = 0
  let slotsCreated = 0

  // 5) Optionally copy reusable instant-prize DEFINITIONS. The draft is already
  //    created; a prize-copy failure never publishes it and never rolls back the
  //    draft — we keep the draft and report the failure clearly.
  if (copyInstantPrizes) {
    const { data: sourcePrizes, error: prizeReadError } = await svc
      .from('instant_win_prizes')
      .select(PRIZE_DEFINITION_COLUMNS)
      .eq('campaign_id', src)
      .order('created_at', { ascending: true })

    if (prizeReadError) {
      return NextResponse.json({
        ok: true,
        id: newId,
        bundlesCopied: copyBundles,
        instantPrizeDefinitionsCreated: 0,
        slotsCreated: 0,
        warnings: [
          ...warnings,
          'Instant-prize setup could not be read and was NOT copied. The draft was created without instant prizes — add them manually.',
        ],
      })
    }

    const rows = (sourcePrizes ?? []).map((p: any) => ({
      campaign_id: newId,
      prize_title: p.prize_title,
      prize_value_text: p.prize_value_text ?? null,
      // unlock_ratio retained for DB compatibility; new rows store a harmless 0.
      unlock_ratio: 0,
      image_url: p.image_url ?? null,
      quantity: p.quantity ?? 1,
      is_high_value: p.is_high_value === true,
      fulfilment_type: p.fulfilment_type ?? 'cash',
      prize_value_pence: p.prize_value_pence ?? null,
    }))

    if (rows.length > 0) {
      // Single batch insert = all-or-nothing. The DB trigger creates exactly
      // `quantity` brand-new UNASSIGNED slots per inserted definition. If the
      // statement fails, nothing is inserted and we report the failure without
      // publishing the draft.
      const { data: createdPrizes, error: prizeInsertError } = await svc
        .from('instant_win_prizes')
        .insert(rows)
        .select('id')

      if (prizeInsertError) {
        return NextResponse.json({
          ok: true,
          id: newId,
          bundlesCopied: copyBundles,
          instantPrizeDefinitionsCreated: 0,
          slotsCreated: 0,
          warnings: [
            ...warnings,
            'Instant-prize setup failed to copy, so NO instant prizes were created. The draft is safe and unpublished — add instant prizes manually before publishing.',
          ],
        })
      }

      instantPrizeDefinitionsCreated = createdPrizes?.length ?? 0

      // Count the slots the trigger created for the new campaign, and prove they
      // are all unassigned/unclaimed.
      const { count: totalSlots } = await svc
        .from('instant_win_slots')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', newId)

      const { count: assignedSlots } = await svc
        .from('instant_win_slots')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', newId)
        .not('winning_ticket', 'is', null)

      slotsCreated = totalSlots ?? 0
      if ((assignedSlots ?? 0) > 0) {
        warnings.push(
          'Warning: some new slots appear pre-assigned. Review instant-prize positions before publishing.',
        )
      }
    }
  }

  // 6) Safe response — new id + summary only. Never returns source rows or raw
  //    Supabase errors.
  return NextResponse.json({
    ok: true,
    id: newId,
    bundlesCopied: copyBundles,
    instantPrizeDefinitionsCreated,
    slotsCreated,
    warnings,
  })
}
