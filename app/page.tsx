import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LiveNowTakeover } from "@/components/live/LiveNowTakeover"
import { HomeRails, type RailView } from "@/components/home/HomeRails"
import { loadHomepageRails } from "@/lib/admin/homepage-merchandising"
import { HOMEPAGE_RAILS, RAIL_LABELS } from "@/lib/admin/homepage-rails"
import { classifyGiveaway, sortGiveaways } from "@/lib/giveaway-classification"

// Emergency fallback data - used only if there are no eligible competitions.
const emergencyFeaturedGiveaway = {
  title: "Super Holiday",
  subtitle: "Enter now for your chance to win our live Super Holiday giveaway.",
  status: "Live now",
  ctaHref: "/giveaways/superholiday",
  ctaLabel: "Enter Now",
}

export default async function HomePage() {
  // Exactly TWO Supabase queries (list snapshots + placements), then in-memory
  // grouping/ordering via the shared builder. No query-per-category, no N+1,
  // no client-side Supabase.
  const { rails, eligiblePayloads } = await loadHomepageRails()

  // Build only NON-EMPTY rails, in canonical rail order. Each payload's badge
  // category comes from the shared classifier so the card matches the product.
  const railViews: RailView[] = HOMEPAGE_RAILS.map((rail) => ({
    key: rail,
    label: RAIL_LABELS[rail],
    items: rails[rail].map((e) => ({
      giveaway: e.payload,
      category: classifyGiveaway(e.payload),
    })),
  })).filter((v) => v.items.length > 0)

  // Fail-safe: if merchandising produced no rails but there ARE eligible live
  // competitions (e.g. everything classifies as "other" with no manual
  // placement yet), show a single safety rail built from the already-fetched
  // eligible payloads — no extra query. Only when nothing is eligible at all do
  // we fall back to the static emergency card below.
  if (railViews.length === 0 && eligiblePayloads.length > 0) {
    railViews.push({
      key: "all",
      label: "Live Giveaways",
      items: sortGiveaways(eligiblePayloads).map((p) => ({
        giveaway: p,
        category: classifyGiveaway(p),
      })),
    })
  }

  const hasAny = railViews.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8 md:py-16">
        {/* LIVE NOW site takeover — renders only when a takeover is enabled. */}
        <LiveNowTakeover />

        {/* Accessible page title without disrupting the visual hierarchy. */}
        <h1 className="sr-only">Win with WTF Giveaways</h1>

        {hasAny ? (
          <HomeRails rails={railViews} />
        ) : (
          // Emergency fallback - single static card when nothing is eligible.
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
        )}
      </div>
    </div>
  )
}
