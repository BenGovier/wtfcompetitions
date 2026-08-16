-- ============================================================================
-- WTF Marketing Hub — Stage 3C2D: READ-ONLY opportunity DETECTION + NEXT-BEST-
-- ACTION arbitration PREVIEW.
-- ----------------------------------------------------------------------------
-- PURPOSE
--   Install READ-ONLY, service-role-only RPCs that report what the FUTURE
--   Opportunity Engine WOULD detect and how it WOULD arbitrate a single
--   next-best-action per customer, across the live customer intelligence base,
--   WITHOUT creating a single marketing_opportunities row. Analysis only.
--
--   It supersedes the obsolete, unexecuted migration 008 CONCEPTUALLY. It does
--   NOT modify 008 (or any migration 001-010).
--
-- HARD GUARANTEES (this migration is INERT on install)
--   * NO writes anywhere. marketing_opportunities stays at 0 rows.
--   * NO recipients, NO automation runs, NO selection/arbitration writes.
--   * NO definition is enabled (all 28 remain enabled=false).
--   * marketing_control_state is READ ONLY (pause assertion); never mutated.
--   * NO AI, NO cron, NO email/Resend, NO sending, NO discovery.
--   * NO ALTER of any existing table, NO new table, NO trigger, NO extension.
--   * Does NOT touch checkout / payment / ticket / wallet / signup / customer
--     facing behaviour.
--
-- DETECTION SUBSTRATE (rollups only — NO broad operational history scan)
--   Primary substrate is the pre-computed rollups:
--     * public.customer_marketing_profiles        (value, wallet, permission)
--     * public.customer_marketing_intelligence     (behaviour, wins, cadence,
--                                                    wallet freshness, abandonment)
--     * public.customer_campaign_affinity          (campaign / reveal_type /
--                                                    presentation_type affinity)
--   Small config datasets are joined:
--     * public.campaigns                           (live universe + closing)
--     * public.marketing_campaign_promotions       (configured promotions)
--     * public.marketing_automations               (delay / wallet thresholds)
--   checkout_intents / instant_win_awards / wallet_transactions are NEVER read
--   here: those operational facts are already rolled up into intelligence and
--   affinity. Abandonment (delay + debug/SIM + later same-campaign conversion
--   exclusion) is ALREADY applied inside the rollup, so no re-scan is needed.
--
-- ARCHITECTURE RULE — DETECTION IS NOT SEND ELIGIBILITY
--   An opportunity is DETECTED from the full Auth customer population regardless
--   of marketing permission. Permission (marketing_eligible_snapshot /
--   has_active_suppression) is reported SEPARATELY as an aggregate on the
--   winning candidates; it NEVER filters detection. Final send eligibility
--   remains a later deterministic gate (send workers re-check
--   is_marketing_email_eligible at send time).
--
-- NO LOSS / GAMBLING-HARM SIGNALS
--   No losses, losing streaks, near misses, "due to win", win probability,
--   chasing losses, cumulative losses, financial vulnerability or deposit
--   escalation are derived or scored. Winner data is used ONLY as positive
--   engagement history and never implies future winning.
--
-- HOW TO RUN
--   The application NEVER executes this. Run it manually ONCE in the Supabase
--   SQL editor (or psql), AFTER migrations 001-010. Re-running is a no-op
--   (CREATE OR REPLACE FUNCTION only).
-- ============================================================================

BEGIN;

-- Fail fast rather than block on a busy production database; LOCAL only.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ----------------------------------------------------------------------------
-- Preflight (READ-ONLY): dependency existence, single-execution advisory lock,
-- and global-pause assertion. This is a PRE-LAUNCH planning tool, so it refuses
-- to install unless the hub is still fully paused. Nothing here writes;
-- to_regclass is a pure catalogue lookup.
-- ----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_missing   text[] := ARRAY[]::text[];
  v_dep       text;
  v_sending   boolean;
  v_discovery boolean;
  v_rollout   integer;
