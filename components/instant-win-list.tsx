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

/**
 * Grouped instant win for display purposes only.
 * Aggregates quantity, awarded_count, remaining_count from prizes with identical titles.
 */
interface GroupedInstantWin {
  id: string // First item's ID (used as React key)
  title: string
  image_url?: string | null // First item's image
  totalQuantity: number
  totalAwarded: number
  totalRemaining: number
  count: number // How many prizes were grouped
}

// Display-only grouping: keeps public instant win cards lightweight.

/**
 * Group instant wins by exact title for cleaner display.
 * This is display-only and does not alter source data, snapshots, or DB records.
 */
function groupInstantWinsForDisplay(wins: InstantWin[]): GroupedInstantWin[] {
  const groups = new Map<string, GroupedInstantWin>()

  for (const win of wins) {
    const quantity = win.quantity ?? 1
    const remaining = win.remaining_count ?? (win.is_won ? 0 : quantity)
    const awarded = win.awarded_count ?? (quantity - remaining)

    const existing = groups.get(win.title)
    if (existing) {
      existing.totalQuantity += quantity
      existing.totalAwarded += awarded
      existing.totalRemaining += remaining
      existing.count += 1
      // Use first available image in group if current group has no image
      if (!existing.image_url && win.image_url) {
        existing.image_url = win.image_url
      }
    } else {
      groups.set(win.title, {
        id: win.id,
        title: win.title,
        image_url: win.image_url,
        totalQuantity: quantity,
        totalAwarded: awarded,
        totalRemaining: remaining,
        count: 1,
      })
    }
  }

  return Array.from(groups.values())
}

export function InstantWinList({ instantWins }: InstantWinListProps) {
  const [expanded, setExpanded] = useState(false)

  // Display-only: sort first (cash prizes descending), then group by title
  const groupedInstantWins = useMemo(() => {
    const sorted = sortInstantWinsForDisplay(instantWins)
    return groupInstantWinsForDisplay(sorted)
  }, [instantWins])

  if (!groupedInstantWins || groupedInstantWins.length === 0) return null

  const hasMore = groupedInstantWins.length > INITIAL_DISPLAY_COUNT
  const visibleItems = expanded ? groupedInstantWins : groupedInstantWins.slice(0, INITIAL_DISPLAY_COUNT)

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="size-5 text-amber-500" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Instant Wins Available</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((prize) => {
          const allClaimed = prize.totalRemaining === 0

          return (
            <div
              key={prize.id}
              className="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-white/5 p-3"
            >
              {/* Thumbnail */}
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-purple-500/10">
                {prize.image_url ? (
                  <Image
                    src={prize.image_url}
                    alt={prize.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Gift className="size-6 text-purple-400/60" aria-hidden="true" />
                  </div>
                )}
              </div>

              {/* Text content */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{prize.title}</p>
                <span
                  className={
                    allClaimed
                      ? "mt-1 inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400"
                      : "mt-1 inline-flex rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400"
                  }
                >
                  {prize.totalRemaining}/{prize.totalQuantity} Remaining
                </span>
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
              Show all instant wins
              <ChevronDown className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </section>
  )
}
