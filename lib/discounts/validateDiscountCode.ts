import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  evaluateDiscount,
  normalizeDiscountCode,
  type DiscountResult,
  type DiscountCodeRow,
} from './discountCalc'

/**
 * Server-only discount-code validator.
 *
 * Reads `public.discount_codes` using the caller's server-side Supabase client
 * (RLS-scoped anon client or service role — both are server-only), then hands
 * every decision to the pure `evaluateDiscount` logic. This file imports
 * `server-only`, so it can never be bundled into a client component, and it
 * never returns raw database errors to the caller.
 *
 * It receives ALREADY-AUTHORITATIVE values (campaign id + server-computed
 * subtotal). It never accepts a discount amount, type, scope or id from the
 * client — only the raw submitted code string.
 */
export async function validateDiscountCode(params: {
  supabase: SupabaseClient
  campaignId: string
  subtotalPence: number
  submittedCode?: string | null
}): Promise<DiscountResult> {
  const { supabase, campaignId, subtotalPence, submittedCode } = params

  // No code supplied -> a valid "no discount" result (total = subtotal).
  const hasCode = typeof submittedCode === 'string' && submittedCode.trim().length > 0
  if (!hasCode) {
    if (!Number.isSafeInteger(subtotalPence) || subtotalPence <= 0) {
      return { ok: false, code: 'discount_code_invalid', status: 400 }
    }
    return { ok: true, discount: null, subtotalPence, totalPence: subtotalPence }
  }

  // Normalize + reject malformed input BEFORE querying the database.
  const normalized = normalizeDiscountCode(submittedCode)
  if (!normalized.ok) {
    return { ok: false, code: 'discount_code_invalid', status: 400 }
  }

  // Look up the code (stored normalized/uppercased). Any DB error is treated as
  // "not found" for the client but logged internally as an unexpected failure.
  const { data, error } = await supabase
    .from('discount_codes')
    .select(
      'id, code, discount_type, discount_value, scope, campaign_id, is_active, starts_at, expires_at',
    )
    .eq('code', normalized.code)
    .maybeSingle()

  if (error) {
    console.error('[discounts] discount_codes lookup failed:', error.message)
    // Fall through with a null row -> evaluated as an invalid (unknown) code,
    // never leaking the raw database error.
  }

  const row = (data as DiscountCodeRow | null) ?? null

  return evaluateDiscount({
    row,
    campaignId,
    subtotalPence,
    now: new Date(),
  })
}
