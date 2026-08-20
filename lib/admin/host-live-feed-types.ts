/**
 * Client-safe types for the Host Live Feed (Phase 4).
 *
 * Standalone module (NO `server-only` import) so the server data layer
 * (lib/admin/host-live-feed.ts), the API route and the client stream component
 * all share one payload shape.
 *
 * PRIVACY: this Host/Admin-only feed carries the winner's name and mobile
 * number (hosts need to call winners during TikTok lives), the prize, the
 * competition and the time — and nothing else private (no checkout/entry/ticket
 * ids, payment data or earnings). Because it includes a mobile number, NOTHING
 * here may ever be exposed to a public or customer-facing surface; it is only
 * served through the secured, host-scoped winner-feed endpoint.
 */

/** One of the authenticated host's assigned campaigns (for the filter menu). */
export interface HostFeedCampaignOption {
  id: string
  title: string
}

/** A single winner event, already resolved + scoped for THIS host. */
export interface HostFeedItem {
  /** Synthetic, stable id — contains NO checkout/entry/customer identifiers. */
  id: string
  /** ISO timestamp the prize was awarded. */
  createdAt: string
  /** Readable winner name (real name if available, else public display name). */
  winnerName: string
  /**
   * Winner's mobile number, or null when none is on file. PRIVATE — for the
   * host to call the winner during a live. Never rendered on public surfaces.
   */
  mobile: string | null
  /** Prize title, e.g. "£250 Cash". */
  prizeTitle: string
  /** Which assigned competition this win belongs to. */
  campaignId: string
  campaignTitle: string
}

/** The complete host live-feed payload returned to the browser. */
export interface HostLiveFeedPayload {
  /** All campaigns assigned to the authenticated host (for the filter menu). */
  campaigns: HostFeedCampaignOption[]
  /** Latest winner events (bounded), newest first. */
  items: HostFeedItem[]
  /** When this payload was generated (ISO). */
  generatedAt: string
}
