-- ============================================================================
-- WTF Reporting: additive indexes (CREATE INDEX CONCURRENTLY)
-- ----------------------------------------------------------------------------
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Run each statement on its own (the Supabase SQL editor runs the whole file
-- in one implicit transaction, so paste/run these ONE AT A TIME, or run this
-- file through psql with `\set ON_ERROR_STOP on` and no BEGIN/COMMIT wrapper).
--
-- Audit existing indexes FIRST so we do not create duplicates:
--   SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename IN ('checkout_intents','reporting_sales_minute','reporting_sales_daily');
--
-- Rationale: the only NEW read pattern against checkout_intents is the bounded
-- refresh window (recent confirmed rows). A partial index on the confirmation
-- timestamp keeps that refresh tightly bounded. We deliberately do NOT create a
-- wide covering index over every money column unless EXPLAIN proves it is
-- required (see 006 for the EXPLAIN to run).
-- ============================================================================

-- checkout_intents: bounded refresh lookups by confirmation time, confirmed only.
-- If confirmed_at does not exist on your schema, create the created_at variant
-- below instead (and update 003/005 accordingly).
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_checkout_intents_confirmed_at_confirmed
  ON public.checkout_intents (confirmed_at)
  WHERE state = 'confirmed';

-- Fallback / secondary: created_at is used by the refresh COALESCE when
-- confirmed_at is NULL (legacy/recovered rows).
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_checkout_intents_created_at_confirmed
  ON public.checkout_intents (created_at)
  WHERE state = 'confirmed';

-- reporting_sales_minute: time-range scans (charts / today / yesterday).
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reporting_minute_bucket_start
  ON public.reporting_sales_minute (bucket_start);

-- reporting_sales_minute: per-campaign time scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reporting_minute_campaign_bucket
  ON public.reporting_sales_minute (campaign_id, bucket_start);

-- reporting_sales_daily: date-range scans (this month / previous month / all time).
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reporting_daily_bucket_date
  ON public.reporting_sales_daily (bucket_date);

-- reporting_sales_daily: per-campaign date scans (campaign performance).
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_reporting_daily_campaign_date
  ON public.reporting_sales_daily (campaign_id, bucket_date);
