-- ============================================================================
-- WTF Marketing Hub — Stage 3C prerequisite: existing-customer activation &
--                       pre-registration reconciliation (DATA migration).
-- ----------------------------------------------------------------------------
-- PURPOSE
--   A one-time, set-based, idempotent DATA activation that gives the Marketing
--   Hub a real consented audience to work with LATER:
--
--     Part 1  Activate existing Auth customers that have never expressed a
--             marketing preference (insert an ENABLED marketing_preferences row).
--     Part 2  Reconcile consented pre_registrations:
--               * matched to an Auth user  -> activate that Auth user (only if
--                 they have no preference row yet), using the pre-registration
--                 as consent evidence; NEVER create an external contact.
--               * not matched to an Auth user -> insert a consented
--                 marketing_external_contacts row (enabled unless suppressed).
--
--   This script creates NO sending capability. It does not detect
--   opportunities, create recipients, create automation runs, enable discovery
--   or sending, change rollout_limit, or touch Resend / checkout / payments /
--   tickets / wallet / any customer-facing path.
--
-- CRITICAL INVARIANTS (enforced structurally below)
--   * Existing marketing_preferences rows are NEVER updated. Every activation is
--     an INSERT guarded by NOT EXISTS and ON CONFLICT (user_id) DO NOTHING, so
--     a pre-existing enabled OR disabled preference, unsubscribed_at, and its
--     event history are all left byte-for-byte unchanged.
--   * Unsubscribes / suppressions are NEVER reversed. This script does not write
--     marketing_suppressions at all; it only READS them to decide whether a NEW
--     external contact may be enabled.
--   * The Marketing Hub must be GLOBALLY PAUSED. Before any activation the
--     script asserts sending_enabled = false, discovery_enabled = false and
--     rollout_limit = 0, and RAISES (rolling everything back) otherwise.
--
-- EXECUTION ORDER NOTE (provenance precedence)
--   The spec is written as "Part 1 then Part 2". This script runs the
--   pre-registration-matched Auth activation (Part 2, matched branch) BEFORE the
--   generic existing-customer activation (Part 1). Both branches only ever fill
--   ABSENT preference rows, so ordering can never overwrite anything; running
--   the pre-registration branch first simply records the STRONGER, dated consent
--   evidence (consent_source = 'pre_registration', consented_at =
--   pre_registrations.created_at) for people who actually pre-registered,
--   instead of the generic 'existing_customer_activation'. This is why the two
--   authPreferencesInserted* counters are both meaningful.
--
-- SAFETY / SCOPE
--   * ATOMIC: whole script runs inside one BEGIN/COMMIT; any failure rolls the
--     entire activation back.
--   * FAIL FAST: LOCAL lock_timeout + statement_timeout abort quickly on a busy
--     production database instead of blocking.
--   * ADDITIVE DATA ONLY: no CREATE/ALTER/DROP of any table, no trigger, no
--     function, no extension. Only INSERTs into marketing_preferences,
--     marketing_preference_events and marketing_external_contacts.
--   * Does NOT modify migrations 001-005.
--   * Does NOT call refresh_customer_marketing_profiles(); the existing
--     profile-refresh cron picks the preference changes up after COMMIT.
--
-- HOW TO RUN
--   The application NEVER executes this. Run it manually ONCE in the Supabase
--   SQL editor (or psql), AFTER migrations 001-005, while Marketing is paused.
--   It is safe to re-run: a second run inserts nothing (all guards are
--   idempotent) and returns the same shape of aggregate result.
--
-- RESULT
--   Returns exactly ONE row: a single aggregate JSON object. No customer ids,
--   no email addresses, no raw rows.
-- ============================================================================

BEGIN;

-- Fail fast rather than block on a busy production database, and never let the
-- activation run away. LOCAL = scoped to this transaction only; nothing global.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ----------------------------------------------------------------------------
-- Guard (read-only): dependency preflight + single-execution advisory lock +
-- global-pause assertion. Any failure RAISES and rolls the whole script back
-- BEFORE a single row is activated.
-- ----------------------------------------------------------------------------
DO $guard$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  v_dep     text;
  v_sending   boolean;
  v_discovery boolean;
  v_rollout   integer;
