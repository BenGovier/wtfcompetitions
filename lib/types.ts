// Mock types for UI scaffolding
export interface GiveawayPublic {
  slug: string
  title: string
  prizeTitle: string
  imageUrl: string
  ticketPrice: number
  endsAt: Date
  /** Canonical campaign statuses from DB. UI should not use "active"/"completed". */
  status: "draft" | "live" | "paused" | "ended"
  prizeValue?: string
  images?: string[]
  bundles?: { qty: number; price: number; label?: string }[]
  socialProof?: {
    entrantCountBucket: string
    recentAvatars: string[]
  }
  rulesText: string
  faqSnippet?: string
}

export interface WinnerSnapshot {
  name: string
  avatarUrl: string
  prizeTitle: string
  giveawayTitle: string
  announcedAt: string
  giveawaySlug?: string
  quote?: string
  kind?: 'main' | 'instant'
}

export interface Profile {
  name: string
  email: string
  avatarUrl?: string
  bio?: string
  publicVisible: boolean
}
