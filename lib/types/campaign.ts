export type CampaignStatus = 'draft' | 'live' | 'paused' | 'ended'

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
  reveal_type?: 'normal' | 'scratch_card' | null
  is_free_entry?: boolean
  free_entry_limit_per_user?: number
}
