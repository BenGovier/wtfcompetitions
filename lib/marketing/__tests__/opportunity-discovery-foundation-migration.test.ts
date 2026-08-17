import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Static contract tests for
//   scripts/marketing/013-marketing-opportunity-discovery-foundation.sql
//
// These tests treat the migration as STATIC TEXT. They never open a database
// connection, never execute SQL, and never mutate anything. They assert that
// the Stage 3C2F persistence engine installs INERTLY, persists only inside the
// explicitly invoked discovery RPC, is correctly gated, bounded, set-based,
// idempotent against the EXISTING schema, service_role-only, and changes no
// control/definition/send state.
// ---------------------------------------------------------------------------

const CODE = readFileSync(
  join(process.cwd(), 'scripts/marketing/013-marketing-opportunity-discovery-foundation.sql'),
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
// behaviour bans cannot be satisfied by prose inside COMMENT ON / RAISE strings.
const EXEC_NOSTR = EXEC.replace(/'(?:[^']|'')*'/g, "''")

// The discovery function body, isolated between the AS $$ ... $$ delimiters of
// the executable text. Persistence must live ENTIRELY inside this body.
const _bodyStart = FLAT_EXEC.indexOf('AS $$')
const _bodyEnd = FLAT_EXEC.indexOf('$$;', _bodyStart)
const FN_BODY = _bodyStart >= 0 && _bodyEnd >= 0 ? FLAT_EXEC.slice(_bodyStart, _bodyEnd) : ''

// The migration text OUTSIDE any function body (install-time statements): the
// executable text with the function body removed.
const OUTSIDE_FN =
  _bodyStart >= 0 && _bodyEnd >= 0
    ? FLAT_EXEC.slice(0, _bodyStart) + FLAT_EXEC.slice(_bodyEnd)
    : FLAT_EXEC

describe('013 discovery — transaction & inert install', () => {
  it('runs inside a single BEGIN/COMMIT transaction', () => {
    expect(FLAT_EXEC).toMatch(/^\s*BEGIN;/)
    expect(FLAT_EXEC).toMatch(/COMMIT;\s*$/)
  })

  it('sets LOCAL lock_timeout and statement_timeout for a busy production DB', () => {
    expect(FLAT_EXEC).toMatch(/SET LOCAL lock_timeout/i)
    expect(FLAT_EXEC).toMatch(/SET LOCAL statement_timeout/i)
  })

  it('creates exactly one function and only a TEMP working table (no persistent table)', () => {
    const creates = FLAT_EXEC.match(/CREATE (OR REPLACE )?FUNCTION/gi) || []
    expect(creates.length).toBe(1)
    // The only CREATE TABLE is the ON COMMIT DROP temp table inside the body.
    const tableCreates = FLAT_EXEC.match(/CREATE\s+(TEMP\s+)?TABLE/gi) || []
    expect(tableCreates.length).toBe(1)
    expect(FN_BODY).toMatch(/CREATE TEMP TABLE tmp_disc_winners ON COMMIT DROP/i)
  })
})

describe('013 discovery — installation performs NO opportunity INSERT itself', () => {
  it('the only INSERT INTO marketing_opportunities lives inside the function body', () => {
    const allInserts = FLAT_EXEC.match(/INSERT INTO public\.marketing_opportunities/gi) || []
    expect(allInserts.length).toBe(1)
    // ...and it is inside the function body, not at migration top level.
    expect(FN_BODY).toMatch(/INSERT INTO public\.marketing_opportunities/i)
    expect(OUTSIDE_FN).not.toMatch(/INSERT INTO public\.marketing_opportunities/i)
  })

  it('performs no INSERT/UPDATE into control-state or definitions at install time', () => {
    expect(OUTSIDE_FN).not.toMatch(/INSERT INTO public\.marketing_control_state/i)
    expect(OUTSIDE_FN).not.toMatch(/UPDATE public\.marketing_control_state/i)
    expect(OUTSIDE_FN).not.toMatch(/INSERT INTO public\.marketing_opportunity_definitions/i)
    expect(OUTSIDE_FN).not.toMatch(/UPDATE public\.marketing_opportunity_definitions/i)
  })
})

