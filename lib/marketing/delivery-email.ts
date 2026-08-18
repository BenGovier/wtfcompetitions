import 'server-only'
import {
  renderWtfEmailShell,
  renderWtfEmailText,
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
  campaign: MarketingCampaignContextV1
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
  return {
    subject: template.subject,
    preheader: template.previewText,
    heading: template.heading,
    campaignTitle: context.campaign.title,
    bodyText: template.bodyText,
    cta: { label: template.ctaLabel, url: context.campaign.url },
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
