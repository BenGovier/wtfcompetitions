import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// delivery-email begins with `import 'server-only'`; neutralise under node.
vi.mock('server-only', () => ({}))

import {
  renderWtfEmailShell,
  renderWtfEmailText,
  escapeHtml,
  escapeHtmlWithBreaks,
  WTF_SITE_URL,
  WTF_LOGO_URL,
  WTF_DEFAULT_TRUST_ITEMS,
  type WtfEmailContent,
} from '../email-shell'
import { renderMarketingEmail } from '../delivery-email'
import {
  ABANDONED_CHECKOUT_PREVIEW,
  MARKETING_PREVIEW_SAMPLES,
} from '../preview-samples'

const REPO_ROOT = process.cwd()

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function baseContent(overrides: Partial<WtfEmailContent> = {}): WtfEmailContent {
  return {
    subject: 'You left this one behind',
    preheader: 'Your entry is still live.',
    heading: 'You left this one behind',
    campaignTitle: '£30,000 Tax-Free Cash',
    bodyText: 'Line one.\nLine two.',
    cta: { label: 'Finish my entry', url: `${WTF_SITE_URL}/giveaways/x` },
    unsubscribeUrl: `${WTF_SITE_URL}/api/marketing/unsubscribe?token=preview`,
    ...overrides,
  }
}

