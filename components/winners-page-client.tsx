"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import { WinnersFilters } from "@/components/winners-filters"
import { WinnersGrid } from "@/components/winners-grid"
import { SectionHeader } from "@/components/section-header"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldCheck, ExternalLink, Trophy, Sparkles } from "lucide-react"

interface WinnersPageClientProps {
  winners: WinnerSnapshot[]
}

function formatTimeAgo(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffSeconds = Math.floor((now - then) / 1000)

  if (diffSeconds < 60) return "just now"
  if (diffSeconds < 3600) {
    const mins = Math.floor(diffSeconds / 60)
    return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600)
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  }
  if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400)
    return `${days} ${days === 1 ? "day" : "days"} ago`
  }
  if (diffSeconds < 2592000) {
    const weeks = Math.floor(diffSeconds / 604800)
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`
  }
  const months = Math.floor(diffSeconds / 2592000)
  return `${months} ${months === 1 ? "month" : "months"} ago`
}

export function WinnersPageClient({ winners }: WinnersPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all")
  const [typeFilter, setTypeFilter] = useState<"all" | "main" | "instant">("all")

  // Find the latest main winner for the spotlight
  const latestMainWinner = useMemo(() => {
    return winners.find((w) => w.kind === "main") || null
  }, [winners])

  const filteredWinners = useMemo(() => {
    let filtered = [...winners]

    // Time filter
    const now = Date.now()
    if (timeFilter === "week") {
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000
      filtered = filtered.filter((w) => Date.parse(w.announcedAt) >= weekAgo)
    } else if (timeFilter === "month") {
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000
      filtered = filtered.filter((w) => Date.parse(w.announcedAt) >= monthAgo)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.prizeTitle.toLowerCase().includes(query) ||
          w.giveawayTitle.toLowerCase().includes(query),
      )
    }

    // Type filter
    if (typeFilter === "main") {
      filtered = filtered.filter((w) => w.kind === "main")
    } else if (typeFilter === "instant") {
      filtered = filtered.filter((w) => w.kind === "instant")
    }

    return filtered
  }, [winners, searchQuery, timeFilter, typeFilter])

  return (
    <>
      {/* Latest Main Winner Spotlight */}
      {latestMainWinner && (
        <div className="mb-8">
          <Card className="relative overflow-hidden border-2 border-amber-400/60 bg-gradient-to-r from-amber-50 via-background to-amber-50/50 dark:from-amber-950/30 dark:via-background dark:to-amber-950/20">
            {/* Decorative elements */}
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-amber-400/10 blur-2xl" />
            <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-amber-400/10 blur-2xl" />

            <CardContent className="relative p-6 md:p-8">
              <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left md:gap-6">
                {/* Trophy badge */}
                <div className="mb-4 flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg md:mb-0">
                  <Trophy className="h-10 w-10 text-white" aria-hidden="true" />
                </div>

                <div className="flex-1">
                  {/* Label */}
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Latest Main Winner
                  </div>

                  {/* Winner name */}
                  <h2 className="text-2xl font-bold text-foreground md:text-3xl">{latestMainWinner.name}</h2>

                  {/* Prize */}
                  <p className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {latestMainWinner.prizeTitle}
                  </p>

                  {/* Meta */}
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground md:justify-start">
                    <span>{latestMainWinner.giveawayTitle}</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {formatTimeAgo(latestMainWinner.announcedAt)}
                    </span>
                  </div>

                  {latestMainWinner.giveawaySlug && (
                    <a
                      href={`/giveaways/${latestMainWinner.giveawaySlug}`}
                      className="mt-4 inline-flex items-center gap-1 rounded text-sm font-semibold text-amber-600 transition-colors hover:text-amber-700 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                      View giveaway
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <WinnersFilters
          searchQuery={searchQuery}
          timeFilter={timeFilter}
          typeFilter={typeFilter}
          onSearchChange={setSearchQuery}
          onTimeFilterChange={setTimeFilter}
          onTypeFilterChange={setTypeFilter}
        />
      </div>

      {/* Winners Grid */}
      <div className="mb-12">
        <SectionHeader
          title={`${filteredWinners.length} ${filteredWinners.length === 1 ? "Winner" : "Winners"}`}
          subtitle="Verified main prize winners and instant win winners from recent giveaways"
          className="mb-6"
        />
        {filteredWinners.length === 0 && searchQuery ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">
              No winners found for <span className="font-semibold">&quot;{searchQuery}&quot;</span>. Try a different
              search term.
            </p>
          </div>
        ) : (
          <WinnersGrid winners={filteredWinners} />
        )}
      </div>

      {/* Transparency Section */}
      <div className="rounded-lg border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-balance text-xl font-semibold md:text-2xl">How Winners Are Chosen</h2>
            <p className="mt-2 text-pretty text-muted-foreground">
              All winners are selected through a fair random drawing system. Each entry has an equal chance of winning.
              Winners are verified and announced publicly within 48 hours of each draw closing.{" "}
              {/* Updated profile photo policy to match opt-out language */}A profile photo or avatar and real name are
              used for public winner announcements (users can opt out in account settings).
            </p>
            <p className="mt-3 text-pretty text-sm text-muted-foreground">
              For select Variant E giveaways, winners may be drawn live on TikTok. When this occurs, a link to the
              recorded livestream will be included in the announcement.
            </p>
            <Link
              href="/faq"
              className="mt-4 inline-flex items-center gap-1 rounded text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Learn more in our FAQ
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
