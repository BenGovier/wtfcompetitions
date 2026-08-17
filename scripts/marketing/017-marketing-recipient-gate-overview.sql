-- ============================================================================
-- WTF Marketing Hub — Stage 3D1: RECIPIENT-GATE PLANNING OVERVIEW
-- ----------------------------------------------------------------------------
-- PURPOSE
--   Install ONE service-role-only, READ-ONLY admin RPC:
--     get_admin_marketing_recipient_gate_overview()
--   It reports, in aggregate, how the persisted opportunity ledger would be
--   filtered by the per-customer marketing GATE recorded in
--   public.customer_marketing_profiles (Stage 1). It answers a single planning
--   question BEFORE any sending machinery is built: "if we tried to turn these
--   opportunities into recipients right now, how many survive each gate, and
--   why do the rest drop out?" It sends NOTHING and decides NOTHING.
--
--   Installation is INERT: it only CREATE/REPLACEs a function and asserts its
--   two read dependencies exist. ZERO opportunity/profile/control/definition
--   rows are inserted, updated or deleted. Run once AFTER migrations 001-016.
--   Committed as a reviewable artifact; it has NOT been executed.
--
-- GATE SEMANTICS (all sourced from migration 003 — NOT invented here)
--   customer_marketing_profiles columns (all NOT NULL booleans, user_id = PK):
--     * email_confirmed             — the address is confirmed.
--     * account_active              — the account is not soft-deleted.
--     * marketing_enabled           — the customer opted in to email marketing.
--     * has_active_suppression      — an active suppression exists (hard stop).
--     * marketing_eligible_snapshot — CACHED count-helper only. Per migration
--                                     003 it is NOT authoritative for sending;
--                                     send workers MUST re-check
--                                     is_marketing_email_eligible(). This RPC
--                                     surfaces it purely for planning, labelled
--                                     accordingly, and NEVER as a send decision.
--
--   Opportunities carry either user_id OR external_contact_id. This gate is
--   keyed on user_id only (the profile PK), so external-contact-only rows and
--   users without a profile row are "profile-unmatched": they satisfy no
--   positive gate here and are reported separately. That is a planning signal,
--   NOT a send/suppress decision.
--
--   NULL-handling: every gate predicate is a boolean equality against a
--   LEFT-JOINed column, so an unmatched row yields NULL and is EXCLUDED from
--   every positive counter (count(*) FILTER (WHERE <NULL>) does not count it) —
--   fail-closed by construction. profileUnmatched counts those rows explicitly.
--
-- SECURITY
--   SECURITY DEFINER, SET search_path = public, pg_temp, EXECUTE revoked from
--   public/anon/authenticated and granted ONLY to service_role. No RLS/policy/
--   grant on any table is altered.
--
-- PRIVACY
--   Returns aggregate counts and opportunity_type KEY NAMES only. Never exposes
--   user_id, external_contact_id, email, dedupe_key or any raw reason/context.
--
-- ABSOLUTELY DOES NOT
--   Send email; create recipients/runs/opportunities; enable discovery/sending;
--   change rollout_limit or any control/definition/profile row; refresh the
--   profile snapshot; make or persist any send/suppress decision; add cron/AI;
--   alter any table schema; or modify migrations 001-016.
-- ============================================================================

BEGIN;

-- Fail fast rather than block a busy production database.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ----------------------------------------------------------------------------
-- Install-time preflight (READ-ONLY): confirm the two read dependencies exist.
-- Mutates nothing; any failure rolls the whole migration back before the
-- function is created.
-- ----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_dep     text;
BEGIN
  FOREACH v_dep IN ARRAY ARRAY[
    'public.marketing_opportunities',
    'public.customer_marketing_profiles'
  ] LOOP
    IF to_regclass(v_dep) IS NULL THEN
      v_missing := array_append(v_missing, v_dep);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Stage 3D1 migration aborted: required dependency % is missing. Run migrations 001-016 first.',
      array_to_string(v_missing, ', ');
  END IF;
END
$preflight$;

