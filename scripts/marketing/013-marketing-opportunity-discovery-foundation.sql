-- ============================================================================
-- WTF Marketing Hub — Stage 3C2F: CONTROLLED OPPORTUNITY DISCOVERY / PERSISTENCE
-- ----------------------------------------------------------------------------
-- PURPOSE
--   Install the controlled PERSISTENCE ENGINE that can LATER turn the current
--   read-only winning next-best-action preview into durable rows in
--   public.marketing_opportunities.
--
--   The authoritative detector/arbitrator is UNCHANGED and REUSED:
--     public.wtf_marketing_opportunity_candidates_preview()
--   This migration does NOT reproduce detection, does NOT re-scan operational
--   history, and does NOT independently calculate opportunities. It persists
--   ONLY the rn = 1 (selected next-best-action) candidate per user.
--
-- INSTALLATION IS COMPLETELY INERT
--   * Running THIS migration creates ZERO opportunity rows. It only creates ONE
--     function (the discovery RPC) and asserts the hub is still paused/inert.
--   * With the CURRENT production state (discovery_enabled = false, enabled
--     definitions = 0, rollout_limit = 0) there is NO behavioural change: even
--     if the RPC were invoked, BOTH the discovery gate AND the per-definition
--     enablement gate independently force zero writes.
--
-- GATES (all independent; ALL must pass before any write)
--   1. discovery_enabled = true  (marketing_control_state, key = 'default').
--      sending_enabled is IRRELEVANT here — discovery and sending are separate.
--   2. The candidate's definition row must have enabled = true.
--   3. Only rn = 1 winners are ever persisted.
--
-- PERMISSION / SENDABILITY IS NOT A DISCOVERY FILTER
--   Commercial opportunity != permission != sendability. This engine NEVER
--   filters candidates on perm_backed / perm_suppressed / perm_not_backed /
--   sendable_now / marketing_enabled. Those remain LATER deterministic
--   recipient/send gates.
--
-- IDEMPOTENCY / DEDUPE (uses the EXISTING schema only)
--   marketing_opportunities has a single GLOBAL unique index on dedupe_key
--   (marketing_opportunities_dedupe_key_uidx). No partial "active" unique index
--   exists. Safe recurring persistence is achieved WITHOUT any schema change by:
--     (a) serialising discovery runs with a transaction advisory lock (no two
--         runs persist at once);
--     (b) a NOT EXISTS guard that skips a candidate while an ACTIVE
--         (open/selected/deferred and not-yet-expired) opportunity already
--         exists for the same (user_id, opportunity_type, campaign_id);
--     (c) a DETERMINISTIC, date-bucketed dedupe_key so a NEW generation can be
--         created after the previous one expires, while repeated runs within the
--         same day are a hard no-op via ON CONFLICT (dedupe_key) DO NOTHING.
--   (a)+(b) prevent duplicate ACTIVE opportunities; (c) both enables future
--   recurrence and provides a database-level idempotency backstop.
--
-- IDENTITY
--   USER opportunities only (candidate.user_id). NO external-contact discovery
--   in this stage. The existing identity XOR constraint is preserved:
--   external_contact_id stays NULL.
--
-- SECURITY
--   The discovery RPC is SECURITY DEFINER, SET search_path = public, pg_temp,
--   service_role-only EXECUTE (revoked from public/anon/authenticated). It calls
--   wtf_marketing_opportunity_candidates_preview() internally AS OWNER (that
--   function's EXECUTE is revoked from service_role, exactly like the existing
--   admin wrappers). RLS on marketing_opportunities remains ENABLED + FORCED and
--   all existing grants/policies are untouched.
--
-- ABSOLUTELY DOES NOT
--   Enable discovery/sending, change rollout_limit, enable any definition,
--   create an opportunity/recipient/run at install, send email, call Resend,
--   add cron/AI, modify checkout/payments/tickets/wallet/signup/public pages,
--   scan checkout_intents/instant_win_awards/wallet_transactions/auth.users, or
--   modify migrations 001-012.
--
-- HOW TO RUN
--   The application NEVER executes this. Run it manually ONCE in the Supabase
--   SQL editor (or psql), AFTER migrations 001-012, while Marketing is paused.
--   This file is committed as a reviewable artifact and has NOT been executed.
-- ============================================================================

BEGIN;

