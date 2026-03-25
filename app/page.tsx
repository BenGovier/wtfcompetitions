import { Button } from "@/components/ui/button"
import { TrustBadges } from "@/components/trust-badges"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

// Emergency fallback data - used if snapshot query fails
const emergencyFeaturedGiveaway = {
  title: 'Super Holiday',
  subtitle: 'Enter now for your chance to win our live Super Holiday giveaway.',
  status: 'Live now',
  ctaHref: '/giveaways/superholiday',
  ctaLabel: 'Enter Now',
}

export default async function HomePage() {
  // Fetch giveaway snapshots from Supabase
  const supabase = await createClient()

  const { data } = await supabase
    .from('giveaway_snapshots')
    .select('payload')
    .eq('kind', 'list')
    .order('generated_at', { ascending: false })
    .limit(6)

  const giveaways = (data ?? [])
    .map((x: any) => x.payload)
    .filter((g: any) => g?.status === 'live')

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
            <Button size="lg" variant="outline" className="rounded-xl border-white/30 bg-white text-base font-semibold text-[#6D28D9] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90" asChild>
              <Link href="/winners">See Winners</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 py-4 [&_span]:text-white [&_svg]:text-white">
            <TrustBadges />
          </div>
        </div>
      </section>

    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8 md:py-16">
      {/* Featured Giveaways */}
      <section className="mb-16">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-balance text-2xl font-bold tracking-tight text-white md:text-3xl">Featured Giveaways</h2>
              <p className="mt-1 text-pretty bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">Enter now for your chance to win</p>
            </div>
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10" asChild>
              <Link href="/giveaways">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Giveaway cards */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {giveaways.length > 0 ? (
            giveaways.map((giveaway: any) => (
              <div
                key={giveaway.slug}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <span className="inline-flex items-center rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-400">
                    {giveaway.status === 'live' ? 'Live now' : giveaway.status}
                  </span>
                  <h3 className="text-xl font-bold text-white">{giveaway.title}</h3>
                  <p className="text-white/70 text-sm">{giveaway.prize_title}</p>
                  <Button size="sm" className="mt-2 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-semibold shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg" asChild>
                    <Link href={`/giveaways/${giveaway.slug}`}>Enter Now</Link>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            // Emergency fallback - single static card
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 md:p-8 sm:col-span-2 lg:col-span-3">
              <div className="flex flex-col items-center text-center gap-4">
                <span className="inline-flex items-center rounded-full bg-green-500/20 px-3 py-1 text-sm font-medium text-green-400">
                  {emergencyFeaturedGiveaway.status}
                </span>
                <h3 className="text-2xl font-bold text-white md:text-3xl">{emergencyFeaturedGiveaway.title}</h3>
                <p className="text-white/70 max-w-md">{emergencyFeaturedGiveaway.subtitle}</p>
                <Button size="lg" className="mt-4 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-semibold shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg" asChild>
                  <Link href={emergencyFeaturedGiveaway.ctaHref}>{emergencyFeaturedGiveaway.ctaLabel}</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
    </>
  )
}
