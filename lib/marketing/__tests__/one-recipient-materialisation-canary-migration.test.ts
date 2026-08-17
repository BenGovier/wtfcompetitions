import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Static contract tests for
//   scripts/marketing/021-marketing-materialisation-one-recipient-canary.sql
//
// These tests treat the canary migration as STATIC TEXT. They never open a
// database connection, never execute SQL, and never mutate anything. They
// assert the Stage 3D2C one-recipient materialisation canary contract: a single
// atomic transaction that temporarily enables ONLY the new_account_no_purchase
// definition + its routed automation + rollout_limit=1, directly inserts ONE
// new_account_no_purchase opportunity for a deterministic permission-backed
// zero-purchase user, verifies the private gate reports gate_eligible=true /
// sendable_now=false, materialises EXACTLY ONE recipient (queued, unsent) inside
// ONE preparing run, transitions the opportunity open -> selected, restores all
// kill switches before COMMIT, sends nothing, and returns no PII. Migrations
// 001-020 are frozen by content hash.
// ---------------------------------------------------------------------------

const SCRIPTS_DIR = join(process.cwd(), 'scripts', 'marketing')
const MIG_021 = '021-marketing-materialisation-one-recipient-canary.sql'

const CODE_RAW = readFileSync(join(SCRIPTS_DIR, MIG_021), 'utf8')

// Comment-stripped executable view: drop full-line and trailing "-- ..."
// comments so assertions about executable SQL cannot be satisfied by prose.
const EXEC = CODE_RAW.split('\n')
  .map((line) => {
    const idx = line.indexOf('--')
    return idx >= 0 ? line.slice(0, idx) : line
  })
  .join('\n')

const FLAT = CODE_RAW.replace(/\s+/g, ' ')
const FLAT_EXEC = EXEC.replace(/\s+/g, ' ')

// Executable view with comments AND single-quoted string literals removed, so
// behaviour bans cannot be satisfied by prose inside RAISE / string messages.
const EXEC_NOSTR = EXEC.replace(/'(?:[^']|'')*'/g, "''")
const FLAT_EXEC_NOSTR = EXEC_NOSTR.replace(/\s+/g, ' ')

// The canary DO block body, isolated between DO $canary$ ... $canary$;.
const _bodyStart = FLAT_EXEC.indexOf('DO $canary$')
const _bodyEnd = FLAT_EXEC.indexOf('$canary$;', _bodyStart)
const DO_BODY = _bodyStart >= 0 && _bodyEnd >= 0 ? FLAT_EXEC.slice(_bodyStart, _bodyEnd) : ''

// ===========================================================================
// (1) Migrations 001-020 untouched (content hash freeze).
// ===========================================================================
describe('021 — migrations 001-020 are untouched', () => {
  const EXPECTED_PRIOR_HASHES: Record<string, string> = (() => {
    const files = readdirSync(SCRIPTS_DIR)
      .filter((f) => /^0(0[1-9]|1[0-9]|20)-.*\.sql$/.test(f))
      .sort()
    const out: Record<string, string> = {}
    for (const f of files) {
      out[f] = createHash('sha256').update(readFileSync(join(SCRIPTS_DIR, f))).digest('hex')
    }
    return out
  })()

  it('U1. migrations named in the brief exist as a stable set', () => {
    const nums = Object.keys(EXPECTED_PRIOR_HASHES).map((f) => f.slice(0, 3))
    for (const n of ['003', '005', '007', '009', '016', '017', '018', '019', '020']) {
      expect(nums).toContain(n)
    }
  })

  it('U2. the 021 canary never rewrites a 001-020 file', () => {
    expect(Object.keys(EXPECTED_PRIOR_HASHES).length).toBeGreaterThanOrEqual(9)
    for (const [f, h] of Object.entries(EXPECTED_PRIOR_HASHES)) {
      const now = createHash('sha256').update(readFileSync(join(SCRIPTS_DIR, f))).digest('hex')
      expect(now).toBe(h)
    }
  })

  it('U3. the 021 canary performs NO schema DDL against 001-020 objects', () => {
    expect(/\bALTER\s+TABLE\b/i.test(FLAT_EXEC)).toBe(false)
    expect(/\bDROP\s+(TABLE|INDEX|TRIGGER|CONSTRAINT|FUNCTION)\b/i.test(FLAT_EXEC)).toBe(false)
    // Never (re)defines any function — this is a one-time script, not a migration.
    expect(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i.test(FLAT_EXEC)).toBe(false)
    // The ONLY CREATE is the ON COMMIT DROP temp result table.
    expect(/\bCREATE\s+TABLE\b(?!\s+IF)/i.test(FLAT_EXEC.replace(/CREATE TEMP TABLE/gi, 'CREATE TMPTBL'))).toBe(false)
    expect(FLAT_EXEC).toMatch(/CREATE TEMP TABLE tmp_one_recipient_canary_result ON COMMIT DROP/i)
  })
})

