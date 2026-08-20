import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { LiveNowTakeover } from "@/components/live/LiveNowTakeover"
import { HomeRailNav, type HomeNavItem } from "@/components/home/HomeRailNav"
import { RailScroller } from "@/components/home/RailScroller"
import { RailIcon } from "@/components/home/rail-icons"
import { PublicGiveawayCard } from "@/components/public-giveaway-card"
import { loadHomepageRails } from "@/lib/admin/homepage-merchandising"
import { HOMEPAGE_RAILS, RAIL_PRESENTATION, type RailIconKey } from "@/lib/admin/homepage-rails"
import { classifyGiveaway, sortGiveaways, type GiveawayCategory } from "@/lib/giveaway-classification"

// Emergency fallback data - used only if there are no eligible competitions.
const emergencyFeaturedGiveaway = {
  title: "Super Holiday",
  subtitle: "Enter now for your chance to win our live Super Holiday giveaway.",
  status: "Live now",
  ctaHref: "/giveaways/superholiday",
  ctaLabel: "Enter Now",
}

// Presentation defaults for the single safety rail (only used when merchandising
// produced no rails but eligible competitions exist). Amber/gold, links to the
// full catalogue — a real route, never an invented category URL.
const FALLBACK_PRESENTATION = {
  icon: "hot" as RailIconKey,
  navActiveClass: "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/50 shadow-[0_0_16px_rgba(251,191,36,0.35)]",
  accentText: "text-amber-300",
  sectionGlow: "bg-[radial-gradient(120%_80%_at_0%_0%,rgba(251,191,36,0.12),transparent_60%)]",
  viewAllHref: "/giveaways",
}

interface RailSection {
  key: string
  navLabel: string
  heading: string
  tagline: string
  icon: RailIconKey
  navActiveClass: string
  accentText: string
  sectionGlow: string
  viewAllHref: string
  items: { giveaway: any; category: GiveawayCategory }[]
}

export default async function HomePage() {
  // Exactly TWO Supabase queries (list snapshots + placements), then in-memory
  // grouping/ordering via the shared builder. No query-per-category, no N+1,
  // no client-side Supabase.
  const { rails, eligiblePayloads } = await loadHomepageRails()

  // Build only NON-EMPTY rails, in canonical rail order, each carrying its
  // customer-facing presentation copy + accent identity. Each payload's badge
  // category comes from the shared classifier so the card matches the product.
  const sections: RailSection[] = HOMEPAGE_RAILS.map((rail) => {
    const pres = RAIL_PRESENTATION[rail]
    return {
      key: rail,
      navLabel: pres.navLabel,
      heading: pres.heading,
      tagline: pres.tagline,
      icon: pres.icon,
      navActiveClass: pres.navActiveClass,
      accentText: pres.accentText,
      sectionGlow: pres.sectionGlow,
      viewAllHref: pres.viewAllHref,
      items: rails[rail].map((e) => ({
        giveaway: e.payload,
        category: classifyGiveaway(e.payload),
      })),
    }
  }).filter((v) => v.items.length > 0)

  // Fail-safe: if merchandising produced no rails but there ARE eligible live
  // competitions, show a single safety rail from the already-fetched payloads —
  // no extra query. Only when nothing is eligible at all do we fall back to the
  // static emergency card below.
  if (sections.length === 0 && eligiblePayloads.length > 0) {
    sections.push({
      key: "all",
      navLabel: "LIVE",
      heading: "LIVE GIVEAWAYS",
      tagline: "Every competition open right now.",
      ...FALLBACK_PRESENTATION,
      items: sortGiveaways(eligiblePayloads).map((p) => ({
        giveaway: p,
        category: classifyGiveaway(p),
      })),
    })
  }

  const hasAny = sections.length > 0
  const navItems: HomeNavItem[] = sections.map((s) => ({
    key: s.key,
    label: s.navLabel,
    icon: s.icon,
    activeClass: s.navActiveClass,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      {/* LIVE NOW site takeover — renders only when a takeover is enabled. Tight
          top padding keeps conversion content high on first load. */}
      <div className="container px-4 pt-4 md:pt-10">
        <LiveNowTakeover />
        {/* Accessible page title without disrupting the visual hierarchy. */}
        <h1 className="sr-only">Win with WTF Giveaways</h1>
      </div>

      {hasAny ? (
        // Nav + sections share ONE container so the sticky nav stays pinned
        // while the reader travels through every section (a sticky element only
        // sticks within its own parent's box).
        <div className="container px-4 pb-16">
          {/* Sticky scroll-spy casino lobby nav (client, tiny). */}
          <HomeRailNav items={navItems} />

          <div className="space-y-10 md:space-y-14">
            {sections.map((section, sectionIndex) => (
              <section
                key={section.key}
                id={`home-rail-${section.key}`}
                data-home-rail-section
                data-rail-key={section.key}
                aria-label={section.heading}
                // Offset for the sticky header (64px) + sticky nav so smooth
                // scroll / anchor jumps land below the chrome, not under it.
                className="relative scroll-mt-32 isolate"
              >
                {/* Very faint per-category radial atmosphere behind the header.
                    CSS-only, pointer-events-none, sits below content (-z-10). */}
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -inset-x-4 -top-4 -z-10 h-40 ${section.sectionGlow}`}
                />

                {/* Compact section header: icon + heading + View all on one row,
                    supporting line beneath, thin divider. ~72–84px tall. */}
                <header className="mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <RailIcon name={section.icon} className={`h-5 w-5 shrink-0 ${section.accentText}`} />
                      <h2 className="truncate text-lg font-extrabold uppercase tracking-tight text-white md:text-2xl">
                        {section.heading}
                      </h2>
                    </div>
                    <Link
                      href={section.viewAllHref}
                      prefetch={false}
                      className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0014]"
                    >
                      View all
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                  <p className="mt-0.5 text-pretty text-xs text-white/55 md:text-sm">{section.tagline}</p>
                  <div className="mt-2 h-px w-full bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
                </header>

                {/* Cards are SERVER-rendered here and passed into the client
                    RailScroller as children — giveaway payloads stay server-side. */}
                <RailScroller label={section.heading}>
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={`${section.key}:${item.giveaway.slug ?? item.giveaway.id}`}
                      className="w-[85%] shrink-0 snap-start sm:w-[60%] md:w-[46%] lg:w-[31%] xl:w-[23%]"
                    >
                      {/* Exactly ONE prioritised image on the whole homepage:
                          the first card of the FIRST rendered non-empty rail
                          (the LCP element). Every other card stays lazy. The
                          conversion-led compact layout is homepage-only. */}
                      <PublicGiveawayCard
                        giveaway={item.giveaway}
                        category={item.category}
                        compact
                        imagePriority={sectionIndex === 0 && itemIndex === 0}
                      />
                    </div>
                  ))}
                </RailScroller>
              </section>
            ))}
          </div>
        </div>
      ) : (
        // Emergency fallback - single static card when nothing is eligible.
        <div className="container px-4 pb-16">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="inline-flex items-center rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-400">
                {emergencyFeaturedGiveaway.status}
              </span>
              <h2 className="text-2xl font-bold text-white md:text-3xl">{emergencyFeaturedGiveaway.title}</h2>
              <p className="max-w-md text-white/70">{emergencyFeaturedGiveaway.subtitle}</p>
              <Button
                size="lg"
                className="mt-4 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] font-semibold text-black shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                asChild
              >
                <Link href={emergencyFeaturedGiveaway.ctaHref}>{emergencyFeaturedGiveaway.ctaLabel}</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
