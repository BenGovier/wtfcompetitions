-- ============================================================================
-- WTF Reporting: Growth Analytics dashboard RPC (v1)
-- ----------------------------------------------------------------------------
-- get_admin_growth_dashboard(range, from, to, campaign, provider)
--
--   A SECOND, read-only reporting function that powers the admin Dashboard's
--   "Growth" tab. It is entirely separate from get_admin_sales_dashboard (the
--   Overview RPC is NOT modified).
--
--   Returns ONE compact jsonb payload:
--     * customers   — unique buyers, orders/buyer, external rev/buyer, AOV
--                     (each with a comparison-period value + % change)
--     * checkoutHealth — created/confirmed/failed/abandoned/in-progress cohort
--     * walletImpact   — WTF Credit redemption + external-cash leverage
--     * campaignMomentum — live campaigns only, capped at 20 rows
--
--   Guarantees:
--     * Reads are aggregate/grouped only. Raw checkout rows are NEVER returned.
--     * Returns NO names, emails or user IDs — only counts and sums.
--     * Revenue/buyer metrics use confirmed_at; checkout-health uses created_at.
--     * External revenue everywhere uses the proven fallback:
--         COALESCE(external_payment_pence, total_pence - COALESCE(wallet_credit_pence,0))
--       (6,013 older confirmed rows have a NULL external_payment_pence.)
--     * Confirmed scope matches the existing reporting system exactly:
--         state='confirmed' AND provider IS DISTINCT FROM 'debug'
--         AND (ref IS NULL OR ref NOT LIKE 'SIM-%')
--     * All period boundaries are Europe/London and reuse the Overview logic.
--
--   No tables, materialized views, triggers or cron jobs are created here.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_growth_dashboard(
  p_range    text DEFAULT 'today',
  p_from     date DEFAULT NULL,
  p_to       date DEFAULT NULL,
  p_campaign uuid DEFAULT NULL,
  p_provider text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        timestamptz := now();
  v_today      date        := (v_now AT TIME ZONE 'Europe/London')::date;
  v_tz         text        := 'Europe/London';

  v_start      timestamptz;
  v_end        timestamptz;
  v_prev_start timestamptz;
  v_prev_end   timestamptz;

  v_win_min    timestamptz;   -- union of current+comparison (single raw scan)
  v_win_max    timestamptz;

  v_span_days  numeric;
  v_use_daily  boolean;
  v_24h        timestamptz := v_now - interval '24 hours';
  v_30m        timestamptz := v_now - interval '30 minutes';

  -- Customer aggregates (current + comparison), from raw confirmed checkouts.
  v_cur_orders   bigint  := 0;
  v_cur_buyers   bigint  := 0;
  v_cur_external numeric := 0;
  v_cur_gross    numeric := 0;
  v_cur_credit   numeric := 0;
  v_prev_orders   bigint  := 0;
  v_prev_buyers   bigint  := 0;
  v_prev_external numeric := 0;
  v_prev_gross    numeric := 0;

  -- Wallet aggregates (current period only).
  v_wallet_orders    bigint  := 0;
  v_wallet_ext       numeric := 0;   -- external cash from wallet-assisted orders
  v_wallet_fully     bigint  := 0;

  -- Checkout-health cohort (by created_at).
  v_h_created    bigint := 0;
  v_h_confirmed  bigint := 0;
  v_h_failed     bigint := 0;
  v_h_inprogress bigint := 0;
  v_h_abandoned  bigint := 0;
  v_h_completed  bigint := 0;

  v_campaigns  jsonb;

  v_customers      jsonb;
  v_checko_health  jsonb;
  v_wallet_impact  jsonb;
BEGIN
  -- Transaction-local safety limit, consistent with the reporting refresh job.
  PERFORM set_config('statement_timeout', '15s', true);
  PERFORM set_config('lock_timeout', '5s', true);

  ------------------------------------------------------------------
  -- 1) Resolve period + comparison window (Europe/London) — same rules as
  --    get_admin_sales_dashboard so Growth lines up with Overview.
  ------------------------------------------------------------------
  IF p_range = 'today' THEN
    v_start := (v_today::timestamp AT TIME ZONE v_tz);
    v_end   := v_now;
    v_prev_start := ((v_today - 1)::timestamp AT TIME ZONE v_tz);
    v_prev_end   := v_prev_start + (v_end - v_start);

  ELSIF p_range = 'yesterday' THEN
    v_start := ((v_today - 1)::timestamp AT TIME ZONE v_tz);
    v_end   := (v_today::timestamp AT TIME ZONE v_tz);
    v_prev_start := ((v_today - 2)::timestamp AT TIME ZONE v_tz);
    v_prev_end   := v_start;

  ELSIF p_range = 'last_7_days' THEN
    v_start := v_now - interval '7 days';
    v_end   := v_now;
    v_prev_start := v_now - interval '14 days';
    v_prev_end   := v_now - interval '7 days';

  ELSIF p_range = 'this_month' THEN
    v_start := (date_trunc('month', v_today::timestamp) AT TIME ZONE v_tz);
    v_end   := v_now;
    v_prev_start := (date_trunc('month', (v_today - interval '1 month')::timestamp) AT TIME ZONE v_tz);
    v_prev_end   := v_prev_start + (v_end - v_start);

  ELSIF p_range = 'previous_month' THEN
    v_start := (date_trunc('month', (v_today - interval '1 month')::timestamp) AT TIME ZONE v_tz);
    v_end   := (date_trunc('month', v_today::timestamp) AT TIME ZONE v_tz);
    v_prev_start := (date_trunc('month', (v_today - interval '2 months')::timestamp) AT TIME ZONE v_tz);
    v_prev_end   := v_start;

  ELSIF p_range = 'custom' THEN
    IF p_from IS NULL OR p_to IS NULL THEN
      RAISE EXCEPTION 'custom range requires p_from and p_to';
    END IF;
    IF p_to < p_from THEN
      RAISE EXCEPTION 'p_to must be on or after p_from';
    END IF;
    IF (p_to - p_from) > 366 THEN
      RAISE EXCEPTION 'custom range too large (max 366 days)';
    END IF;
    v_start := (p_from::timestamp AT TIME ZONE v_tz);
    v_end   := ((p_to + 1)::timestamp AT TIME ZONE v_tz);   -- inclusive end date
    v_prev_start := v_start - (v_end - v_start);
    v_prev_end   := v_start;
  ELSE
    RAISE EXCEPTION 'unknown range: %', p_range;
  END IF;

  v_span_days := EXTRACT(epoch FROM (v_end - v_start)) / 86400.0;
  v_use_daily := v_span_days > 45;   -- long ranges read the daily rollup

  v_win_min := LEAST(v_start, v_prev_start);
  v_win_max := GREATEST(v_end, v_prev_end);

  ------------------------------------------------------------------
  -- 2) Customer + wallet aggregates: ONE scan over confirmed, eligible rows in
  --    the union of the current and comparison windows (bounded, sargable on
  --    confirmed_at). FILTER splits current vs comparison; no rows leave the DB.
  ------------------------------------------------------------------
  SELECT
    COALESCE(COUNT(*)                 FILTER (WHERE ci.confirmed_at >= v_start AND ci.confirmed_at < v_end), 0),
    COALESCE(COUNT(DISTINCT ci.user_id) FILTER (WHERE ci.confirmed_at >= v_start AND ci.confirmed_at < v_end), 0),
    COALESCE(SUM(ci.external_calc)     FILTER (WHERE ci.confirmed_at >= v_start AND ci.confirmed_at < v_end), 0),
    COALESCE(SUM(ci.total_pence)       FILTER (WHERE ci.confirmed_at >= v_start AND ci.confirmed_at < v_end), 0),
    COALESCE(SUM(ci.credit_calc)       FILTER (WHERE ci.confirmed_at >= v_start AND ci.confirmed_at < v_end), 0),
    COALESCE(COUNT(*)                 FILTER (WHERE ci.confirmed_at >= v_prev_start AND ci.confirmed_at < v_prev_end), 0),
    COALESCE(COUNT(DISTINCT ci.user_id) FILTER (WHERE ci.confirmed_at >= v_prev_start AND ci.confirmed_at < v_prev_end), 0),
    COALESCE(SUM(ci.external_calc)     FILTER (WHERE ci.confirmed_at >= v_prev_start AND ci.confirmed_at < v_prev_end), 0),
    COALESCE(SUM(ci.total_pence)       FILTER (WHERE ci.confirmed_at >= v_prev_start AND ci.confirmed_at < v_prev_end), 0),
    -- wallet, current period only
    COALESCE(COUNT(*)  FILTER (WHERE ci.confirmed_at >= v_start AND ci.confirmed_at < v_end AND ci.credit_calc > 0), 0),
    COALESCE(SUM(ci.external_calc) FILTER (WHERE ci.confirmed_at >= v_start AND ci.confirmed_at < v_end AND ci.credit_calc > 0), 0),
    COALESCE(COUNT(*)  FILTER (WHERE ci.confirmed_at >= v_start AND ci.confirmed_at < v_end AND ci.credit_calc > 0 AND ci.external_calc <= 0), 0)
  INTO
    v_cur_orders, v_cur_buyers, v_cur_external, v_cur_gross, v_cur_credit,
    v_prev_orders, v_prev_buyers, v_prev_external, v_prev_gross,
    v_wallet_orders, v_wallet_ext, v_wallet_fully
  FROM (
    SELECT
      ci.user_id,
      ci.total_pence,
      ci.confirmed_at,
      COALESCE(ci.wallet_credit_pence, 0) AS credit_calc,
      CASE
        WHEN ci.external_payment_pence IS NOT NULL THEN ci.external_payment_pence
        ELSE ci.total_pence - COALESCE(ci.wallet_credit_pence, 0)
      END AS external_calc
    FROM public.checkout_intents ci
    WHERE ci.state = 'confirmed'
      AND ci.provider IS DISTINCT FROM 'debug'
      AND (ci.ref IS NULL OR ci.ref NOT LIKE 'SIM-%')
      AND ci.confirmed_at >= v_win_min
      AND ci.confirmed_at <  v_win_max
      AND (p_campaign IS NULL OR ci.campaign_id = p_campaign)
      AND (p_provider IS NULL OR ci.provider = p_provider)
  ) ci;

  ------------------------------------------------------------------
  -- 3) Checkout-health cohort — intents CREATED in the selected period,
  --    classified by state (+ 30-minute pending boundary). Excludes debug/SIM
  --    but includes all states. Success rate excludes in-progress attempts.
  ------------------------------------------------------------------
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(COUNT(*) FILTER (WHERE ci.state = 'confirmed'), 0),
    COALESCE(COUNT(*) FILTER (WHERE ci.state = 'failed'), 0),
    COALESCE(COUNT(*) FILTER (WHERE ci.state = 'pending' AND ci.created_at >  v_30m), 0),
    COALESCE(COUNT(*) FILTER (WHERE ci.state = 'pending' AND ci.created_at <= v_30m), 0)
  INTO v_h_created, v_h_confirmed, v_h_failed, v_h_inprogress, v_h_abandoned
  FROM public.checkout_intents ci
  WHERE ci.created_at >= v_start
    AND ci.created_at <  v_end
    AND ci.provider IS DISTINCT FROM 'debug'
    AND (ci.ref IS NULL OR ci.ref NOT LIKE 'SIM-%')
    AND (p_campaign IS NULL OR ci.campaign_id = p_campaign)
    AND (p_provider IS NULL OR ci.provider = p_provider);

  v_h_completed := v_h_confirmed + v_h_failed + v_h_abandoned;

  ------------------------------------------------------------------
  -- 4) Campaign momentum — LIVE campaigns only, capped at 20 rows.
  --    Buyer-independent values come from the sales rollups; a single grouped
  --    raw-checkout aggregate supplies unique buyers (24h) + last purchase.
  --    No per-campaign queries.
  ------------------------------------------------------------------
  WITH live AS (
    SELECT c.id, c.title, c.slug, c.status, c.max_tickets_total
      FROM public.campaigns c
     WHERE c.status = 'live'
       AND (p_campaign IS NULL OR c.id = p_campaign)
  ),
  period AS (
    SELECT campaign_id,
           SUM(tickets_sold)     AS tickets,
           SUM(confirmed_orders) AS orders,
           SUM(external_pence)   AS external_pence
      FROM (
        SELECT campaign_id, tickets_sold, confirmed_orders, external_pence
          FROM public.reporting_sales_minute
         WHERE NOT v_use_daily
           AND bucket_start >= v_start AND bucket_start < v_end
           AND (p_provider IS NULL OR provider = p_provider)
        UNION ALL
        SELECT campaign_id, tickets_sold, confirmed_orders, external_pence
          FROM public.reporting_sales_daily
         WHERE v_use_daily
           AND bucket_date >= (v_start AT TIME ZONE v_tz)::date
           AND bucket_date <  (v_end   AT TIME ZONE v_tz)::date
           AND (p_provider IS NULL OR provider = p_provider)
      ) u
     GROUP BY campaign_id
  ),
  last24 AS (
    SELECT campaign_id,
           SUM(tickets_sold)   AS tickets,
           SUM(external_pence) AS external_pence
      FROM public.reporting_sales_minute
     WHERE bucket_start >= v_24h
       AND (p_provider IS NULL OR provider = p_provider)
     GROUP BY campaign_id
  ),
  lifetime AS (
    SELECT campaign_id, SUM(tickets_sold) AS tickets
      FROM public.reporting_sales_daily
     GROUP BY campaign_id
  ),
  raw24 AS (
    -- ONE grouped raw aggregate, restricted to live campaigns (bounded set):
    -- unique buyers in the last 24h + the most recent confirmed purchase.
    SELECT ci.campaign_id,
           COUNT(DISTINCT ci.user_id) FILTER (WHERE ci.confirmed_at >= v_24h) AS buyers_24h,
           MAX(ci.confirmed_at)                                               AS last_confirmed_at
      FROM public.checkout_intents ci
      JOIN live l ON l.id = ci.campaign_id
     WHERE ci.state = 'confirmed'
       AND ci.provider IS DISTINCT FROM 'debug'
       AND (ci.ref IS NULL OR ci.ref NOT LIKE 'SIM-%')
       AND (p_provider IS NULL OR ci.provider = p_provider)
     GROUP BY ci.campaign_id
  ),
  joined AS (
    SELECT
      l.id, l.title, l.slug, l.status, l.max_tickets_total,
      COALESCE(p.tickets, 0)         AS tickets_in_period,
      COALESCE(p.orders, 0)          AS orders_in_period,
      COALESCE(p.external_pence, 0)  AS external_in_period,
      COALESCE(l24.tickets, 0)       AS tickets_24h,
      COALESCE(l24.external_pence, 0) AS external_24h,
      COALESCE(lt.tickets, 0)        AS lifetime_tickets,
      COALESCE(r.buyers_24h, 0)      AS buyers_24h,
      r.last_confirmed_at            AS last_confirmed_at
    FROM live l
    LEFT JOIN period   p   ON p.campaign_id   = l.id
    LEFT JOIN last24   l24 ON l24.campaign_id = l.id
    LEFT JOIN lifetime lt  ON lt.campaign_id  = l.id
    LEFT JOIN raw24    r   ON r.campaign_id   = l.id
  )
  SELECT COALESCE(jsonb_agg(row ORDER BY sort_tickets DESC, sort_lifetime DESC), '[]'::jsonb)
    INTO v_campaigns
  FROM (
    SELECT
      tickets_in_period AS sort_tickets,
      lifetime_tickets  AS sort_lifetime,
      jsonb_build_object(
        'campaignId', id,
        'title', COALESCE(title, '(untitled)'),
        'slug', slug,
        'status', status,
        'soldPercentage', CASE WHEN COALESCE(max_tickets_total, 0) > 0
                               THEN round(lifetime_tickets::numeric / max_tickets_total * 100, 1)
                               ELSE NULL END,
        'ticketsInPeriod', tickets_in_period,
        'ticketsLast24Hours', tickets_24h,
        'externalRevenueLast24HoursPence', external_24h,
        'uniqueBuyersLast24Hours', buyers_24h,
        'lastConfirmedAt', last_confirmed_at,
        'averageOrderValuePence', CASE WHEN orders_in_period > 0
                                       THEN round(external_in_period::numeric / orders_in_period)
                                       ELSE NULL END
      ) AS row
    FROM joined
    ORDER BY sort_tickets DESC, sort_lifetime DESC
    LIMIT 20
  ) ordered;

  ------------------------------------------------------------------
  -- 5) Assemble compact camelCase payload (matches GrowthDashboardPayload).
  ------------------------------------------------------------------
  v_customers := jsonb_build_object(
    'uniqueBuyers', jsonb_build_object(
      'current', v_cur_buyers, 'previous', v_prev_buyers,
      'changePct', public._reporting_pct(v_cur_buyers::numeric, v_prev_buyers::numeric)),
    'ordersPerBuyer', jsonb_build_object(
      'current',  CASE WHEN v_cur_buyers  > 0 THEN round(v_cur_orders::numeric  / v_cur_buyers,  4) ELSE 0 END,
      'previous', CASE WHEN v_prev_buyers > 0 THEN round(v_prev_orders::numeric / v_prev_buyers, 4) ELSE 0 END,
      'changePct', public._reporting_pct(
                     CASE WHEN v_cur_buyers  > 0 THEN v_cur_orders::numeric  / v_cur_buyers  ELSE 0 END,
                     CASE WHEN v_prev_buyers > 0 THEN v_prev_orders::numeric / v_prev_buyers ELSE 0 END)),
    'externalRevenuePerBuyerPence', jsonb_build_object(
      'current',  CASE WHEN v_cur_buyers  > 0 THEN round(v_cur_external  / v_cur_buyers)  ELSE 0 END,
      'previous', CASE WHEN v_prev_buyers > 0 THEN round(v_prev_external / v_prev_buyers) ELSE 0 END,
      'changePct', public._reporting_pct(
                     CASE WHEN v_cur_buyers  > 0 THEN v_cur_external  / v_cur_buyers  ELSE 0 END,
                     CASE WHEN v_prev_buyers > 0 THEN v_prev_external / v_prev_buyers ELSE 0 END)),
    'averageOrderValuePence', jsonb_build_object(
      'current',  CASE WHEN v_cur_orders  > 0 THEN round(v_cur_external  / v_cur_orders)  ELSE 0 END,
      'previous', CASE WHEN v_prev_orders > 0 THEN round(v_prev_external / v_prev_orders) ELSE 0 END,
      'changePct', public._reporting_pct(
                     CASE WHEN v_cur_orders  > 0 THEN v_cur_external  / v_cur_orders  ELSE 0 END,
                     CASE WHEN v_prev_orders > 0 THEN v_prev_external / v_prev_orders ELSE 0 END))
  );

  v_checko_health := jsonb_build_object(
    'created', v_h_created,
    'confirmed', v_h_confirmed,
    'failed', v_h_failed,
    'abandoned', v_h_abandoned,
    'inProgress', v_h_inprogress,
    'completedAttempts', v_h_completed,
    'successRate', CASE WHEN v_h_completed > 0
                        THEN round(v_h_confirmed::numeric / v_h_completed, 4)
                        ELSE NULL END
  );

  v_wallet_impact := jsonb_build_object(
    'confirmedOrders', v_cur_orders,
    'walletOrders', v_wallet_orders,
    'walletUsageRate', CASE WHEN v_cur_orders > 0
                            THEN round(v_wallet_orders::numeric / v_cur_orders, 4)
                            ELSE NULL END,
    'walletCreditRedeemedPence', v_cur_credit,
    'externalCashFromWalletOrdersPence', v_wallet_ext,
    'fullyWalletFundedOrders', v_wallet_fully,
    'averageCreditPerWalletOrderPence', CASE WHEN v_wallet_orders > 0
                                             THEN round(v_cur_credit / v_wallet_orders)
                                             ELSE NULL END,
    'externalCashPerCreditPound', CASE WHEN v_cur_credit > 0
                                       THEN round(v_wallet_ext / v_cur_credit, 4)
                                       ELSE NULL END
  );

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start', v_start, 'end', v_end,
      'comparisonStart', v_prev_start, 'comparisonEnd', v_prev_end,
      'timezone', 'Europe/London'),
    'customers', v_customers,
    'checkoutHealth', v_checko_health,
    'walletImpact', v_wallet_impact,
    'campaignMomentum', v_campaigns,
    'generatedAt', v_now
  );
END;
$$;

COMMENT ON FUNCTION public.get_admin_growth_dashboard(text,date,date,uuid,text) IS
  'Compact Growth Analytics payload (customers, checkout health, wallet impact, live campaign momentum). Aggregate-only; returns no customer identities.';

-- Execution grants: service_role only (called from the authenticated admin API).
REVOKE ALL ON FUNCTION public.get_admin_growth_dashboard(text,date,date,uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_growth_dashboard(text,date,date,uuid,text) TO service_role;

-- ----------------------------------------------------------------------------
-- Dependency note: this function reuses public._reporting_pct(numeric, numeric)
-- created in scripts/reporting/004-reporting-dashboard-rpc.sql. Run 004 first.
--
-- Performance note: the checkout-health cohort and (when no daily rollup is
-- used) buyer scans read checkout_intents by created_at / confirmed_at. Install
-- the created_at index before launch:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkout_intents_created_at
--     ON public.checkout_intents (created_at);
-- ----------------------------------------------------------------------------
