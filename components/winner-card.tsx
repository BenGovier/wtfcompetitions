import type { WinnerSnapshot } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatPrizeAmount } from "@/lib/winners"
import { ShieldCheck } from "lucide-react"

interface WinnerCardProps {
  winner: WinnerSnapshot
  /** The newest win is rendered strongest, as a tall vertical card. */
  featured?: boolean
}

/* -------------------------------------------------------------------------- */
/* Display-only prize classification.                                          */
/*                                                                             */
/* This is a PURE, VISUAL-ONLY helper. It never filters, excludes, or reorders */
/* any winner, and it never invents a prize value. It uses only fields that    */
/* already exist on the supplied WinnerSnapshot (`kind` and `prizeTitle`).     */
/* -------------------------------------------------------------------------- */

type PrizeCategory = "main" | "vip_balloon" | "balloon" | "cash"

function classifyPrize(winner: WinnerSnapshot): PrizeCategory {
  if (winner.kind === "main") return "main"

  const title = (winner.prizeTitle ?? "").toLowerCase()
  const hasBalloon = title.includes("balloon") || title.includes("ballon") // common misspelling
  if (hasBalloon && title.includes("vip")) return "vip_balloon"
  if (hasBalloon) return "balloon"

  return "cash"
}

/** The large headline shown in the prize-title block. Never invents a value. */
function prizeHeadline(winner: WinnerSnapshot, category: PrizeCategory): string {
  const realTitle = (winner.prizeTitle ?? "").trim()
  switch (category) {
    case "main":
      return realTitle || "Main draw winner"
    case "vip_balloon":
      return "VIP BALLOON"
    case "balloon":
      return "BALLOON WIN"
    case "cash":
      // Preserve the actual cash value when supplied; never fabricate one.
      return formatPrizeAmount(winner) ?? (realTitle || "Cash winner")
  }
}

/** Secondary line for balloon prizes, which are revealed manually live. */
function prizeSubline(category: PrizeCategory): string | null {
  if (category === "vip_balloon") return "Special prize revealed live"
  if (category === "balloon") return "Prize revealed live"
  return null
}

const CATEGORY_META: Record<
  PrizeCategory,
  { badge: string; card: string; avatar: string; headline: string; badgeLabel: string; verified: string }
> = {
  main: {
    badgeLabel: "Main draw",
    // Gold accent, slightly elevated surface.
    card: "border-yellow-400/35 bg-gradient-to-br from-[#341052] via-[#26113f] to-[#180a2c]",
    badge: "border border-yellow-400/50 bg-yellow-500/15 text-yellow-100",
    avatar: "bg-gradient-to-br from-yellow-400 to-amber-600 text-black",
    headline: "text-yellow-200",
    verified: "text-yellow-300/80",
  },
  vip_balloon: {
    badgeLabel: "VIP balloon",
    // Stronger gold accent, slightly stronger border.
    card: "border-yellow-300/45 bg-gradient-to-br from-[#3a1150] via-[#2a0f44] to-[#160726]",
    badge: "border border-yellow-300/60 bg-yellow-400/15 text-yellow-100",
    avatar: "bg-gradient-to-br from-yellow-300 to-amber-500 text-black",
    headline: "text-yellow-100",
    verified: "text-yellow-200/80",
  },
  balloon: {
    badgeLabel: "Balloon win",
    // Pink / purple accent.
    card: "border-fuchsia-400/30 bg-gradient-to-br from-[#3b0a4d] via-[#2c0940] to-[#150726]",
    badge: "border border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100",
    avatar: "bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white",
    headline: "text-fuchsia-100",
    verified: "text-fuchsia-200/80",
  },
  cash: {
    badgeLabel: "Cash win",
    // Gold accent.
    card: "border-amber-400/25 bg-gradient-to-br from-[#2a0845] via-[#210739] to-[#12061f]",
    badge: "border border-amber-400/50 bg-amber-500/15 text-amber-200",
    avatar: "bg-gradient-to-br from-[#FFD46A] to-[#F7A600] text-purple-950",
    headline: "text-amber-300",
    verified: "text-amber-300/80",
  },
}

