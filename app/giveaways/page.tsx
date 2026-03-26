import Link from "next/link"
import Image from "next/image"
import { Clock, ArrowRight } from "lucide-react"
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

// Emergency fallback data - only shown if snapshot query returns no results
const emergencyGiveaways = [
  {
    slug: 'superholiday',
    title: 'Super Holiday',
    prize_title: 'Enter now for your chance to win our live Super Holiday giveaway.',
    status: 'live',
    hero_image_url: null,
    ends_at: null,
  },
]

export default async function GiveawaysPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('giveaway_snapshots')
    .select('payload')
    .eq('kind', 'list')
    .order('generated_at', { ascending: false })
    .limit(12)

  const giveaways = (data ?? [])
    .map((x: any) => x.payload)
    .filter((g: any) => g?.status === 'live')

  // Use emergency fallback only if no live giveaways from snapshots
  const displayGiveaways = giveaways.length > 0 ? giveaways : emergencyGiveaways

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8">
        <div>
          <h2 className="text-balance text-2xl font-bold tracking-tight text-white md:text-3xl">All Giveaways</h2>
          <p className="mt-1 text-pretty bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">Browse all active giveaways and enter to win</p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayGiveaways.map((giveaway: any) => {
            const timeLeft = formatTimeLeft(giveaway.ends_at)

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

                {/* Fallback: Show badge at top if no hero image */}
                {!giveaway.hero_image_url && (
                  <div className="flex items-center justify-between p-4 pb-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                      Live
                    </span>
                    {timeLeft && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
                        <Clock className="h-3 w-3" />
                        {timeLeft}
                      </span>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold text-white line-clamp-2 group-hover:text-amber-400 transition-colors">
                    {giveaway.title}
                  </h3>
                  {giveaway.prize_title && (
                    <p className="mt-1 text-sm text-white/60 line-clamp-2">{giveaway.prize_title}</p>
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
          })}
        </div>
      </div>
    </div>
  )
}