BEGIN
  FOREACH v_dep IN ARRAY ARRAY[
    'public.campaigns',
    'public.customer_marketing_profiles',
    'public.customer_marketing_intelligence',
    'public.customer_campaign_affinity',
    'public.marketing_opportunity_definitions',
    'public.marketing_campaign_promotions',
    'public.marketing_automations',
    'public.marketing_control_state',
    'public.marketing_opportunities'
  ] LOOP
    IF to_regclass(v_dep) IS NULL THEN
      v_missing := array_append(v_missing, v_dep);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Stage 3C2D preview aborted: required dependency % is missing. Run migrations 001-010 first.',
      array_to_string(v_missing, ', ');
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('wtf_marketing_stage_3c2d_detection_preview')) THEN
    RAISE EXCEPTION
      'Stage 3C2D preview aborted: another execution is already in progress (advisory lock held).';
  END IF;

  SELECT sending_enabled, discovery_enabled, rollout_limit
    INTO v_sending, v_discovery, v_rollout
    FROM public.marketing_control_state
   WHERE key = 'default';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Stage 3C2D preview aborted: marketing_control_state singleton (key=''default'') not found; cannot confirm Marketing is paused.';
  END IF;

  IF v_sending IS DISTINCT FROM false
     OR v_discovery IS DISTINCT FROM false
     OR v_rollout   IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION
      'Stage 3C2D preview aborted: Marketing is not globally paused (sending_enabled=%, discovery_enabled=%, rollout_limit=%). Refusing to install a detection preview once live.',
      v_sending, v_discovery, v_rollout;
  END IF;
END
$preflight$;

