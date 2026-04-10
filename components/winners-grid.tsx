import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"
import { Sparkles, Ticket } from "lucide-react"

interface WinnersGridProps {
  winners: WinnerSnapshot[]
}

export function WinnersGrid({ winners }: WinnersGridProps) {
  if (winners.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#1a0a2e]/60 p-12 text-center">
        <p className="text-white/60">No winners yet. Be the first!</p>
      </div>
    )
  }

  // Render all winners in a single vertical feed
  // First 3 are "hot" with enhanced styling
  const items: React.ReactNode[] = []

  winners.forEach((winner, i) => {
    const isHot = i < 3
    items.push(
      <WinnerCard key={`winner-${winner.name}-${i}`} winner={winner} isHot={isHot} />
    )

    // Insert momentum CTA after every 8 items
    if ((i + 1) % 8 === 0 && i < winners.length - 1) {
      items.push(
        <div
          key={`cta-${i}`}
          className="relative overflow-hidden rounded-xl border border-yellow-500/30 bg-gradient-to-r from-[#2a0845] via-[#1f0033] to-[#2a0845] p-5 text-center shadow-[0_0_30px_rgba(255,215,0,0.1)]"
        >
          {/* Gold glow accents */}
          <div className="absolute -left-10 -top-10 h-24 w-24 rounded-full bg-yellow-500/10 blur-2xl" />
          <div className="absolute -bottom-10 -right-10 h-24 w-24 rounded-full bg-yellow-500/10 blur-2xl" />
          
          <div className="relative flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-white">
                You could be next
              </p>
              <Sparkles className="h-4 w-4 text-yellow-400" aria-hidden="true" />
            </div>
            <Link
              href="/giveaways"
              className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(250,204,21,0.3)] transition-all duration-200 hover:scale-105 hover:shadow-[0_0_30px_rgba(250,204,21,0.5)] active:scale-95"
            >
              <Ticket className="h-4 w-4" aria-hidden="true" />
              Enter Now
            </Link>
          </div>
        </div>
      )
    }
  })

  return (
    <div className="flex flex-col gap-1.5">
      {items}
    </div>
  )
}