// ===========================================================================
// (2,3,4) One-time canary; atomicity; requires sending=false before starting.
// ===========================================================================
describe('021 — transaction, atomicity & one-time nature', () => {
  it('runs inside a single BEGIN/COMMIT transaction', () => {
    expect(FLAT_EXEC).toMatch(/^\s*BEGIN;/)
    expect(FLAT_EXEC).toMatch(/COMMIT;\s*$/)
  })

  it('has exactly one BEGIN and one COMMIT at the statement level', () => {
    const begins = FLAT_EXEC.match(/(?:^|\s)BEGIN;/g) || []
    const commits = FLAT_EXEC.match(/COMMIT;/g) || []
    expect(begins.length).toBe(1)
    expect(commits.length).toBe(1)
  })

  it('sets a 5s lock_timeout and a sensible statement_timeout', () => {
    expect(FLAT_EXEC).toMatch(/SET LOCAL lock_timeout = '5s'/i)
    expect(FLAT_EXEC).toMatch(/SET LOCAL statement_timeout = '60s'/i)
  })

  it('has NO exception-swallowing handler (fail-whole-transaction)', () => {
    expect(/\bEXCEPTION\s+WHEN\b/i.test(EXEC)).toBe(false)
  })

  it('acquires a canary-specific advisory lock distinct from prior keys', () => {
    expect(FLAT_EXEC).toMatch(/pg_try_advisory_xact_lock\(\s*hashtext\('wtf_marketing_stage_3d2c_one_recipient_canary'\)\s*\)/i)
    expect(FLAT.includes('wtf_marketing_stage_3d2b_recipient_materialisation')).toBe(false)
    expect(FLAT.includes('wtf_marketing_materialize_recipients')).toBe(false)
    expect(FLAT.includes('wtf_marketing_stage_3c2i_five_row_mixed_canary')).toBe(false)
  })

  it('requires sending=false / discovery=false / rollout=0 BEFORE any write (3)', () => {
    expect(FLAT_EXEC).toMatch(/v_sending IS DISTINCT FROM false\s+OR v_discovery IS DISTINCT FROM false\s+OR v_rollout\s+IS DISTINCT FROM 0/i)
    // The preflight pause assertion precedes the first mutation (UPDATE/INSERT).
    const pauseIdx = FLAT_EXEC.search(/Marketing is not paused/i)
    const firstWrite = FLAT_EXEC.search(/\b(UPDATE|INSERT)\b/i)
    expect(pauseIdx).toBeGreaterThan(-1)
    expect(firstWrite).toBeGreaterThan(pauseIdx)
  })
})

// ===========================================================================
// (4,5) Never sets sending=true; discovery remains false.
// ===========================================================================
describe('021 — global sending & discovery kill switches', () => {
  it('never sets sending_enabled = true anywhere (4)', () => {
    expect(/sending_enabled\s*=\s*true/i.test(FLAT_EXEC_NOSTR)).toBe(false)
  })

  it('never sets discovery_enabled = true anywhere (5)', () => {
    expect(/discovery_enabled\s*=\s*true/i.test(FLAT_EXEC_NOSTR)).toBe(false)
  })

  it('never SETs sending_enabled or discovery_enabled at all', () => {
    expect(/SET[^;]*sending_enabled/i.test(FLAT_EXEC)).toBe(false)
    expect(/SET[^;]*discovery_enabled/i.test(FLAT_EXEC)).toBe(false)
  })

  it('never changes batch size or daily/weekly frequency caps', () => {
    expect(/SET[^;]*maximum_batch_size/i.test(FLAT_EXEC)).toBe(false)
    expect(/SET[^;]*maximum_daily_per_contact/i.test(FLAT_EXEC)).toBe(false)
    expect(/SET[^;]*maximum_weekly_per_contact/i.test(FLAT_EXEC)).toBe(false)
  })
})

