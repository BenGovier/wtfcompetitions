import { SectionHeader } from "@/components/section-header"
import { WinnerSpotlight } from "@/components/winner-spotlight"
import { WinnersPageClient } from "@/components/winners-page-client"
import { mockWinners } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/server"
import { ShieldCheck } from "lucide-react"
import type { WinnerSnapshot } from "@/lib/types"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function WinnersPage() {
  let winners: WinnerSnapshot[] = []

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('winners_feed')
      .select('*')
      .order('happened_at', { ascending: false })
      .limit(200)

    if (!error && data && data.length > 0) {
      winners = data.map((row: any) => ({
        name: row.display_name || 'Winner',
        avatarUrl: undefined,
        prizeTitle: row.prize_title || 'Prize',
        giveawayTitle: row.campaign_title || '',
        giveawaySlug: row.campaign_slug || undefined,
        announcedAt: row.happened_at || new Date().toISOString(),
        quote: undefined,
        kind: (row.kind === 'main' ? 'main' : 'instant') as 'main' | 'instant',
      }))
    }

    if (winners.length === 0) {
      winners = mockWinners
    }
  } catch (err) {
    console.error('[winners] Failed to fetch winners_feed:', err)
    winners = mockWinners
  }

  const featuredWinner = winners.find((w) => w.quote) || winners[0]

  return (
    <div className="container px-4 py-8 md:py-12">
      {/* Hero / Trust Intro - Server Rendered */}
      <div className="mb-8 text-center md:mb-12">
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">Winners</h1>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-muted-foreground md:text-lg">
          Every winner is announced publicly with real names and verified identities. We believe in complete
          transparency and celebrating our community.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>Winners announced publicly within 48 hours </span>
        </div>
      </div>

      {/* Featured Winner Spotlight - Server Rendered */}
      {featuredWinner && (
        <div className="mb-8 md:mb-12">
          <SectionHeader title="Featured Winner" className="mb-4" />
          <WinnerSpotlight winner={featuredWinner} />
        </div>
      )}

      {/* Client Component for Filtering */}
      <WinnersPageClient winners={winners} featuredWinner={featuredWinner} />
    </div>
  )
}
