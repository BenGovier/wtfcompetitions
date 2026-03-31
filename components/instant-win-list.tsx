"use client"

import { useState } from "react"
import { Zap, ChevronDown, ChevronUp } from "lucide-react"

const INITIAL_DISPLAY_COUNT = 12

interface InstantWin {
  id: string
  title: string
  is_won: boolean
}

interface InstantWinListProps {
  instantWins: InstantWin[]
}

export function InstantWinList({ instantWins }: InstantWinListProps) {
  const [expanded, setExpanded] = useState(false)

  if (!instantWins || instantWins.length === 0) return null

  const hasMore = instantWins.length > INITIAL_DISPLAY_COUNT
  const visibleItems = expanded ? instantWins : instantWins.slice(0, INITIAL_DISPLAY_COUNT)

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="size-5 text-amber-500" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Instant Wins Available</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((prize) => (
          <div
            key={prize.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-purple-500/20 bg-white/5 px-3 py-2"
          >
            <span className="text-sm font-medium text-white truncate">{prize.title}</span>
            {prize.is_won ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                Won
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                Available
              </span>
            )}
          </div>
        ))}
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