-- ============================================================================
-- READ-ONLY RECIPIENT-GATE PLANNING OVERVIEW
--   STABLE + SECURITY DEFINER + fixed search_path. Reads marketing_opportunities
--   LEFT JOIN customer_marketing_profiles ONLY. Aggregate-only; no identities.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_marketing_recipient_gate_overview()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '10s'
AS $$
  SELECT jsonb_build_object(
    'generatedAt', now(),

    -- Every persisted opportunity is considered (all states/types).
    'totalOpportunities', count(*),

    -- Opportunities whose user_id resolves to a profile row.
    'profileMatched', count(*) FILTER (
      WHERE p.user_id IS NOT NULL
    ),

    -- Opportunities with NO profile match (external-contact-only rows, or users
    -- with no profile row yet). These satisfy no positive gate here.
    'profileUnmatched', count(*) FILTER (
      WHERE p.user_id IS NULL
    ),

    -- PERMISSION-backed: opted in AND not actively suppressed. This is the
    -- opt-in/consent view; it does NOT itself assert deliverability.
    'permissionBacked', count(*) FILTER (
      WHERE p.marketing_enabled = true
        AND p.has_active_suppression = false
    ),

    -- SNAPSHOT-sendable (ADVISORY ONLY): the cached marketing_eligible_snapshot
    -- says yes AND not actively suppressed. Per migration 003 this snapshot is a
    -- count-helper, NOT authoritative for sending — a real send worker MUST
    -- re-check is_marketing_email_eligible(). Reported for planning only.
    'sendableSnapshot', count(*) FILTER (
      WHERE p.marketing_eligible_snapshot = true
        AND p.has_active_suppression = false
    ),

    -- Drop-out reasons (mutually informative, not mutually exclusive).
    'suppressed', count(*) FILTER (
      WHERE p.has_active_suppression = true
    ),
    'marketingDisabled', count(*) FILTER (
      WHERE p.marketing_enabled = false
        AND p.has_active_suppression = false
    ),
    'inactiveAccount', count(*) FILTER (
      WHERE p.account_active = false
    ),
    'unconfirmedEmail', count(*) FILTER (
      WHERE p.email_confirmed = false
    ),

    -- Per-opportunity-type breakdown of the same gate. Sourced dynamically from
    -- whatever types are actually present in the ledger; deterministic ordering.
    'byOpportunityType', COALESCE(
      (
        SELECT jsonb_object_agg(
                 x.opportunity_type,
                 jsonb_build_object(
                   'total',            x.total,
                   'permissionBacked', x.permission_backed,
                   'sendableSnapshot', x.sendable_snapshot,
                   'suppressed',       x.suppressed
                 )
                 ORDER BY x.opportunity_type
               )
        FROM (
          SELECT
            o2.opportunity_type,
            count(*)::bigint AS total,
            count(*) FILTER (
              WHERE p2.marketing_enabled = true
                AND p2.has_active_suppression = false
            )::bigint AS permission_backed,
            count(*) FILTER (
              WHERE p2.marketing_eligible_snapshot = true
                AND p2.has_active_suppression = false
            )::bigint AS sendable_snapshot,
            count(*) FILTER (
              WHERE p2.has_active_suppression = true
            )::bigint AS suppressed
          FROM public.marketing_opportunities o2
          LEFT JOIN public.customer_marketing_profiles p2
            ON p2.user_id = o2.user_id
          GROUP BY o2.opportunity_type
        ) x
      ),
      '{}'::jsonb
    )
  )
  FROM public.marketing_opportunities o
  LEFT JOIN public.customer_marketing_profiles p
    ON p.user_id = o.user_id;
$$;

COMMENT ON FUNCTION public.get_admin_marketing_recipient_gate_overview() IS
  'Stage 3D1 READ-ONLY recipient-gate planning overview. Reports, in aggregate, how the persisted opportunity ledger is filtered by the customer_marketing_profiles gate (permissionBacked, sendableSnapshot, suppressed, marketingDisabled, inactiveAccount, unconfirmedEmail, profileMatched/Unmatched) overall and per opportunity_type. sendableSnapshot reflects the cached, NON-authoritative marketing_eligible_snapshot (migration 003) and is advisory only — send workers must re-check is_marketing_email_eligible(). Keyed on user_id (profile PK); external-contact-only rows count as profileUnmatched. Exposes NO identities/email/dedupe/raw reason/context. No writes. Service-role only.';

REVOKE ALL ON FUNCTION public.get_admin_marketing_recipient_gate_overview() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_marketing_recipient_gate_overview() TO service_role;

COMMIT;

-- ============================================================================
-- POST-CONDITIONS (informational):
--   * One new READ-ONLY function created; ZERO opportunity/profile/control/
--     definition rows created/updated/deleted by installation.
--   * The function reads only marketing_opportunities and
--     customer_marketing_profiles and returns aggregate, PII-free planning JSON.
--   * sendableSnapshot is advisory (cached snapshot), never a send decision.
--   * No sending/discovery/rollout/definition/profile mutation; no recipients/
--     runs/email/cron/AI; no schema change. Migrations 001-016 untouched.
-- ============================================================================
