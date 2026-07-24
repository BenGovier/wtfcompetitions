"use client"

import { cn } from "@/lib/utils"
import type { FulfilmentCategory } from "@/lib/winners"

export type WinnerFilter = "all" | FulfilmentCategory

interface WinnerFiltersProps {
  active: WinnerFilter
  onChange: (filter: WinnerFilter) => void
  /** Which fulfilment-specific chips to show (only recognised, present types). */
  available: FulfilmentCategory[]
}

const LABELS: Record<WinnerFilter, string> = {
  all: "All",
  cash: "Cash",
  wallet_credit: "WTF Credit",
  other: "Other prizes",
}

const ORDER: FulfilmentCategory[] = ["cash", "wallet_credit", "other"]

export function WinnerFilters({ active, onChange, available }: WinnerFiltersProps) {
  const chips: WinnerFilter[] = ["all", ...ORDER.filter((c) => available.includes(c))]

  return (
    <div
      role="group"
      aria-label="Filter winners by prize type"
      className="mb-4 flex flex-wrap gap-2"
    >
      {chips.map((chip) => {
        const selected = active === chip
        return (
          <button
            key={chip}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(chip)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0018]",
              selected
                ? "border-yellow-400/60 bg-yellow-500/20 text-yellow-100"
                : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white",
            )}
          >
            {LABELS[chip]}
          </button>
        )
      })}
    </div>
  )
}
