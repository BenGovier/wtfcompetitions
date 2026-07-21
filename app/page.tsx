import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { LiveNowTakeover } from "@/components/live/LiveNowTakeover"
import { TikTokIcon } from "@/components/icons/tiktok-icon"

// --- Card display helpers (shared logic, duplicated intentionally per page) ---

type UrgencyTone = "ended" | "urgent" | "normal"

// Calendar day (Y-M-D) for a date evaluated in Europe/London.
function londonYMD(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get("year"), m: get("month"), day: get("day") }
}

// Whole-calendar-day difference (to - from) using Europe/London dates.
function londonCalendarDayDiff(from: Date, to: Date): number {
  const a = londonYMD(from)
  const b = londonYMD(to)
  const aUTC = Date.UTC(a.y, a.m - 1, a.day)
  const bUTC = Date.UTC(b.y, b.m - 1, b.day)
  return Math.round((bUTC - aUTC) / (1000 * 60 * 60 * 24))
}

// Urgency badge derived only from status + ends_at. Returns null when nothing
// can be shown safely (e.g. no ends_at and not sold out/ended).
function getUrgency(giveaway: any): { label: string; tone: UrgencyTone } | null {
  const status = giveaway?.status
  const sold = Number(giveaway?.tickets_sold ?? 0)
  const cap = Number(giveaway?.hard_cap_total_tickets ?? 0)

  // 1. Sold out
  if (status === "sold_out" || (cap > 0 && sold >= cap)) return { label: "SOLD OUT", tone: "ended" }
  // 2. Ended
  if (status === "ended" || status === "closed") return { label: "ENDED", tone: "ended" }

  const endsAt = giveaway?.ends_at
  if (!endsAt) return null
  const end = new Date(endsAt)
  if (Number.isNaN(end.getTime())) return null

  const now = new Date()
  if (end.getTime() <= now.getTime()) return { label: "ENDED", tone: "ended" }

  const days = londonCalendarDayDiff(now, end)
  // 3. Ends today / 4. Ends tomorrow
  if (days <= 0) return { label: "ENDS TODAY", tone: "urgent" }
  if (days === 1) return { label: "ENDS TOMORROW", tone: "urgent" }
  // 5. X days left
  return { label: `${days} DAYS LEFT`, tone: "normal" }
}

// Customer-friendly price: below £1 -> "49P", £1+ -> "£1.50".
function priceText(pence: number): string {
  if (pence < 100) return `${Math.round(pence)}P`
  return `£${(pence / 100).toFixed(2)}`
}

// Prize/benefit line. Meaningful prize_title always wins; otherwise fall back
// to format-specific copy driven by the admin-managed presentation_type.
function benefitLine(giveaway: any): string {
  const title = String(giveaway?.title ?? "").trim().toLowerCase()
  const prize = String(giveaway?.prize_title ?? "").trim()
  if (prize && prize.toLowerCase() !== title) return prize
  switch (giveaway?.presentation_type) {
    case "balloon_pop":
      return "Big prizes revealed live"
    case "instant_cash":
      return "Your prize is revealed instantly"
    default:
      return "One ticket could change everything"
  }
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
    .eq('payload->>status', 'live')
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8 md:py-16">
      {/* LIVE NOW site takeover — renders only when a takeover is enabled. */}
      <LiveNowTakeover />

      {/* Featured Giveaways */}
      <section className="mb-16">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-balance text-2xl font-bold tracking-tight text-white md:text-3xl">Featured Giveaways</h2>
              <p className="mt-1 text-pretty bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">Big prizes. Small ticket prices. Pick your winner.</p>
            </div>
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10" asChild>
              <Link href="/giveaways">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Giveaway cards */}
        <div className="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {giveaways.length > 0 ? (
            giveaways.map((giveaway: any) => {
              const urgency = getUrgency(giveaway)
              const sold = Number(giveaway.tickets_sold ?? 0)
              const cap = Number(giveaway.hard_cap_total_tickets ?? 0)
              const percentSold = cap > 0 ? Math.min(100, Math.floor((sold / cap) * 100)) : null
              const base = giveaway.base_ticket_price_pence
              const was = giveaway.was_ticket_price_pence
              const onSale = base != null && was != null && was > base

              return (
                <Link
                  key={giveaway.slug}
                  href={`/giveaways/${giveaway.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c0b30] transition-all duration-300 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0014]"
                >
                  {/* Artwork with overlays */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    {giveaway.hero_image_url ? (
                      <Image
                        src={giveaway.hero_image_url}
                        alt={giveaway.title || "Giveaway"}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 359px) 100vw, (max-width: 768px) 50vw, (max-width: 1023px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-[#2a0040] to-[#1a0b2e]" />
                    )}
                    {/* Bottom fade so the price badge stays legible */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1c0b30] to-transparent" />

                    {/* 1. Urgency badge */}
                    {urgency && (
                      <span
                        className={
                          "absolute left-2 top-2 z-10 inline-flex items-center rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-md " +
                          (urgency.tone === "ended"
                            ? "bg-black/75 text-white/90 backdrop-blur-sm"
                            : urgency.tone === "urgent"
                              ? "bg-gradient-to-r from-red-600 to-red-800 text-white"
                              : "bg-black/60 text-white backdrop-blur-sm")
                        }
                      >
                        {urgency.label}
                      </span>
                    )}

                    {/* 2. Format badge, top-right — driven by presentation_type.
                        Nothing renders for null / unknown values. */}
                    {giveaway.presentation_type === "balloon_pop" && (
                      <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white shadow-md backdrop-blur-sm sm:text-[10px]">
                        <TikTokIcon className="h-3 w-3 shrink-0" />
                        TikTok Live
                      </span>
                    )}
                    {giveaway.presentation_type === "instant_cash" && (
                      <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-black shadow-md sm:text-[10px]">
                        <Zap className="h-3 w-3 shrink-0" fill="currentColor" />
                        Instant Cash
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-3">
                    {/* 3. Ticket-price badge, overlapping the artwork bottom */}
                    {base != null && (
                      <div className="relative z-10 -mt-7 mb-4 flex items-end gap-2">
                        {onSale ? (
                          <>
                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-green-500 to-emerald-600 px-3 py-1 text-xs font-extrabold text-white shadow-md">
                              NOW {priceText(base)}
                            </span>
                            <span className="text-[10px] font-semibold uppercase text-white/60 line-through">
                              Was {priceText(was)}
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-3 py-1 text-xs font-extrabold text-black shadow-md">
                            {priceText(base)} A TICKET
                          </span>
                        )}
                      </div>
                    )}

                    {/* 4. Title */}
                    <h3 className="min-h-[2.5rem] text-pretty text-sm font-bold leading-tight text-white line-clamp-2 transition-colors group-hover:text-amber-400 md:text-base">
                      {giveaway.title}
                    </h3>

                    {/* 5. Prize / customer-benefit line */}
                    <p className="mt-1.5 min-h-[2rem] text-xs leading-snug text-amber-100/70 line-clamp-2 md:text-sm">
                      {benefitLine(giveaway)}
                    </p>

                    {/* 6. Percentage sold + progress bar */}
                    {percentSold !== null && (
                      <div className="mt-3">
                        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-amber-400">
                          {percentSold}% Sold
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500"
                            style={{ width: `${percentSold}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 7. Enter now CTA (styled non-button; whole card is the link) */}
                    <div className="mt-auto pt-3">
                      <div className="flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-4 py-3 text-sm font-bold text-black transition-all group-hover:shadow-lg">
                        Enter now
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
  )
}
