import type { WinnerSnapshot } from "@/lib/types"
import { cn } from "@/lib/utils"
import { getFulfilmentBadge, getPrizeDisplayTitle, type FulfilmentCategory } from "@/lib/winners"
import { Ticket } from "lucide-react"

interface WinnerCardProps {
  winner: WinnerSnapshot
  /** The newest win is rendered strongest. */
  featured?: boolean
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

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0]!.toUpperCase()
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase()
}

// Category-driven styling. Never uses a "£" heuristic.
const CATEGORY_STYLES: Record<
  FulfilmentCategory,
  { card: string; avatar: string; amount: string; badge: string }
> = {
  wallet_credit: {
    card: "border-yellow-500/30 bg-gradient-to-br from-[#2a0845] to-[#1a0a2e] hover:border-yellow-400/50",
    avatar: "bg-gradient-to-br from-yellow-400 to-amber-600 text-black",
    amount: "text-yellow-300",
    badge: "border border-yellow-500/40 bg-yellow-500/15 text-yellow-200",
  },
  cash: {
    card: "border-emerald-500/30 bg-gradient-to-br from-[#0c2a1f] to-[#1a0a2e] hover:border-emerald-400/50",
    avatar: "bg-gradient-to-br from-emerald-400 to-emerald-600 text-black",
    amount: "text-emerald-300",
    badge: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  },
  other: {
    card: "border-white/10 bg-[#1a0a2e]/80 hover:border-purple-400/40",
    avatar: "bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white",
    amount: "text-purple-100",
    badge: "border border-purple-400/40 bg-purple-500/15 text-purple-100",
  },
}

export function WinnerCard({ winner, featured = false }: WinnerCardProps) {
  const badge = getFulfilmentBadge(winner)
  const styles = CATEGORY_STYLES[badge.category]
  const title = getPrizeDisplayTitle(winner)
  const initials = initialsFor(winner.name || "Winner")
  const date = formatDate(winner.announcedAt)

  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors duration-200 motion-reduce:transition-none",
        "focus-within:ring-2 focus-within:ring-yellow-400/60",
        styles.card,
        featured && "ring-1 ring-yellow-400/40 shadow-[0_0_28px_rgba(250,204,21,0.14)]",
      )}
    >
      {/* 2. Fulfilment badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
            styles.badge,
          )}
        >
          {badge.label}
        </span>
        {featured && (
          <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-200">
            Latest win
          </span>
        )}
      </div>

      {/* 1. Prize amount / title — largest element */}
      <p className={cn("text-balance text-xl font-extrabold leading-tight md:text-2xl", styles.amount)}>{title}</p>

      {/* 3. Winner name (with branded initials avatar) */}
      <div className="mt-auto flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm",
            styles.avatar,
          )}
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{winner.name}</p>
          {/* 4. Competition title — secondary */}
          {winner.giveawayTitle ? (
            <p className="truncate text-xs text-white/55">{winner.giveawayTitle}</p>
          ) : null}
        </div>
      </div>

      {/* 5 + 6. Date and winning ticket (ticket only when supplied) */}
      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5 text-xs text-white/50">
        {date ? <span>{date}</span> : <span />}
        {typeof winner.winningTicket === "number" ? (
          <span className="inline-flex items-center gap-1 font-medium text-white/70">
            <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
            Ticket #{winner.winningTicket}
          </span>
        ) : null}
      </div>
    </article>
  )
}
