import { describe, it, expect } from 'vitest'
import {
  ABANDONED_AFTER_MS,
  GROWTH_CAMPAIGN_LIMIT,
  capCampaigns,
  classifyCheckout,
  comparisonLabelForRange,
  containsIdentityData,
  externalCashPerCreditPound,
  externalPenceFallback,
  externalPerBuyerPence,
  formatRate,
  formatRatio,
  growthSwrKey,
  ordersPerBuyer,
  successRate,
  toMobileCampaignCard,
  walletUsageRate,
  type GrowthCampaignRow,
  type GrowthDashboardPayload,
} from '../growth'

describe('classifyCheckout', () => {
  const now = 1_000_000_000_000

  it('maps confirmed and failed directly', () => {
    expect(classifyCheckout('confirmed', now, now)).toBe('confirmed')
    expect(classifyCheckout('failed', now, now)).toBe('failed')
  })

  it('treats fresh pending as in-progress and old pending as abandoned', () => {
    expect(classifyCheckout('pending', now - 60_000, now)).toBe('inProgress')
    expect(classifyCheckout('pending', now - (ABANDONED_AFTER_MS + 1), now)).toBe('abandoned')
  })

  it('flips to abandoned at exactly 30 minutes old (matches SQL created_at <= now - 30m)', () => {
    // createdAt exactly now - 30m is NOT strictly within the last 30m, so abandoned.
    expect(classifyCheckout('pending', now - ABANDONED_AFTER_MS, now)).toBe('abandoned')
    // One ms younger is still in-progress.
    expect(classifyCheckout('pending', now - ABANDONED_AFTER_MS + 1, now)).toBe('inProgress')
  })

  it('classifies unknown states as other', () => {
    expect(classifyCheckout('refunded', now, now)).toBe('other')
  })
})

describe('externalPenceFallback', () => {
  it('uses the explicit external payment when present', () => {
    expect(externalPenceFallback(500, 900, 400)).toBe(500)
    expect(externalPenceFallback(0, 900, 900)).toBe(0) // zero is a real value, not missing
  })

  it('falls back to total minus wallet credit when null/undefined', () => {
    expect(externalPenceFallback(null, 900, 400)).toBe(500)
    expect(externalPenceFallback(undefined, 900, null)).toBe(900)
    expect(externalPenceFallback(undefined, 900, undefined)).toBe(900)
  })
})

describe('per-buyer + ratio helpers never divide by zero', () => {
  it('ordersPerBuyer', () => {
    expect(ordersPerBuyer(10, 4)).toBe(2.5)
    expect(ordersPerBuyer(10, 0)).toBe(0)
  })

  it('externalPerBuyerPence rounds to whole pence', () => {
    expect(externalPerBuyerPence(1000, 3)).toBe(333)
    expect(externalPerBuyerPence(1000, 0)).toBe(0)
  })

  it('successRate over completed attempts', () => {
    expect(successRate(80, 15, 5)).toBeCloseTo(0.8, 10)
    expect(successRate(0, 0, 0)).toBeNull()
  })

  it('walletUsageRate', () => {
    expect(walletUsageRate(3, 12)).toBe(0.25)
    expect(walletUsageRate(3, 0)).toBeNull()
  })

  it('externalCashPerCreditPound', () => {
    expect(externalCashPerCreditPound(5000, 2500)).toBe(2)
    expect(externalCashPerCreditPound(5000, 0)).toBeNull()
  })
})

describe('capCampaigns', () => {
  it('enforces the 20-row cap and tolerates non-arrays', () => {
    const rows = Array.from({ length: 30 }, (_, i) => i)
    expect(capCampaigns(rows)).toHaveLength(GROWTH_CAMPAIGN_LIMIT)
    expect(capCampaigns(rows, 5)).toEqual([0, 1, 2, 3, 4])
    // @ts-expect-error deliberately passing a non-array
    expect(capCampaigns(null)).toEqual([])
  })
})

describe('toMobileCampaignCard', () => {
  const row: GrowthCampaignRow = {
    campaignId: 'c1',
    title: 'Every Ticket Wins',
    slug: 'every-ticket-wins',
    status: 'live',
    soldPercentage: 42.345,
    ticketsInPeriod: 100,
    ticketsLast24Hours: 20,
    externalRevenueLast24HoursPence: 5000,
    uniqueBuyersLast24Hours: 8,
    lastConfirmedAt: '2026-08-02T10:00:00Z',
    averageOrderValuePence: 812,
  }

  it('projects the six phone-priority fields and formats sold %', () => {
    const card = toMobileCampaignCard(row)
    expect(card).toEqual({
      campaignId: 'c1',
      title: 'Every Ticket Wins',
      soldLabel: '42.3%',
      ticketsLast24Hours: 20,
      externalRevenueLast24HoursPence: 5000,
      uniqueBuyersLast24Hours: 8,
      lastConfirmedAt: '2026-08-02T10:00:00Z',
    })
  })

  it('renders an em dash when sold % is unknown', () => {
    expect(toMobileCampaignCard({ ...row, soldPercentage: null }).soldLabel).toBe('—')
  })
})