// ===========================================================================
// (6,7,8) Deterministic permission-backed selection; authoritative eligibility;
//         snapshot is NOT the authority.
// ===========================================================================
describe('021 — canary user selection', () => {
  it('selects deterministically (account_created_at ASC, user_id ASC) with LIMIT 1 (6)', () => {
    expect(FLAT_EXEC).toMatch(/ORDER BY p\.account_created_at ASC NULLS LAST, p\.user_id ASC\s+LIMIT 1/i)
  })

  it('re-checks authoritative is_marketing_email_eligible at runtime (7)', () => {
    expect(FLAT_EXEC).toMatch(/public\.is_marketing_email_eligible\(p\.user_id, p\.email_lc\) IS TRUE/i)
  })

  it('does NOT use marketing_eligible_snapshot as the authority — diagnostic only (8)', () => {
    // The snapshot column is only ever SELECTed into a diagnostic variable.
    // It must NOT appear in a WHERE predicate of the selector.
    const selStart = FLAT_EXEC.indexOf('FROM public.customer_marketing_profiles p')
    const selEnd = FLAT_EXEC.indexOf('LIMIT 1', selStart)
    const SELECTOR = selStart >= 0 && selEnd >= 0 ? FLAT_EXEC.slice(selStart, selEnd) : ''
    expect(SELECTOR.length).toBeGreaterThan(0)
    // No "AND marketing_eligible_snapshot" gate in the WHERE clause.
    expect(/AND\s+p?\.?marketing_eligible_snapshot/i.test(SELECTOR)).toBe(false)
  })

  it('requires all permission flags in the selector', () => {
    expect(FLAT_EXEC).toMatch(/p\.account_active = true/i)
    expect(FLAT_EXEC).toMatch(/p\.email_confirmed = true/i)
    expect(FLAT_EXEC).toMatch(/p\.marketing_enabled = true/i)
    expect(FLAT_EXEC).toMatch(/p\.has_active_suppression = false/i)
    expect(FLAT_EXEC).toMatch(/p\.user_id IS NOT NULL/i)
    expect(FLAT_EXEC).toMatch(/length\(btrim\(p\.email_lc\)\) > 0/i)
  })

  it('requires zero confirmed orders and NULL last_confirmed_at (9)', () => {
    expect(FLAT_EXEC).toMatch(/p\.confirmed_order_count = 0/i)
    expect(FLAT_EXEC).toMatch(/p\.last_confirmed_at IS NULL/i)
  })

  it('requires no existing recipient and no active non-expired opportunity for the user', () => {
    expect(FLAT_EXEC).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM public\.marketing_recipients r WHERE r\.user_id = p\.user_id\s*\)/i)
    expect(FLAT_EXEC).toMatch(/o\.opportunity_type = c_opp_type\s+AND o\.state NOT IN \('expired', 'superseded'\)\s+AND o\.expires_at > now\(\)/i)
  })

  it('raises no_safe_canary_user and never relaxes eligibility when none qualifies', () => {
    expect(FLAT_EXEC).toMatch(/RAISE EXCEPTION 'no_safe_canary_user'/i)
    expect(FLAT_EXEC).toMatch(/IF v_user_id IS NULL THEN/i)
  })
})

