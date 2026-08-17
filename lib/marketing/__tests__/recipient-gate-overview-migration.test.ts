import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Static contract tests for
//   scripts/marketing/017-marketing-recipient-gate-overview.sql
//
// These tests treat the migration as STATIC TEXT: they never open a database
// connection, never execute SQL, and never mutate anything. They prove Stage
// 3D1 installs exactly ONE service-role-only, READ-ONLY RPC that reports how the
// opportunity ledger is filtered by the customer_marketing_profiles gate; that
// installation performs no writes; that the snapshot gate is treated as advisory
// only; and that no PII is exposed.
// ---------------------------------------------------------------------------

const CODE = readFileSync(
  join(process.cwd(), 'scripts/marketing/017-marketing-recipient-gate-overview.sql'),
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
// behaviour bans cannot be satisfied by prose inside RAISE / string messages.
// (Preserve jsonb key literals separately via FLAT_EXEC where needed.)
const EXEC_NOSTR = EXEC.replace(/'(?:[^']|'')*'/g, "''")
const FLAT_EXEC_NOSTR = EXEC_NOSTR.replace(/\s+/g, ' ')

// Install-level executable text = executable SQL with EVERY dollar-quoted block
// removed. What remains is exactly what the migration runs at install time.
const INSTALL_EXEC = EXEC.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, ' <<DOLLAR_BLOCK>> ')
const FLAT_INSTALL_EXEC = INSTALL_EXEC.replace(/\s+/g, ' ')