BEGIN
  -- 1) Every required dependency must already exist. to_regclass() is a pure
  --    lookup (NULL when absent); we create/alter NONE of these objects.
  FOREACH v_dep IN ARRAY ARRAY[
    'auth.users',
    'public.marketing_preferences',
    'public.marketing_preference_events',
    'public.marketing_suppressions',
    'public.marketing_external_contacts',
    'public.pre_registrations',
    'public.marketing_control_state'
  ] LOOP
    IF to_regclass(v_dep) IS NULL THEN
      v_missing := array_append(v_missing, v_dep);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'Stage 3C activation aborted: required dependency % is missing. Run migrations 001-005 first.',
      array_to_string(v_missing, ', ');
  END IF;

  -- 2) Refuse to overlap with a concurrent execution of THIS activation.
  --    Transaction-scoped lock, released automatically at COMMIT/ROLLBACK.
  IF NOT pg_try_advisory_xact_lock(hashtext('wtf_marketing_stage_3c_existing_customer_activation')) THEN
    RAISE EXCEPTION
      'Stage 3C activation aborted: another execution is already in progress (advisory lock held).';
  END IF;

  -- 3) The Marketing Hub must be GLOBALLY PAUSED. Refuse to activate anyone
  --    unless sending + discovery are off and rollout_limit is 0.
  SELECT sending_enabled, discovery_enabled, rollout_limit
    INTO v_sending, v_discovery, v_rollout
    FROM public.marketing_control_state
   WHERE key = 'default';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Stage 3C activation aborted: marketing_control_state singleton (key=''default'') not found; cannot confirm Marketing is paused.';
  END IF;

  IF v_sending IS DISTINCT FROM false
     OR v_discovery IS DISTINCT FROM false
     OR v_rollout   IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION
      'Stage 3C activation aborted: Marketing is not globally paused (sending_enabled=%, discovery_enabled=%, rollout_limit=%). Refusing to activate.',
      v_sending, v_discovery, v_rollout;
  END IF;
END
$guard$;

-- ----------------------------------------------------------------------------
-- Aggregate result carrier. ON COMMIT DROP keeps it strictly transaction-local.
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _stage3c_activation_result (
  total_auth_users_considered                          bigint NOT NULL,
  existing_preference_rows_preserved                   bigint NOT NULL,
  auth_preferences_inserted_from_pre_registration      bigint NOT NULL,
  auth_preferences_inserted_from_existing_activation   bigint NOT NULL,
  external_pre_registrations_inserted                  bigint NOT NULL,
  pre_registrations_matched_to_auth                    bigint NOT NULL,
  suppressed_external_contacts_not_enabled             bigint NOT NULL,
  final_enabled_preference_count                       bigint NOT NULL,
  final_external_enabled_count                         bigint NOT NULL
) ON COMMIT DROP;

-- ----------------------------------------------------------------------------
-- The activation itself. All mutations are set-based (no per-user loop) and
-- every count is captured from RETURNING, so the aggregate result is exact.
-- ----------------------------------------------------------------------------
DO $activate$
DECLARE
  -- Shared validity predicate for a normalised email address. Kept in one place
  -- so Auth and pre-registration paths agree on what "valid" means. Mirrors the
  -- app's isValidEmail: non-empty, no whitespace, one '@', a dotted domain.
  c_email_re CONSTANT text := '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  v_total_auth_considered  bigint := 0;
  v_pref_before            bigint := 0;
  v_auth_from_prereg       bigint := 0;
  v_auth_from_existing     bigint := 0;
  v_prereg_matched_auth    bigint := 0;
  v_external_inserted      bigint := 0;
  v_external_suppressed    bigint := 0;
  v_final_enabled_pref     bigint := 0;
  v_final_external_enabled bigint := 0;
