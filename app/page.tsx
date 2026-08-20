import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LiveNowTakeover } from "@/components/live/LiveNowTakeover"
import { HomeRailNav, type HomeNavItem } from "@/components/home/HomeRailNav"
import { RailScroller } from "@/components/home/RailScroller"
import { PublicGiveawayCard } from "@/components/public-giveaway-card"
import { loadHomepageRails } from "@/lib/admin/homepage-merchandising"
import { HOMEPAGE_RAILS, RAIL_PRESENTATION } from "@/lib/admin/homepage-rails"
import { classifyGiveaway, sortGiveaways, type GiveawayCategory } from "@/lib/giveaway-classification"

// Emergency fallback data - used only if there are no eligible competitions.
const emergencyFeaturedGiveaway = {
  title: "Super Holiday",
  subtitle: "Enter now for your chance to win our live Super Holiday giveaway.",
  status: "Live now",
  ctaHref: "/giveaways/superholiday",
  ctaLabel: "Enter Now",
}

interface RailSection {
  key: string
  navLabel: string
  heading: string
  tagline: string
  items: { giveaway: any; category: GiveawayCategory }[]
}

export default async function HomePage() {
  // Exactly TWO Supabase queries (list snapshots + placements), then in-memory
  // grouping/ordering via the shared builder. No query-per-category, no N+1,
  // no client-side Supabase.
  const { rails, eligiblePayloads } = await loadHomepageRails()

  // Build only NON-EMPTY rails, in canonical rail order, each carrying its
  // customer-facing presentation copy. Each payload's badge category comes from
  // the shared classifier so the card matches the product.
  const sections: RailSection[] = HOMEPAGE_RAILS.map((rail) => {
    const pres = RAIL_PRESENTATION[rail]
    return {
      key: rail,
      navLabel: pres.navLabel,
      heading: pres.heading,
      tagline: pres.tagline,
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
      navLabel: "Live",
      heading: "LIVE GIVEAWAYS",
      tagline: "Every competition open right now.",
      items: sortGiveaways(eligiblePayloads).map((p) => ({
        giveaway: p,
        category: classifyGiveaway(p),
      })),
    })
  }

  const hasAny = sections.length > 0
  const navItems: HomeNavItem[] = sections.map((s) => ({ key: s.key, label: s.navLabel }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      {/* LIVE NOW site takeover — renders only when a takeover is enabled. */}
      <div className="container px-4 pt-8 md:pt-16">
        <LiveNowTakeover />
        {/* Accessible page title without disrupting the visual hierarchy. */}
        <h1 className="sr-only">Win with WTF Giveaways</h1>
      </div>

      {hasAny ? (
        // Nav + sections share ONE container so the sticky nav stays pinned
        // while the reader travels through every section (a sticky element only
        // sticks within its own parent's box).
        <div className="container px-4 pb-16">
          {/* Sticky scroll-spy category nav (client, tiny). */}
          <HomeRailNav items={navItems} />

          <div className="space-y-12 md:space-y-16">
            {sections.map((section) => (
              <section
                key={section.key}
                id={`home-rail-${section.key}`}
                data-home-rail-section
                data-rail-key={section.key}
                aria-label={section.heading}
                // Offset for the sticky header (64px) + sticky nav so smooth
                // scroll / anchor jumps land below the chrome, not under it.
                className="scroll-mt-32"
              >
                <header className="mb-4 md:mb-5">
                  <h2 className="text-balance text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                    {section.heading}
                  </h2>
                  <p className="mt-1 text-pretty text-sm text-white/60 md:text-base">{section.tagline}</p>
                </header>

                {/* Cards are SERVER-rendered here and passed into the client
                    RailScroller as children — giveaway payloads stay server-side. */}
                <RailScroller label={section.heading}>
                  {section.items.map((item) => (
                    <div
                      key={`${section.key}:${item.giveaway.slug ?? item.giveaway.id}`}
                      className="w-[85%] shrink-0 snap-start sm:w-[60%] md:w-[46%] lg:w-[31%] xl:w-[23%]"
                    >
                      <PublicGiveawayCard giveaway={item.giveaway} category={item.category} />
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