describe('013 discovery — persistence occurs ONLY inside the invoked RPC', () => {
  it('defines the bounded discovery RPC discover_marketing_opportunities(p_limit)', () => {
    expect(FLAT_EXEC).toMatch(
      /CREATE OR REPLACE FUNCTION public\.discover_marketing_opportunities\(p_limit integer DEFAULT 100\)/i,
    )
  })

  it('the INSERT is inside discover_marketing_opportunities, not a free-standing statement', () => {
    // Function body contains the persistence; there is no top-level INSERT.
    expect(FN_BODY).toMatch(/INSERT INTO public\.marketing_opportunities/i)
  })
})

describe('013 discovery — discovery_enabled gate required before writes', () => {
  it('reads discovery_enabled from the control-state singleton (key = default)', () => {
    expect(FLAT_EXEC).toMatch(/SELECT discovery_enabled\s+INTO/i)
    expect(FLAT_EXEC).toMatch(/FROM public\.marketing_control_state\s+WHERE key = 'default'/i)
  })

  it('short-circuits to discovery_disabled with zero inserts when not enabled', () => {
    expect(FLAT).toMatch(/'status', 'discovery_disabled'/)
    expect(FN_BODY).toMatch(/v_discovery IS DISTINCT FROM true/i)
  })

  it('does NOT require sending_enabled for discovery', () => {
    // The gate checks discovery only; sending_enabled is never read in the body.
    expect(FN_BODY).not.toMatch(/sending_enabled/i)
  })
})

describe('013 discovery — per-definition enabled=true required before writes', () => {
  it('joins definitions and requires enabled = true for eligibility', () => {
    expect(FLAT_EXEC).toMatch(/JOIN public\.marketing_opportunity_definitions/i)
    expect(FN_BODY).toMatch(/d\.enabled, false\) = true/i)
  })
})

describe('013 discovery — only rn = 1 winners are persisted', () => {
  it('filters the detector output to rn = 1', () => {
    expect(FN_BODY).toMatch(/WHERE c\.rn = 1/i)
  })
})

describe('013 discovery — permission / sendability does NOT filter discovery', () => {
  it('never filters candidates on permission or sendability signals', () => {
    for (const banned of [
      'perm_backed',
      'perm_suppressed',
      'perm_not_backed',
      'sendable_now',
      'marketing_enabled',
      'marketing_eligible_snapshot',
    ]) {
      expect(FN_BODY.includes(banned)).toBe(false)
    }
  })
})

describe('013 discovery — bounded execution', () => {
  it('p_limit defaults to 100', () => {
    expect(FLAT_EXEC).toMatch(/p_limit integer DEFAULT 100/i)
  })

  it('clamps p_limit to a hard maximum of 500 (and minimum of 1)', () => {
    expect(FN_BODY).toMatch(/LEAST\(GREATEST\(COALESCE\(p_limit, 100\), 1\), 500\)/i)
  })

  it('applies a LIMIT to the persisted set', () => {
    expect(FN_BODY).toMatch(/LIMIT v_limit/i)
  })

  it('orders deterministically before limiting', () => {
    expect(FN_BODY).toMatch(/ORDER BY w\.final_score DESC, w\.default_priority ASC, w\.user_id ASC/i)
  })
})

describe('013 discovery — set-based, no per-customer loop, no history scan', () => {
  it('uses a single set-based INSERT ... SELECT (no LOOP)', () => {
    expect(FN_BODY).toMatch(/INSERT INTO public\.marketing_opportunities[\s\S]*SELECT/i)
    expect(/\bLOOP\b/i.test(FN_BODY)).toBe(false)
    expect(/\bFOR\b\s+\w+\s+IN/i.test(FN_BODY)).toBe(false)
  })

  it('reuses the 011 detector and does not re-scan operational history', () => {
    expect(FN_BODY).toMatch(/public\.wtf_marketing_opportunity_candidates_preview\(\)/i)
    for (const banned of [
      'checkout_intents',
      'instant_win_awards',
      'wallet_transactions',
      'auth.users',
    ]) {
      expect(FLAT_EXEC.includes(banned)).toBe(false)
    }
  })
})

