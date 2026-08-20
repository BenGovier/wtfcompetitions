import Link from "next/link"
import Image from "next/image"
import { Zap, Gift, ArrowRight, Clock } from "lucide-react"
import { TikTokIcon } from "@/components/icons/tiktok-icon"
import { deadlineLabel } from "@/lib/countdown"
import type { GiveawayCategory } from "@/lib/giveaway-classification"
import type { CardAccent } from "@/lib/admin/homepage-rails"

/**
 * Per-ROOM accent theme for the compact homepage card ONLY. Full Tailwind class
 * literals (so Tailwind v4's source scan keeps them) for the illuminated frame,
 * gaming CTA, price tile, progress track and countdown ring. A single coherent
 * WTF action system — same premium button treatment, accent colour per room.
 * The default catalogue card never uses these.
 */
const ACCENTS: Record<
  CardAccent,
  { frame: string; cta: string; priceTile: string; progressFill: string; progressText: string; countdownRing: string }
> = {
  gold: {
    frame:
      "border-amber-400/30 shadow-[0_0_0_1px_rgba(251,191,36,0.10),0_10px_34px_-16px_rgba(251,191,36,0.65)] hover:border-amber-300/60 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_14px_40px_-14px_rgba(251,191,36,0.85)]",
    cta: "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
    priceTile: "text-amber-200 ring-amber-400/35",
    progressFill: "bg-gradient-to-r from-amber-400 to-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.6)]",
    progressText: "text-amber-300",
    countdownRing: "ring-amber-400/50",
  },
  magenta: {
    frame:
      "border-fuchsia-400/30 shadow-[0_0_0_1px_rgba(217,70,239,0.10),0_10px_34px_-16px_rgba(217,70,239,0.65)] hover:border-fuchsia-300/60 hover:shadow-[0_0_0_1px_rgba(217,70,239,0.25),0_14px_40px_-14px_rgba(217,70,239,0.85)]",
    cta: "bg-gradient-to-b from-fuchsia-400 to-fuchsia-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]",
    priceTile: "text-fuchsia-200 ring-fuchsia-400/35",
    progressFill: "bg-gradient-to-r from-fuchsia-400 to-pink-300 shadow-[0_0_10px_rgba(217,70,239,0.6)]",
    progressText: "text-fuchsia-300",
    countdownRing: "ring-fuchsia-400/50",
  },
  cyan: {
    frame:
      "border-cyan-400/30 shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_10px_34px_-16px_rgba(34,211,238,0.65)] hover:border-cyan-300/60 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_14px_40px_-14px_rgba(34,211,238,0.85)]",
    cta: "bg-gradient-to-b from-cyan-300 to-sky-500 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
    priceTile: "text-cyan-100 ring-cyan-400/35",
    progressFill: "bg-gradient-to-r from-cyan-400 to-sky-300 shadow-[0_0_10px_rgba(34,211,238,0.6)]",
    progressText: "text-cyan-300",
    countdownRing: "ring-cyan-400/50",
  },
  violet: {
    frame:
      "border-violet-400/30 shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_10px_34px_-16px_rgba(139,92,246,0.65)] hover:border-violet-300/60 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_14px_40px_-14px_rgba(139,92,246,0.85)]",
    cta: "bg-gradient-to-b from-violet-400 to-violet-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]",
    priceTile: "text-violet-200 ring-violet-400/35",
    progressFill: "bg-gradient-to-r from-violet-400 to-fuchsia-300 shadow-[0_0_10px_rgba(139,92,246,0.6)]",
    progressText: "text-violet-300",
    countdownRing: "ring-violet-400/50",
  },
  emerald: {
    frame:
      "border-emerald-400/30 shadow-[0_0_0_1px_rgba(16,185,129,0.10),0_10px_34px_-16px_rgba(16,185,129,0.65)] hover:border-emerald-300/60 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_14px_40px_-14px_rgba(16,185,129,0.85)]",
    cta: "bg-gradient-to-b from-emerald-300 to-emerald-500 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
    priceTile: "text-emerald-200 ring-emerald-400/35",
    progressFill: "bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_10px_rgba(16,185,129,0.6)]",
    progressText: "text-emerald-300",
    countdownRing: "ring-emerald-400/50",
  },
}

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
    /** Short, conversion-led label for the compact homepage action row. */
    ctaShort: string
    ctaClass: string
    hoverBorder: string
    hoverShadow: string
  }
