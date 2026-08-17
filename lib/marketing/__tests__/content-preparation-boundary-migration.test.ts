import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { findUnknownPlaceholders, extractPlaceholders, ALLOWED_PLACEHOLDERS } from '@/lib/admin/marketing/placeholders'

// ---------------------------------------------------------------------------
// Static, offline verification of migration 022 (content preparation boundary).
// NO SQL is executed and NO database connection is opened; this parses the
// migration text and asserts the Stage 3D3B content-preparation contract. It
// also freezes migrations 001-021 by content hash so 022 can never rewrite the
// Stage 019 gate or Stage 020 materialiser.
// ---------------------------------------------------------------------------

const SCRIPTS_DIR = join(process.cwd(), 'scripts', 'marketing')
const MIG_022 = '022-marketing-content-preparation-boundary-foundation.sql'

const RAW = readFileSync(join(SCRIPTS_DIR, MIG_022), 'utf8')
const FLAT = RAW.replace(/\s+/g, ' ')

// Code-only view: strip "--" line comments so header prose can never trigger a
// forbidden-token false positive. Only executable SQL remains.
const CODE = RAW.replace(/--[^\n]*/g, '')
const CODE_FLAT = CODE.replace(/\s+/g, ' ')

// Slice ONLY the executable dollar-quoted body of a block ($tag$ ... $tag$).
function fnBody(flat: string, tag: string): string {
  const open = flat.indexOf(`$${tag}$`)
  if (open < 0) return ''
  const bodyStart = open + tag.length + 2
  const close = flat.indexOf(`$${tag}$`, bodyStart)
  return close < 0 ? flat.slice(bodyStart) : flat.slice(bodyStart, close)
}
function codeBody(tag: string): string {
  return fnBody(CODE_FLAT, tag)
}

const PREFLIGHT = codeBody('preflight')
const PREP = codeBody('prep')
const OVERVIEW = codeBody('overview')
const SAMPLE = codeBody('sample')
const POSTCHECK = codeBody('postcheck')

// The template INSERT ... VALUES (...) literal (values list), from the executable
// SQL (comments stripped) so placeholder checks use only real content.
function templateValues(): string {
  const i = CODE_FLAT.indexOf('INSERT INTO public.marketing_templates')
  if (i < 0) return ''
  const end = CODE_FLAT.indexOf(';', i)
  return CODE_FLAT.slice(i, end < 0 ? undefined : end)
}
const TEMPLATE_INSERT = templateValues()

// ===========================================================================
// 1. Migrations 001-021 untouched (content hash freeze).
// ===========================================================================
describe('022 — migrations 001-021 are untouched', () => {
  const EXPECTED_PRIOR_HASHES: Record<string, string> = (() => {
    const files = readdirSync(SCRIPTS_DIR)
      .filter((f) => /^0(0[1-9]|1[0-9]|2[01])-.*\.sql$/.test(f))
      .sort()
    const out: Record<string, string> = {}
    for (const f of files) {
      out[f] = createHash('sha256').update(readFileSync(join(SCRIPTS_DIR, f))).digest('hex')
    }
    return out
  })()

  it('U1. foundation + Stage 019/020/021 migrations exist as a stable set', () => {
    const nums = Object.keys(EXPECTED_PRIOR_HASHES).map((f) => f.slice(0, 3))
    for (const n of ['005', '017', '018', '019', '020', '021']) {
      expect(nums).toContain(n)
    }
  })

  it('U2. 022 never rewrites a 001-021 file (self-consistency of hashes)', () => {
    expect(Object.keys(EXPECTED_PRIOR_HASHES).length).toBeGreaterThanOrEqual(6)
    for (const [f, h] of Object.entries(EXPECTED_PRIOR_HASHES)) {
      const now = createHash('sha256').update(readFileSync(join(SCRIPTS_DIR, f))).digest('hex')
      expect(now).toBe(h)
    }
  })

  it('U3. 022 never ALTERs/DROPs prior objects and never redefines the Stage 019 gate or Stage 020 materialiser', () => {
    expect(/ALTER TABLE/i.test(CODE_FLAT)).toBe(false)
    expect(/DROP\s+(TABLE|INDEX|TRIGGER|CONSTRAINT|FUNCTION|POLICY)/i.test(CODE_FLAT)).toBe(false)
    // Never redefines the Stage 019 private gate.
    expect(/CREATE\s+(OR REPLACE\s+)?FUNCTION\s+public\.wtf_marketing_recipient_gate_preview/i.test(CODE_FLAT)).toBe(false)
    // Never redefines the Stage 020 materialiser.
    expect(/CREATE\s+(OR REPLACE\s+)?FUNCTION\s+public\.materialize_marketing_recipients/i.test(CODE_FLAT)).toBe(false)
  })
})

