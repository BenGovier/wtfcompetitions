"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { Zap, ChevronDown, ChevronUp, Gift } from "lucide-react"

const INITIAL_DISPLAY_COUNT = 12

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
}

/**
 * Extract numeric cash value from prize title for display sorting.
 * Examples: "£2,000" → 2000, "£500 Cash" → 500, "£10" → 10
 * Returns null if no cash value can be extracted (non-cash prizes).
 * This is display-only and does not affect database or slot ordering.
 */
function extractCashValue(title: string): number | null {
  // Match £ followed by digits with optional commas and optional decimal
  // e.g. "£2,000", "£500", "£10.50", "£1,000 Cash"
  const match = title.match(/£([\d,]+(?:\.\d{1,2})?)/)
  if (!match) return null
  // Remove commas and parse as float
  const value = parseFloat(match[1].replace(/,/g, ''))
  return Number.isFinite(value) ? value : null
}

/**
 * Sort instant wins for display: only reorder when BOTH items have cash values.
 * If either item lacks a cash value, preserve their original relative order.
 * This prevents non-cash prizes from being pushed around unexpectedly.
 */
function sortInstantWinsForDisplay(wins: InstantWin[]): InstantWin[] {
  // Create array with original indices to preserve relative order
  const withMeta = wins.map((win, originalIndex) => ({
    win,
    originalIndex,
    cashValue: extractCashValue(win.title),
  }))

  // Stable sort: only reorder when BOTH have cash values, otherwise preserve original order
  withMeta.sort((a, b) => {
    const aHasCash = a.cashValue !== null
    const bHasCash = b.cashValue !== null

    // Only reorder if BOTH have cash values: sort descending by value
    if (aHasCash && bHasCash) {
      return b.cashValue! - a.cashValue!
    }
    // If either lacks a cash value, preserve original relative order
    return a.originalIndex - b.originalIndex
  })

  return withMeta.map((m) => m.win)
}

export function InstantWinList({ instantWins }: InstantWinListProps) {
  const [expanded, setExpanded] = useState(false)

  // Display-only sort: cash prizes descending, non-cash preserve original order
  const sortedInstantWins = useMemo(
    () => sortInstantWinsForDisplay(instantWins),
    [instantWins]
  )

  if (!sortedInstantWins || sortedInstantWins.length === 0) return null

  const hasMore = sortedInstantWins.length > INITIAL_DISPLAY_COUNT
  const visibleItems = expanded ? sortedInstantWins : sortedInstantWins.slice(0, INITIAL_DISPLAY_COUNT)

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="size-5 text-amber-500" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Instant Wins Available</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((prize) => {
          const quantity = prize.quantity ?? 1
          const remaining = prize.remaining_count ?? (prize.is_won ? 0 : quantity)
          const awarded = prize.awarded_count ?? (quantity - remaining)
          const allClaimed = remaining === 0

          return (
            <div
              key={prize.id}
              className="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-white/5 p-2"
            >
              {/* Thumbnail */}
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-purple-500/10">
                {prize.image_url ? (
                  <Image
                    src={prize.image_url}
                    alt={prize.title}
                    fill
                    sizes="40px"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Gift className="size-5 text-purple-400/60" aria-hidden="true" />
                  </div>
                )}
              </div>

              {/* Text content */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{prize.title}</p>
                {quantity > 1 ? (
                  <p className="text-xs text-white/60">
                    {allClaimed ? (
                      <span className="text-amber-400">{awarded} claimed</span>
                    ) : (
                      <>{remaining} of {quantity} left</>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-white/60">
                    {allClaimed ? "Claimed" : "Available"}
                  </p>
                )}
              </div>

              {/* Badge */}
              {allClaimed ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  Won
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                  {remaining}
                </span>
              )}
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
              Show all instant wins
              <ChevronDown className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </section>
  )
}