-- Fail fast rather than block a busy production database; never run away.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ----------------------------------------------------------------------------
-- Install-time preflight (READ-ONLY): dependency check + single-execution
-- advisory lock + global-pause / inert-state assertions. Any failure RAISES and
-- rolls the whole migration back BEFORE the function is created. This migration
-- creates/alters NONE of the dependency objects and mutates NO control state.
-- ----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_missing        text[] := ARRAY[]::text[];
  v_dep            text;
  v_sending        boolean;
  v_discovery      boolean;
  v_rollout        integer;
  v_enabled_defs   bigint;
  v_opp_count      bigint;
BEGIN
  -- 1. Required tables must exist.
  FOREACH v_dep IN ARRAY ARRAY[
    'public.marketing_opportunities',
    'public.marketing_opportunity_definitions',
    'public.marketing_control_state',
    'public.customer_marketing_profiles',
    'public.customer_marketing_intelligence',
    'public.customer_campaign_affinity'
  ] LOOP
    IF to_regclass(v_dep) IS NULL THEN
      v_missing := array_append(v_missing, v_dep);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Stage 3C2F migration aborted: required dependency % is missing. Run migrations 001-012 first.',
      array_to_string(v_missing, ', ');
  END IF;

  -- 2. The authoritative Stage 011 candidate/arbitrator function must exist.
  IF to_regprocedure('public.wtf_marketing_opportunity_candidates_preview()') IS NULL THEN
    RAISE EXCEPTION
      'Stage 3C2F migration aborted: public.wtf_marketing_opportunity_candidates_preview() is missing. Run migration 011 first.';
  END IF;

  -- 3. Migration-specific advisory key (fixed for THIS migration only).
  IF NOT pg_try_advisory_xact_lock(hashtext('wtf_marketing_stage_3c2f_discovery_foundation')) THEN
    RAISE EXCEPTION
      'Stage 3C2F migration aborted: another execution is already in progress (advisory lock held).';
  END IF;

  -- 4. The Marketing Hub must still be GLOBALLY PAUSED / inert.
  SELECT sending_enabled, discovery_enabled, rollout_limit
    INTO v_sending, v_discovery, v_rollout
    FROM public.marketing_control_state
   WHERE key = 'default';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Stage 3C2F migration aborted: marketing_control_state singleton (key=''default'') not found; cannot confirm Marketing is paused.';
  END IF;

  IF v_sending IS DISTINCT FROM false
     OR v_discovery IS DISTINCT FROM false
     OR v_rollout   IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION
      'Stage 3C2F migration aborted: Marketing is not globally paused (sending_enabled=%, discovery_enabled=%, rollout_limit=%). Refusing to install.',
      v_sending, v_discovery, v_rollout;
  END IF;

  -- 5. No opportunity definition may be enabled yet (foundation install).
  SELECT count(*) INTO v_enabled_defs
    FROM public.marketing_opportunity_definitions
   WHERE enabled = true;
  IF v_enabled_defs <> 0 THEN
    RAISE EXCEPTION
      'Stage 3C2F migration aborted: % opportunity definition(s) are already enabled; expected 0 at foundation install.',
      v_enabled_defs;
  END IF;

  -- 6. The opportunity ledger must be empty (initial foundation installation).
  SELECT count(*) INTO v_opp_count FROM public.marketing_opportunities;
  IF v_opp_count <> 0 THEN
    RAISE EXCEPTION
      'Stage 3C2F migration aborted: marketing_opportunities contains % row(s); expected 0 at foundation install.',
      v_opp_count;
  END IF;
END
$preflight$;

