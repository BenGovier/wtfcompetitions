import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Static contract tests for
//   scripts/marketing/012-marketing-opportunity-priority-calibration.sql
//
// These tests treat the migration as STATIC TEXT. They never open a database
// connection, never execute SQL, and never mutate anything. They assert that
// the Stage 3C2E calibration touches ONLY the three intended default_priority
// values, guards its preconditions, and changes nothing else.
// ---------------------------------------------------------------------------

const CODE = readFileSync(
  join(process.cwd(), 'scripts/marketing/012-marketing-opportunity-priority-calibration.sql'),
  'utf8',
)

// Comment-stripped executable view: drop full-line and trailing "-- ..."
// comments so assertions about executable SQL cannot be satisfied by prose.
const EXEC = CODE.split('\n')
  .map((line) => {
    const idx = line.indexOf('--')
    return idx >= 0 ? line.slice(0, idx) : line
  })
  .join('\n')

const FLAT = CODE.replace(/\s+/g, ' ')
const FLAT_EXEC = EXEC.replace(/\s+/g, ' ')

// Executable view with comments AND single-quoted string literals removed, so
// identifier bans cannot be satisfied by prose inside RAISE messages.
const EXEC_NOSTR = EXEC.replace(/'(?:[^']|'')*'/g, "''")

const TARGET_KEYS = [
  'high_value_customer_at_risk',
  'vip_relevant_campaign',
  'reactivated_customer_follow_up',
]

describe('012 priority calibration — transaction & safety envelope', () => {
  it('runs inside a single BEGIN/COMMIT transaction', () => {
    expect(FLAT_EXEC).toMatch(/BEGIN;/)
    expect(FLAT_EXEC).toMatch(/COMMIT;/)
    expect((FLAT_EXEC.match(/\bBEGIN;/g) || []).length).toBe(1)
    expect((FLAT_EXEC.match(/\bCOMMIT;/g) || []).length).toBe(1)
  })

  it('sets sensible LOCAL lock_timeout and statement_timeout', () => {
    expect(FLAT_EXEC).toMatch(/SET LOCAL lock_timeout = '5s'/i)
    expect(FLAT_EXEC).toMatch(/SET LOCAL statement_timeout = '30s'/i)
  })

  it('never rolls the whole thing back with a ROLLBACK statement', () => {
    expect(/\bROLLBACK\b/i.test(EXEC)).toBe(false)
  })
})

