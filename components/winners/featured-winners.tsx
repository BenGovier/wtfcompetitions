import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"
import { winnerKey } from "@/lib/winners"

interface FeaturedWinnersProps {
  winners: WinnerSnapshot[]
}

/**
 * Latest wins.
 *
 * Mobile: a CSS-only horizontal scroll-snap rail (no JS carousel, no autoplay,
 * no arrows, no state, no duplicate cards). One card fills the viewport with the
 * next peeking as a swipe cue.
 * Tablet: 2-column grid. Desktop: 4-column grid. The newest win (first) renders
 * strongest.
 */
export function FeaturedWinners({ winners }: FeaturedWinnersProps) {
  if (winners.length === 0) return null

  const columns = winners.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"

  return (
    <section aria-label="Latest wins" className="mb-8">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-white md:text-xl">Latest wins</h2>
        <p className="mt-0.5 text-sm text-white/60">Real people winning real prizes.</p>
      </div>

      <div className="relative -mx-4 md:mx-0">
        <ul
          className={`flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 ${columns}`}
        >
          {winners.map((winner, i) => (
            <li
              key={`${winnerKey(winner)}-featured-${i}`}
              className="w-[calc(100vw-48px)] min-w-[calc(100vw-48px)] max-w-[360px] shrink-0 snap-start md:w-auto md:min-w-0 md:max-w-none"
            >
              <WinnerCard winner={winner} featured />
            </li>
          ))}
        </ul>

        {/* Mobile-only right-edge fade: signals more cards exist to the right.
            Purely decorative and non-interactive; hidden on the desktop grid. */}
        {winners.length > 1 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#12061f] to-transparent md:hidden"
          />
        ) : null}
      </div>
    </section>
  )
}
