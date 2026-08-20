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

/** Icon identity per rail — maps to a bespoke inline SVG in `components/home/rail-icons`. */
export type RailIconKey = 'hot' | 'balloon' | 'instant' | 'games' | 'cash' | 'luxury'

/**
 * Customer-facing presentation for the PUBLIC homepage. Database rail keys are
 * NEVER renamed — this is display copy + presentation only.
 *
 * NO emoji: each rail has a purpose-designed SVG icon (`icon`) and a restrained
 * casino accent expressed as FULL Tailwind class strings (so Tailwind v4's
 * source scan detects them — never build these by concatenation):
 *   - `navActiveClass` — illuminated ACTIVE nav chip (dark glass + accent glow)
 *   - `accentText`      — heading icon + thin divider tint
 *   - `sectionGlow`     — very faint radial atmosphere behind the section header
 * `viewAllHref` points ONLY at real catalogue routes (`/giveaways` +
 * its supported `?category=` filters); never an invented category URL.
 */
export interface RailPresentation {
  navLabel: string
  heading: string
  tagline: string
  icon: RailIconKey
  navActiveClass: string
  accentText: string
  sectionGlow: string
  viewAllHref: string
}

export const RAIL_PRESENTATION: Record<HomepageRail, RailPresentation> = {
  featured: {
    navLabel: 'HOT',
    heading: 'MEGA JACKPOT DROPS',
    tagline: 'Big prizes. Big momentum. Get in now.',
    icon: 'hot',
    navActiveClass: 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/50 shadow-[0_0_16px_rgba(251,191,36,0.35)]',
    accentText: 'text-amber-300',
    sectionGlow: 'bg-[radial-gradient(120%_80%_at_0%_0%,rgba(251,191,36,0.12),transparent_60%)]',
    viewAllHref: '/giveaways',
  },
  balloon_pop: {
    navLabel: 'TIKTOK POPS',
    heading: 'TIKTOK POPS',
    tagline: 'Pick your numbers. Pop for the prize.',
    icon: 'balloon',
    navActiveClass: 'bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-400/50 shadow-[0_0_16px_rgba(217,70,239,0.35)]',
    accentText: 'text-fuchsia-300',
    sectionGlow: 'bg-[radial-gradient(120%_80%_at_0%_0%,rgba(217,70,239,0.12),transparent_60%)]',
    viewAllHref: '/giveaways?category=live',
  },
  instant_cash: {
    navLabel: 'LUXURY PRIZES',
    heading: 'LUXURY PRIZES',
    tagline: 'Premium wins. Big brands. Serious prizes.',
    icon: 'luxury',
    navActiveClass: 'bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-300/50 shadow-[0_0_16px_rgba(34,211,238,0.35)]',
    accentText: 'text-cyan-300',
    sectionGlow: 'bg-[radial-gradient(120%_80%_at_0%_0%,rgba(34,211,238,0.12),transparent_60%)]',
    viewAllHref: '/giveaways?category=instant',
  },
  games: {
    navLabel: 'GAMES',
    heading: 'THE GAMES FLOOR',
    tagline: "Play. Reveal. See what you've hit.",
    icon: 'games',
    navActiveClass: 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/50 shadow-[0_0_16px_rgba(139,92,246,0.35)]',
    accentText: 'text-violet-300',
    sectionGlow: 'bg-[radial-gradient(120%_80%_at_0%_0%,rgba(139,92,246,0.12),transparent_60%)]',
    viewAllHref: '/giveaways',
  },
  cash: {
    navLabel: 'CASH',
    heading: 'CASH VAULT',
    tagline: 'Cash prizes ready to drop.',
    icon: 'cash',
    navActiveClass: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.35)]',
    accentText: 'text-emerald-300',
    sectionGlow: 'bg-[radial-gradient(120%_80%_at_0%_0%,rgba(16,185,129,0.12),transparent_60%)]',
    viewAllHref: '/giveaways',
  },
  luxury: {
    navLabel: 'LUXURY',
    heading: 'LUXE JACKPOTS',
    tagline: 'Designer. Premium. Seriously worth winning.',
    icon: 'luxury',
    navActiveClass: 'bg-yellow-200/15 text-yellow-100 ring-1 ring-yellow-200/50 shadow-[0_0_16px_rgba(253,224,71,0.30)]',
    accentText: 'text-yellow-100',
    sectionGlow: 'bg-[radial-gradient(120%_80%_at_0%_0%,rgba(253,224,71,0.10),transparent_60%)]',
    viewAllHref: '/giveaways',
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
