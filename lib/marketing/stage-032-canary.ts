import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getMarketingServiceClient } from './service'
import { runMarketingDeliveryBatch, type DeliveryWorkerResult } from './delivery-worker'

/**
 * Stage 032 — TEMPORARY admin-only marketing email canary orchestrator.
 *
 * This module is SERVER-ONLY. It runs a strict, fail-closed preflight and then
 * — only if EVERYTHING matches the single expected production state — calls the
 * EXISTING marketing delivery worker directly, in-process, pinned to exactly
 * one hard-coded recipient (Ben). It never makes an HTTP call back to
 * /api/jobs/marketing-delivery, so CRON_SECRET is not involved.
 *
 * The expected recipient id is hard-coded here and passed into the worker's
 * optional internal `expectedRecipientId` guard. It is NEVER sourced from HTTP
 * input. The route that calls this performs admin authorization first.
 *
 * Fail closed: any unexpected value, missing row, or thrown error aborts BEFORE
 * the worker is called. The worker is only ever invoked once, with no retry.
 */

// Hard-coded Stage 032 canary target (internal only — never from HTTP).
export const STAGE_032_BEN_RECIPIENT_ID = '3c5eab78-8966-48a8-8572-bf30be677220'
export const STAGE_032_BEN_EMAIL = 'ben@naay.co.uk'
// The real customer who must NEVER receive this canary.
export const STAGE_032_CUSTOMER_RECIPIENT_ID = '89af357b-c6a7-4f31-8701-ba53d0522b11'

const EXPECTED_AUTOMATION_KEY = 'abandoned_checkout'
const EXPECTED_OPPORTUNITY_KEY = 'abandoned_checkout'

export interface Stage032CanaryDeps {
  /** Injectable for tests. Defaults to the marketing service-role client. */
  getClient?: () => SupabaseClient
  /** Injectable for tests. Defaults to the REAL delivery worker. */
  runWorker?: (args: { expectedRecipientId: string }) => Promise<DeliveryWorkerResult>
}

export type Stage032CanaryResult =
  | {
      ok: true
      status: DeliveryWorkerResult['status']
      reason?: string
      claimedCount: number
      sentCount: number
      failedCount: number
      recipient: string
    }
  | { ok: false; error: 'preflight_failed'; check: string }

function fail(check: string): Stage032CanaryResult {
  return { ok: false, error: 'preflight_failed', check }
}

/**
 * Run the Stage 032 canary. Assumes admin authorization already happened.
 * Returns a SAFE aggregate result only — never keys, tokens, or raw rows.
 */
