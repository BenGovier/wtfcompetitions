import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Guard: the REAL service client and REAL worker must NEVER be touched — this
// test injects fakes for both. If the orchestrator ever bypassed injection,
// these mocks would surface it.
const realGetClient = vi.fn(() => {
  throw new Error('real supabase client must not be constructed in tests')
})
vi.mock('../service', () => ({ getMarketingServiceClient: () => realGetClient() }))
const realRunWorker = vi.fn(() => {
  throw new Error('real delivery worker must not be invoked in tests')
})
vi.mock('../delivery-worker', () => ({
  runMarketingDeliveryBatch: (...args: unknown[]) => realRunWorker(...args),
}))

import {
  runStage032Canary,
  STAGE_032_BEN_RECIPIENT_ID,
  STAGE_032_CUSTOMER_RECIPIENT_ID,
} from '../stage-032-canary'

// ---------------------------------------------------------------------------
// Scenario-driven fake service-role client.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

interface Scenario {
  ben: Row | null
  benOpp: Row | null
  eligible: boolean | null
  customer: Row | null
  customerOpp: Row | null
  control: Row | null
  automations: Row[]
  definitions: Row[]
}

function happyScenario(): Scenario {
  return {
    ben: {
      id: STAGE_032_BEN_RECIPIENT_ID,
      user_id: 'user-ben',
      email_lc: 'ben@naay.co.uk',
      status: 'queued',
      attempts: 0,
      sent_at: null,
      provider_email_id: null,
      locked_at: null,
      locked_until: null,
      opportunity_id: 'opp-ben',
    },
    benOpp: { id: 'opp-ben', state: 'selected', base_priority: 1 },
    eligible: true,
    customer: {
      id: STAGE_032_CUSTOMER_RECIPIENT_ID,
      status: 'queued',
      attempts: 0,
      sent_at: null,
      provider_email_id: null,
      locked_at: null,
      locked_until: null,
      opportunity_id: 'opp-cust',
    },
    customerOpp: { id: 'opp-cust', base_priority: 2 },
    control: { sending_enabled: true, discovery_enabled: false, rollout_limit: 1 },
    automations: [{ automation_key: 'abandoned_checkout' }],
    definitions: [{ opportunity_key: 'abandoned_checkout' }],
  }
}

function makeClient(s: Scenario) {
  function builder(table: string) {
    const eqs: Record<string, unknown> = {}
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (k: string, v: unknown) => {
      eqs[k] = v
      return b
    }
    b.maybeSingle = async () => {
      if (table === 'marketing_recipients') {
        if (eqs.id === STAGE_032_BEN_RECIPIENT_ID) return { data: s.ben, error: null }
        if (eqs.id === STAGE_032_CUSTOMER_RECIPIENT_ID) return { data: s.customer, error: null }
        return { data: null, error: null }
      }
      if (table === 'marketing_opportunities') {
        if (eqs.id === 'opp-ben') return { data: s.benOpp, error: null }
        if (eqs.id === 'opp-cust') return { data: s.customerOpp, error: null }
        return { data: null, error: null }
      }
      if (table === 'marketing_control_state') return { data: s.control, error: null }
      return { data: null, error: null }
    }
    // List queries (enabled=true) are awaited directly on the builder.
    b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let data: unknown[] = []
      if (table === 'marketing_automations') data = s.automations
      else if (table === 'marketing_opportunity_definitions') data = s.definitions
      return Promise.resolve({ data, error: null }).then(resolve, reject)
    }
    return b
  }
  return {
    from: (table: string) => builder(table),
    rpc: async (name: string) => {
      if (name === 'is_marketing_email_eligible') return { data: s.eligible, error: null }
      return { data: null, error: null }
    },
  }
}

const workerMock = vi.fn(async () => ({
  status: 'ok' as const,
  reason: undefined,
  recoveredClaims: 0,
  claimStatus: 'ok',
  claimed: 1,
  malformedClaims: 0,
  preProviderRejected: 0,
  authorized: 1,
  authorizationRejected: 0,
  providerSucceeded: 1,
  providerFailed: 0,
  successFinalized: 1,
  failureFinalized: 0,
  providerSucceededFinalizeFailed: 0,
  providerFailedFinalizeFailed: 0,
}))