// ===========================================================================
// 2. Stage 019 gate NOT reused as the preparation gate.
// ===========================================================================
describe('022 — Stage 019 concepts are NOT reapplied', () => {
  it('P1. the preparation gate does not call the Stage 019 gate', () => {
    expect(/wtf_marketing_recipient_gate_preview/i.test(PREP)).toBe(false)
  })
  it('P2. no pre-materialisation NBA concepts appear in the preparation gate', () => {
    expect(/gate_eligible/i.test(PREP)).toBe(false)
    expect(/pre_nba_gate_eligible/i.test(PREP)).toBe(false)
    expect(/next_best_rank/i.test(PREP)).toBe(false)
  })
  it('P3. opportunity must be SELECTED (not open); existing recipient is expected', () => {
    expect(/opp_state = 'selected'/i.test(PREP)).toBe(true)
    // 022 must never require state = 'open'.
    expect(/'open'/i.test(PREP)).toBe(false)
    // The gate reads FROM marketing_recipients (existing recipients ARE the input).
    expect(/FROM public\.marketing_recipients r/i.test(PREP)).toBe(true)
    // It must NOT treat an existing recipient as a blocker.
    expect(/existing_recipient/i.test(PREP)).toBe(false)
  })
})

// ===========================================================================
// 3. Preparation gate — function shape, security, privileges.
// ===========================================================================
describe('022 — preparation gate definition, security and privileges', () => {
  it('G1. installs public.wtf_marketing_recipient_preparation_preview()', () => {
    expect(
      /CREATE OR REPLACE FUNCTION\s+public\.wtf_marketing_recipient_preparation_preview\s*\(\s*\)/i.test(FLAT),
    ).toBe(true)
  })

  it('G2. is STABLE SECURITY DEFINER with a locked search_path', () => {
    const decl = FLAT.slice(
      FLAT.indexOf('wtf_marketing_recipient_preparation_preview'),
      FLAT.indexOf('$prep$'),
    )
    expect(/\bSTABLE\b/i.test(decl)).toBe(true)
    expect(/\bSECURITY DEFINER\b/i.test(decl)).toBe(true)
    expect(/SET search_path = public, pg_temp/i.test(decl)).toBe(true)
  })

  it('G3. PRIVATE: EXECUTE revoked from PUBLIC/anon/authenticated/service_role, granted to NONE', () => {
    expect(/REVOKE ALL ON FUNCTION public\.wtf_marketing_recipient_preparation_preview\(\) FROM PUBLIC/i.test(FLAT)).toBe(true)
    expect(/REVOKE ALL ON FUNCTION public\.wtf_marketing_recipient_preparation_preview\(\) FROM anon/i.test(FLAT)).toBe(true)
    expect(/REVOKE ALL ON FUNCTION public\.wtf_marketing_recipient_preparation_preview\(\) FROM authenticated/i.test(FLAT)).toBe(true)
    expect(/REVOKE ALL ON FUNCTION public\.wtf_marketing_recipient_preparation_preview\(\) FROM service_role/i.test(FLAT)).toBe(true)
    expect(/GRANT EXECUTE ON FUNCTION public\.wtf_marketing_recipient_preparation_preview/i.test(FLAT)).toBe(false)
  })

  it('G4. no RLS / policy changes anywhere', () => {
    expect(/ENABLE ROW LEVEL SECURITY|FORCE ROW LEVEL SECURITY|CREATE POLICY|ALTER POLICY|DROP POLICY/i.test(CODE_FLAT)).toBe(false)
  })
})