describe('012 priority calibration — preflight guards', () => {
  it('asserts the definitions and control-state tables exist (to_regclass)', () => {
    expect(FLAT_EXEC).toMatch(/to_regclass/i)
    expect(FLAT_EXEC).toMatch(/'public\.marketing_opportunity_definitions'/)
    expect(FLAT_EXEC).toMatch(/'public\.marketing_control_state'/)
  })

  it('READS marketing_control_state to assert Marketing is fully paused', () => {
    expect(FLAT_EXEC).toMatch(
      /SELECT sending_enabled, discovery_enabled, rollout_limit INTO/i,
    )
    expect(FLAT_EXEC).toMatch(
      /v_sending IS DISTINCT FROM false\s+OR v_discovery IS DISTINCT FROM false\s+OR v_rollout\s+IS DISTINCT FROM 0/i,
    )
  })

  it('guards the EXPECTED CURRENT priorities (2 / 1 / 4) before updating', () => {
    expect(FLAT_EXEC).toMatch(
      /v_prio_hvar IS DISTINCT FROM 2\s+OR v_prio_vrc\s+IS DISTINCT FROM 1\s+OR v_prio_rcfu IS DISTINCT FROM 4/i,
    )
  })

  it('guards that all three target definitions remain enabled = false', () => {
    // Preflight enabled guard.
    expect(FLAT_EXEC).toMatch(/enabled IS DISTINCT FROM false/i)
    // Both the preflight and post-verify enabled guards are present.
    expect((FLAT_EXEC.match(/enabled IS DISTINCT FROM false/gi) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('aborts (RAISE EXCEPTION) rather than silently overwriting on mismatch', () => {
    expect(FLAT_EXEC).toMatch(/Refusing to overwrite/i)
    expect((FLAT.match(/RAISE EXCEPTION/gi) || []).length).toBeGreaterThanOrEqual(5)
  })
})

describe('012 priority calibration — targets exactly three keys', () => {
  it('references exactly the three target opportunity keys as calibration targets', () => {
    for (const k of TARGET_KEYS) {
      expect(FLAT_EXEC).toContain(k)
    }
  })

  it('does NOT change vip_reactivation (asserts it stays priority 1)', () => {
    expect(FLAT_EXEC).toMatch(/vip_reactivation/i)
    expect(FLAT_EXEC).toMatch(/v_prio_vipr IS DISTINCT FROM 1/i)
    // vip_reactivation must never appear as an UPDATE target (CASE WHEN arm or
    // WHERE opportunity_key = 'vip_reactivation' inside the UPDATE).
    const updateBlock = FLAT.slice(FLAT.indexOf('UPDATE public.marketing_opportunity_definitions'), FLAT.indexOf('RETURNING'))
    expect(updateBlock).not.toContain('vip_reactivation')
  })

  it('the UPDATE WHERE clause is scoped to only the three target keys', () => {
    const updateBlock = FLAT.slice(
      FLAT.indexOf('UPDATE public.marketing_opportunity_definitions'),
      FLAT.indexOf('RETURNING'),
    )
    const keysInUpdate = TARGET_KEYS.filter((k) => updateBlock.includes(k))
    expect(keysInUpdate.sort()).toEqual([...TARGET_KEYS].sort())
    // No OTHER opportunity_key literal appears in the UPDATE.
    const otherKeys = [
      'vip_reactivation',
      'lapsed_30_days',
      'personal_cadence_overdue',
      'reveal_affinity_campaign',
      'vip_early_access',
      'promotion_match',
    ]
    for (const k of otherKeys) {
      expect(updateBlock).not.toContain(k)
    }
  })
})

describe('012 priority calibration — exact before -> after expectations', () => {
  const updateBlock = FLAT.slice(
    FLAT.indexOf('UPDATE public.marketing_opportunity_definitions'),
    FLAT.indexOf('RETURNING'),
  )

  it('high_value_customer_at_risk: 2 -> 1', () => {
    expect(updateBlock).toMatch(/WHEN 'high_value_customer_at_risk'\s+THEN 1/)
    expect(updateBlock).toMatch(/opportunity_key = 'high_value_customer_at_risk'\s+AND d\.default_priority = 2/)
  })

  it('vip_relevant_campaign: 1 -> 4', () => {
    expect(updateBlock).toMatch(/WHEN 'vip_relevant_campaign'\s+THEN 4/)
    expect(updateBlock).toMatch(/opportunity_key = 'vip_relevant_campaign'\s+AND d\.default_priority = 1/)
  })

  it('reactivated_customer_follow_up: 4 -> 3', () => {
    expect(updateBlock).toMatch(/WHEN 'reactivated_customer_follow_up'\s+THEN 3/)
    expect(updateBlock).toMatch(/opportunity_key = 'reactivated_customer_follow_up'\s+AND d\.default_priority = 4/)
  })

  it('post-update verification asserts the final priorities 1 / 4 / 3', () => {
    expect(FLAT_EXEC).toMatch(
      /v_prio_hvar IS DISTINCT FROM 1\s+OR v_prio_vrc\s+IS DISTINCT FROM 4\s+OR v_prio_rcfu IS DISTINCT FROM 3/i,
    )
  })

  it('asserts exactly three rows were recalibrated', () => {
    expect(FLAT_EXEC).toMatch(/count\(\*\) FROM calibrated\) <> 3/i)
  })
})

describe('012 priority calibration — changes NOTHING else', () => {
  it('only column mutated is default_priority (plus conventional updated_at)', () => {
    // The single SET clause: default_priority + updated_at, nothing else.
    expect(FLAT_EXEC).toMatch(/SET default_priority = CASE/i)
    expect(FLAT_EXEC).toMatch(/updated_at = now\(\)/i)
    // No forbidden columns are ever assigned.
    for (const col of [
      'default_score',
      'family',
      'campaign_specific',
      'display_name',
      'description',
    ]) {
      expect(new RegExp(`\\b${col}\\s*=`, 'i').test(EXEC)).toBe(false)
    }
    // enabled is never assigned (only read/asserted).
    expect(/\benabled\s*=(?!=)/i.test(EXEC)).toBe(false)
  })

  it('does NOT enable any definition', () => {
    expect(/SET[^;]*enabled\s*=\s*true/i.test(FLAT_EXEC)).toBe(false)
    expect(/enabled\s*=\s*true/i.test(FLAT_EXEC)).toBe(false)
  })

  it('performs NO INSERT and NO DELETE anywhere', () => {
    expect(/\bINSERT\s+INTO\b/i.test(EXEC)).toBe(false)
    expect(/\bDELETE\s+FROM\b/i.test(EXEC)).toBe(false)
    expect(/\bTRUNCATE\b/i.test(EXEC)).toBe(false)
  })

  it('writes NO opportunity / recipient / automation-run rows', () => {
    // The only UPDATE target is the definitions table.
    const updates = FLAT_EXEC.match(/UPDATE\s+public\.\w+/gi) || []
    expect(updates).toEqual(['UPDATE public.marketing_opportunity_definitions'])
    // These operational tables must never be written.
    for (const t of [
      'marketing_opportunities',
      'marketing_opportunity_recipients',
      'marketing_automation_runs',
      'marketing_recipients',
    ]) {
      expect(new RegExp(`(INSERT INTO|UPDATE|DELETE FROM)\\s+public\\.${t}\\b`, 'i').test(FLAT_EXEC)).toBe(false)
    }
  })

  it('does NOT mutate marketing_control_state (reads only)', () => {
    expect(/UPDATE\s+public\.marketing_control_state/i.test(FLAT_EXEC)).toBe(false)
    expect(/INSERT\s+INTO\s+public\.marketing_control_state/i.test(FLAT_EXEC)).toBe(false)
    expect(/DELETE\s+FROM\s+public\.marketing_control_state/i.test(FLAT_EXEC)).toBe(false)
  })

  it('creates / alters / drops NO schema objects', () => {
    expect(/\bCREATE\s+(TABLE|INDEX|FUNCTION|TRIGGER|EXTENSION|VIEW|POLICY|TYPE)\b/i.test(EXEC)).toBe(false)
    expect(/\bALTER\s+TABLE\b/i.test(EXEC)).toBe(false)
    expect(/\bDROP\s+/i.test(EXEC)).toBe(false)
  })

  it('adds NO AI, NO email/Resend, NO cron', () => {
    expect(/\b(openai|anthropic|ai_gateway|generatetext|streamtext|embeddings?|gpt|llm)\b/i.test(EXEC_NOSTR)).toBe(false)
    expect(/\b(resend|smtp|sendmail|nodemailer|mailgun|send_email)\b/i.test(EXEC_NOSTR)).toBe(false)
    expect(/\b(cron|pg_cron|cron\.schedule)\b/i.test(EXEC_NOSTR)).toBe(false)
  })

  it('touches NO checkout / payment / ticket / wallet / customer-facing tables', () => {
    for (const t of [
      'checkout_intents',
      'instant_win_awards',
      'wallet_transactions',
      'wallet_reservations',
      'orders',
      'tickets',
    ]) {
      expect(new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\s+public\\.${t}\\b`, 'i').test(FLAT_EXEC)).toBe(false)
    }
  })
})

describe('012 priority calibration — migrations 001-011 untouched', () => {
  it('is migration 012 and only references 001-011 as a dependency note', () => {
    expect(CODE).toMatch(/Migration 012/i)
    // The only executable table this migration writes is the definitions table;
    // it does not re-run or rewrite any earlier migration object.
    const updates = FLAT_EXEC.match(/UPDATE\s+public\.\w+/gi) || []
    expect(updates).toEqual(['UPDATE public.marketing_opportunity_definitions'])
  })

  it('does not DROP/CREATE/ALTER anything defined by earlier migrations', () => {
    expect(/\b(DROP|CREATE|ALTER)\b/i.test(EXEC)).toBe(false)
  })
})
