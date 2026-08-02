// Types + pure, framework-free helpers for the admin Dashboard "Growth" tab.
//
// The payload shape mirrors get_admin_growth_dashboard() in
// scripts/reporting/008-growth-dashboard-rpc.sql. Every helper here is pure and
// unit-tested — the server RPC is the source of truth for the numbers, and
// these helpers lock the client-side contract (formatting, view-models, the
// SWR gating key, and the "no identity data" guard).

import type { ReportRange } from './types'

/** A metric with its comparison-period value and signed % change. */
export interface MetricComparison {
  current: number
  previous: number
  /** Signed percentage (e.g. 12.5 = +12.5%), or null when there is no baseline. */
  changePct: number | null
}

export interface GrowthCampaignRow {
  campaignId: string
  title: string
  slug: string | null
  status: string
  soldPercentage: number | null
  ticketsInPeriod: number
  ticketsLast24Hours: number
  externalRevenueLast24HoursPence: number
  uniqueBuyersLast24Hours: number
  lastConfirmedAt: string | null
  averageOrderValuePence: number | null
}

export interface GrowthDashboardPayload {
  period: {
    start: string
    end: string
    comparisonStart: string
    comparisonEnd: string
    timezone: 'Europe/London'
  }
  customers: {
    uniqueBuyers: MetricComparison
    ordersPerBuyer: MetricComparison
    externalRevenuePerBuyerPence: MetricComparison
    averageOrderValuePence: MetricComparison
  }
  checkoutHealth: {
    created: number
    confirmed: number
    failed: number
    abandoned: number
    inProgress: number
    completedAttempts: number
    successRate: number | null
  }
  walletImpact: {
    confirmedOrders: number
    walletOrders: number
    walletUsageRate: number | null
    walletCreditRedeemedPence: number
    externalCashFromWalletOrdersPence: number
    fullyWalletFundedOrders: number
    averageCreditPerWalletOrderPence: number | null
    externalCashPerCreditPound: number | null
  }
  campaignMomentum: GrowthCampaignRow[]
  generatedAt: string
}

export const GROWTH_CAMPAIGN_LIMIT = 20

/** In-progress pending checkouts younger than this are not yet "abandoned". */
export const ABANDONED_AFTER_MS = 30 * 60 * 1000

export type CheckoutClass = 'confirmed' | 'failed' | 'inProgress' | 'abandoned' | 'other'

/**
 * Classify a checkout intent for the health cohort. Mirrors the SQL exactly:
 * pending rows flip from in-progress to abandoned at exactly 30 minutes old
 * (strictly greater-than keeps the boundary row in-progress).
 */
export function classifyCheckout(
  state: string,
  createdAtMs: number,
  nowMs: number,
): CheckoutClass {
  if (state === 'confirmed') return 'confirmed'
  if (state === 'failed') return 'failed'
  if (state === 'pending') {
    return createdAtMs > nowMs - ABANDONED_AFTER_MS ? 'inProgress' : 'abandoned'
  }
  return 'other'
}

/**
 * External cash in pence for a confirmed order, using the proven fallback for
 * the ~6k older rows where external_payment_pence is NULL.
 */
export function externalPenceFallback(
  externalPaymentPence: number | null | undefined,
  totalPence: number,
  walletCreditPence: number | null | undefined,
): number {
  if (typeof externalPaymentPence === 'number') return externalPaymentPence
  return totalPence - (walletCreditPence ?? 0)
}

/** Orders per buyer; 0 when there are no buyers (never divide by zero). */
export function ordersPerBuyer(orders: number, buyers: number): number {
  if (buyers <= 0) return 0
  return orders / buyers
}

/** External revenue (pence) per buyer, rounded to whole pence; 0 when no buyers. */
export function externalPerBuyerPence(externalPence: number, buyers: number): number {
  if (buyers <= 0) return 0
  return Math.round(externalPence / buyers)
}

