"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { Zap, ChevronDown, ChevronUp, Gift, Crown } from "lucide-react"
import { cn } from "@/lib/utils"

// How many prize groups to show before the "View all instant prizes" toggle.
const INITIAL_DISPLAY_COUNT = 6

interface InstantWin {
  id: string
  title: string
  image_url?: string | null
  quantity?: number
  awarded_count?: number
  remaining_count?: number
  is_won: boolean
}

interface InstantWinListProps {
  instantWins: InstantWin[]
  /**
   * Section heading. Retained for backwards compatibility with existing
   * callers, but the value-led headline is now derived from the data.
   */
  heading?: string
  /** When true, the list is collapsed by default on mobile (desktop unaffected). */
  collapsibleOnMobile?: boolean
}

/**
 * Extract numeric cash value from prize title for display.
 * Examples: "£2,000" → 2000, "£500 Cash" → 500, "£10.50" → 10.5
 * Returns null if no cash value can be extracted (non-cash prizes).
 * This is display-only and does not affect database or slot ordering.
 */
function extractCashValue(title: string): number | null {
  const match = title.match(/£([\d,]+(?:\.\d{1,2})?)/)
  if (!match) return null
  const value = parseFloat(match[1].replace(/,/g, ""))
  return Number.isFinite(value) ? value : null
}

/** Format a numeric pounds value as GBP, hiding decimals when whole. */
function formatCurrency(value: number): string {
  const hasDecimals = !Number.isInteger(value)
  return (
    "£" +
    value.toLocaleString("en-GB", {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    })
  )
}

/**
 * Derive a short "type" label from the prize title by removing the leading
 * cash token (e.g. "£1,000 VIP Balloon" → "VIP Balloon"). Falls back to the
 * raw title, then to "Cash Prize" if nothing is left.
 */