export async function runStage032Canary(
  deps: Stage032CanaryDeps = {},
): Promise<Stage032CanaryResult> {
  const getClient = deps.getClient ?? (() => getMarketingServiceClient())
  const runWorker =
    deps.runWorker ?? ((args: { expectedRecipientId: string }) => runMarketingDeliveryBatch(args))

  try {
    const svc = getClient()

    // ---- 1. BEN recipient must be in the exact expected pre-send state. ----
    const { data: ben, error: benErr } = await svc
      .from('marketing_recipients')
      .select(
        'id, user_id, email_lc, status, attempts, sent_at, provider_email_id, locked_at, locked_until, opportunity_id',
      )
      .eq('id', STAGE_032_BEN_RECIPIENT_ID)
      .maybeSingle()

    if (benErr) return fail('ben_lookup_failed')
    if (!ben) return fail('ben_missing')
    if (
      ben.email_lc !== STAGE_032_BEN_EMAIL ||
      ben.status !== 'queued' ||
      ben.attempts !== 0 ||
      ben.sent_at !== null ||
      ben.provider_email_id !== null ||
      ben.locked_at !== null ||
      ben.locked_until !== null ||
      !ben.opportunity_id ||
      !ben.user_id
    ) {
      return fail('ben_state_mismatch')
    }

    // ---- 2. BEN's opportunity must be selected + base_priority 1. ----
    const { data: benOpp, error: benOppErr } = await svc
      .from('marketing_opportunities')
      .select('id, state, base_priority')
      .eq('id', ben.opportunity_id)
      .maybeSingle()

    if (benOppErr) return fail('ben_opportunity_lookup_failed')
    if (!benOpp) return fail('ben_opportunity_missing')
    if (benOpp.state !== 'selected' || benOpp.base_priority !== 1) {
      return fail('ben_opportunity_mismatch')
    }

    // ---- 3. BEN must be marketing-eligible per the DB source of truth. ----
    const { data: eligible, error: eligibleErr } = await svc.rpc('is_marketing_email_eligible', {
      p_user_id: ben.user_id,
      p_email_lc: ben.email_lc,
    })
    if (eligibleErr) return fail('ben_eligibility_lookup_failed')
    if (eligible !== true) return fail('ben_not_eligible')

    // ---- 4. Real customer must STILL be untouched + base_priority 2. ----
    const { data: cust, error: custErr } = await svc
      .from('marketing_recipients')
      .select(
        'id, status, attempts, sent_at, provider_email_id, locked_at, locked_until, opportunity_id',
      )
      .eq('id', STAGE_032_CUSTOMER_RECIPIENT_ID)
      .maybeSingle()

    if (custErr) return fail('customer_lookup_failed')
    if (!cust) return fail('customer_missing')
    if (
      cust.status !== 'queued' ||
      cust.attempts !== 0 ||
      cust.sent_at !== null ||
      cust.provider_email_id !== null ||
      cust.locked_at !== null ||
      cust.locked_until !== null ||
      !cust.opportunity_id
    ) {
      return fail('customer_state_mismatch')
    }

    const { data: custOpp, error: custOppErr } = await svc
      .from('marketing_opportunities')
      .select('id, base_priority')
      .eq('id', cust.opportunity_id)
      .maybeSingle()

    if (custOppErr) return fail('customer_opportunity_lookup_failed')
    if (!custOpp) return fail('customer_opportunity_missing')
    if (custOpp.base_priority !== 2) return fail('customer_opportunity_mismatch')

    // ---- 5. Global control singleton must match exactly. ----
    const { data: control, error: controlErr } = await svc
      .from('marketing_control_state')
      .select('sending_enabled, discovery_enabled, rollout_limit')
      .eq('key', 'default')
      .maybeSingle()

    if (controlErr) return fail('control_lookup_failed')
    if (!control) return fail('control_missing')
    if (
      control.sending_enabled !== true ||
      control.discovery_enabled !== false ||
      control.rollout_limit !== 1
    ) {
      return fail('control_mismatch')
    }

    // ---- 6. Exactly ONE enabled automation: abandoned_checkout. ----
    const { data: automations, error: autoErr } = await svc
      .from('marketing_automations')
      .select('automation_key')
      .eq('enabled', true)

    if (autoErr) return fail('automations_lookup_failed')
    if (
      !Array.isArray(automations) ||
      automations.length !== 1 ||
      automations[0]?.automation_key !== EXPECTED_AUTOMATION_KEY
    ) {
      return fail('automations_mismatch')
    }

    // ---- 7. Exactly ONE enabled opportunity definition: abandoned_checkout. ----
    const { data: definitions, error: defErr } = await svc
      .from('marketing_opportunity_definitions')
      .select('opportunity_key')
      .eq('enabled', true)

    if (defErr) return fail('definitions_lookup_failed')
    if (
      !Array.isArray(definitions) ||
      definitions.length !== 1 ||
      definitions[0]?.opportunity_key !== EXPECTED_OPPORTUNITY_KEY
    ) {
      return fail('definitions_mismatch')
    }

    // ---- All preflight gates passed: invoke the EXISTING worker, pinned. ----
    const result = await runWorker({ expectedRecipientId: STAGE_032_BEN_RECIPIENT_ID })

    return {
      ok: true,
      status: result.status,
      reason: result.reason,
      claimedCount: result.claimed,
      sentCount: result.successFinalized,
      failedCount: result.failureFinalized,
      recipient: STAGE_032_BEN_EMAIL,
    }
  } catch {
    // Fail closed: never fall through to a send on an unexpected error.
    return fail('unexpected_error')
  }
}
