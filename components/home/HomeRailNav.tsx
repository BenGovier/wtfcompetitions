"use client"

import { useEffect, useRef, useState } from "react"
import { RailIcon } from "@/components/home/rail-icons"
import type { RailIconKey } from "@/lib/admin/homepage-rails"

export interface HomeNavItem {
  key: string
  label: string
  icon: RailIconKey
  /** Full Tailwind class string for the illuminated ACTIVE room tab (per rail). */
  activeClass: string
  /** Full Tailwind class string for the idle room tab — dark surface + faint
   *  accent outline so it still reads as a lit casino tab, not a grey pill. */
  idleClass: string
}

/**
 * Casino ROOM-TILE visual identity, keyed by the stable rail key. This is
 * presentation-only styling for the selector and lives inside this single
 * component on purpose (no data / no presentation-map changes). Each room keeps
 * a recognisable colour identity even when INACTIVE (darker border + tinted
 * near-black surface + muted icon/label), and lights up when ACTIVE (brighter
 * border, restrained inner highlight + concentrated outer glow, brighter icon
 * and label). Full Tailwind literals so v4's source scan keeps them.
 *
 * `minW` gives each tile a comfortable width so labels never clip and the third
 * room deliberately peeks at 430px. `emblem` styles the icon's own inset badge.
 */
interface RoomStyle {
  minW: string
  tileActive: string
  tileIdle: string
  emblemActive: string
  emblemIdle: string
  labelActive: string
  labelIdle: string
}

const GOLD: RoomStyle = {
  minW: "min-w-[135px]",
  tileActive:
    "border-amber-400/90 bg-[linear-gradient(135deg,#251500_0%,#120900_55%,#08000f_100%)] shadow-[inset_0_0_0_1px_rgba(255,190,20,0.35),inset_0_1px_0_rgba(255,225,150,0.18),0_0_14px_rgba(255,180,0,0.22)]",
  tileIdle: "border-amber-500/35 bg-[linear-gradient(135deg,#1a0e00_0%,#0d0700_60%,#08000f_100%)]",
  emblemActive: "bg-amber-950/70 ring-1 ring-amber-400/55 text-amber-300",
  emblemIdle: "bg-black/40 ring-1 ring-amber-500/30 text-amber-500/70",
  labelActive: "text-[#FFE28A]",
  labelIdle: "text-amber-200/55",
}

const MAGENTA: RoomStyle = {
  minW: "min-w-[155px]",
  tileActive:
    "border-fuchsia-400/90 bg-[linear-gradient(135deg,#2a0020_0%,#160011_55%,#08000f_100%)] shadow-[inset_0_0_0_1px_rgba(255,61,187,0.35),inset_0_1px_0_rgba(255,180,230,0.16),0_0_14px_rgba(255,61,187,0.24)]",
  tileIdle: "border-fuchsia-500/35 bg-[linear-gradient(135deg,#1c0016_0%,#100009_60%,#08000f_100%)]",
  emblemActive: "bg-fuchsia-950/70 ring-1 ring-fuchsia-400/55 text-fuchsia-300",
  emblemIdle: "bg-black/40 ring-1 ring-fuchsia-500/30 text-fuchsia-400/70",
  labelActive: "text-[#FF66CE]",
  labelIdle: "text-fuchsia-200/55",
}

const CYAN: RoomStyle = {
  minW: "min-w-[165px]",
  tileActive:
    "border-cyan-300/90 bg-[linear-gradient(135deg,#001a22_0%,#000f16_55%,#08000f_100%)] shadow-[inset_0_0_0_1px_rgba(25,215,255,0.35),inset_0_1px_0_rgba(150,235,255,0.16),0_0_14px_rgba(25,215,255,0.24)]",
  tileIdle: "border-cyan-500/35 bg-[linear-gradient(135deg,#001217_0%,#00090f_60%,#08000f_100%)]",
  emblemActive: "bg-cyan-950/70 ring-1 ring-cyan-400/55 text-cyan-300",
  emblemIdle: "bg-black/40 ring-1 ring-cyan-500/30 text-cyan-400/70",
  labelActive: "text-[#5AE7FF]",
  labelIdle: "text-cyan-200/55",
}

const VIOLET: RoomStyle = {
  minW: "min-w-[135px]",
  tileActive:
    "border-violet-400/90 bg-[linear-gradient(135deg,#16002a_0%,#0d0016_55%,#08000f_100%)] shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35),inset_0_1px_0_rgba(200,180,255,0.16),0_0_14px_rgba(139,92,246,0.24)]",
  tileIdle: "border-violet-500/35 bg-[linear-gradient(135deg,#100020_0%,#0a0016_60%,#08000f_100%)]",
  emblemActive: "bg-violet-950/70 ring-1 ring-violet-400/55 text-violet-300",
  emblemIdle: "bg-black/40 ring-1 ring-violet-500/30 text-violet-400/70",
  labelActive: "text-violet-100",
  labelIdle: "text-violet-200/55",
}

const EMERALD: RoomStyle = {
  minW: "min-w-[135px]",
  tileActive:
    "border-emerald-400/90 bg-[linear-gradient(135deg,#00220f_0%,#001409_55%,#08000f_100%)] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(160,255,210,0.16),0_0_14px_rgba(16,185,129,0.24)]",
  tileIdle: "border-emerald-500/35 bg-[linear-gradient(135deg,#001208_0%,#000c06_60%,#08000f_100%)]",
  emblemActive: "bg-emerald-950/70 ring-1 ring-emerald-400/55 text-emerald-300",
  emblemIdle: "bg-black/40 ring-1 ring-emerald-500/30 text-emerald-400/70",
  labelActive: "text-emerald-100",
  labelIdle: "text-emerald-200/55",
}

