import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const noStore = { 'Cache-Control': 'no-store' }

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Acquired webhook (staging).
 *
 * Verifies the Acquired webhook hash, records the provider result against the
 * matching checkout_intents row, and — for a verified successful status_update —
 * fulfils the order by calling the existing idempotent DB RPC
 * public.confirm_payment_and_award(p_ref, p_user_id).
 *
 * This route NEVER sets state/confirmed_at directly and NEVER allocates tickets
 * or awards instant wins itself — all of that is delegated to the RPC, which is
 * idempotent. We additionally skip the RPC entirely when the intent is already
 * confirmed, so duplicate Acquired webhooks cannot trigger redundant work.
 */
export async function POST(request: Request) {
  // 1) Signing key must be configured.
  const signingKey = process.env.ACQUIRED_SIGNING_KEY
  if (!signingKey) {
    console.error('[webhooks/acquired] missing ACQUIRED_SIGNING_KEY')
    return NextResponse.json(
      { ok: false, error: 'missing_acquired_signing_key' },
      { status: 500, headers: noStore },
    )
  }

  // 2) Read the RAW body for signature verification, then parse safely.
  const rawBody = await request.text().catch(() => '')

  let parsedBody: Record<string, any>
  try {
    parsedBody = JSON.parse(rawBody || '')
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400, headers: noStore },
    )
  }

  // 3) Read the received hash from the Hash header (case-insensitive).
  const receivedHash =
    request.headers.get('Hash') || request.headers.get('hash') || ''

  // 4) Compute the expected HMAC SHA256 over the minified JSON of the parsed
  //    body, then compare timing-safely. Never log the signing key or hashes.
  const expectedHash = crypto
    .createHmac('sha256', signingKey)
    .update(JSON.stringify(parsedBody))
    .digest('hex')

  const receivedBuf = Buffer.from(receivedHash, 'utf8')
  const expectedBuf = Buffer.from(expectedHash, 'utf8')
  const hashValid =
    receivedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(receivedBuf, expectedBuf)

  if (!hashValid) {
    console.error('[webhooks/acquired] hash verification failed')
    return NextResponse.json(
      { ok: false, error: 'invalid_signature' },
      { status: 401, headers: noStore },
    )
  }

  // 5) Extract the expected webhook shape.
  const webhookType = parsedBody.webhook_type as string | undefined
  const webhookId = parsedBody.webhook_id as string | undefined
  const webhookBody = (parsedBody.webhook_body ?? {}) as Record<string, any>
  const orderId = webhookBody.order_id as string | undefined
  const status = webhookBody.status as string | undefined
  const transactionId = webhookBody.transaction_id as string | undefined

  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: 'missing_order_id' },
      { status: 400, headers: noStore },
    )
  }

  // 6) Find the matching checkout_intents row by ref = order_id.
  const svc = getServiceSupabase()
  const { data: intent, error: lookupErr } = await svc
    .from('checkout_intents')
    .select(
      'id, ref, user_id, state, total_pence, provider_transaction_id, provider_status',
    )
    .eq('ref', orderId)
    .maybeSingle()

  if (lookupErr) {
    console.error('[webhooks/acquired] lookup error', lookupErr.message)
    return NextResponse.json(
      { ok: false, error: 'lookup_failed' },
      { status: 500, headers: noStore },
    )
  }

  if (!intent) {
    return NextResponse.json(
      { ok: false, error: 'intent_not_found' },
      { status: 404, headers: noStore },
    )
  }

  // 7) Capture-only update. Deliberately does NOT touch state, confirmed_at,
  //    tickets, or instant wins.
  const updatePatch: Record<string, unknown> = {
    provider: 'acquired',
    provider_payload: parsedBody,
    updated_at: new Date().toISOString(),
  }
  if (transactionId) updatePatch.provider_transaction_id = transactionId
  if (status) updatePatch.provider_status = status
  if (webhookId) updatePatch.provider_webhook_event_id = webhookId

  const { error: updateErr } = await svc
    .from('checkout_intents')
    .update(updatePatch)
    .eq('ref', orderId)

  if (updateErr) {
    console.error('[webhooks/acquired] update failed', updateErr.message)
    return NextResponse.json(
      { ok: false, error: 'update_failed' },
      { status: 500, headers: noStore },
    )
  }

  // 8) Fulfilment (delegated to the idempotent RPC). The capture update above
  //    has already persisted the provider result regardless of the outcome here.
  const ackBase = {
    ok: true as const,
    webhook_type: webhookType ?? null,
    webhook_id: webhookId ?? null,
    order_id: orderId,
    status: status ?? null,
    transaction_id: transactionId ?? null,
  }

  // 8a) Already confirmed → never call the RPC again (idempotency guard at the
  //     route level, on top of the RPC's own protection).
  if (intent.state === 'confirmed') {
    return NextResponse.json(
      { ...ackBase, fulfilment_status: 'already_confirmed' },
      { status: 200, headers: noStore },
    )
  }

  // 8b) Only a verified successful status_update with a transaction id may
  //     fulfil. Anything else is captured but not fulfilled.
  const eligibleToFulfil =
    webhookType === 'status_update' && status === 'success' && Boolean(transactionId)

  if (!eligibleToFulfil) {
    return NextResponse.json(
      { ...ackBase, fulfilment_status: 'not_success_status' },
      { status: 200, headers: noStore },
    )
  }

  // 8c) Successful, pending checkout → fulfil via the existing RPC only.
  const { data: rpcData, error: rpcErr } = await svc.rpc('confirm_payment_and_award', {
    p_ref: intent.ref,
    p_user_id: intent.user_id,
  })

  if (rpcErr) {
    console.error('[webhooks/acquired] fulfilment RPC failed', rpcErr.message)
    return NextResponse.json(
      {
        ok: false,
        error: 'fulfilment_failed',
        webhook_id: webhookId ?? null,
        order_id: orderId,
        transaction_id: transactionId ?? null,
        provider_status: status ?? null,
        rpc_error_message: rpcErr.message,
      },
      { status: 500, headers: noStore },
    )
  }

  // 8d) Fulfilled. Echo the RPC result (ticket/instant-win allocation summary).
  return NextResponse.json(
    { ...ackBase, fulfilment_status: 'fulfilled', fulfilment: rpcData ?? null },
    { status: 200, headers: noStore },
  )
}
