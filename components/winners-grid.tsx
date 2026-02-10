import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"

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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {winners.map((winner, i) => (
        <WinnerCard key={`${winner.name}-${i}`} winner={winner} />
      ))}
    </div>
  )
}
