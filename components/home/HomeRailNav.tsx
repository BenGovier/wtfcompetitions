"use client"

import { useEffect, useRef, useState } from "react"

export interface HomeNavItem {
  key: string
  label: string
}

/**
 * Sticky, horizontally-scrollable category navigation with scroll-spy.
 *
 * PERFORMANCE CONTRACT (see homepage spec):
 *  - NO scroll event listeners, NO rAF loop, NO layout thrash on scroll.
 *  - Exactly ONE IntersectionObserver watching the six section containers.
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
        // Header (64px) + sticky nav (~52px) ≈ 116px inset at the top; the
        // -70% bottom inset leaves a thin activation band in the upper viewport.
        rootMargin: "-116px 0px -70% 0px",
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
      className="sticky top-16 z-40 -mx-4 mb-8 border-y border-white/10 bg-[#0a0014]/85 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-[#0a0014]/70 md:top-16"
    >
      <div
        ref={navRef}
        className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0014] " +
                (isActive
                  ? "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black shadow-md"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white")
              }
            >
              {it.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
