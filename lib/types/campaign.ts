export type CampaignStatus = 'draft' | 'live' | 'paused' | 'ended'

/**
 * Presentation-only ticket reveal styles. These control ONLY how a customer
 * sees their already-decided checkout result — never allocation or win logic.
 * This list is the single source of truth for accepted `reveal_type` values
 * and mirrors the database `campaigns_reveal_type_check` constraint.
 */
export const REVEAL_TYPES = ['normal', 'scratch_card', 'treasure_chest'] as const
export type RevealType = (typeof REVEAL_TYPES)[number]

/**
 * Coerce any value to a known reveal style. Missing, null, or unknown values
 * safely fall back to 'normal' so existing/legacy campaigns behave unchanged.
 */
export function normalizeRevealType(value: unknown): RevealType {
  return value === 'scratch_card' || value === 'treasure_chest' ? value : 'normal'
}

export interface Campaign {
  id: string
  status: CampaignStatus
  title: string
  slug: string
  summary: string
  description: string
  startAt: string
  endAt: string
  mainPrizeTitle: string
  mainPrizeDescription: string
  heroImageUrl: string
  ticketPricePence: number
  wasPricePence?: number | null
  maxTicketsTotal: number | null
  maxTicketsPerUser: number | null
  bundles?: { quantity: number; price_pence: number; label?: string }[] | null
  presentation_type?: 'balloon_pop' | 'instant_cash' | null
  reveal_type?: RevealType | null
  is_free_entry?: boolean
  free_entry_limit_per_user?: number
}
