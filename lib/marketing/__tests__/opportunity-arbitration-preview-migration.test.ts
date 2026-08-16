import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Static contract tests for
//   scripts/marketing/011-marketing-opportunity-detection-preview.sql
//
// These tests treat the migration as STATIC TEXT. They never open a database
// connection, never execute SQL, and never run detection. They assert the
// read-only safety, boundary, detection-coverage, scoring, arbitration and
// permission-separation guarantees of the Stage 3C2D preview.
// ---------------------------------------------------------------------------

const CODE = readFileSync(
  join(process.cwd(), 'scripts/marketing/011-marketing-opportunity-detection-preview.sql'),
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

// Executable view with BOTH comments and single-quoted string literals removed,
// so bans on executable identifiers (AI/email/cron function calls, etc.) are not
// satisfied by prose living inside COMMENT ON / jsonb string values.
const EXEC_NOSTR = EXEC.replace(/'(?:[^']|'')*'/g, "''")

// The full 28-definition catalogue seeded by migration 009.
const ALL_DEFINITIONS = [
  'vip_early_access',
  'abandoned_checkout',
  'wtf_credit_waiting',
  'regular_buyer_campaign_alert',
  'new_account_no_purchase',
  'lapsed_14_days',
  'recent_winner_follow_up',
  'recent_winner_credit_available',
  'first_win_follow_up',
  'high_value_winner_follow_up',
  'fresh_wallet_credit',
  'wallet_credit_campaign_match',
  'personal_cadence_overdue',
  'frequent_buyer_relevant_campaign',
  'vip_relevant_campaign',
  'reveal_affinity_campaign',
  'recently_active_no_relevant_entry',
  'first_to_second_purchase',
  'lapsed_7_days',
  'lapsed_30_days',
  'high_value_customer_at_risk',
  'vip_reactivation',
  'reactivated_customer_follow_up',
  'high_value_abandoned_checkout',
  'repeat_abandoner',
  'campaign_closing_relevant_customer',
  'recent_buyer_cross_campaign',
  'promotion_match',
]

const SUPPORTED_NOW = [
  'new_account_no_purchase',
  'first_to_second_purchase',
  'lapsed_7_days',
  'lapsed_14_days',
  'lapsed_30_days',
  'high_value_customer_at_risk',
  'vip_reactivation',
  'reactivated_customer_follow_up',
  'personal_cadence_overdue',
  'wtf_credit_waiting',
  'fresh_wallet_credit',
  'recent_winner_follow_up',
  'recent_winner_credit_available',
  'first_win_follow_up',
  'high_value_winner_follow_up',
  'abandoned_checkout',
  'repeat_abandoner',
]

const REQUIRES_CAMPAIGN = [
  'wallet_credit_campaign_match',
  'frequent_buyer_relevant_campaign',
  'vip_relevant_campaign',
  'reveal_affinity_campaign',
  'recently_active_no_relevant_entry',
  'recent_buyer_cross_campaign',
  'vip_early_access',
  'regular_buyer_campaign_alert',
  'campaign_closing_relevant_customer',
  'promotion_match',
]

const FUTURE_UNSUPPORTED = ['high_value_abandoned_checkout']

describe('011 preview — migration envelope', () => {
  it('is wrapped in a single atomic BEGIN;/COMMIT;', () => {
    const t = EXEC.trim()
    expect(t.startsWith('BEGIN;')).toBe(true)
    expect(t.endsWith('COMMIT;')).toBe(true)
    expect((EXEC.match(/\bBEGIN\s*;/g) || []).length).toBe(1)
    expect((EXEC.match(/\bCOMMIT\s*;/g) || []).length).toBe(1)
  })

  it('sets defensive LOCAL lock/statement timeouts', () => {
    expect(FLAT).toMatch(/SET LOCAL lock_timeout = '5s'/i)
    expect(FLAT).toMatch(/SET LOCAL statement_timeout = '60s'/i)
  })

  it('runs a read-only preflight with advisory lock and global-pause assertion', () => {
    expect(FLAT).toMatch(/pg_try_advisory_xact_lock\(hashtext\('wtf_marketing_stage_3c2d_detection_preview'\)\)/i)
    expect(FLAT).toMatch(/SELECT sending_enabled, discovery_enabled, rollout_limit INTO/i)
    expect(FLAT).toMatch(/v_sending IS DISTINCT FROM false OR v_discovery IS DISTINCT FROM false OR v_rollout\s+IS DISTINCT FROM 0/i)
  })

  it('does not reference or execute the obsolete migration 008', () => {
    expect(/008-marketing-opportunity-detection-preview/i.test(EXEC)).toBe(false)
  })
})

