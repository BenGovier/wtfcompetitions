-- ============================================================================
-- WTF Marketing — Stage 037: CONTENT PREPARATION + RUN READINESS (executors).
--
-- Purpose
--   The two MISSING pipeline stages between materialisation (Stage 036 /
--   materialize_marketing_recipients) and delivery (claim_marketing_delivery_batch):
--
--     1. prepare_marketing_recipient_content(p_limit)
--          Populates each eligible recipient's template_snapshot + context_snapshot
--          to the canonical VERSION 1 contract, resolving {{campaign_title}} and
--          {{campaign_url}} from the FROZEN opportunity.campaign_id -> campaigns
--          (title + slug). Writes ONLY the two snapshot columns; never touches
--          status/attempts/locks/sent_at/provider_email_id, never sends, never
--          transitions runs.
--
--     2. mark_marketing_runs_ready(p_limit)
--          Transitions a run 'preparing' -> 'queued' ONLY when every recipient in
--          that run is content_prepared (deterministically validated). This is the
--          delivery-ready state the claim RPC consumes. Sends nothing.
--
-- Selection authority
--   Preparation NEVER re-derives eligibility. It selects strictly from the shipped
--   PRIVATE Stage 022 gate public.wtf_marketing_recipient_preparation_preview()
--   WHERE preparation_eligible (which already enforces recipient shape, run
--   'preparing', opportunity 'selected'/identity, definition+automation enabled,
--   delivery route, CURRENT contact permission, campaign context, template
--   validity, AND NOT already-prepared). Readiness aggregates content_prepared
--   from the SAME gate. Neither RPC consults gate_eligible/sendable_now/
--   sending_enabled — sending remains authoritative only at delivery/claim time.
--
-- Canonical destination URL
--   {{campaign_url}} resolves to  https://www.wtf-giveaways.co.uk/giveaways/<slug>
--   (matches the public route app/giveaways/[slug]). The base host is a constant
--   here because a SECURITY DEFINER SQL function cannot read NEXT_PUBLIC_SITE_URL;
--   an operator may override it via the GUC app.marketing_site_url if ever needed.
--
-- Snapshot validator
--   public.wtf_marketing_content_snapshots_are_prepared(...) is (re)defined here to
--   the EXACT VERSION 1 contract enforced by the Stage 022 preview's content_prepared
--   column and by the TypeScript renderer (lib/marketing/delivery-email.ts). Both
--   executors call it before committing. schemaVersion/templateVersion are stored as
--   JSON NUMBERS (the renderer requires `=== 1` / typeof 'number'); every resolved
--   field must be non-empty and free of residual '{{'/'}}' placeholder delimiters.
--
-- Safety posture: FAIL CLOSED. Owner-only (EXECUTE revoked from every client role;
-- invoked by the cron routes through the service-role PostgREST as the function
-- owner). No schema changes. No AI influence. Idempotent: an already-prepared
-- recipient is ineligible; an already-ready run is not 'preparing'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Canonical marketing site base URL (no trailing slash). Overridable via GUC.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wtf_marketing_site_base_url()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $base$
  SELECT rtrim(
    COALESCE(
      NULLIF(btrim(current_setting('app.marketing_site_url', true)), ''),
      'https://www.wtf-giveaways.co.uk'
    ),
    '/'
  )
$base$;

REVOKE ALL ON FUNCTION public.wtf_marketing_site_base_url() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wtf_marketing_site_base_url() FROM anon;
REVOKE ALL ON FUNCTION public.wtf_marketing_site_base_url() FROM authenticated;
-- Executors run as owner (SECURITY DEFINER); this helper is called inside them.
GRANT EXECUTE ON FUNCTION public.wtf_marketing_site_base_url() TO service_role;

