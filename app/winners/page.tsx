import { WinnersPageClient } from "@/components/winners-page-client"
import { mockWinners } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/server"
import type { WinnerSnapshot } from "@/lib/types"
import {
  FEATURED_COUNT,
  GRID_PAGE_SIZE,
  WINNERS_CUTOFF,
  WINNERS_KIND,
  formatWinnerFirstName,
  mapWinnerRow,
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
        .select("*")
        .eq("kind", WINNERS_KIND)
        .gte("happened_at", WINNERS_CUTOFF)
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
      // array (do not mutate the imported mock data) with first names only.
      winners = mockWinners.map((w) => ({ ...w, name: formatWinnerFirstName(w.name) }))
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