-- ============================================================================
-- discover_marketing_opportunities(p_limit)
--   The controlled persistence engine. Set-based (NO per-customer loop). Reuses
--   wtf_marketing_opportunity_candidates_preview() as the sole detector and
--   persists ONLY the rn = 1 winner per user, subject to the discovery gate, the
--   per-definition enablement gate, the campaign-context invariant, and the
--   active-duplicate guard. Returns ONE compact JSON result (NO identities).
--
--   Bounded: p_limit defaults to 100 and is clamped to [1, 500]. There is no
--   unbounded insert path.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.discover_marketing_opportunities(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
SET lock_timeout = '5s'
SET statement_timeout = '30s'
AS $$
DECLARE
  v_start            timestamptz := clock_timestamp();
  v_now              timestamptz := now();
  v_limit            integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_discovery        boolean;
  v_evaluated        bigint := 0;
  v_eligible         bigint := 0;
  v_skipped_existing bigint := 0;
  v_skipped_disabled bigint := 0;
  v_inserted         bigint := 0;
BEGIN
  -- DISCOVERY GATE. sending_enabled is intentionally NOT considered here.
  SELECT discovery_enabled INTO v_discovery
    FROM public.marketing_control_state
   WHERE key = 'default';

  IF NOT FOUND OR v_discovery IS DISTINCT FROM true THEN
    RETURN jsonb_build_object(
      'ok', true,
      'status', 'discovery_disabled',
      'evaluated', 0,
      'eligible', 0,
      'inserted', 0,
      'skippedExisting', 0,
      'skippedDisabledDefinition', 0,
      'durationMs', round(extract(epoch FROM clock_timestamp() - v_start) * 1000)::bigint,
      'generatedAt', v_now
    );
  END IF;

  -- CONCURRENCY. Only one discovery run may persist at a time; this makes the
  -- NOT EXISTS active-duplicate guard race-safe. Bail cleanly if another run
  -- already holds the lock.
  IF NOT pg_try_advisory_xact_lock(hashtext('wtf_marketing_stage_3c2f_discovery_run')) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'status', 'locked',
      'evaluated', 0,
      'eligible', 0,
      'inserted', 0,
      'skippedExisting', 0,
      'skippedDisabledDefinition', 0,
      'durationMs', round(extract(epoch FROM clock_timestamp() - v_start) * 1000)::bigint,
      'generatedAt', v_now
    );
  END IF;

  -- Materialise the rn = 1 winners ONCE (the detector is the expensive part),
  -- joined to their definition (enablement + expiry + campaign-specificity) and
  -- to their marketing profile (for the NOT NULL email_lc). Re-callable within a
  -- single transaction via DROP IF EXISTS.
  DROP TABLE IF EXISTS tmp_disc_winners;
  CREATE TEMP TABLE tmp_disc_winners ON COMMIT DROP AS
  SELECT
    c.user_id,
    c.opportunity_key,
    c.family,
    c.default_priority,
    c.final_score,
    c.campaign_id,
    c.score_components,
    c.is_closing,
    p.email_lc,
    (d.opportunity_key IS NOT NULL)                                  AS def_found,
    COALESCE(d.enabled, false)                                       AS def_enabled,
    COALESCE(d.campaign_specific, false)                             AS campaign_specific,
    d.default_expiry_hours,
    -- Commercial eligibility: enabled definition, campaign-context invariant
    -- honoured, and a usable email present. Permission/sendability NOT involved.
    (
      d.opportunity_key IS NOT NULL
      AND COALESCE(d.enabled, false) = true
      AND p.email_lc IS NOT NULL
      AND (COALESCE(d.campaign_specific, false) = false OR c.campaign_id IS NOT NULL)
    )                                                                AS is_eligible
  FROM public.wtf_marketing_opportunity_candidates_preview() c
  LEFT JOIN public.marketing_opportunity_definitions d
         ON d.opportunity_key = c.opportunity_key
  LEFT JOIN public.customer_marketing_profiles p
         ON p.user_id = c.user_id
  WHERE c.rn = 1;

  SELECT count(*) INTO v_evaluated FROM tmp_disc_winners;

  SELECT count(*) INTO v_skipped_disabled
    FROM tmp_disc_winners
   WHERE NOT (def_found AND def_enabled);

  SELECT count(*) INTO v_eligible
    FROM tmp_disc_winners
   WHERE is_eligible;

  -- Eligible winners that already have an ACTIVE opportunity are skipped (no
  -- duplicate active). Active = open/selected/deferred and not yet expired.
  SELECT count(*) INTO v_skipped_existing
    FROM tmp_disc_winners w
   WHERE w.is_eligible
     AND EXISTS (
       SELECT 1
         FROM public.marketing_opportunities o
        WHERE o.user_id = w.user_id
          AND o.opportunity_type = w.opportunity_key
          AND o.campaign_id IS NOT DISTINCT FROM w.campaign_id
          AND o.state IN ('open', 'selected', 'deferred')
          AND o.expires_at > v_now
     );

  -- Bounded, deterministic, set-based persistence of the top eligible winners
  -- that have no active duplicate. ON CONFLICT (dedupe_key) DO NOTHING makes a
  -- same-day repeat run (or a concurrent duplicate key) a hard no-op.
  WITH to_persist AS (
    SELECT
      w.user_id,
      w.opportunity_key,
      w.family,
      w.default_priority,
      w.final_score,
      w.campaign_id,
      w.score_components,
      w.is_closing,
      w.email_lc,
      w.default_expiry_hours
    FROM tmp_disc_winners w
    WHERE w.is_eligible
      AND NOT EXISTS (
        SELECT 1
          FROM public.marketing_opportunities o
         WHERE o.user_id = w.user_id
           AND o.opportunity_type = w.opportunity_key
           AND o.campaign_id IS NOT DISTINCT FROM w.campaign_id
           AND o.state IN ('open', 'selected', 'deferred')
           AND o.expires_at > v_now
      )
    ORDER BY w.final_score DESC, w.default_priority ASC, w.user_id ASC
    LIMIT v_limit
  )
  INSERT INTO public.marketing_opportunities (
    user_id,
    external_contact_id,
    email_lc,
    automation_id,
    opportunity_type,
    campaign_id,
    promotion_id,
    detected_at,
    expires_at,
    base_priority,
    score,
    state,
    reason,
    context_snapshot,
    dedupe_key
  )
  SELECT
    tp.user_id,
    NULL,                                   -- external_contact_id: user-only (identity XOR)
    tp.email_lc,
    NULL,                                   -- automation_id: optional provenance, none here
    tp.opportunity_key,                     -- opportunity_type -> definitions FK
    tp.campaign_id,                         -- preserve real campaign context
    NULL,                                   -- promotion_id: no promotion context from candidates
    v_now,
    v_now + make_interval(hours => tp.default_expiry_hours),
    tp.default_priority,                    -- base_priority (>= 1)
    tp.final_score,                         -- score, already clamped to 0..1000 by the detector
    'open',
    jsonb_build_object(
      'definitionKey', tp.opportunity_key,
      'family',        tp.family,
      'detector',      'wtf_marketing_opportunity_candidates_preview',
      'stage',         '3C2F',
      'basePriority',  tp.default_priority,
      'finalScore',    tp.final_score,
      'isClosing',     tp.is_closing
    ),
    jsonb_build_object(
      'scoreComponents',          tp.score_components,
      'campaignId',               tp.campaign_id,
      'detectorStage',            '3C2F',
      'selectedAsNextBestAction', true,
      'rn',                       1
    ),
    -- Deterministic, date-bucketed idempotency spine (<= 300 chars). The day
    -- bucket lets a fresh generation appear only AFTER the prior one expires,
    -- while same-day retries collide on the unique index and are ignored.
    'discv1:' || tp.user_id::text
      || ':' || tp.opportunity_key
      || ':' || COALESCE(tp.campaign_id::text, '-')
      || ':' || to_char((v_now AT TIME ZONE 'UTC')::date, 'YYYYMMDD')
  FROM to_persist tp
  ON CONFLICT (dedupe_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'ok',
    'evaluated', v_evaluated,
    'eligible', v_eligible,
    'inserted', v_inserted,
    'skippedExisting', v_skipped_existing,
    'skippedDisabledDefinition', v_skipped_disabled,
    'durationMs', round(extract(epoch FROM clock_timestamp() - v_start) * 1000)::bigint,
    'generatedAt', v_now
  );
