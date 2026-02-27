import { Button } from "@/components/ui/button"
import { TrustBadges } from "@/components/trust-badges"
import { GiveawayCard } from "@/components/giveaway-card"
import { WinnerCard } from "@/components/winner-card"
import { SectionHeader } from "@/components/section-header"
import { mockWinners } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import type { GiveawayPublic, WinnerSnapshot } from "@/lib/types"

export default async function HomePage() {
  const supabase = await createClient()

  let giveaways: GiveawayPublic[] = []
  try {
    const { data, error } = await supabase
      .from('giveaway_snapshots')
      .select('payload')
      .eq('kind', 'list')
      .order('generated_at', { ascending: false })
      .limit(3)

    if (!error && data && data.length > 0) {
      giveaways = data.map((row) => {
        const p = row.payload as Record<string, any>
        return {
          slug: p.slug || 'unknown',
          title: p.title || 'Untitled',
          prizeTitle: p.prize_title || p.title || 'Prize',
          imageUrl: p.hero_image_url || '/placeholder.svg',
          ticketPrice: (p.base_ticket_price_pence ?? 0) / 100,
          endsAt: new Date(p.ends_at),
          status: p.status,
          prizeValue: p.prize_value_text || undefined,
          bundles: p.bundles || undefined,
          rulesText: 'See full terms and conditions for complete rules.',
        }
      })
    }
  } catch (err) {
    console.error('[homepage] Failed to fetch snapshots:', err)
  }

  // Fetch recent winners from live view
  let recentWinners: WinnerSnapshot[] = []
  try {
    const { data: winData, error: winErr } = await supabase
      .from('winners_feed')
      .select('*')
      .order('happened_at', { ascending: false })
      .limit(9)

    if (!winErr && winData && winData.length > 0) {
      recentWinners = winData.map((row: any) => ({
        name: row.display_name || 'Winner',
        avatarUrl: undefined,
        prizeTitle: row.prize_title || 'Prize',
        giveawayTitle: row.campaign_title || '',
        giveawaySlug: row.campaign_slug || undefined,
        announcedAt: row.happened_at || new Date().toISOString(),
        kind: (row.kind === 'main' ? 'main' : 'instant') as 'main' | 'instant',
      }))
    }
  } catch (err) {
    console.error('[homepage] Failed to fetch winners_feed:', err)
  }

  if (recentWinners.length === 0) {
    recentWinners = mockWinners
  }

  return (
    <>
      {/* Hero Section - Full screen, full width */}
      <section className="relative w-full h-screen overflow-hidden">
        {/* Mobile hero image */}
        <div className="absolute inset-0 z-0 md:hidden">
          <Image
            src="/images/pre-register-hero-mobile.png"
            alt="WTF Giveaways"
            className="object-cover"
            fill
            priority
            quality={85}
            sizes="100vw"
          />
        </div>
        {/* Desktop hero image */}
        <div className="absolute inset-0 z-0 hidden md:block">
          <Image
            src="/images/pre-register-hero-desktop.png"
            alt="WTF Giveaways"
            className="object-cover"
            fill
            priority
            quality={85}
            sizes="100vw"
          />
        </div>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 z-[1] bg-black/50" aria-hidden="true" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center h-full px-6">
          <h1 className="text-balance text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl">Win Amazing Prizes</h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-white/80 md:text-xl">
            {"Enter the best giveaways and join everyone who\u2019s winning real cash prizes!"}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5B21B6] hover:shadow-lg" asChild>
              <Link href="/giveaways">Browse Giveaways</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-xl border-white/30 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10" asChild>
              <Link href="/winners">See Winners</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">Verified Winners</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">Secure Payments</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">UK Based</span>
          </div>
          <TrustBadges />
        </div>
      </section>

    <div className="container px-4 py-8 md:py-16">
      {/* Featured Giveaways */}
      <section className="mb-16">
        <SectionHeader
          title="Featured Giveaways"
          subtitle="Enter now for your chance to win"
          action={
            <Button variant="ghost" asChild>
              <Link href="/giveaways">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {giveaways.length > 0 ? (
            giveaways.map((giveaway) => (
              <GiveawayCard key={giveaway.slug} giveaway={giveaway} />
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No live giveaways yet. Check back soon.
            </div>
          )}
        </div>
      </section>

      {/* Recent Winners */}
      <section>
        <SectionHeader
          title="Recent Winners"
          subtitle="Real people winning real prizes"
          action={
            <Button variant="ghost" asChild>
              <Link href="/winners">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentWinners.map((winner, i) => (
            <WinnerCard key={i} winner={winner} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button size="lg" variant="outline" className="rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5" asChild>
            <Link href="/winners">View all winners</Link>
          </Button>
        </div>
      </section>
    </div>
    </>
  )
}
