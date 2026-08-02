import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"
import { winnerKey } from "@/lib/winners"

interface WinnersGridProps {
  winners: WinnerSnapshot[]
}

/**
 * Recent winners feed.
 * - below md: single-column vertical feed (never two columns), so every row
 *   stays readable down to 320px wide
 * - md: 2 columns
 * - lg: 3 columns
 */
export function WinnersGrid({ winners }: WinnersGridProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3 lg:grid-cols-3 lg:gap-4">
      {winners.map((winner, i) => (
        <WinnerCard key={`${winnerKey(winner)}-${i}`} winner={winner} />
      ))}
    </div>
  )
}