function run(s: Scenario) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return runStage032Canary({ getClient: () => makeClient(s) as any, runWorker: workerMock })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Stage 032 — canary orchestrator preflight', () => {
  it('happy path passes preflight and invokes the worker pinned to Ben', async () => {
    const r = await run(happyScenario())
    expect(r.ok).toBe(true)
    expect(workerMock).toHaveBeenCalledTimes(1)
    // 10. expectedRecipientId is hard-coded server-side, not client-controlled.
    expect(workerMock).toHaveBeenCalledWith({ expectedRecipientId: STAGE_032_BEN_RECIPIENT_ID })
    if (r.ok) {
      expect(r.claimedCount).toBe(1)
      expect(r.sentCount).toBe(1)
      expect(r.failedCount).toBe(0)
      expect(r.recipient).toBe('ben@naay.co.uk')
    }
    // The real client / worker were never touched.
    expect(realGetClient).not.toHaveBeenCalled()
    expect(realRunWorker).not.toHaveBeenCalled()
  })

  it('5. failed Ben preflight (missing) does NOT trigger worker', async () => {
    const s = happyScenario()
    s.ben = null
    const r = await run(s)
    expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'ben_missing' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('5b. Ben wrong status does NOT trigger worker', async () => {
    const s = happyScenario()
    s.ben = { ...(s.ben as Row), status: 'sent' }
    const r = await run(s)
    expect(r.ok).toBe(false)
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('Ben opportunity wrong base_priority does NOT trigger worker', async () => {
    const s = happyScenario()
    s.benOpp = { id: 'opp-ben', state: 'selected', base_priority: 2 }
    const r = await run(s)
    expect(r).toMatchObject({ ok: false, check: 'ben_opportunity_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('Ben not eligible does NOT trigger worker', async () => {
    const s = happyScenario()
    s.eligible = false
    const r = await run(s)
    expect(r).toMatchObject({ ok: false, check: 'ben_not_eligible' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('6. failed customer safety check does NOT trigger worker', async () => {
    const s = happyScenario()
    s.customer = { ...(s.customer as Row), attempts: 1 }
    const r = await run(s)
    expect(r).toMatchObject({ ok: false, check: 'customer_state_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('customer opportunity wrong base_priority does NOT trigger worker', async () => {
    const s = happyScenario()
    s.customerOpp = { id: 'opp-cust', base_priority: 1 }
    const r = await run(s)
    expect(r).toMatchObject({ ok: false, check: 'customer_opportunity_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('7. wrong global controls do NOT trigger worker', async () => {
    const s = happyScenario()
    s.control = { sending_enabled: true, discovery_enabled: false, rollout_limit: 0 }
    const r = await run(s)
    expect(r).toMatchObject({ ok: false, check: 'control_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('8. more than one enabled automation blocks worker', async () => {
    const s = happyScenario()
    s.automations = [{ automation_key: 'abandoned_checkout' }, { automation_key: 'high_value_customer_at_risk' }]
    const r = await run(s)
    expect(r).toMatchObject({ ok: false, check: 'automations_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('9. more than one enabled definition blocks worker', async () => {
    const s = happyScenario()
    s.definitions = [{ opportunity_key: 'abandoned_checkout' }, { opportunity_key: 'new_account_no_purchase' }]
    const r = await run(s)
    expect(r).toMatchObject({ ok: false, check: 'definitions_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Audit-gap coverage: each individual fail-closed gate proven independently.
// Every case must abort with the exact safe `check` and leave the worker mock
// untouched (no provider attempt, no live client, no real worker).
// ---------------------------------------------------------------------------

describe('Stage 032 — per-field fail-closed gates (audit gaps)', () => {
  // ---- BEN recipient state: each field independently -> ben_state_mismatch --
  const benFieldCases: Array<[string, Row]> = [
    ['wrong email_lc', { email_lc: 'someone-else@example.com' }],
    ['attempts = 1', { attempts: 1 }],
    ['sent_at non-null', { sent_at: '2026-01-01T00:00:00Z' }],
    ['provider_email_id non-null', { provider_email_id: 'prov_123' }],
    ['locked_at non-null', { locked_at: '2026-01-01T00:00:00Z' }],
    ['locked_until non-null', { locked_until: '2026-01-01T00:05:00Z' }],
  ]
  for (const [label, override] of benFieldCases) {
    it(`Ben ${label} => ben_state_mismatch, worker NOT called`, async () => {
      const s = happyScenario()
      s.ben = { ...(s.ben as Row), ...override }
      const r = await run(s)
      expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'ben_state_mismatch' })
      expect(workerMock).not.toHaveBeenCalled()
      expect(realGetClient).not.toHaveBeenCalled()
      expect(realRunWorker).not.toHaveBeenCalled()
    })
  }

  // ---- BEN opportunity state != 'selected' -> ben_opportunity_mismatch ------
  it('Ben opportunity state != selected => ben_opportunity_mismatch, worker NOT called', async () => {
    const s = happyScenario()
    s.benOpp = { id: 'opp-ben', state: 'open', base_priority: 1 }
    const r = await run(s)
    expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'ben_opportunity_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  // ---- CUSTOMER (Kayleigh) safety: each field independently -----------------
  const customerFieldCases: Array<[string, Row]> = [
    ['status != queued', { status: 'sent' }],
    ['sent_at non-null', { sent_at: '2026-01-01T00:00:00Z' }],
    ['provider_email_id non-null', { provider_email_id: 'prov_999' }],
    ['locked_at non-null', { locked_at: '2026-01-01T00:00:00Z' }],
    ['locked_until non-null', { locked_until: '2026-01-01T00:05:00Z' }],
  ]
  for (const [label, override] of customerFieldCases) {
    it(`customer ${label} => customer_state_mismatch, worker NOT called`, async () => {
      const s = happyScenario()
      s.customer = { ...(s.customer as Row), ...override }
      const r = await run(s)
      expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'customer_state_mismatch' })
      expect(workerMock).not.toHaveBeenCalled()
      expect(realRunWorker).not.toHaveBeenCalled()
    })
  }

  // ---- GLOBAL controls: each flag independently -> control_mismatch ---------
  it('sending_enabled = false => control_mismatch, worker NOT called', async () => {
    const s = happyScenario()
    s.control = { sending_enabled: false, discovery_enabled: false, rollout_limit: 1 }
    const r = await run(s)
    expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'control_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('discovery_enabled = true => control_mismatch, worker NOT called', async () => {
    const s = happyScenario()
    s.control = { sending_enabled: true, discovery_enabled: true, rollout_limit: 1 }
    const r = await run(s)
    expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'control_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  // ---- AUTOMATIONS: zero enabled, and single wrong key ----------------------
  it('zero enabled automations => automations_mismatch, worker NOT called', async () => {
    const s = happyScenario()
    s.automations = []
    const r = await run(s)
    expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'automations_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('single enabled automation with wrong key => automations_mismatch, worker NOT called', async () => {
    const s = happyScenario()
    s.automations = [{ automation_key: 'high_value_customer_at_risk' }]
    const r = await run(s)
    expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'automations_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  // ---- DEFINITIONS: zero enabled, and single wrong key ----------------------
  it('zero enabled definitions => definitions_mismatch, worker NOT called', async () => {
    const s = happyScenario()
    s.definitions = []
    const r = await run(s)
    expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'definitions_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('single enabled definition with wrong key => definitions_mismatch, worker NOT called', async () => {
    const s = happyScenario()
    s.definitions = [{ opportunity_key: 'new_account_no_purchase' }]
    const r = await run(s)
    expect(r).toEqual({ ok: false, error: 'preflight_failed', check: 'definitions_mismatch' })
    expect(workerMock).not.toHaveBeenCalled()
  })
})
