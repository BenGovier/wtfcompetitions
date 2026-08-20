/**
 * Client-safe types for the Host Live Feed (Phase 4).
 *
 * Standalone module (NO `server-only` import) so the server data layer
 * (lib/admin/host-live-feed.ts), the API route and the client stream component
 * all share one payload shape.
 *
 * PRIVACY: the feed intentionally carries NO mobile number or other private
 * profile data — only a readable winner name, the prize, the competition and
 * the time. Nothing here may ever be exposed to a public surface.
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