describe('011 preview — inert install (NO writes / NO state change)', () => {
  it('performs no INSERT / UPDATE / DELETE / MERGE / TRUNCATE anywhere', () => {
    expect(/\bINSERT\s+INTO\b/i.test(EXEC)).toBe(false)
    expect(/\bUPDATE\s+public\./i.test(EXEC)).toBe(false)
    expect(/\bDELETE\s+FROM\b/i.test(EXEC)).toBe(false)
    expect(/\bMERGE\b/i.test(EXEC)).toBe(false)
    expect(/\bTRUNCATE\b/i.test(EXEC)).toBe(false)
    expect(/ON CONFLICT/i.test(EXEC)).toBe(false)
  })

  it('creates NO table, NO trigger, NO extension, and ALTERs nothing', () => {
    expect(/\bCREATE\s+TABLE\b/i.test(EXEC)).toBe(false)
    expect(/\bCREATE\s+TRIGGER\b/i.test(EXEC)).toBe(false)
    expect(/\bCREATE\s+EXTENSION\b/i.test(EXEC)).toBe(false)
    expect(/\bALTER\s+TABLE\b/i.test(EXEC)).toBe(false)
    expect(/\bDROP\s+TABLE\b/i.test(EXEC)).toBe(false)
  })

  it('never writes the opportunity ledger, recipients or runs', () => {
    expect(/INSERT[^;]*marketing_opportunities/i.test(FLAT_EXEC)).toBe(false)
    expect(/UPDATE[^;]*marketing_opportunities/i.test(FLAT_EXEC)).toBe(false)
    expect(/marketing_recipients/i.test(EXEC)).toBe(false)
    expect(/marketing_automation_runs?/i.test(EXEC)).toBe(false)
  })

  it('never enables a definition or mutates control state', () => {
    expect(/UPDATE[^;]*marketing_opportunity_definitions/i.test(FLAT_EXEC)).toBe(false)
    expect(/enabled\s*=\s*true/i.test(EXEC)).toBe(false)
    expect(/UPDATE[^;]*marketing_control_state/i.test(FLAT_EXEC)).toBe(false)
    expect(/sending_enabled\s*=\s*true/i.test(EXEC)).toBe(false)
    expect(/discovery_enabled\s*=\s*true/i.test(EXEC)).toBe(false)
    expect(/rollout_limit\s*=\s*[1-9]/i.test(EXEC)).toBe(false)
  })

  it('adds NO AI, NO email/Resend, NO cron', () => {
    // EXEC_NOSTR: comments AND string literals stripped, so a COMMENT ON that
    // promises "no AI/cron/email" cannot trip these executable-identifier bans.
    expect(/\b(openai|anthropic|ai_gateway|generatetext|streamtext|embeddings?|gpt|llm)\b/i.test(EXEC_NOSTR)).toBe(false)
    expect(/\b(resend|smtp|sendmail|nodemailer|mailgun|send_email)\b/i.test(EXEC_NOSTR)).toBe(false)
    expect(/\b(cron|pg_cron|cron\.schedule)\b/i.test(EXEC_NOSTR)).toBe(false)
  })
})