describe('013 discovery — campaign_specific invariant preserved', () => {
  it('requires campaign_id when the definition is campaign_specific', () => {
    expect(FN_BODY).toMatch(
      /campaign_specific, false\) = false OR c\.campaign_id IS NOT NULL/i,
    )
  })

  it('persists the candidate real campaign_id (not invented)', () => {
    expect(FN_BODY).toMatch(/tp\.campaign_id/i)
  })
})

describe('013 discovery — idempotency / dedupe uses the EXISTING schema', () => {
  it('relies on ON CONFLICT (dedupe_key) against the existing unique index', () => {
    expect(FN_BODY).toMatch(/ON CONFLICT \(dedupe_key\) DO NOTHING/i)
  })

  it('guards against duplicate ACTIVE opportunities via NOT EXISTS', () => {
    expect(FN_BODY).toMatch(/NOT EXISTS/i)
    expect(FN_BODY).toMatch(/o\.state IN \('open', 'selected', 'deferred'\)/i)
    expect(FN_BODY).toMatch(/o\.campaign_id IS NOT DISTINCT FROM/i)
  })

  it('builds a deterministic, date-bucketed dedupe_key enabling later recurrence', () => {
    expect(FN_BODY).toMatch(/'discv1:'/)
    expect(FN_BODY).toMatch(/to_char\(\(v_now AT TIME ZONE 'UTC'\)::date, 'YYYYMMDD'\)/i)
  })

  it('does not create a new unique index or alter the opportunity schema', () => {
    expect(/CREATE\s+UNIQUE\s+INDEX/i.test(FLAT_EXEC)).toBe(false)
    expect(/ALTER\s+TABLE\s+public\.marketing_opportunities/i.test(FLAT_EXEC)).toBe(false)
  })
})

describe('013 discovery — advisory / concurrency protection', () => {
  it('serialises runs with a transaction advisory lock and returns locked when busy', () => {
    expect(FN_BODY).toMatch(/pg_try_advisory_xact_lock\(hashtext\('wtf_marketing_stage_3c2f_discovery_run'\)\)/i)
    expect(FLAT).toMatch(/'status', 'locked'/)
  })

  it('sets lock_timeout and statement_timeout on the function', () => {
    expect(FLAT_EXEC).toMatch(/SET lock_timeout = '5s'/i)
    expect(FLAT_EXEC).toMatch(/SET statement_timeout = '30s'/i)
  })
})

describe('013 discovery — security: SECURITY DEFINER, service_role only', () => {
  it('is SECURITY DEFINER with a fixed search_path', () => {
    expect(FLAT_EXEC).toMatch(/SECURITY DEFINER/i)
    expect(FLAT_EXEC).toMatch(/SET search_path = public, pg_temp/i)
  })

  it('revokes execute from public/anon/authenticated and grants only service_role', () => {
    expect(FLAT_EXEC).toMatch(
      /REVOKE ALL ON FUNCTION public\.discover_marketing_opportunities\(integer\) FROM public, anon, authenticated/i,
    )
    expect(FLAT_EXEC).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.discover_marketing_opportunities\(integer\) TO service_role/i,
    )
  })

  it('does not weaken RLS or grants on marketing_opportunities', () => {
    expect(/DISABLE ROW LEVEL SECURITY/i.test(FLAT_EXEC)).toBe(false)
    expect(/NO FORCE ROW LEVEL SECURITY/i.test(FLAT_EXEC)).toBe(false)
    expect(/GRANT[\s\S]*ON public\.marketing_opportunities/i.test(FLAT_EXEC)).toBe(false)
    expect(/CREATE POLICY/i.test(FLAT_EXEC)).toBe(false)
  })
})

describe('013 discovery — control-state / definition enablement untouched', () => {
  it('never enables discovery, sending, definitions, or changes rollout_limit', () => {
    expect(/UPDATE public\.marketing_control_state/i.test(EXEC_NOSTR)).toBe(false)
    expect(/discovery_enabled\s*=\s*true/i.test(EXEC_NOSTR)).toBe(false)
    expect(/sending_enabled\s*=\s*true/i.test(EXEC_NOSTR)).toBe(false)
    expect(/rollout_limit\s*=\s*[1-9]/i.test(EXEC_NOSTR)).toBe(false)
    expect(/SET\s+enabled\s*=\s*true/i.test(EXEC_NOSTR)).toBe(false)
  })
})