BEGIN
  -- === Baseline snapshots (before any activation) =========================

  -- Auth users we consider = those with a valid, non-empty normalised email.
  SELECT count(*) INTO v_total_auth_considered
    FROM auth.users u
   WHERE u.email IS NOT NULL
     AND lower(btrim(u.email)) ~ c_email_re;

  -- Every preference row that already exists is preserved untouched by design.
  SELECT count(*) INTO v_pref_before
    FROM public.marketing_preferences;

  -- Consented pre-registrations whose normalised email matches an Auth user.
  SELECT count(*) INTO v_prereg_matched_auth
    FROM public.pre_registrations pr
   WHERE pr.consent = true
     AND EXISTS (
       SELECT 1 FROM auth.users u
        WHERE u.email IS NOT NULL
          AND lower(btrim(u.email)) =
              COALESCE(NULLIF(lower(btrim(pr.email_lc)), ''), lower(btrim(pr.email)))
     );

  -- === Part 2 (matched branch, run first): activate Auth users who ========
  -- === pre-registered with consent and have NO preference row yet. ========
  WITH matched AS (
    SELECT u.id AS user_id, min(pr.created_at) AS consented_at
      FROM auth.users u
      JOIN public.pre_registrations pr
        ON pr.consent = true
       AND COALESCE(NULLIF(lower(btrim(pr.email_lc)), ''), lower(btrim(pr.email)))
           = lower(btrim(u.email))
     WHERE u.email IS NOT NULL
       AND lower(btrim(u.email)) ~ c_email_re
       AND NOT EXISTS (
         SELECT 1 FROM public.marketing_preferences mp WHERE mp.user_id = u.id
       )
     GROUP BY u.id
  ),
  ins AS (
    INSERT INTO public.marketing_preferences AS mp (
      user_id, email_marketing_enabled, consented_at, consent_source,
      consent_version, unsubscribed_at, created_at, updated_at
    )
    SELECT m.user_id, true, m.consented_at, 'pre_registration',
           'pre_registration_v1', NULL, now(), now()
      FROM matched m
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id
  ),
  ev AS (
    -- Data-modifying CTEs always run to completion even when unreferenced.
    INSERT INTO public.marketing_preference_events (
      user_id, event_type, source, consent_version, metadata
    )
    SELECT i.user_id, 'subscribed', 'pre_registration', 'pre_registration_v1',
           jsonb_build_object('activation', 'existing_customer_activation',
                              'provenance', 'pre_registration')
      FROM ins i
    RETURNING 1
  )
  SELECT count(*) INTO v_auth_from_prereg FROM ins;

  -- === Part 1: activate all remaining Auth users with a valid email and ===
  -- === no preference row (generic existing-customer activation). ==========
  WITH cand AS (
    SELECT u.id AS user_id
      FROM auth.users u
     WHERE u.email IS NOT NULL
       AND lower(btrim(u.email)) ~ c_email_re
       AND NOT EXISTS (
         SELECT 1 FROM public.marketing_preferences mp WHERE mp.user_id = u.id
       )
  ),
  ins AS (
    INSERT INTO public.marketing_preferences AS mp (
      user_id, email_marketing_enabled, consented_at, consent_source,
      consent_version, unsubscribed_at, created_at, updated_at
    )
    SELECT c.user_id, true, now(), 'existing_customer_activation',
           'existing_customer_activation_v1', NULL, now(), now()
      FROM cand c
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id
  ),
  ev AS (
    INSERT INTO public.marketing_preference_events (
      user_id, event_type, source, consent_version, metadata
    )
    SELECT i.user_id, 'subscribed', 'existing_customer_activation',
           'existing_customer_activation_v1',
           jsonb_build_object('activation', 'existing_customer_activation',
                              'provenance', 'existing_customer')
      FROM ins i
    RETURNING 1
  )
  SELECT count(*) INTO v_auth_from_existing FROM ins;

  -- === Part 2 (unmatched branch): consented pre-registrations with no =====
  -- === Auth account become external contacts (enabled unless suppressed). =
  WITH src AS (
    -- One row per normalised email; earliest consent wins. Only consented,
    -- valid-email pre-registrations that do NOT match an Auth user and are not
    -- already an external contact.
    SELECT DISTINCT ON (n.norm_email)
           n.norm_email                         AS email_lc,
           left(NULLIF(btrim(n.first_name), ''), 200) AS first_name,
           left(NULLIF(btrim(n.last_name),  ''), 200) AS last_name,
           n.id                                 AS source_record_id,
           n.created_at                         AS consented_at
      FROM (
        SELECT pr.id, pr.first_name, pr.last_name, pr.created_at,
               COALESCE(NULLIF(lower(btrim(pr.email_lc)), ''), lower(btrim(pr.email))) AS norm_email
          FROM public.pre_registrations pr
         WHERE pr.consent = true
      ) n
     WHERE n.norm_email ~ c_email_re
       AND NOT EXISTS (
         SELECT 1 FROM auth.users u
          WHERE u.email IS NOT NULL
            AND lower(btrim(u.email)) = n.norm_email
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.marketing_external_contacts ec
          WHERE ec.email_lc = n.norm_email
       )
     ORDER BY n.norm_email, n.created_at ASC
  ),
  flagged AS (
    SELECT s.*,
           EXISTS (
             SELECT 1 FROM public.marketing_suppressions ms
              WHERE ms.revoked_at IS NULL AND ms.email_lc = s.email_lc
           ) AS is_suppressed
      FROM src s
  ),
  ins AS (
    INSERT INTO public.marketing_external_contacts (
      email_lc, first_name, last_name, source, source_record_id,
      consented_at, consent_source, consent_version, marketing_enabled,
      unsubscribed_at, created_at, updated_at
    )
    SELECT f.email_lc, f.first_name, f.last_name, 'pre_registration', f.source_record_id,
           f.consented_at, 'pre_registration', 'pre_registration_v1',
           -- An actively-suppressed email is recorded but NEVER enabled; the
           -- suppression itself is left entirely untouched.
           CASE WHEN f.is_suppressed THEN false ELSE true END,
           NULL, now(), now()
      FROM flagged f
    ON CONFLICT (email_lc) DO NOTHING
    RETURNING marketing_enabled
  )
  SELECT count(*), count(*) FILTER (WHERE marketing_enabled = false)
    INTO v_external_inserted, v_external_suppressed
    FROM ins;

  -- === Final snapshots (after activation) =================================
  SELECT count(*) INTO v_final_enabled_pref
    FROM public.marketing_preferences
   WHERE email_marketing_enabled = true;

  SELECT count(*) INTO v_final_external_enabled
    FROM public.marketing_external_contacts
   WHERE marketing_enabled = true;

  INSERT INTO _stage3c_activation_result (
    total_auth_users_considered,
    existing_preference_rows_preserved,
    auth_preferences_inserted_from_pre_registration,
    auth_preferences_inserted_from_existing_activation,
    external_pre_registrations_inserted,
    pre_registrations_matched_to_auth,
    suppressed_external_contacts_not_enabled,
    final_enabled_preference_count,
    final_external_enabled_count
  ) VALUES (
    v_total_auth_considered,
    v_pref_before,
    v_auth_from_prereg,
    v_auth_from_existing,
    v_external_inserted,
    v_prereg_matched_auth,
    v_external_suppressed,
    v_final_enabled_pref,
    v_final_external_enabled
  );
