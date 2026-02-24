/**
 * /winners page palette notes:
 * - Primary: existing --primary from Tailwind theme
 * - Accent 1 (amber/gold): "Instant Win" pill -- bg-amber-500/10 text-amber-600
 * - Accent 2 (emerald): "Verified" / trust badges -- text-emerald-600
 * - Neutrals: current muted-foreground / background tokens
 */

import { WinnersHeroBanner } from "@/components/winner-spotlight"
import { WinnersPageClient } from "@/components/winners-page-client"
import { mockWinners } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/server"
import type { WinnerSnapshot } from "@/lib/types"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function WinnersPage() {
  let winners: WinnerSnapshot[] = []

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("winners_feed")
      .select("*")
      .order("happened_at", { ascending: false })
      .limit(200)

    if (!error && data && data.length > 0) {
      winners = data.map((row: any) => ({
        name: row.display_name || "Winner",
        prizeTitle: row.prize_title || "Prize",
        giveawayTitle: row.campaign_title || "",
        giveawaySlug: row.campaign_slug || undefined,
        announcedAt: row.happened_at || new Date().toISOString(),
        kind: (row.kind === "main" ? "main" : "instant") as "main" | "instant",
      }))
    }

    if (winners.length === 0) {
      winners = mockWinners
    }
  } catch (err) {
    console.error("[winners] Failed to fetch winners_feed:", err)
    winners = mockWinners
  }

  return (
    <div className="container px-4 py-8 md:py-12">
      {/* Hero banner -- no user data */}
      <div className="mb-8 md:mb-12">
        <WinnersHeroBanner />
      </div>

      {/* Client component handles filtering + grid */}
      <WinnersPageClient winners={winners} />
    </div>
  )
}
