/**
 * WTF Marketing — Stage 038 REUSABLE BRANDED EMAIL SHELL.
 *
 * The single, brand-consistent visual system for every WTF Giveaways marketing
 * email (abandoned checkout now; WTF Credit, VIP early access, lapsed customer,
 * winner follow-up, campaign alerts later). It renders EMAIL-SAFE HTML:
 *
 *   - table-based layout (no flex/grid for essential structure),
 *   - inline styles only, no external CSS/webfont dependency, no JavaScript,
 *   - a hidden preheader, a bulletproof near-full-width CTA, and an Outlook-safe
 *     fallback for every rounded/coloured element,
 *   - a progressive-enhancement <style> block for mobile that is never required
 *     for the base layout to be correct.
 *
 * Trust posture: this module is HERMETIC and PURE. It has no imports, performs
 * no I/O, and treats EVERY dynamic value as untrusted TEXT — all interpolated
 * content is HTML-escaped here, `bodyText` is escaped BEFORE newlines become
 * <br />, and there is no dangerouslySetInnerHTML and no raw-HTML passthrough.
 * Callers (the delivery renderer) validate the structured snapshots first; the
 * shell escapes again regardless (defence in depth).
 */

// ---------------------------------------------------------------------------
// Brand constants
// ---------------------------------------------------------------------------

/** Canonical public site origin (matches metadataBase / Stage 037). */
export const WTF_SITE_URL = 'https://www.wtf-giveaways.co.uk'
/** Real brand logo asset shipped in /public (never a reinvented mark). */
export const WTF_LOGO_URL = `${WTF_SITE_URL}/images/wtf-logo-main.png`

/** WTF marketing email palette: near-black canvas, hot-pink action colour. */
export const WTF_EMAIL_PALETTE = {
  bg: '#0b0b0f',
  panel: '#141419',
  hero: '#17171d',
  text: '#f5f5f7',
  muted: '#9a9aa5',
  accent: '#ff2d87',
  accentText: '#ffffff',
  border: '#26262f',
} as const

/** Brand-default chrome, overridable per email type via {@link WtfEmailContent}. */
export const WTF_DEFAULT_EYEBROW = 'STILL LIVE'
export const WTF_DEFAULT_TRUST_ITEMS: readonly string[] = [
  'Secure checkout',
  'Instant confirmation',
  'Live competitions',
]
export const WTF_DEFAULT_LEGAL_LINKS: readonly WtfEmailLink[] = [
  { label: 'Terms', url: `${WTF_SITE_URL}/terms` },
  { label: 'Privacy', url: `${WTF_SITE_URL}/privacy` },
  { label: 'Contact', url: `${WTF_SITE_URL}/contact` },
]

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface WtfEmailLink {
  label: string
  url: string
}

export interface WtfEmailCta {
  label: string
  url: string
}

export interface WtfEmailContent {
  /** Document <title> + accessibility; typically the frozen subject. */
  subject: string
  /** Hidden inbox preview line. Null/empty hides it entirely. */
  preheader: string | null
  /** Small pink kicker above the hook. Defaults to the brand eyebrow. */
  eyebrow?: string | null
  /** The dominant conversion hook (frozen heading snapshot). */
  heading: string
  /**
   * The frozen campaign title, shown as the dominant campaign card. Null or
   * omitted for NON-campaign emails (e.g. WTF Credit, new-account welcome,
   * lapsed): the campaign card is dropped and the footer uses generic copy.
   */
  campaignTitle?: string | null
  /** Supporting copy. Treated as TEXT; newlines become <br /> AFTER escaping. */
  bodyText: string
  /** One dominant CTA. `url` must already be a validated http(s) URL. */
  cta: WtfEmailCta
  /**
   * OPTIONAL hero artwork. When a future snapshot can supply campaign artwork
   * safely, pass an http(s) URL here and the shell renders it as the hero.
   * When null/omitted (current contract), a premium branded fallback hero is
   * used instead — no DB field is invented to satisfy this.
   */
  heroImageUrl?: string | null
  /** Compact trust strip. Defaults to the brand trust items. */
  trustItems?: readonly string[]
  /** Footer legal links. Defaults to the brand legal links. */
  legalLinks?: readonly WtfEmailLink[]
  /** Required, already-validated http(s) unsubscribe URL. */
  unsubscribeUrl: string
}

// ---------------------------------------------------------------------------
// HTML safety (hermetic; single source of truth for the marketing renderer)
// ---------------------------------------------------------------------------

