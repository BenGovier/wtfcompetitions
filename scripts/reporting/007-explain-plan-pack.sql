-- ============================================================================
-- WTF Reporting: READ-ONLY execution-plan pack  (EXPLAIN, NOT EXPLAIN ANALYZE)
-- ----------------------------------------------------------------------------
-- Purpose: prove access paths BEFORE approving the reporting system.
--   * Every statement here is planning-only (EXPLAIN without ANALYZE) or a
--     read-only catalog inspection. Nothing executes the underlying query,
--     writes rows, or locks user tables.
--   * DO NOT add ANALYZE to sections A–C until Ben explicitly approves running
--     the queries against production (ANALYZE executes the statement).
--
-- How to read the output:
--   * Section A (bounded refresh source) is the hot path. We WANT to see an
--     "Index Scan"/"Bitmap Index Scan" using a confirmed_at partial index and a
--     small estimated row count. If you instead see "Seq Scan on
--     checkout_intents" it means the predicate is NON-SARGABLE (see the note in
--     A2) and the refresh is NOT safe to run every minute.
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- A. Bounded refresh SOURCE query (the every-tick hot path).
-- ----------------------------------------------------------------------------
-- A1. Plan for the query EXACTLY as the shipped refresh function runs it today
--     (predicate wraps the timestamp in COALESCE). Inspect whether the planner
--     can use idx_checkout_intents_confirmed_at_confirmed. Expectation with the
--     current code: it CANNOT (COALESCE(confirmed_at, created_at) is not an
--     indexable expression against a bare-confirmed_at index) -> Seq Scan.
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT
  ci.campaign_id, ci.provider, ci.total_pence, ci.wallet_credit_pence, ci.qty,
  COALESCE(ci.confirmed_at, ci.created_at) AS ts
FROM public.checkout_intents ci
WHERE ci.state = 'confirmed'
  AND ci.provider IS DISTINCT FROM 'debug'
  AND (ci.ref IS NULL OR ci.ref NOT LIKE 'SIM-%')
  AND ci.campaign_id IS NOT NULL
  AND COALESCE(ci.confirmed_at, ci.created_at) >= (now() - interval '15 minutes')
  AND COALESCE(ci.confirmed_at, ci.created_at) <  (now() + interval '1 minute');

-- A2. Plan for the SARGABLE rewrite (recommended remediation): filter the raw
--     indexed column directly so the confirmed_at partial index is usable.
--     Compare its plan to A1 — this should switch to an index/bitmap scan.
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT
  ci.campaign_id, ci.provider, ci.total_pence, ci.wallet_credit_pence, ci.qty,
  ci.confirmed_at AS ts
FROM public.checkout_intents ci
WHERE ci.state = 'confirmed'
  AND ci.provider IS DISTINCT FROM 'debug'
  AND (ci.ref IS NULL OR ci.ref NOT LIKE 'SIM-%')
  AND ci.campaign_id IS NOT NULL
  AND ci.confirmed_at >= (now() - interval '15 minutes')
  AND ci.confirmed_at <  (now() + interval '1 minute');

-- A3. Plan for the 3-DAY lookback the cron route actually requests today
--     (lookback_minutes = 4320). Shows how much work each scheduled tick plans
--     under the current configuration.
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT
  ci.campaign_id, ci.provider, ci.total_pence, ci.wallet_credit_pence, ci.qty,
  ci.confirmed_at AS ts
FROM public.checkout_intents ci
WHERE ci.state = 'confirmed'
  AND ci.provider IS DISTINCT FROM 'debug'
  AND (ci.ref IS NULL OR ci.ref NOT LIKE 'SIM-%')
  AND ci.campaign_id IS NOT NULL
  AND ci.confirmed_at >= (now() - interval '4320 minutes')
  AND ci.confirmed_at <  (now() + interval '1 minute');

