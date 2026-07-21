import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } }

/**
 * True ONLY for the two expected stale-refresh-token conditions:
 *   - refresh_token_not_found    ("Invalid Refresh Token: Refresh Token Not Found")
 *   - refresh_token_already_used ("Invalid Refresh Token: Already Used")
 * Every other auth error (network, config, invalid key, outage, DB, unexpected
 * auth failure) is intentionally excluded and must NOT trigger cookie clearing.
 */
function isStaleRefreshTokenError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used') {
    return true
  }
  const message = String((err as { message?: string }).message ?? '')
  return /refresh token not found/i.test(message) || /invalid refresh token: already used/i.test(message)
}

export async function POST(request: Request) {
  // 1) Auth — a real authenticated Supabase user is REQUIRED in every
  //    environment (local, preview/staging, and production). There is no
  //    bypass/fallback/fixed user_id: unauthenticated checkout is rejected so a
  //    checkout_intent can never be attributed to a shared placeholder user.
  const supabase = await createClient()

  // Keep the SINGLE existing getUser() call; capture both the user and the auth
  // error (getUser may also reject on some client internals, so guard it).
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  let authError: unknown = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
    authError = result.error
  } catch (err) {
    authError = err
  }

  if (!user) {
    // Preserve the exact existing 401 body, status, and Cache-Control.
    const res = NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401, ...NO_STORE })

    // Only on the expected stale-refresh-token conditions, expire the browser's
    // Supabase auth-token cookies so it stops replaying a dead token. This adds
    // NO extra Supabase/DB/network call — just a local cookie-name loop. It is
    // idempotent, so concurrent stale requests are safe (no throw, no 500).
    if (isStaleRefreshTokenError(authError)) {
      const cookieStore = await cookies()
      for (const cookie of cookieStore.getAll()) {
        if (/^sb-.*-auth-token(\.\d+)?$/.test(cookie.name)) {
          res.cookies.set(cookie.name, '', { maxAge: 0, expires: new Date(0), path: '/' })
        }
      }
    }

    return res
  }

  const resolvedUser = user

  // 2) Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, ...NO_STORE })
  }

  const campaignId = body.campaignId as string | undefined
  const qty = typeof body.qty === 'number' ? body.qty : parseInt(String(body.qty || ''), 10)
  const bundlePricePenceRaw = (body as any).bundlePricePence
  const bundlePricePenceParsed = typeof bundlePricePenceRaw === 'number' ? bundlePricePenceRaw : parseInt(String(bundlePricePenceRaw ?? ''), 10)
  const bundlePricePence = Number.isFinite(bundlePricePenceParsed) && bundlePricePenceParsed > 0 ? bundlePricePenceParsed : undefined

  if (!campaignId || typeof campaignId !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing or invalid campaignId' }, { status: 400, ...NO_STORE })
  }

  if (!qty || qty < 1 || !Number.isFinite(qty)) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid qty' }, { status: 400, ...NO_STORE })
  }

  // 3) Fetch campaign for price + hard cap
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, ticket_price_pence, max_tickets_total, max_tickets_per_user, bundles')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 400, ...NO_STORE })
  }

  // 3b) Per-user cap precheck
  if (campaign.max_tickets_per_user != null) {
    const { data: confirmedRows } = await supabase
      .from('checkout_intents')
      .select('qty')
      .eq('user_id', resolvedUser.id)
      .eq('campaign_id', campaignId)
      .not('confirmed_at', 'is', null)

    const alreadyConfirmedQty = (confirmedRows ?? []).reduce(
      (sum: number, row: { qty: number }) => sum + (Number(row.qty) || 0),
      0
    )

    if (alreadyConfirmedQty + qty > campaign.max_tickets_per_user) {
      return NextResponse.json(
        { ok: false, error: 'user_ticket_cap_exceeded' },
        { status: 409, ...NO_STORE }
      )
    }
  }

  // 3c) Compatibility bridge: legacy columns still reference giveaway_id,
  //     but our system is campaign-based. Map campaignId directly.
  const giveawayId = campaignId

  // 3d) Hard-cap check: ensure tickets are still available
  if (campaign.max_tickets_total != null) {
    const { data: counter } = await supabase
      .from('giveaway_ticket_counters')
      .select('next_ticket')
      .eq('giveaway_id', giveawayId)
      .maybeSingle()

    const nextTicket = counter?.next_ticket ?? 1
    const endTicket = nextTicket + qty - 1

    if (endTicket > campaign.max_tickets_total) {
      return NextResponse.json({ ok: false, error: 'sold_out' }, { status: 409, ...NO_STORE })
    }
  }

  // Bundle validation
  let totalPence: number
  if (bundlePricePence != null && Number.isFinite(bundlePricePence)) {
    if (!Array.isArray(campaign.bundles)) {
      return NextResponse.json({ ok: false, error: 'Invalid bundle' }, { status: 400, ...NO_STORE })
    }
    const matched = (campaign.bundles as { quantity: number; price_pence: number }[]).find(
      (b) => Number(b.quantity) === qty && Number(b.price_pence) === bundlePricePence
    )
    if (!matched) {
      return NextResponse.json({ ok: false, error: 'Invalid bundle' }, { status: 400, ...NO_STORE })
    }
    totalPence = bundlePricePence
  } else {
    totalPence = qty * (campaign.ticket_price_pence ?? 0)
  }

  const ref = `CHK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const providerSessionId = randomUUID()

  // 4) Insert checkout_intent as the authenticated user (RLS-scoped client).
  const { error: insertErr } = await supabase
    .from('checkout_intents')
    .insert({
      ref,
      idempotency_key: randomUUID(),
      user_id: resolvedUser.id,
      campaign_id: campaignId,
      giveaway_id: giveawayId,
      qty,
      total_pence: totalPence,
      currency: 'GBP',
      provider: 'debug',
      provider_session_id: providerSessionId,
      state: 'pending',
    })

  if (insertErr) {
    console.error('[checkout/create] Insert error:', insertErr)
    return NextResponse.json({ ok: false, error: 'Failed to create checkout intent' }, { status: 500, ...NO_STORE })
  }

  console.log('[checkout/create] created intent', {
    ref,
    campaignId,
    giveawayId,
    qty,
    userId: resolvedUser.id,
  })

  return NextResponse.json({ ok: true, ref, providerSessionId }, NO_STORE)
}