function formatDate(dateString: string): string {
  const then = new Date(dateString)
  if (Number.isNaN(then.getTime())) return ""
  const now = Date.now()
  const diffSeconds = Math.floor((now - then.getTime()) / 1000)

  if (diffSeconds < 60) return "just now"
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

// One or two initials, derived only from the already-sanitised first name.
// Never reconstructs or infers a surname.
function initialsFor(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) return "?"
  const chars = Array.from(trimmed).filter((c) => /\p{L}/u.test(c))
  if (chars.length === 0) return "?"
  return chars.slice(0, 2).join("").toUpperCase()
}

const WINNER_FALLBACK = "Verified winner"
const CAMPAIGN_FALLBACK = "WTF Giveaways"

export function WinnerCard({ winner, featured = false }: WinnerCardProps) {
  const category = classifyPrize(winner)
  const meta = CATEGORY_META[category]
  const headline = prizeHeadline(winner, category)
  const subline = prizeSubline(category)

  const name = winner.name?.trim() ? winner.name.trim() : WINNER_FALLBACK
  const hasRealName = name !== WINNER_FALLBACK
  const campaign = winner.giveawayTitle?.trim() ? winner.giveawayTitle.trim() : CAMPAIGN_FALLBACK
  const date = formatDate(winner.announcedAt)
  const initials = hasRealName ? initialsFor(name) : "W"

  const badge = (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        meta.badge,
      )}
    >
      {meta.badgeLabel}
    </span>
  )

  const avatar = (size: string, text: string) => (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold shadow-sm", size, text, meta.avatar)}
      aria-hidden="true"
    >
      {initials}
    </span>
  )

  /* ----------------------------- Featured card ---------------------------- */
  if (featured) {
    return (
      <article
        className={cn(
          "flex h-full min-h-[240px] flex-col gap-3 rounded-[18px] border p-5 shadow-[0_1px_24px_rgba(0,0,0,0.35)] transition-colors duration-200 md:min-h-[230px] motion-reduce:transition-none",
          "focus-within:ring-2 focus-within:ring-yellow-400/60",
          meta.card,
        )}
      >
        {/* 1. Category badge */}
        <div className="flex items-center justify-between gap-2">
          {badge}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
            Latest
          </span>
        </div>

        {/* 2. Prize display title (dominant element) */}
        <div className="mt-1">
          <p
            className={cn(
              "text-balance break-words font-black leading-[1.05] tabular-nums text-[32px] md:text-[34px]",
              meta.headline,
            )}
          >
            {headline}
          </p>
          {subline ? <p className="mt-1 text-sm font-medium text-white/70">{subline}</p> : null}
        </div>

        {/* 3. Winner first name */}
        <div className="mt-auto flex items-center gap-2.5">
          {avatar("h-10 w-10 text-sm", "")}
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">{name}</p>
            {/* 4. Campaign title */}
            <p className="line-clamp-2 text-[13px] text-white/55">{campaign}</p>
          </div>
        </div>

        {/* 5. Won date/time + 6. Verified winner */}
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          <span className="text-xs text-white/50">{date || "Recently"}</span>
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", meta.verified)}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Verified winner
          </span>
        </div>
      </article>
    )
  }

  /* ----------------------------- Standard card ---------------------------- */
  return (
    <article
      className={cn(
        "grid min-h-[104px] grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-[14px] border p-4 transition-colors duration-200 md:min-h-[170px] motion-reduce:transition-none",
        "focus-within:ring-2 focus-within:ring-yellow-400/60",
        meta.card,
      )}
    >
      {/* Initials avatar */}
      {avatar("h-11 w-11 text-base", "")}

      <div className="flex min-w-0 flex-col justify-center gap-0.5 md:justify-start">
        {/* Category */}
        <span className={cn("text-[11px] font-bold uppercase tracking-wider", meta.headline)}>{meta.badgeLabel}</span>

        {/* Prize title */}
        <p
          className={cn(
            "text-balance break-words text-[22px] font-extrabold leading-tight tabular-nums",
            meta.headline,
          )}
        >
          {headline}
        </p>
        {subline ? <p className="text-xs font-medium text-white/60">{subline}</p> : null}

        {/* Winner name */}
        <p className="mt-1 truncate text-sm font-semibold text-white">{name}</p>

        {/* Campaign */}
        <p className="truncate text-xs text-white/50">{campaign}</p>

        {/* Time */}
        <span className="mt-0.5 text-xs text-white/45">{date || "Recently"}</span>
      </div>
    </article>
  )
}
