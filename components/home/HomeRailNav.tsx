"use client"

import { useEffect, useRef, useState } from "react"
import { RailIcon } from "@/components/home/rail-icons"
import type { RailIconKey } from "@/lib/admin/homepage-rails"

export interface HomeNavItem {
  key: string
  label: string
  icon: RailIconKey
  /** Kept for caller compatibility. Visual styling is owned by this component. */
  activeClass: string
  /** Kept for caller compatibility. Visual styling is owned by this component. */
  idleClass: string
}

interface RoomStyle {
  width: string
  activeBorder: string
  idleBorder: string
  activeSurface: string
  idleSurface: string
  activeLabel: string
  idleLabel: string
  activeEmblem: string
  idleEmblem: string

  /** Large, soft colour bloom behind the whole tile. */
  bloom: string
  /** Bright top flare - intentionally hotter / whiter than the base accent. */
  topFlare: string
  /** Bright bottom flare / reflected light. */
  bottomFlare: string
  /** Soft light reflected beneath the active tile. */
  reflection: string
  /** Fine internal metallic highlight. */
  innerHighlight: string
}

const ROOM_STYLES: Record<string, RoomStyle> = {
  featured: {
    width: "w-[150px]",
    activeBorder: "border-[#FFD24D]",
    idleBorder: "border-[#76520E]",
    activeSurface:
      "bg-[linear-gradient(145deg,#271900_0%,#120A00_48%,#070008_100%)]",
    idleSurface:
      "bg-[linear-gradient(145deg,#150D01_0%,#0B0600_50%,#070008_100%)]",
    activeLabel: "text-[#FFF0B2]",
    idleLabel: "text-[#C9A45A]",
    activeEmblem:
      "border-[#EFC13A] bg-[radial-gradient(circle_at_35%_28%,#694700_0%,#281800_55%,#0B0600_100%)] text-[#FFE06A] shadow-[inset_0_1px_0_rgba(255,250,218,0.30),0_0_10px_rgba(255,188,0,0.26)]",
    idleEmblem:
      "border-[#76520E] bg-[#110A00] text-[#A77A20]",
    bloom:
      "bg-[radial-gradient(ellipse_at_center,rgba(255,212,72,0.72)_0%,rgba(255,175,0,0.34)_34%,rgba(255,122,0,0.12)_58%,transparent_76%)]",
    topFlare:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,181,0,0.08)_20%,#FFE36B_43%,#FFF7D6_50%,#FFE36B_57%,rgba(255,181,0,0.08)_80%,transparent_100%)]",
    bottomFlare:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,157,0,0.10)_18%,#FFCB32_41%,#FFF2A6_50%,#FFCB32_59%,rgba(255,157,0,0.10)_82%,transparent_100%)]",
    reflection:
      "bg-[radial-gradient(ellipse_at_center,rgba(255,191,0,0.42)_0%,rgba(255,158,0,0.18)_36%,transparent_70%)]",
    innerHighlight:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,234,168,0.10)_18%,rgba(255,250,222,0.28)_50%,rgba(255,234,168,0.10)_82%,transparent_100%)]",
  },

  balloon_pop: {
    width: "w-[166px]",
    activeBorder: "border-[#FF4FC4]",
    idleBorder: "border-[#6C2256]",
    activeSurface:
      "bg-[linear-gradient(145deg,#2A001C_0%,#14000D_48%,#070008_100%)]",
    idleSurface:
      "bg-[linear-gradient(145deg,#17000F_0%,#0C0008_50%,#070008_100%)]",
    activeLabel: "text-[#FFC1E9]",
    idleLabel: "text-[#C980B0]",
    activeEmblem:
      "border-[#F149BA] bg-[radial-gradient(circle_at_35%_28%,#64104B_0%,#29001C_55%,#0C0008_100%)] text-[#FF79D3] shadow-[inset_0_1px_0_rgba(255,221,242,0.24),0_0_10px_rgba(255,61,187,0.24)]",
    idleEmblem:
      "border-[#6C2256] bg-[#110009] text-[#A84C88]",
    bloom:
      "bg-[radial-gradient(ellipse_at_center,rgba(255,88,205,0.68)_0%,rgba(255,33,177,0.30)_34%,rgba(180,0,116,0.11)_58%,transparent_76%)]",
    topFlare:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,46,187,0.08)_20%,#FF75D5_43%,#FFE2F5_50%,#FF75D5_57%,rgba(255,46,187,0.08)_80%,transparent_100%)]",
    bottomFlare:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,31,175,0.10)_18%,#FF4EC5_41%,#FFC7E9_50%,#FF4EC5_59%,rgba(255,31,175,0.10)_82%,transparent_100%)]",
    reflection:
      "bg-[radial-gradient(ellipse_at_center,rgba(255,48,186,0.38)_0%,rgba(210,0,137,0.16)_36%,transparent_70%)]",
    innerHighlight:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(255,174,226,0.08)_18%,rgba(255,226,246,0.24)_50%,rgba(255,174,226,0.08)_82%,transparent_100%)]",
  },

  instant_cash: {
    width: "w-[190px]",
    activeBorder: "border-[#33DBFF]",
    idleBorder: "border-[#15566E]",
    activeSurface:
      "bg-[linear-gradient(145deg,#001D26_0%,#000E14_48%,#070008_100%)]",
    idleSurface:
      "bg-[linear-gradient(145deg,#001118_0%,#00090D_50%,#070008_100%)]",
    activeLabel: "text-[#B9F5FF]",
    idleLabel: "text-[#7CB4C0]",
    activeEmblem:
      "border-[#2BCBE9] bg-[radial-gradient(circle_at_35%_28%,#074755_0%,#001C25_55%,#00090D_100%)] text-[#6EEBFF] shadow-[inset_0_1px_0_rgba(217,251,255,0.24),0_0_10px_rgba(32,207,243,0.22)]",
    idleEmblem:
      "border-[#15566E] bg-[#000C11] text-[#4196AA]",
    bloom:
      "bg-[radial-gradient(ellipse_at_center,rgba(73,228,255,0.64)_0%,rgba(0,196,238,0.28)_34%,rgba(0,124,164,0.10)_58%,transparent_76%)]",
    topFlare:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(32,207,243,0.08)_20%,#6EEBFF_43%,#E6FCFF_50%,#6EEBFF_57%,rgba(32,207,243,0.08)_80%,transparent_100%)]",
    bottomFlare:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(20,195,232,0.10)_18%,#38DFFF_41%,#C6F8FF_50%,#38DFFF_59%,rgba(20,195,232,0.10)_82%,transparent_100%)]",
    reflection:
      "bg-[radial-gradient(ellipse_at_center,rgba(24,211,250,0.34)_0%,rgba(0,151,196,0.14)_36%,transparent_70%)]",
    innerHighlight:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(151,238,255,0.08)_18%,rgba(222,251,255,0.22)_50%,rgba(151,238,255,0.08)_82%,transparent_100%)]",
  },

  games: {
    width: "w-[150px]",
    activeBorder: "border-violet-400",
    idleBorder: "border-violet-900",
    activeSurface:
      "bg-[linear-gradient(145deg,#19062C_0%,#0D0316_48%,#070008_100%)]",
    idleSurface: "bg-[#0C0312]",
    activeLabel: "text-violet-100",
    idleLabel: "text-violet-300/60",
    activeEmblem:
      "border-violet-400 bg-violet-950/80 text-violet-200",
    idleEmblem:
      "border-violet-900 bg-[#0C0312] text-violet-400/60",
    bloom:
      "bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.56)_0%,rgba(124,58,237,0.22)_36%,transparent_74%)]",
    topFlare:
      "bg-[linear-gradient(90deg,transparent_0%,#A78BFA_43%,#EDE9FE_50%,#A78BFA_57%,transparent_100%)]",
    bottomFlare:
      "bg-[linear-gradient(90deg,transparent_0%,#8B5CF6_43%,#DDD6FE_50%,#8B5CF6_57%,transparent_100%)]",
    reflection:
      "bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.30)_0%,transparent_70%)]",
    innerHighlight:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(221,214,254,0.20)_50%,transparent_100%)]",
  },

  cash: {
    width: "w-[145px]",
    activeBorder: "border-emerald-400",
    idleBorder: "border-emerald-900",
    activeSurface:
      "bg-[linear-gradient(145deg,#042216_0%,#03110B_48%,#070008_100%)]",
    idleSurface: "bg-[#03100A]",
    activeLabel: "text-emerald-100",
    idleLabel: "text-emerald-300/60",
    activeEmblem:
      "border-emerald-400 bg-emerald-950/80 text-emerald-200",
    idleEmblem:
      "border-emerald-900 bg-[#03100A] text-emerald-400/60",
    bloom:
      "bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.50)_0%,rgba(16,185,129,0.20)_36%,transparent_74%)]",
    topFlare:
      "bg-[linear-gradient(90deg,transparent_0%,#6EE7B7_43%,#D1FAE5_50%,#6EE7B7_57%,transparent_100%)]",
    bottomFlare:
      "bg-[linear-gradient(90deg,transparent_0%,#34D399_43%,#A7F3D0_50%,#34D399_57%,transparent_100%)]",
    reflection:
      "bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.28)_0%,transparent_70%)]",
    innerHighlight:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(209,250,229,0.18)_50%,transparent_100%)]",
  },

  luxury: {
    width: "w-[170px]",
    activeBorder: "border-[#33DBFF]",
    idleBorder: "border-[#15566E]",
    activeSurface:
      "bg-[linear-gradient(145deg,#001D26_0%,#000E14_48%,#070008_100%)]",
    idleSurface:
      "bg-[linear-gradient(145deg,#001118_0%,#00090D_50%,#070008_100%)]",
    activeLabel: "text-[#B9F5FF]",
    idleLabel: "text-[#7CB4C0]",
    activeEmblem:
      "border-[#2BCBE9] bg-[#001C25] text-[#6EEBFF]",
    idleEmblem:
      "border-[#15566E] bg-[#000C11] text-[#4196AA]",
    bloom:
      "bg-[radial-gradient(ellipse_at_center,rgba(73,228,255,0.64)_0%,rgba(0,196,238,0.28)_34%,rgba(0,124,164,0.10)_58%,transparent_76%)]",
    topFlare:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(32,207,243,0.08)_20%,#6EEBFF_43%,#E6FCFF_50%,#6EEBFF_57%,rgba(32,207,243,0.08)_80%,transparent_100%)]",
    bottomFlare:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(20,195,232,0.10)_18%,#38DFFF_41%,#C6F8FF_50%,#38DFFF_59%,rgba(20,195,232,0.10)_82%,transparent_100%)]",
    reflection:
      "bg-[radial-gradient(ellipse_at_center,rgba(24,211,250,0.34)_0%,rgba(0,151,196,0.14)_36%,transparent_70%)]",
    innerHighlight:
      "bg-[linear-gradient(90deg,transparent_0%,rgba(151,238,255,0.08)_18%,rgba(222,251,255,0.22)_50%,rgba(151,238,255,0.08)_82%,transparent_100%)]",
  },
}

function JackpotGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 8.2 7.2 11 12 5.4l4.8 5.6L20 8.2l-1.35 8.15H5.35L4 8.2Z"
        fill="currentColor"
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
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
    return <JackpotGlyph className="h-[22px] w-[22px]" />
  }

  if (railKey === "balloon_pop") {
    return <BalloonGlyph className="h-[22px] w-[22px]" />
  }

  if (railKey === "instant_cash" || railKey === "luxury") {
    return <DiamondGlyph className="h-[22px] w-[22px]" />
  }

  return <RailIcon name={fallback} className="h-[20px] w-[20px]" />
}

/**
 * Sticky, horizontally-scrollable casino-lobby category navigation.
 *
 * FUNCTIONAL BEHAVIOUR IS UNCHANGED:
 * - no scroll listeners
 * - exactly one IntersectionObserver
 * - active state is one string
 * - native horizontal scrolling
 * - native smooth scroll to section
 *
 * VISUAL ARCHITECTURE:
 * Each room is now WRAPPER -> BLOOM/FLARES/REFLECTION -> BUTTON.
 * The bloom is not hidden behind the button background and is given enough
 * vertical padding inside the scrollport to avoid being clipped.
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
      className="sticky top-16 z-40 -mx-4 mb-6 border-y border-white/[0.06] bg-[#040006]/[0.985] shadow-[0_12px_34px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.025),inset_0_-1px_0_rgba(255,196,37,0.06)] backdrop-blur-md md:mb-8"
    >
      <div
        ref={navRef}
        className="flex h-[94px] items-center gap-[10px] overflow-x-auto px-5 py-[14px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = item.key === active
          const room = ROOM_STYLES[item.key] ?? ROOM_STYLES.featured

          return (
            <div
              key={item.key}
              className={[
                "relative h-[66px] shrink-0",
                room.width,
              ].join(" ")}
            >
              {/* 1) SOFT EXTERNAL BLOOM
                  Sibling of the button, never trapped behind its surface. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute -inset-x-[6px] -inset-y-[5px] rounded-[18px] blur-[12px]",
                  "transition-opacity duration-150",
                  room.bloom,
                  isActive ? "opacity-75" : "opacity-[0.14]",
                ].join(" ")}
              />

              {/* 2) REFLECTED LIGHT UNDER THE TILE
                  Adds the 'light hitting the floor' effect from the reference. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute -bottom-[8px] left-[13%] right-[13%] h-[14px] blur-[8px]",
                  room.reflection,
                  isActive ? "opacity-80" : "opacity-10",
                ].join(" ")}
              />

              {/* 3) WHITE-HOT TOP FLARE
                  A small bright section of tubing, not a uniform neon outline. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute left-[13%] right-[13%] top-[2px] z-20 h-[2px] rounded-full blur-[0.6px]",
                  room.topFlare,
                  isActive ? "opacity-100" : "opacity-20",
                ].join(" ")}
              />

              {/* Small bright focus point along the top edge. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute left-[48%] top-[1px] z-20 h-[5px] w-[18px] -translate-x-1/2 rounded-full blur-[3px]",
                  room.topFlare,
                  isActive ? "opacity-90" : "opacity-0",
                ].join(" ")}
              />

              {/* 4) WHITE-HOT LOWER FLARE */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute bottom-[4px] left-[10%] right-[10%] z-20 h-[2px] rounded-full blur-[0.7px]",
                  room.bottomFlare,
                  isActive ? "opacity-100" : "opacity-18",
                ].join(" ")}
              />

              {/* Bottom glow node makes the highlight look irregular/electrical. */}
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none absolute bottom-[1px] left-[48%] z-20 h-[7px] w-[28px] -translate-x-1/2 rounded-full blur-[5px]",
                  room.bottomFlare,
                  isActive ? "opacity-80" : "opacity-0",
                ].join(" ")}
              />

              {/* BUTTON: crisp glass tile remains above all bloom layers. */}
              <button
                ref={(element) => {
                  chipRefs.current[item.key] = element
                }}
                type="button"
                aria-current={isActive ? "true" : undefined}
                onClick={() => go(item.key)}
                className={[
                  "absolute inset-x-0 top-[3px] z-10 h-[60px] overflow-hidden rounded-[12px] border",
                  "transition-[border-color,background-color,box-shadow,color] duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                  "focus-visible:ring-offset-2 focus-visible:ring-offset-[#040006]",
                  isActive ? room.activeBorder : room.idleBorder,
                  isActive ? room.activeSurface : room.idleSurface,
                  isActive
                    ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055),inset_0_1px_0_rgba(255,255,255,0.16),0_0_3px_rgba(255,255,255,0.07)]"
                    : "shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
                ].join(" ")}
              >
                {/* Very fine internal metallic highlight. */}
                <span
                  aria-hidden="true"
                  className={[
                    "pointer-events-none absolute left-[8%] right-[8%] top-0 h-px",
                    room.innerHighlight,
                    isActive ? "opacity-100" : "opacity-25",
                  ].join(" ")}
                />

                {/* Tiny illuminated left/right edge segments - deliberately not
                    full-height so the rim feels like lit tubing. */}
                <span
                  aria-hidden="true"
                  className={[
                    "pointer-events-none absolute -left-px top-[14px] h-[22px] w-[2px] rounded-full",
                    room.topFlare,
                    isActive ? "opacity-80" : "opacity-15",
                  ].join(" ")}
                />
                <span
                  aria-hidden="true"
                  className={[
                    "pointer-events-none absolute -right-px bottom-[10px] h-[16px] w-[2px] rounded-full",
                    room.bottomFlare,
                    isActive ? "opacity-65" : "opacity-10",
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
            </div>
          )
        })}
      </div>
    </nav>
  )
}