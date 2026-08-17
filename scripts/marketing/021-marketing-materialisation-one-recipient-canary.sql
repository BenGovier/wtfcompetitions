-- ============================================================================
-- WTF Marketing Hub — Stage 3D2C: ONE-RECIPIENT MATERIALISATION CANARY
-- ----------------------------------------------------------------------------
-- MIGRATION 021 (MANUAL, ONE-TIME CANARY — NOT part of the automatic chain)
--
-- PURPOSE
--   Prove the ENTIRE Stage 019/020 recipient chain end-to-end, ONCE, without
--   sending anything:
--
--       permission-backed user
--         -> valid new_account_no_purchase opportunity (direct insert)
--         -> authoritative Stage 019 delivery route
--         -> canonical Stage 019 private recipient gate (gate_eligible = true)
--         -> preparing Stage 020 automation run
--         -> exactly ONE queued recipient
--         -> opportunity open -> selected
--
--   The canary INTENTIONALLY leaves behind, as durable proof of materialisation:
--       + 1 additional marketing_opportunity   (state = selected)
--       + 1 marketing_recipient                (status = queued, unsent)
--       + 1 marketing_automation_run           (status = preparing)
--
--   The recipient MUST remain UNSENT.
--
-- ABSOLUTE SAFETY RULE
--   GLOBAL SENDING (marketing_control_state.sending_enabled) MUST REMAIN false
--   FOR THE ENTIRE TRANSACTION. This canary:
--     * NEVER enables sending, NEVER enables discovery.
--     * NEVER calls a provider / Resend / any delivery path.
--     * NEVER advances the run beyond 'preparing'.
--     * NEVER populates sent_at / provider_email_id / delivered_at / clicked_at
--       / bounced_at / complained_at.
--     * NEVER fabricates content (template_snapshot / context_snapshot /
--       discount_code_snapshot are left at schema defaults by the materialiser).
--     * Uses gate_eligible (staging), NOT sendable_now (which stays false).
--
-- ATOMICITY
--   Single BEGIN/COMMIT, NO exception handler. ANY RAISE rolls back EVERYTHING —
--   temporary definition/automation/rollout enablement, the inserted opportunity,
--   the run, the recipient and the opportunity transition — together. The ONLY
--   state intentionally left behind on success is the three canary rows; ALL
--   control/definition/automation kill switches are restored to fully paused
--   BEFORE COMMIT.
--
-- OWNER / PERMISSIONS
--   The canonical gate public.wtf_marketing_recipient_gate_preview() is PRIVATE
--   (EXECUTE revoked from service_role/anon/authenticated). This canary calls it
--   DIRECTLY, so it MUST be run by the database OWNER / a superuser in the
--   Supabase SQL editor (or psql as the owner) — exactly like migrations 001-020.
--   It is NOT an application function, NOT cron, NOT a delivery worker.
--
-- SCOPE
--   Migrations 001-020 are NOT modified. NO schema/RLS/policy/trigger change.
--   NO AI, NO cron, NO external contacts, NO consent/frequency-cap change, NO
--   checkout/payment/ticket/wallet/customer-facing change.
--
-- PRIVACY
--   The single returned JSON payload is PII-free: no user_id, email_lc,
--   opportunity_id, recipient_id, run_id or automation_id. Identity columns are
--   used ONLY inside boolean NULL predicates and internal joins.
-- ============================================================================

BEGIN;

