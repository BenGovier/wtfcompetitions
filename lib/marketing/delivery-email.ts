import 'server-only'
import {
  renderWtfEmailShell,
  renderWtfEmailText,
  WTF_SITE_URL,
  type WtfEmailContent,
} from './email-shell'

/**
 * WTF Marketing — Stage 029 SAFE EMAIL RENDERER (isolated infrastructure).
 *
 * Consumes the ALREADY-PREPARED Version-1 snapshots frozen by the earlier
 * preparation stage and renders them into safe HTML + plain text suitable for
 * marketing delivery. It performs NO placeholder substitution (that happened
 * during preparation), NO database access, and mints NO unsubscribe token — the
 * caller must pass an already-created `unsubscribeUrl`.
 *
 * Trust posture: FAIL CLOSED. Even though SQL validated these snapshots earlier,
 * this module re-validates every field in TypeScript and rejects anything that
 * looks unprepared, malformed, or unsafe. Presentation is delegated to the
 * reusable branded shell (./email-shell), which HTML-escapes every dynamic value
 * again before interpolation and treats `bodyText` as TEXT (newlines become
 * <br /> only AFTER escaping). There is no dangerouslySetInnerHTML and no
 * raw-HTML template support anywhere in either module.
 *
 * This module is deliberately UNREFERENCED by production runtime after Stage 029
 * (only the provider adapter, the admin preview renderer, and tests import it).
 */

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface MarketingTemplateSnapshotV1 {
  schemaVersion: 1
  templateKey: string
  templateVersion: number
  subject: string
  previewText: string | null
  heading: string
  bodyText: string
  ctaLabel: string
}

export interface MarketingCampaignContextV1 {
  title: string
  url: string
}

export interface MarketingContextSnapshotV1 {
  schemaVersion: 1
  opportunityType: string
  /**
   * Present ONLY for campaign-specific opportunity types. Null for non-campaign
   * types (WTF Credit, new-account welcome, lapsed), whose context is frozen by
   * preparation as `{ schemaVersion, opportunityType }` with no campaign block.
   */
  campaign: MarketingCampaignContextV1 | null
}

export interface RenderMarketingEmailInput {
  templateSnapshot: unknown
  contextSnapshot: unknown
  unsubscribeUrl: unknown
}

export interface RenderedMarketingEmail {
  subject: string
  html: string
  text: string
  templateKey: string
  templateVersion: number
  opportunityType: string
}

/**
 * Thrown for ANY invalid/unsafe render input. Carries a bounded, safe,
 * machine-readable `code` (never customer data). The provider adapter converts
 * any thrown render error into the single non-retryable code
 * `marketing_render_invalid`, so these codes are for diagnostics/tests only.
 */
export class MarketingRenderError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.name = 'MarketingRenderError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// Opportunity-type presentation (data-driven; keyed by opportunity type only)
// ---------------------------------------------------------------------------

/**
 * Per-opportunity-type presentation config. This is BRAND CHROME keyed on the
 * opportunity type (which is data, from the frozen snapshot) — never on any
 * customer string. The conversion copy itself (subject/heading/body/ctaLabel)
 * always comes from the frozen template snapshot; only the eyebrow kicker and
 * the trust strip vary here so each of the six emails reads distinctly.
 */
interface OpportunityPresentation {
  eyebrow: string | null
  trustItems: readonly string[]
}

/**
 * The three CAMPAIGN-SPECIFIC opportunity types (authoritative:
 * marketing_opportunity_definitions.campaign_specific = true in script 009).
 * These carry a frozen `campaign {title,url}` and the CTA points at that URL.
 */
const CAMPAIGN_SPECIFIC_OPPORTUNITY_TYPES: ReadonlySet<string> = new Set([
  'abandoned_checkout',
  'vip_early_access',
  'regular_buyer_campaign_alert',
])

/**
 * The three NON-campaign opportunity types (campaign_specific = false). Their
 * context has no campaign, so the CTA is resolved to a fixed, brand-owned public
 * destination — the live competitions listing.
 */
const NON_CAMPAIGN_CTA_URL: Readonly<Record<string, string>> = {
  wtf_credit_waiting: `${WTF_SITE_URL}/giveaways`,
  new_account_no_purchase: `${WTF_SITE_URL}/giveaways`,
  lapsed_14_days: `${WTF_SITE_URL}/giveaways`,
}

/**
 * The complete set of opportunity types this renderer supports in production:
 * the three campaign-specific plus the three known non-campaign types. There is
 * NO catch-all fallback — any type outside this set FAILS CLOSED
 * (`unsupported_opportunity_type`) rather than rendering to a generic homepage.
 */
