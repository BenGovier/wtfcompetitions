import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"
import { winnerKey } from "@/lib/winners"

interface WinnersGridProps {
  winners: WinnerSnapshot[]
}

/**
 * Responsive winners grid.
 * - very narrow: 1 column
 * - mobile / tablet: 2 columns
 * - desktop: 3 columns
 */
export function WinnersGrid({ winners }: WinnersGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-3">
      {winners.map((winner, i) => (
        <WinnerCard key={`${winnerKey(winner)}-${i}`} winner={winner} />
      ))}
    </div>
  )
}