describe('011 preview — reads only rollups + config (no operational scan)', () => {
  it('reads the three rollup substrates', () => {
    expect(FLAT).toMatch(/FROM public\.customer_marketing_profiles/i)
    expect(FLAT).toMatch(/public\.customer_marketing_intelligence/i)
    expect(FLAT).toMatch(/public\.customer_campaign_affinity/i)
  })

  it('joins only the small campaign / promotion / automation config tables', () => {
    expect(FLAT).toMatch(/FROM public\.campaigns/i)
    expect(FLAT).toMatch(/public\.marketing_campaign_promotions/i)
    expect(FLAT).toMatch(/public\.marketing_automations/i)
  })

  it('NEVER scans operational history (checkouts / awards / wallet ledger)', () => {
    // Assert no FROM/JOIN of any operational table. (A table name may appear
    // inside an explanatory JSON reason string, which is not a scan.)
    for (const t of [
      'checkout_intents',
      'instant_win_awards',
      'wallet_transactions',
      'wallet_reservations',
    ]) {
      expect(new RegExp(`\\b(FROM|JOIN)\\s+public\\.${t}\\b`, 'i').test(EXEC)).toBe(false)
    }
  })

  it('never scans auth.users', () => {
    expect(/auth\.users/i.test(EXEC)).toBe(false)
  })

  it('is set-based — no PL/pgSQL per-customer loop', () => {
    expect(/FOR\s+\w+\s+IN\s+SELECT/i.test(EXEC)).toBe(false)
    // The only LOOP is the preflight dependency FOREACH; ignore it, assert none else.
    const withoutPreflight = EXEC.replace(/FOREACH v_dep IN ARRAY[\s\S]*?END LOOP;/i, '')
    expect(/\bLOOP\b/i.test(withoutPreflight)).toBe(false)
    expect(/\bWHILE\b/i.test(EXEC)).toBe(false)
  })

  it('does not SELECT * over a base table', () => {
    // A bare "SELECT * FROM public.<table>" is banned; "SELECT * FROM
    // public.<fn>()" (a set-returning preview function) is allowed.
    const matches = FLAT.match(/SELECT\s+\*\s+FROM\s+public\.\w+(\s*\()?/gi) || []
    const baseTableStars = matches.filter((m) => !/\(\s*$/.test(m))
    expect(baseTableStars).toEqual([])
  })
})

describe('011 preview — broad catalogue, not the original six', () => {
  it('uses the authoritative definitions catalogue for family/priority/score', () => {
    expect(FLAT).toMatch(/JOIN public\.marketing_opportunity_definitions def ON def\.opportunity_key = rc\.opportunity_key/i)
  })

  it('detects every SUPPORTED_NOW definition', () => {
    for (const k of SUPPORTED_NOW) {
      expect(FLAT_EXEC).toMatch(new RegExp(`\\('${k}',`, 'i'))
    }
  })

  it('detects every REQUIRES_CAMPAIGN definition', () => {
    for (const k of REQUIRES_CAMPAIGN) {
      expect(FLAT_EXEC).toMatch(new RegExp(`\\('${k}',`, 'i'))
    }
  })

  it('implements exactly 27 of the 28 catalogue definitions', () => {
    const implemented = ALL_DEFINITIONS.filter((k) =>
      new RegExp(`\\('${k}',`, 'i').test(FLAT_EXEC),
    )
    expect(implemented.sort()).toEqual(
      ALL_DEFINITIONS.filter((k) => !FUTURE_UNSUPPORTED.includes(k)).sort(),
    )
    expect(implemented).toHaveLength(27)
  })

  it('declares high_value_abandoned_checkout UNSUPPORTED (never invented) with a reason', () => {
    expect(/\('high_value_abandoned_checkout',/i.test(FLAT_EXEC)).toBe(false)
    expect(FLAT).toMatch(/'futureUnsupported', jsonb_build_array\( 'high_value_abandoned_checkout' \)/i)
    expect(FLAT).toMatch(/highValueAbandonedCheckoutUnsupportedReason/i)
  })

  it('publishes a support matrix partitioning the catalogue', () => {
    expect(FLAT).toMatch(/'supportedNow', jsonb_build_array\(/i)
    expect(FLAT).toMatch(/'requiresCampaignContext', jsonb_build_array\(/i)
    expect(FLAT).toMatch(/'futureUnsupported', jsonb_build_array\(/i)
    for (const k of SUPPORTED_NOW) {
      expect(FLAT).toMatch(new RegExp(`'supportedNow'[\\s\\S]*'${k}'`, 'i'))
    }
    for (const k of REQUIRES_CAMPAIGN) {
      expect(FLAT).toMatch(new RegExp(`'requiresCampaignContext'[\\s\\S]*'${k}'`, 'i'))
    }
  })
})

describe('011 preview — no loss / gambling-harm signals', () => {
  it('derives no loss / near-miss / streak / probability logic', () => {
    // Word-boundaried so legitimate tokens like "purchase" (which contains
    // "chase") are not false-positives.
    expect(
      /losing_streak|loss_streak|near_miss|near-miss|due_to_win|win_probability|overdue_win|\bchas(e|ing)\b|chase_loss|cumulative_loss|financial_vulnerab|deposit_escalat/i.test(
        EXEC,
      ),
    ).toBe(false)
  })

  it('uses win data only as positive engagement (no predictive/streak framing)', () => {
    expect(FLAT).toMatch(/winner_c/i)
    expect(/likely to win|due another|ride the win|hot streak/i.test(CODE)).toBe(false)
  })
})

describe('011 preview — feature provenance', () => {
  it('wallet CURRENT balance comes from the profile', () => {
    expect(FLAT).toMatch(/p\.wallet_available_pence/i)
  })

  it('win history comes from intelligence', () => {
    expect(FLAT).toMatch(/i\.last_win_at/i)
    expect(FLAT).toMatch(/i\.win_count/i)
    expect(FLAT).toMatch(/i\.last_win_value_pence/i)
  })

  it('abandonment comes from intelligence (rollup), not a checkout re-scan', () => {
    expect(FLAT).toMatch(/i\.abandoned_7d_count/i)
    expect(FLAT).toMatch(/i\.abandoned_30d_count/i)
    expect(FLAT).toMatch(/i\.last_abandoned_at/i)
  })

  it('cadence comes from intelligence with a documented minimum gap floor', () => {
    expect(FLAT).toMatch(/i\.average_purchase_gap_hours/i)
    expect(FLAT).toMatch(/GREATEST\(b\.average_purchase_gap_hours, 12\.0\)/i)
    expect(FLAT).toMatch(/cadenceMinimumGapFloorHours', 12/i)
    expect(FLAT).toMatch(/cadenceOverdueRatioThreshold', 1\.5/i)
  })

  it('campaign affinity comes from the affinity table (structured only, never titles)', () => {
    expect(FLAT).toMatch(/FROM public\.customer_campaign_affinity/i)
    expect(FLAT).toMatch(/affinity_type IN \('reveal_type', 'presentation_type'\)/i)
    // No inference from campaign free-text.
    expect(/\bc\.(title|slug|summary|description)\b/i.test(EXEC)).toBe(false)
  })

  it('uses the established VIP / frequent-buyer commercial definitions', () => {
    expect(FLAT).toMatch(/confirmed_order_count >= 10 OR b\.lifetime_external_pence >= 25000/i)
    expect(FLAT).toMatch(/b\.confirmed_order_count >= 5/i)
  })

  it('live campaign universe is status = live; closing uses end_at within 48h', () => {
    expect(FLAT).toMatch(/WHERE c\.status = 'live'/i)
    expect(FLAT).toMatch(/c\.end_at <= now\(\) \+ interval '48 hours'/i)
  })
})

describe('011 preview — deterministic bounded score', () => {
  it('clamps the final score to 0..1000', () => {
    expect(FLAT).toMatch(/LEAST\(1000, GREATEST\(0,/i)
  })

  it('exposes transparent score components including a base and final', () => {
    for (const key of ['base', 'value', 'recency', 'cadence', 'wallet', 'winner', 'affinity', 'urgency', 'abandon', 'final']) {
      expect(FLAT).toMatch(new RegExp(`'${key}',`, 'i'))
    }
  })

  it('starts the score from the catalogue default_score (no opaque magic base)', () => {
    expect(FLAT).toMatch(/round\(s\.default_score\)::int \+ s\.value_c \+ s\.recency_c/i)
  })

  it('incorporates definition priority as a score/arbitration input', () => {
    expect(FLAT).toMatch(/def\.default_priority/i)
  })
})

describe('011 preview — arbitration (one winner per customer)', () => {
  it('uses a window ROW_NUMBER partitioned by user_id (no procedural loop)', () => {
    expect(FLAT).toMatch(/ROW_NUMBER\(\) OVER \( PARTITION BY f\.user_id ORDER BY/i)
  })

  it('orders by default_priority, then final_score, then urgency, then key', () => {
    expect(FLAT).toMatch(
      /ORDER BY f\.default_priority ASC, f\.final_score DESC, f\.is_closing DESC, f\.opportunity_key ASC/i,
    )
  })

  it('treats rn = 1 as the single winner per customer', () => {
    expect(FLAT).toMatch(/WHERE rn = 1/i)
  })
})

describe('011 preview — permission separate from detection', () => {
  it('does NOT filter detection by marketing permission', () => {
    expect(FLAT).toMatch(/FROM public\.customer_marketing_profiles p LEFT JOIN public\.customer_marketing_intelligence/i)
    expect(/WHERE[^;]*marketing_eligible_snapshot\s*=\s*true/i.test(FLAT_EXEC)).toBe(false)
    expect(/WHERE[^;]*p\.marketing_enabled/i.test(FLAT_EXEC)).toBe(false)
  })

  it('reports a three-way permission split on winners', () => {
    expect(FLAT).toMatch(/perm_backed/i)
    expect(FLAT).toMatch(/perm_suppressed/i)
    expect(FLAT).toMatch(/perm_not_backed/i)
    expect(FLAT).toMatch(/'winningPermissionBacked',\s*\(SELECT count\(\*\)::bigint FROM winners WHERE perm_backed\)/i)
    expect(FLAT).toMatch(/'winningNotPermissionBacked'/i)
    expect(FLAT).toMatch(/'winningSuppressed'/i)
  })

  it('derives permission from authoritative profile fields', () => {
    expect(FLAT).toMatch(/c\.marketing_eligible_snapshot AND NOT c\.has_active_suppression/i)
    expect(FLAT).toMatch(/c\.has_active_suppression\s+AS perm_suppressed/i)
  })
})

describe('011 preview — overview RPC payload', () => {
  it('is STABLE, SECURITY DEFINER, fixed search_path, declarative timeout', () => {
    expect(FLAT).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_admin_marketing_opportunity_detection_preview\(\) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '10s'/i,
    )
  })

  it('returns population / overlap / permission / counts / families / support', () => {
    expect(FLAT).toMatch(/'population', jsonb_build_object\(/i)
    expect(FLAT).toMatch(/'overlap', jsonb_build_object\(/i)
    expect(FLAT).toMatch(/'permission', jsonb_build_object\(/i)
    expect(FLAT).toMatch(/'countByOpportunityType'/i)
    expect(FLAT).toMatch(/'winningCountByOpportunityType'/i)
    expect(FLAT).toMatch(/'families', jsonb_build_object\(/i)
    expect(FLAT).toMatch(/'support', jsonb_build_object\(/i)
  })

  it('returns the required overlap distribution metrics', () => {
    for (const k of ['one', 'two', 'threePlus', 'maxForOneCustomer', 'totalCandidates', 'uniqueCustomers']) {
      expect(FLAT).toMatch(new RegExp(`'${k}',`, 'i'))
    }
  })

  it('returns aggregates only — no identities/emails/row payloads in the overview body', () => {
    const start = EXEC.indexOf('FUNCTION public.get_admin_marketing_opportunity_detection_preview')
    const end = EXEC.indexOf('$$;', start)
    const body = EXEC.slice(start, end)
    expect(/email/i.test(body)).toBe(false)
    expect(/jsonb_agg/i.test(body)).toBe(false)
    expect(/md5\(/i.test(body)).toBe(false)
  })

  it('is service-role-only EXECUTE', () => {
    expect(FLAT).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_admin_marketing_opportunity_detection_preview\(\) FROM public, anon, authenticated/i,
    )
    expect(FLAT).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_admin_marketing_opportunity_detection_preview\(\) TO service_role/i,
    )
  })
})

describe('011 preview — sample RPC payload', () => {
  it('is STABLE, SECURITY DEFINER, fixed search_path, declarative timeout', () => {
    expect(FLAT).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_admin_marketing_opportunity_preview_sample\(p_limit integer DEFAULT 25\) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '10s'/i,
    )
  })

  it('hard-caps the sample at 100 rows', () => {
    expect(FLAT).toMatch(/LEAST\(GREATEST\(COALESCE\(p_limit, 25\), 1\), 100\)/i)
    expect(FLAT).toMatch(/LIMIT v_limit/i)
  })

  it('returns an opaque user hash — never raw user_id, email or name', () => {
    expect(FLAT).toMatch(/'userHash',\s*substr\(md5\(user_id::text\), 1, 12\)/i)
    const start = EXEC.indexOf('FUNCTION public.get_admin_marketing_opportunity_preview_sample')
    const end = EXEC.indexOf('$$;', start)
    const body = EXEC.slice(start, end)
    expect(/'email'|'name'|email_lc/i.test(body)).toBe(false)
    expect(/'userId'|'user_id'/i.test(body)).toBe(false)
  })

  it('exposes score components + compact reason flags in the sample', () => {
    expect(FLAT).toMatch(/'scoreComponents',\s*score_components/i)
    expect(FLAT).toMatch(/'opportunityKey',\s*opportunity_key/i)
    expect(FLAT).toMatch(/'reasons', jsonb_build_object\(/i)
  })

  it('is service-role-only EXECUTE', () => {
    expect(FLAT).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_admin_marketing_opportunity_preview_sample\(integer\) FROM public, anon, authenticated/i,
    )
    expect(FLAT).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_admin_marketing_opportunity_preview_sample\(integer\) TO service_role/i,
    )
  })
})

describe('011 preview — private candidate model security', () => {
  it('the shared candidate model is owner-only (EXECUTE granted to nobody)', () => {
    expect(FLAT).toMatch(
      /REVOKE ALL ON FUNCTION public\.wtf_marketing_opportunity_candidates_preview\(\) FROM public, anon, authenticated/i,
    )
    expect(FLAT).toMatch(
      /REVOKE ALL ON FUNCTION public\.wtf_marketing_opportunity_candidates_preview\(\) FROM service_role/i,
    )
    expect(
      /GRANT EXECUTE ON FUNCTION public\.wtf_marketing_opportunity_candidates_preview/i.test(EXEC),
    ).toBe(false)
  })

  it('is STABLE + SECURITY DEFINER + fixed search_path + declarative timeout', () => {
    expect(FLAT).toMatch(
      /CREATE OR REPLACE FUNCTION public\.wtf_marketing_opportunity_candidates_preview\(\)[\s\S]*?LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '10s'/i,
    )
  })

  it('both public RPCs consume the single shared candidate model', () => {
    expect(
      (FLAT.match(/FROM public\.wtf_marketing_opportunity_candidates_preview\(\)/gi) || []).length,
    ).toBeGreaterThanOrEqual(2)
  })
})
