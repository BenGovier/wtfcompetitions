export type EntrySource = 'free' | 'paid'

export type EntryStatus = 'valid' | 'flagged' | 'refunded'

export type Entry = {
  id: string
  campaignId: string
  createdAt: string
  userLabel: string // masked, e.g. "user_***91"
  emailMasked: string // e.g. "b***@g***.com"
  source: EntrySource
  quantity: number // number of tickets purchased or 1 for free
  amountPaidPence: number // 0 for free
  status: EntryStatus
}

export type EntriesCampaignLite = {
  id: string
  title: string
  status: 'draft' | 'live' | 'paused' | 'ended'
}
