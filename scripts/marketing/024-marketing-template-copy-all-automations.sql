-- ============================================================================
-- WTF Marketing — Stage 039: TEMPLATE COPY FOR ALL SIX AUTOMATIONS.
--
-- Purpose
--   Ensure every one of the six marketing automations has an approved, valid
--   marketing_templates row and is mapped to it, so each automation CAN reach
--   template_ready. Before this migration only `abandoned_checkout_v1` existed
--   (created + mapped in script 022); the other five automations had
--   template_id = NULL and therefore could never prepare content.
--
-- Safety posture (identical spirit to script 022)
--   * IDEMPOTENT + re-runnable: every INSERT is guarded by WHERE NOT EXISTS on
--     template_key, and every mapping UPDATE is guarded by `template_id IS NULL`.
--     Re-running changes nothing.
--   * FAIL CLOSED: aborts if any of the six expected automation keys is missing.
--   * Touches ONLY marketing_templates (insert) and marketing_automations
--     (template_id + updated_at). It does NOT change `enabled` on any automation,
--     does NOT change marketing_opportunity_definitions.enabled, and does NOT
--     touch marketing_control_state (sending_enabled / discovery_enabled /
--     rollout_limit / maximum_batch_size). Mapping a template while the
--     automation stays DISABLED is inert — nothing can send.
--   * abandoned_checkout_v1 is intentionally LEFT UNCHANGED: it is already
--     present, valid, and mapped from script 022. Rewriting proven, live-safe
--     copy would be needless churn, so this migration only fills the gap.
--
-- Copy rules (enforced by public.wtf_marketing_template_is_valid, script 022)
--   * template_key matches ^[a-z][a-z0-9_]*$, length 1..100.
--   * No angle brackets anywhere; no emoji; responsible-gambling tone (no
--     loss / near-miss / chasing / scarcity / guaranteed-win framing).
--   * Placeholders: ONLY the two the preparation layer (script 023) actually
--     resolves — {{campaign_title}} and {{campaign_url}} — and ONLY in the three
--     CAMPAIGN-SPECIFIC templates. The three NON-campaign templates are fully
--     STATIC (zero placeholders), because preparation performs no substitution
--     for them and the renderer fails closed on any leftover delimiter.
--   * Campaign-specific default_url stays NULL (destination resolved per
--     recipient into the context snapshot). Non-campaign default_url is a fixed
--     public listing URL (informational; the renderer resolves the CTA in code).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- GUARD — fail closed unless all six expected automations exist.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_found integer;
BEGIN
  SELECT count(*) INTO v_found
    FROM public.marketing_automations
   WHERE automation_key IN (
     'vip_early_access',
     'abandoned_checkout',
     'wtf_credit_waiting',
     'regular_buyer_campaign_alert',
     'new_account_no_purchase',
     'lapsed_14_days'
   );

  IF v_found <> 6 THEN
    RAISE EXCEPTION
      'Stage 039 (024) aborted: expected 6 marketing automations, found %. No changes made.',
      v_found;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- INSERT 1 — VIP Early Access (CAMPAIGN-SPECIFIC).
-- ----------------------------------------------------------------------------
INSERT INTO public.marketing_templates
  (template_key, name, subject, preview_text, heading, body_text, cta_label,
   default_url, discount_code_id, version, is_active)
SELECT
  'vip_early_access_v1',
  'VIP Early Access — Invitation',
  'Your VIP early access to {{campaign_title}}',
  'You can enter {{campaign_title}} before it opens to everyone.',
  'Early access: {{campaign_title}}',
  'As one of our VIP members, you can enter {{campaign_title}} ahead of everyone else. '
    || 'Take a look while your early access window is open and enter here: {{campaign_url}}.',
  'View the competition',
  NULL,   -- campaign-dynamic; destination resolved per recipient via context
  NULL,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_templates WHERE template_key = 'vip_early_access_v1'
);

-- ----------------------------------------------------------------------------
-- INSERT 2 — Regular Buyer Campaign Alert (CAMPAIGN-SPECIFIC).
-- ----------------------------------------------------------------------------
INSERT INTO public.marketing_templates
  (template_key, name, subject, preview_text, heading, body_text, cta_label,
   default_url, discount_code_id, version, is_active)
