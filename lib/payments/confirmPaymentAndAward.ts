import 'server-only'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Canonical result types (shared across every confirmation entry point)
// ---------------------------------------------------------------------------

/**
 * A single instant-win prize awarded to a checkout. `title` is the only
 * guaranteed field; every other field is optional so this stays compatible
 * with both the current singular RPC response and the upcoming multi-award
 * RPC response.
 */
export type InstantWinResult = {
  award_id?: string | null
  slot_id?: string | null
  prize_id?: string | null
  winning_ticket?: number | null
  title: string
  value_text?: string | null
  image_url?: string | null
}

/**
 * The normalised payment-confirmation payload. `prize` remains the FIRST prize
 * for backward compatibility; `prizes` always contains every prize awarded to
 * the checkout (empty array for a no-win order).
 */
export type AwardPayload = {
  confirmed: boolean
  checkout_ref: string
  qty: number
  ticket_start: number | null
  ticket_end: number | null
  won: boolean
  /** @deprecated Use `prizes` instead. Kept as the first prize for compatibility. */
  prize: InstantWinResult | null
  prizes: InstantWinResult[]
  /** Convenience count of prizes won (always mirrors prizes.length). */
  prize_count?: number
  campaign_slug?: string | null
}

// ---------------------------------------------------------------------------
// Backward-compatible normalisation
// ---------------------------------------------------------------------------

/**
 * Coerce a raw prize-like value into a defensive InstantWinResult. Returns null
 * for anything that cannot be represented as a prize (non-object, or missing a
 * usable title), so malformed rows are dropped rather than rendered as blanks.
 */
function coercePrize(raw: unknown): InstantWinResult | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const title =
    typeof r.title === 'string' && r.title.trim().length > 0 ? r.title : null
  if (!title) return null

  const asStringOrNull = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v : null
  const asNumberOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null

  return {
    award_id: asStringOrNull(r.award_id),
    slot_id: asStringOrNull(r.slot_id),
    prize_id: asStringOrNull(r.prize_id),
    winning_ticket: asNumberOrNull(r.winning_ticket),
    title,
    value_text: asStringOrNull(r.value_text),
    image_url: asStringOrNull(r.image_url),
  }
}

/**
 * The single source of truth for turning ANY raw confirmation RPC response
 * (old singular `prize`, new `prizes` array, no-win, or malformed) into a
 * consistent, fully-typed AwardPayload. Every confirmation entry point MUST
 * route the raw RPC result through here so the fallback logic is never
 * duplicated.
 */
export function normalizeAwardPayload(raw: unknown): AwardPayload {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  // Prefer the new `prizes` array; fall back to the singular `prize`.
  const rawList = Array.isArray(r.prizes) && r.prizes.length > 0 ? r.prizes : r.prize ? [r.prize] : []
  const prizes = rawList
    .map(coercePrize)
    .filter((p): p is InstantWinResult => p !== null)

  const asNumberOrNull = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null

  return {
    confirmed: r.confirmed === true,
    checkout_ref: typeof r.checkout_ref === 'string' ? r.checkout_ref : '',
    qty: typeof r.qty === 'number' && Number.isFinite(r.qty) ? r.qty : 0,
    ticket_start: asNumberOrNull(r.ticket_start),
    ticket_end: asNumberOrNull(r.ticket_end),
    won: prizes.length > 0 || r.won === true,
    prize: prizes[0] ?? null,
    prizes,
    prize_count: prizes.length,
    campaign_slug: typeof r.campaign_slug === 'string' ? r.campaign_slug : null,
  }
}

export type ConfirmArgs = {
  ref: string
  userId: string
  provider: 'sumup' | 'paypal' | 'debug' | 'acquired'
}

// ---------------------------------------------------------------------------
// Service-role Supabase client (matches existing repo pattern)
// ---------------------------------------------------------------------------

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE env vars for service role client')
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function confirmPaymentAndAward(args: ConfirmArgs): Promise<AwardPayload> {
  const { ref, userId } = args
  const supabase = getServiceSupabase()

  // 1) Load checkout_intent by ref
  const { data: intent, error: intentErr } = await supabase
    .from('checkout_intents')
    .select('id, ref, user_id, state, provider_session_id, currency, total_pence')
    .eq('ref', ref)
    .single()

  if (intentErr || !intent) {
    throw new Error(`checkout_intent not found for ref="${ref}": ${intentErr?.message ?? 'no row'}`)
  }

  // 2) Validate ownership
  if (intent.user_id !== userId) {
    throw new Error('user_id mismatch: caller does not own this checkout_intent')
  }

  // 3) If not yet confirmed, try SumUp confirm-on-return; otherwise reject
  if (intent.state !== 'confirmed') {
    // Acquired: the browser NEVER confirms or fulfils. The verified Acquired
    // webhook is the only path that runs the RPC and flips state to
    // 'confirmed'. Until it does, we return the pending poll state so the
    // success page keeps polling. (If state were already 'confirmed' we would
    // not be inside this block — we'd fall straight through to the RPC read
    // below, exactly like the SumUp already-confirmed path.)
    if (args.provider === 'acquired') {
      throw new Error('awaiting_provider_confirmation')
    }

    // Debug provider: skip external verification for staging load tests.
    // Defense-in-depth — even if a caller reaches here, the unverified debug
    // award path must never run in production (the confirm route also blocks it
    // earlier with a 403). VERCEL_ENV is server-only; unset locally = allowed.
    if (args.provider === 'debug') {
      if (process.env.VERCEL_ENV === 'production') {
        throw new Error('debug_provider_disabled')
      }
      const { data: rpcData, error: rpcErr } = await supabase.rpc('confirm_payment_and_award', {
        p_ref: ref,
        p_user_id: userId,
      })
      if (rpcErr) {
        throw new Error(`RPC confirm_payment_and_award failed: ${rpcErr.message}`)
      }
      if (!rpcData || typeof rpcData !== 'object') {
        throw new Error('invalid_rpc_payload')
      }
      return normalizeAwardPayload(rpcData)
    }

    if (args.provider !== 'sumup') throw new Error('awaiting_provider_confirmation')

    // SumUp confirm-on-return:
    if (!intent.provider_session_id) throw new Error('awaiting_provider_confirmation')
    const token = process.env.SUMUP_ACCESS_TOKEN
    if (!token) throw new Error('Missing SUMUP_ACCESS_TOKEN')

    const res = await fetch(
      `https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(intent.provider_session_id)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!res.ok) throw new Error('awaiting_provider_confirmation')

    const data = await res.json().catch(() => ({}) as any)
    const status = String((data as any).status || '').toUpperCase()

    const paid = status === 'PAID' || status === 'SUCCESSFUL' || status === 'COMPLETED'
    if (!paid) throw new Error('awaiting_provider_confirmation')
  }

  // 4) Call the DB RPC (idempotent at DB level)
  const { data: rpcData, error: rpcErr } = await supabase.rpc('confirm_payment_and_award', {
    p_ref: ref,
    p_user_id: userId,
  })

  if (rpcErr) {
    throw new Error(`RPC confirm_payment_and_award failed: ${rpcErr.message}`)
  }

  // 5) Normalise the RPC result into a canonical AwardPayload (Postgres returns
  //    jsonb). This guarantees a `prizes` array while preserving the singular
  //    `prize` for backward compatibility.
  if (!rpcData || typeof rpcData !== 'object') {
    throw new Error('invalid_rpc_payload')
  }

  return normalizeAwardPayload(rpcData)
}
