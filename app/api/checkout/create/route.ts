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
  // Optional WTF Credit opt-in. ONLY the literal boolean `true` counts as opting
  // in; missing/false/string/numeric/malformed values all behave as false. No
  // client currently sends this field, so existing checkouts are unaffected. A
  // wallet AMOUNT is never accepted from the client — the DB function computes it.
  const useCredit = body.useCredit === true
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
  //    Select the new row's id so the wallet prepare RPC (below) can reference it.
  const { data: checkoutIntent, error: insertErr } = await supabase
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
    .select('id')
    .single()

  if (insertErr || !checkoutIntent) {
    console.error('[checkout/create] Insert error:', insertErr)
    return NextResponse.json({ ok: false, error: 'Failed to create checkout intent' }, { status: 500, ...NO_STORE })
  }

  // 4b) WTF Credit prepare — ONLY when the user explicitly opted in.
  //     When useCredit === false we never touch the wallet and the response is
  //     byte-for-byte identical to before. When useCredit === true this MUST
  //     fail closed: any RPC error, malformed result, or split that does not add
  //     up to the authoritative totalPence returns a 500 and prevents the client
  //     from proceeding to a payment provider. No client-supplied wallet amount
  //     is ever read — the DB function computes the split. The RPC is called via
  //     the same RLS-scoped client (never service role) and is ownership-checked
  //     and idempotent for the same checkout intent.
  let walletResponse:
    | {
        useCredit: true
        walletCreditPence: number
        externalPaymentPence: number
        reservationId: string | null
        expiresAt: string | null
        providerPaymentRequired: boolean
        alreadyPrepared: boolean
      }
    | undefined

  if (useCredit) {
    const { data: walletData, error: walletErr } = await supabase.rpc('wallet_prepare_checkout', {
      p_checkout_intent_id: checkoutIntent.id,
      p_user_id: resolvedUser.id,
      p_use_credit: true,
    })

    if (walletErr) {
      // Do not expose the raw RPC/database error to the client.
      console.error(`[checkout/create] wallet_prepare_checkout RPC failed for ref ${ref}:`, walletErr.message)
      return NextResponse.json({ ok: false, error: 'wallet_prepare_failed' }, { status: 500, ...NO_STORE })
    }

    // The RPC may return a single object or a single-row array; normalise it.
    const result = (Array.isArray(walletData) ? walletData[0] : walletData) as
      | Record<string, unknown>
      | null
      | undefined

    const walletCreditPence = result?.wallet_credit_pence
    const externalPaymentPence = result?.external_payment_pence

    const isNonNegInt = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0

    const validSplit =
      !!result &&
      isNonNegInt(walletCreditPence) &&
      isNonNegInt(externalPaymentPence) &&
      walletCreditPence + externalPaymentPence === totalPence

    if (!validSplit) {
      console.error(
        `[checkout/create] wallet_prepare_checkout returned an invalid split for ref ${ref} ` +
          `(expected total ${totalPence})`,
      )
      return NextResponse.json({ ok: false, error: 'wallet_prepare_failed' }, { status: 500, ...NO_STORE })
    }

    walletResponse = {
      useCredit: true,
      walletCreditPence,
      externalPaymentPence,
      reservationId: typeof result.reservation_id === 'string' ? result.reservation_id : null,
      expiresAt: typeof result.expires_at === 'string' ? result.expires_at : null,
      providerPaymentRequired: externalPaymentPence > 0,
      alreadyPrepared: result.already_prepared === true,
    }
  }

  console.log('[checkout/create] created intent', {
    ref,
    campaignId,
    giveawayId,
    qty,
    userId: resolvedUser.id,
  })

  return NextResponse.json(
    walletResponse
      ? { ok: true, ref, providerSessionId, wallet: walletResponse }
      : { ok: true, ref, providerSessionId },
    NO_STORE,
  )
}