/** Escape the five HTML-significant characters. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escape THEN convert newlines to <br /> (never the other way around). */
export function escapeHtmlWithBreaks(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br />')
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const P = WTF_EMAIL_PALETTE
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif"

/** The mobile-only progressive-enhancement stylesheet. */
function styleBlock(): string {
  return `<style>
@media only screen and (max-width:620px){
  .wtf-container{width:100% !important;}
  .wtf-pad{padding-left:20px !important;padding-right:20px !important;}
  .wtf-hook{font-size:30px !important;line-height:1.15 !important;}
  .wtf-campaign{font-size:24px !important;}
  .wtf-cta a{font-size:17px !important;}
}
@media (prefers-color-scheme:light){
  .wtf-body{background-color:${P.bg} !important;}
}
</style>`
}

function heroBlock(content: WtfEmailContent): string {
  const eyebrow = content.eyebrow === undefined ? WTF_DEFAULT_EYEBROW : content.eyebrow
  const eyebrowHtml = eyebrow && eyebrow.trim().length > 0
    ? `<div style="margin:0 0 14px 0;font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${P.accent};">${escapeHtml(eyebrow)}</div>`
    : ''
  const hook = `<h1 class="wtf-hook" style="margin:0;font-family:${FONT};font-size:36px;line-height:1.1;font-weight:800;color:${P.text};letter-spacing:-0.5px;">${escapeHtml(content.heading)}</h1>`

  // Optional real artwork (future). Falls back to the branded text hero today.
  if (content.heroImageUrl && content.heroImageUrl.trim().length > 0) {
    const src = escapeHtml(content.heroImageUrl.trim())
    return `<tr>
<td style="padding:0;">
<img src="${src}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
</td>
</tr>
<tr>
<td class="wtf-pad" style="padding:28px 40px 0 40px;background-color:${P.panel};">
${eyebrowHtml}${hook}
</td>
</tr>`
  }

  return `<tr>
<td class="wtf-pad" style="padding:36px 40px 8px 40px;background-color:${P.hero};border-bottom:1px solid ${P.border};">
${eyebrowHtml}${hook}
</td>
</tr>`
}

function campaignCardBlock(content: WtfEmailContent): string {
  // Non-campaign emails carry no campaign title: omit the card entirely.
  if (!content.campaignTitle || content.campaignTitle.trim().length === 0) return ''
  const title = escapeHtml(content.campaignTitle)
  return `<tr>
<td class="wtf-pad" style="padding:24px 40px 0 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.hero};border:1px solid ${P.border};border-radius:14px;">
<tr>
<td style="padding:22px 24px;font-family:${FONT};">
<div style="margin:0 0 8px 0;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${P.muted};">The competition</div>
<div class="wtf-campaign" style="font-size:28px;line-height:1.2;font-weight:800;color:${P.text};letter-spacing:-0.3px;">${title}</div>
</td>
</tr>
</table>
</td>
</tr>`
}

function ctaBlock(content: WtfEmailContent): string {
  const label = escapeHtml(content.cta.label)
  const href = escapeHtml(content.cta.url)
  // Near-full-width bulletproof button: table cell carries the colour so the
  // button still shows if the anchor background is stripped; anchor is a large
  // block target for touch. Rounded corners degrade to square in Outlook.
  return `<tr>
<td class="wtf-pad" style="padding:28px 40px 4px 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wtf-cta">
<tr>
<td align="center" bgcolor="${P.accent}" style="background-color:${P.accent};border-radius:12px;">
<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;padding:18px 28px;font-family:${FONT};font-size:18px;font-weight:800;line-height:1;color:${P.accentText};text-decoration:none;border-radius:12px;letter-spacing:0.2px;">${label}</a>
</td>
</tr>
</table>
</td>
</tr>`
}

function bodyBlock(content: WtfEmailContent): string {
  const body = escapeHtmlWithBreaks(content.bodyText)
  return `<tr>
<td class="wtf-pad" style="padding:20px 40px 0 40px;background-color:${P.panel};font-family:${FONT};">
<p style="margin:0;font-size:17px;line-height:1.6;color:${P.text};">${body}</p>
</td>
</tr>`
}

function trustBlock(content: WtfEmailContent): string {
  const items = content.trustItems ?? WTF_DEFAULT_TRUST_ITEMS
  if (items.length === 0) return ''
  const inner = items
    .map((item) => escapeHtml(item))
    .join(`<span style="color:${P.accent};padding:0 8px;">&bull;</span>`)
  return `<tr>
<td class="wtf-pad" style="padding:24px 40px 0 40px;background-color:${P.panel};font-family:${FONT};">
<div style="padding-top:18px;border-top:1px solid ${P.border};font-size:12px;font-weight:600;letter-spacing:0.3px;color:${P.muted};text-align:center;">${inner}</div>
</td>
</tr>`
}

function footerBlock(content: WtfEmailContent): string {
  const unsubHref = escapeHtml(content.unsubscribeUrl)
  const legalLinks = content.legalLinks ?? WTF_DEFAULT_LEGAL_LINKS
  const legalHtml = legalLinks.length > 0
    ? `<p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:${P.muted};">${legalLinks
        .map((l) => `<a href="${escapeHtml(l.url)}" style="color:${P.muted};text-decoration:underline;">${escapeHtml(l.label)}</a>`)
        .join(`<span style="padding:0 8px;">&bull;</span>`)}</p>`
    : ''
  // Campaign emails name the competition; non-campaign emails use generic copy.
  const relatesHtml =
    content.campaignTitle && content.campaignTitle.trim().length > 0
      ? `<p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:${P.muted};">This email relates to ${escapeHtml(content.campaignTitle)}.</p>`
      : ''
  return `<tr>
<td class="wtf-pad" style="padding:28px 40px 34px 40px;background-color:${P.bg};border-top:1px solid ${P.border};font-family:${FONT};">
<div style="margin:0 0 12px 0;font-size:15px;font-weight:800;letter-spacing:0.5px;color:${P.text};">WTF<span style="color:${P.accent};">GIVEAWAYS</span></div>
${relatesHtml}
<p style="margin:0 0 10px 0;font-size:12px;line-height:1.6;color:${P.muted};">You&#39;re receiving this because you opted in to WTF Giveaways marketing emails. You can stop them at any time &mdash; <a href="${unsubHref}" style="color:${P.text};text-decoration:underline;">unsubscribe here</a>.</p>
${legalHtml}
<p style="margin:0;font-size:12px;line-height:1.6;color:${P.muted};">&copy; WTF Giveaways. All rights reserved.</p>
</td>
</tr>`
}

/**
 * Render the branded WTF marketing email HTML from structured content. Every
 * dynamic value is escaped here regardless of upstream validation.
 */
export function renderWtfEmailShell(content: WtfEmailContent): string {
  const subject = escapeHtml(content.subject)
  const preheader = content.preheader && content.preheader.trim().length > 0
    ? escapeHtml(content.preheader.trim())
    : ''
  const logo = escapeHtml(WTF_LOGO_URL)

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark light" />
<meta name="x-apple-disable-message-reformatting" />
<title>${subject}</title>
${styleBlock()}
</head>
<body class="wtf-body" style="margin:0;padding:0;background-color:${P.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;line-height:0;overflow:hidden;mso-hide:all;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.bg};">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" class="wtf-container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:${P.panel};border:1px solid ${P.border};border-radius:18px;overflow:hidden;">
<tr>
<td align="center" style="padding:26px 40px 22px 40px;background-color:${P.bg};border-bottom:1px solid ${P.border};">
<img src="${logo}" alt="WTF Giveaways" width="150" style="display:block;width:150px;max-width:60%;height:auto;border:0;" />
</td>
</tr>
${heroBlock(content)}
${campaignCardBlock(content)}
${bodyBlock(content)}
${ctaBlock(content)}
${trustBlock(content)}
${footerBlock(content)}
</table>
</td>
</tr>
</table>
</body>
</html>`
}

/**
 * Render the plain-text alternative. Mirrors the HTML content and ALWAYS
 * includes the CTA/campaign URL and the unsubscribe URL.
 */
export function renderWtfEmailText(content: WtfEmailContent): string {
  const lines: string[] = []
  const hasCampaign = !!(content.campaignTitle && content.campaignTitle.trim().length > 0)
  const campaignTitle = hasCampaign ? content.campaignTitle!.trim() : ''
  const eyebrow = content.eyebrow === undefined ? WTF_DEFAULT_EYEBROW : content.eyebrow
  if (eyebrow && eyebrow.trim().length > 0) lines.push(eyebrow.trim().toUpperCase())
  lines.push(content.heading)
  lines.push('')
  if (hasCampaign) {
    lines.push(campaignTitle)
    lines.push('')
  }
  lines.push(content.bodyText)
  lines.push('')
  lines.push(`${content.cta.label}: ${content.cta.url}`)
  lines.push('')
  const items = content.trustItems ?? WTF_DEFAULT_TRUST_ITEMS
  if (items.length > 0) lines.push(items.join(' | '))
  lines.push('')
  lines.push('---')
  if (hasCampaign) lines.push(`This email relates to ${campaignTitle}.`)
  lines.push('You are receiving this because you opted in to WTF Giveaways marketing emails.')
  lines.push(`Unsubscribe: ${content.unsubscribeUrl}`)
  return lines.join('\n')
}