// ===========================================================================
// (10,11,12,13) Only new_account_no_purchase; campaign/promotion/provenance NULL.
// ===========================================================================
describe('021 — canary opportunity type & context', () => {
  it('uses ONLY new_account_no_purchase (10)', () => {
    expect(FLAT_EXEC).toMatch(/c_opp_type\s+constant text\s+:= 'new_account_no_purchase'/i)
    for (const banned of [
      'abandoned_checkout',
      'high_value_customer_at_risk',
      'recent_winner',
      'vip_early_access',
      'wtf_credit_waiting',
      'lapsed_14_days',
    ]) {
      expect(FLAT_EXEC_NOSTR.includes(banned)).toBe(false)
    }
  })

  it('inserts exactly ONE opportunity', () => {
    const inserts = FLAT_EXEC.match(/INSERT INTO public\.marketing_opportunities/gi) || []
    expect(inserts.length).toBe(1)
  })

  it('inserts campaign_id NULL and promotion_id NULL (11,12)', () => {
    const insStart = FLAT_EXEC.indexOf('INSERT INTO public.marketing_opportunities')
    const insEnd = FLAT_EXEC.indexOf('RETURNING id INTO v_opp_id', insStart)
    const INS = insStart >= 0 && insEnd >= 0 ? FLAT_EXEC.slice(insStart, insEnd) : ''
    expect(INS.length).toBeGreaterThan(0)
    expect(/campaign_id/i.test(INS)).toBe(true)
    expect(/promotion_id/i.test(INS)).toBe(true)
    // No campaign/promotion variable feeds the insert — the column list is NULL.
    expect(/campaign_id\s+uuid/i.test(INS)).toBe(false)
  })

  it('opportunity automation_id provenance is NULL, not a delivery route (13)', () => {
    // The insert lists automation_id in its column list (comment retained in FLAT).
    expect(FLAT).toMatch(/automation_id,\s*-- NULL provenance/i)
    // The delivery route variable is only used for the run/gate, never as the
    // opportunity's automation_id.
    expect(/automation_id\s*=\s*v_def_route_id/i.test(FLAT_EXEC)).toBe(false)
    // The insert column list supplies NULL (not the route id) for automation_id.
    const insStart = FLAT_EXEC.indexOf('INSERT INTO public.marketing_opportunities')
    const insEnd = FLAT_EXEC.indexOf('RETURNING id INTO v_opp_id', insStart)
    const INS = insStart >= 0 && insEnd >= 0 ? FLAT_EXEC.slice(insStart, insEnd) : ''
    expect(/v_def_route_id/i.test(INS)).toBe(false)
    // Post-assertion requires provenance stays NULL.
    expect(FLAT_EXEC).toMatch(/v_opp_auto_prov IS NOT NULL/i)
  })

  it('definition defaults drive priority/score/expiry (14)', () => {
    // The insert column list is annotated as definition-derived (comments in FLAT).
    expect(FLAT).toMatch(/base_priority,\s*-- from definition default_priority/i)
    expect(FLAT).toMatch(/score,\s*-- from definition default_score/i)
    // The value list supplies the definition-read variables.
    const insStart = FLAT_EXEC.indexOf('INSERT INTO public.marketing_opportunities')
    const insEnd = FLAT_EXEC.indexOf('RETURNING id INTO v_opp_id', insStart)
    const INS = insStart >= 0 && insEnd >= 0 ? FLAT_EXEC.slice(insStart, insEnd) : ''
    expect(/v_def_priority/i.test(INS)).toBe(true)
    expect(/v_def_score/i.test(INS)).toBe(true)
    expect(FLAT_EXEC).toMatch(/make_interval\(hours => v_def_expiry\)/i)
    // Asserts the exact authoritative defaults (5 / 350 / 336) before insert.
    expect(FLAT_EXEC).toMatch(/c_exp_priority\s+constant integer := 5/i)
    expect(FLAT_EXEC).toMatch(/c_exp_score\s+constant numeric := 350/i)
    expect(FLAT_EXEC).toMatch(/c_exp_expiry_hours\s+constant integer := 336/i)
  })

  it('inserts with state open, deterministic dedupe key, and no fabricated content', () => {
    expect(FLAT_EXEC).toMatch(/'stage-3d2c-one-recipient-canary:'/i)
    const insStart = FLAT_EXEC.indexOf('INSERT INTO public.marketing_opportunities')
    const insEnd = FLAT_EXEC.indexOf('RETURNING id INTO v_opp_id', insStart)
    const INS = FLAT_EXEC.slice(insStart, insEnd)
    expect(/'open'/i.test(INS)).toBe(true)
  })
})

// ===========================================================================
// (15,16,17,18) exactly one insert; exact temp enablement of def/automation/rollout=1.
// ===========================================================================
describe('021 — temporary enablement (exactly def + automation + rollout=1)', () => {
  it('temporarily enables the new_account_no_purchase definition (17)', () => {
    expect(FLAT_EXEC).toMatch(/UPDATE public\.marketing_opportunity_definitions\s+SET enabled = true[^;]*WHERE opportunity_key = c_opp_type/i)
  })

  it('temporarily enables exactly the routed delivery automation (16)', () => {
    expect(FLAT_EXEC).toMatch(/UPDATE public\.marketing_automations\s+SET enabled = true[^;]*WHERE id = v_def_route_id/i)
    // Enables by the route id only — never a blanket enable.
    const enableAutos = FLAT_EXEC.match(/UPDATE public\.marketing_automations\s+SET enabled = true/gi) || []
    expect(enableAutos.length).toBe(1)
  })

  it('sets rollout_limit to exactly 1 (18)', () => {
    expect(FLAT_EXEC).toMatch(/UPDATE public\.marketing_control_state\s+SET rollout_limit = 1[^;]*WHERE key = 'default'/i)
  })

  it('asserts exactly ONE enabled definition and ONE enabled automation after enablement', () => {
    expect(FLAT_EXEC).toMatch(/expected exactly 1 enabled definition, found/i)
    expect(FLAT_EXEC).toMatch(/expected exactly 1 enabled automation, found/i)
  })

  it('asserts sending/discovery still false and rollout exactly 1 after enablement', () => {
    expect(FLAT_EXEC).toMatch(/sending_enabled changed to % during enablement/i)
    expect(FLAT_EXEC).toMatch(/discovery_enabled changed to % during enablement/i)
    expect(FLAT_EXEC).toMatch(/rollout_limit=% after enablement \(expected 1\)/i)
  })
})

