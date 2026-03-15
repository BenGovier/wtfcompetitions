import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"
import { Trophy, Zap } from "lucide-react"

interface WinnersGridProps {
  winners: WinnerSnapshot[]
}

export function WinnersGrid({ winners }: WinnersGridProps) {
  if (winners.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">No winners found matching your search.</p>
      </div>
    )
  }

  // Separate main winners and instant wins
  const mainWinners = winners.filter((w) => w.kind === "main")
  const instantWinners = winners.filter((w) => w.kind === "instant")

  return (
    <div className="space-y-10">
      {/* Main Winners Section */}
      {mainWinners.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-foreground">
              Main Prize Winners
              <span className="ml-2 text-sm font-normal text-muted-foreground">({mainWinners.length})</span>
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {mainWinners.map((winner, i) => (
              <WinnerCard key={`main-${winner.name}-${i}`} winner={winner} variant="main" />
            ))}
          </div>
        </section>
      )}

      {/* Instant Wins Section */}
      {instantWinners.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-500" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-foreground">
              Instant Wins
              <span className="ml-2 text-sm font-normal text-muted-foreground">({instantWinners.length})</span>
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {instantWinners.map((winner, i) => (
              <WinnerCard key={`instant-${winner.name}-${i}`} winner={winner} variant="instant" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
