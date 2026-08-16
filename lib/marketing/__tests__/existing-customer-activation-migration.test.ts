import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * STATIC contract for the Stage 3C activation DATA migration
 * scripts/marketing/006-existing-customer-activation.sql.
 *
 * The script cannot be executed from vitest (no Postgres), so these tests pin
 * the parts of its contract that MUST hold in the SQL text:
 *   - it activates only ABSENT preference rows (INSERT + NOT EXISTS +
 *     ON CONFLICT DO NOTHING) and NEVER updates an existing preference,
 *   - it requires pre_registrations.consent = true,
 *   - matched Auth users never become external contacts,
 *   - unmatched consented pre-registrations can become external contacts,
 *   - active suppressions are respected (never enabled, never reversed),
 *   - it asserts the global sending/discovery/rollout pause before activating,
 *   - it is atomic, fail-fast, and single-execution (advisory lock),
 *   - it references NO checkout/wallet/ticket table, inserts NO recipient,
 *     NO automation run, changes NO control state, adds NO Resend/email code,
 *     NO trigger, and ALTERs NO existing table, and
 *   - it does not modify migrations 001-005 or call the profile refresh.
 */
const ROOT = process.cwd()
const MIGRATION_PATH = 'scripts/marketing/006-existing-customer-activation.sql'
const SQL = readFileSync(join(ROOT, MIGRATION_PATH), 'utf8')

// SQL with `-- ...` line comments stripped, so assertions about executable code
// are never satisfied (or tripped) by prose in the header comments.
const CODE = SQL.replace(/--.*$/gm, '')
const FLAT = CODE.replace(/\s+/g, ' ').trim()

describe('Stage 3C activation — exists and leaves earlier migrations intact', () => {
  it('lives at scripts/marketing/006-existing-customer-activation.sql', () => {
    expect(existsSync(join(ROOT, MIGRATION_PATH))).toBe(true)
  })

  it('does not modify migrations 001-005 (they remain present)', () => {
    for (const n of ['001', '002', '003', '004', '005']) {
      const matches = readdirSync(join(ROOT, 'scripts/marketing')).filter((f) => f.startsWith(n))
      expect(matches.length, n).toBeGreaterThan(0)
    }
  })
})

