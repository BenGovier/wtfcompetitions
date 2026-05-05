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
  // 24 hours or more: show days and hours
  if (days > 0) return `${days}d ${hours}h left`
  // Under 24 hours: show hours, minutes, seconds with padding
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return `${hh}h ${mm}m ${ss}s`
}

// Emergency fallback data
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
    .limit(20)

  const now = Date.now()
  const giveaways = (data ?? [])
    .map((x: any) => x.payload)
    .filter((g: any) => {
      // Exclude ended/sold_out/closed statuses
      if (!g || g.status === 'ended' || g.status === 'sold_out' || g.status === 'closed') return false
      // Only include live raffles
      if (g.status !== 'live') return false
      // Exclude if ends_at is in the past
      if (g.ends_at) {
        const endsAt = new Date(g.ends_at).getTime()
        if (Number.isFinite(endsAt) && endsAt <= now) return false
      }
      return true
    })

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
            const sold = Number(giveaway.tickets_sold ?? 0)
            const cap = Number(giveaway.hard_cap_total_tickets ?? 0)
            const percentSold = cap > 0 ? Math.min(100, Math.floor((sold / cap) * 100)) : null

            return (
              <Link
                key={giveaway.slug}
                href={`/giveaways/${giveaway.slug}`}
                className="group relative flex flex-col overflow-visible rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1"
              >
                {/* Countdown - jackpot tab overlapping top edge */}
                {timeLeft && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20">
                    <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-700 to-red-900 px-4 py-1.5 text-sm font-bold text-white shadow-lg border border-[#FFD700]/50 shadow-red-900/50">
                      <Clock className="h-4 w-4" />
                      {timeLeft}
                    </span>
                  </div>
                )}

                {/* Hero image */}
                {giveaway.hero_image_url && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-2xl">
                    <Image
                      src={giveaway.hero_image_url}
                      alt={giveaway.title || 'Giveaway'}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
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

                  {/* Presentation type - compact casino strip */}
                  {giveaway.presentation_type === 'balloon_pop' && (
                    <div className="mt-3 rounded-lg bg-gradient-to-r from-[#1a0025] to-[#2a0040] border-l-4 border-[#FFD700] px-3 py-2 shadow-[0_0_12px_rgba(236,72,153,0.3)]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-pink-400">
                        {"🎈 LIVE BALLOON POP"}
                      </div>
                      <div className="text-sm font-bold text-white">
                        ON TIKTOK + FACEBOOK
                      </div>
                      <div className="text-[10px] text-pink-300/70">Watch live • Pop balloons • Win cash</div>
                    </div>
                  )}
                  {giveaway.presentation_type === 'instant_cash' && (
                    <div className="mt-3 rounded-lg bg-gradient-to-r from-[#1a1500] to-[#2a2000] border-l-4 border-[#FFD700] px-3 py-2 shadow-[0_0_12px_rgba(251,191,36,0.3)]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        {"⚡ INSTANT WIN"}
                      </div>
                      <div className="text-sm font-bold text-white">
                        WIN CASH NOW
                      </div>
                      <div className="text-[10px] text-amber-300/70">Buy tickets • Reveal instantly</div>
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

                  {/* Ticket price - casino chip badge */}
                  {giveaway.base_ticket_price_pence != null && (
                    <div className="mt-3">
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-3 py-1 text-xs font-bold text-black shadow-md">
                        £{(giveaway.base_ticket_price_pence / 100).toFixed(2)} per ticket
                      </span>
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
          })}
        </div>
      </div>
    </div>
  )
}
