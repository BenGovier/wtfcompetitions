import 'server-only'

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
 * looks unprepared, malformed, or unsafe. All customer/campaign/template strings
 * are HTML-escaped before interpolation; `bodyText` is treated as TEXT (never
 * HTML) and newlines are converted to <br> only AFTER escaping. There is no
 * dangerouslySetInnerHTML and no raw-HTML template support anywhere.
 *
 * This module is deliberately UNREFERENCED by production runtime after Stage 029
 * (only the provider adapter and tests import it).
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
// HTML safety
// ---------------------------------------------------------------------------

/**
 * Escape the five HTML-significant characters. Implemented locally so this
 * infrastructure module stays hermetic (a shared escapeHtml exists in
 * lib/admin/marketing/placeholders.ts but is not imported here on purpose).
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escape THEN convert newlines to <br> (never the other way around). */
function escapeHtmlWithBreaks(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br />')
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

const BG = '#0b0b0f'
const PANEL = '#141419'
const TEXT = '#f5f5f7'
const MUTED = '#9a9aa5'
const ACCENT = '#ff2d87'
const ACCENT_TEXT = '#ffffff'
const BORDER = '#26262f'

function buildHtml(
  template: MarketingTemplateSnapshotV1,
  context: MarketingContextSnapshotV1,
  unsubscribeUrl: string,
): string {
  const subject = escapeHtml(template.subject)
  const heading = escapeHtml(template.heading)
  const body = escapeHtmlWithBreaks(template.bodyText)
  const cta = escapeHtml(template.ctaLabel)
  const campaignTitle = escapeHtml(context.campaign.title)
  const campaignHref = escapeHtml(context.campaign.url)
  const unsubHref = escapeHtml(unsubscribeUrl)
  const preheader = template.previewText ? escapeHtml(template.previewText) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
<span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};padding:24px 0;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:${PANEL};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
<tr>
<td style="padding:28px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<span style="font-size:18px;font-weight:800;letter-spacing:1px;color:${TEXT};">WTF</span>
<span style="font-size:18px;font-weight:800;letter-spacing:1px;color:${ACCENT};">GIVEAWAYS</span>
</td>
</tr>
<tr>
<td style="padding:8px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;">
<h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:800;color:${TEXT};">${heading}</h1>
</td>
</tr>
<tr>
<td style="padding:16px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0;font-size:16px;line-height:1.6;color:${TEXT};">${body}</p>
</td>
</tr>
<tr>
<td style="padding:28px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td style="border-radius:8px;background-color:${ACCENT};">
<a href="${campaignHref}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:${ACCENT_TEXT};text-decoration:none;border-radius:8px;">${cta}</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:24px 32px 28px 32px;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:${MUTED};">This email relates to ${campaignTitle}.</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">You&#39;re receiving this because you opted in to WTF Giveaways marketing. <a href="${unsubHref}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a></p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
}

function buildText(
  template: MarketingTemplateSnapshotV1,
  context: MarketingContextSnapshotV1,
  unsubscribeUrl: string,
): string {
  const lines: string[] = []
  lines.push(template.heading)
  lines.push('')
  lines.push(template.bodyText)
  lines.push('')
  lines.push(`${template.ctaLabel}: ${context.campaign.url}`)
  lines.push('')
  lines.push('---')
  lines.push(`This email relates to ${context.campaign.title}.`)
  lines.push(`Unsubscribe: ${unsubscribeUrl}`)
  return lines.join('\n')
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

  return {
    subject: template.subject,
    html: buildHtml(template, context, unsubscribeUrl),
    text: buildText(template, context, unsubscribeUrl),
    templateKey: template.templateKey,
    templateVersion: template.templateVersion,
    opportunityType: context.opportunityType,
  }
}