// Extract the single CREATE OR REPLACE FUNCTION body (between its AS $$ and $$;).
function fnBody(name: string): string {
  const headIdx = EXEC.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`)
  if (headIdx < 0) return ''
  const asIdx = EXEC.indexOf('AS $$', headIdx)
  if (asIdx < 0) return ''
  const endIdx = EXEC.indexOf('$$;', asIdx)
  if (endIdx < 0) return ''
  return EXEC.slice(asIdx + 'AS $$'.length, endIdx)
}

const OVERVIEW_BODY = fnBody('get_admin_marketing_recipient_gate_overview()')
const FLAT_OVERVIEW = OVERVIEW_BODY.replace(/\s+/g, ' ')

// The install preflight DO block.
const _pfStart = EXEC.indexOf('DO $preflight$')
const _pfEnd = EXEC.indexOf('$preflight$;', _pfStart)
const PREFLIGHT_BODY = _pfStart >= 0 && _pfEnd >= 0 ? EXEC.slice(_pfStart, _pfEnd) : ''

describe('017 — file & transaction shape', () => {
  it('locates the function body and preflight', () => {
    expect(OVERVIEW_BODY.length).toBeGreaterThan(0)
    expect(PREFLIGHT_BODY.length).toBeGreaterThan(0)
  })

  it('is wrapped in a single BEGIN/COMMIT', () => {
    expect((FLAT_EXEC.match(/\bBEGIN\b/g) || []).length).toBeGreaterThanOrEqual(1)
    expect(FLAT_EXEC.trimEnd().endsWith('COMMIT;')).toBe(true)
    // Exactly one COMMIT and no ROLLBACK.
    expect((FLAT_EXEC.match(/\bCOMMIT;/g) || []).length).toBe(1)
    expect(/\bROLLBACK\b/i.test(FLAT_EXEC)).toBe(false)
  })

  it('sets conservative lock/statement timeouts at install', () => {
    expect(/SET LOCAL lock_timeout = '5s'/i.test(FLAT_EXEC)).toBe(true)
    expect(/SET LOCAL statement_timeout = '30s'/i.test(FLAT_EXEC)).toBe(true)
  })

  it('creates EXACTLY ONE function', () => {
    const creates = FLAT_EXEC.match(/CREATE OR REPLACE FUNCTION/gi) || []
    expect(creates.length).toBe(1)
  })
})

describe('017 — security & privilege hardening', () => {
  it('is SECURITY DEFINER with a fixed search_path and a bounded statement_timeout', () => {
    expect(/SECURITY DEFINER/i.test(FLAT_EXEC)).toBe(true)
    expect(/SET search_path = public, pg_temp/i.test(FLAT_EXEC)).toBe(true)
    expect(/SET statement_timeout = '10s'/i.test(FLAT_EXEC)).toBe(true)
  })

  it('is declared STABLE (no side effects)', () => {
    expect(/RETURNS jsonb\s+LANGUAGE sql\s+STABLE/i.test(FLAT_EXEC)).toBe(true)
  })

  it('revokes from public/anon/authenticated and grants only to service_role', () => {
    expect(
      /REVOKE ALL ON FUNCTION public\.get_admin_marketing_recipient_gate_overview\(\) FROM public, anon, authenticated/i.test(
        FLAT_EXEC,
      ),
    ).toBe(true)
    expect(
      /GRANT EXECUTE ON FUNCTION public\.get_admin_marketing_recipient_gate_overview\(\) TO service_role/i.test(
        FLAT_EXEC,
      ),
    ).toBe(true)
    // No broad grant to anon/authenticated/public.
    expect(/GRANT EXECUTE ON FUNCTION[^;]*TO (anon|authenticated|public)/i.test(FLAT_EXEC)).toBe(false)
  })
})

describe('017 — install-time is INERT (read-only)', () => {
  it('performs NO writes at install (outside the function body)', () => {
    expect(/\bINSERT\b/i.test(FLAT_INSTALL_EXEC)).toBe(false)
    expect(/\bUPDATE\b/i.test(FLAT_INSTALL_EXEC)).toBe(false)
    expect(/\bDELETE\b/i.test(FLAT_INSTALL_EXEC)).toBe(false)
    expect(/\bTRUNCATE\b/i.test(FLAT_INSTALL_EXEC)).toBe(false)
    expect(/REFRESH MATERIALIZED VIEW/i.test(FLAT_INSTALL_EXEC)).toBe(false)
  })

  it('contains NO write statements ANYWHERE in executable SQL (the RPC is read-only)', () => {
    expect(/\bINSERT\s+INTO\b/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/\bUPDATE\s+public\./i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/\bDELETE\s+FROM\b/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/\bTRUNCATE\b/i.test(FLAT_EXEC_NOSTR)).toBe(false)
  })

  it('preflight only checks existence of the two read dependencies and mutates nothing', () => {
    expect(/to_regclass/i.test(PREFLIGHT_BODY)).toBe(true)
    expect(/public\.marketing_opportunities/i.test(PREFLIGHT_BODY)).toBe(true)
    expect(/public\.customer_marketing_profiles/i.test(PREFLIGHT_BODY)).toBe(true)
    expect(/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(PREFLIGHT_BODY)).toBe(false)
  })

  it('does NOT enable sending/discovery, change rollout, or touch definitions/control/profiles', () => {
    expect(/sending_enabled\s*=\s*true/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/discovery_enabled\s*=\s*true/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/rollout_limit\s*=/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/marketing_control_state/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/marketing_opportunity_definitions/i.test(FLAT_EXEC_NOSTR)).toBe(false)
  })

  it('does NOT create recipients/runs, send email, or add cron/AI', () => {
    expect(/marketing_recipients/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/marketing_automation_runs/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(/\bresend\b|\bsmtp\b|send_email|cron|pg_cron/i.test(FLAT_EXEC_NOSTR)).toBe(false)
  })
})

describe('017 — reads only the two intended tables', () => {
  it('FROM/JOIN reference only marketing_opportunities and customer_marketing_profiles', () => {
    const froms = FLAT_OVERVIEW.match(/\b(?:FROM|JOIN)\s+public\.[a-z_]+/gi) || []
    expect(froms.length).toBeGreaterThan(0)
    for (const f of froms) {
      expect(/public\.(marketing_opportunities|customer_marketing_profiles)/i.test(f)).toBe(true)
    }
  })

  it('joins profiles by user_id via LEFT JOIN (fail-closed for unmatched rows)', () => {
    expect(/LEFT JOIN public\.customer_marketing_profiles p\b/i.test(FLAT_OVERVIEW)).toBe(true)
    expect(/ON p\.user_id = o\.user_id/i.test(FLAT_OVERVIEW)).toBe(true)
    // Inner per-type aggregate also uses a LEFT JOIN on user_id.
    expect(/LEFT JOIN public\.customer_marketing_profiles p2[\s\S]*ON p2\.user_id = o2\.user_id/i.test(OVERVIEW_BODY)).toBe(
      true,
    )
  })
})

describe('017 — gate semantics are faithful & null-safe', () => {
  it('exposes every planning counter key', () => {
    for (const key of [
      'totalOpportunities',
      'profileMatched',
      'profileUnmatched',
      'permissionBacked',
      'sendableSnapshot',
      'suppressed',
      'marketingDisabled',
      'inactiveAccount',
      'unconfirmedEmail',
      'byOpportunityType',
    ]) {
      expect(FLAT_OVERVIEW.includes(`'${key}'`)).toBe(true)
    }
  })

  it('permissionBacked = opted-in AND not actively suppressed', () => {
    expect(
      /'permissionBacked',\s*count\(\*\) FILTER \(\s*WHERE p\.marketing_enabled = true\s*AND p\.has_active_suppression = false\s*\)/i.test(
        FLAT_OVERVIEW,
      ),
    ).toBe(true)
  })

  it('sendableSnapshot uses the cached snapshot AND not-suppressed (advisory only)', () => {
    expect(
      /'sendableSnapshot',\s*count\(\*\) FILTER \(\s*WHERE p\.marketing_eligible_snapshot = true\s*AND p\.has_active_suppression = false\s*\)/i.test(
        FLAT_OVERVIEW,
      ),
    ).toBe(true)
  })

  it('drop-out counters reference the correct gate columns', () => {
    expect(/'suppressed',\s*count\(\*\) FILTER \(\s*WHERE p\.has_active_suppression = true\s*\)/i.test(FLAT_OVERVIEW)).toBe(
      true,
    )
    expect(/p\.marketing_enabled = false/i.test(FLAT_OVERVIEW)).toBe(true)
    expect(/p\.account_active = false/i.test(FLAT_OVERVIEW)).toBe(true)
    expect(/p\.email_confirmed = false/i.test(FLAT_OVERVIEW)).toBe(true)
  })

  it('profileMatched/Unmatched partition on the join key presence', () => {
    expect(/'profileMatched',\s*count\(\*\) FILTER \(\s*WHERE p\.user_id IS NOT NULL\s*\)/i.test(FLAT_OVERVIEW)).toBe(true)
    expect(/'profileUnmatched',\s*count\(\*\) FILTER \(\s*WHERE p\.user_id IS NULL\s*\)/i.test(FLAT_OVERVIEW)).toBe(true)
  })

  it('positive gate counters are boolean-equality FILTERs (NULL from unmatched rows never counts)', () => {
    // Every positive counter compares a LEFT-JOINed boolean to true/false, so an
    // unmatched (NULL) profile row is excluded — fail-closed by construction.
    for (const frag of [
      'p.marketing_enabled = true',
      'p.marketing_eligible_snapshot = true',
      'p.has_active_suppression = false',
    ]) {
      expect(FLAT_OVERVIEW.includes(frag)).toBe(true)
    }
  })

  it('byOpportunityType is sourced dynamically from the ledger and ordered deterministically', () => {
    expect(/GROUP BY o2\.opportunity_type/i.test(FLAT_OVERVIEW)).toBe(true)
    expect(/jsonb_object_agg\([\s\S]*ORDER BY x\.opportunity_type/i.test(OVERVIEW_BODY)).toBe(true)
    // Empty ledger yields an object, not NULL.
    expect(/COALESCE\(\s*\(\s*SELECT jsonb_object_agg[\s\S]*'\{\}'::jsonb\s*\)/i.test(OVERVIEW_BODY)).toBe(true)
  })
})

describe('017 — privacy (no PII in output)', () => {
  it('never emits identity/contact fields as JSON output keys', () => {
    for (const key of ['email', 'email_lc', 'external_contact_id', 'dedupe_key', 'customerHash']) {
      // As a jsonb key literal.
      expect(FLAT_OVERVIEW.includes(`'${key}'`)).toBe(false)
    }
  })

  it('does not select raw user_id / reason / context values into the payload', () => {
    // user_id appears ONLY inside join/NULL predicates, never as an output key.
    expect(FLAT_OVERVIEW.includes("'user_id'")).toBe(false)
    expect(/->>\s*'reason'|->>\s*'context/i.test(FLAT_OVERVIEW)).toBe(false)
    expect(/jsonb_build_object\([^)]*reason/i.test(FLAT_OVERVIEW)).toBe(false)
  })
})

describe('017 — documentation honesty', () => {
  it('documents that sendableSnapshot is advisory / non-authoritative for sending', () => {
    expect(/not authoritative for sending|advisory only|NOT a send/i.test(CODE)).toBe(true)
    expect(/is_marketing_email_eligible/i.test(CODE)).toBe(true)
  })

  it('has a COMMENT ON FUNCTION describing the RPC as read-only & service-role only', () => {
    expect(/COMMENT ON FUNCTION public\.get_admin_marketing_recipient_gate_overview\(\)/i.test(FLAT)).toBe(true)
    expect(/Service-role only/i.test(FLAT)).toBe(true)
    expect(/No writes/i.test(FLAT)).toBe(true)
  })
})
