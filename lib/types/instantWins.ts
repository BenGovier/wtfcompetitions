export type InstantWinTier = 'small' | 'medium' | 'big'

export type InstantWinsOverviewStats = {
  inventoryRemaining: number
  topTierStatus: 'locked' | 'eligible'
  nextUnlock: string
  mainPrizeDrawAt: string
}

export type InstantWinsCampaignLite = {
  id: string
  title: string
  endAt: string
  status: 'draft' | 'live' | 'paused' | 'ended'
}
