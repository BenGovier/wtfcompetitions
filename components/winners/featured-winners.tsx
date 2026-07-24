import type { WinnerSnapshot } from "@/lib/types"
import { WinnerCard } from "@/components/winner-card"
import { winnerKey } from "@/lib/winners"

interface FeaturedWinnersProps {
  winners: WinnerSnapshot[]
}

/**
 * Latest wins. On mobile this is a native horizontally-scrollable row (no JS
 * carousel, no autoplay); on larger screens it becomes a responsive grid.
 * The newest win (first) is rendered strongest.
 */
export function FeaturedWinners({ winners }: FeaturedWinnersProps) {
  if (winners.length === 0) return null

  const columns = winners.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"

  return (
    <section aria-label="Latest winners" className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-white md:text-xl">Latest wins</h2>
        <span className="text-xs text-white/45 md:hidden" aria-hidden="true">
          Swipe to see more
        </span>
      </div>

      <div className="relative -mx-4 md:mx-0">
        <ul
          className={`flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 ${columns}`}
        >
          {winners.map((winner, i) => (
            <li
              key={`${winnerKey(winner)}-featured-${i}`}
              className="w-[78%] shrink-0 snap-start min-[520px]:w-[42%] md:w-auto"
            >
              <WinnerCard winner={winner} featured={i === 0} />
            </li>
          ))}
        </ul>

        {/* Mobile-only right-edge fade: signals more cards exist to the right and
            stops the final visible card looking accidentally clipped. Purely
            decorative and non-interactive; hidden on the desktop grid. */}
        {winners.length > 1 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#12061f] to-transparent md:hidden"
          />
        ) : null}
      </div>
    </section>
  )
}
