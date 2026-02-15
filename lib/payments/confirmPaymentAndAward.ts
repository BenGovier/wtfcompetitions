import { createClient as createServiceClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AwardPayload = {
  confirmed: boolean
  checkout_ref: string
  qty: number
  won: boolean
  prize: null | { title: string; value_text: string | null; image_url: string | null }
}

export type ConfirmArgs = {
  ref: string
  userId: string
  provider: 'stripe' | 'paypal'
  stripePaymentIntentId?: string
  paypalOrderId?: string
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
// Provider verification stubs
// ---------------------------------------------------------------------------

async function verifyStripe(_paymentIntentId: string): Promise<void> {
  // TODO: call Stripe API to verify payment_intent status === 'succeeded'
  throw new Error('provider_verification_not_implemented')
}

async function verifyPaypal(_orderId: string): Promise<void> {
  // TODO: call PayPal Orders API to verify capture status === 'COMPLETED'
  throw new Error('provider_verification_not_implemented')
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function confirmPaymentAndAward(args: ConfirmArgs): Promise<AwardPayload> {
  const { ref, userId, provider, stripePaymentIntentId, paypalOrderId } = args
  const supabase = getServiceSupabase()

  // 1) Load checkout_intent by ref
  const { data: intent, error: intentErr } = await supabase
    .from('checkout_intents')
    .select('id, ref, user_id, provider, state')
    .eq('ref', ref)
    .single()

  if (intentErr || !intent) {
    throw new Error(`checkout_intent not found for ref="${ref}": ${intentErr?.message ?? 'no row'}`)
  }

  // 2) Validate ownership + provider match
  if (intent.user_id !== userId) {
    throw new Error('user_id mismatch: caller does not own this checkout_intent')
  }

  if (intent.provider !== provider) {
    throw new Error(`provider mismatch: intent has "${intent.provider}", caller sent "${provider}"`)
  }

  // 3) If not yet confirmed, run provider verification (strict stubs that throw)
  if (intent.state !== 'confirmed') {
    if (provider === 'stripe') {
      if (!stripePaymentIntentId) {
        throw new Error('stripePaymentIntentId required for unconfirmed Stripe intent')
      }
      await verifyStripe(stripePaymentIntentId)
    } else if (provider === 'paypal') {
      if (!paypalOrderId) {
        throw new Error('paypalOrderId required for unconfirmed PayPal intent')
      }
      await verifyPaypal(paypalOrderId)
    }
  }

  // 4) Call the DB RPC (idempotent at DB level)
  const { data: rpcData, error: rpcErr } = await supabase.rpc('confirm_payment_and_award', {
    p_ref: ref,
    p_user_id: userId,
  })

  if (rpcErr) {
    throw new Error(`RPC confirm_payment_and_award failed: ${rpcErr.message}`)
  }

  // 5) Map RPC result to AwardPayload
  const row = rpcData as Record<string, any>

  return {
    confirmed: true,
    checkout_ref: ref,
    qty: row.qty ?? 0,
    won: !!row.won,
    prize: row.won
      ? {
          title: row.prize_title ?? '',
          value_text: row.prize_value_text ?? null,
          image_url: row.prize_image_url ?? null,
        }
      : null,
  }
}
