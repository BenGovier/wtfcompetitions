/**
 * Client-safe homepage merchandising primitives.
 *
 * This module contains ONLY pure constants, types, and validators. It has no
 * server-only import and no Supabase dependency, so it can be safely imported
 * by client components (the rail manager) AND by server code (the loader + API
 * route). The server-only data loader lives in `homepage-merchandising.ts`.
 */
import type { GiveawayCategory } from '@/lib/giveaway-classification'

export const HOMEPAGE_RAILS = [
  'featured',
  'balloon_pop',
  'instant_cash',
  'games',
  'cash',
  'luxury',
] as const

export type HomepageRail = (typeof HOMEPAGE_RAILS)[number]

/** Customer-facing labels for each rail (used by admin + public homepage). */
export const RAIL_LABELS: Record<HomepageRail, string> = {
  featured: 'Featured',
  balloon_pop: 'Balloon Pops',
  instant_cash: 'Instant Wins',
  games: 'Games',
  cash: 'Cash',
  luxury: 'Luxury',
}

/**
 * Customer-facing presentation for the PUBLIC homepage. Database rail keys are
 * NEVER renamed — this is display copy only. `navLabel` = short sticky-nav chip,
 * `heading` = section title, `tagline` = one punchy supporting line.
 */
export interface RailPresentation {
  navLabel: string
  heading: string
  tagline: string
}

export const RAIL_PRESENTATION: Record<HomepageRail, RailPresentation> = {
  featured: {
    navLabel: '🔥 Hot',
    heading: '🔥 HOT RIGHT NOW',
    tagline: "The competitions everyone's jumping into.",
  },
  balloon_pop: {
    navLabel: '🎈 Pops',
    heading: '🎈 POP IT. WIN IT.',
    tagline: 'Pick your tickets. Hit a balloon. See what drops.',
  },
  instant_cash: {
    navLabel: '⚡ Instant',
    heading: '⚡ WIN INSTANTLY',
    tagline: 'No waiting. Your ticket could hit right now.',
  },
  games: {
    navLabel: '🎮 Games',
    heading: '🎮 PLAY. REVEAL. WIN.',
    tagline: 'Play the game. Reveal your result. Chase the win.',
  },
  cash: {
    navLabel: '💷 Cash',
    heading: '💷 CASH DROPS',
    tagline: 'Real money. Instant chances. Big hits.',
  },
  luxury: {
    navLabel: '💎 Luxury',
    heading: '💎 THE LUXURY VAULT',
    tagline: 'Big brands. Premium prizes. Serious wins.',
  },
}

/** Manual rails: placement row = membership + order. */
export const MANUAL_RAILS: readonly HomepageRail[] = ['featured', 'games', 'cash', 'luxury']

/** Derived rails: membership from the classifier; placement row = order only. */
export const DERIVED_RAILS: readonly HomepageRail[] = ['balloon_pop', 'instant_cash']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validate a value is one of the six allowed rails. */
export function isValidRail(value: unknown): value is HomepageRail {
  return typeof value === 'string' && (HOMEPAGE_RAILS as readonly string[]).includes(value)
}

/** True when a rail's membership is manual (placement-driven). */
export function isManualRail(rail: HomepageRail): boolean {
  return (MANUAL_RAILS as readonly string[]).includes(rail)
}

/** Validate a value is a canonical UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** A single competition as shown in the admin merchandising UI. */
export interface MerchandisingItem {
  id: string
  title: string
  slug: string | null
  presentation_type: string | null
  ends_at: string | null
  hero_image_url: string | null
  category: GiveawayCategory
  /** True when this item currently has a placement row in the rail it appears in. */
  positioned: boolean
}