-- Fail fast rather than block a busy production database; never run away.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $canary$
DECLARE
  -- Authoritative definition defaults for new_account_no_purchase (READ, then
  -- asserted; NEVER invented). Expected live-planning values from Stage 009.
  c_opp_type          constant text    := 'new_account_no_purchase';
  c_exp_priority      constant integer := 5;
  c_exp_score         constant numeric := 350;
  c_exp_expiry_hours  constant integer := 336;
  c_exp_campaign_spec constant boolean := false;

  v_dep               text;
  v_missing           text[] := ARRAY[]::text[];

  -- Control state.
  v_sending           boolean;
  v_discovery         boolean;
  v_rollout           integer;
  v_max_batch         integer;
  v_daily_cap         integer;
  v_weekly_cap        integer;
  v_max_batch_before  integer;
  v_daily_cap_before  integer;
  v_weekly_cap_before integer;

  -- Ledger baselines.
  v_opp_before        bigint;
  v_recip_before      bigint;
  v_runs_before       bigint;
  v_enabled_defs      bigint;
  v_enabled_autos     bigint;
  v_enabled_autos_before bigint;

  -- new_account_no_purchase definition snapshot.
  v_def_enabled       boolean;
  v_def_campaign      boolean;
  v_def_priority      integer;
  v_def_score         numeric;
  v_def_expiry        integer;
  v_def_route_id      uuid;

  -- Routed delivery automation snapshot.
  v_auto_enabled      boolean;

  -- Chosen canary user.
  v_user_id           uuid;
  v_email_lc          text;
  v_snapshot_diag     boolean;

  -- Inserted canary opportunity.
  v_opp_id            uuid;
  v_dedupe_key        text;
  v_expires_at        timestamptz;

  -- Gate row (the canary opportunity only).
  v_g_profile_matched boolean;
  v_g_account_active  boolean;
  v_g_email_confirmed boolean;
  v_g_marketing_enabled boolean;
  v_g_has_suppression boolean;
  v_g_auth_eligible   boolean;
  v_g_def_enabled     boolean;
  v_g_campaign_valid  boolean;
  v_g_route_mapped    boolean;
  v_g_route_enabled   boolean;
  v_g_route_ready     boolean;
  v_g_existing_recip  boolean;
  v_g_freq_eligible   boolean;
  v_g_pre_nba         boolean;
  v_g_next_best_rank  bigint;
  v_g_gate_eligible   boolean;
  v_g_sendable_now    boolean;
  v_g_found           boolean;

  -- Materialiser result + post assertions.
  v_rpc               jsonb;
  v_opp_after         bigint;
  v_recip_after       bigint;
  v_runs_after        bigint;

  v_r_user_id         uuid;
  v_r_external        uuid;
  v_r_email_lc        text;
  v_r_run_id          uuid;
  v_r_status          text;
  v_r_idem            text;
  v_r_tmpl            jsonb;
  v_r_ctx             jsonb;
  v_r_discount        jsonb;
  v_r_sent_at         timestamptz;
  v_r_provider        text;
  v_r_delivered       timestamptz;
  v_r_clicked         timestamptz;
  v_r_bounced         timestamptz;
  v_r_complained      timestamptz;
  v_r_attempts        integer;

  v_run_auto_id       uuid;
  v_run_promo_id      uuid;
  v_run_status        text;

  v_opp_state         text;
  v_opp_selected_at   timestamptz;
  v_opp_actioned_at   timestamptz;
  v_opp_auto_prov     uuid;
  v_other_changed     bigint;

  -- Final gate re-check.
  v_gate_eligible_after bigint;
  v_sendable_now_after  bigint;
