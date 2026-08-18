import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizeAdminApi } from '@/lib/admin/auth'
import { canEnableSending } from '@/lib/admin/marketing/ops-validation'
import {
  getServiceSupabase,
  fetchOpsControl,
  fetchOpsAutomations,
  fetchOpsDefinitions,
  fetchQueueSummary,
  fetchRecentRecipients,
  fetchRecentRuns,
  fetchSuppressionSummary,
} from '@/lib/admin/marketing/ops-queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Stage 034 — Marketing Operations Console read-only snapshot (admin-only).
 *
 * Auth FIRST (user-scoped RLS client, admin role ONLY). Only after an admin is
 * confirmed is the service-role client built to READ authoritative config and
 * BOUNDED operational data in one deliberate request (the console never polls).
 * This route can only read: it cannot send, discover, enqueue, claim, create a
 * run or invoke the worker. Every value is aggregate or masked — no tokens,
 * payloads, snapshots or raw identities.
 */

function denied(authError: string | null) {
  const status = authError === 'Not authenticated' ? 401 : 403
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status, headers: NO_STORE })
}

export async function GET() {
  const supabase = await createClient()
  const { user, role, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user || role !== 'admin') return denied(authError)

  const svc = getServiceSupabase()

  const [control, automations, definitions, queue, recentRecipients, recentRuns, suppressions] =
    await Promise.all([
      fetchOpsControl(svc),
      fetchOpsAutomations(svc),
      fetchOpsDefinitions(svc),
      fetchQueueSummary(svc),
      fetchRecentRecipients(svc),
      fetchRecentRuns(svc),
      fetchSuppressionSummary(svc),
    ])

  const enabledAutomationCount = automations.filter((a) => a.enabled).length
  const enabledDefinitionCount = definitions.filter((d) => d.enabled).length

  // Advisory only — the authoritative re-read + block happens in the mutation.
  const armingCheck = canEnableSending({
    rolloutLimit: control.rolloutLimit,
    enabledAutomationCount,
    enabledDefinitionCount,
  })
  const sendingBlocker = armingCheck.ok ? null : armingCheck.error

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      control,
      automations,
      definitions,
      queue,
      recentRecipients,
      recentRuns,
      suppressions,
      derived: {
        enabledAutomationCount,
        enabledDefinitionCount,
        sendingBlocker,
      },
    },
    { headers: NO_STORE },
  )
}
