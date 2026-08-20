"use client"

import { useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { PublicGiveawayCard } from "@/components/public-giveaway-card"
import type { GiveawayCategory } from "@/lib/giveaway-classification"

/** One competition ready to render: full snapshot payload + its badge category. */
export interface RailItem {
  giveaway: any
  category: GiveawayCategory
}

/** A single non-empty rail: stable key, customer label, ordered items. */
export interface RailView {
  key: string
  label: string
  items: RailItem[]
}

/**
 * Public homepage discovery: ONE horizontal category selector + ONE visible
 * horizontal rail underneath. All rails arrive pre-built and pre-ordered from
 * the server; switching category is pure local state — no navigation, no page
 * refresh, no DB request, no client-side Supabase call.
 *
 * Only the SELECTED rail's cards are mounted, so hidden categories render no
 * DOM and trigger no image loads. Off-screen cards within the visible rail lazy
 * load naturally (next/image default). The rail uses native CSS scroll-snap —
 * no carousel dependency, no drag/drop, no autoplay.
 */
export function HomeRails({ rails }: { rails: RailView[] }) {
  // Default: Featured if present, otherwise the first non-empty rail. The server
  // already orders `rails` by rail order, so rails[0] is the first non-empty one.
  const defaultKey = useMemo(
    () => rails.find((r) => r.key === "featured")?.key ?? rails[0]?.key ?? "",
    [rails],
  )
  const [selectedKey, setSelectedKey] = useState(defaultKey)

  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const selected = rails.find((r) => r.key === selectedKey) ?? rails[0]
  if (!selected) return null

  const scrollByAmount = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" })
  }

  const singleRail = rails.length === 1

  return (
    <section aria-label="Browse competitions" className="mb-12 md:mb-16">
      {/* Category selector — horizontal, scrollable on mobile if it overflows. */}
      {!singleRail && (
        <div
          role="tablist"
          aria-label="Competition categories"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {rails.map((rail) => {
            const active = rail.key === selected.key
            return (
              <button
                key={rail.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSelectedKey(rail.key)}
                className={
                  "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0014] " +
                  (active
                    ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black shadow-md"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white")
                }
              >
                {rail.label}
                <span className="ml-1.5 tabular-nums opacity-70">{rail.items.length}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Rail header + desktop arrows */}
      <div className="mt-6 flex items-end justify-between gap-3">
        <h2 className="text-balance text-2xl font-bold tracking-tight text-white md:text-3xl">
          {selected.label}
        </h2>
        <div className="hidden shrink-0 gap-2 md:flex">
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            aria-label="Scroll left"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            aria-label="Scroll right"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/*
        Horizontal rail — native scroll only on the X axis, so vertical page
        scrolling is never trapped. Card widths give a dominant card + peek on
        mobile (~84%), ~2 on tablet, ~3-4 on desktop. `-mx-4 px-4` lets the rail
        bleed to the screen edges while keeping the first/last card aligned to
        the container padding. Extra vertical padding preserves card hover
        shadow instead of clipping it.
      */}
      <div
        ref={scrollerRef}
        role="tabpanel"
        className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 py-2 md:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {selected.items.map((item) => (
          <div
            key={`${selected.key}:${item.giveaway.slug ?? item.giveaway.id}`}
            className="w-[84%] shrink-0 snap-start sm:w-[60%] md:w-[46%] lg:w-[31%] xl:w-[23%]"
          >
            <PublicGiveawayCard giveaway={item.giveaway} category={item.category} />
          </div>
        ))}
      </div>
    </section>
  )
}