describe('013 discovery — no recipient/run/email/cron/AI behaviour', () => {
  it('creates no recipients, runs, email, cron, or AI calls', () => {
    for (const banned of [
      'marketing_recipients',
      'marketing_runs',
      'resend',
      'cron',
      'openai',
      'ai_gateway',
    ]) {
      expect(FLAT_EXEC.toLowerCase().includes(banned)).toBe(false)
    }
  })
})

describe('013 discovery — identity: user-only, no external contact yet', () => {
  it('persists user_id and sets external_contact_id NULL (identity XOR preserved)', () => {
    expect(FN_BODY).toMatch(/tp\.user_id/i)
    // external_contact_id column is inserted as NULL.
    expect(FN_BODY).toMatch(/external_contact_id/i)
    expect(FN_BODY).not.toMatch(/marketing_external_contacts/i)
  })
})

describe('013 discovery — result contract returns no raw identity', () => {
  it('returns the required compact stat keys', () => {
    for (const key of [
      "'ok'",
      "'status'",
      "'evaluated'",
      "'eligible'",
      "'inserted'",
      "'skippedExisting'",
      "'skippedDisabledDefinition'",
      "'durationMs'",
      "'generatedAt'",
    ]) {
      expect(FLAT.includes(key)).toBe(true)
    }
  })

  it('never returns user_id or email in the result JSON', () => {
    // The RETURN jsonb_build_object payloads must not surface identities.
    const returns = FN_BODY.match(/RETURN jsonb_build_object\([\s\S]*?\);/gi) || []
    expect(returns.length).toBeGreaterThanOrEqual(3)
    for (const r of returns) {
      expect(/user_id/i.test(r)).toBe(false)
      expect(/email/i.test(r)).toBe(false)
    }
  })
})

describe('013 discovery — install-time preflight proves the hub is still paused/inert', () => {
  it('asserts required dependencies and the 011 detector exist', () => {
    for (const dep of [
      'public.marketing_opportunities',
      'public.marketing_opportunity_definitions',
      'public.marketing_control_state',
      'public.customer_marketing_profiles',
      'public.customer_marketing_intelligence',
      'public.customer_campaign_affinity',
    ]) {
      expect(FLAT.includes(dep)).toBe(true)
    }
    expect(FLAT_EXEC).toMatch(
      /to_regprocedure\('public\.wtf_marketing_opportunity_candidates_preview\(\)'\) IS NULL/i,
    )
  })

  it('requires paused control state (sending=false, discovery=false, rollout=0)', () => {
    expect(FN_PREFLIGHT()).toMatch(/v_sending IS DISTINCT FROM false/i)
    expect(FN_PREFLIGHT()).toMatch(/v_discovery IS DISTINCT FROM false/i)
    expect(FN_PREFLIGHT()).toMatch(/v_rollout\s+IS DISTINCT FROM 0/i)
  })

  it('requires zero enabled definitions and an empty opportunity ledger', () => {
    expect(FN_PREFLIGHT()).toMatch(/WHERE enabled = true/i)
    expect(FN_PREFLIGHT()).toMatch(/v_enabled_defs <> 0/i)
    expect(FN_PREFLIGHT()).toMatch(/count\(\*\) INTO v_opp_count FROM public\.marketing_opportunities/i)
    expect(FN_PREFLIGHT()).toMatch(/v_opp_count <> 0/i)
  })
})

// The install-time preflight DO block (first $preflight$ ... $preflight$).
function FN_PREFLIGHT(): string {
  const s = FLAT_EXEC.indexOf('$preflight$')
  const e = FLAT_EXEC.indexOf('$preflight$', s + 1)
  return s >= 0 && e >= 0 ? FLAT_EXEC.slice(s, e) : ''
}

describe('013 discovery — migrations 001-012 untouched', () => {
  it('references migrations 001-012 only as a dependency note, never edits them', () => {
    // This file only creates its own function; it does not DROP/ALTER earlier
    // objects or reference other migration files as editable.
    expect(/DROP\s+(TABLE|FUNCTION)\s+public\./i.test(EXEC.replace(/DROP TABLE IF EXISTS tmp_disc_winners;?/i, ''))).toBe(false)
    expect(/ALTER\s+TABLE\s+public\./i.test(FLAT_EXEC)).toBe(false)
  })
})
