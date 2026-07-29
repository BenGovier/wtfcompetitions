import Link from "next/link"
import Image from "next/image"
import { Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { TikTokIcon } from "@/components/icons/tiktok-icon"
import { DeadlineBadge } from "@/components/deadline-badge"
import { computeCountdown } from "@/lib/countdown"

// --- Card display helpers (shared logic, duplicated intentionally per page) ---

// Customer-friendly price: below £1 -> "49P", £1+ -> "£1.50".
function priceText(pence: number): string {
  if (pence < 100) return `${Math.round(pence)}P`
  return `£${(pence / 100).toFixed(2)}`
}

// Genuine prize subtitle only. Returns the prize_title when it is present,
// non-empty after trimming, and not a case-insensitive duplicate of the
// campaign title; otherwise null (no synthesized/generic marketing copy).
function prizeSubtitle(giveaway: any): string | null {
  const title = String(giveaway?.title ?? "").trim().toLowerCase()
  const prize = String(giveaway?.prize_title ?? "").trim()
  if (prize && prize.toLowerCase() !== title) return prize
  return null
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
          <p className="mt-1 text-pretty bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">Big prizes. Small ticket prices. Pick your winner.</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {displayGiveaways.map((giveaway: any) => {
            const endsAtRaw = giveaway.ends_at
            const endMs = endsAtRaw ? new Date(endsAtRaw).getTime() : Number.NaN
            const initialCd = Number.isFinite(endMs) ? computeCountdown(endMs, Date.now()) : null
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
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

                  {/* 1. Deadline / live countdown badge (fixed top-left) */}
                  {initialCd && (
                    <DeadlineBadge
                      endsAtMs={endMs}
                      initialLabel={initialCd.label}
                      initialTone={initialCd.tone}
                      className="absolute left-2 top-2 z-10"
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-3">
                  {/* 2. Ticket price — dominant opaque gold badge overlapping the seam.
                      Fixed position and shape regardless of sale state so it never jumps. */}
                  {base != null && (
                    <div className="relative z-10 -mt-8 mb-3 flex flex-wrap items-end gap-x-2 gap-y-1">
                      <span className="inline-flex flex-col items-start rounded-xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] px-3 py-1.5 leading-none shadow-lg shadow-black/30">
                        <span className="text-lg font-black tabular-nums text-black md:text-xl">{priceText(base)}</span>
                        <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wider text-black/70">A Ticket</span>
                      </span>
                      {onSale && (
                        <span className="mb-1 inline-flex items-center rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/75 line-through">
                          Was {priceText(was)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 3. Format row — driven only by presentation_type.
                      Nothing renders (and no space is reserved) for null/unknown. */}
                  {giveaway.presentation_type === "balloon_pop" && (
                    <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-black px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm">
                      <TikTokIcon className="h-[18px] w-[18px] shrink-0" />
                      TikTok Live
                    </div>
                  )}
                  {giveaway.presentation_type === "instant_cash" && (
                    <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-amber-400/10 px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#FFD700] ring-1 ring-inset ring-amber-400/40">
                      <Zap className="h-[18px] w-[18px] shrink-0" fill="currentColor" />
                      Instant Cash
                    </div>
                  )}

                  {/* 4. Title */}
                  <h3 className="min-h-[2.5rem] text-pretty text-sm font-bold leading-tight text-white line-clamp-2 transition-colors group-hover:text-amber-400 md:text-base">
                    {giveaway.title}
                  </h3>

                  {/* 5. Genuine prize title — only when meaningful and not a
                      duplicate of the campaign title. No generic fallback. */}
                  {prizeSubtitle(giveaway) && (
                    <p className="mt-1.5 text-xs leading-snug text-amber-100/70 line-clamp-2 md:text-sm">
                      {prizeSubtitle(giveaway)}
                    </p>
                  )}

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
          })}
        </div>
      </div>
    </div>
  )
}