> = {
  live_balloon: {
    supportingLine: "Hosted live Balloon Pop",
    cta: "Enter the live draw",
    ctaShort: "Enter draw",
    ctaClass: "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white",
    hoverBorder: "hover:border-fuchsia-400/60",
    hoverShadow: "hover:shadow-fuchsia-500/20",
  },
  instant_cash: {
    supportingLine: "Instant prizes revealed automatically",
    cta: "Play now",
    ctaShort: "Play now",
    ctaClass: "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black",
    hoverBorder: "hover:border-emerald-400/50",
    hoverShadow: "hover:shadow-emerald-500/15",
  },
  other: {
    supportingLine: "Enter for your chance to win",
    cta: "Enter now",
    ctaShort: "Enter now",
    ctaClass: "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black",
    hoverBorder: "hover:border-amber-400/50",
    hoverShadow: "hover:shadow-amber-500/10",
  },
}

function CategoryBadge({ category, overlay = false }: { category: GiveawayCategory; overlay?: boolean }) {
  // In overlay mode the badge sits on the artwork, so drop the content-flow
  // bottom margin and add a slight backdrop blur for legibility over imagery.
  const margin = overlay ? "" : "mb-2"
  if (category === "live_balloon") {
    return (
      <div className={`${margin} inline-flex w-fit items-center gap-1.5 rounded-md bg-black px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm`}>
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
      <div className={`${margin} inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-300 ring-1 ring-inset ring-emerald-400/40 ${overlay ? "bg-black/70 backdrop-blur-sm" : "bg-emerald-500/15"}`}>
        <Zap className="h-[18px] w-[18px] shrink-0" fill="currentColor" />
        Instant Cash
      </div>
    )
  }
  return (
    <div className={`${margin} inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#FFD700] ring-1 ring-inset ring-amber-400/40 ${overlay ? "bg-black/70 backdrop-blur-sm" : "bg-amber-400/10"}`}>
      <Gift className="h-[18px] w-[18px] shrink-0" />
      Giveaway
    </div>
  )
}

