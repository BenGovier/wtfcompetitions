"use client"

import { useEffect, useRef, useState } from "react"
import { RailIcon } from "@/components/home/rail-icons"
import type { RailIconKey } from "@/lib/admin/homepage-rails"

export interface HomeNavItem {
  key: string
  label: string
  icon: RailIconKey
  /** Full Tailwind class string for the illuminated ACTIVE chip (per rail). */
  activeClass: string
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
      // Dark purple glass lobby bar: subtle border, inner top highlight, tight
      // vertical rhythm (~54px total). Full-bleed to the screen edge on mobile.
      className="sticky top-16 z-40 -mx-4 mb-6 border-y border-white/10 bg-[#0e0020]/80 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur supports-[backdrop-filter]:bg-[#0e0020]/65 md:mb-8"
    >
      <div
        ref={navRef}
        className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => {
          const isActive = it.key === active
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
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0020] " +
                (isActive
                  ? it.activeClass
                  : "bg-white/[0.04] text-white/55 ring-1 ring-inset ring-white/10 hover:bg-white/[0.08] hover:text-white/80")
              }
            >
              <RailIcon name={it.icon} className="h-3.5 w-3.5 shrink-0" />
              {it.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