// ===========================================================================
// (19,20,21) Private gate checked before materialisation; gate_eligible true,
//            sendable_now false.
// ===========================================================================
describe('021 — private gate verified before materialising', () => {
  it('calls the canonical private gate BEFORE the materialiser (19)', () => {
    const gateIdx = FLAT_EXEC.indexOf('FROM public.wtf_marketing_recipient_gate_preview() g')
    const materIdx = FLAT_EXEC.indexOf('public.materialize_marketing_recipients(1)')
    expect(gateIdx).toBeGreaterThan(-1)
    expect(materIdx).toBeGreaterThan(-1)
    expect(gateIdx).toBeLessThan(materIdx)
  })

  it('requires gate_eligible = true and next_best_rank = 1 for the canary (20)', () => {
    expect(FLAT_EXEC).toMatch(/v_g_gate_eligible\s+IS DISTINCT FROM true/i)
    expect(FLAT_EXEC).toMatch(/v_g_next_best_rank IS DISTINCT FROM 1/i)
    expect(FLAT_EXEC).toMatch(/v_g_pre_nba\s+IS DISTINCT FROM true/i)
  })

  it('requires the full deterministic eligibility chain to be true', () => {
    for (const v of [
      'v_g_profile_matched',
      'v_g_account_active',
      'v_g_email_confirmed',
      'v_g_marketing_enabled',
      'v_g_auth_eligible',
      'v_g_def_enabled',
      'v_g_campaign_valid',
      'v_g_route_mapped',
      'v_g_route_enabled',
      'v_g_route_ready',
      'v_g_freq_eligible',
    ]) {
      expect(FLAT_EXEC).toMatch(new RegExp(`${v}\\s+IS DISTINCT FROM true`, 'i'))
    }
    expect(FLAT_EXEC).toMatch(/v_g_has_suppression IS DISTINCT FROM false/i)
    expect(FLAT_EXEC).toMatch(/v_g_existing_recip IS DISTINCT FROM false/i)
  })

  it('requires sendable_now to remain FALSE for the canary (21)', () => {
    expect(FLAT_EXEC).toMatch(/v_g_sendable_now IS DISTINCT FROM false/i)
    expect(FLAT_EXEC).toMatch(/MUST be false — global sending is paused/i)
  })
})

// ===========================================================================
// (22,23,24,25,26) Materialiser called with limit 1; exactly 1 recipient / 1
//                  selected / 1 run created / 0 reused.
// ===========================================================================
describe('021 — materialiser invocation & result', () => {
  it('calls materialize_marketing_recipients with limit 1 exactly once (22)', () => {
    const calls = FLAT_EXEC_NOSTR.match(/materialize_marketing_recipients\s*\(\s*1\s*\)/gi) || []
    expect(calls.length).toBe(1)
    const allCalls = FLAT_EXEC_NOSTR.match(/materialize_marketing_recipients\s*\(/gi) || []
    expect(allCalls.length).toBe(1)
  })

  it('requires status ok, effectiveLimit 1, finalCandidateCount 1', () => {
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'status'\) IS DISTINCT FROM 'ok'/i)
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'effectiveLimit'\)::int\s+IS DISTINCT FROM 1/i)
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'finalCandidateCount'\)::bigint IS DISTINCT FROM 1/i)
  })

  it('requires insertedRecipients 1, opportunitiesSelected 1 (23,24)', () => {
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'insertedRecipients'\)::bigint\s+IS DISTINCT FROM 1/i)
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'opportunitiesSelected'\)::bigint IS DISTINCT FROM 1/i)
  })

  it('requires runsCreated 1 and runsReused 0 (25,26)', () => {
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'runsCreated'\)::bigint\s+IS DISTINCT FROM 1/i)
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'runsReused'\)::bigint\s+IS DISTINCT FROM 0/i)
  })

  it('requires groupCount 1 and blockedRunGroups 0', () => {
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'groupCount'\)::bigint\s+IS DISTINCT FROM 1/i)
    expect(FLAT_EXEC).toMatch(/\(v_rpc->>'blockedRunGroups'\)::bigint\s+IS DISTINCT FROM 0/i)
  })
})