END
$$;

COMMENT ON FUNCTION public.discover_marketing_opportunities(integer) IS
  'Stage 3C2F controlled persistence engine. Reuses wtf_marketing_opportunity_candidates_preview() as the sole detector/arbitrator and persists ONLY rn=1 winners into marketing_opportunities. Gated on discovery_enabled=true AND per-definition enabled=true; NEVER filters on permission/sendability. Set-based, advisory-locked, bounded p_limit in [1,500] (default 100). Idempotent via NOT EXISTS active guard + date-bucketed dedupe_key (existing global unique index). Returns compact JSON stats (no identities/emails). Service-role only.';

-- ============================================================================
-- Security: service_role-only EXECUTE. The function is SECURITY DEFINER and
-- calls the (service_role-revoked) detector internally as owner.
-- ============================================================================
REVOKE ALL ON FUNCTION public.discover_marketing_opportunities(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discover_marketing_opportunities(integer) TO service_role;

COMMIT;

-- ============================================================================
-- POST-CONDITIONS (informational):
--   * Exactly ONE new function created: discover_marketing_opportunities(integer).
--   * ZERO opportunity rows created by this installation.
--   * marketing_control_state UNCHANGED (still sending=false/discovery=false/
--     rollout_limit=0); no definition enabled; ledger still empty.
--   * With discovery_enabled=false the RPC short-circuits to
--     {"ok":true,"status":"discovery_disabled","inserted":0} and writes nothing.
--   * No detector/scoring/schema change; no recipients/runs/email/cron/AI.
-- ============================================================================