const SUPPORTED_OPPORTUNITY_TYPES: ReadonlySet<string> = new Set<string>([
  ...CAMPAIGN_SPECIFIC_OPPORTUNITY_TYPES,
  ...Object.keys(NON_CAMPAIGN_CTA_URL),
])

const OPPORTUNITY_PRESENTATION: Readonly<Record<string, OpportunityPresentation>> = {
  abandoned_checkout: {
    eyebrow: 'STILL LIVE',
    trustItems: ['Secure checkout', 'Instant confirmation', 'Live competitions'],
  },
  vip_early_access: {
    eyebrow: 'VIP EARLY ACCESS',
    trustItems: ['VIP window open', 'Enter before public', 'Live competitions'],
  },
  regular_buyer_campaign_alert: {
    eyebrow: 'NEW COMPETITION',
    trustItems: ['Just went live', 'Secure checkout', 'Instant confirmation'],
  },
  wtf_credit_waiting: {
    eyebrow: 'CREDIT WAITING',
    trustItems: ['Credit ready to use', 'Spend anytime', 'Live competitions'],
  },
  new_account_no_purchase: {
    eyebrow: 'WELCOME',
    trustItems: ['Quick to enter', 'Secure checkout', 'Live competitions'],
  },
  lapsed_14_days: {
    eyebrow: 'NEW THIS WEEK',
    trustItems: ['Fresh competitions', 'Secure checkout', 'Live now'],
  },
}

function isSupportedOpportunityType(opportunityType: string): boolean {
  return SUPPORTED_OPPORTUNITY_TYPES.has(opportunityType)
}

function isCampaignSpecificType(opportunityType: string): boolean {
  return CAMPAIGN_SPECIFIC_OPPORTUNITY_TYPES.has(opportunityType)
}

/**
 * Resolve the fixed CTA for a KNOWN non-campaign type. Never falls back to the
 * homepage: an unmapped type throws (fail closed). In practice
 * validateContextSnapshot has already rejected unsupported types before this is
 * reached, so this is defence in depth.
 */
function resolveNonCampaignCtaUrl(opportunityType: string): string {
  const url = NON_CAMPAIGN_CTA_URL[opportunityType]
  if (!url) {
    throw new MarketingRenderError('unsupported_opportunity_type')
  }
  return url
}

/** Presentation for a supported type; throws for anything else (fail closed). */
function presentationFor(opportunityType: string): OpportunityPresentation {
  const presentation = OPPORTUNITY_PRESENTATION[opportunityType]
  if (!presentation) {
    throw new MarketingRenderError('unsupported_opportunity_type')
  }
  return presentation
}

// ---------------------------------------------------------------------------
// Validation helpers (pure, fail-closed)
// ---------------------------------------------------------------------------

const UNRESOLVED_OPEN = '{{'
const UNRESOLVED_CLOSE = '}}'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reject content that still contains an unresolved placeholder delimiter. */
function assertResolved(value: string, field: string): void {
  if (value.includes(UNRESOLVED_OPEN) || value.includes(UNRESOLVED_CLOSE)) {
    throw new MarketingRenderError(`unresolved_placeholder_${field}`)
  }
}

/** Required non-empty string, trimmed length capped, and fully resolved. */
function requiredResolvedString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') {
    throw new MarketingRenderError(`invalid_${field}`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new MarketingRenderError(`empty_${field}`)
  }
  if (trimmed.length > max) {
    throw new MarketingRenderError(`too_long_${field}`)
  }
  assertResolved(trimmed, field)
  return trimmed
}

/** Optional (null/undefined) or a resolved string within the length cap. */
function optionalResolvedString(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new MarketingRenderError(`invalid_${field}`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > max) {
    throw new MarketingRenderError(`too_long_${field}`)
  }
  assertResolved(trimmed, field)
  return trimmed
}

/** Parse + require an http(s) URL. Rejects javascript:, data:, etc. */
function requiredHttpUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MarketingRenderError(`invalid_${field}`)
  }
  let parsed: URL
  try {
    parsed = new URL(value.trim())
  } catch {
    throw new MarketingRenderError(`invalid_${field}_url`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new MarketingRenderError(`unsafe_${field}_protocol`)
  }
  return parsed.toString()
}

// ---------------------------------------------------------------------------
// Snapshot validation
// ---------------------------------------------------------------------------

function validateTemplateSnapshot(input: unknown): MarketingTemplateSnapshotV1 {
  if (!isPlainObject(input)) {
    throw new MarketingRenderError('template_snapshot_not_object')
  }
  if (input.schemaVersion !== 1) {
    throw new MarketingRenderError('template_schema_version_invalid')
  }
  const version = input.templateVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MarketingRenderError('template_version_invalid')
  }
  const templateKey = requiredResolvedString(input.templateKey, 'template_key', 100)
  const subject = requiredResolvedString(input.subject, 'subject', 300)
  const previewText = optionalResolvedString(input.previewText, 'preview_text', 300)
  const heading = requiredResolvedString(input.heading, 'heading', 300)
  const bodyText = requiredResolvedString(input.bodyText, 'body_text', 5000)
  const ctaLabel = requiredResolvedString(input.ctaLabel, 'cta_label', 100)

  return {
    schemaVersion: 1,
    templateKey,
    templateVersion: version,
    subject,
    previewText,
    heading,
    bodyText,
    ctaLabel,
  }
}