// ===========================================================================
// (27,28,29,30,31) Recipient contract: idempotency, linkage, pre-send status,
//                  default snapshots, NULL sent/provider/engagement.
// ===========================================================================
describe('021 — recipient assertions', () => {
  it('idempotency_key = marketing-opportunity:<opportunity_id> (27)', () => {
    expect(FLAT_EXEC).toMatch(/v_r_idem\s+IS DISTINCT FROM \('marketing-opportunity:' \|\| v_opp_id::text\)/i)
  })

  it('recipient is linked to the canary opportunity (28)', () => {
    expect(FLAT_EXEC).toMatch(/FROM public\.marketing_recipients r\s+WHERE r\.opportunity_id = v_opp_id/i)
    // No stray recipient outside the canary opportunity.
    expect(FLAT_EXEC).toMatch(/opportunity_id IS DISTINCT FROM v_opp_id\) <> 0/i)
  })

  it('recipient pre-send status is queued (29)', () => {
    expect(FLAT_EXEC).toMatch(/v_r_status\s+IS DISTINCT FROM 'queued'/i)
  })

  it('template/context snapshots are schema defaults, discount default NULL (30)', () => {
    expect(FLAT_EXEC).toMatch(/v_r_tmpl\s+IS DISTINCT FROM '\{\}'::jsonb/i)
    expect(FLAT_EXEC).toMatch(/v_r_ctx\s+IS DISTINCT FROM '\{\}'::jsonb/i)
    expect(FLAT_EXEC).toMatch(/v_r_discount IS NOT NULL/i)
  })

  it('sent/provider/engagement state remains NULL and attempts 0 (31)', () => {
    expect(FLAT_EXEC).toMatch(/v_r_sent_at\s+IS NOT NULL/i)
    expect(FLAT_EXEC).toMatch(/v_r_provider\s+IS NOT NULL/i)
    expect(FLAT_EXEC).toMatch(/v_r_delivered IS NOT NULL/i)
    expect(FLAT_EXEC).toMatch(/v_r_clicked\s+IS NOT NULL/i)
    expect(FLAT_EXEC).toMatch(/v_r_bounced\s+IS NOT NULL/i)
    expect(FLAT_EXEC).toMatch(/v_r_complained IS NOT NULL/i)
    expect(FLAT_EXEC).toMatch(/v_r_attempts\s+IS DISTINCT FROM 0/i)
  })

  it('recipient is a user identity, external_contact_id NULL', () => {
    expect(FLAT_EXEC).toMatch(/v_r_user_id\s+IS DISTINCT FROM v_user_id/i)
    expect(FLAT_EXEC).toMatch(/v_r_external IS NOT NULL/i)
  })
})

// ===========================================================================
// (32) Run status preparing (never queued/processing/completed).
// ===========================================================================
describe('021 — run assertions', () => {
  it('run status MUST be preparing (32)', () => {
    expect(FLAT_EXEC).toMatch(/v_run_status IS DISTINCT FROM 'preparing'/i)
    expect(FLAT_EXEC).toMatch(/MUST be preparing; never queued\/processing\/completed/i)
  })

  it('run uses the authoritative delivery route and NULL promotion', () => {
    expect(FLAT_EXEC).toMatch(/v_run_auto_id IS DISTINCT FROM v_def_route_id/i)
    expect(FLAT_EXEC).toMatch(/v_run_promo_id IS NOT NULL/i)
  })
})

// ===========================================================================
// (33,34,35,36) Opportunity selected; selected_at set; actioned_at null;
//               original six unchanged.
// ===========================================================================
describe('021 — opportunity lifecycle assertions', () => {
  it('canary opportunity becomes selected with selected_at set, actioned_at null (33,34,35)', () => {
    expect(FLAT_EXEC).toMatch(/v_opp_state IS DISTINCT FROM 'selected'/i)
    expect(FLAT_EXEC).toMatch(/v_opp_selected_at IS NULL/i)
    expect(FLAT_EXEC).toMatch(/v_opp_actioned_at IS NOT NULL/i)
  })

  it('the original six opportunities remain open and untouched (36)', () => {
    expect(FLAT_EXEC).toMatch(/o\.id <> v_opp_id\s+AND \(o\.state IS DISTINCT FROM 'open'\s+OR o\.selected_at IS NOT NULL\s+OR o\.actioned_at IS NOT NULL\)/i)
    expect(FLAT_EXEC).toMatch(/pre-existing opportunity\(ies\) changed state/i)
  })
})