-- ----------------------------------------------------------------------------
-- VERSION 1 snapshot validator (authoritative; mirrors Stage 022 content_prepared
-- + the TypeScript renderer). Returns TRUE only for a fully-prepared pair.
-- Deliberately STRICT: NULL inputs => FALSE (fail closed).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wtf_marketing_content_snapshots_are_prepared(
  p_template_snapshot jsonb,
  p_context_snapshot  jsonb,
  p_opportunity_type  text,
  p_campaign_specific boolean
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $v$
  SELECT
    p_template_snapshot IS NOT NULL
    AND p_context_snapshot IS NOT NULL
    AND p_opportunity_type IS NOT NULL
    AND jsonb_typeof(p_template_snapshot) = 'object'
    AND jsonb_typeof(p_context_snapshot)  = 'object'
    -- template_snapshot v1
    AND (p_template_snapshot ->> 'schemaVersion') = '1'
    AND coalesce(btrim(p_template_snapshot ->> 'templateKey'), '') <> ''
    AND (p_template_snapshot ->> 'templateVersion') ~ '^[0-9]+$'
    AND (p_template_snapshot ->> 'templateVersion')::bigint >= 1
    AND coalesce(btrim(p_template_snapshot ->> 'subject'), '')  <> ''
    AND coalesce(btrim(p_template_snapshot ->> 'heading'), '')  <> ''
    AND coalesce(btrim(p_template_snapshot ->> 'bodyText'), '') <> ''
    AND coalesce(btrim(p_template_snapshot ->> 'ctaLabel'), '') <> ''
    -- no residual placeholder delimiters anywhere in the resolved template text
    AND (p_template_snapshot ->> 'subject')  NOT LIKE '%{{%'
    AND (p_template_snapshot ->> 'subject')  NOT LIKE '%}}%'
    AND (p_template_snapshot ->> 'heading')  NOT LIKE '%{{%'
    AND (p_template_snapshot ->> 'heading')  NOT LIKE '%}}%'
    AND (p_template_snapshot ->> 'bodyText') NOT LIKE '%{{%'
    AND (p_template_snapshot ->> 'bodyText') NOT LIKE '%}}%'
    AND coalesce(p_template_snapshot ->> 'previewText', '') NOT LIKE '%{{%'
    AND coalesce(p_template_snapshot ->> 'previewText', '') NOT LIKE '%}}%'
    -- context_snapshot v1
    AND (p_context_snapshot ->> 'schemaVersion') = '1'
    AND coalesce(btrim(p_context_snapshot ->> 'opportunityType'), '') <> ''
    AND (p_context_snapshot ->> 'opportunityType') = p_opportunity_type
    -- campaign-specific opportunities require a valid, resolved campaign block
    AND (
      NOT p_campaign_specific
      OR (
            jsonb_typeof(p_context_snapshot -> 'campaign') = 'object'
        AND coalesce(btrim(p_context_snapshot #>> '{campaign,title}'), '') <> ''
        AND coalesce(btrim(p_context_snapshot #>> '{campaign,url}'), '')   <> ''
        AND (p_context_snapshot #>> '{campaign,title}') NOT LIKE '%{{%'
        AND (p_context_snapshot #>> '{campaign,title}') NOT LIKE '%}}%'
        AND (p_context_snapshot #>> '{campaign,url}') ~ '^https?://'
      )
    )
$v$;

COMMENT ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared(jsonb, jsonb, text, boolean) IS
  'Stage 037 authoritative VERSION 1 prepared-snapshot validator (owner-only). Returns TRUE only when BOTH snapshots are JSON objects satisfying the canonical schemaVersion=1 contract: non-empty templateKey, integer templateVersion>=1, non-empty subject/heading/bodyText/ctaLabel with NO residual {{/}} delimiters, context opportunityType equal to the linked opportunity, and (for campaign-specific opportunities) a campaign object with non-empty resolved title + http(s) url. STRICT/fail-closed: any NULL input => FALSE. Mirrors the Stage 022 preview content_prepared column and lib/marketing/delivery-email.ts.';

REVOKE ALL ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared(jsonb, jsonb, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared(jsonb, jsonb, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared(jsonb, jsonb, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wtf_marketing_content_snapshots_are_prepared(jsonb, jsonb, text, boolean) TO service_role;

-- ============================================================================
-- PART A — CONTENT PREPARATION EXECUTOR.
--   Populates template_snapshot + context_snapshot for preparation-eligible
--   recipients. Writes ONLY those two columns. Never sends; never transitions
--   runs; never changes recipient status/attempts/locks.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prepare_marketing_recipient_content(
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $prepare$
DECLARE
  v_limit      integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_considered integer := 0;
  v_prepared   integer := 0;
  v_skipped    integer := 0;
  v_failed     integer := 0;
  v_base       text := public.wtf_marketing_site_base_url();
  r            record;
  v_title      text;
  v_url        text;
  v_subject    text;
  v_preview    text;
  v_heading    text;
  v_body       text;
  v_cta        text;
  v_template   jsonb;
  v_context    jsonb;
  v_ok         boolean;
  v_updated    integer;
BEGIN
  FOR r IN
    SELECT
      g.recipient_id,
      g.opportunity_id,
      g.opportunity_type,
      g.campaign_id,
      g.campaign_specific,
      a.template_id
    FROM public.wtf_marketing_recipient_preparation_preview() g
    JOIN public.marketing_opportunity_definitions d ON d.opportunity_key = g.opportunity_type
    JOIN public.marketing_automations a ON a.id = d.delivery_automation_id
    WHERE g.preparation_eligible
    ORDER BY g.recipient_id
    LIMIT v_limit
  LOOP
    v_considered := v_considered + 1;

    -- Resolve template + campaign from FROZEN references. Any gap => skip safely.
    SELECT
      c.title,
      v_base || '/giveaways/' || c.slug,
      t.subject, t.preview_text, t.heading, t.body_text, t.cta_label
    INTO
      v_title, v_url, v_subject, v_preview, v_heading, v_body, v_cta
    FROM public.marketing_templates t
    LEFT JOIN public.campaigns c ON c.id = r.campaign_id
    WHERE t.id = r.template_id;

    -- Campaign-specific opportunities MUST have a resolvable title + slug.
    IF v_title IS NULL OR btrim(v_title) = ''
       OR v_url IS NULL OR v_url NOT LIKE 'https://%/giveaways/%'
       OR v_subject IS NULL OR v_heading IS NULL OR v_body IS NULL OR v_cta IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Resolve the ONLY two allowed campaign placeholders (whitespace-tolerant).
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

    -- Build the VERSION 1 snapshots. schemaVersion/templateVersion are JSON NUMBERS.
    v_template := jsonb_build_object(
      'schemaVersion', 1,
      'templateKey', (SELECT template_key FROM public.marketing_templates WHERE id = r.template_id),
      'templateVersion', (SELECT version FROM public.marketing_templates WHERE id = r.template_id),
      'subject', v_subject,
      'previewText', v_preview,
      'heading', v_heading,
      'bodyText', v_body,
      'ctaLabel', v_cta
    );
    v_context := jsonb_build_object(
      'schemaVersion', 1,
      'opportunityType', r.opportunity_type,
      'campaign', jsonb_build_object('title', v_title, 'url', v_url)
    );

    -- Authoritative validation BEFORE committing.
    v_ok := public.wtf_marketing_content_snapshots_are_prepared(
      v_template, v_context, r.opportunity_type, r.campaign_specific
    );
    IF NOT v_ok THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    -- Write ONLY the two snapshot columns, and only to a still-pristine, unsent,
    -- unlocked, not-yet-prepared recipient (race-safe, idempotent). Never touches
    -- status/attempts/locks/sent_at/provider_email_id; never transitions the run.
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
    'considered', v_considered,
    'prepared', v_prepared,
    'skipped', v_skipped,
    'failed', v_failed,
    'generatedAt', now()
  );
END;
$prepare$;

COMMENT ON FUNCTION public.prepare_marketing_recipient_content(integer) IS
  'Stage 037 CONTENT PREPARATION executor (owner-only). Selects preparation-eligible recipients from the Stage 022 preview, resolves {{campaign_title}}/{{campaign_url}} from the frozen opportunity.campaign_id -> campaigns (title + /giveaways/<slug>), builds + validates the VERSION 1 snapshots, and writes ONLY template_snapshot + context_snapshot to still-pristine recipients. Sends nothing; never transitions runs; never changes status/attempts/locks/sent_at. Idempotent + fail-closed. Returns a PII-free stats summary.';

REVOKE ALL ON FUNCTION public.prepare_marketing_recipient_content(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_marketing_recipient_content(integer) FROM anon;
REVOKE ALL ON FUNCTION public.prepare_marketing_recipient_content(integer) FROM authenticated;
-- Invoked by the /api/cron/marketing-preparation route via the service-role client.
GRANT EXECUTE ON FUNCTION public.prepare_marketing_recipient_content(integer) TO service_role;

-- ============================================================================
-- PART B — RUN READINESS EXECUTOR.
--   Transitions a run 'preparing' -> 'queued' ONLY when it has >=1 recipient and
--   EVERY recipient in the run is content_prepared. Sets queued_count to the
--   recipient count. Sends nothing; never claims; never touches recipients.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_marketing_runs_ready(
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $ready$
DECLARE
  v_limit    integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_ready    integer := 0;
  v_considered integer := 0;
BEGIN
  -- Per-run readiness derived from the SAME Stage 022 gate: a run is ready iff it
  -- has at least one recipient and NONE are unprepared.
  WITH g AS (
    SELECT run_id, content_prepared
      FROM public.wtf_marketing_recipient_preparation_preview()
  ),
  agg AS (
    SELECT run_id,
           count(*)                                    AS total,
           count(*) FILTER (WHERE content_prepared)    AS prepared
      FROM g
     GROUP BY run_id
  ),
  eligible AS (
    SELECT run_id
      FROM agg
     WHERE total > 0 AND prepared = total
     ORDER BY run_id
     LIMIT v_limit
  ),
  counted AS (
    SELECT count(*) AS n FROM eligible
  ),
  upd AS (
    UPDATE public.marketing_automation_runs run
       SET status = 'queued',
           queued_count = (SELECT total FROM agg WHERE agg.run_id = run.id),
           updated_at = now()
     WHERE run.status = 'preparing'
       AND run.id IN (SELECT run_id FROM eligible)
    RETURNING run.id
  )
  SELECT (SELECT n FROM counted), (SELECT count(*) FROM upd)
    INTO v_considered, v_ready;

  RETURN jsonb_build_object(
    'status', 'ok',
    'runsConsidered', COALESCE(v_considered, 0),
    'runsMarkedReady', COALESCE(v_ready, 0),
    'generatedAt', now()
  );
END;
$ready$;

COMMENT ON FUNCTION public.mark_marketing_runs_ready(integer) IS
  'Stage 037 RUN READINESS executor (owner-only). Transitions a run preparing -> queued (the delivery-ready state the claim RPC consumes) ONLY when the run has >=1 recipient and every recipient is content_prepared per the Stage 022 gate; sets queued_count to the recipient count. Sends nothing; never claims; never mutates recipients. Idempotent + fail-closed.';

REVOKE ALL ON FUNCTION public.mark_marketing_runs_ready(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_marketing_runs_ready(integer) FROM anon;
REVOKE ALL ON FUNCTION public.mark_marketing_runs_ready(integer) FROM authenticated;
-- Invoked by the /api/cron/marketing-readiness route via the service-role client.
GRANT EXECUTE ON FUNCTION public.mark_marketing_runs_ready(integer) TO service_role;
