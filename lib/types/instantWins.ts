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

export type InstantWinPrize = {
  id: string
  campaignId: string
  name: string
  tier: InstantWinTier
  valueLabel: string
  totalQty: number
  remainingQty: number
  weight: number
  isActive: boolean
}

export type ReleaseRuleType = 'tickets_sold_percent' | 'time'

export type ReleaseRule = {
  id: string
  campaignId: string
  type: ReleaseRuleType
  thresholdLabel: string
  eligibleTiers: InstantWinTier[]
}

/** DB-aligned row from instant_win_prizes table */
export type InstantWinPrizeRow = {
  id: string
  campaign_id: string
  prize_title: string
  prize_value_text: string | null
  unlock_ratio: number
  image_url: string | null
  created_at: string
}

export type InstantWinAttemptLog = {
  id: string
  campaignId: string
  createdAt: string
  userLabel: string
  eligibleSetHashShort: string
  outcome: 'won' | 'lost'
  prizeName?: string
  tier?: InstantWinTier
}
