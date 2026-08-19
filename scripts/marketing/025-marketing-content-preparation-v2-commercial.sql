-- ============================================================================
-- WTF Marketing — Stage 043: CONTENT PREPARATION *VERSION 2* (COMMERCIAL).
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ REVIEW ONLY — NOT AUTO-EXECUTED BY v0.                                      │
-- │ This migration is written for a human operator to READ, VERIFY against the │
-- │ live schema, and run manually. v0 did NOT execute it and made NO database  │
-- │ change. Several column/table names below are INFERRED from application     │
-- │ code (Stage 042 audit) and are flagged "VERIFY:"; confirm each against the │
-- │ live database before executing.                                            │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Purpose
--   Add an ADDITIVE Version-2 content-preparation path that freezes COMMERCIAL
--   FACTS into the recipient context snapshot so the (already shipped) delivery
--   renderer can show real ticket price, remaining tickets, remaining instant
--   prizes / values and the customer's available WTF credit. It mirrors the
--   Stage 037 V1 executor EXACTLY for control, rollout, locking, selection and
--   fail-closed posture; it only ADDS commercial fields to the context.
--
-- What this migration DOES (all NEW objects; nothing existing is touched)
--   1. public.wtf_marketing_content_snapshots_are_prepared_v2(jsonb, jsonb, text, boolean)
--        A self-contained VERSION-2 validator. It re-checks the V1 template
--        contract, then validates the additive commercial context. It does NOT
--        replace the existing production V1 validator.
--   2. public.prepare_marketing_recipient_content_v2(integer)
--        A V2 executor that writes schemaVersion=2 context snapshots. It does
--        NOT replace public.prepare_marketing_recipient_content(integer).
--
-- What this migration DOES NOT do
--   * Does NOT create/replace/drop/alter any existing function, table, column,
--     policy or grant (including the V1 validator + V1 executor).
--   * Does NOT enable sending/discovery, does NOT transition runs, does NOT send.
--   * Does NOT introduce any PII into snapshots (no name, email, user id, losing
--     history, near-miss, gambling signal, voucher, or AI decision). Only frozen
--     commercial NUMBERS + campaign artwork + the customer's own credit balance.
--
-- Fail-closed commercial rule (CRITICAL)
--   EVERY commercial value is nullable and MUST be JSON null when the source is
--   missing or untrustworthy. A missing value is NEVER coerced to 0. The renderer
--   (lib/marketing/delivery-email.ts) already treats null => "omit this fact".
--
-- Rollout
--   With Production rollout_limit = 1 this bounds V2 preparation to <= 1
--   recipient per invocation, exactly like V1. It is invoked by nothing until an
--   operator wires a cron/route to it; installing the functions changes no
--   behaviour on its own.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART A — VERSION-2 SNAPSHOT VALIDATOR (NEW).
--   Mirrors the V1 template-contract checks, then validates the additive
--   commercial context. Pure/immutable-ish: reads only its arguments.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wtf_marketing_content_snapshots_are_prepared_v2(
  p_template          jsonb,
  p_context           jsonb,
  p_opportunity_type  text,
  p_campaign_specific boolean
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $v2$
DECLARE
  v_campaign jsonb;
  v_customer jsonb;
  v_key      text;
  v_num      jsonb;
BEGIN
  -- (1) Both snapshots must be JSON objects.
  IF p_template IS NULL OR jsonb_typeof(p_template) <> 'object' THEN RETURN false; END IF;
  IF p_context  IS NULL OR jsonb_typeof(p_context)  <> 'object' THEN RETURN false; END IF;

  -- (2) TEMPLATE contract (identical to V1: schemaVersion 1 + required copy).
  IF (p_template->>'schemaVersion') IS DISTINCT FROM '1' THEN RETURN false; END IF;
  IF COALESCE(btrim(p_template->>'templateKey'), '') = '' THEN RETURN false; END IF;
  IF (p_template->>'templateVersion') IS NULL
     OR (p_template->>'templateVersion') !~ '^[0-9]+$' THEN RETURN false; END IF;
  IF COALESCE(btrim(p_template->>'subject'), '') = '' THEN RETURN false; END IF;
  IF COALESCE(btrim(p_template->>'heading'), '') = '' THEN RETURN false; END IF;
  IF COALESCE(btrim(p_template->>'bodyText'), '') = '' THEN RETURN false; END IF;
  IF COALESCE(btrim(p_template->>'ctaLabel'), '') = '' THEN RETURN false; END IF;
  -- No unresolved handlebars anywhere in the copy.
  IF (p_template->>'subject')  ~ '\{\{'
     OR (p_template->>'heading')  ~ '\{\{'
     OR (p_template->>'bodyText') ~ '\{\{'
     OR (p_template->>'ctaLabel') ~ '\{\{'
     OR COALESCE(p_template->>'previewText','') ~ '\{\{' THEN
    RETURN false;
  END IF;

  -- (3) CONTEXT contract — VERSION 2 exactly.
  IF (p_context->>'schemaVersion') IS DISTINCT FROM '2' THEN RETURN false; END IF;
  IF COALESCE(btrim(p_context->>'opportunityType'), '') = '' THEN RETURN false; END IF;
  IF (p_context->>'opportunityType') IS DISTINCT FROM p_opportunity_type THEN RETURN false; END IF;

  v_campaign := p_context->'campaign';
  v_customer := p_context->'customerValue';

  -- (4) Campaign presence matches opportunity kind (fail closed both ways).
  IF p_campaign_specific THEN
    IF v_campaign IS NULL OR jsonb_typeof(v_campaign) <> 'object' THEN RETURN false; END IF;
    IF COALESCE(btrim(v_campaign->>'title'), '') = '' THEN RETURN false; END IF;
    IF (v_campaign->>'url') IS NULL OR (v_campaign->>'url') !~ '^https://' THEN RETURN false; END IF;
    IF (v_campaign ? 'imageUrl')
       AND jsonb_typeof(v_campaign->'imageUrl') <> 'null'
       AND (v_campaign->>'imageUrl') !~ '^https?://' THEN
      RETURN false;
    END IF;
    -- Every numeric commercial field, when present and not null, must be a
    -- NON-NEGATIVE INTEGER. Absent or JSON null is allowed (fail-closed omit).
    FOREACH v_key IN ARRAY ARRAY[
      'ticketPricePence','ticketsTotal','ticketsSold','ticketsRemaining',
      'instantWinsRemaining','remainingInstantPrizeValuePence',
      'highestRemainingInstantPrizePence'
    ] LOOP
      IF (v_campaign ? v_key) THEN
        v_num := v_campaign->v_key;
        IF jsonb_typeof(v_num) = 'null' THEN
          CONTINUE;
        ELSIF jsonb_typeof(v_num) = 'number' AND (v_campaign->>v_key) ~ '^[0-9]+$' THEN
          CONTINUE;
        ELSE
          RETURN false;
        END IF;
      END IF;
    END LOOP;
  ELSE
    -- Non-campaign types MUST NOT carry a campaign block.
    IF v_campaign IS NOT NULL AND jsonb_typeof(v_campaign) <> 'null' THEN RETURN false; END IF;
  END IF;

  -- (5) customerValue (optional). If present, walletCreditPence must be null or
  --     a non-negative integer.
  IF v_customer IS NOT NULL AND jsonb_typeof(v_customer) <> 'null' THEN
    IF jsonb_typeof(v_customer) <> 'object' THEN RETURN false; END IF;
    IF (v_customer ? 'walletCreditPence') THEN
      v_num := v_customer->'walletCreditPence';
      IF jsonb_typeof(v_num) <> 'null'
         AND NOT (jsonb_typeof(v_num) = 'number' AND (v_customer->>'walletCreditPence') ~ '^[0-9]+$') THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$v2$;

COMMENT ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared_v2(jsonb, jsonb, text, boolean) IS
  'Stage 043 VERSION-2 marketing snapshot validator (NEW; does not replace the V1 validator). Re-checks the V1 template contract, requires context schemaVersion=2, enforces campaign presence by opportunity kind, and validates additive commercial fields (all nullable non-negative integers; artwork http(s) or null; wallet credit null or non-negative integer). Fail closed.';

REVOKE ALL ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared_v2(jsonb, jsonb, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared_v2(jsonb, jsonb, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared_v2(jsonb, jsonb, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared_v2(jsonb, jsonb, text, boolean) TO service_role;

-- ----------------------------------------------------------------------------
-- PART B — VERSION-2 CONTENT PREPARATION EXECUTOR (NEW).
--   Identical control/rollout/lock/selection/copy logic to the Stage 037 V1
--   executor; only the context snapshot is upgraded to V2 with commercial facts.
--   Writes ONLY template_snapshot + context_snapshot to pristine recipients.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_marketing_recipient_content_v2(
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $prep2$
DECLARE
  v_requested  integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_effective  integer := 0;
  v_sending    boolean;
  v_discovery  boolean;
  v_rollout    integer;
  v_batch      integer;
  v_considered integer := 0;
  v_prepared   integer := 0;
  v_skipped    integer := 0;
  v_failed     integer := 0;
  v_base       constant text := 'https://www.wtf-giveaways.co.uk';
  r            record;
  v_title      text;
  v_url        text;
  v_subject    text;
  v_preview    text;
  v_heading    text;
  v_body       text;
  v_cta        text;
  v_template_key text;
  v_template_version integer;
  v_template   jsonb;
  v_context    jsonb;
  v_campaign_json jsonb;
  v_customer_json jsonb;
  v_ok         boolean;
  v_updated    integer;
  -- Commercial scratch (all default NULL => fail closed).
  v_image_url        text;
  v_price_pence      integer;
  v_tickets_total    integer;
  v_tickets_sold     integer;
  v_tickets_remain   integer;
  v_end_at           timestamptz;
  v_iw_remaining     integer;
  v_iw_value_pence   integer;
  v_iw_top_pence     integer;
  v_iw_has_unknown   boolean;
  v_wallet_pence     integer;
BEGIN
  -- (B) Concurrency: V2-specific advisory lock key (independent of V1).
  IF NOT pg_try_advisory_xact_lock(hashtext('wtf_marketing_prepare_recipient_content_v2')) THEN
    RETURN jsonb_build_object(
      'status', 'busy', 'requestedLimit', v_requested, 'effectiveLimit', 0,
      'considered', 0, 'prepared', 0, 'skipped', 0, 'failed', 0, 'generatedAt', now()
    );
  END IF;

  -- (C) Controls (fail closed exactly like V1).
  SELECT sending_enabled, discovery_enabled, rollout_limit, maximum_batch_size
    INTO v_sending, v_discovery, v_rollout, v_batch
    FROM public.marketing_control_state
   WHERE key = 'default';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','control_missing','requestedLimit',v_requested,'effectiveLimit',0,
      'considered',0,'prepared',0,'skipped',0,'failed',0,'generatedAt',now());
  END IF;
  IF v_batch IS NULL OR v_batch <= 0 THEN
    RETURN jsonb_build_object('status','invalid_control','requestedLimit',v_requested,'effectiveLimit',0,
      'considered',0,'prepared',0,'skipped',0,'failed',0,'generatedAt',now());
  END IF;
  IF v_rollout IS NULL OR v_rollout <= 0 THEN
    RETURN jsonb_build_object('status','rollout_disabled','requestedLimit',v_requested,'effectiveLimit',0,
      'considered',0,'prepared',0,'skipped',0,'failed',0,'generatedAt',now());
  END IF;

  v_effective := LEAST(v_requested, v_batch, v_rollout);
  IF v_effective <= 0 THEN
    RETURN jsonb_build_object('status','rollout_disabled','requestedLimit',v_requested,'effectiveLimit',0,
      'considered',0,'prepared',0,'skipped',0,'failed',0,'generatedAt',now());
  END IF;

  -- (F) Prepare up to v_effective preparation-eligible recipients.
  --     VERIFY: g.user_id is assumed to exist on the preparation preview / recipient
  --     for the wallet lookup. If it is named differently, adjust the wallet block.
  FOR r IN
    SELECT
      g.recipient_id,
      g.opportunity_id,
      g.opportunity_type,
      g.campaign_id,
      g.campaign_specific,
      g.user_id,
      a.template_id
    FROM public.wtf_marketing_recipient_preparation_preview() g
    JOIN public.marketing_opportunity_definitions d ON d.opportunity_key = g.opportunity_type
    JOIN public.marketing_automations a ON a.id = d.delivery_automation_id
    WHERE g.preparation_eligible
    ORDER BY g.recipient_id
    LIMIT v_effective
  LOOP
    v_considered := v_considered + 1;
    v_title := NULL; v_url := NULL;
    v_image_url := NULL; v_price_pence := NULL; v_tickets_total := NULL;
    v_tickets_sold := NULL; v_tickets_remain := NULL; v_end_at := NULL;
    v_iw_remaining := NULL; v_iw_value_pence := NULL; v_iw_top_pence := NULL;
    v_wallet_pence := NULL;

    -- Resolve template (+ campaign identity for campaign-specific).
    IF r.campaign_specific THEN
      -- VERIFY: campaigns.ticket_price_pence, campaigns.max_tickets_total,
      -- campaigns.end_at, campaigns.hero_image_url column names (Stage 042).
      SELECT
        c.title,
        v_base || '/giveaways/' || c.slug,
        t.subject, t.preview_text, t.heading, t.body_text, t.cta_label,
        t.template_key, t.version,
        c.hero_image_url, c.ticket_price_pence, c.max_tickets_total, c.end_at
      INTO
        v_title, v_url, v_subject, v_preview, v_heading, v_body, v_cta,
        v_template_key, v_template_version,
        v_image_url, v_price_pence, v_tickets_total, v_end_at
      FROM public.marketing_templates t
      LEFT JOIN public.campaigns c ON c.id = r.campaign_id
      WHERE t.id = r.template_id;

      IF v_title IS NULL OR btrim(v_title) = ''
         OR v_url IS NULL OR v_url NOT LIKE 'https://%/giveaways/%' THEN
        v_skipped := v_skipped + 1; CONTINUE;
      END IF;

      -- Sanitise commercial scalars to the fail-closed contract.
      IF v_price_pence IS NOT NULL AND v_price_pence < 0 THEN v_price_pence := NULL; END IF;
      IF v_tickets_total IS NOT NULL AND v_tickets_total < 0 THEN v_tickets_total := NULL; END IF;
      IF v_image_url IS NOT NULL AND v_image_url !~ '^https?://' THEN v_image_url := NULL; END IF;

      -- Tickets sold from the authoritative counter (primary, then legacy).
      -- VERIFY: campaign_ticket_counters(campaign_id, next_ticket) and legacy
      -- giveaway_ticket_counters(giveaway_id, next_ticket) (Stage 042 §4).
      SELECT GREATEST(cc.next_ticket - 1, 0) INTO v_tickets_sold
        FROM public.campaign_ticket_counters cc WHERE cc.campaign_id = r.campaign_id;
      IF v_tickets_sold IS NULL THEN
        SELECT GREATEST(gc.next_ticket - 1, 0) INTO v_tickets_sold
          FROM public.giveaway_ticket_counters gc WHERE gc.giveaway_id = r.campaign_id;
      END IF;

      -- Remaining only when BOTH a cap and a sold count are known (fail closed).
      IF v_tickets_total IS NOT NULL AND v_tickets_sold IS NOT NULL THEN
        v_tickets_remain := GREATEST(v_tickets_total - v_tickets_sold, 0);
      END IF;

      -- Instant wins: count genuinely-remaining slots and their values with the
      -- trustworthiness rule — if ANY remaining slot has an unknown value, the
      -- value aggregates (total + highest) become NULL, but the COUNT can stand.
      -- VERIFY: instant_win_prizes(id, campaign_id, prize_value_pence, quantity)
      -- and instant_win_awards(prize_id) (Stage 042 §7).
      BEGIN
        WITH prize AS (
          SELECT
            p.id,
            p.prize_value_pence,
            GREATEST(COALESCE(p.quantity, 0) - COALESCE((
              SELECT count(*) FROM public.instant_win_awards w WHERE w.prize_id = p.id
            ), 0), 0) AS remaining
          FROM public.instant_win_prizes p
          WHERE p.campaign_id = r.campaign_id
        )
        SELECT
          COALESCE(SUM(remaining), 0)::int,
          bool_or(remaining > 0 AND prize_value_pence IS NULL),
          SUM(CASE WHEN remaining > 0 THEN remaining * prize_value_pence ELSE 0 END)::int,
          MAX(CASE WHEN remaining > 0 THEN prize_value_pence END)::int
        INTO v_iw_remaining, v_iw_has_unknown, v_iw_value_pence, v_iw_top_pence
        FROM prize;

        -- No prizes configured => leave count NULL (nothing to advertise).
        IF v_iw_remaining IS NOT NULL AND v_iw_remaining = 0
           AND NOT EXISTS (SELECT 1 FROM public.instant_win_prizes p WHERE p.campaign_id = r.campaign_id) THEN
          v_iw_remaining := NULL;
        END IF;
        -- Untrustworthy values => drop BOTH value aggregates (keep count).
        IF COALESCE(v_iw_has_unknown, false) THEN
          v_iw_value_pence := NULL;
          v_iw_top_pence := NULL;
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        -- Instant-win tables/columns not present as assumed => omit entirely.
        v_iw_remaining := NULL; v_iw_value_pence := NULL; v_iw_top_pence := NULL;
      END;
    ELSE
      SELECT
        t.subject, t.preview_text, t.heading, t.body_text, t.cta_label,
        t.template_key, t.version
      INTO
        v_subject, v_preview, v_heading, v_body, v_cta,
        v_template_key, v_template_version
      FROM public.marketing_templates t
      WHERE t.id = r.template_id;
    END IF;

    IF v_subject IS NULL OR v_heading IS NULL OR v_body IS NULL OR v_cta IS NULL
       OR v_template_key IS NULL OR btrim(v_template_key) = ''
       OR v_template_version IS NULL THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;

    -- Wallet credit ONLY for the WTF-credit opportunity, only when > 0.
    -- VERIFY: wallet_accounts(user_id, balance_pence, reserved_pence) (Stage 042 §1).
    IF r.opportunity_type = 'wtf_credit_waiting' AND r.user_id IS NOT NULL THEN
      BEGIN
        SELECT GREATEST(COALESCE(w.balance_pence,0) - COALESCE(w.reserved_pence,0), 0)
          INTO v_wallet_pence
          FROM public.wallet_accounts w WHERE w.user_id = r.user_id;
        IF v_wallet_pence IS NOT NULL AND v_wallet_pence <= 0 THEN
          v_wallet_pence := NULL;
        END IF;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        v_wallet_pence := NULL;
      END;
    END IF;

    -- Resolve the two allowed campaign placeholders (campaign-specific only).
    IF r.campaign_specific THEN
      v_subject := regexp_replace(v_subject, '\{\{\s*campaign_title\s*\}\}', v_title, 'g');
      v_subject := regexp_replace(v_subject, '\{\{\s*campaign_url\s*\}\}',   v_url,   'g');
      v_heading := regexp_replace(v_heading, '\{\{\s*campaign_title\s*\}\}', v_title, 'g');
      v_heading := regexp_replace(v_heading, '\{\{\s*campaign_url\s*\}\}',   v_url,   'g');
      v_body    := regexp_replace(v_body,    '\{\{\s*campaign_title\s*\}\}', v_title, 'g');
      v_body    := regexp_replace(v_body,    '\{\{\s*campaign_url\s*\}\}',   v_url,   'g');
      IF v_preview IS NOT NULL THEN
        v_preview := regexp_replace(v_preview, '\{\{\s*campaign_title\s*\}\}', v_title, 'g');
        v_preview := regexp_replace(v_preview, '\{\{\s*campaign_url\s*\}\}',   v_url,   'g');
      END IF;
    END IF;

    IF v_subject ~ '\{\{' OR v_heading ~ '\{\{' OR v_body ~ '\{\{' OR v_cta ~ '\{\{'
       OR (v_preview IS NOT NULL AND v_preview ~ '\{\{') THEN
      v_failed := v_failed + 1; CONTINUE;
    END IF;

    -- VERSION 1 template (unchanged) + VERSION 2 context.
    v_template := jsonb_build_object(
      'schemaVersion', 1,
      'templateKey', v_template_key,
      'templateVersion', v_template_version,
      'subject', v_subject,
      'previewText', v_preview,
      'heading', v_heading,
      'bodyText', v_body,
      'ctaLabel', v_cta
    );

    v_context := jsonb_build_object(
      'schemaVersion', 2,
      'opportunityType', r.opportunity_type
    );

    IF r.campaign_specific THEN
      -- to_jsonb(NULL::int) => JSON null, which the renderer treats as "omit".
      v_campaign_json := jsonb_build_object(
        'title', v_title,
        'url', v_url,
        'imageUrl', to_jsonb(v_image_url),
        'ticketPricePence', to_jsonb(v_price_pence),
        'ticketsTotal', to_jsonb(v_tickets_total),
        'ticketsSold', to_jsonb(v_tickets_sold),
        'ticketsRemaining', to_jsonb(v_tickets_remain),
        'endAt', to_jsonb(v_end_at),
        'instantWinsRemaining', to_jsonb(v_iw_remaining),
        'remainingInstantPrizeValuePence', to_jsonb(v_iw_value_pence),
        'highestRemainingInstantPrizePence', to_jsonb(v_iw_top_pence)
      );
      v_context := v_context || jsonb_build_object('campaign', v_campaign_json);
    END IF;

    IF v_wallet_pence IS NOT NULL THEN
      v_customer_json := jsonb_build_object('walletCreditPence', to_jsonb(v_wallet_pence));
      v_context := v_context || jsonb_build_object('customerValue', v_customer_json);
    END IF;

    -- Authoritative V2 validation before committing (fail closed).
    v_ok := public.wtf_marketing_content_snapshots_are_prepared_v2(
      v_template, v_context, r.opportunity_type, r.campaign_specific
    );
    IF NOT v_ok THEN
      v_failed := v_failed + 1; CONTINUE;
    END IF;

    -- Write ONLY the two snapshot columns to a still-pristine recipient.
    UPDATE public.marketing_recipients
       SET template_snapshot = v_template,
           context_snapshot  = v_context
     WHERE id = r.recipient_id
       AND status = 'queued'
       AND sent_at IS NULL
       AND provider_email_id IS NULL
       AND locked_at IS NULL
       AND locked_until IS NULL
       AND COALESCE(attempts, 0) = 0
       AND external_contact_id IS NULL
       AND template_snapshot = '{}'::jsonb
       AND context_snapshot  = '{}'::jsonb;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 1 THEN
      v_prepared := v_prepared + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'requestedLimit', v_requested,
    'effectiveLimit', v_effective,
    'considered', v_considered,
    'prepared', v_prepared,
    'skipped', v_skipped,
    'failed', v_failed,
    'generatedAt', now()
  );
END;
$prep2$;

COMMENT ON FUNCTION public.prepare_marketing_recipient_content_v2(integer) IS
  'Stage 043 VERSION-2 content preparation executor (owner-only; NEW, does not replace the V1 executor). Same control/rollout/lock/selection/copy logic as V1, but freezes a schemaVersion=2 context with additive COMMERCIAL facts (campaign artwork, ticket price, tickets total/sold/remaining, end_at, remaining instant wins + trustworthy value aggregates) and the recipient''s own available WTF credit for wtf_credit_waiting. Every commercial value is nullable and fails closed to JSON null; no PII is added. Validates via wtf_marketing_content_snapshots_are_prepared_v2 and writes ONLY template_snapshot + context_snapshot to pristine recipients. Sends nothing; never transitions runs.';

REVOKE ALL ON FUNCTION public.prepare_marketing_recipient_content_v2(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_marketing_recipient_content_v2(integer) FROM anon;
REVOKE ALL ON FUNCTION public.prepare_marketing_recipient_content_v2(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_marketing_recipient_content_v2(integer) TO service_role;