END
$activate$;

-- ----------------------------------------------------------------------------
-- Part 4: return exactly one aggregate JSON row. No ids, no emails, no rows.
-- ----------------------------------------------------------------------------
SELECT jsonb_build_object(
  'totalAuthUsersConsidered',                            r.total_auth_users_considered,
  'existingPreferenceRowsPreserved',                     r.existing_preference_rows_preserved,
  'authPreferencesInsertedFromPreRegistration',          r.auth_preferences_inserted_from_pre_registration,
  'authPreferencesInsertedFromExistingCustomerActivation', r.auth_preferences_inserted_from_existing_activation,
  'externalPreRegistrationsInserted',                    r.external_pre_registrations_inserted,
  'preRegistrationsMatchedToAuth',                       r.pre_registrations_matched_to_auth,
  'suppressedExternalContactsNotEnabled',                r.suppressed_external_contacts_not_enabled,
  'finalEnabledPreferenceCount',                         r.final_enabled_preference_count,
  'finalExternalEnabledCount',                           r.final_external_enabled_count
) AS result
FROM _stage3c_activation_result r;

COMMIT;

-- ============================================================================
-- End of Stage 3C activation. No email was sent and no sending / discovery /
-- leasing capability was created. sending_enabled, discovery_enabled and
-- rollout_limit are untouched (only READ, in the pause assertion).
-- ============================================================================
