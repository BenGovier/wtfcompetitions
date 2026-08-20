/**
 * Client-safe types for the Host Dashboard (Phase 3).
 *
 * Kept in a standalone module (NO `server-only` import) so both the server data
 * layer (lib/admin/host-dashboard.ts) and the client components can share the
 * exact same payload shape. All monetary values are integer PENCE (GBP) and are
 * only divided by 100 at the display boundary.
 */

/** One of the host's assigned campaigns, scoped + costed for THIS host only. */
export interface HostCampaignSummary {
  campaignId: string
  title: string
  status: string
  /** Convenience flags derived from status server-side. */
  isActive: boolean // live or paused (currently running)
  isEnded: boolean // ended
  /** THIS host's own commission rate, e.g. 7.5 (never another host's). */
  commissionPct: number
  /** External cash collected THIS MONTH (pence). Excludes wallet/site credit. */
  externalPenceMonth: number
  /** externalPenceMonth * commissionPct / 100, rounded to whole pence. */
  earningsPenceMonth: number
  /** Lifetime percentage of tickets sold (0–100), or null when uncapped/unknown. */
  pctSold: number | null
  /** Ticket cap (denominator for progress), or null when uncapped. */
  maxTicketsTotal: number | null
}

/** The complete host dashboard payload returned to the browser. */
export interface HostDashboardPayload {
  /** Friendly first-name/label for the greeting (never another host's data). */
  hostName: string
  month: {
    /** e.g. "This month". */
    label: string
    /** Sum of each assigned campaign's external cash this month (pence). */
    hostedCashPence: number
    /** Sum of this host's estimated earnings across assigned campaigns (pence). */
    estimatedEarningsPence: number
  }
  campaigns: HostCampaignSummary[]
  meta: {
    /** When the underlying reporting aggregates were last refreshed (ISO), or null. */
    lastRefreshAt: string | null
    /** When this payload was generated (ISO). */
    generatedAt: string
  }
}
