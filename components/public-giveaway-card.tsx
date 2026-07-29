import Link from "next/link"
import Image from "next/image"
import { Zap, Gift } from "lucide-react"
import { TikTokIcon } from "@/components/icons/tiktok-icon"
import { deadlineLabel } from "@/lib/countdown"
import type { GiveawayCategory } from "@/lib/giveaway-classification"

// Customer-friendly price: below £1 -> "49p", £1+ -> "£1.50". Price only.
function priceText(pence: number): string {
  if (pence < 100) return `${Math.round(pence)}p`
  return `£${(pence / 100).toFixed(2)}`
}

/**
 * Per-category visual + copy configuration. A single component with controlled
 * variants — never separate complete components per category. Category is
 * communicated through MULTIPLE signals (badge text, icon, supporting line, CTA
 * wording, accent) so users never rely on colour alone.
 */
const VARIANTS: Record<
  GiveawayCategory,
  {
    supportingLine: string
    cta: string
    ctaClass: string
    hoverBorder: string
    hoverShadow: string
  }
> = {
  live_balloon: {
    supportingLine: "Hosted live Balloon Pop",
    cta: "Enter the live draw",
    ctaClass: "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white",
    hoverBorder: "hover:border-fuchsia-400/60",
    hoverShadow: "hover:shadow-fuchsia-500/20",
  },
  instant_cash: {
    supportingLine: "Instant prizes revealed automatically",
    cta: "Play now",
    ctaClass: "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black",
    hoverBorder: "hover:border-emerald-400/50",
    hoverShadow: "hover:shadow-emerald-500/15",
  },
  other: {
    supportingLine: "Enter for your chance to win",
    cta: "Enter now",
    ctaClass: "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black",
    hoverBorder: "hover:border-amber-400/50",
    hoverShadow: "hover:shadow-amber-500/10",
  },
}

function CategoryBadge({ category }: { category: GiveawayCategory }) {
  if (category === "live_balloon") {
    return (
      <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-black px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm">
        <TikTokIcon className="h-[18px] w-[18px] shrink-0" />
        TikTok Live
        <span className="relative ml-0.5 flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-500" />
        </span>
      </div>
    )
  }
  if (category === "instant_cash") {
    return (
      <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-300 ring-1 ring-inset ring-emerald-400/40">
        <Zap className="h-[18px] w-[18px] shrink-0" fill="currentColor" />
        Instant Cash
      </div>
    )
  }
  return (
    <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-md bg-amber-400/10 px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#FFD700] ring-1 ring-inset ring-amber-400/40">
      <Gift className="h-[18px] w-[18px] shrink-0" />
      Giveaway
    </div>
  )
}

export function PublicGiveawayCard({
  giveaway,
  category,
}: {
  giveaway: any
  category: GiveawayCategory
}) {
  const variant = VARIANTS[category]

  const endsAtRaw = giveaway.ends_at
  const endMs = endsAtRaw ? new Date(endsAtRaw).getTime() : Number.NaN
  const deadline = Number.isFinite(endMs) ? deadlineLabel(endMs, Date.now()) : null

  const sold = Number(giveaway.tickets_sold ?? 0)
  const cap = Number(giveaway.hard_cap_total_tickets ?? 0)
  const percentSold = cap > 0 ? Math.min(100, Math.floor((sold / cap) * 100)) : null

  const base = giveaway.base_ticket_price_pence

  return (
    <Link
      href={`/giveaways/${giveaway.slug}`}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c0b30] transition-all duration-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0014] ${variant.hoverBorder} ${variant.hoverShadow}`}
    >
      {/* Artwork with overlays */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {giveaway.hero_image_url ? (
          <Image
            src={giveaway.hero_image_url}
            alt={giveaway.title || "Giveaway"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
            sizes="(max-width: 359px) 100vw, (max-width: 768px) 50vw, (max-width: 1023px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#2a0040] to-[#1a0b2e]" />
        )}
        {/* Bottom fade so the price badge stays legible */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Closing-date pill — centred at the top of the artwork */}
        {deadline && (
          <span
            className={
              "absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow-lg shadow-black/40 " +
              (deadline.ended ? "bg-red-600 text-white" : "bg-[#1c0b30] text-white ring-1 ring-amber-400/50")
            }
          >
            {deadline.label}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        {/* Ticket price — centred gold pill overlapping the image/content seam.
            Price only: no label, single line, symmetrical. */}
        {base != null && (
          <div className="relative z-10 -mt-6 mb-3 flex justify-center">
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] px-4 py-1.5 text-lg font-black tabular-nums leading-none text-black shadow-lg shadow-black/30 md:text-xl">
              {priceText(base)}
            </span>
          </div>
        )}

        {/* Category badge */}
        <CategoryBadge category={category} />

        {/* Title */}
        <h3 className="min-h-[2.5rem] text-pretty text-sm font-bold leading-tight text-white line-clamp-2 transition-colors group-hover:text-amber-400 md:text-base">
          {giveaway.title}
        </h3>

        {/* Category-specific supporting line (fixed copy, max two lines) */}
        <p className="mt-1.5 text-xs leading-snug text-white/60 line-clamp-2 md:text-sm">{variant.supportingLine}</p>

        {/* Percentage sold + progress bar */}
        {percentSold !== null && (
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-amber-400">{percentSold}% Sold</div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500"
                style={{ width: `${percentSold}%` }}
              />
            </div>
          </div>
        )}

        {/* Category-specific CTA (styled non-button; whole card is the link) */}
        <div className="mt-auto pt-3">
          <div
            className={`flex min-h-[44px] items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all group-hover:shadow-lg ${variant.ctaClass}`}
          >
            {variant.cta}
          </div>
        </div>
      </div>
    </Link>
  )
}
