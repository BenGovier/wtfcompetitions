"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import type { WinnerSnapshot } from "@/lib/types"
import { WinnersFilters } from "@/components/winners-filters"
import { WinnersGrid } from "@/components/winners-grid"
import { SectionHeader } from "@/components/section-header"
import { ShieldCheck, ExternalLink } from "lucide-react"

interface WinnersPageClientProps {
  winners: WinnerSnapshot[]
  featuredWinner: WinnerSnapshot
}

export function WinnersPageClient({ winners }: WinnersPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all")

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

    return filtered
  }, [winners, searchQuery, timeFilter])

  return (
    <>
      {/* Filters */}
      <div className="mb-6">
        <WinnersFilters
          searchQuery={searchQuery}
          timeFilter={timeFilter}
          onSearchChange={setSearchQuery}
          onTimeFilterChange={setTimeFilter}
        />
      </div>

      {/* Winners Grid */}
      <div className="mb-12">
        <SectionHeader
          title={`${filteredWinners.length} ${filteredWinners.length === 1 ? "Winner" : "Winners"}`}
          subtitle="Our verified winners from recent giveaways"
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
