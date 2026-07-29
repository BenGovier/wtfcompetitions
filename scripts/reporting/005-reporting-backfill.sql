-- ============================================================================
-- WTF Reporting: one-time historical backfill  (DO NOT RUN IN THIS PROJECT)
-- ----------------------------------------------------------------------------
-- Populates reporting_sales_minute + reporting_sales_daily from all existing
-- confirmed production checkouts, month by month, by repeatedly calling the
-- bounded, idempotent refresh_sales_reporting(). Because each call is
-- idempotent (delete+insert within its window), this whole script is
-- restartable: re-running it simply recomputes the same rows.
--
-- It never updates or locks checkout_intents beyond the read each monthly
-- aggregate performs. It does not add triggers.
--
-- Prerequisites: 001, 002, 003, 004 already run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: month-by-month backfill from the earliest confirmed row to now.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_min_ts   timestamptz;
  v_cursor   timestamptz;
  v_next     timestamptz;
  v_end      timestamptz := date_trunc('month', now()) + interval '1 month';
  v_res      jsonb;
BEGIN
  SELECT date_trunc('month', min(COALESCE(confirmed_at, created_at)))
    INTO v_min_ts
    FROM public.checkout_intents
   WHERE state = 'confirmed'
     AND provider IS DISTINCT FROM 'debug'
     AND (ref IS NULL OR ref NOT LIKE 'SIM-%');

  IF v_min_ts IS NULL THEN
    RAISE NOTICE 'No confirmed non-test checkouts found; nothing to backfill.';
    RETURN;
  END IF;

  v_cursor := v_min_ts;
  WHILE v_cursor < v_end LOOP
    v_next := v_cursor + interval '1 month';
    v_res  := public.refresh_sales_reporting(v_cursor, v_next);
    RAISE NOTICE 'Backfilled % -> %: %', v_cursor, v_next, v_res;
    v_cursor := v_next;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Step 2: reconciliation. Source (checkout_intents) vs reporting (daily rows).
-- Every monetary/volume difference MUST be zero.
-- ----------------------------------------------------------------------------
WITH source AS (
  SELECT
    COALESCE(SUM(total_pence), 0)::bigint AS gross,
    COALESCE(SUM(
      CASE WHEN external_payment_pence IS NOT NULL
           THEN external_payment_pence
           ELSE total_pence - COALESCE(wallet_credit_pence, 0) END
    ), 0)::bigint AS external,
    COALESCE(SUM(COALESCE(wallet_credit_pence, 0)), 0)::bigint AS credit,
    COUNT(*)::bigint AS orders,
    COALESCE(SUM(COALESCE(qty, 0)), 0)::bigint AS tickets
  FROM public.checkout_intents
  WHERE state = 'confirmed'
    AND provider IS DISTINCT FROM 'debug'
    AND (ref IS NULL OR ref NOT LIKE 'SIM-%')
    AND campaign_id IS NOT NULL
),
report AS (
  SELECT
    COALESCE(SUM(gross_pence), 0)::bigint      AS gross,
    COALESCE(SUM(external_pence), 0)::bigint   AS external,
    COALESCE(SUM(credit_pence), 0)::bigint     AS credit,
    COALESCE(SUM(confirmed_orders), 0)::bigint AS orders,
    COALESCE(SUM(tickets_sold), 0)::bigint     AS tickets
  FROM public.reporting_sales_daily
)
SELECT
  s.gross    AS source_gross,    r.gross    AS reporting_gross,    (s.gross    - r.gross)    AS diff_gross,
  s.external AS source_external, r.external AS reporting_external, (s.external - r.external) AS diff_external,
  s.credit   AS source_credit,   r.credit   AS reporting_credit,   (s.credit   - r.credit)   AS diff_credit,
  s.orders   AS source_orders,   r.orders   AS reporting_orders,   (s.orders   - r.orders)   AS diff_orders,
  s.tickets  AS source_tickets,  r.tickets  AS reporting_tickets,  (s.tickets  - r.tickets)  AS diff_tickets
FROM source s CROSS JOIN report r;

-- ----------------------------------------------------------------------------
-- Step 3: record reconciliation status for the dashboard freshness panel.
-- Re-runs the same comparison and stores it in reporting_meta.
-- ----------------------------------------------------------------------------
WITH source AS (
  SELECT
    COALESCE(SUM(total_pence), 0)::bigint AS gross,
    COALESCE(SUM(
      CASE WHEN external_payment_pence IS NOT NULL
           THEN external_payment_pence
           ELSE total_pence - COALESCE(wallet_credit_pence, 0) END
    ), 0)::bigint AS external,
    COALESCE(SUM(COALESCE(wallet_credit_pence, 0)), 0)::bigint AS credit,
    COUNT(*)::bigint AS orders,
    COALESCE(SUM(COALESCE(qty, 0)), 0)::bigint AS tickets
  FROM public.checkout_intents
  WHERE state = 'confirmed'
    AND provider IS DISTINCT FROM 'debug'
    AND (ref IS NULL OR ref NOT LIKE 'SIM-%')
    AND campaign_id IS NOT NULL
),
report AS (
  SELECT
    COALESCE(SUM(gross_pence), 0)::bigint      AS gross,
    COALESCE(SUM(external_pence), 0)::bigint   AS external,
    COALESCE(SUM(credit_pence), 0)::bigint     AS credit,
    COALESCE(SUM(confirmed_orders), 0)::bigint AS orders,
    COALESCE(SUM(tickets_sold), 0)::bigint     AS tickets
  FROM public.reporting_sales_daily
)
INSERT INTO public.reporting_meta (key, value, updated_at)
SELECT
  'last_reconciliation',
  jsonb_build_object(
    'reconciled_at', now(),
    'balanced', (s.gross = r.gross AND s.external = r.external AND s.credit = r.credit
                 AND s.orders = r.orders AND s.tickets = r.tickets),
    'diff_gross', s.gross - r.gross,
    'diff_external', s.external - r.external,
    'diff_credit', s.credit - r.credit,
    'diff_orders', s.orders - r.orders,
    'diff_tickets', s.tickets - r.tickets
  ),
  now()
FROM source s CROSS JOIN report r
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
