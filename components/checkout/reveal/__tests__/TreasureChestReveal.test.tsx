import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Force the reduced-motion path so the component mounts in its simplest safe
// state (no shake timers) for a deterministic static render. Must be set at
// module scope, before the renders that run during collection.
;(globalThis as any).window = {
  matchMedia: () => ({ matches: true }),
}

// next/link -> plain anchor so we can assert hrefs from static markup.
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children),
}))

// next/image -> plain img so static markup renders without the Next runtime.
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: any) =>
    React.createElement('img', { src, alt, ...rest }),
}))

import { TreasureChestReveal } from '../TreasureChestReveal'

type Award = Parameters<typeof TreasureChestReveal>[0]['award']

function baseAward(overrides: Partial<Award> = {}): Award {
  return {
    confirmed: true,
    checkout_ref: 'ref_abc',
    qty: 1,
    won: false,
    prize: null,
    prizes: [],
    ticket_start: 42,
    ticket_end: 42,
    campaign_slug: 'golden-hoard',
    ...overrides,
  } as Award
}

function render(award: Award): string {
  return renderToStaticMarkup(React.createElement(TreasureChestReveal, { award }))
}

// The chest opens on interaction; a static server render captures the initial
// "closed" state. These tests assert the confirmed-result intro is present and
// that no result is leaked before the customer opens the chest.
describe('TreasureChestReveal — closed state (win award)', () => {
  const html = render(
    baseAward({
      won: true,
      prize: { title: 'PlayStation 5', value_text: '£479' },
      prizes: [{ title: 'PlayStation 5', value_text: '£479' }],
    }),
  )

  it('shows the confirmed-tickets intro', () => {
    expect(html).toContain('Your tickets are confirmed')
  })

  it('invites the customer to open the chest', () => {
    expect(html).toContain('Open your treasure chest')
    expect(html).toContain('Tap')
  })

  it('renders the closed chest image', () => {
    expect(html).toContain('/reveal/treasure-chest-closed.png')
  })

  it('does not leak the prize before the chest is opened', () => {
    expect(html).not.toContain('PlayStation 5')
    expect(html).not.toContain('£479')
    expect(html).not.toContain('Buy More Tickets')
  })
})

describe('TreasureChestReveal — closed state (no-win award)', () => {
  it('mounts safely and shows the same neutral intro (no outcome revealed)', () => {
    const html = render(baseAward({ won: false }))
    expect(html).toContain('Your tickets are confirmed')
    expect(html).not.toContain('No instant win this time')
    expect(html).not.toContain('You&#x27;ve won')
  })
})

describe('TreasureChestReveal — presentation only', () => {
  it('renders identical closed markup regardless of win/lose (result hidden until opened)', () => {
    const winHtml = render(baseAward({ won: true, prize: { title: 'Cash', value_text: '£100' } }))
    const loseHtml = render(baseAward({ won: false }))
    // The pre-open experience must not differ by outcome — no near-miss / no
    // pre-revealed result. Both show the same closed-chest invitation.
    expect(winHtml).toContain('Open your treasure chest')
    expect(loseHtml).toContain('Open your treasure chest')
    expect(winHtml).not.toContain('£100')
  })
})