describe('Stage 3C activation — atomic, fail-fast, single-execution', () => {
  it('wraps the whole activation in BEGIN ... COMMIT', () => {
    expect(/\bBEGIN;/i.test(CODE)).toBe(true)
    expect(/\bCOMMIT;/i.test(CODE)).toBe(true)
    expect(CODE.search(/\bBEGIN;/i)).toBeLessThan(CODE.search(/\bCOMMIT;/i))
  })

  it('fails fast with LOCAL lock_timeout and statement_timeout', () => {
    expect(/SET LOCAL lock_timeout\s*=\s*'5s'/i.test(CODE)).toBe(true)
    expect(/SET LOCAL statement_timeout\s*=\s*'60s'/i.test(CODE)).toBe(true)
  })

  it('takes an activation-specific transaction advisory lock and raises if held', () => {
    expect(
      /pg_try_advisory_xact_lock\(\s*hashtext\('wtf_marketing_stage_3c_existing_customer_activation'\)\s*\)/i.test(
        CODE,
      ),
    ).toBe(true)
    expect(/another execution is already in progress/i.test(CODE)).toBe(true)
  })

  it('preflights every required dependency via to_regclass and raises when missing', () => {
    for (const dep of [
      'auth.users',
      'public.marketing_preferences',
      'public.marketing_preference_events',
      'public.marketing_suppressions',
      'public.marketing_external_contacts',
      'public.pre_registrations',
      'public.marketing_control_state',
    ]) {
      expect(FLAT, dep).toContain(`'${dep}'`)
    }
    expect(/to_regclass\(/i.test(CODE)).toBe(true)
    expect(/required dependency .* is missing/i.test(CODE)).toBe(true)
  })
})

describe('Stage 3C activation — refuses to run unless Marketing is globally paused', () => {
  it('reads the control-state singleton before activating', () => {
    expect(/FROM public\.marketing_control_state\b/i.test(CODE)).toBe(true)
    expect(/WHERE key = 'default'/i.test(CODE)).toBe(true)
  })

  it('asserts sending, discovery and rollout are all in the paused state', () => {
    expect(/v_sending IS DISTINCT FROM false/i.test(CODE)).toBe(true)
    expect(/v_discovery IS DISTINCT FROM false/i.test(CODE)).toBe(true)
    expect(/v_rollout\s+IS DISTINCT FROM 0/i.test(CODE)).toBe(true)
    expect(/Marketing is not globally paused/i.test(CODE)).toBe(true)
  })

  it('raises when the control-state singleton is missing', () => {
    expect(/NOT FOUND/i.test(CODE)).toBe(true)
    expect(/cannot confirm Marketing is paused/i.test(CODE)).toBe(true)
  })

  it('performs the pause assertion in the guard block, before the activation block', () => {
    const guardIdx = CODE.indexOf('$guard$')
    const activateIdx = CODE.indexOf('$activate$')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(activateIdx).toBeGreaterThan(-1)
    expect(CODE.search(/Marketing is not globally paused/i)).toBeLessThan(activateIdx)
  })
})

describe('Stage 3C activation — never updates an existing preference row', () => {
  it('contains NO UPDATE of marketing_preferences', () => {
    expect(/UPDATE\s+public\.marketing_preferences/i.test(CODE)).toBe(false)
    expect(/UPDATE\s+marketing_preferences/i.test(CODE)).toBe(false)
  })

  it('uses ON CONFLICT (user_id) DO NOTHING (never DO UPDATE) for preferences', () => {
    expect(/ON CONFLICT \(user_id\) DO NOTHING/i.test(CODE)).toBe(true)
    // No DO UPDATE anywhere in the activation.
    expect(/DO UPDATE/i.test(CODE)).toBe(false)
  })

  it('only inserts preferences for users with NO existing preference row', () => {
    // Both Auth activation branches guard with NOT EXISTS against marketing_preferences.
    const notExists =
      /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.marketing_preferences mp WHERE mp\.user_id = u\.id\s*\)/gi
    expect((CODE.match(notExists) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('inserts the required enabled + consent columns for activated Auth users', () => {
    expect(/email_marketing_enabled/i.test(CODE)).toBe(true)
    expect(FLAT).toMatch(/'existing_customer_activation'/i)
    expect(FLAT).toMatch(/'existing_customer_activation_v1'/i)
    expect(FLAT).toMatch(/'pre_registration'/i)
    expect(FLAT).toMatch(/'pre_registration_v1'/i)
  })

  it('records a subscribed preference event only for rows actually inserted (from the RETURNING set)', () => {
    // Events are inserted SELECT ... FROM ins (the INSERT ... RETURNING CTE),
    // so only truly-inserted users get an event.
    expect(/INSERT INTO public\.marketing_preference_events/i.test(CODE)).toBe(true)
    expect(/'subscribed'/i.test(CODE)).toBe(true)
    expect(/FROM ins i/i.test(CODE)).toBe(true)
  })
})

describe('Stage 3C activation — pre-registration reconciliation rules', () => {
  it('only considers pre_registrations with consent = true', () => {
    // Every reference to pre_registrations is gated by consent = true.
    expect(/pr\.consent = true/i.test(CODE)).toBe(true)
    // There is no path that reads pre_registrations without the consent gate.
    expect(/FROM public\.pre_registrations pr\b(?![^;]*consent = true)/is.test(CODE)).toBe(false)
  })

  it('normalises the pre-registration email with the exact COALESCE/NULLIF expression', () => {
    expect(
      /COALESCE\(NULLIF\(lower\(btrim\(pr\.email_lc\)\), ''\), lower\(btrim\(pr\.email\)\)\)/i.test(CODE),
    ).toBe(true)
  })

  it('matched Auth users NEVER become external contacts (external insert excludes Auth matches)', () => {
    const extBlock = CODE.slice(CODE.indexOf('INSERT INTO public.marketing_external_contacts'))
    expect(
      /NOT EXISTS\s*\(\s*SELECT 1 FROM auth\.users u\s+WHERE u\.email IS NOT NULL\s+AND lower\(btrim\(u\.email\)\) = n\.norm_email\s*\)/i.test(
        // search the source block that builds the external-contact candidate set
        CODE,
      ),
    ).toBe(true)
    // And the external insert exists.
    expect(extBlock.length).toBeGreaterThan(0)
  })

  it('unmatched consented pre-registrations are inserted as pre_registration external contacts', () => {
    const extBlock = FLAT.slice(FLAT.indexOf('INSERT INTO public.marketing_external_contacts'))
    expect(extBlock).toMatch(/'pre_registration'/i)
    expect(extBlock).toMatch(/source_record_id/i)
    expect(extBlock).toMatch(/consented_at/i)
  })

  it('de-dupes external contacts by normalised email (DISTINCT ON + ON CONFLICT DO NOTHING)', () => {
    expect(/DISTINCT ON \(n\.norm_email\)/i.test(CODE)).toBe(true)
    expect(/ON CONFLICT \(email_lc\) DO NOTHING/i.test(CODE)).toBe(true)
  })

  it('does not create Auth users', () => {
    expect(/INSERT\s+INTO\s+auth\.users/i.test(CODE)).toBe(false)
  })
})

describe('Stage 3C activation — suppressions are respected and never reversed', () => {
  it('reads active suppressions to decide enablement of a NEW external contact', () => {
    expect(
      /EXISTS\s*\(\s*SELECT 1 FROM public\.marketing_suppressions ms\s+WHERE ms\.revoked_at IS NULL AND ms\.email_lc = s\.email_lc\s*\)/i.test(
        CODE,
      ),
    ).toBe(true)
  })

  it('creates a suppressed external contact DISABLED rather than enabling it', () => {
    expect(/CASE WHEN f\.is_suppressed THEN false ELSE true END/i.test(CODE)).toBe(true)
  })

  it('never writes marketing_suppressions (no insert/update/revoke)', () => {
    expect(/INSERT\s+INTO\s+public\.marketing_suppressions/i.test(CODE)).toBe(false)
    expect(/UPDATE\s+public\.marketing_suppressions/i.test(CODE)).toBe(false)
    expect(/UPDATE\s+marketing_suppressions/i.test(CODE)).toBe(false)
    // No revoking of any suppression (no write of revoked_at).
    expect(/revoked_at\s*=/i.test(CODE)).toBe(false)
  })
})

describe('Stage 3C activation — set-based, not a per-user loop', () => {
  it('uses set-based INSERT ... SELECT and no row cursor / FOR-loop over users', () => {
    expect(/INSERT INTO public\.marketing_preferences[\s\S]*?SELECT/i.test(CODE)).toBe(true)
    // No PL/pgSQL row loop and no explicit cursor driving per-user work.
    expect(/\bFOR\b[^;]*\bIN\b[^;]*\bLOOP\b/i.test(CODE.replace(/FOREACH[^;]*;/gi, ''))).toBe(false)
    expect(/\bDECLARE\b[^;]*\bCURSOR\b/i.test(CODE)).toBe(false)
  })
})

describe('Stage 3C activation — no forbidden side effects', () => {
  it('creates or alters NO table, and drops nothing', () => {
    // The only table created is the transaction-local TEMP result carrier.
    expect(/CREATE TABLE (?!TEMP)/i.test(CODE)).toBe(false)
    expect(/\bALTER TABLE\b/i.test(CODE)).toBe(false)
    expect(/\bDROP TABLE\b/i.test(CODE)).toBe(false)
  })

  it('adds NO trigger and NO function/extension', () => {
    expect(/\bCREATE\s+(OR REPLACE\s+)?TRIGGER\b/i.test(CODE)).toBe(false)
    expect(/\bCREATE\s+(OR REPLACE\s+)?FUNCTION\b/i.test(CODE)).toBe(false)
    expect(/\bCREATE\s+EXTENSION\b/i.test(CODE)).toBe(false)
  })

  it('references NO checkout / wallet / ticket / entries table', () => {
    for (const re of [
      /\bcheckout_intents\b/i,
      /\bwallet_accounts\b/i,
      /\bwallet_/i,
      /\bentries\b/i,
      /\bticket_allocations\b/i,
      /\binstant_win/i,
    ]) {
      expect(re.test(CODE), re.source).toBe(false)
    }
  })

  it('inserts NO recipient and NO automation run', () => {
    expect(/INSERT\s+INTO\s+public\.marketing_recipients/i.test(CODE)).toBe(false)
    expect(/marketing_recipients/i.test(CODE)).toBe(false)
    expect(/INSERT\s+INTO\s+public\.marketing_automation_runs/i.test(CODE)).toBe(false)
    expect(/marketing_automation_runs/i.test(CODE)).toBe(false)
  })

  it('changes NO control state (reads only; no INSERT/UPDATE)', () => {
    expect(/UPDATE\s+public\.marketing_control_state/i.test(CODE)).toBe(false)
    expect(/UPDATE\s+marketing_control_state/i.test(CODE)).toBe(false)
    expect(/INSERT\s+INTO\s+public\.marketing_control_state/i.test(CODE)).toBe(false)
    // sending/discovery/rollout appear only in the read + assertion, never assigned.
    expect(/sending_enabled\s*=\s*(true|false)/i.test(CODE)).toBe(false)
    expect(/discovery_enabled\s*=\s*(true|false)/i.test(CODE)).toBe(false)
    expect(/rollout_limit\s*=\s*\d/i.test(CODE)).toBe(false)
  })

  it('adds NO email / Resend capability', () => {
    expect(/resend/i.test(CODE)).toBe(false)
    expect(/api\.resend\.com/i.test(CODE)).toBe(false)
    expect(/RESEND_API_KEY/i.test(CODE)).toBe(false)
  })

  it('does NOT call refresh_customer_marketing_profiles()', () => {
    expect(/refresh_customer_marketing_profiles/i.test(CODE)).toBe(false)
  })
})

describe('Stage 3C activation — returns one aggregate JSON, no PII', () => {
  it('returns every required aggregate key', () => {
    for (const key of [
      'totalAuthUsersConsidered',
      'existingPreferenceRowsPreserved',
      'authPreferencesInsertedFromPreRegistration',
      'authPreferencesInsertedFromExistingCustomerActivation',
      'externalPreRegistrationsInserted',
      'preRegistrationsMatchedToAuth',
      'suppressedExternalContactsNotEnabled',
      'finalEnabledPreferenceCount',
      'finalExternalEnabledCount',
    ]) {
      expect(FLAT, key).toContain(`'${key}'`)
    }
  })

  it('emits only aggregate counts (jsonb_build_object over count columns)', () => {
    expect(/jsonb_build_object\(/i.test(CODE)).toBe(true)
    // The final projection selects from the aggregate temp carrier, not raw rows.
    expect(/FROM _stage3c_activation_result r/i.test(CODE)).toBe(true)
  })
})
