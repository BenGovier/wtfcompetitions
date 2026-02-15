import 'server-only'
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
  provider: 'sumup' | 'paypal' | 'debug'
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
    .select('id, ref, user_id, state')
    .eq('ref', ref)
    .single()

  if (intentErr || !intent) {
    throw new Error(`checkout_intent not found for ref="${ref}": ${intentErr?.message ?? 'no row'}`)
  }

  // 2) Validate ownership
  if (intent.user_id !== userId) {
    throw new Error('user_id mismatch: caller does not own this checkout_intent')
  }

  // 3) If not yet confirmed by webhook/provider, reject
  if (intent.state !== 'confirmed') {
    throw new Error('awaiting_provider_confirmation')
  }

  // 4) Call the DB RPC (idempotent at DB level)
  const { data: rpcData, error: rpcErr } = await supabase.rpc('confirm_payment_and_award', {
    p_ref: ref,
    p_user_id: userId,
  })

  if (rpcErr) {
    throw new Error(`RPC confirm_payment_and_award failed: ${rpcErr.message}`)
  }

  // 5) Return RPC result directly as AwardPayload (Postgres returns jsonb)
  if (!rpcData || typeof rpcData !== 'object') {
    throw new Error('invalid_rpc_payload')
  }

  return rpcData as AwardPayload
}