/** Rail key → room identity. Falls back to GOLD for any unmapped key. */
const ROOM_STYLES: Record<string, RoomStyle> = {
  featured: GOLD,
  balloon_pop: MAGENTA,
  instant_cash: CYAN,
  games: VIOLET,
  cash: EMERALD,
  luxury: CYAN,
}

/**
 * Sticky, horizontally-scrollable casino-lobby category navigation with
 * scroll-spy.
 *
 * PERFORMANCE CONTRACT (see homepage spec):
 *  - NO scroll event listeners, NO rAF loop, NO layout thrash on scroll.
 *  - Exactly ONE IntersectionObserver watching the section containers.
 *  - State is a single active-key string; it changes only when the dominant
 *    section actually changes, so React re-renders are rare (not per-frame).
 *  - Tapping a chip does a native smooth `scrollIntoView`; CSS `scroll-mt-*` on
 *    each section handles the sticky-header/nav offset. No URL change, no fetch.
 */
export function HomeRailNav({ items }: { items: HomeNavItem[] }) {
  const [active, setActive] = useState(items[0]?.key ?? "")
  const navRef = useRef<HTMLDivElement | null>(null)
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Scroll-spy: one observer over the section containers. We keep a live set of
  // sections currently inside a thin band just below the sticky chrome, and the
  // topmost (document-order) one wins — a stable rule that avoids flickering
  // between two neighbours near a boundary.
  useEffect(() => {
    if (items.length <= 1) return
    const sections = items
      .map((it) => document.getElementById(`home-rail-${it.key}`))
      .filter((el): el is HTMLElement => Boolean(el))
    if (sections.length === 0) return

    const visible = new Set<string>()
    const order = items.map((it) => it.key)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = entry.target.getAttribute("data-rail-key") ?? ""
          if (!key) continue
          if (entry.isIntersecting) visible.add(key)
          else visible.delete(key)
        }
        // Topmost visible section in canonical order becomes active. If none is
        // in the band (mid-transition), keep the current active value.
        for (const key of order) {
          if (visible.has(key)) {
            setActive((prev) => (prev === key ? prev : key))
            return
          }
        }
      },
      {
        // Header (64px) + compact nav (~54px) ≈ 120px inset at the top; the
        // -70% bottom inset leaves a thin activation band in the upper viewport.
        rootMargin: "-120px 0px -70% 0px",
        threshold: 0,
      },
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [items])

  // When the active chip changes, bring it into view WITHIN the nav strip only
  // (horizontal), never the page. Runs on change only — not during scroll.
  useEffect(() => {
    const nav = navRef.current
    const chip = chipRefs.current[active]
    if (!nav || !chip) return
    const chipLeft = chip.offsetLeft
    const chipRight = chipLeft + chip.offsetWidth
    const viewLeft = nav.scrollLeft
    const viewRight = viewLeft + nav.clientWidth
    if (chipLeft < viewLeft) {
      nav.scrollTo({ left: Math.max(0, chipLeft - 16), behavior: "smooth" })
    } else if (chipRight > viewRight) {
      nav.scrollTo({ left: chipRight - nav.clientWidth + 16, behavior: "smooth" })
    }
  }, [active])

  const go = (key: string) => {
    const el = document.getElementById(`home-rail-${key}`)
    if (!el) return
    setActive(key)
    el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // A single rail needs no navigation.
  if (items.length <= 1) return null

  return (
    <nav
      aria-label="Competition categories"
      // Near-black casino ROOM selector bar (darker than the page). Full-bleed
      // to the screen edge; thin top+bottom dividers with a faint gold lower
      // seam near the active room. ~76px tall on mobile (56px tiles + 10px
      // vertical padding). Behaviour (scroll-spy, smooth scroll) is unchanged.
      className="sticky top-16 z-40 -mx-4 mb-6 border-y border-white/10 bg-[#07000c]/95 px-3.5 py-2.5 shadow-[inset_0_-1px_0_rgba(251,191,36,0.12)] backdrop-blur supports-[backdrop-filter]:bg-[#07000c]/90 md:mb-8"
    >
      <div
        ref={navRef}
        className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => {
          const isActive = it.key === active
          const room = ROOM_STYLES[it.key] ?? GOLD
          return (
            <button
              key={it.key}
              ref={(el) => {
                chipRefs.current[it.key] = el
              }}
              type="button"
              aria-current={isActive ? "true" : undefined}
              onClick={() => go(it.key)}
              className={
                // Compact game TILE (not a pill): fixed 56px height, 14px radius,
                // per-room min-width so labels never clip. Only colour /
                // background / border / shadow transition (120–180ms).
                "group/room inline-flex h-14 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[14px] border px-3.5 transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07000c] " +
                room.minW +
                " " +
                (isActive ? room.tileActive : room.tileIdle)
              }
            >
              {/* Icon EMBLEM — its own inset badge, visually separate from the
                  label, so each room has a strong icon identity. */}
              <span
                aria-hidden="true"
                className={
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-[color,background-color,box-shadow] duration-150 " +
                  (isActive ? room.emblemActive : room.emblemIdle)
                }
              >
                <RailIcon name={it.icon} className="h-[18px] w-[18px]" />
              </span>
              <span
                className={
                  "text-[13px] font-black uppercase leading-none tracking-tight transition-colors duration-150 " +
                  (isActive ? room.labelActive : room.labelIdle)
                }
              >
                {it.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
