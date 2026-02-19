import { createPublicClient } from "@/lib/supabase/public"
import { Zap, Trophy } from "lucide-react"

interface InstantWinListProps {
  campaignId: string
}

export async function InstantWinList({ campaignId }: InstantWinListProps) {
  const supabase = createPublicClient()

  // Query 1: fetch instant win prizes for this campaign
  const { data: prizes, error: prizesErr } = await supabase
    .from("instant_win_prizes")
    .select("id, prize_title, image_url, campaign_id")
    .eq("campaign_id", campaignId)

  if (prizesErr || !prizes || prizes.length === 0) {
    return null
  }

  // Query 2 (best-effort): fetch which prizes have been won
  let wonPrizeIds = new Set<string>()
  try {
    const { data: awards } = await supabase
      .from("instant_win_awards")
      .select("prize_id")
      .eq("campaign_id", campaignId)

    if (awards) {
      wonPrizeIds = new Set(awards.map((a) => a.prize_id))
    }
  } catch {
    // RLS or table missing -- treat all as available
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="size-5 text-amber-500" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Instant Wins Available</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {prizes.map((prize) => {
          const isWon = wonPrizeIds.has(prize.id)
          return (
            <div
              key={prize.id}
              className="flex items-center gap-4 rounded-lg border bg-card p-4"
            >
              {prize.image_url ? (
                <div className="size-14 shrink-0 overflow-hidden rounded-md border bg-white">
                  <img
                    src={prize.image_url}
                    alt={prize.prize_title}
                    className="size-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-md border bg-muted">
                  <Trophy className="size-6 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{prize.prize_title}</span>
                {isWon ? (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Won!
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                    Available
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
