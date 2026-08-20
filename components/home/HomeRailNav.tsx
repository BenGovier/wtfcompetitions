"use client"

import { useEffect, useRef, useState } from "react"
import { RailIcon } from "@/components/home/rail-icons"
import type { RailIconKey } from "@/lib/admin/homepage-rails"

export interface HomeNavItem {
  key: string
  label: string
  icon: RailIconKey
  /** Kept for caller compatibility. Visual styling is intentionally owned here. */
  activeClass: string
  /** Kept for caller compatibility. Visual styling is intentionally owned here. */
  idleClass: string
}

interface RoomStyle {
  width: string
  activeTile: string
  idleTile: string
  activeEmblem: string
  idleEmblem: string
  activeLabel: string
  idleLabel: string
  activeBeam: string
  idleBeam: string
  activeTopShine: string
  idleTopShine: string
  outerGlow: string
  edgeHotspot: string
}

const ROOM_STYLES: Record<string, RoomStyle> = {
  featured: {
    width: "w-[150px]",
    activeTile:
      "border-[#F7C844] bg-[linear-gradient(145deg,#251700_0%,#120A00_46%,#070008_100%)] shadow-[inset_0_0_0_1px_rgba(255,224,125,0.20),inset_0_1px_0_rgba(255,249,218,0.30),0_0_6px_rgba(255,193,7,0.35),0_0_22px_rgba(255,160,0,0.22)]",
    idleTile:
      "border-[#6E4C08] bg-[linear-gradient(145deg,#150C00_0%,#090500_48%,#070008_100%)] shadow-[inset_0_1px_0_rgba(255,222,135,0.06)]",
    activeEmblem:
      "border-[#EAB52C] bg-[radial-gradient(circle_at_35%_28%,#604000_0%,#241500_52%,#090500_100%)] text-[#FFD761] shadow-[inset_0_1px_0_rgba(255,242,190,0.18),0_0_12px_rgba(255,183,0,0.22)]",
    idleEmblem:
      "border-[#6E4C08] bg-[#100900] text-[#A87918]",
    activeLabel: "text-[#FFE8A0]",
    idleLabel: "text-[#C9A65A]",
    activeBeam:
      "bg-[linear-gradient(90deg,transparent_0%,#8A5B00_12%,#FFD24B_50%,#8A5B00_88%,transparent_100%)] opacity-100",
    idleBeam:
      "bg-[linear-gradient(90deg,transparent_0%,#3D2A05_18%,#775410_50%,#3D2A05_82%,transparent_100%)] opacity-60",
    activeTopShine:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,219,105,0.12)_20%,rgba(255,238,180,0.34)_50%,rgba(255,219,105,0.12)_80%,transparent_100%)]",
    idleTopShine:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,204,68,0.05)_50%,transparent_100%)]",
    outerGlow:
      "bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,190,20,0.32)_0%,rgba(255,170,0,0.10)_42%,transparent_72%)]",
    edgeHotspot:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,185,0,0.20)_24%,#FFE36A_50%,rgba(255,185,0,0.20)_76%,transparent_100%)]",
  },

  balloon_pop: {
    width: "w-[166px]",
    activeTile:
      "border-[#F044B9] bg-[linear-gradient(145deg,#260018_0%,#12000B_46%,#070008_100%)] shadow-[inset_0_1px_0_rgba(255,192,233,0.14),inset_0_0_0_1px_rgba(240,68,185,0.08),0_0_6px_rgba(240,68,185,0.32),0_0_22px_rgba(240,68,185,0.20)]",
    idleTile:
      "border-[#642050] bg-[linear-gradient(145deg,#15000E_0%,#0B0007_48%,#070008_100%)] shadow-[inset_0_1px_0_rgba(255,164,220,0.05)]",
    activeEmblem:
      "border-[#E43AAE] bg-[radial-gradient(circle_at_35%_28%,#5C0D45_0%,#260018_52%,#0B0007_100%)] text-[#FF6ECE] shadow-[inset_0_1px_0_rgba(255,206,237,0.16),0_0_12px_rgba(240,68,185,0.20)]",
    idleEmblem:
      "border-[#642050] bg-[#100009] text-[#A64986]",
    activeLabel: "text-[#FFB4E4]",
    idleLabel: "text-[#C780AF]",
    activeBeam:
      "bg-[linear-gradient(90deg,transparent_0%,#7E155D_12%,#FF54C6_50%,#7E155D_88%,transparent_100%)] opacity-100",
    idleBeam:
      "bg-[linear-gradient(90deg,transparent_0%,#35102B_18%,#6B2353_50%,#35102B_82%,transparent_100%)] opacity-60",
    activeTopShine:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,93,200,0.10)_20%,rgba(255,166,224,0.28)_50%,rgba(255,93,200,0.10)_80%,transparent_100%)]",
    idleTopShine:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(240,68,185,0.05)_50%,transparent_100%)]",
    outerGlow:
      "bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,46,185,0.30)_0%,rgba(255,46,185,0.10)_42%,transparent_72%)]",
    edgeHotspot:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,50,190,0.18)_24%,#FF73D4_50%,rgba(255,50,190,0.18)_76%,transparent_100%)]",
  },

  instant_cash: {
    width: "w-[190px]",
    activeTile:
      "border-[#20CFF3] bg-[linear-gradient(145deg,#001A22_0%,#000D12_46%,#070008_100%)] shadow-[inset_0_1px_0_rgba(190,244,255,0.14),inset_0_0_0_1px_rgba(32,207,243,0.08),0_0_6px_rgba(32,207,243,0.30),0_0_22px_rgba(32,207,243,0.19)]",
    idleTile:
      "border-[#14506A] bg-[linear-gradient(145deg,#001016_0%,#00080B_48%,#070008_100%)] shadow-[inset_0_1px_0_rgba(138,231,251,0.05)]",
    activeEmblem:
      "border-[#1BBEDC] bg-[radial-gradient(circle_at_35%_28%,#063F4E_0%,#001A22_52%,#00090D_100%)] text-[#62E6FF] shadow-[inset_0_1px_0_rgba(202,249,255,0.16),0_0_12px_rgba(32,207,243,0.18)]",
    idleEmblem:
      "border-[#14506A] bg-[#000B0F] text-[#3B91A8]",
    activeLabel: "text-[#A8F2FF]",
    idleLabel: "text-[#78AEBB]",
    activeBeam:
      "bg-[linear-gradient(90deg,transparent_0%,#0A6680_12%,#42DEFF_50%,#0A6680_88%,transparent_100%)] opacity-100",
    idleBeam:
      "bg-[linear-gradient(90deg,transparent_0%,#0B2D38_18%,#14566A_50%,#0B2D38_82%,transparent_100%)] opacity-60",
    activeTopShine:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(70,220,255,0.10)_20%,rgba(170,244,255,0.26)_50%,rgba(70,220,255,0.10)_80%,transparent_100%)]",
    idleTopShine:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(32,207,243,0.05)_50%,transparent_100%)]",
    outerGlow:
      "bg-[radial-gradient(ellipse_at_50%_100%,rgba(25,215,255,0.30)_0%,rgba(25,215,255,0.10)_42%,transparent_72%)]",
    edgeHotspot:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(25,215,255,0.18)_24%,#7DEBFF_50%,rgba(25,215,255,0.18)_76%,transparent_100%)]",
  },

  games: {
    width: "w-[150px]",
    activeTile:
      "border-violet-400/80 bg-[linear-gradient(145deg,#160525_0%,#0B0313_48%,#070008_100%)] shadow-[inset_0_1px_0_rgba(225,210,255,0.12),0_0_6px_rgba(139,92,246,0.28),0_0_20px_rgba(139,92,246,0.17)]",
    idleTile: "border-violet-800/70 bg-[#0B0311]",
    activeEmblem: "border-violet-500/80 bg-violet-950/70 text-violet-200",
    idleEmblem: "border-violet-900 bg-[#0B0311] text-violet-400/60",
    activeLabel: "text-violet-100",
    idleLabel: "text-violet-300/60",
    activeBeam: "bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-90",
    idleBeam: "bg-gradient-to-r from-transparent via-violet-900 to-transparent opacity-50",
    activeTopShine: "bg-gradient-to-r from-transparent via-violet-200/20 to-transparent",
    idleTopShine: "bg-gradient-to-r from-transparent via-violet-500/5 to-transparent",
    outerGlow:
      "bg-[radial-gradient(ellipse_at_50%_100%,rgba(139,92,246,0.26)_0%,rgba(139,92,246,0.08)_42%,transparent_72%)]",
    edgeHotspot:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(139,92,246,0.16)_24%,#C4B5FD_50%,rgba(139,92,246,0.16)_76%,transparent_100%)]",
  },

  cash: {
    width: "w-[145px]",
    activeTile:
      "border-emerald-400/80 bg-[linear-gradient(145deg,#042015_0%,#03110B_48%,#070008_100%)] shadow-[inset_0_1px_0_rgba(195,255,225,0.12),0_0_6px_rgba(16,185,129,0.28),0_0_20px_rgba(16,185,129,0.17)]",
    idleTile: "border-emerald-900/80 bg-[#03100A]",
    activeEmblem: "border-emerald-500/80 bg-emerald-950/70 text-emerald-200",
    idleEmblem: "border-emerald-900 bg-[#03100A] text-emerald-400/60",
    activeLabel: "text-emerald-100",
    idleLabel: "text-emerald-300/60",
    activeBeam: "bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-90",
    idleBeam: "bg-gradient-to-r from-transparent via-emerald-900 to-transparent opacity-50",
    activeTopShine: "bg-gradient-to-r from-transparent via-emerald-200/20 to-transparent",
    idleTopShine: "bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent",
    outerGlow:
      "bg-[radial-gradient(ellipse_at_50%_100%,rgba(16,185,129,0.25)_0%,rgba(16,185,129,0.08)_42%,transparent_72%)]",
    edgeHotspot:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(16,185,129,0.16)_24%,#6EE7B7_50%,rgba(16,185,129,0.16)_76%,transparent_100%)]",
  },

  luxury: {
    width: "w-[170px]",
    activeTile:
      "border-[#20CFF3] bg-[linear-gradient(145deg,#001A22_0%,#000D12_46%,#070008_100%)] shadow-[inset_0_1px_0_rgba(190,244,255,0.14),0_0_6px_rgba(32,207,243,0.30),0_0_22px_rgba(32,207,243,0.19)]",
    idleTile:
      "border-[#14506A] bg-[linear-gradient(145deg,#001016_0%,#00080B_48%,#070008_100%)]",
    activeEmblem: "border-[#1BBEDC] bg-[#001A22] text-[#62E6FF]",
    idleEmblem: "border-[#14506A] bg-[#000B0F] text-[#3B91A8]",
    activeLabel: "text-[#A8F2FF]",
    idleLabel: "text-[#78AEBB]",
    activeBeam:
      "bg-[linear-gradient(90deg,transparent_0%,#0A6680_12%,#42DEFF_50%,#0A6680_88%,transparent_100%)] opacity-100",
    idleBeam:
      "bg-[linear-gradient(90deg,transparent_0%,#0B2D38_18%,#14566A_50%,#0B2D38_82%,transparent_100%)] opacity-60",
    activeTopShine:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(70,220,255,0.10)_20%,rgba(170,244,255,0.26)_50%,rgba(70,220,255,0.10)_80%,transparent_100%)]",
    idleTopShine:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(32,207,243,0.05)_50%,transparent_100%)]",
    outerGlow:
      "bg-[radial-gradient(ellipse_at_50%_100%,rgba(25,215,255,0.30)_0%,rgba(25,215,255,0.10)_42%,transparent_72%)]",
    edgeHotspot:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(25,215,255,0.18)_24%,#7DEBFF_50%,rgba(25,215,255,0.18)_76%,transparent_100%)]",
  },
}

function JackpotGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 8.2 7.2 11 12 5.4l4.8 5.6L20 8.2l-1.35 8.15H5.35L4 8.2Z"
        fill="currentColor"
        opacity=".96"
      />
      <path
        d="M6.1 18.3h11.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="4" cy="6.4" r="1.2" fill="currentColor" />
      <circle cx="12" cy="3.5" r="1.2" fill="currentColor" />
      <circle cx="20" cy="6.4" r="1.2" fill="currentColor" />
    </svg>
  )
}

function BalloonGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3.1c-3.45 0-6.05 2.78-6.05 6.35 0 3.43 2.38 6.28 5.23 6.95l-.78 1.65h3.2l-.78-1.65c2.85-.67 5.23-3.52 5.23-6.95C18.05 5.88 15.45 3.1 12 3.1Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 18.05c.05 1.1-.55 1.8-1.25 2.55"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="m18.75 4.1.65-1.2M20.1 6.2l1.35-.25M17.2 2.95l-.15-1.4"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DiamondGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m4.2 8.2 3.15-4h9.3l3.15 4L12 20.1 4.2 8.2Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M4.7 8.25h14.6M8 4.5l4 15M16 4.5l-4 15M8.1 8.2 12 4.35l3.9 3.85"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RoomGlyph({
  railKey,
  fallback,
}: {
  railKey: string
  fallback: RailIconKey
}) {
  if (railKey === "featured") {
    return <JackpotGlyph className="h-[21px] w-[21px]" />
  }

  if (railKey === "balloon_pop") {
    return <BalloonGlyph className="h-[21px] w-[21px]" />
  }

  if (railKey === "instant_cash" || railKey === "luxury") {
    return <DiamondGlyph className="h-[21px] w-[21px]" />
  }

  return <RailIcon name={fallback} className="h-[20px] w-[20px]" />
}

