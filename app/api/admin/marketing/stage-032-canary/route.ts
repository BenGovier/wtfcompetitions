import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizeAdminApi } from '@/lib/admin/auth'
import { runStage032Canary } from '@/lib/marketing/stage-032-canary'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * TEMPORARY Stage 032 admin-only marketing canary.
 *
 * This endpoint does NOTHING on GET/render. It only acts on an explicit,
 * authenticated admin POST. It independently verifies admin authorization
 * (never trusting the /admin URL prefix), then runs a strict fail-closed
 * preflight and calls the EXISTING delivery worker in-process, pinned to one
 * hard-coded recipient. It accepts NO body input: recipient, batch size,
 * rollout and automation selection are all fixed server-side.
 */
export async function POST() {
  // 1. Independent server-side admin authorization (before ANY other work).
  const supabase = await createClient()
  const { user, role, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user || role !== 'admin') {
    const status = authError === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status, headers: NO_STORE })
  }

  // 2. Preflight + (only if everything matches) the single pinned worker call.
  //    No HTTP input is read; the recipient is hard-coded inside the orchestrator.
  const result = await runStage032Canary()

  const status = result.ok ? 200 : 409
  return NextResponse.json(result, { status, headers: NO_STORE })
}
