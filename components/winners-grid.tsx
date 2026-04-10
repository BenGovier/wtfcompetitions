import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"
import Image from "next/image"
import { Sparkles, Ticket, Gift } from "lucide-react"

interface LiveGiveaway {
  slug: string
  title: string
  heroImageUrl: string | null
  ticketPricePence: number
  endsAt: string
}

interface WinnersGridProps {
  winners: WinnerSnapshot[]
  liveGiveaway?: LiveGiveaway | null
}

export function WinnersGrid({ winners, liveGiveaway }: WinnersGridProps) {
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
      // If liveGiveaway exists, show embedded giveaway promo card; otherwise generic CTA
      if (liveGiveaway) {
        const priceDisplay = liveGiveaway.ticketPricePence
          ? `From £${(liveGiveaway.ticketPricePence / 100).toFixed(2).replace(/\.00$/, "")}`
          : null
        items.push(
          <Link
            key={`cta-${i}`}
            href={`/giveaways/${liveGiveaway.slug}`}
            className="group relative block overflow-hidden rounded-xl border border-yellow-500/30 bg-gradient-to-br from-[#2a0845] via-[#1f0033] to-[#0f0018] shadow-[0_0_30px_rgba(255,215,0,0.1)] transition-all duration-200 hover:border-yellow-500/50 hover:shadow-[0_0_40px_rgba(255,215,0,0.2)]"
          >
            <div className="flex items-stretch">
              {/* Thumbnail */}
              <div className="relative h-20 w-20 shrink-0 overflow-hidden bg-[#1a0a2e]">
                {liveGiveaway.heroImageUrl ? (
                  <Image
                    src={liveGiveaway.heroImageUrl}
                    alt={liveGiveaway.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="80px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600/30 to-pink-600/30">
                    <Gift className="h-7 w-7 text-yellow-400/60" aria-hidden="true" />
                  </div>
                )}
                {/* Live badge overlay */}
                <div className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 backdrop-blur-sm">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                  </span>
                  <span className="text-[10px] font-bold uppercase text-white">Live</span>
                </div>
              </div>
              
              {/* Content - left side */}
              <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                <p className="truncate text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">
                  {liveGiveaway.title}
                </p>
                {priceDisplay && (
                  <p className="text-xs font-medium text-white/60">{priceDisplay}</p>
                )}
              </div>
              
              {/* CTA button - right-aligned with subtle pulse glow */}
              <div className="flex shrink-0 items-center gap-2 pr-3">
                <span className="relative inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/50 bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-1.5 text-xs font-bold text-black shadow-[0_0_12px_rgba(250,204,21,0.4)] transition-all duration-200 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(250,204,21,0.6)] active:scale-95">
                  <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                  Enter
                  <svg className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        )
      } else {
        // Generic fallback CTA
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
    }
  })

  return (
    <div className="flex flex-col gap-1.5">
      {items}
    </div>
  )
}
