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
  maxTicketsTotal: number | null
  maxTicketsPerUser: number | null
}