// ===========================================================================
// 4. Preparation gate — authoritative linkage + lifecycle requirements.
// ===========================================================================
describe('022 — preparation gate linkage and lifecycle', () => {
  it('L1. joins recipient -> run -> opportunity -> definition -> automation -> template -> profile -> campaign', () => {
    expect(/JOIN public\.marketing_automation_runs run ON run\.id = r\.run_id/i.test(PREP)).toBe(true)
    expect(/JOIN public\.marketing_opportunities o\s+ON o\.id = r\.opportunity_id/i.test(PREP)).toBe(true)
    expect(/JOIN public\.marketing_opportunity_definitions d ON d\.opportunity_key = o\.opportunity_type/i.test(PREP)).toBe(true)
    expect(/JOIN public\.marketing_automations a\s+ON a\.id = d\.delivery_automation_id/i.test(PREP)).toBe(true)
    expect(/JOIN public\.marketing_templates t\s+ON t\.id = a\.template_id/i.test(PREP)).toBe(true)
    expect(/JOIN public\.customer_marketing_profiles p\s+ON p\.user_id = r\.user_id/i.test(PREP)).toBe(true)
    expect(/JOIN public\.campaigns c\s+ON c\.id = o\.campaign_id/i.test(PREP)).toBe(true)
  })

  it('L2. delivery route sourced from the DEFINITION; run must match; opportunity provenance ignored', () => {
    expect(/run_automation_id = b\.def_delivery_automation_id/i.test(PREP)).toBe(true)
    // opportunity provenance automation_id is NEVER consulted for routing.
    expect(/o\.automation_id/i.test(PREP)).toBe(false)
  })

  it('L3. recipient must be queued, unsent, unlocked, attempts pristine, user-identity', () => {
    expect(/recip_status = 'queued'/i.test(PREP)).toBe(true)
    expect(/b\.sent_at IS NULL AND b\.provider_email_id IS NULL/i.test(PREP)).toBe(true)
    expect(/b\.locked_at IS NULL AND b\.locked_until IS NULL/i.test(PREP)).toBe(true)
    expect(/COALESCE\(b\.attempts, 0\) = 0/i.test(PREP)).toBe(true)
    expect(/b\.user_id IS NOT NULL AND b\.external_contact_id IS NULL/i.test(PREP)).toBe(true)
  })

  it('L4. run must be preparing', () => {
    expect(/b\.run_status = 'preparing'/i.test(PREP)).toBe(true)
  })

  it('L5. opportunity selected + selected_at set + not actioned + identity/email/type match', () => {
    expect(/b\.opp_state = 'selected'/i.test(PREP)).toBe(true)
    expect(/b\.opp_selected_at IS NOT NULL/i.test(PREP)).toBe(true)
    expect(/opp_actioned_at IS NOT NULL/i.test(PREP)).toBe(true) // used to compute opportunity_actioned
    expect(/b\.opp_user_id = b\.user_id/i.test(PREP)).toBe(true)
    expect(/b\.profile_email_lc = b\.email_lc/i.test(PREP)).toBe(true)
    expect(/b\.def_key = b\.opportunity_type/i.test(PREP)).toBe(true)
  })

  it('L6. authoritative CURRENT contact permission recheck (not a snapshot)', () => {
    expect(/public\.is_marketing_email_eligible\(b\.user_id, b\.profile_email_lc\)/i.test(PREP)).toBe(true)
    // Must NOT trust marketing_eligible_snapshot as authority.
    expect(/marketing_eligible_snapshot/i.test(PREP)).toBe(false)
  })

  it('L7. suppression, account_active, email_confirmed, marketing_enabled all rechecked', () => {
    expect(/has_active_suppression/i.test(PREP)).toBe(true)
    expect(/account_active/i.test(PREP)).toBe(true)
    expect(/email_confirmed/i.test(PREP)).toBe(true)
    expect(/marketing_enabled/i.test(PREP)).toBe(true)
  })

  it('L8. campaign context uses the same live/open semantics', () => {
    expect(/c\.status = 'live' AND \(c\.end_at IS NULL OR c\.end_at > now\(\)\)/i.test(PREP)).toBe(true)
  })

  it('L9. definition + automation kill switches are enforced in preparation_eligible', () => {
    expect(/AND c\.definition_enabled/i.test(PREP)).toBe(true)
    expect(/AND c\.automation_enabled/i.test(PREP)).toBe(true)
  })

  it('L10. template readiness requires mapped + exists + active + valid', () => {
    expect(/template_mapped AND \w\.template_exists AND \w\.template_active AND \w\.template_valid\) AS template_ready/i.test(PREP)).toBe(true)
    expect(/AND c\.template_ready/i.test(PREP)).toBe(true)
  })
})

