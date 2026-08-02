"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import type { LiveGiveaway } from "@/app/winners/page"
import { WinnersGrid } from "@/components/winners-grid"
import { FeaturedWinners } from "@/components/winners/featured-winners"
import { FEATURED_COUNT, winnerKey } from "@/lib/winners"
import { Loader2, ShieldCheck, Ticket, Trophy } from "lucide-react"

interface WinnersPageClientProps {
  initialWinners: WinnerSnapshot[]
  initialCursor: string | null
  initialHasMore: boolean
  loadError: boolean
  liveGiveaway?: LiveGiveaway | null
}

export function WinnersPageClient({
  initialWinners,
  initialCursor,
  initialHasMore,
  loadError,
  liveGiveaway,
}: WinnersPageClientProps) {
  const router = useRouter()

  const [winners, setWinners] = useState<WinnerSnapshot[]>(initialWinners)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore)
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState(false)

  // Stable de-duplication guard across pages.
  const seenRef = useRef<Set<string>>(new Set(initialWinners.map(winnerKey)))

  // Featured = the newest eligible winners; the grid is everything after them.
  // The server query already enforces eligibility, so no client filtering.
  const featured = winners.slice(0, Math.min(FEATURED_COUNT, winners.length))
  const gridWinners = winners.slice(FEATURED_COUNT)

  async function loadMore() {
    if (loading || !hasMore || !cursor) return
    setLoading(true)
    setPageError(false)
    try {
      const res = await fetch(`/api/winners?cursor=${encodeURIComponent(cursor)}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setPageError(true)
        return
      }
      const incoming: WinnerSnapshot[] = Array.isArray(json.winners) ? json.winners : []
      const fresh = incoming.filter((w) => !seenRef.current.has(winnerKey(w)))
      fresh.forEach((w) => seenRef.current.add(winnerKey(w)))
      setWinners((prev) => [...prev, ...fresh])
      setCursor(typeof json.nextCursor === "string" ? json.nextCursor : null)
      setHasMore(Boolean(json.hasMore) && typeof json.nextCursor === "string")
    } catch {
      setPageError(true)
    } finally {
      setLoading(false)
    }
  }

  const liveHref = liveGiveaway?.slug ? `/giveaways/${liveGiveaway.slug}` : "/giveaways"

  return (
    <>
      {/* 1. Trust hero — static marketing copy. No fetch, no state, no reporting
          logic; the £200,000+ figure is a fixed trust statement. */}
      <section
        aria-labelledby="winners-trust-heading"
        className="relative overflow-hidden rounded-[20px] border border-yellow-500/25 bg-gradient-to-br from-[#2a0845] via-[#20003a] to-[#160029] px-5 py-6 md:flex md:min-h-[250px] md:flex-col md:justify-center md:p-10"
      >
        {/* Subtle gold accent hairline along the top edge. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1">
            <Trophy className="h-3.5 w-3.5 text-yellow-400" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-300">WTF Giveaways</span>
          </div>

          {/* Dominant figure */}
          <p className="text-[44px] font-black leading-[0.95] tracking-tight text-yellow-300 tabular-nums md:text-[68px]">
            £200,000+
          </p>

          {/* Strong secondary headline */}
          <h1
            id="winners-trust-heading"
            className="mt-1.5 text-sm font-bold uppercase tracking-[0.14em] text-white"
          >
            Paid out in cash prizes
          </h1>

          {/* Supporting copy */}
          <p className="mt-2 text-pretty text-sm text-white/70 md:text-base">
            Real winners. Real prizes. New winners every week.
          </p>

          <div className="mt-4">
            <Link
              href={liveHref}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-6 text-sm font-bold text-black transition-colors duration-200 hover:from-yellow-400 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#20003a] md:w-auto motion-reduce:transition-none"
            >
              <Ticket className="h-4 w-4" aria-hidden="true" />
              Enter live giveaways
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Proof strip — static trust statements. No metrics are calculated. */}
      <section aria-label="Why you can trust WTF Giveaways" className="mt-3 md:mt-4">
        <dl className="grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-[#1a0a2e]/70">
          <div className="flex flex-col items-center px-2 py-3 text-center md:py-5">
            <dt className="text-lg font-black tabular-nums text-yellow-300 md:text-2xl">£200,000+</dt>
            <dd className="mt-0.5 text-[11px] text-white/60 md:text-xs">Paid out</dd>
          </div>
          <div className="flex flex-col items-center px-2 py-3 text-center md:py-5">
            <dt className="text-lg font-black text-white md:text-2xl">Real people</dt>
            <dd className="mt-0.5 text-[11px] text-white/60 md:text-xs">Verified winners</dd>
          </div>
          <div className="flex flex-col items-center px-2 py-3 text-center md:py-5">
            <dt className="text-lg font-black text-white md:text-2xl">Every week</dt>
            <dd className="mt-0.5 text-[11px] text-white/60 md:text-xs">New winners</dd>
          </div>
        </dl>
      </section>

      <div className="mt-8">
        {winners.length === 0 ? (
          loadError || pageError ? (
            <ErrorState onRetry={() => router.refresh()} />
          ) : (
            <EmptyState liveHref={liveHref} />
          )
        ) : (
          <>
            {/* 3. Latest wins */}
            <FeaturedWinners winners={featured} />

            {/* 4. More recent winners */}
            {gridWinners.length > 0 && (
              <section aria-label="More recent winners">
                <h2 className="mb-3 text-lg font-bold text-white md:text-xl">More recent winners</h2>

                <WinnersGrid winners={gridWinners} />

                {/* 5. Load more */}
                <div className="mt-6 flex flex-col items-center gap-3">
                  {pageError && (
                    <p className="text-sm text-red-300" role="alert">
                      Unable to load more winners. Please try again.
                    </p>
                  )}
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loading}
                      aria-busy={loading}
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition-colors duration-200 hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0018] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto motion-reduce:transition-none"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          Loading winners…
                        </>
                      ) : pageError ? (
                        "Try again"
                      ) : (
                        "Load more winners"
                      )}
                    </button>
                  ) : (
                    <p className="text-sm text-white/45">You&apos;re all caught up</p>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* 6. How winners are chosen — compact bordered panel, no accordion. */}
      <section className="mt-10 rounded-xl border border-white/10 bg-[#1a0a2e]/80 p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
            <ShieldCheck className="h-5 w-5 text-purple-300" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">How winners are chosen</h2>
            <p className="mt-2 text-sm text-white/60">
              Instant wins are awarded automatically when qualifying tickets are allocated. Main-draw winners are
              selected through the published draw process.
            </p>
            <Link
              href="/faq"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-300 hover:text-purple-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70"
            >
              Learn more in our FAQ
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function EmptyState({ liveHref }: { liveHref: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#1a0a2e]/70 p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/15">
        <Trophy className="h-7 w-7 text-yellow-300" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold text-white">Real winners are being added regularly.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
        Check back soon or browse the latest giveaways.
      </p>
      <Link
        href={liveHref}
        className="mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-6 text-sm font-bold text-black transition-colors duration-200 hover:from-yellow-400 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0a2e] motion-reduce:transition-none"
      >
        <Ticket className="h-4 w-4" aria-hidden="true" />
        Browse giveaways
      </Link>
    </section>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-red-500/20 bg-[#1a0a2e]/70 p-10 text-center" role="alert">
      <h2 className="text-xl font-bold text-white">Winners couldn&apos;t be loaded right now.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/60">Please try again in a moment.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0a2e] motion-reduce:transition-none"
      >
        Try again
      </button>
    </section>
  )
}