-- ============================================================================
-- 1. PRIVATE CANDIDATE MODEL (SET-BASED, READ-ONLY)
--    A STABLE SECURITY DEFINER set-returning function that produces ONE ROW per
--    (user_id, opportunity_key) detected candidate, with its transparent score
--    components and its deterministic per-customer arbitration rank. Both public
--    RPCs below consume this single source of truth so detection, scoring and
--    arbitration can never diverge between the overview and the sample.
--
--    It is owner-only: reachable exclusively through the two top-level
--    SECURITY DEFINER RPCs (same owner). EXECUTE is granted to NOBODY.
--
--    Determinism / boundedness:
--      * Purely set-based (CTEs + window functions). No PL/pgSQL customer loop.
--      * Campaign-context detectors are gated on there being live campaigns /
--        configured promotions; when none exist those joins touch zero rows.
--      * Reads ONLY the three rollups + tiny config tables. No operational scan.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.wtf_marketing_opportunity_candidates_preview()
RETURNS TABLE (
  user_id             uuid,
  opportunity_key     text,
  family              text,
  default_priority    integer,
  default_score       numeric,
  campaign_id         uuid,
  final_score         integer,
  score_components    jsonb,
  is_closing          boolean,
  -- permission (reported separately from detection; NEVER filters it)
  perm_backed         boolean,
  perm_suppressed     boolean,
  perm_not_backed     boolean,
  rn                  integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '10s'
AS $$
WITH
-- Automation-driven thresholds (single read of the tiny automations table).
cfg AS (
  SELECT
    COALESCE(max(first_delay_minutes)  FILTER (WHERE automation_key = 'new_account_no_purchase'), 1440)::int AS na_delay_minutes,
    COALESCE(max(minimum_wallet_pence) FILTER (WHERE automation_key = 'wtf_credit_waiting'),      1)::bigint  AS wtf_min_wallet_pence
  FROM public.marketing_automations
),
-- Configured promotions gate the promotion detectors. status scheduled/processing
-- are the actionable states (draft/completed/cancelled/failed are inert).
promo AS (
  SELECT
    count(*) FILTER (WHERE promotion_type = 'vip_early_access')             AS vip_promo_count,
    count(*) FILTER (WHERE promotion_type = 'regular_buyer_campaign_alert') AS rb_promo_count
  FROM public.marketing_campaign_promotions
  WHERE status IN ('scheduled', 'processing')
),
-- Campaign ids of configured regular-buyer promotions (for the already-purchased
-- exclusion, done via campaign AFFINITY rows — NOT a checkout scan).
rb_promo_campaigns AS (
  SELECT DISTINCT lower(campaign_id::text) AS campaign_key
  FROM public.marketing_campaign_promotions
  WHERE promotion_type = 'regular_buyer_campaign_alert'
    AND status IN ('scheduled', 'processing')
),
-- Live / marketable campaign universe (status = 'live' is the authoritative
-- public "isLive" definition). reveal_type / presentation_type are lower-cased
-- to match the affinity rollup keys. Closing = end_at within 48h.
live_campaigns AS (
  SELECT
    c.id                                                          AS campaign_id,
    lower(btrim(c.reveal_type))                                   AS reveal_key,
    lower(btrim(c.presentation_type))                             AS presentation_key,
    c.end_at,
    (c.end_at IS NOT NULL
      AND c.end_at > now()
      AND c.end_at <= now() + interval '48 hours')                AS is_closing
  FROM public.campaigns c
  WHERE c.status = 'live'
),
live_campaign_count AS (
  SELECT count(*)::int AS n FROM live_campaigns
),
-- Per-customer campaign RELEVANCE booleans, derived ONLY from structured data
-- (affinity rollup x live campaign structured metadata). Never inferred from
-- titles/slugs/descriptions. A customer is "relevant" to a live campaign when a
-- reveal_type or presentation_type affinity key equals that campaign's
-- lower-cased reveal_type / presentation_type.
type_affinity AS (
  SELECT user_id, affinity_type, affinity_key
  FROM public.customer_campaign_affinity
  WHERE affinity_type IN ('reveal_type', 'presentation_type')
),
-- Campaigns a customer has already bought (affinity_type = 'campaign'); used as
-- the already-entered / already-purchased exclusion WITHOUT scanning checkouts.
bought_campaign AS (
  SELECT user_id, affinity_key AS campaign_key
  FROM public.customer_campaign_affinity
  WHERE affinity_type = 'campaign'
),
match_pairs AS (
  SELECT
    ta.user_id,
    lc.campaign_id,
    lc.is_closing,
    lower(lc.campaign_id::text)                                   AS campaign_key,
    (ta.affinity_type = 'reveal_type')                            AS via_reveal,
    (bc.user_id IS NOT NULL)                                      AS already_entered
  FROM type_affinity ta
  JOIN live_campaigns lc
    ON (ta.affinity_type = 'reveal_type'       AND ta.affinity_key = lc.reveal_key)
    OR (ta.affinity_type = 'presentation_type' AND ta.affinity_key = lc.presentation_key)
  LEFT JOIN bought_campaign bc
    ON bc.user_id = ta.user_id
   AND bc.campaign_key = lower(lc.campaign_id::text)
),
cust_match AS (
  SELECT
    user_id,
    bool_or(true)                                                 AS has_relevant_live_campaign,
    bool_or(via_reveal)                                           AS has_reveal_match,
    bool_or(NOT already_entered)                                  AS has_relevant_not_entered,
    bool_or(is_closing)                                           AS has_relevant_closing,
    bool_or(is_closing AND NOT already_entered)                   AS has_relevant_closing_not_entered,
    min(campaign_id) FILTER (WHERE NOT already_entered)           AS relevant_campaign_id,
    min(campaign_id) FILTER (WHERE is_closing AND NOT already_entered) AS closing_campaign_id
  FROM match_pairs
  GROUP BY user_id
),
-- Per-customer count of DISTINCT live campaigns already bought, to derive
-- "there exists a live campaign this recent buyer has NOT entered" without a
-- cross join blow-up.
bought_live AS (
  SELECT bc.user_id, count(DISTINCT bc.campaign_key)::int AS bought_live_n
  FROM bought_campaign bc
  JOIN live_campaigns lc ON lower(lc.campaign_id::text) = bc.campaign_key
  GROUP BY bc.user_id
),
-- Base feature row: one per customer. Profile is the population spine (every
-- Auth customer with a marketing profile); intelligence + match booleans are
-- LEFT JOINed so detection covers the whole population, not just the enriched.
base AS (
  SELECT
    p.user_id,
    -- value / lifecycle
    p.confirmed_order_count,
    p.lifetime_external_pence,
    p.first_confirmed_at,
    p.last_confirmed_at,
    p.account_created_at,
    p.wallet_available_pence,
    -- permission (reported separately; never filters detection)
    p.marketing_eligible_snapshot,
    p.has_active_suppression,
    -- intelligence
    i.orders_30d,
    i.previous_confirmed_at,
    i.average_purchase_gap_hours,
    i.last_win_at,
    i.win_count,
    i.last_win_value_pence,
    i.last_wallet_credit_at,
    i.last_abandoned_at,
    i.abandoned_7d_count,
    i.abandoned_30d_count,
    -- campaign relevance
    COALESCE(cm.has_relevant_live_campaign, false)        AS has_relevant_live_campaign,
    COALESCE(cm.has_reveal_match, false)                  AS has_reveal_match,
    COALESCE(cm.has_relevant_not_entered, false)          AS has_relevant_not_entered,
    COALESCE(cm.has_relevant_closing_not_entered, false)  AS has_relevant_closing,
    cm.relevant_campaign_id,
    cm.closing_campaign_id,
    -- a recent buyer has an un-entered live campaign if fewer live campaigns
    -- bought than exist
    (lcc.n > 0 AND COALESCE(bl.bought_live_n, 0) < lcc.n)  AS has_other_live_not_bought
  FROM public.customer_marketing_profiles p
  LEFT JOIN public.customer_marketing_intelligence i ON i.user_id = p.user_id
  LEFT JOIN cust_match cm ON cm.user_id = p.user_id
  LEFT JOIN bought_live bl ON bl.user_id = p.user_id
  CROSS JOIN live_campaign_count lcc
),
-- Derived, bounded features + reusable score components (computed once; each
-- component maps to ONE distinct underlying feature to avoid double counting).
feat AS (
  SELECT
    b.*,
    (b.confirmed_order_count >= 10 OR b.lifetime_external_pence >= 25000) AS is_vip,
    (b.confirmed_order_count >= 5)                                        AS is_frequent,
    -- hours since last purchase
    CASE WHEN b.last_confirmed_at IS NOT NULL
         THEN extract(epoch FROM (now() - b.last_confirmed_at)) / 3600.0 END AS hours_since_last,
    -- personal cadence ratio with a 12h minimum floor on the historical gap so
    -- tiny historical gaps cannot manufacture absurd "overdue" ratios.
    CASE
      WHEN b.average_purchase_gap_hours IS NOT NULL
       AND b.last_confirmed_at IS NOT NULL
      THEN (extract(epoch FROM (now() - b.last_confirmed_at)) / 3600.0)
           / GREATEST(b.average_purchase_gap_hours, 12.0)
    END AS cadence_ratio
  FROM base b
),
comp AS (
  SELECT
    f.*,
    -- value_c (universal): customer commercial value tier. Cap 80.
    (CASE WHEN f.is_vip THEN 80
          WHEN f.is_frequent THEN 50
          WHEN f.confirmed_order_count >= 1 THEN 20
          ELSE 0 END)::int AS value_c,
    -- recency_c (universal): recency of last purchase. Cap 60.
    (CASE
       WHEN f.last_confirmed_at IS NULL THEN 0
       WHEN f.last_confirmed_at >= now() - interval '7 days'  THEN 60
       WHEN f.last_confirmed_at >= now() - interval '30 days' THEN 30
       WHEN f.last_confirmed_at >= now() - interval '90 days' THEN 10
       ELSE 0 END)::int AS recency_c,
    -- cadence_c (cadence family only): overdue vs personal cadence. Cap 120.
    (CASE WHEN f.cadence_ratio IS NOT NULL AND f.cadence_ratio > 1.0
          THEN LEAST(120, GREATEST(0, round((f.cadence_ratio - 1.0) * 80)))
          ELSE 0 END)::int AS cadence_c,
    -- wallet_c (wallet family + recent_winner_credit_available): 1 point / £1,
    -- capped at 100 (£100+). Rewards spendable balance.
    LEAST(100, GREATEST(0, floor(f.wallet_available_pence / 100.0)))::int AS wallet_c,
    -- winner_c (winner family): positive win recency only. Cap 100.
    (CASE
       WHEN f.last_win_at IS NULL THEN 0
       WHEN f.last_win_at >= now() - interval '7 days'  THEN 100
       WHEN f.last_win_at >= now() - interval '30 days' THEN 60
       WHEN f.last_win_at >= now() - interval '90 days' THEN 20
       ELSE 0 END)::int AS winner_c,
    -- affinity_c (affinity + promotion families): structured campaign relevance
    -- strength. Cap 80.
    (CASE WHEN f.has_relevant_live_campaign THEN 60 ELSE 0 END
      + CASE WHEN f.is_vip THEN 20 ELSE 0 END)::int AS affinity_c,
    -- urgency_c (closing): a relevant live campaign closing within 48h. Cap 100.
    (CASE WHEN f.has_relevant_closing THEN 100 ELSE 0 END)::int AS urgency_c,
    -- abandon_c (checkout family): abandonment recency. Cap 80.
    (CASE
       WHEN f.last_abandoned_at IS NULL THEN 0
       WHEN f.last_abandoned_at >= now() - interval '2 days' THEN 80
       WHEN f.last_abandoned_at >= now() - interval '7 days' THEN 50
       ELSE 20 END
      + CASE WHEN COALESCE(f.abandoned_30d_count, 0) >= 2 THEN 20 ELSE 0 END)::int AS abandon_c
  FROM feat f
),
cfg_all AS (
  SELECT c.na_delay_minutes, c.wtf_min_wallet_pence, p.vip_promo_count, p.rb_promo_count
  FROM cfg c CROSS JOIN promo p
),
-- One row per (customer, opportunity) via a fixed VALUES set unnested per
-- customer. Only matched rows survive. campaign_id is attached where relevant.
raw_candidates AS (
  SELECT
    c.user_id,
    d.opportunity_key,
    d.campaign_id
  FROM comp c
  CROSS JOIN cfg_all g
  CROSS JOIN LATERAL (VALUES
    -- LIFECYCLE ---------------------------------------------------------------
    ('new_account_no_purchase',
      c.confirmed_order_count = 0
      AND c.account_created_at IS NOT NULL
      AND c.account_created_at >= now() - interval '7 days'
      AND c.account_created_at <= now() - make_interval(mins => g.na_delay_minutes),
      NULL::uuid),
    ('first_to_second_purchase',
      c.confirmed_order_count = 1, NULL::uuid),
    ('lapsed_7_days',
      c.confirmed_order_count > 0 AND c.last_confirmed_at IS NOT NULL
      AND c.last_confirmed_at <  now() - interval '7 days'
      AND c.last_confirmed_at >= now() - interval '14 days', NULL::uuid),
    ('lapsed_14_days',
      c.confirmed_order_count > 0 AND c.last_confirmed_at IS NOT NULL
      AND c.last_confirmed_at <  now() - interval '14 days'
      AND c.last_confirmed_at >= now() - interval '30 days', NULL::uuid),
    ('lapsed_30_days',
      c.confirmed_order_count > 0 AND c.last_confirmed_at IS NOT NULL
      AND c.last_confirmed_at <  now() - interval '30 days', NULL::uuid),
    ('high_value_customer_at_risk',
      c.is_vip AND c.last_confirmed_at IS NOT NULL
      AND c.last_confirmed_at <  now() - interval '14 days'
      AND c.last_confirmed_at >= now() - interval '45 days', NULL::uuid),
    ('vip_reactivation',
      c.is_vip AND c.last_confirmed_at IS NOT NULL
      AND c.last_confirmed_at < now() - interval '45 days', NULL::uuid),
    ('reactivated_customer_follow_up',
      c.last_confirmed_at IS NOT NULL
      AND c.last_confirmed_at >= now() - interval '7 days'
      AND c.previous_confirmed_at IS NOT NULL
      AND c.last_confirmed_at - c.previous_confirmed_at >= interval '30 days', NULL::uuid),
    -- CADENCE -----------------------------------------------------------------
    ('personal_cadence_overdue',
      c.confirmed_order_count > 0 AND c.cadence_ratio IS NOT NULL
      AND c.cadence_ratio > 1.5, NULL::uuid),
    -- WALLET ------------------------------------------------------------------
    ('wtf_credit_waiting',
      c.wallet_available_pence >= g.wtf_min_wallet_pence, NULL::uuid),
    ('fresh_wallet_credit',
      c.wallet_available_pence > 0 AND c.last_wallet_credit_at IS NOT NULL
      AND c.last_wallet_credit_at >= now() - interval '7 days', NULL::uuid),
    ('wallet_credit_campaign_match',
      c.wallet_available_pence > 0 AND c.has_relevant_live_campaign,
      c.relevant_campaign_id),
    -- WINNER (positive engagement only) --------------------------------------
    ('recent_winner_follow_up',
      c.last_win_at IS NOT NULL AND c.last_win_at >= now() - interval '7 days', NULL::uuid),
    ('recent_winner_credit_available',
      c.last_win_at IS NOT NULL AND c.last_win_at >= now() - interval '30 days'
      AND c.wallet_available_pence > 0, NULL::uuid),
    ('first_win_follow_up',
      c.win_count = 1 AND c.last_win_at IS NOT NULL
      AND c.last_win_at >= now() - interval '14 days', NULL::uuid),
    ('high_value_winner_follow_up',
      c.last_win_at IS NOT NULL AND c.last_win_at >= now() - interval '30 days'
      AND c.last_win_value_pence IS NOT NULL AND c.last_win_value_pence >= 25000, NULL::uuid),
    -- CHECKOUT ----------------------------------------------------------------
    ('abandoned_checkout',
      COALESCE(c.abandoned_7d_count, 0) >= 1, NULL::uuid),
    ('repeat_abandoner',
      COALESCE(c.abandoned_30d_count, 0) >= 2, NULL::uuid),
    -- AFFINITY / CAMPAIGN (require live campaigns) ----------------------------
    ('frequent_buyer_relevant_campaign',
      c.is_frequent AND c.has_relevant_live_campaign, c.relevant_campaign_id),
    ('vip_relevant_campaign',
      c.is_vip AND c.has_relevant_live_campaign, c.relevant_campaign_id),
    ('reveal_affinity_campaign',
      c.has_reveal_match, c.relevant_campaign_id),
    ('recently_active_no_relevant_entry',
      COALESCE(c.orders_30d, 0) >= 1 AND c.has_relevant_not_entered, c.relevant_campaign_id),
    ('recent_buyer_cross_campaign',
      (COALESCE(c.orders_30d, 0) >= 1
        OR (c.last_confirmed_at IS NOT NULL AND c.last_confirmed_at >= now() - interval '14 days'))
      AND c.has_other_live_not_bought, NULL::uuid),
    -- PROMOTION (require configured promotions) -------------------------------
    ('vip_early_access',
      c.is_vip AND g.vip_promo_count > 0, NULL::uuid),
    ('regular_buyer_campaign_alert',
      c.is_frequent AND g.rb_promo_count > 0
      AND NOT EXISTS (
        SELECT 1 FROM rb_promo_campaigns rp
        JOIN public.customer_campaign_affinity a
          ON a.user_id = c.user_id
         AND a.affinity_type = 'campaign'
         AND a.affinity_key = rp.campaign_key
      ), NULL::uuid),
    ('campaign_closing_relevant_customer',
      c.has_relevant_closing, c.closing_campaign_id),
    ('promotion_match',
      (c.is_vip AND g.vip_promo_count > 0)
      OR (c.is_frequent AND g.rb_promo_count > 0), NULL::uuid)
  ) AS d(opportunity_key, matched, campaign_id)
  WHERE d.matched
),
-- Attach the authoritative catalogue config + build transparent score.
scored AS (
  SELECT
    rc.user_id,
    rc.opportunity_key,
    def.family,
    def.default_priority,
    def.default_score,
    rc.campaign_id,
    -- component picks: universal value/recency always apply; family-specific
    -- components apply only to their family (no excessive double counting).
    c.value_c,
    c.recency_c,
    (CASE WHEN rc.opportunity_key = 'personal_cadence_overdue' THEN c.cadence_c ELSE 0 END) AS cadence_c,
    (CASE WHEN def.family = 'wallet'
            OR rc.opportunity_key = 'recent_winner_credit_available'
          THEN c.wallet_c ELSE 0 END) AS wallet_c,
    (CASE WHEN def.family = 'winner' THEN c.winner_c ELSE 0 END) AS winner_c,
    (CASE WHEN def.family IN ('affinity', 'promotion') THEN c.affinity_c ELSE 0 END) AS affinity_c,
    (CASE WHEN rc.opportunity_key IN ('campaign_closing_relevant_customer', 'wallet_credit_campaign_match')
          THEN c.urgency_c ELSE 0 END) AS urgency_c,
    (CASE WHEN def.family = 'checkout' THEN c.abandon_c ELSE 0 END) AS abandon_c,
    c.has_relevant_closing,
    -- permission split (partition of the population)
    (c.marketing_eligible_snapshot AND NOT c.has_active_suppression)         AS perm_backed,
    c.has_active_suppression                                                  AS perm_suppressed,
    (NOT c.marketing_eligible_snapshot AND NOT c.has_active_suppression)      AS perm_not_backed
  FROM raw_candidates rc
  JOIN comp c ON c.user_id = rc.user_id
  JOIN public.marketing_opportunity_definitions def ON def.opportunity_key = rc.opportunity_key
),
final AS (
  SELECT
    s.*,
    LEAST(1000, GREATEST(0,
      round(s.default_score)::int
      + s.value_c + s.recency_c + s.cadence_c + s.wallet_c
      + s.winner_c + s.affinity_c + s.urgency_c + s.abandon_c
    ))::int AS final_score
  FROM scored s
)
SELECT
  f.user_id,
  f.opportunity_key,
  f.family,
  f.default_priority,
  f.default_score,
  f.campaign_id,
  f.final_score,
  jsonb_build_object(
    'base',     round(f.default_score)::int,
    'value',    f.value_c,
    'recency',  f.recency_c,
    'cadence',  f.cadence_c,
    'wallet',   f.wallet_c,
    'winner',   f.winner_c,
    'affinity', f.affinity_c,
    'urgency',  f.urgency_c,
    'abandon',  f.abandon_c,
    'final',    f.final_score
  ) AS score_components,
  f.has_relevant_closing AS is_closing,
  f.perm_backed,
  f.perm_suppressed,
  f.perm_not_backed,
  -- NEXT-BEST-ACTION arbitration (deterministic, set-based). Ordering:
  --   1) lower default_priority first  (catalogue-authoritative rank)
  --   2) higher final_score
  --   3) campaign urgency (closing candidate first)
  --   4) opportunity_key ascending (stable deterministic tie-break)
  ROW_NUMBER() OVER (
    PARTITION BY f.user_id
    ORDER BY f.default_priority ASC,
             f.final_score DESC,
             f.is_closing DESC,
             f.opportunity_key ASC
  )::int AS rn
