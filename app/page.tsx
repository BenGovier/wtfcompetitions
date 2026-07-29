import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { LiveNowTakeover } from "@/components/live/LiveNowTakeover"
import { GiveawaySection } from "@/components/giveaway-section"
import { groupGiveawaysByCategory } from "@/lib/giveaway-classification"

// Homepage card counts — keep the page focused. The section "View all" links
// provide access to the remainder on /giveaways.
const MAX_LIVE_CARDS = 4
const MAX_INSTANT_CARDS = 6
const MAX_OTHER_CARDS = 3

// Emergency fallback data - used only if the snapshot query returns nothing.
const emergencyFeaturedGiveaway = {
  title: "Super Holiday",
  subtitle: "Enter now for your chance to win our live Super Holiday giveaway.",
  status: "Live now",
  ctaHref: "/giveaways/superholiday",
  ctaLabel: "Enter Now",
}

export default async function HomePage() {
  // Fetch giveaway snapshots from Supabase — ONE bounded query for the whole page.
  const supabase = await createClient()

  const { data } = await supabase
    .from("giveaway_snapshots")
    .select("payload")
    .eq("kind", "list")
    .eq("payload->>status", "live")
    .order("generated_at", { ascending: false })
    .limit(20)

  const now = Date.now()
  const giveaways = (data ?? [])
    .map((x: any) => x.payload)
    .filter((g: any) => {
      // Exclude ended/sold_out/closed statuses
      if (!g || g.status === "ended" || g.status === "sold_out" || g.status === "closed") return false
      // Only include live raffles
      if (g.status !== "live") return false
      // Exclude if ends_at is in the past
      if (g.ends_at) {
        const endsAt = new Date(g.ends_at).getTime()
        if (Number.isFinite(endsAt) && endsAt <= now) return false
      }
      return true
    })

  // Classify + sort once, server-side, from the already-fetched array.
  const grouped = groupGiveawaysByCategory(giveaways)
  const liveGiveaways = grouped.live_balloon.slice(0, MAX_LIVE_CARDS)
  const instantGiveaways = grouped.instant_cash.slice(0, MAX_INSTANT_CARDS)
  const otherGiveaways = grouped.other.slice(0, MAX_OTHER_CARDS)

  const hasAny = liveGiveaways.length + instantGiveaways.length + otherGiveaways.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8 md:py-16">
        {/* LIVE NOW site takeover — renders only when a takeover is enabled. */}
        <LiveNowTakeover />

        {/* Accessible page title without disrupting the visual hierarchy. */}
        <h1 className="sr-only">Win with WTF Giveaways</h1>

        {hasAny ? (
          <>
            <GiveawaySection
              id="live-balloon-heading"
              title="TikTok Live Balloon Pops"
              supportingCopy="Enter now, then watch the balloons pop live with your host."
              giveaways={liveGiveaways}
              category="live_balloon"
              viewAllHref="/giveaways?category=live"
              viewAllLabel="View all Live"
            />

            <GiveawaySection
              id="instant-cash-heading"
              title="Instant Cash Wins"
              supportingCopy="Play any time and reveal instant cash prizes automatically."
              giveaways={instantGiveaways}
              category="instant_cash"
              viewAllHref="/giveaways?category=instant"
              viewAllLabel="View all Instant Cash"
            />

            <GiveawaySection
              id="more-giveaways-heading"
              title="More Giveaways"
              supportingCopy="More ways to play and win."
              giveaways={otherGiveaways}
              category="other"
              viewAllHref="/giveaways"
              viewAllLabel="View all"
            />
          </>
        ) : (
          // Emergency fallback - single static card when no live giveaways exist.
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