describe('formatting helpers', () => {
  it('formatRatio', () => {
    expect(formatRatio(2.3456)).toBe('2.35')
    expect(formatRatio(null)).toBe('—')
    expect(formatRatio(Number.NaN)).toBe('—')
  })

  it('formatRate', () => {
    expect(formatRate(0.8421)).toBe('84.2%')
    expect(formatRate(null)).toBe('—')
  })

  it('comparisonLabelForRange covers every range', () => {
    expect(comparisonLabelForRange('today')).toBe('yesterday (same time)')
    expect(comparisonLabelForRange('yesterday')).toBe('day before')
    expect(comparisonLabelForRange('last_7_days')).toBe('previous 7 days')
    expect(comparisonLabelForRange('this_month')).toBe('last month (to date)')
    expect(comparisonLabelForRange('previous_month')).toBe('month before')
    expect(comparisonLabelForRange('custom')).toBe('previous period')
  })
})

describe('growthSwrKey (lazy gating)', () => {
  it('returns null until the tab is active AND ready — no request, no polling', () => {
    expect(growthSwrKey(false, true, 'range=today')).toBeNull()
    expect(growthSwrKey(true, false, 'range=today')).toBeNull()
    expect(growthSwrKey(false, false, 'range=today')).toBeNull()
  })

  it('returns the endpoint URL only when active and ready', () => {
    expect(growthSwrKey(true, true, 'range=today&campaign=c1')).toBe(
      '/api/admin/growth?range=today&campaign=c1',
    )
  })
})

describe('containsIdentityData (no customer identity leaks)', () => {
  const payload: GrowthDashboardPayload = {
    period: {
      start: '2026-08-02T00:00:00Z',
      end: '2026-08-02T23:59:59Z',
      comparisonStart: '2026-08-01T00:00:00Z',
      comparisonEnd: '2026-08-01T23:59:59Z',
      timezone: 'Europe/London',
    },
    customers: {
      uniqueBuyers: { current: 50, previous: 45, changePct: 11.1 },
      ordersPerBuyer: { current: 1.5, previous: 1.4, changePct: 7.1 },
      externalRevenuePerBuyerPence: { current: 1200, previous: 1100, changePct: 9.1 },
      averageOrderValuePence: { current: 800, previous: 790, changePct: 1.3 },
    },
    checkoutHealth: {
      created: 120,
      confirmed: 76,
      failed: 30,
      abandoned: 10,
      inProgress: 4,
      completedAttempts: 116,
      successRate: 0.655,
    },
    walletImpact: {
      confirmedOrders: 76,
      walletOrders: 12,
      walletUsageRate: 0.157,
      walletCreditRedeemedPence: 4393,
      externalCashFromWalletOrdersPence: 2000,
      fullyWalletFundedOrders: 3,
      averageCreditPerWalletOrderPence: 366,
      externalCashPerCreditPound: 0.45,
    },
    campaignMomentum: [
      {
        campaignId: 'c1',
        title: 'Every Ticket Wins',
        slug: 'every-ticket-wins',
        status: 'live',
        soldPercentage: 42.3,
        ticketsInPeriod: 245,
        ticketsLast24Hours: 40,
        externalRevenueLast24HoursPence: 50232,
        uniqueBuyersLast24Hours: 18,
        lastConfirmedAt: '2026-08-02T20:23:24Z',
        averageOrderValuePence: 840,
      },
    ],
    generatedAt: '2026-08-02T20:23:24Z',
  }

  it('passes for a representative aggregate-only payload', () => {
    expect(containsIdentityData(payload)).toBe(false)
  })

  it('detects an accidental identity field anywhere in the tree', () => {
    expect(containsIdentityData({ ...payload, user_id: 'u_123' })).toBe(true)
    expect(
      containsIdentityData({
        ...payload,
        campaignMomentum: [{ ...payload.campaignMomentum[0], email: 'a@b.com' }],
      }),
    ).toBe(true)
  })
})