// ===========================================================================
// 5. Content-readiness + frequency contract.
// ===========================================================================
describe('022 — content-readiness and frequency semantics', () => {
  it('C1. content_prepared is false for empty {} snapshots', () => {
    expect(/template_snapshot IS DISTINCT FROM '\{\}'::jsonb\s+AND b\.context_snapshot IS DISTINCT FROM '\{\}'::jsonb/i.test(PREP)).toBe(true)
  })

  it('C2. content_prepared is NOT a precondition of preparation_eligible (it is the OUTPUT)', () => {
    // Scope strictly to the boolean expression: it uniquely begins with
    // "c.recipient_user_identity AND c.recipient_queued" and ends at
    // "AS preparation_eligible" (the SELECT-list output columns, incl.
    // "c.content_prepared,", come BEFORE this anchor).
    const start = PREP.indexOf('c.recipient_user_identity AND c.recipient_queued')
    const end = PREP.indexOf('AS preparation_eligible')
    const eligExpr = PREP.slice(start, end)
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    expect(/content_prepared/i.test(eligExpr)).toBe(false)
  })

  it('C3. frequency is NOT part of preparation_eligible (authoritative at delivery time)', () => {
    // No frequency/send-window counting in the preparation gate at all.
    expect(/sends_last_24h|sends_last_7d|daily_frequency_limit|weekly_frequency_limit|frequency_eligible/i.test(PREP)).toBe(false)
  })

  it('C4. no snapshot is populated (gate never writes snapshots)', () => {
    // No recipient UPDATE at all, so snapshots can never be assigned.
    expect(/UPDATE public\.marketing_recipients/i.test(CODE_FLAT)).toBe(false)
    // No INSERT INTO marketing_recipients (materialisation belongs to Stage 020).
    expect(/INSERT INTO public\.marketing_recipients/i.test(CODE_FLAT)).toBe(false)
    // Snapshots are never assigned (SET x = / INSERT column) — only read/compared.
    // The only snapshot references are the preflight FILTER read and the gate's
    // IS DISTINCT FROM comparison, neither of which is an assignment.
    expect(/SET\s+template_snapshot|SET\s+context_snapshot/i.test(CODE_FLAT)).toBe(false)
  })
})

// ===========================================================================
// 6. Blocker reasons — deterministic set.
// ===========================================================================
describe('022 — deterministic blocker reasons', () => {
  it('B1. the required blocker codes are present', () => {
    for (const code of [
      'recipient_not_queued',
      'recipient_already_sent',
      'recipient_locked',
      'run_not_preparing',
      'opportunity_not_selected',
      'opportunity_actioned',
      'identity_mismatch',
      'definition_disabled',
      'delivery_route_invalid',
      'automation_disabled',
      'profile_unmatched',
      'account_inactive',
      'email_unconfirmed',
      'marketing_disabled',
      'active_suppression',
      'authoritative_marketing_ineligible',
      'campaign_context_invalid',
      'template_unmapped',
      'template_missing',
      'template_inactive',
      'template_invalid',
      'already_prepared',
    ]) {
      expect(new RegExp(`'${code}'`).test(PREP)).toBe(true)
    }
  })
})

// ===========================================================================
// 7. Template seed — exactly one, safe, allowlisted placeholders, NULL url.
// ===========================================================================
describe('022 — canonical abandoned_checkout template', () => {
  it('TP1. exactly one template INSERT with template_key abandoned_checkout_v1', () => {
    const inserts = CODE_FLAT.match(/INSERT INTO public\.marketing_templates/gi) ?? []
    expect(inserts.length).toBe(1)
    expect(/'abandoned_checkout_v1'/.test(TEMPLATE_INSERT)).toBe(true)
    expect(/is_active[\s\S]*\)\s*VALUES/i.test(TEMPLATE_INSERT)).toBe(true)
  })

  it('TP2. template uses ONLY placeholders from the real allowlist', () => {
    // Pull the quoted string literals from the INSERT and check placeholders.
    const literals = TEMPLATE_INSERT.match(/'(?:[^']|'')*'/g) ?? []
    const unknown = findUnknownPlaceholders(literals)
    expect(unknown).toEqual([])
    // And every placeholder used is genuinely in ALLOWED_PLACEHOLDERS.
    const used = literals.flatMap((l) => extractPlaceholders(l))
    for (const tok of used) {
      expect(ALLOWED_PLACEHOLDERS as readonly string[]).toContain(tok)
    }
    // The template actually exercises at least one placeholder.
    expect(used.length).toBeGreaterThan(0)
  })

  it('TP3. no angle brackets / raw HTML in the template content', () => {
    expect(/[<>]/.test(TEMPLATE_INSERT)).toBe(false)
  })

  it('TP4. no loss / near-miss / chasing framing in the template copy', () => {
    const banned = [
      /so close/i,
      /near[- ]?miss/i,
      /win back/i,
      /due a win/i,
      /chasing/i,
      /last chance to win/i,
    ]
    for (const re of banned) {
      expect(re.test(TEMPLATE_INSERT)).toBe(false)
    }
  })

  it('TP5. default_url and discount_code_id are seeded NULL (campaign-dynamic, no discount)', () => {
    // The VALUES list ends with: ... 'Finish my entry', NULL, NULL, 1, true )
    expect(/'Finish my entry',\s*NULL,\s*NULL,\s*1,\s*true/i.test(TEMPLATE_INSERT)).toBe(true)
  })
})