-- ----------------------------------------------------------------------------
-- B. Rebuild ONE affected UK-day daily bucket from minute rows.
-- ----------------------------------------------------------------------------
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT
  (m.bucket_start AT TIME ZONE 'Europe/London')::date AS bucket_date,
  m.campaign_id, m.provider,
  SUM(m.gross_pence), SUM(m.external_pence), SUM(m.credit_pence),
  SUM(m.confirmed_orders), SUM(m.tickets_sold)
FROM public.reporting_sales_minute m
WHERE (m.bucket_start AT TIME ZONE 'Europe/London')::date
      = (now() AT TIME ZONE 'Europe/London')::date
GROUP BY 1, 2, 3;

-- ----------------------------------------------------------------------------
-- C. Dashboard RPC-equivalent reads (KPI totals) for each standard range.
--    These mirror the SUM(...) the RPC runs against the rollups.
-- ----------------------------------------------------------------------------
-- C1. Today  -> reporting_sales_minute, [local-midnight, now)
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT SUM(gross_pence), SUM(external_pence), SUM(credit_pence),
       SUM(confirmed_orders), SUM(tickets_sold)
FROM public.reporting_sales_minute
WHERE bucket_start >= ((now() AT TIME ZONE 'Europe/London')::date::timestamp AT TIME ZONE 'Europe/London')
  AND bucket_start <  now();

-- C2. Last 7 days -> reporting_sales_minute
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT SUM(gross_pence), SUM(external_pence), SUM(credit_pence),
       SUM(confirmed_orders), SUM(tickets_sold)
FROM public.reporting_sales_minute
WHERE bucket_start >= (now() - interval '7 days')
  AND bucket_start <  now();

-- C3. This month -> reporting_sales_minute (span <= 45 days uses minute rows)
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT SUM(gross_pence), SUM(external_pence), SUM(credit_pence),
       SUM(confirmed_orders), SUM(tickets_sold)
FROM public.reporting_sales_minute
WHERE bucket_start >= (date_trunc('month', (now() AT TIME ZONE 'Europe/London')::date::timestamp) AT TIME ZONE 'Europe/London')
  AND bucket_start <  now();

-- C4. All time -> reporting_sales_daily (long ranges read the daily rollup)
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT SUM(gross_pence), SUM(external_pence), SUM(credit_pence),
       SUM(confirmed_orders), SUM(tickets_sold)
FROM public.reporting_sales_daily;

-- C5. Campaign performance (all-time daily rollup, grouped) — bounded by
--     campaign count, not by checkout volume.
EXPLAIN (VERBOSE, FORMAT TEXT)
SELECT campaign_id,
       SUM(gross_pence), SUM(external_pence), SUM(credit_pence),
       SUM(confirmed_orders), SUM(tickets_sold)
FROM public.reporting_sales_daily
GROUP BY campaign_id;

-- ----------------------------------------------------------------------------
-- D. Existing-index inspection (read-only catalog).
-- ----------------------------------------------------------------------------
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('checkout_intents', 'reporting_sales_minute', 'reporting_sales_daily')
ORDER BY tablename, indexname;

-- D2. Confirm the confirmed_at column exists (drives A2/A3 sargability).
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'checkout_intents'
  AND column_name IN ('confirmed_at', 'created_at', 'updated_at', 'qty', 'ref', 'provider', 'state');

-- ----------------------------------------------------------------------------
-- E. Estimated + actual row counts in the reporting tables (post-backfill).
--    reltuples is the planner estimate (cheap); COUNT(*) is the true count.
-- ----------------------------------------------------------------------------
SELECT c.relname AS table_name,
       c.reltuples::bigint AS estimated_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('reporting_sales_minute', 'reporting_sales_daily')
ORDER BY c.relname;

SELECT 'reporting_sales_minute' AS table_name, COUNT(*) AS actual_rows FROM public.reporting_sales_minute
UNION ALL
SELECT 'reporting_sales_daily', COUNT(*) FROM public.reporting_sales_daily;

-- E2. Freshness / reconciliation snapshot (should be balanced=true after backfill).
SELECT key, value, updated_at FROM public.reporting_meta ORDER BY key;