// ===========================================================================
// (37,38,39,40,41) Restore rollout 0 / definition disabled / automation
//                  disabled before COMMIT; sending & discovery remain false.
// ===========================================================================
describe('021 — restore kill switches before COMMIT', () => {
  const commitIdx = FLAT_EXEC.indexOf('COMMIT;')

  it('restores rollout_limit = 0 before COMMIT (37)', () => {
    const idx = FLAT_EXEC.search(/UPDATE public\.marketing_control_state\s+SET rollout_limit = 0/i)
    expect(idx).toBeGreaterThan(-1)
    expect(idx).toBeLessThan(commitIdx)
  })

  it('restores the definition to disabled before COMMIT (38)', () => {
    const idx = FLAT_EXEC.search(/UPDATE public\.marketing_opportunity_definitions\s+SET enabled = false[^;]*WHERE opportunity_key = c_opp_type/i)
    expect(idx).toBeGreaterThan(-1)
    expect(idx).toBeLessThan(commitIdx)
  })

  it('restores the automation to disabled before COMMIT (39)', () => {
    const idx = FLAT_EXEC.search(/UPDATE public\.marketing_automations\s+SET enabled = false[^;]*WHERE id = v_def_route_id/i)
    expect(idx).toBeGreaterThan(-1)
    expect(idx).toBeLessThan(commitIdx)
  })

  it('asserts fully-paused end state: sending/discovery false, rollout 0 (40,41)', () => {
    expect(FLAT_EXEC).toMatch(/sending_enabled is % \(MUST be false\)/i)
    expect(FLAT_EXEC).toMatch(/discovery_enabled is % \(MUST be false\)/i)
    expect(FLAT_EXEC).toMatch(/rollout_limit not restored to 0/i)
    expect(FLAT_EXEC).toMatch(/definition\(s\) still enabled \(MUST be 0\)/i)
    expect(FLAT_EXEC).toMatch(/enabled automations not restored/i)
  })
})

// ===========================================================================
// (42,43,44,45,46,47) Final ledger 7/1/1, 0 sent, gateEligible 0, sendableNow 0.
// ===========================================================================
describe('021 — final ledger & gate expectation', () => {
  it('preflight requires opportunities 6, recipients 0, runs 0', () => {
    expect(FLAT_EXEC).toMatch(/expected exactly 6/i)
    expect(FLAT_EXEC).toMatch(/marketing_recipients holds % row\(s\); expected 0/i)
    expect(FLAT_EXEC).toMatch(/marketing_automation_runs holds % row\(s\); expected 0/i)
  })

  it('final totals: opportunities 7, recipients 1, runs 1 (42,43,44)', () => {
    expect(FLAT_EXEC).toMatch(/opportunities is % after materialise \(expected 7\)/i)
    expect(FLAT_EXEC).toMatch(/recipients is % after materialise \(expected 1\)/i)
    expect(FLAT_EXEC).toMatch(/runs is % after materialise \(expected 1\)/i)
  })

  it('final sent recipients is 0 (45)', () => {
    expect(FLAT_EXEC).toMatch(/'sentRecipients',\s*\(SELECT count\(\*\) FROM public\.marketing_recipients WHERE sent_at IS NOT NULL\)/i)
  })

  it('re-checks the gate after restore: gateEligible 0, sendableNow 0 (46,47)', () => {
    const gateChecks = FLAT_EXEC.match(/FROM public\.wtf_marketing_recipient_gate_preview\(\) g/gi) || []
    expect(gateChecks.length).toBe(2) // pre-materialise + post-restore
    expect(FLAT_EXEC).toMatch(/gateEligible after restore is % \(MUST be 0\)/i)
    expect(FLAT_EXEC).toMatch(/sendableNow after restore is % \(MUST be 0\)/i)
  })
})