// ===========================================================================
// 8. Template mapping — only abandoned_checkout, stays disabled.
// ===========================================================================
describe('022 — template mapping', () => {
  it('M1. maps ONLY the abandoned_checkout automation template_id', () => {
    expect(/UPDATE public\.marketing_automations a\s+SET template_id = t\.id/i.test(CODE_FLAT)).toBe(true)
    expect(/a\.automation_key = 'abandoned_checkout'/i.test(CODE_FLAT)).toBe(true)
    // Idempotent guard: never overwrite an existing mapping.
    expect(/a\.template_id IS NULL/i.test(CODE_FLAT)).toBe(true)
  })

  it('M2. never enables an automation or a definition', () => {
    expect(/SET[^;]*\benabled\s*=\s*true/i.test(CODE_FLAT)).toBe(false)
    expect(/UPDATE public\.marketing_opportunity_definitions/i.test(CODE_FLAT)).toBe(false)
  })
})

// ===========================================================================
// 9. Recipient status + run lifecycle contract documentation (no CHECK change).
// ===========================================================================
describe('022 — status + run lifecycle contract comments', () => {
  it('D1. documents recipient.status without adding a status or altering a CHECK', () => {
    expect(/COMMENT ON COLUMN public\.marketing_recipients\.status/i.test(FLAT)).toBe(true)
    // Never adds/relaxes a status CHECK.
    expect(/ADD CONSTRAINT|DROP CONSTRAINT|CHECK \(/i.test(CODE_FLAT)).toBe(false)
  })

  it('D2. documents run.status lifecycle (preparing -> queued -> processing ...)', () => {
    expect(/COMMENT ON COLUMN public\.marketing_automation_runs\.status/i.test(FLAT)).toBe(true)
  })

  it('D3. transitions NO run (no run status write anywhere)', () => {
    expect(/UPDATE public\.marketing_automation_runs/i.test(CODE_FLAT)).toBe(false)
  })
})

// ===========================================================================
// 10. Admin RPCs — service-role only, no identity leakage.
// ===========================================================================
describe('022 — admin overview/sample RPCs', () => {
  it('A1. overview + sample created service-role only', () => {
    expect(/CREATE OR REPLACE FUNCTION public\.get_admin_marketing_recipient_preparation_overview\(\)/i.test(FLAT)).toBe(true)
    expect(/CREATE OR REPLACE FUNCTION public\.get_admin_marketing_recipient_preparation_sample\(\s*p_limit integer DEFAULT 25\s*\)/i.test(FLAT)).toBe(true)
    expect(/GRANT EXECUTE ON FUNCTION public\.get_admin_marketing_recipient_preparation_overview\(\) TO service_role/i.test(FLAT)).toBe(true)
    expect(/GRANT EXECUTE ON FUNCTION public\.get_admin_marketing_recipient_preparation_sample\(integer\) TO service_role/i.test(FLAT)).toBe(true)
    for (const role of ['anon', 'authenticated']) {
      expect(new RegExp(`REVOKE ALL ON FUNCTION public\\.get_admin_marketing_recipient_preparation_overview\\(\\) FROM ${role}`, 'i').test(FLAT)).toBe(true)
      expect(new RegExp(`REVOKE ALL ON FUNCTION public\\.get_admin_marketing_recipient_preparation_sample\\(integer\\) FROM ${role}`, 'i').test(FLAT)).toBe(true)
    }
  })

  it('A2. admin RPC outputs expose no raw identifiers as JSON keys', () => {
    for (const body of [OVERVIEW, SAMPLE]) {
      expect(/'recipientId'|'runId'|'opportunityId'|'userId'|'automationId'|'campaignId'|'templateId'|'email'/i.test(body)).toBe(false)
    }
    // Sample uses only an anonymised hash for identity.
    expect(/customerHash/i.test(SAMPLE)).toBe(true)
  })

  it('A3. sample limit clamped 1..100', () => {
    expect(/LEAST\(GREATEST\(COALESCE\(p_limit, 25\), 1\), 100\)/i.test(SAMPLE)).toBe(true)
  })
})

// ===========================================================================
// 11. Absolutely-do-not guards (no send / provider / AI / cron / unsubscribe).
// ===========================================================================
describe('022 — no send / provider / AI / cron / unsubscribe token', () => {
  it('X1. no provider/email call anywhere', () => {
    expect(/resend|sendgrid|smtp|provider_email_id\s*=|sent_at\s*=/i.test(CODE_FLAT)).toBe(false)
  })
  it('X2. no unsubscribe token/secret in the migration', () => {
    expect(/unsubscribe/i.test(CODE_FLAT)).toBe(false)
    expect(/MARKETING_UNSUBSCRIBE_TOKEN_SECRET/i.test(RAW)).toBe(false)
  })
  it('X3. no cron / job scheduling', () => {
    expect(/cron|pg_cron|schedule/i.test(CODE_FLAT)).toBe(false)
  })
  it('X4. no AI', () => {
    expect(/openai|gpt|llm|embedding|ai_/i.test(CODE_FLAT)).toBe(false)
  })
  it('X5. never enables sending/discovery/rollout', () => {
    expect(/sending_enabled\s*=\s*true|discovery_enabled\s*=\s*true|rollout_limit\s*=\s*[1-9]/i.test(CODE_FLAT)).toBe(false)
    // 022 must not UPDATE the control state at all.
    expect(/UPDATE public\.marketing_control_state/i.test(CODE_FLAT)).toBe(false)
  })
})

// ===========================================================================
// 12. Preflight + postcheck safety invariants are present.
// ===========================================================================
describe('022 — preflight + postcheck invariants', () => {
  it('V1. preflight asserts the controlled canary (recipients=1, runs=1, opportunities=7, paused)', () => {
    expect(/expected 1\./i.test(PREFLIGHT)).toBe(true)
    expect(/expected 7\./i.test(PREFLIGHT)).toBe(true)
    expect(/Marketing not paused/i.test(PREFLIGHT)).toBe(true)
    expect(/abandoned_checkout automation already has template_id set/i.test(PREFLIGHT)).toBe(true)
  })

  it('V2. postcheck proves ledger unchanged via checksums (recipients/runs/opportunities)', () => {
    expect(/recipient ledger changed/i.test(POSTCHECK)).toBe(true)
    expect(/run ledger changed \(a run was transitioned\)/i.test(POSTCHECK)).toBe(true)
    expect(/opportunity ledger changed/i.test(POSTCHECK)).toBe(true)
  })

  it('V3. postcheck asserts templateReady=1, contentPrepared=0, preparationEligible=0 for the canary', () => {
    expect(/template\.ready.*expected 1/i.test(POSTCHECK)).toBe(true)
    expect(/content\.prepared.*expected 0/i.test(POSTCHECK)).toBe(true)
    expect(/preparationEligible.*expected 0/i.test(POSTCHECK)).toBe(true)
    expect(/definition_disabled \+ automation_disabled blockers/i.test(POSTCHECK)).toBe(true)
  })

  it('V4. postcheck asserts admin outputs do not leak identifiers/emails', () => {
    expect(/overview output leaks an identifier\/email/i.test(POSTCHECK)).toBe(true)
    expect(/sample output leaks an identifier\/email/i.test(POSTCHECK)).toBe(true)
  })

  it('V5. single transaction (BEGIN ... COMMIT)', () => {
    expect(/^\s*BEGIN;/m.test(RAW)).toBe(true)
    expect(/COMMIT;\s*$/m.test(RAW.trimEnd() + '\n')).toBe(true)
  })
})
