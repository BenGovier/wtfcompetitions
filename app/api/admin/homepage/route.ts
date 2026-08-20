import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { authorizeAdminApi } from '@/lib/admin/auth'
import {
  loadHomepageMerchandising,
  isValidRail,
  isUuid,
} from '@/lib/admin/homepage-merchandising'

/**
 * Admin merchandising API for the homepage rails.
 *
 * GET  — returns the full merchandising payload (six ordered rails + the
 *        eligible-competition picker source) in ONE call, backed by exactly two
 *        Supabase queries via the shared loader. No query-per-rail.
 *
 * PUT  — atomically replaces ONE rail's ordering/membership by calling the
 *        `set_homepage_rail_order(p_rail, p_campaign_ids)` RPC exactly once.
 *        The RPC is granted to service_role only, so it runs through a
 *        service-role client (never the browser). One Save = one RPC.
 *
 * Both handlers are admin-only, enforced with the project's shared
 * `authorizeAdminApi` guard (roles: ['admin']).
 */

export async function GET() {
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403 },
    )
  }

  try {
    const data = await loadHomepageMerchandising()
    return NextResponse.json({ ok: true, ...data })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Failed to load homepage merchandising' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient()
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

  const { rail, campaignIds } = body

  if (!isValidRail(rail)) {
    return NextResponse.json({ ok: false, error: 'Invalid rail' }, { status: 400 })
  }

  if (!Array.isArray(campaignIds) || !campaignIds.every(isUuid)) {
    return NextResponse.json(
      { ok: false, error: 'campaignIds must be an array of UUIDs' },
      { status: 400 },
    )
  }

  // Reject duplicate ids up-front (the RPC also guards this, but fail fast).
  if (new Set(campaignIds).size !== campaignIds.length) {
    return NextResponse.json(
      { ok: false, error: 'campaignIds contains duplicates' },
      { status: 400 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: 'Server misconfigured: missing Supabase service credentials' },
      { status: 500 },
    )
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // ONE atomic RPC call — replaces the whole rail's placement rows in a single
  // Postgres transaction. No browser-side DB writes, no per-row round trips.
  const { error: rpcError } = await svc.rpc('set_homepage_rail_order', {
    p_rail: rail,
    p_campaign_ids: campaignIds,
  })

  if (rpcError) {
    return NextResponse.json(
      { ok: false, error: rpcError.message, details: rpcError },
      { status: 500 },
    )
  }

  // Echo the saved order back as the authoritative persisted state for this rail.
  return NextResponse.json({ ok: true, rail, campaignIds })
}