SELECT
  'regular_buyer_campaign_alert_v1',
  'Regular Buyer — Campaign Alert',
  'Now live: {{campaign_title}}',
  'A new competition, {{campaign_title}}, has just gone live.',
  '{{campaign_title}} is now live',
  'A new competition has just gone live and we thought you would want to know. '
    || 'If you would like to take part, you can see the full details and enter '
    || '{{campaign_title}} here: {{campaign_url}}.',
  'See the competition',
  NULL,   -- campaign-dynamic; destination resolved per recipient via context
  NULL,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_templates WHERE template_key = 'regular_buyer_campaign_alert_v1'
);

-- ----------------------------------------------------------------------------
-- INSERT 3 — WTF Credit Waiting (NON-campaign; fully static).
-- ----------------------------------------------------------------------------
INSERT INTO public.marketing_templates
  (template_key, name, subject, preview_text, heading, body_text, cta_label,
   default_url, discount_code_id, version, is_active)
SELECT
  'wtf_credit_waiting_v1',
  'WTF Credit — Reminder',
  'You have WTF credit ready to use',
  'There is credit waiting in your WTF Giveaways account.',
  'You have credit waiting',
  'This is a friendly reminder that you have credit available in your WTF Giveaways account. '
    || 'You can put it towards any of our live competitions whenever you are ready. '
    || 'Browse what is on right now and use your credit at checkout.',
  'Browse live competitions',
  'https://www.wtf-giveaways.co.uk/giveaways',
  NULL,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_templates WHERE template_key = 'wtf_credit_waiting_v1'
);

-- ----------------------------------------------------------------------------
-- INSERT 4 — New Account, No Purchase (NON-campaign; fully static).
-- ----------------------------------------------------------------------------
INSERT INTO public.marketing_templates
  (template_key, name, subject, preview_text, heading, body_text, cta_label,
   default_url, discount_code_id, version, is_active)
SELECT
  'new_account_no_purchase_v1',
  'New Account — Welcome',
  'Welcome to WTF Giveaways',
  'Thanks for joining. Here is how to get started.',
  'Welcome to WTF Giveaways',
  'Thanks for creating your account. WTF Giveaways runs regular competitions with a wide '
    || 'range of prizes, and entering only takes a moment. Whenever you are ready, take a '
    || 'look at what is live right now and find one you like.',
  'See live competitions',
  'https://www.wtf-giveaways.co.uk/giveaways',
  NULL,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_templates WHERE template_key = 'new_account_no_purchase_v1'
);

-- ----------------------------------------------------------------------------
-- INSERT 5 — Lapsed 14 Days (NON-campaign; fully static).
-- ----------------------------------------------------------------------------
INSERT INTO public.marketing_templates
  (template_key, name, subject, preview_text, heading, body_text, cta_label,
   default_url, discount_code_id, version, is_active)
SELECT
  'lapsed_14_days_v1',
  'Lapsed Customer — What is Live',
  'See what is live at WTF Giveaways',
  'New competitions have gone live since your last visit.',
  'There is plenty on right now',
  'It has been a little while since we last saw you, and we have added new competitions '
    || 'since then. If you fancy a look, you can see everything that is live right now and '
    || 'pick whichever one appeals to you.',
  'Browse competitions',
  'https://www.wtf-giveaways.co.uk/giveaways',
  NULL,
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_templates WHERE template_key = 'lapsed_14_days_v1'
);

-- ----------------------------------------------------------------------------
-- MAP — attach each automation to its template ONLY when currently unmapped.
--   `template_id IS NULL` keeps this idempotent and NEVER overwrites an existing
--   mapping (so abandoned_checkout, already mapped in 022, is left untouched).
--   `enabled` is deliberately NOT set here: every automation stays disabled.
-- ----------------------------------------------------------------------------
UPDATE public.marketing_automations a
   SET template_id = t.id,
       updated_at  = now()
  FROM (VALUES
    ('vip_early_access',             'vip_early_access_v1'),
    ('abandoned_checkout',           'abandoned_checkout_v1'),
    ('wtf_credit_waiting',           'wtf_credit_waiting_v1'),
    ('regular_buyer_campaign_alert', 'regular_buyer_campaign_alert_v1'),
    ('new_account_no_purchase',      'new_account_no_purchase_v1'),
    ('lapsed_14_days',               'lapsed_14_days_v1')
  ) AS m(automation_key, template_key)
  JOIN public.marketing_templates t ON t.template_key = m.template_key
 WHERE a.automation_key = m.automation_key
   AND a.template_id IS NULL;