// ===========================================================================
// SHELL — escaping + safety
// ===========================================================================
describe('Stage 038 — email shell escaping & safety', () => {
  it('escapeHtml escapes all five significant characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })

  it('escapeHtmlWithBreaks escapes BEFORE converting newlines to <br />', () => {
    expect(escapeHtmlWithBreaks('a<b>\nc')).toBe('a&lt;b&gt;<br />c')
  })

  it('escapes a scripted heading (no live tag survives)', () => {
    const html = renderWtfEmailShell(baseContent({ heading: '<script>alert(1)</script>' }))
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes a scripted campaign title', () => {
    const html = renderWtfEmailShell(baseContent({ campaignTitle: '<img src=x onerror=alert(1)>' }))
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  it('escapes an HTML CTA label', () => {
    const html = renderWtfEmailShell(baseContent({ cta: { label: '<i>go</i>', url: `${WTF_SITE_URL}/g` } }))
    expect(html).not.toContain('<i>go</i>')
    expect(html).toContain('&lt;i&gt;go&lt;/i&gt;')
  })

  it('escapes double quotes in a CTA url so no attribute can be broken out of', () => {
    const html = renderWtfEmailShell(
      baseContent({ cta: { label: 'Go', url: `${WTF_SITE_URL}/g?a="x` } }),
    )
    expect(html).toContain('&quot;x')
    expect(html).not.toContain('a="x"')
  })

  it('body newlines become safe <br /> (never raw)', () => {
    const html = renderWtfEmailShell(baseContent({ bodyText: 'one\ntwo' }))
    expect(html).toContain('one<br />two')
  })

  it('renders a valid email document without JavaScript or dangerous handlers', () => {
    const html = renderWtfEmailShell(baseContent())
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/\son\w+=/i) // no inline event handlers (onclick, onerror, ...)
    expect(html).not.toContain('javascript:')
  })
})

// ===========================================================================
// SHELL — structure / brand / CTA / unsubscribe
// ===========================================================================
describe('Stage 038 — email shell structure', () => {
  it('is table-based and email-safe (no flex/grid on essential layout)', () => {
    const html = renderWtfEmailShell(baseContent())
    expect(html).toContain('role="presentation"')
    expect(html).not.toContain('display:flex')
    expect(html).not.toContain('display:grid')
  })

  it('includes the real WTF logo asset (not a reinvented mark)', () => {
    const html = renderWtfEmailShell(baseContent())
    expect(html).toContain(WTF_LOGO_URL)
    expect(html).toContain('alt="WTF Giveaways"')
    expect(WTF_LOGO_URL).toContain('/images/wtf-logo-main.png')
  })

  it('uses the WTF hot-pink accent on a near-black canvas', () => {
    const html = renderWtfEmailShell(baseContent())
    expect(html.toLowerCase()).toContain('#ff2d87')
    expect(html.toLowerCase()).toContain('#0b0b0f')
  })

  it('renders the CTA as a link to the provided (escaped) campaign url', () => {
    const html = renderWtfEmailShell(baseContent({ cta: { label: 'Finish my entry', url: `${WTF_SITE_URL}/giveaways/abc` } }))
    expect(html).toContain(`href="${WTF_SITE_URL}/giveaways/abc"`)
    expect(html).toContain('Finish my entry')
  })

  it('always includes an unsubscribe link pointing at the supplied url', () => {
    const unsub = `${WTF_SITE_URL}/api/marketing/unsubscribe?token=abc`
    const html = renderWtfEmailShell(baseContent({ unsubscribeUrl: unsub }))
    expect(html).toContain(`href="${unsub}"`)
    expect(html.toLowerCase()).toContain('unsubscribe')
  })

  it('renders the hidden preheader when provided', () => {
    const html = renderWtfEmailShell(baseContent({ preheader: 'Peekaboo preheader' }))
    expect(html).toContain('Peekaboo preheader')
    expect(html).toContain('mso-hide:all')
  })

  it('renders the default trust strip items', () => {
    const html = renderWtfEmailShell(baseContent())
    for (const item of WTF_DEFAULT_TRUST_ITEMS) {
      expect(html).toContain(item)
    }
  })

  it('supports optional hero artwork when a url is supplied (future contract)', () => {
    const img = `${WTF_SITE_URL}/images/campaign-hero.png`
    const html = renderWtfEmailShell(baseContent({ heroImageUrl: img }))
    expect(html).toContain(`src="${img}"`)
  })

  it('uses the branded fallback hero (no hero <img>) when no artwork is supplied', () => {
    const html = renderWtfEmailShell(baseContent({ heroImageUrl: null }))
    // The only <img> present is the logo, never a hero image.
    const imgCount = (html.match(/<img /g) ?? []).length
    expect(imgCount).toBe(1)
  })
})

// ===========================================================================
// SHELL — plain text alternative
// ===========================================================================
describe('Stage 038 — email shell plain text', () => {
  it('includes the CTA/campaign url and the unsubscribe url', () => {
    const content = baseContent()
    const text = renderWtfEmailText(content)
    expect(text).toContain(content.cta.url)
    expect(text).toContain(content.unsubscribeUrl)
  })

  it('contains the heading, campaign title and body copy', () => {
    const content = baseContent()
    const text = renderWtfEmailText(content)
    expect(text).toContain(content.heading)
    expect(text).toContain(content.campaignTitle)
    expect(text).toContain('Line one.')
  })
})

// ===========================================================================
// PREVIEW — same renderer, representative & safe data
// ===========================================================================
describe('Stage 038 — abandoned checkout preview sample', () => {
  it('renders through the SAME production renderMarketingEmail without throwing', () => {
    const out = renderMarketingEmail(ABANDONED_CHECKOUT_PREVIEW.input)
    expect(out.html).toContain('<!DOCTYPE html>')
    expect(out.opportunityType).toBe('abandoned_checkout')
    expect(out.templateKey).toBe('abandoned_checkout_v1')
  })

  it('preview HTML contains the branded shell, campaign, CTA and unsubscribe', () => {
    const out = renderMarketingEmail(ABANDONED_CHECKOUT_PREVIEW.input)
    expect(out.html).toContain('£30,000 Tax-Free Cash')
    expect(out.html).toContain('Finish my entry')
    expect(out.html.toLowerCase()).toContain('unsubscribe')
    expect(out.html).toContain(WTF_LOGO_URL)
  })

  it('sample carries NO customer identity (no email address / personal token)', () => {
    const serialised = JSON.stringify(ABANDONED_CHECKOUT_PREVIEW.input)
    expect(serialised).not.toMatch(/@/) // no email address anywhere
    expect(serialised.toLowerCase()).not.toContain('customer')
    expect(serialised.toLowerCase()).not.toContain('recipient')
    // Representative unsubscribe token only.
    expect(serialised).toContain('preview-sample')
  })

  it('sample content is fully resolved (no leftover {{placeholders}})', () => {
    // Assert on the actual copy fields, not JSON.stringify output (whose nested
    // object boundaries legitimately contain "}}"). A mustache placeholder is an
    // opening "{{" — the renderer fails closed on any such delimiter.
    const { templateSnapshot, contextSnapshot } = ABANDONED_CHECKOUT_PREVIEW.input
    const copy = [
      templateSnapshot.subject,
      templateSnapshot.previewText ?? '',
      templateSnapshot.heading,
      templateSnapshot.bodyText,
      templateSnapshot.ctaLabel,
      contextSnapshot.campaign.title,
      contextSnapshot.campaign.url,
    ].join('\n')
    expect(copy).not.toContain('{{')
    expect(copy).not.toContain('}}')
  })

  it('exposes exactly the abandoned-checkout sample for now', () => {
    expect(MARKETING_PREVIEW_SAMPLES).toHaveLength(1)
    expect(MARKETING_PREVIEW_SAMPLES[0].key).toBe('abandoned_checkout')
  })
})

// ===========================================================================
// PREVIEW — admin-only, render-only (static source guards)
// ===========================================================================
describe('Stage 038 — preview route is admin-only and never sends', () => {
  const previewPage = readFileSync(
    join(REPO_ROOT, 'app/admin/marketing/preview/page.tsx'),
    'utf8',
  )
  const previewClient = readFileSync(
    join(REPO_ROOT, 'components/admin/marketing/EmailPreviewClient.tsx'),
    'utf8',
  )

  it('enforces admin authorization before rendering', () => {
    expect(previewPage).toContain('requireAdmin')
    expect(previewPage).toMatch(/requireAdmin\(\s*\{\s*roles:\s*\[\s*'admin'\s*\]/)
  })

  it('uses the real delivery renderer (not a bespoke mockup)', () => {
    expect(previewPage).toContain("from '@/lib/marketing/delivery-email'")
    expect(previewPage).toContain('renderMarketingEmail(')
  })

  it('never imports the sending provider or a send function', () => {
    expect(previewPage).not.toContain('resend-provider')
    expect(previewPage).not.toContain('sendMarketingEmailViaResend')
    expect(previewClient).not.toContain('resend-provider')
    expect(previewClient).not.toContain('sendMarketingEmailViaResend')
  })

  it('does no database work in the preview page', () => {
    expect(previewPage).not.toMatch(/supabase/i)
    expect(previewPage).not.toContain('.rpc(')
    expect(previewPage).not.toContain('getServiceSupabase')
  })

  it('renders the email HTML in a fully sandboxed iframe', () => {
    expect(previewClient).toContain('srcDoc={html}')
    expect(previewClient).toContain('sandbox=""')
  })

  it('offers both desktop and mobile viewports', () => {
    expect(previewClient).toContain('desktop')
    expect(previewClient).toContain('mobile')
  })
})
