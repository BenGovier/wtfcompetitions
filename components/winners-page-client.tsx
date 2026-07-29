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
  // The server query already enforces the £20 threshold, so no client filtering.
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
      {/* A. Static trust banner — approved marketing copy. No fetch, no state,
          no reporting logic; the £200,000+ figure is a fixed string. Height is
          intentionally restrained so the featured winners peek on the first
          mobile screen. */}
      <section
        aria-labelledby="winners-trust-heading"
        className="relative mb-6 overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-[#2a0845] via-[#1f0033] to-[#0f0018] px-5 py-4 md:mb-8 md:p-8"
      >
        {/* Subtle gold accent hairline along the top edge. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-yellow-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1">
            <Trophy className="h-3.5 w-3.5 text-yellow-400" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-300">WTF Giveaways</span>
          </div>

          {/* Dominant figure */}
          <p className="text-5xl font-extrabold leading-none tracking-tight text-yellow-300 tabular-nums [text-shadow:0_2px_18px_rgba(250,204,21,0.25)] md:text-6xl">
            £200,000+
          </p>

          {/* Strong secondary headline */}
          <h1
            id="winners-trust-heading"
            className="mt-2 text-sm font-bold uppercase tracking-[0.12em] text-white md:text-base"
          >
            Paid out in cash prizes
          </h1>

          {/* Supporting copy + single compact proof statement */}
          <p className="mt-1.5 text-pretty text-sm text-white/70">
            Real winners. Real cash. New winners every week.
            <span className="text-white/45"> · Cash prizes and balloon wins added regularly</span>
          </p>

          <div className="mt-3">
            <Link
              href={liveHref}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-black transition-colors duration-200 hover:from-yellow-400 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1f0033] motion-reduce:transition-none"
            >
              <Ticket className="h-4 w-4" aria-hidden="true" />
              Enter live raffles
            </Link>
          </div>
        </div>
      </section>

      {winners.length === 0 ? (
        loadError || pageError ? (
          <ErrorState onRetry={() => router.refresh()} />
        ) : (
          <EmptyState liveHref={liveHref} />
        )
      ) : (
        <>
          {/* B. Latest wins */}
          <FeaturedWinners winners={featured} />

          {/* D. All winners grid */}
          {gridWinners.length > 0 && (
            <section aria-label="More recent winners">
              <h2 className="mb-3 text-lg font-bold text-white md:text-xl">More recent winners</h2>

              {/* One strong stream of meaningful £20+ winners — no filters. */}
              <WinnersGrid winners={gridWinners} />

              {/* Pagination */}
              <div className="mt-6 flex flex-col items-center gap-3">
                {pageError && (
                  <p className="text-sm text-red-300" role="alert">
                    Winners couldn&apos;t be loaded right now.
                  </p>
                )}
                {hasMore ? (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    aria-busy={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0018] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        Loading
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

      {/* Transparency */}
      <section className="mt-10 rounded-xl border border-white/10 bg-[#1a0a2e]/80 p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
            <ShieldCheck className="h-5 w-5 text-purple-300" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">How winners are chosen</h2>
            <p className="mt-2 text-sm text-white/60">
              All winners are selected through a fair, verifiable process. Instant wins are awarded automatically at
              checkout, and prize winners are announced publicly once each draw closes.
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
      <h2 className="text-xl font-bold text-white">Winners are coming</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
        New wins will appear here as prizes are claimed.
      </p>
      <Link
        href={liveHref}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-black transition-colors duration-200 hover:from-yellow-400 hover:to-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0a2e] motion-reduce:transition-none"
      >
        <Ticket className="h-4 w-4" aria-hidden="true" />
        Enter live raffles
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
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a0a2e] motion-reduce:transition-none"
      >
        Try again
      </button>
    </section>
  )
}
