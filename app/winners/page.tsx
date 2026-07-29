import { WinnersPageClient } from "@/components/winners-page-client"
import { mockWinners } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/server"
import type { WinnerSnapshot } from "@/lib/types"
import {
  FEATURED_COUNT,
  GRID_PAGE_SIZE,
  PUBLIC_WINNER_COLUMNS,
  formatWinnerFirstName,
  isWinnerEligible,
  mapWinnerRow,
  winnersEligibilityOrFilter,
} from "@/lib/winners"

export const dynamic = "force-dynamic"
export const revalidate = 0

export interface LiveGiveaway {
  slug: string
  title: string
  heroImageUrl: string | null
  ticketPricePence: number
  endsAt: string
}

export default async function WinnersPage() {
  let winners: WinnerSnapshot[] = []
  let hasMore = false
  let loadError = false
  let usingMock = false
  let liveGiveaway: LiveGiveaway | null = null

  // Initial bounded fetch: featured winners + one grid page (+1 peek row).
  const initialLimit = FEATURED_COUNT + GRID_PAGE_SIZE

  try {
    const supabase = await createClient()

    const [winnersResult, snapshotsResult] = await Promise.all([
      supabase
        .from("winners_feed")
        // Explicit public allow-list: never fetch `winning_ticket` / `user_id`,
        // so they cannot leak via the raw result envelope Next.js serialises.
        .select(PUBLIC_WINNER_COLUMNS)
        // Eligibility (shared, identical to /api/winners): prize_value_pence >= 2000
        // OR campaign_slug is an approved balloon slug. All winner kinds and
        // historical dates are eligible. Applied BEFORE order/limit/peek so
        // featured, grid, hasMore and the cursor all derive from eligible rows.
        // Non-balloon NULL-value rows fail closed and are excluded.
        .or(winnersEligibilityOrFilter())
        .order("happened_at", { ascending: false })
        .limit(initialLimit + 1),
      supabase
        .from("giveaway_snapshots")
        .select("payload")
        .eq("kind", "list")
        .order("generated_at", { ascending: false })
        .limit(10),
    ])

    const { data, error } = winnersResult

    if (error) {
      loadError = true
    } else if (data && data.length > 0) {
      hasMore = data.length > initialLimit
      const rows = hasMore ? data.slice(0, initialLimit) : data
      winners = rows.map(mapWinnerRow)
    }

    if (winners.length === 0 && !loadError) {
      // Never bypass the privacy rule via the mock fallback. Map into a new
      // array (do not mutate the imported mock data) with first names only, and
      // apply the SAME eligibility rule (£20+ OR approved balloon slug) so the
      // fallback can never surface an ineligible winner.
      winners = mockWinners
        .filter(isWinnerEligible)
        .map((w) => ({ ...w, name: formatWinnerFirstName(w.name) }))
      usingMock = true
      hasMore = false
    }

    if (!snapshotsResult.error && snapshotsResult.data) {
      const liveRow = snapshotsResult.data.find((row: any) => row.payload?.status === "live")
      if (liveRow?.payload) {
        const p = liveRow.payload
        liveGiveaway = {
          slug: p.slug || "",
          title: p.title || p.prize_title || "Live Raffle",
          heroImageUrl: p.hero_image_url || null,
          ticketPricePence: p.base_ticket_price_pence || 0,
          endsAt: p.ends_at || "",
        }
      }
    }
  } catch (err) {
    console.error("[winners] Failed to fetch winners_feed:", err)
    loadError = true
  }

  const initialCursor = winners.length > 0 ? winners[winners.length - 1].announcedAt : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-6 pb-24 md:py-10">
        <WinnersPageClient
          initialWinners={winners}
          initialCursor={usingMock ? null : initialCursor}
          initialHasMore={hasMore}
          loadError={loadError}
          liveGiveaway={liveGiveaway}
        />
      </div>
    </div>
  )
}