export function PublicGiveawayCard({
  giveaway,
  category,
  imagePriority = false,
  compact = false,
  accent = "gold",
}: {
  giveaway: any
  category: GiveawayCategory
  // When true, the artwork loads at high priority (used ONLY for the single
  // LCP image: the first card of the first homepage rail). Defaults false so
  // every other usage keeps Next/Image's default lazy behaviour unchanged.
  imagePriority?: boolean
  // When true, uses the conversion-led homepage layout: title -> slim status ->
  // [price][ENTER NOW ->] action row, with the badge/heat signal as image
  // overlays. Defaults false so the /giveaways catalogue keeps its exact layout.
  compact?: boolean
  // Per-ROOM accent identity — ONLY affects the compact homepage shell (frame,
  // CTA, price tile, progress, countdown ring). Ignored by the default card.
  accent?: CardAccent
}) {
  const variant = VARIANTS[category]
  const theme = ACCENTS[accent] ?? ACCENTS.gold

  const endsAtRaw = giveaway.ends_at
  const endMs = endsAtRaw ? new Date(endsAtRaw).getTime() : Number.NaN
  const deadline = Number.isFinite(endMs) ? deadlineLabel(endMs, Date.now()) : null

  const sold = Number(giveaway.tickets_sold ?? 0)
  const cap = Number(giveaway.hard_cap_total_tickets ?? 0)
  const percentSold = cap > 0 ? Math.min(100, Math.floor((sold / cap) * 100)) : null

  const base = giveaway.base_ticket_price_pence

  // Optional, REAL-data heat signal for the compact homepage card only. Derived
  // purely from fields already loaded (ends_at, tickets_sold, hard_cap) — no new
  // query, no fabricated activity. Priority: Ending Soon (<24h) > Fast Selling
  // (>=85% sold). Anything speculative is intentionally skipped.
  const hoursLeft = Number.isFinite(endMs) ? (endMs - Date.now()) / 3_600_000 : Number.POSITIVE_INFINITY
  const endingSoon = deadline != null && !deadline.ended && hoursLeft > 0 && hoursLeft <= 24
  const fastSelling = percentSold !== null && percentSold >= 85 && percentSold < 100
  const heat: { label: string; className: string } | null = endingSoon
    ? { label: "Ending soon", className: "bg-red-600/90 text-white" }
    : fastSelling
      ? { label: "Fast selling", className: "bg-amber-400/95 text-black" }
      : null

  return (
    <Link
      href={`/giveaways/${giveaway.slug}`}
      className={
        compact
          ? // COMPACT casino shell: near-black body, tighter radius, restrained
            // illuminated accent frame + inner top highlight (no giant shadow).
            `group relative flex h-full flex-col overflow-hidden rounded-xl border bg-[#0d0120] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0014] ${theme.frame}`
          : // DEFAULT catalogue shell — unchanged.
            `group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c0b30] transition-all duration-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0014] ${variant.hoverBorder} ${variant.hoverShadow} ${deadline ? "pt-4" : ""}`
      }
    >
      {/* Closing-date pill — straddles the top edge of the artwork. DEFAULT
          layout only; the compact card renders the countdown as a top-right
          artwork overlay instead (see below). Positioned against the (relative)
          card root, NOT the clipped artwork wrapper, so it can sit half above /
          half over the image while staying inside the card. */}
      {!compact && deadline && (
        <span
          className={
            "absolute left-1/2 top-4 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow-lg shadow-black/40 " +
            (deadline.ended ? "bg-red-600 text-white" : "bg-[#1c0b30] text-white ring-1 ring-amber-400/50")
          }
        >
          {deadline.label}
        </span>
      )}

      {/* Artwork with overlays */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {giveaway.hero_image_url ? (
          <Image
            src={giveaway.hero_image_url}
            alt={giveaway.title || "Giveaway"}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
            sizes="(max-width: 359px) 100vw, (max-width: 768px) 50vw, (max-width: 1023px) 50vw, 33vw"
            priority={imagePriority}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#2a0040] to-[#1a0b2e]" />
        )}
        {/* Bottom fade so the price badge stays legible */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Compact homepage overlays sit OVER the artwork like the casino
            concept: TOP-LEFT competition type badge, TOP-RIGHT countdown badge
            (dark translucent + per-room accent ring), and — only when present —
            a real-data heat chip bottom-left over the fade. Keeps the content
            area clean so price/CTA rise high. */}
        {compact && (
          <>
            <div className="absolute left-2 top-2 z-10">
              <CategoryBadge category={category} overlay />
            </div>
            {deadline && (
              <div className="absolute right-2 top-2 z-10">
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-sm backdrop-blur-sm ring-1 ring-inset " +
                    (deadline.ended ? "bg-red-600/90 text-white ring-red-300/40" : `bg-black/70 text-white ${theme.countdownRing}`)
                  }
                >
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {deadline.label}
                </span>
              </div>
            )}
            {heat && (
              <div className="absolute bottom-2 left-2 z-10">
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-sm ${heat.className}`}>
                  {heat.label}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {compact ? (
        /* CONVERSION-LED mobile/homepage content: title -> slim status ->
           [price][ENTER NOW ->] action row -> secondary line. The whole card is
           the link, so the action row is a styled non-button (no duplicate CTA,
           no duplicate price). */
        <div className="flex flex-1 flex-col p-3">
          <h3 className="text-pretty text-sm font-bold leading-tight text-white line-clamp-2 transition-colors group-hover:text-amber-400 md:text-base">
            {giveaway.title}
          </h3>

          {/* Sharper, crisper progress: thin dark inset track + illuminated
              per-room accent fill. Sold calculation unchanged. */}
          {percentSold !== null && (
            <div className="mt-2">
              <div className={`mb-1 text-[11px] font-bold uppercase tracking-wide ${theme.progressText}`}>
                {percentSold}% sold
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-inset ring-white/10">
                <div className={`h-full rounded-full ${theme.progressFill}`} style={{ width: `${percentSold}%` }} />
              </div>
            </div>
          )}

          {/* Sportsbook-style action strip: compact dark price tile beside a
              dominant, wide gaming CTA (per-room accent gradient + inner
              highlight). Whole card is the link; this is a styled non-button. */}
          <div className="mt-3 flex items-stretch gap-2">
            {base != null && (
              <span
                className={`inline-flex min-h-[44px] shrink-0 items-center rounded-xl bg-black/40 px-3 text-sm font-black tabular-nums leading-none ring-1 ring-inset ${theme.priceTile}`}
              >
                {priceText(base)}
              </span>
            )}
            <span
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-extrabold uppercase tracking-wide transition-all group-hover:brightness-110 ${theme.cta}`}
            >
              {variant.ctaShort}
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
            </span>
          </div>

          {/* Secondary detail, below the action — never above the CTA. */}
          <p className="mt-2 text-[11px] leading-snug text-white/45 line-clamp-1">{variant.supportingLine}</p>
        </div>
      ) : (
        /* DEFAULT catalogue layout — unchanged (used by /giveaways + sections). */
        <div className="flex flex-1 flex-col p-3">
          {/* Ticket price — centred gold pill overlapping the image/content seam.
              Price only: no label, single line, symmetrical. */}
          {base != null && (
            <div className="relative z-10 -mt-5 mb-3 flex justify-center">
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] px-3 py-1 text-sm font-black tabular-nums leading-none text-black shadow-lg shadow-black/30 md:text-base">
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
      )}
    </Link>
  )
}