/** Confirmed ÷ completed attempts (confirmed + failed + abandoned). Null when none. */
export function successRate(confirmed: number, failed: number, abandoned: number): number | null {
  const completed = confirmed + failed + abandoned
  if (completed <= 0) return null
  return confirmed / completed
}

/** Share of confirmed orders that used any WTF Credit. Null when no orders. */
export function walletUsageRate(walletOrders: number, confirmedOrders: number): number | null {
  if (confirmedOrders <= 0) return null
  return walletOrders / confirmedOrders
}

/**
 * External cash generated per £1 of WTF Credit redeemed (a pure ratio, since
 * both inputs are pence). Null when no credit was redeemed.
 */
export function externalCashPerCreditPound(
  externalCashPence: number,
  creditRedeemedPence: number,
): number | null {
  if (creditRedeemedPence <= 0) return null
  return externalCashPence / creditRedeemedPence
}

/** Enforce the 20-row live-campaign cap defensively on the client too. */
export function capCampaigns<T>(rows: T[], max: number = GROWTH_CAMPAIGN_LIMIT): T[] {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, max)
}

export interface MobileCampaignCard {
  campaignId: string
  title: string
  soldLabel: string
  ticketsLast24Hours: number
  externalRevenueLast24HoursPence: number
  uniqueBuyersLast24Hours: number
  lastConfirmedAt: string | null
}

/**
 * The mobile campaign-card view-model prioritises the six fields that matter on
 * a phone, dropping the rest so nothing is rendered at equal prominence.
 */
export function toMobileCampaignCard(row: GrowthCampaignRow): MobileCampaignCard {
  return {
    campaignId: row.campaignId,
    title: row.title,
    soldLabel: row.soldPercentage == null ? '—' : `${row.soldPercentage.toFixed(1)}%`,
    ticketsLast24Hours: row.ticketsLast24Hours,
    externalRevenueLast24HoursPence: row.externalRevenueLast24HoursPence,
    uniqueBuyersLast24Hours: row.uniqueBuyersLast24Hours,
    lastConfirmedAt: row.lastConfirmedAt,
  }
}

/** Human comparison label for a range, e.g. "vs yesterday (same time)". */
export function comparisonLabelForRange(range: ReportRange): string {
  switch (range) {
    case 'today':
      return 'yesterday (same time)'
    case 'yesterday':
      return 'day before'
    case 'last_7_days':
      return 'previous 7 days'
    case 'this_month':
      return 'last month (to date)'
    case 'previous_month':
      return 'month before'
    case 'custom':
    default:
      return 'previous period'
  }
}

/** Format a ratio like orders-per-buyer, e.g. 2.3456 -> "2.35". */
export function formatRatio(n: number | null | undefined, digits = 2): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

/** Format a 0..1 rate as a percentage, e.g. 0.8421 -> "84.2%". Null -> "—". */
export function formatRate(rate: number | null | undefined, digits = 1): string {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return '—'
  return `${(rate * 100).toFixed(digits)}%`
}

/**
 * SWR key for the Growth view. Returns null while the tab is inactive so SWR
 * performs NO request (and no polling) until Growth is actually open. This is
 * the single source of truth for "inactive Growth performs no request".
 */
export function growthSwrKey(active: boolean, ready: boolean, query: string): string | null {
  if (!active || !ready) return null
  return `/api/admin/growth?${query}`
}

const IDENTITY_KEY_RE = /(?:^|_)(user_?id|userid|email|phone|name|first_?name|last_?name|full_?name|address)(?:$|_)/i

/**
 * Deep guard used by tests (and cheap enough for a dev assertion) that the
 * Growth payload carries no customer-identity fields. Only aggregate counts,
 * sums, campaign ids/titles/slugs and timestamps should ever be present.
 */
export function containsIdentityData(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.some(containsIdentityData)
  if (typeof value === 'object') {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (IDENTITY_KEY_RE.test(key)) return true
      if (containsIdentityData(v)) return true
    }
  }
  return false
}
