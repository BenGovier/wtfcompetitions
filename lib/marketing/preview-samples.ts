/**
 * WTF Marketing — Stage 038 ADMIN PREVIEW SAMPLE PAYLOADS.
 *
 * REPRESENTATIVE, fully-resolved snapshot payloads used ONLY to power the
 * admin-only email preview. They contain NO customer identity, NO recipient
 * email, NO real per-recipient token and NO database data — just brand-safe
 * placeholder campaign copy so an operator can SEE the exact production email
 * design without sending anything or exposing anyone.
 *
 * The shapes here deliberately match the delivery renderer's Version-1 snapshot
 * contract so the preview feeds the SAME `renderMarketingEmail` used by live
 * delivery. Values are already resolved (no `{{placeholders}}`) because the
 * renderer fails closed on any unresolved delimiter.
 */

import { WTF_SITE_URL } from './email-shell'
import type { RenderMarketingEmailInput } from './delivery-email'

export interface MarketingPreviewSample {
  /** Stable id for the preview selector / tests. */
  key: string
  /** Human label shown in the admin UI. */
  label: string
  /** Opportunity type this sample represents. */
  opportunityType: string
  /** Exactly the input shape accepted by `renderMarketingEmail`. */
  input: RenderMarketingEmailInput
}

/**
 * ABANDONED CHECKOUT — the first fully-designed WTF marketing email.
 *
 * Representative campaign only ("£30,000 Tax-Free Cash"), a representative
 * (non-personal) unsubscribe URL, and no recipient details of any kind.
 */
export const ABANDONED_CHECKOUT_PREVIEW: MarketingPreviewSample = {
  key: 'abandoned_checkout',
  label: 'Abandoned checkout',
  opportunityType: 'abandoned_checkout',
  input: {
    templateSnapshot: {
      schemaVersion: 1,
      templateKey: 'abandoned_checkout_v1',
      templateVersion: 1,
      subject: 'You left this one behind',
      previewText: "Your entry isn't finished — and it's still live.",
      heading: 'You left this one behind 👀',
      bodyText:
        'You were checking this one out but didn\u2019t finish your entry.\nIt\u2019s still live \u2014 jump back in and take another look before it\u2019s gone.',
      ctaLabel: 'Finish my entry',
    },
    contextSnapshot: {
      schemaVersion: 1,
      opportunityType: 'abandoned_checkout',
      campaign: {
        title: '£30,000 Tax-Free Cash',
        url: `${WTF_SITE_URL}/giveaways/30k-tax-free-cash`,
      },
    },
    // Representative, NON-personal unsubscribe URL. The live pipeline mints a
    // per-recipient tokenised URL elsewhere; this preview never touches it.
    unsubscribeUrl: `${WTF_SITE_URL}/api/marketing/unsubscribe?token=preview-sample`,
  },
}

/** All samples available in the admin preview (only abandoned checkout today). */
export const MARKETING_PREVIEW_SAMPLES: readonly MarketingPreviewSample[] = [
  ABANDONED_CHECKOUT_PREVIEW,
]
