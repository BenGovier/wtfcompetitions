import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"
import { Sparkles } from "lucide-react"

interface WinnersGridProps {
  winners: WinnerSnapshot[]
}

export function WinnersGrid({ winners }: WinnersGridProps) {
  if (winners.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">No winners found.</p>
      </div>
    )
  }

  // Render all winners in a single vertical feed with momentum CTAs every 8 items
  const items: React.ReactNode[] = []

  winners.forEach((winner, i) => {
    items.push(
      <WinnerCard key={`winner-${winner.name}-${i}`} winner={winner} />
    )

    // Insert momentum CTA after every 8 items
    if ((i + 1) % 8 === 0 && i < winners.length - 1) {
      items.push(
        <div
          key={`cta-${i}`}
          className="flex flex-col items-center gap-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 p-4 text-center"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" aria-hidden="true" />
            <p className="text-sm font-medium text-white">
              Thousands of prizes already won — you could be next
            </p>
            <Sparkles className="h-4 w-4 text-yellow-400" aria-hidden="true" />
          </div>
          <Link
            href="/giveaways"
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
          >
            Enter Now
          </Link>
        </div>
      )
    }
  })

  return (
    <div className="flex flex-col gap-2">
      {items}
    </div>
  )
}
