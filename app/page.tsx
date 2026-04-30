import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Clock } from "lucide-react"
import { createClient } from "@/lib/supabase/server"

// Helper to format countdown from ends_at
function formatTimeLeft(endsAt: string | null | undefined): string | null {
  if (!endsAt) return null
  const now = new Date()
  const end = new Date(endsAt)
  const diff = end.getTime() - now.getTime()
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d ${hours}h left`
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

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
      {/* Hero Section - Full width banner */}
      <section className="relative w-full">
        <Link href="/giveaways" className="block w-full">
          <Image
            src="/images/hero-banner.png"
            alt="Win Cash Daily - Play Now for Instant Wins"
            width={1792}
            height={1024}
            className="w-full h-auto"
            priority
            sizes="100vw"
          />
        </Link>
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
            giveaways.map((giveaway: any) => {
              const timeLeft = formatTimeLeft(giveaway.ends_at)
              const sold = Number(giveaway.tickets_sold ?? 0)
              const cap = Number(giveaway.hard_cap_total_tickets ?? 0)
              const percentSold = cap > 0 ? Math.min(100, Math.floor((sold / cap) * 100)) : null

              return (
                <Link
                  key={giveaway.slug}
                  href={`/giveaways/${giveaway.slug}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1"
                >
                  {/* Hero image */}
                  {giveaway.hero_image_url && (
                    <div className="relative aspect-[16/10] w-full overflow-hidden">
                      <Image
                        src={giveaway.hero_image_url}
                        alt={giveaway.title || 'Giveaway'}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      {/* Live badge overlay */}
                      <div className="absolute left-3 top-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                          Live
                        </span>
                      </div>
                      {/* Time left badge */}
                      {timeLeft && (
                        <div className="absolute right-3 top-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                            <Clock className="h-3 w-3" />
                            {timeLeft}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-bold text-white line-clamp-2 group-hover:text-amber-400 transition-colors">
                      {giveaway.title}
                    </h3>
                    {giveaway.prize_title && (
                      <p className="mt-1 text-sm text-white/60 line-clamp-1">{giveaway.prize_title}</p>
                    )}

                    {/* Presentation type - prominent treatment */}
                    {giveaway.presentation_type === 'balloon_pop' && (
                      <div className="mt-3 rounded-xl bg-gradient-to-r from-pink-500/20 to-fuchsia-500/20 border border-pink-400/30 p-3">
                        <div className="text-base font-black uppercase tracking-wide text-pink-300">
                          TIKTOK & FACEBOOK LIVE
                        </div>
                        <div className="text-lg font-bold text-white">
                          Balloon Pop Event
                        </div>
                        <p className="mt-1 text-xs text-pink-300/80">Watch live - Pop balloons - Win cash</p>
                      </div>
                    )}
                    {giveaway.presentation_type === 'instant_cash' && (
                      <div className="mt-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 p-3">
                        <div className="text-base font-black uppercase tracking-wide text-emerald-300">
                          WIN NOW
                        </div>
                        <div className="text-lg font-bold text-white">
                          Instant Cash Wins
                        </div>
                        <p className="mt-1 text-xs text-emerald-300/80">Buy tickets - Reveal instantly</p>
                      </div>
                    )}

                    {/* Progress bar - percentage only */}
                    {percentSold !== null && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-amber-400">{percentSold}% sold</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300"
                            style={{ width: `${percentSold}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Enter button */}
                    <div className="mt-auto pt-4">
                      <div className="rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] p-[1px]">
                        <div className="flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-4 py-2.5 text-sm font-bold text-black transition-all group-hover:shadow-lg">
                          Enter Now
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })
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