BEGIN
  -- ========================================================================
  -- SINGLE-EXECUTION GUARD — canary-specific advisory key, distinct from all
  -- prior migration/canary/RPC keys.
  -- ========================================================================
  IF NOT pg_try_advisory_xact_lock(hashtext('wtf_marketing_stage_3d2c_one_recipient_canary')) THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: another execution is already in progress (advisory lock held).';
  END IF;

  -- ========================================================================
  -- PREFLIGHT — ALL read-only assertions BEFORE any write.
  -- ========================================================================
  -- 1. Required tables + private gate + materialiser RPC exist.
  FOREACH v_dep IN ARRAY ARRAY[
    'public.customer_marketing_profiles',
    'public.marketing_opportunities',
    'public.marketing_opportunity_definitions',
    'public.marketing_automations',
    'public.marketing_recipients',
    'public.marketing_automation_runs',
    'public.marketing_control_state'
  ] LOOP
    IF to_regclass(v_dep) IS NULL THEN
      v_missing := array_append(v_missing, v_dep);
    END IF;
  END LOOP;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: required dependency % is missing.', array_to_string(v_missing, ', ');
  END IF;

  IF to_regprocedure('public.is_marketing_email_eligible(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: is_marketing_email_eligible(uuid,text) is missing.';
  END IF;
  IF to_regprocedure('public.wtf_marketing_recipient_gate_preview()') IS NULL THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: private gate wtf_marketing_recipient_gate_preview() is missing (Stage 019).';
  END IF;
  IF to_regprocedure('public.materialize_marketing_recipients(integer)') IS NULL THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: materialize_marketing_recipients(integer) is missing (Stage 020).';
  END IF;

  -- 2. Control state EXACTLY paused; capture frequency caps + batch (never changed).
  SELECT sending_enabled, discovery_enabled, rollout_limit,
         maximum_batch_size, maximum_daily_per_contact, maximum_weekly_per_contact
    INTO v_sending, v_discovery, v_rollout,
         v_max_batch_before, v_daily_cap_before, v_weekly_cap_before
    FROM public.marketing_control_state
   WHERE key = 'default';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: marketing_control_state singleton (key=''default'') not found.';
  END IF;
  IF v_sending IS DISTINCT FROM false
     OR v_discovery IS DISTINCT FROM false
     OR v_rollout   IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: Marketing is not paused (sending_enabled=%, discovery_enabled=%, rollout_limit=%).',
      v_sending, v_discovery, v_rollout;
  END IF;
  IF COALESCE(v_max_batch_before, 0) < 1 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: maximum_batch_size=% is < 1; cannot materialise one recipient.', v_max_batch_before;
  END IF;

  -- 3. Baselines: opportunities 6, recipients 0, runs 0.
  SELECT count(*) INTO v_opp_before   FROM public.marketing_opportunities;
  SELECT count(*) INTO v_recip_before FROM public.marketing_recipients;
  SELECT count(*) INTO v_runs_before  FROM public.marketing_automation_runs;
  IF v_opp_before <> 6 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: marketing_opportunities holds % row(s); expected exactly 6.', v_opp_before;
  END IF;
  IF v_recip_before <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: marketing_recipients holds % row(s); expected 0.', v_recip_before;
  END IF;
  IF v_runs_before <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: marketing_automation_runs holds % row(s); expected 0.', v_runs_before;
  END IF;

  -- 4. No definition enabled, no automation enabled at preflight.
  SELECT count(*) INTO v_enabled_defs
    FROM public.marketing_opportunity_definitions WHERE enabled = true;
  IF v_enabled_defs <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: % definition(s) already enabled; expected 0.', v_enabled_defs;
  END IF;
  SELECT count(*) INTO v_enabled_autos_before
    FROM public.marketing_automations WHERE enabled = true;
  IF v_enabled_autos_before <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: % automation(s) already enabled; expected 0.', v_enabled_autos_before;
  END IF;

  -- 5. new_account_no_purchase definition exists, disabled, mapped to a route,
  --    with EXACT authoritative defaults (read, then asserted — never invented).
  SELECT enabled, campaign_specific, default_priority, default_score,
         default_expiry_hours, delivery_automation_id
    INTO v_def_enabled, v_def_campaign, v_def_priority, v_def_score,
         v_def_expiry, v_def_route_id
    FROM public.marketing_opportunity_definitions
   WHERE opportunity_key = c_opp_type;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: definition % does not exist.', c_opp_type;
  END IF;
  IF v_def_enabled THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: definition % is already enabled.', c_opp_type;
  END IF;
  IF v_def_campaign IS DISTINCT FROM c_exp_campaign_spec THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: %.campaign_specific=% (expected %).', c_opp_type, v_def_campaign, c_exp_campaign_spec;
  END IF;
  IF v_def_priority IS DISTINCT FROM c_exp_priority
     OR v_def_score  IS DISTINCT FROM c_exp_score
     OR v_def_expiry IS DISTINCT FROM c_exp_expiry_hours THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: % defaults priority/score/expiry = %/%/% (expected %/%/%).',
      c_opp_type, v_def_priority, v_def_score, v_def_expiry,
      c_exp_priority, c_exp_score, c_exp_expiry_hours;
  END IF;
  IF v_def_route_id IS NULL THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: %.delivery_automation_id is NULL (no authoritative Stage 019 route).', c_opp_type;
  END IF;

  -- 6. Routed delivery automation exists and is DISABLED at preflight.
  SELECT enabled INTO v_auto_enabled
    FROM public.marketing_automations WHERE id = v_def_route_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: routed delivery automation for % does not exist.', c_opp_type;
  END IF;
  IF v_auto_enabled THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: routed delivery automation for % is already enabled.', c_opp_type;
  END IF;

  -- 7. No active (preparing/queued/processing) run for the routed automation + NULL promotion.
  PERFORM 1
     FROM public.marketing_automation_runs
    WHERE automation_id = v_def_route_id
      AND promotion_id IS NULL
      AND status IN ('preparing', 'queued', 'processing');
  IF FOUND THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: an active run already exists for the routed automation + NULL promotion.';
  END IF;

  -- ========================================================================
  -- CANARY USER SELECTION — deterministic, permission-backed, zero-purchase.
  --   Authoritative selector RE-CHECKS is_marketing_email_eligible AT RUNTIME.
  --   marketing_eligible_snapshot is captured ONLY as a diagnostic and is NOT
  --   used as the authority.
  -- ========================================================================
  SELECT p.user_id, p.email_lc, p.marketing_eligible_snapshot
    INTO v_user_id, v_email_lc, v_snapshot_diag
    FROM public.customer_marketing_profiles p
   WHERE p.user_id IS NOT NULL
     AND p.email_lc IS NOT NULL
     AND length(btrim(p.email_lc)) > 0
     AND p.account_active = true
     AND p.email_confirmed = true
     AND p.marketing_enabled = true
     AND p.has_active_suppression = false
     -- Opportunity semantics: a genuinely new account with no first purchase.
     AND p.confirmed_order_count = 0
     AND p.last_confirmed_at IS NULL
     -- AUTHORITATIVE consent re-check (NOT the snapshot).
     AND public.is_marketing_email_eligible(p.user_id, p.email_lc) IS TRUE
     -- No existing recipient for that user (any run).
     AND NOT EXISTS (
       SELECT 1 FROM public.marketing_recipients r WHERE r.user_id = p.user_id
     )
     -- No existing active/non-expired new_account_no_purchase opportunity.
     AND NOT EXISTS (
       SELECT 1 FROM public.marketing_opportunities o
        WHERE o.user_id = p.user_id
          AND o.opportunity_type = c_opp_type
          AND o.state NOT IN ('expired', 'superseded')
          AND o.expires_at > now()
     )
   ORDER BY p.account_created_at ASC NULLS LAST, p.user_id ASC
   LIMIT 1;

  IF v_user_id IS NULL THEN
    -- Do NOT relax eligibility to manufacture a candidate.
    RAISE EXCEPTION 'no_safe_canary_user';
  END IF;

  -- ========================================================================
  -- TEMPORARY ENABLEMENT — ONLY these three switches, inside this txn.
  --   Sending / discovery / batch / daily cap / weekly cap are NEVER changed.
  -- ========================================================================
  -- 1) routed delivery automation false -> true
  UPDATE public.marketing_automations
     SET enabled = true, updated_at = now()
   WHERE id = v_def_route_id;

  -- 2) new_account_no_purchase definition false -> true
  UPDATE public.marketing_opportunity_definitions
     SET enabled = true, updated_at = now()
   WHERE opportunity_key = c_opp_type;

  -- 3) rollout_limit 0 -> 1  (and nothing else)
  UPDATE public.marketing_control_state
     SET rollout_limit = 1, updated_at = now()
   WHERE key = 'default';

  -- Guard: sending/discovery/caps/batch untouched by the enablement.
  SELECT sending_enabled, discovery_enabled, rollout_limit,
         maximum_batch_size, maximum_daily_per_contact, maximum_weekly_per_contact
    INTO v_sending, v_discovery, v_rollout, v_max_batch, v_daily_cap, v_weekly_cap
    FROM public.marketing_control_state WHERE key = 'default';
  IF v_sending IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: sending_enabled changed to % during enablement.', v_sending;
  END IF;
  IF v_discovery IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: discovery_enabled changed to % during enablement.', v_discovery;
  END IF;
  IF v_rollout IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: rollout_limit=% after enablement (expected 1).', v_rollout;
  END IF;
  IF v_max_batch IS DISTINCT FROM v_max_batch_before
     OR v_daily_cap IS DISTINCT FROM v_daily_cap_before
     OR v_weekly_cap IS DISTINCT FROM v_weekly_cap_before THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: batch/frequency caps changed during enablement.';
  END IF;

  -- Exactly one definition and one automation enabled now.
  SELECT count(*) INTO v_enabled_defs  FROM public.marketing_opportunity_definitions WHERE enabled = true;
  SELECT count(*) INTO v_enabled_autos FROM public.marketing_automations WHERE enabled = true;
  IF v_enabled_defs <> 1 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: expected exactly 1 enabled definition, found %.', v_enabled_defs;
  END IF;
  IF v_enabled_autos <> 1 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: expected exactly 1 enabled automation, found %.', v_enabled_autos;
  END IF;

  -- ========================================================================
  -- CANARY OPPORTUNITY CREATION — exactly ONE, directly inserted.
  --   automation_id provenance stays NULL (Stage 019 routing is authoritative).
  --   campaign_id / promotion_id NULL. Defaults drive priority/score/expiry.
  --   Deterministic canary-specific dedupe key.
  -- ========================================================================
  v_expires_at := now() + make_interval(hours => v_def_expiry);
  v_dedupe_key := 'stage-3d2c-one-recipient-canary:' || c_opp_type || ':' || v_user_id::text;

  INSERT INTO public.marketing_opportunities (
    user_id,
    external_contact_id,
    email_lc,
    automation_id,          -- NULL provenance (route is authoritative)
    opportunity_type,
    campaign_id,            -- NULL
    promotion_id,           -- NULL
    expires_at,
    base_priority,          -- from definition default_priority
    score,                  -- from definition default_score
    state,                  -- open
    reason,                 -- bounded structured object
    context_snapshot,       -- bounded structured object
    dedupe_key
  )
  VALUES (
    v_user_id,
    NULL,
    v_email_lc,
    NULL,
    c_opp_type,
    NULL,
    NULL,
    v_expires_at,
    v_def_priority,
    v_def_score,
    'open',
    jsonb_build_object('canary', 'stage_3d2c_one_recipient', 'source', 'manual_canary'),
    jsonb_build_object('canary', 'stage_3d2c_one_recipient'),
    v_dedupe_key
  )
  RETURNING id INTO v_opp_id;

  -- Ledger must now be exactly 7.
  SELECT count(*) INTO v_opp_after FROM public.marketing_opportunities;
  IF v_opp_after <> 7 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: ledger is % after insert (expected 7).', v_opp_after;
  END IF;

  -- ========================================================================
  -- VERIFY THE GATE BEFORE MATERIALISING — call the PRIVATE canonical gate
  -- directly (as owner). Require gate_eligible = true, sendable_now = FALSE.
  -- ========================================================================
  SELECT true,
         g.profile_matched, g.account_active, g.email_confirmed,
         g.marketing_enabled, g.has_active_suppression,
         g.authoritative_marketing_eligible, g.definition_enabled,
         g.campaign_context_valid, g.delivery_automation_mapped,
         g.delivery_automation_enabled, g.delivery_route_ready,
         g.existing_recipient, g.frequency_eligible, g.pre_nba_gate_eligible,
         g.next_best_rank, g.gate_eligible, g.sendable_now
    INTO v_g_found,
         v_g_profile_matched, v_g_account_active, v_g_email_confirmed,
         v_g_marketing_enabled, v_g_has_suppression,
         v_g_auth_eligible, v_g_def_enabled,
         v_g_campaign_valid, v_g_route_mapped,
         v_g_route_enabled, v_g_route_ready,
         v_g_existing_recip, v_g_freq_eligible, v_g_pre_nba,
         v_g_next_best_rank, v_g_gate_eligible, v_g_sendable_now
    FROM public.wtf_marketing_recipient_gate_preview() g
   WHERE g.opportunity_id = v_opp_id;

  IF v_g_found IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: canary opportunity not present in the private gate output.';
  END IF;

  IF v_g_profile_matched   IS DISTINCT FROM true
     OR v_g_account_active IS DISTINCT FROM true
     OR v_g_email_confirmed IS DISTINCT FROM true
     OR v_g_marketing_enabled IS DISTINCT FROM true
     OR v_g_has_suppression IS DISTINCT FROM false
     OR v_g_auth_eligible  IS DISTINCT FROM true
     OR v_g_def_enabled    IS DISTINCT FROM true
     OR v_g_campaign_valid IS DISTINCT FROM true
     OR v_g_route_mapped   IS DISTINCT FROM true
     OR v_g_route_enabled  IS DISTINCT FROM true
     OR v_g_route_ready    IS DISTINCT FROM true
     OR v_g_existing_recip IS DISTINCT FROM false
     OR v_g_freq_eligible  IS DISTINCT FROM true
     OR v_g_pre_nba        IS DISTINCT FROM true
     OR v_g_next_best_rank IS DISTINCT FROM 1
     OR v_g_gate_eligible  IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: gate for canary opportunity is not fully eligible (profile=%, active=%, confirmed=%, mktg=%, suppression=%, authEligible=%, defEnabled=%, campaignValid=%, routeMapped=%, routeEnabled=%, routeReady=%, existingRecip=%, freq=%, preNba=%, rank=%, gateEligible=%).',
      v_g_profile_matched, v_g_account_active, v_g_email_confirmed,
      v_g_marketing_enabled, v_g_has_suppression, v_g_auth_eligible,
      v_g_def_enabled, v_g_campaign_valid, v_g_route_mapped,
      v_g_route_enabled, v_g_route_ready, v_g_existing_recip,
      v_g_freq_eligible, v_g_pre_nba, v_g_next_best_rank, v_g_gate_eligible;
  END IF;

  -- CRITICAL: sending is still globally false, so sendable_now MUST be false.
  IF v_g_sendable_now IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: sendable_now is % for the canary (MUST be false — global sending is paused).', v_g_sendable_now;
  END IF;

  -- ========================================================================
  -- MATERIALISE EXACTLY ONE.
  -- ========================================================================
  SELECT public.materialize_marketing_recipients(1) INTO v_rpc;

  IF (v_rpc->>'status') IS DISTINCT FROM 'ok'
     OR (v_rpc->>'effectiveLimit')::int      IS DISTINCT FROM 1
     OR (v_rpc->>'finalCandidateCount')::bigint IS DISTINCT FROM 1
     OR (v_rpc->>'insertedRecipients')::bigint  IS DISTINCT FROM 1
     OR (v_rpc->>'opportunitiesSelected')::bigint IS DISTINCT FROM 1
     OR (v_rpc->>'runsCreated')::bigint       IS DISTINCT FROM 1
     OR (v_rpc->>'runsReused')::bigint        IS DISTINCT FROM 0
     OR (v_rpc->>'groupCount')::bigint        IS DISTINCT FROM 1
     OR (v_rpc->>'blockedRunGroups')::bigint  IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: unexpected materialiser result %.', v_rpc;
  END IF;

  -- ========================================================================
  -- POST-MATERIALISATION LEDGER — 7 / 1 / 1.
  -- ========================================================================
  SELECT count(*) INTO v_opp_after   FROM public.marketing_opportunities;
  SELECT count(*) INTO v_recip_after FROM public.marketing_recipients;
  SELECT count(*) INTO v_runs_after  FROM public.marketing_automation_runs;
  IF v_opp_after <> 7 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: opportunities is % after materialise (expected 7).', v_opp_after;
  END IF;
  IF v_recip_after <> 1 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: recipients is % after materialise (expected 1).', v_recip_after;
  END IF;
  IF v_runs_after <> 1 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: runs is % after materialise (expected 1).', v_runs_after;
  END IF;

  -- ========================================================================
  -- RECIPIENT ASSERTIONS — exactly ONE, linked to the canary opportunity,
  -- queued and totally unsent, snapshots at schema defaults.
  -- ========================================================================
  SELECT r.user_id, r.external_contact_id, r.email_lc, r.run_id, r.status,
         r.idempotency_key, r.template_snapshot, r.context_snapshot,
         r.discount_code_snapshot, r.sent_at, r.provider_email_id,
         r.delivered_at, r.clicked_at, r.bounced_at, r.complained_at, r.attempts
    INTO v_r_user_id, v_r_external, v_r_email_lc, v_r_run_id, v_r_status,
         v_r_idem, v_r_tmpl, v_r_ctx,
         v_r_discount, v_r_sent_at, v_r_provider,
         v_r_delivered, v_r_clicked, v_r_bounced, v_r_complained, v_r_attempts
    FROM public.marketing_recipients r
   WHERE r.opportunity_id = v_opp_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: no recipient linked to the canary opportunity.';
  END IF;

  IF v_r_user_id   IS DISTINCT FROM v_user_id
     OR v_r_external IS NOT NULL
     OR v_r_email_lc IS DISTINCT FROM v_email_lc
     OR v_r_run_id   IS NULL
     OR v_r_status   IS DISTINCT FROM 'queued'
     OR v_r_idem     IS DISTINCT FROM ('marketing-opportunity:' || v_opp_id::text)
     OR v_r_tmpl     IS DISTINCT FROM '{}'::jsonb
     OR v_r_ctx      IS DISTINCT FROM '{}'::jsonb
     OR v_r_discount IS NOT NULL
     OR v_r_sent_at   IS NOT NULL
     OR v_r_provider  IS NOT NULL
     OR v_r_delivered IS NOT NULL
     OR v_r_clicked   IS NOT NULL
     OR v_r_bounced   IS NOT NULL
     OR v_r_complained IS NOT NULL
     OR v_r_attempts  IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: recipient contract violated (status=%, sent_at set=%, provider set=%, attempts=%, tmpl=%, ctx=%).',
      v_r_status, (v_r_sent_at IS NOT NULL), (v_r_provider IS NOT NULL),
      v_r_attempts, v_r_tmpl, v_r_ctx;
  END IF;

  -- No stray recipient exists beyond the one linked to the canary opportunity.
  IF (SELECT count(*) FROM public.marketing_recipients WHERE opportunity_id IS DISTINCT FROM v_opp_id) <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: a recipient exists that is not linked to the canary opportunity.';
  END IF;

  -- ========================================================================
  -- RUN ASSERTIONS — exactly ONE, preparing, routed automation, NULL promotion.
  -- ========================================================================
  SELECT ar.automation_id, ar.promotion_id, ar.status
    INTO v_run_auto_id, v_run_promo_id, v_run_status
    FROM public.marketing_automation_runs ar
   WHERE ar.id = v_r_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: recipient run_id does not resolve to a run.';
  END IF;
  IF v_run_auto_id IS DISTINCT FROM v_def_route_id THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: run automation_id is not the authoritative delivery route.';
  END IF;
  IF v_run_promo_id IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: run promotion_id is not NULL.';
  END IF;
  IF v_run_status IS DISTINCT FROM 'preparing' THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: run status is % (MUST be preparing; never queued/processing/completed).', v_run_status;
  END IF;

  -- ========================================================================
  -- OPPORTUNITY ASSERTIONS — canary selected; provenance NULL; the original
  -- six unchanged.
  -- ========================================================================
  SELECT o.state, o.selected_at, o.actioned_at, o.automation_id
    INTO v_opp_state, v_opp_selected_at, v_opp_actioned_at, v_opp_auto_prov
    FROM public.marketing_opportunities o
   WHERE o.id = v_opp_id;
  IF v_opp_state IS DISTINCT FROM 'selected'
     OR v_opp_selected_at IS NULL
     OR v_opp_actioned_at IS NOT NULL
     OR v_opp_auto_prov IS NOT NULL THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: canary opportunity lifecycle wrong (state=%, selected_at set=%, actioned_at set=%, automation_id set=%).',
      v_opp_state, (v_opp_selected_at IS NOT NULL), (v_opp_actioned_at IS NOT NULL), (v_opp_auto_prov IS NOT NULL);
  END IF;

  -- The original six must remain open and unselected/unactioned.
  SELECT count(*) INTO v_other_changed
    FROM public.marketing_opportunities o
   WHERE o.id <> v_opp_id
     AND (o.state IS DISTINCT FROM 'open'
          OR o.selected_at IS NOT NULL
          OR o.actioned_at IS NOT NULL);
  IF v_other_changed <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: % pre-existing opportunity(ies) changed state.', v_other_changed;
  END IF;

  -- ========================================================================
  -- RESTORE KILL SWITCHES BEFORE COMMIT.
  --   rollout_limit -> 0; definition -> disabled; automation -> disabled.
  --   The three canary rows are DELIBERATELY left behind.
  -- ========================================================================
  UPDATE public.marketing_control_state
     SET rollout_limit = 0, updated_at = now()
   WHERE key = 'default';

  UPDATE public.marketing_opportunity_definitions
     SET enabled = false, updated_at = now()
   WHERE opportunity_key = c_opp_type;

  UPDATE public.marketing_automations
     SET enabled = false, updated_at = now()
   WHERE id = v_def_route_id;

  -- Assert fully-paused end state BEFORE COMMIT.
  SELECT sending_enabled, discovery_enabled, rollout_limit
    INTO v_sending, v_discovery, v_rollout
    FROM public.marketing_control_state WHERE key = 'default';
  IF v_sending IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: sending_enabled is % (MUST be false).', v_sending;
  END IF;
  IF v_discovery IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: discovery_enabled is % (MUST be false).', v_discovery;
  END IF;
  IF v_rollout IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: rollout_limit not restored to 0 (is %).', v_rollout;
  END IF;

  SELECT count(*) INTO v_enabled_defs  FROM public.marketing_opportunity_definitions WHERE enabled = true;
  SELECT count(*) INTO v_enabled_autos FROM public.marketing_automations WHERE enabled = true;
  IF v_enabled_defs <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: % definition(s) still enabled (MUST be 0).', v_enabled_defs;
  END IF;
  IF v_enabled_autos <> v_enabled_autos_before THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: enabled automations not restored (is %, expected %).', v_enabled_autos, v_enabled_autos_before;
  END IF;

  -- ========================================================================
  -- FINAL GATE EXPECTATION — with definition + automation disabled again, the
  -- selected canary is no longer gate-eligible, and the whole system is 0/0.
  -- ========================================================================
  SELECT count(*) FILTER (WHERE g.gate_eligible),
         count(*) FILTER (WHERE g.sendable_now)
    INTO v_gate_eligible_after, v_sendable_now_after
    FROM public.wtf_marketing_recipient_gate_preview() g;
  IF v_gate_eligible_after <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: gateEligible after restore is % (MUST be 0).', v_gate_eligible_after;
  END IF;
  IF v_sendable_now_after <> 0 THEN
    RAISE EXCEPTION 'Stage 3D2C (021) canary aborted: sendableNow after restore is % (MUST be 0).', v_sendable_now_after;
  END IF;

  -- ========================================================================
  -- ANONYMIZED RESULT — PII-free proof payload (via a temp table so the tests
  -- can assert its contents contain no identifiers).
  -- ========================================================================
  CREATE TEMP TABLE tmp_one_recipient_canary_result ON COMMIT DROP AS
  SELECT jsonb_build_object(
    'status',                'canary_complete',
    'opportunitiesBefore',   v_opp_before,
    'opportunitiesAfter',    v_opp_after,
    'recipientsBefore',      v_recip_before,
    'recipientsAfter',       v_recip_after,
    'runsBefore',            v_runs_before,
    'runsAfter',             v_runs_after,
    'materializerStatus',    (v_rpc->>'status'),
    'insertedRecipients',    (v_rpc->>'insertedRecipients')::bigint,
    'opportunitiesSelected', (v_rpc->>'opportunitiesSelected')::bigint,
    'runsCreated',           (v_rpc->>'runsCreated')::bigint,
    'canaryOpportunityState', v_opp_state,
    'canaryRecipientStatus', v_r_status,
    'canaryRunStatus',       v_run_status,
    'sentRecipients',        (SELECT count(*) FROM public.marketing_recipients WHERE sent_at IS NOT NULL),
    'sendingEnabled',        v_sending,
    'discoveryEnabled',      v_discovery,
    'rolloutLimit',          v_rollout,
    'enabledDefinitions',    v_enabled_defs,
    'enabledAutomations',    v_enabled_autos,
    'gateEligibleAfter',     v_gate_eligible_after,
    'sendableNowAfter',      v_sendable_now_after,
    'generatedAt',           now()
  ) AS one_recipient_canary_result;
END
$canary$;

-- Surface the single anonymised result row for the operator.
SELECT one_recipient_canary_result FROM tmp_one_recipient_canary_result;

COMMIT;

-- ============================================================================
-- END Stage 3D2C (021). On success exactly THREE rows are added (1 opportunity
-- selected, 1 recipient queued/unsent, 1 run preparing); global sending was
-- never enabled; all kill switches were restored to fully paused before COMMIT.
-- ============================================================================