FROM final f
$$;

COMMENT ON FUNCTION public.wtf_marketing_opportunity_candidates_preview() IS
  'Stage 3C2D PRIVATE read-only candidate model. One row per (user_id, opportunity_key) detected from the profile/intelligence/affinity rollups + campaign/promotion/automation config, with transparent 0-1000 score components and a deterministic per-customer next-best-action rank (rn=1 is the preview winner). Writes NOTHING. Owner-only: EXECUTE granted to nobody; reached only via the two top-level preview RPCs.';

-- Owner-only: strip EXECUTE from everyone (incl. service_role). It is called
-- only inside the two SECURITY DEFINER RPCs below, under the same owner.
REVOKE ALL ON FUNCTION public.wtf_marketing_opportunity_candidates_preview() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wtf_marketing_opportunity_candidates_preview() FROM service_role;

-- ============================================================================
-- 2. MAIN OVERVIEW RPC (aggregate only — NO identities)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_marketing_opportunity_detection_preview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '10s'
AS $$
DECLARE
  v_now      timestamptz := now();
  v_profiles bigint;
  v_result   jsonb;
BEGIN
  SELECT count(*)::bigint INTO v_profiles FROM public.customer_marketing_profiles;

  WITH cand AS (
    SELECT * FROM public.wtf_marketing_opportunity_candidates_preview()
  ),
  per_customer AS (
    SELECT user_id, count(*)::int AS n
    FROM cand
    GROUP BY user_id
  ),
  winners AS (
    SELECT * FROM cand WHERE rn = 1
  )
  SELECT jsonb_build_object(
    'generatedAt', v_now,

    'population', jsonb_build_object(
      'profiles',              v_profiles,
      'detectedCustomers',     (SELECT count(*)::bigint FROM per_customer),
      'detectedCandidates',    (SELECT count(*)::bigint FROM cand),
      'noOpportunityCustomers',(v_profiles - (SELECT count(*)::bigint FROM per_customer))
    ),

    'overlap', jsonb_build_object(
      'one',              (SELECT count(*)::bigint FROM per_customer WHERE n = 1),
      'two',              (SELECT count(*)::bigint FROM per_customer WHERE n = 2),
      'threePlus',        (SELECT count(*)::bigint FROM per_customer WHERE n >= 3),
      'maxForOneCustomer',(SELECT COALESCE(max(n), 0)::int FROM per_customer),
      'totalCandidates',  (SELECT count(*)::bigint FROM cand),
      'uniqueCustomers',  (SELECT count(*)::bigint FROM per_customer)
    ),

    'permission', jsonb_build_object(
      'winningPermissionBacked',    (SELECT count(*)::bigint FROM winners WHERE perm_backed),
      'winningNotPermissionBacked', (SELECT count(*)::bigint FROM winners WHERE perm_not_backed),
      'winningSuppressed',          (SELECT count(*)::bigint FROM winners WHERE perm_suppressed)
    ),

    'countByOpportunityType', COALESCE(
      (SELECT jsonb_object_agg(opportunity_key, cnt)
         FROM (SELECT opportunity_key, count(*)::bigint AS cnt
                 FROM cand GROUP BY opportunity_key) x),
      '{}'::jsonb),

    'winningCountByOpportunityType', COALESCE(
      (SELECT jsonb_object_agg(opportunity_key, cnt)
         FROM (SELECT opportunity_key, count(*)::bigint AS cnt
                 FROM winners GROUP BY opportunity_key) x),
      '{}'::jsonb),

    'families', jsonb_build_object(
      'detectedByFamily', COALESCE(
        (SELECT jsonb_object_agg(family, cnt)
           FROM (SELECT family, count(*)::bigint AS cnt
                   FROM cand GROUP BY family) x), '{}'::jsonb),
      'winningByFamily', COALESCE(
        (SELECT jsonb_object_agg(family, cnt)
           FROM (SELECT family, count(*)::bigint AS cnt
                   FROM winners GROUP BY family) x), '{}'::jsonb)
    ),

    -- Static detector-support matrix (which catalogue rows are actually
    -- implemented from current structured data, vs campaign-gated, vs
    -- unsupported). Declared explicitly — never pretends unsupported rows work.
    'support', jsonb_build_object(
      'supportedNow', jsonb_build_array(
        'new_account_no_purchase','first_to_second_purchase','lapsed_7_days',
        'lapsed_14_days','lapsed_30_days','high_value_customer_at_risk',
        'vip_reactivation','reactivated_customer_follow_up','personal_cadence_overdue',
        'wtf_credit_waiting','fresh_wallet_credit','recent_winner_follow_up',
        'recent_winner_credit_available','first_win_follow_up',
        'high_value_winner_follow_up','abandoned_checkout','repeat_abandoner'
      ),
      'requiresCampaignContext', jsonb_build_array(
        'wallet_credit_campaign_match','frequent_buyer_relevant_campaign',
        'vip_relevant_campaign','reveal_affinity_campaign',
        'recently_active_no_relevant_entry','recent_buyer_cross_campaign',
        'vip_early_access','regular_buyer_campaign_alert',
        'campaign_closing_relevant_customer','promotion_match'
      ),
      'futureUnsupported', jsonb_build_array(
        'high_value_abandoned_checkout'
      )
    ),

    'notes', jsonb_build_object(
      'detectionIsNotSendEligibility', true,
      'permissionReportedSeparately', true,
      'substrate', 'customer_marketing_profiles + customer_marketing_intelligence + customer_campaign_affinity + campaigns/promotions/automations config',
      'operationalHistoryScanned', false,
      'highValueAbandonedCheckoutUnsupportedReason', 'intelligence rollup carries no per-customer abandoned-checkout monetary value; computing it would require an unsafe broad checkout_intents scan',
      'cadenceMinimumGapFloorHours', 12,
      'cadenceOverdueRatioThreshold', 1.5,
      'liveCampaignStatus', 'live',
      'campaignClosingWindowHours', 48,
      'vipDefinition', 'confirmed_order_count >= 10 OR lifetime_external_pence >= 25000',
      'frequentBuyerDefinition', 'confirmed_order_count >= 5',
      'highValueWinValuePence', 25000,
      'promotionStatusesCounted', jsonb_build_array('scheduled','processing')
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_admin_marketing_opportunity_detection_preview() IS
  'Stage 3C2D READ-ONLY opportunity detection + next-best-action arbitration preview. Returns ONE aggregate jsonb (population, overlap, permission split, count/winning by type + family, and the detector-support matrix). No identities, no rows, no writes, no AI/cron/email. Service-role only.';

REVOKE ALL ON FUNCTION public.get_admin_marketing_opportunity_detection_preview() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_marketing_opportunity_detection_preview() TO service_role;

-- ============================================================================
-- 3. SAMPLE / INSPECTION RPC (bounded, anonymised winning decisions)
--    Returns at most 100 winning (rn=1) decisions with an OPAQUE user hash
--    (never the raw user_id, never email/name/checkout rows), for admin
--    inspection of WHY something ranked.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_marketing_opportunity_preview_sample(p_limit integer DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '10s'
AS $$
DECLARE
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_result jsonb;
BEGIN
  WITH winners AS (
    SELECT *
    FROM public.wtf_marketing_opportunity_candidates_preview()
    WHERE rn = 1
    -- deterministic, non-identifying ordering for a stable sample
    ORDER BY final_score DESC, default_priority ASC, opportunity_key ASC
    LIMIT v_limit
  )
  SELECT jsonb_build_object(
    'generatedAt', now(),
    'limit',       v_limit,
    'count',       (SELECT count(*)::int FROM winners),
    'sample', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        -- opaque short identifier only; NOT the raw user_id, NOT email/name.
        'userHash',         substr(md5(user_id::text), 1, 12),
        'opportunityKey',   opportunity_key,
        'family',           family,
        'campaignId',       campaign_id,
        'score',            final_score,
        'defaultPriority',  default_priority,
        'scoreComponents',  score_components,
        'reasons', jsonb_build_object(
          'isClosingCampaign',  is_closing,
          'permissionBacked',   perm_backed,
          'suppressed',         perm_suppressed,
          'notPermissionBacked',perm_not_backed
        )
      ) ORDER BY final_score DESC, default_priority ASC, opportunity_key ASC)
       FROM winners),
      '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_admin_marketing_opportunity_preview_sample(integer) IS
  'Stage 3C2D READ-ONLY bounded (<=100) anonymised sample of winning next-best-action decisions. Returns an opaque userHash (never raw user_id/email/name), opportunity_key, family, campaign_id, score, default_priority, score components, and compact reason/permission flags. Writes NOTHING. Service-role only.';

REVOKE ALL ON FUNCTION public.get_admin_marketing_opportunity_preview_sample(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_marketing_opportunity_preview_sample(integer) TO service_role;

COMMIT;

-- ============================================================================
-- End of Stage 3C2D detection + arbitration preview.
--   * One PRIVATE set-based candidate model + two service-role-only read RPCs.
--   * NO writes anywhere; marketing_opportunities remains at 0 rows.
--   * NO definition enabled; marketing_control_state only READ (pause assert).
--   * NO recipients, runs, AI, cron, email, sending, discovery, rollout change.
--   * NO ALTER of any existing table, NO migration 001-010 modified.
--   * Detection substrate is the profile/intelligence/affinity rollups + tiny
--     campaign/promotion/automation config only; NO broad operational scan.
-- ============================================================================
