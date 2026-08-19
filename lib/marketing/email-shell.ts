/**
 * WTF Marketing — Stage 038/040 REUSABLE BRANDED EMAIL SHELL.
 *
 * ONE WTF brand system, SIX distinct email compositions. The shell owns the
 * shared, brand-consistent chrome for every WTF Giveaways marketing email:
 *
 *   - the <head>, hidden preheader, logo header, footer, unsubscribe + legal,
 *   - the palette, typography family, 600px email width, and mobile styles.
 *
 * The BODY composition is selected deterministically in CODE by {@link
 * WtfEmailLayout} (mapped from opportunityType by the delivery renderer) so each
 * automation looks visibly different WITHOUT any layout HTML living in the DB and
 * WITHOUT template copy controlling structure. The six layouts are:
 *
 *   - return_to_comp       (abandoned checkout)  — campaign card recovery
 *   - wallet_credit        (WTF credit waiting)  — dominant credit/wallet panel
 *   - vip_pass             (VIP early access)    — exclusive VIP pass (gold)
 *   - new_drop             (regular buyer alert) — oversized campaign drop
 *   - welcome_onboarding   (new account)         — numbered onboarding steps
 *   - comeback_whatsnew    (lapsed 14 days)      — "what's new" update cards
 *
 * It renders EMAIL-SAFE HTML: nested tables only (no flex/grid for essential
 * structure), inline styles only, no external CSS/webfont dependency, no
 * JavaScript, a hidden preheader, bulletproof CTAs, and Outlook-safe fallbacks
 * for every rounded/coloured element. The mobile <style> block is progressive
 * enhancement only and never required for the base layout to be correct.
 *
 * Trust posture: this module is HERMETIC and PURE. It has no imports beyond
 * types, performs no I/O, and treats EVERY dynamic value as untrusted TEXT — all
 * interpolated content is HTML-escaped here, `bodyText` is escaped BEFORE
 * newlines become <br />, and there is no dangerouslySetInnerHTML and no
 * raw-HTML passthrough. Callers (the delivery renderer) validate the structured
 * snapshots first; the shell escapes again regardless (defence in depth). Layout
 * scaffolding strings (badges, step labels, module titles) are FIXED brand
 * chrome defined here — never customer data and never DB copy.
 */

// ---------------------------------------------------------------------------
// Brand constants
// ---------------------------------------------------------------------------

/** Canonical public site origin (matches metadataBase / Stage 037). */
export const WTF_SITE_URL = 'https://www.wtf-giveaways.co.uk'
/** Real brand logo asset shipped in /public (never a reinvented mark). */
export const WTF_LOGO_URL = `${WTF_SITE_URL}/images/wtf-logo-main.png`

/**
 * WTF marketing email palette: near-black canvas, hot-pink action colour, and a
 * restrained gold accent that already appears naturally in the WTF logo (used
 * only by the VIP pass layout — the brand stays dark/pink dominant everywhere).
 */