function deriveTypeLabel(title: string, cashValue: number | null): string {
  if (cashValue === null) return title
  const stripped = title
    .replace(/£[\d,]+(?:\.\d{1,2})?/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  const cleaned = stripped
    .replace(/^[-–—:•|,]+/, "")
    .replace(/[-–—:•|,]+$/, "")
    .trim()
  return cleaned.length > 0 ? cleaned : "Cash Prize"
}

/**
 * Grouped instant win for display purposes only.
 * Aggregates quantity/awarded/remaining from prizes with identical titles.
 */
interface GroupedInstantWin {
  id: string
  title: string
  typeLabel: string
  image_url?: string | null
  totalQuantity: number
  totalAwarded: number
  totalRemaining: number
  count: number
  cashValue: number | null
  isVIP: boolean
  isFullyClaimed: boolean
}

/**
 * Group instant wins by exact title, then compute per-group aggregates used
 * for the value-led display. Display-only: does not alter source data,
 * snapshots, or DB records.
 */
function groupInstantWinsForDisplay(wins: InstantWin[]): GroupedInstantWin[] {
  const groups = new Map<string, GroupedInstantWin>()

  for (const win of wins) {
    const quantity = win.quantity ?? 1
    const remaining = win.remaining_count ?? (win.is_won ? 0 : quantity)
    const awarded = win.awarded_count ?? Math.max(quantity - remaining, 0)

    const existing = groups.get(win.title)
    if (existing) {
      existing.totalQuantity += quantity
      existing.totalAwarded += awarded
      existing.totalRemaining += remaining
      existing.count += 1
      if (!existing.image_url && win.image_url) {
        existing.image_url = win.image_url
      }
    } else {
      const cashValue = extractCashValue(win.title)
      groups.set(win.title, {
        id: win.id,
        title: win.title,
        typeLabel: deriveTypeLabel(win.title, cashValue),
        image_url: win.image_url,
        totalQuantity: quantity,
        totalAwarded: awarded,
        totalRemaining: remaining,
        count: 1,
        cashValue,
        isVIP: /vip/i.test(win.title),
        isFullyClaimed: false,
      })
    }
  }

  const result = Array.from(groups.values())
  for (const g of result) {
    g.isFullyClaimed = g.totalRemaining <= 0
  }
  return result
}

/**
 * Sort order (display-only):
 *   1. Available VIP — highest cash first
 *   2. Available standard — highest cash first
 *   3. Claimed VIP — highest cash first
 *   4. Claimed standard — highest cash first
 * Prizes without a parseable cash value sort last within their tier.
 */
function sortGroupsForDisplay(groups: GroupedInstantWin[]): GroupedInstantWin[] {
  return [...groups].sort((a, b) => {
    const availA = a.isFullyClaimed ? 1 : 0
    const availB = b.isFullyClaimed ? 1 : 0
    if (availA !== availB) return availA - availB

    const vipA = a.isVIP ? 0 : 1
    const vipB = b.isVIP ? 0 : 1
    if (vipA !== vipB) return vipA - vipB

    const cashA = a.cashValue ?? -1
    const cashB = b.cashValue ?? -1
    return cashB - cashA
  })
}

export function InstantWinList({ instantWins, collapsibleOnMobile = false }: InstantWinListProps) {
  const [expanded, setExpanded] = useState(false)
  // Mobile-only collapse toggle. Desktop always shows the list (md: overrides).
  const [mobileOpen, setMobileOpen] = useState(false)

  const groupedInstantWins = useMemo(() => {
    return sortGroupsForDisplay(groupInstantWinsForDisplay(instantWins))
  }, [instantWins])

  // Headline aggregates (deterministic, derived only from the existing prop).
  const { availablePrizeCount, availableCashTotal } = useMemo(() => {
    let count = 0
    let cash = 0
    for (const g of groupedInstantWins) {
      count += Math.max(g.totalRemaining, 0)
      if (g.cashValue !== null && g.totalRemaining > 0) {
        cash += g.cashValue * g.totalRemaining
      }
    }
    return { availablePrizeCount: count, availableCashTotal: cash }
  }, [groupedInstantWins])

  if (!groupedInstantWins || groupedInstantWins.length === 0) return null

  const hasMore = groupedInstantWins.length > INITIAL_DISPLAY_COUNT
  const visibleItems = expanded ? groupedInstantWins : groupedInstantWins.slice(0, INITIAL_DISPLAY_COUNT)
  const showCashHeadline = availableCashTotal > 0

  return (
    <section className="space-y-4">
      {/* Value-led header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Zap className="size-4 text-amber-400" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">Instant Wins</span>
          </div>
          <h2 className="mt-1 text-balance text-2xl font-extrabold leading-tight text-white">
            {availablePrizeCount > 0 ? (
              <>
                {availablePrizeCount} Instant {availablePrizeCount === 1 ? "Prize" : "Prizes"} To Be Won
              </>
            ) : (
              "All Instant Prizes Won"
            )}
          </h2>
          {showCashHeadline && (
            <p className="mt-1 text-sm font-semibold text-amber-300">
              {formatCurrency(availableCashTotal)} instant cash to be won
            </p>
          )}
        </div>

        {collapsibleOnMobile && (
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-purple-500/30 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 md:hidden"
          >
            {mobileOpen ? (
              <>
                Hide
                <ChevronUp className="size-3.5" aria-hidden="true" />
              </>
            ) : (
              <>
                View
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>

      <div className={cn(collapsibleOnMobile && !mobileOpen ? "hidden md:block" : "block", "space-y-4")}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((prize) => {
            const claimed = prize.isFullyClaimed

            return (
              <div
                key={prize.id}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden rounded-xl border p-3 transition-colors",
                  prize.isVIP
                    ? "border-amber-400/50 bg-gradient-to-b from-amber-500/15 to-purple-900/30 shadow-[0_0_18px_rgba(245,180,0,0.18)]"
                    : "border-purple-500/25 bg-white/5",
                  claimed && "opacity-60",
                )}
              >
                {/* Top row: badge */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  {prize.isVIP ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      <Crown className="size-3" aria-hidden="true" />
                      VIP
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-purple-300/70">Instant</span>
                  )}
                  {claimed && (
                    <span className="inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80">
                      Won
                    </span>
                  )}
                </div>

                {/* Cash value — the largest element in the card */}
                {prize.cashValue !== null ? (
                  <p
                    className={cn(
                      "text-2xl font-extrabold leading-none sm:text-3xl",
                      prize.isVIP ? "text-amber-300" : "text-white",
                    )}
                  >
                    {formatCurrency(prize.cashValue)}
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    {prize.image_url ? (
                      <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-purple-500/10">
                        <Image
                          src={prize.image_url || "/placeholder.svg"}
                          alt={prize.title}
                          fill
                          sizes="32px"
                          className="object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <Gift className="size-5 shrink-0 text-purple-300/70" aria-hidden="true" />
                    )}
                    <p className="text-base font-bold leading-tight text-white">{prize.title}</p>
                  </div>
                )}

                {/* Type label */}
                {prize.cashValue !== null && (
                  <p className="mt-1 truncate text-xs font-medium text-purple-100/90">{prize.typeLabel}</p>
                )}

                {/* Availability / claimed status */}
                <div className="mt-2">
                  {claimed ? (
                    <span className="text-[11px] font-semibold text-white/70">
                      Won {prize.totalAwarded} / {prize.totalQuantity}
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold",
                          prize.isVIP ? "bg-amber-400/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300",
                        )}
                      >
                        {prize.totalRemaining} to be won
                      </span>
                      {prize.totalAwarded > 0 && (
                        <span className="text-[10px] font-medium text-white/50">{prize.totalAwarded} won</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {expanded ? (
              <>
                Show less
                <ChevronUp className="size-4" aria-hidden="true" />
              </>
            ) : (
              <>
                View all instant prizes
                <ChevronDown className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  )
}