/**
 * Sticky, horizontally-scrollable casino-lobby category navigation with the
 * EXISTING scroll-spy behaviour preserved.
 *
 * PERFORMANCE:
 * - zero scroll event listeners
 * - exactly one IntersectionObserver
 * - one active-key state string
 * - native horizontal scrolling
 * - native smooth scroll to section
 */
export function HomeRailNav({ items }: { items: HomeNavItem[] }) {
  const [active, setActive] = useState(items[0]?.key ?? "")
  const navRef = useRef<HTMLDivElement | null>(null)
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})

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

        for (const key of order) {
          if (visible.has(key)) {
            setActive((prev) => (prev === key ? prev : key))
            return
          }
        }
      },
      {
        rootMargin: "-120px 0px -70% 0px",
        threshold: 0,
      },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [items])

  useEffect(() => {
    const nav = navRef.current
    const chip = chipRefs.current[active]

    if (!nav || !chip) return

    const chipLeft = chip.offsetLeft
    const chipRight = chipLeft + chip.offsetWidth
    const viewLeft = nav.scrollLeft
    const viewRight = viewLeft + nav.clientWidth

    if (chipLeft < viewLeft) {
      nav.scrollTo({
        left: Math.max(0, chipLeft - 16),
        behavior: "smooth",
      })
    } else if (chipRight > viewRight) {
      nav.scrollTo({
        left: chipRight - nav.clientWidth + 16,
        behavior: "smooth",
      })
    }
  }, [active])

  const go = (key: string) => {
    const el = document.getElementById(`home-rail-${key}`)
    if (!el) return

    setActive(key)

    el.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  if (items.length <= 1) return null

  return (
    <nav
      aria-label="Competition categories"
      className="sticky top-16 z-40 -mx-4 mb-6 border-y border-white/[0.06] bg-[#050008]/[0.98] shadow-[0_10px_30px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.03),inset_0_-1px_0_rgba(255,196,37,0.08)] backdrop-blur-md md:mb-8"
    >
      <div
        ref={navRef}
        className="flex h-[84px] items-center gap-[10px] overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = item.key === active
          const room = ROOM_STYLES[item.key] ?? ROOM_STYLES.featured

          return (
            <button
              key={item.key}
              ref={(element) => {
                chipRefs.current[item.key] = element
              }}
              type="button"
              aria-current={isActive ? "true" : undefined}
              onClick={() => go(item.key)}
              className={[
                // IMPORTANT: no overflow-hidden here.
                // The external bloom is intentionally allowed to escape the tile.
                "group relative isolate h-[60px] shrink-0 rounded-[12px] border",
                "transition-[border-color,background-color,box-shadow,color] duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-[#050008]",
                room.width,
                isActive ? room.activeTile : room.idleTile,
              ].join(" ")}
            >
              {/* Soft bloom OUTSIDE the crisp edge.
                  This creates depth without turning the whole tile into blur. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute -inset-[5px] -z-10 rounded-[17px] blur-[9px]",
                  "transition-opacity duration-150",
                  room.outerGlow,
                  isActive ? "opacity-100" : "opacity-25",
                ].join(" ")}
              />

              {/* Concentrated light hotspot on the lower edge.
                  This is deliberately brighter than the surrounding rim. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute -bottom-px left-[14%] right-[14%] h-[2px] blur-[1px]",
                  room.edgeHotspot,
                  isActive ? "opacity-100" : "opacity-20",
                ].join(" ")}
              />

              {/* Additional tiny corner sparks make the light feel electrical,
                  but remain fully static and CSS-only. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute -left-[2px] top-[17px] h-[18px] w-[3px] rounded-full blur-[2px]",
                  room.edgeHotspot,
                  isActive ? "opacity-65" : "opacity-0",
                ].join(" ")}
              />
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute -right-[2px] top-[8px] h-[13px] w-[3px] rounded-full blur-[2px]",
                  room.edgeHotspot,
                  isActive ? "opacity-50" : "opacity-0",
                ].join(" ")}
              />

              {/* Metallic top highlight — static. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute left-3 right-3 top-0 h-px",
                  isActive ? room.activeTopShine : room.idleTopShine,
                ].join(" ")}
              />

              {/* Crisp internal lower beam keeps the tile sharp beneath the bloom. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute bottom-0 left-[10%] right-[10%] h-px",
                  isActive ? room.activeBeam : room.idleBeam,
                ].join(" ")}
              />

              <span className="relative z-10 flex h-full items-center gap-[11px] px-[13px]">
                <span
                  aria-hidden="true"
                  className={[
                    "inline-flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border",
                    "transition-[border-color,background-color,box-shadow,color] duration-150",
                    isActive ? room.activeEmblem : room.idleEmblem,
                  ].join(" ")}
                >
                  <RoomGlyph railKey={item.key} fallback={item.icon} />
                </span>

                <span
                  className={[
                    "truncate text-left text-[13px] font-black uppercase leading-none tracking-[0.035em]",
                    "transition-colors duration-150",
                    isActive ? room.activeLabel : room.idleLabel,
                  ].join(" ")}
                >
                  {item.label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}