// ===========================================================================
// (48,49,50,51,52) Forbidden operations: no provider/email, no AI, no cron,
//                  no external contact, no checkout/payment/ticket/wallet.
// ===========================================================================
describe('021 — forbidden operations are absent', () => {
  it('no provider / email / Resend / send path (48)', () => {
    expect(/resend|provider_email_id\s*=|\bsend_email\b|\bdeliver\b\s*\(/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    // Never assigns sent/provider/engagement columns in any UPDATE SET clause.
    // (Bounded to a column assignment, not any downstream reference.)
    expect(/\bSET\s+(?:\w+\s*=\s*[^;]*?,\s*)*sent_at\s*=/i.test(FLAT_EXEC)).toBe(false)
    expect(/\bSET\s+(?:\w+\s*=\s*[^;]*?,\s*)*provider_email_id\s*=/i.test(FLAT_EXEC)).toBe(false)
    // And the recipient/run tables are never the target of an UPDATE at all.
    expect(/UPDATE\s+public\.marketing_recipients/i.test(FLAT_EXEC)).toBe(false)
  })

  it('no AI (49)', () => {
    expect(/openai|embedding|\bllm\b|anthropic|gpt-/i.test(FLAT_EXEC_NOSTR)).toBe(false)
  })

  it('no cron (50)', () => {
    expect(/cron\.schedule|pg_cron|\bcron\b/i.test(FLAT_EXEC_NOSTR)).toBe(false)
  })

  it('no external contacts (51)', () => {
    // external_contact_id appears ONLY inside NULL guards, never inserted with a value.
    expect(/external_contact_id[^,\n]*v_[a-z_]*external/i.test(FLAT_EXEC_NOSTR)).toBe(false)
    expect(FLAT_EXEC).toMatch(/v_r_external IS NOT NULL/i)
    expect(/INSERT INTO public\.marketing_external_contacts/i.test(FLAT_EXEC)).toBe(false)
  })

  it('no checkout/payment/ticket/wallet/customer-facing tables (52)', () => {
    for (const t of [
      'checkout_intents',
      'instant_win_awards',
      'wallet_transactions',
      'orders',
      'payments',
      'tickets',
      'auth.users',
    ]) {
      expect(FLAT.includes(t)).toBe(false)
    }
  })

  it('does not create more than one opportunity / recipient / run', () => {
    expect((FLAT_EXEC.match(/INSERT INTO public\.marketing_opportunities/gi) || []).length).toBe(1)
    // The materialiser (called once, limit 1) is the ONLY recipient/run creator;
    // the canary itself never directly inserts recipients or runs.
    expect(/INSERT INTO public\.marketing_recipients/i.test(FLAT_EXEC)).toBe(false)
    expect(/INSERT INTO public\.marketing_automation_runs/i.test(FLAT_EXEC)).toBe(false)
  })

  it('never advances a run beyond preparing (no run status UPDATE)', () => {
    expect(/UPDATE public\.marketing_automation_runs/i.test(FLAT_EXEC)).toBe(false)
  })

  it('never alters consent or frequency limits', () => {
    expect(/UPDATE public\.marketing_preferences/i.test(FLAT_EXEC)).toBe(false)
    expect(/SET[^;]*maximum_daily_per_contact/i.test(FLAT_EXEC)).toBe(false)
    expect(/SET[^;]*maximum_weekly_per_contact/i.test(FLAT_EXEC)).toBe(false)
  })
})

// ===========================================================================
// Anonymised result payload — no PII / raw identifiers.
// ===========================================================================
describe('021 — safe result payload', () => {
  it('returns the canary_complete status with the required safe fields', () => {
    expect(FLAT_EXEC).toMatch(/'status',\s*'canary_complete'/i)
    for (const f of [
      'opportunitiesBefore',
      'opportunitiesAfter',
      'recipientsBefore',
      'recipientsAfter',
      'runsBefore',
      'runsAfter',
      'materializerStatus',
      'insertedRecipients',
      'opportunitiesSelected',
      'runsCreated',
      'canaryOpportunityState',
      'canaryRecipientStatus',
      'canaryRunStatus',
      'sentRecipients',
      'sendingEnabled',
      'discoveryEnabled',
      'rolloutLimit',
      'enabledDefinitions',
      'enabledAutomations',
      'gateEligibleAfter',
      'sendableNowAfter',
    ]) {
      expect(FLAT.includes(`'${f}'`)).toBe(true)
    }
  })

  it('the safe result contains NO PII / raw identifiers', () => {
    const rIdx = FLAT_EXEC.indexOf('tmp_one_recipient_canary_result ON COMMIT DROP AS')
    const rEnd = FLAT_EXEC.indexOf('AS one_recipient_canary_result', rIdx)
    const RESULT_SQL = rIdx >= 0 && rEnd >= 0 ? FLAT_EXEC.slice(rIdx, rEnd) : ''
    expect(RESULT_SQL.length).toBeGreaterThan(0)
    for (const banned of [
      'v_user_id',
      'v_email_lc',
      'v_opp_id',
      'v_r_run_id',
      'v_def_route_id',
      'v_dedupe_key',
      'email_lc',
      'user_id',
    ]) {
      expect(RESULT_SQL.includes(banned)).toBe(false)
    }
  })
})
