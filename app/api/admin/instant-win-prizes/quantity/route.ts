import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { authorizeAdminApi } from '@/lib/admin/auth'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

function validateQuantity(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 10000) return null
  return n
}

/**
 * Dedicated quantity-reconciliation endpoint.
 *
 * Quantity is intentionally NOT editable through the ordinary prize PUT.
 * Changing it must go through the staging RPC
 * `admin_set_instant_win_prize_quantity`, which:
 *   - adds only the missing slots when increasing;
 *   - deletes only unassigned & unclaimed slots when decreasing;
 *   - protects assigned/claimed slots;
 *   - is idempotent across repeated saves.
 *
 * The RPC is called ONLY from this admin-authorised server route using the
 * service-role client. It is never called from the browser.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json({ ok: false, error: authError }, { status: authError === 'Not authenticated' ? 401 : 403 })
  }

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const prizeId = typeof body.id === 'string' ? body.id.trim() : ''
  const campaignId = typeof body.campaign_id === 'string' ? body.campaign_id.trim() : ''
  if (!prizeId || !campaignId) {
    return NextResponse.json({ ok: false, error: 'Missing id or campaign_id' }, { status: 400 })
  }

  const newQuantity = validateQuantity(body.quantity)
  if (newQuantity === null) {
    return NextResponse.json({ ok: false, error: 'invalid_quantity' }, { status: 400 })
  }

  const svc = getServiceSupabase()

  // Read the current quantity so we can craft a precise, friendly message if a
  // reduction is blocked by assigned/claimed slots.
  const { data: current, error: curErr } = await svc
    .from('instant_win_prizes')
    .select('quantity')
    .eq('id', prizeId)
    .eq('campaign_id', campaignId)
    .maybeSingle()

  if (curErr) {
    console.error('[instant-win-prizes/quantity] lookup error:', curErr)
    return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 500 })
  }
  if (!current) {
    return NextResponse.json({ ok: false, error: 'Prize not found' }, { status: 404 })
  }

  const isReduction = newQuantity < (current.quantity ?? 0)

  const { error: rpcErr } = await svc.rpc('admin_set_instant_win_prize_quantity', {
    p_prize_id: prizeId,
    p_campaign_id: campaignId,
    p_new_quantity: newQuantity,
  })

  if (rpcErr) {
    // Never expose raw database exception text. A blocked reduction is the
    // expected, actionable failure; anything else is a generic error.
    console.error('[instant-win-prizes/quantity] RPC error:', rpcErr.message)
    if (isReduction) {
      return NextResponse.json(
        {
          ok: false,
          error: 'quantity_reduction_blocked',
          message: 'Quantity cannot be reduced because some prize positions are already assigned or won.',
        },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { ok: false, error: 'quantity_update_failed', message: 'Could not update quantity. Please try again.' },
      { status: 500 },
    )
  }

  // Re-read the reconciled quantity to return the authoritative value.
  const { data: after, error: afterErr } = await svc
    .from('instant_win_prizes')
    .select('quantity')
    .eq('id', prizeId)
    .eq('campaign_id', campaignId)
    .maybeSingle()

  if (afterErr || !after) {
    return NextResponse.json({ ok: true, quantity: newQuantity })
  }

  return NextResponse.json({ ok: true, quantity: after.quantity ?? newQuantity })
}