function validateContextSnapshot(input: unknown): MarketingContextSnapshotV1 {
  if (!isPlainObject(input)) {
    throw new MarketingRenderError('context_snapshot_not_object')
  }
  if (input.schemaVersion !== 1) {
    throw new MarketingRenderError('context_schema_version_invalid')
  }
  const opportunityType = requiredResolvedString(input.opportunityType, 'opportunity_type', 100)

  // FAIL CLOSED on any opportunity type outside the six supported production
  // types. There is no homepage fallback: an unknown type is never rendered.
  if (!isSupportedOpportunityType(opportunityType)) {
    throw new MarketingRenderError('unsupported_opportunity_type')
  }

  // Campaign-specific types MUST carry a valid campaign block (fail closed);
  // non-campaign types MUST NOT — their context is frozen with no campaign.
  if (isCampaignSpecificType(opportunityType)) {
    const campaign = input.campaign
    if (!isPlainObject(campaign)) {
      throw new MarketingRenderError('campaign_missing')
    }
    const title = requiredResolvedString(campaign.title, 'campaign_title', 300)
    const url = requiredHttpUrl(campaign.url, 'campaign')
    return {
      schemaVersion: 1,
      opportunityType,
      campaign: { title, url },
    }
  }

  // Non-campaign: reject a stray campaign block so a mismatched snapshot cannot
  // slip a campaign into a non-campaign email (fail closed).
  if (input.campaign !== undefined && input.campaign !== null) {
    throw new MarketingRenderError('unexpected_campaign_for_non_campaign_type')
  }

  return {
    schemaVersion: 1,
    opportunityType,
    campaign: null,
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Map the validated Version-1 snapshots into the reusable branded WTF email
 * shell content contract. Only DYNAMIC, frozen values flow from the snapshots;
 * brand chrome (eyebrow, trust strip, legal links, logo, palette) is supplied
 * by the shell defaults so every marketing email stays visually consistent.
 * The shell re-escapes every field, so raw validated strings are passed here.
 */
function toShellContent(
  template: MarketingTemplateSnapshotV1,
  context: MarketingContextSnapshotV1,
  unsubscribeUrl: string,
): WtfEmailContent {
  const presentation = presentationFor(context.opportunityType)

  // CTA destination is DATA-DRIVEN: campaign-specific emails point at the frozen
  // campaign URL; non-campaign emails point at a fixed brand-owned destination
  // resolved from the opportunity type. Never a hard-coded customer string.
  const ctaUrl = context.campaign
    ? context.campaign.url
    : resolveNonCampaignCtaUrl(context.opportunityType)

  return {
    subject: template.subject,
    preheader: template.previewText,
    eyebrow: presentation.eyebrow,
    heading: template.heading,
    // Campaign card only for campaign-specific emails; null drops the card.
    campaignTitle: context.campaign ? context.campaign.title : null,
    bodyText: template.bodyText,
    cta: { label: template.ctaLabel, url: ctaUrl },
    trustItems: presentation.trustItems,
    // heroImageUrl intentionally omitted: the current snapshot contract carries
    // no campaign artwork, so the shell renders its premium branded fallback
    // hero. No DB field is invented; artwork can be supplied later without any
    // renderer change once the snapshot contract provides it.
    unsubscribeUrl,
  }
}

/**
 * Validate the prepared Version-1 snapshots and render a safe marketing email.
 * Throws {@link MarketingRenderError} on any invalid/unsafe input (fail closed).
 */
export function renderMarketingEmail(input: RenderMarketingEmailInput): RenderedMarketingEmail {
  if (!isPlainObject(input)) {
    throw new MarketingRenderError('render_input_not_object')
  }
  const template = validateTemplateSnapshot(input.templateSnapshot)
  const context = validateContextSnapshot(input.contextSnapshot)
  const unsubscribeUrl = requiredHttpUrl(input.unsubscribeUrl, 'unsubscribe')

  const shellContent = toShellContent(template, context, unsubscribeUrl)

  return {
    subject: template.subject,
    html: renderWtfEmailShell(shellContent),
    text: renderWtfEmailText(shellContent),
    templateKey: template.templateKey,
    templateVersion: template.templateVersion,
    opportunityType: context.opportunityType,
  }
}