export const WTF_EMAIL_PALETTE = {
  bg: '#0b0b0f',
  panel: '#141419',
  hero: '#17171d',
  text: '#f5f5f7',
  muted: '#9a9aa5',
  accent: '#ff2d87',
  accentText: '#ffffff',
  gold: '#e6b422',
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

/**
 * The deterministic body composition for an email. Selected in code from the
 * opportunity type by the delivery renderer; NEVER stored in the DB and NEVER
 * derived from template copy.
 */
export type WtfEmailLayout =
  | 'return_to_comp'
  | 'wallet_credit'
  | 'vip_pass'
  | 'new_drop'
  | 'welcome_onboarding'
  | 'comeback_whatsnew'

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
  /**
   * The body composition to render. Optional; defaults to `return_to_comp`
   * (the original campaign-recovery layout) so existing callers are unchanged.
   */
  layout?: WtfEmailLayout
  /** Small pink kicker/badge above the hook. Defaults to the brand eyebrow. */
  eyebrow?: string | null
  /** The dominant conversion hook (frozen heading snapshot). */
  heading: string
  /**
   * The frozen campaign title. Shown by the campaign layouts (as a card, VIP
   * pass line, or oversized drop feature). Null or omitted for NON-campaign
   * layouts (WTF Credit, welcome, comeback): no campaign module is rendered and
   * the footer uses generic copy.
   */
  campaignTitle?: string | null
  /** Supporting copy. Treated as TEXT; newlines become <br /> AFTER escaping. */
  bodyText: string
  /** One dominant CTA. `url` must already be a validated http(s) URL. */
  cta: WtfEmailCta
  /**
   * OPTIONAL hero artwork (return_to_comp only). When a future snapshot can
   * supply campaign artwork safely, pass an http(s) URL here and the shell
   * renders it as the hero. When null/omitted (current contract), a premium
   * branded text hero is used instead — no DB field is invented to satisfy this.
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
  .wtf-drop{font-size:28px !important;}
  .wtf-cta a{font-size:17px !important;}
}
@media (prefers-color-scheme:light){
  .wtf-body{background-color:${P.bg} !important;}
}
</style>`
}

// --- shared primitives (each returns one or more <tr> rows) ----------------

/**
 * The hero row: a pill badge (eyebrow) above the dominant hook. Optionally
 * renders real hero artwork above the hook (return_to_comp future contract).
 * `badgeColor` lets the VIP layout tint its badge gold.
 */
function heroRow(content: WtfEmailContent, badgeColor: string): string {
  const eyebrow = content.eyebrow === undefined ? WTF_DEFAULT_EYEBROW : content.eyebrow
  const badgeHtml = eyebrow && eyebrow.trim().length > 0
    ? `<div style="margin:0 0 16px 0;"><span style="display:inline-block;padding:7px 14px;border:1px solid ${badgeColor};border-radius:999px;font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${badgeColor};">${escapeHtml(eyebrow)}</span></div>`
    : ''
  const hook = `<h1 class="wtf-hook" style="margin:0;font-family:${FONT};font-size:36px;line-height:1.1;font-weight:800;color:${P.text};letter-spacing:-0.5px;">${escapeHtml(content.heading)}</h1>`

  if (content.heroImageUrl && content.heroImageUrl.trim().length > 0) {
    const src = escapeHtml(content.heroImageUrl.trim())
    return `<tr>
<td style="padding:0;">
<img src="${src}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
</td>
</tr>
<tr>
<td class="wtf-pad" style="padding:28px 40px 0 40px;background-color:${P.panel};">
${badgeHtml}${hook}
</td>
</tr>`
  }

  return `<tr>
<td class="wtf-pad" style="padding:36px 40px 12px 40px;background-color:${P.hero};border-bottom:1px solid ${P.border};">
${badgeHtml}${hook}
</td>
</tr>`
}

function bodyRow(content: WtfEmailContent): string {
  const body = escapeHtmlWithBreaks(content.bodyText)
  return `<tr>
<td class="wtf-pad" style="padding:20px 40px 0 40px;background-color:${P.panel};font-family:${FONT};">
<p style="margin:0;font-size:17px;line-height:1.6;color:${P.text};">${body}</p>
</td>
</tr>`
}

/**
 * The bulletproof, near-full-width CTA. The table cell carries the colour so the
 * button still shows if the anchor background is stripped. `borderColor` adds a
 * premium outline (VIP pass). Rounded corners degrade to square in Outlook.
 */
function ctaRow(content: WtfEmailContent, borderColor?: string): string {
  const label = escapeHtml(content.cta.label)
  const href = escapeHtml(content.cta.url)
  const border = borderColor ? `border:2px solid ${borderColor};` : ''
  return `<tr>
<td class="wtf-pad" style="padding:28px 40px 4px 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wtf-cta">
<tr>
<td align="center" bgcolor="${P.accent}" style="background-color:${P.accent};border-radius:12px;${border}">
<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;padding:18px 28px;font-family:${FONT};font-size:18px;font-weight:800;line-height:1;color:${P.accentText};text-decoration:none;border-radius:12px;letter-spacing:0.2px;">${label}</a>
</td>
</tr>
</table>
</td>
</tr>`
}

/** A small, centred secondary text link (e.g. "See live competitions"). */
function textLinkRow(label: string, url: string): string {
  return `<tr>
<td class="wtf-pad" style="padding:14px 40px 0 40px;background-color:${P.panel};font-family:${FONT};text-align:center;">
<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="font-size:13px;font-weight:700;letter-spacing:0.3px;color:${P.muted};text-decoration:underline;">${escapeHtml(label)}</a>
</td>
</tr>`
}

function trustRow(content: WtfEmailContent): string {
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

// --- layout-specific modules (each returns one <tr> row) -------------------

/** return_to_comp: the classic "THE COMPETITION / {title}" recovery card. */
function campaignCardModule(title: string): string {
  return `<tr>
<td class="wtf-pad" style="padding:24px 40px 0 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.hero};border:1px solid ${P.border};border-radius:14px;">
<tr>
<td style="padding:22px 24px;font-family:${FONT};">
<div style="margin:0 0 8px 0;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${P.muted};">The competition</div>
<div class="wtf-campaign" style="font-size:28px;line-height:1.2;font-weight:800;color:${P.text};letter-spacing:-0.3px;">${escapeHtml(title)}</div>
</td>
</tr>
</table>
</td>
</tr>`
}

/** wallet_credit: a dominant, pink-bordered WTF CREDIT wallet panel (hero). */
function walletCardModule(): string {
  return `<tr>
<td class="wtf-pad" style="padding:24px 40px 0 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.hero};border:2px solid ${P.accent};border-radius:16px;">
<tr>
<td align="center" style="padding:32px 24px;font-family:${FONT};">
<div style="font-size:54px;line-height:1;font-weight:800;color:${P.accent};">&pound;</div>
<div style="margin-top:16px;font-size:26px;line-height:1.1;font-weight:800;letter-spacing:1px;color:${P.text};">WTF CREDIT</div>
<div style="margin-top:10px;font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:${P.muted};">Ready to use</div>
</td>
</tr>
</table>
</td>
</tr>`
}

/** vip_pass: a centred, gold-accented VIP pass with the campaign title inside. */
function vipPassModule(title: string | null): string {
  const titleHtml = title && title.trim().length > 0
    ? `<div style="margin-top:16px;font-size:20px;line-height:1.25;font-weight:800;color:${P.text};">${escapeHtml(title)}</div>`
    : ''
  return `<tr>
<td class="wtf-pad" style="padding:24px 40px 0 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.hero};border:1px solid ${P.gold};border-radius:16px;">
<tr>
<td align="center" style="padding:30px 24px;font-family:${FONT};">
<div style="font-size:13px;font-weight:800;letter-spacing:6px;color:${P.gold};">WTF VIP</div>
<div style="margin-top:10px;font-size:24px;font-weight:800;letter-spacing:2px;color:${P.text};">EARLY ACCESS</div>
<div style="width:60px;height:1px;line-height:1px;font-size:0;background-color:${P.gold};margin:18px auto 0 auto;">&nbsp;</div>
${titleHtml}
</td>
</tr>
</table>
</td>
</tr>`
}

/** new_drop: an oversized "NEW AT WTF / {title}" campaign feature block. */
function newDropModule(title: string): string {
  return `<tr>
<td class="wtf-pad" style="padding:24px 40px 0 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.hero};border:1px solid ${P.border};border-left:4px solid ${P.accent};border-radius:14px;">
<tr>
<td style="padding:28px 26px;font-family:${FONT};">
<div style="font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:${P.accent};">New at WTF</div>
<div class="wtf-drop" style="margin-top:10px;font-size:34px;line-height:1.08;font-weight:800;letter-spacing:-0.6px;color:${P.text};">${escapeHtml(title)}</div>
</td>
</tr>
</table>
</td>
</tr>`
}

/** new_drop: a pink divider + short "LIVE NOW AT WTF GIVEAWAYS" strip. */
function dropDividerRow(text: string): string {
  return `<tr>
<td class="wtf-pad" style="padding:22px 40px 0 40px;background-color:${P.panel};font-family:${FONT};text-align:center;">
<div style="height:2px;line-height:2px;font-size:0;background-color:${P.accent};margin:0 0 12px 0;">&nbsp;</div>
<div style="font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${P.accent};">${escapeHtml(text)}</div>
</td>
</tr>`
}

/** welcome_onboarding: a panel of three email-safe numbered steps. */
function onboardingModule(): string {
  const steps: Array<[string, string]> = [
    ['01', "See what's live"],
    ['02', 'Pick your comp'],
    ['03', 'Enter & follow the action'],
  ]
  const stepHtml = (num: string, label: string, first: boolean): string =>
    `<tr>
<td style="padding:${first ? '0' : '16px'} 0 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"${first ? '' : ` style="border-top:1px solid ${P.border};"`}>
<tr>
<td width="52" valign="top" style="padding:${first ? '0' : '16px'} 12px 0 0;">
<div style="width:40px;height:40px;line-height:40px;text-align:center;border-radius:999px;background-color:${P.accent};color:${P.accentText};font-family:${FONT};font-size:15px;font-weight:800;">${escapeHtml(num)}</div>
</td>
<td valign="middle" style="padding:${first ? '0' : '16px'} 0 0 0;font-family:${FONT};">
<div style="font-size:16px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:${P.text};">${escapeHtml(label)}</div>
</td>
</tr>
</table>
</td>
</tr>`
  const rows = steps.map(([n, l], i) => stepHtml(n, l, i === 0)).join('\n')
  return `<tr>
<td class="wtf-pad" style="padding:24px 40px 0 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.hero};border:1px solid ${P.border};border-radius:14px;">
<tr>
<td style="padding:22px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows}
</table>
</td>
</tr>
</table>
</td>
</tr>`
}

/** comeback_whatsnew: three visually separated "what's new" update cards. */
function comebackModule(): string {
  const cards: Array<[string, string]> = [
    ['Fresh comps', 'New competitions regularly landing.'],
    ['Instant wins', 'Plenty of competitions include instant prizes.'],
    ['Live action', 'Keep an eye on WTF for live draws and updates.'],
  ]
  const cardHtml = (title: string, desc: string, first: boolean): string =>
    `<tr>
<td style="padding:${first ? '0' : '12px'} 0 0 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${P.hero};border:1px solid ${P.border};border-radius:12px;">
<tr>
<td style="padding:18px 20px;font-family:${FONT};">
<div style="font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${P.accent};">${escapeHtml(title)}</div>
<div style="margin-top:6px;font-size:15px;line-height:1.5;color:${P.text};">${escapeHtml(desc)}</div>
</td>
</tr>
</table>
</td>
</tr>`
  const rows = cards.map(([t, d], i) => cardHtml(t, d, i === 0)).join('\n')
  return `<tr>
<td class="wtf-pad" style="padding:24px 40px 0 40px;background-color:${P.panel};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows}
</table>
</td>
</tr>`
}

// --- body composition dispatch ---------------------------------------------

/**
 * Compose the deterministic body for the selected layout. Header, footer and
 * chrome are added by {@link renderWtfEmailShell}. A hidden HTML comment marks
 * the chosen layout for diagnostics/tests (ignored by every email client).
 */
function bodyComposition(content: WtfEmailContent): string {
  const layout: WtfEmailLayout = content.layout ?? 'return_to_comp'
  const title = content.campaignTitle && content.campaignTitle.trim().length > 0
    ? content.campaignTitle.trim()
    : null
  const marker = `<!-- wtf-layout:${layout} -->`

  switch (layout) {
    case 'wallet_credit':
      return [
        marker,
        heroRow(content, P.accent),
        walletCardModule(),
        bodyRow(content),
        ctaRow(content),
        textLinkRow('See live competitions', content.cta.url),
        trustRow(content),
      ].join('\n')

    case 'vip_pass':
      return [
        marker,
        heroRow(content, P.gold),
        vipPassModule(title),
        bodyRow(content),
        ctaRow(content, P.gold),
        trustRow(content),
      ].join('\n')

    case 'new_drop':
      return [
        marker,
        heroRow(content, P.accent),
        title ? newDropModule(title) : '',
        bodyRow(content),
        ctaRow(content),
        dropDividerRow('Live now at WTF Giveaways'),
        trustRow(content),
      ].join('\n')

    case 'welcome_onboarding':
      return [
        marker,
        heroRow(content, P.accent),
        onboardingModule(),
        bodyRow(content),
        ctaRow(content),
        trustRow(content),
      ].join('\n')

    case 'comeback_whatsnew':
      return [
        marker,
        heroRow(content, P.accent),
        comebackModule(),
        bodyRow(content),
        ctaRow(content),
        trustRow(content),
      ].join('\n')

    case 'return_to_comp':
    default:
      return [
        marker,
        heroRow(content, P.accent),
        title ? campaignCardModule(title) : '',
        bodyRow(content),
        ctaRow(content),
        trustRow(content),
      ].join('\n')
  }
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
 * Render the branded WTF marketing email HTML from structured content. The
 * shared chrome (head/logo/footer) is constant; the body composition is chosen
 * deterministically by `content.layout`. Every dynamic value is escaped here
 * regardless of upstream validation.
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
${bodyComposition(content)}
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
