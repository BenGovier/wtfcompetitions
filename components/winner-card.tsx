import type { WinnerSnapshot } from "@/lib/types"
import { Trophy, Zap } from "lucide-react"

interface WinnerCardProps {
  winner: WinnerSnapshot
  variant?: "main" | "instant"
}

function formatTimeAgo(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffSeconds = Math.floor((now - then) / 1000)

  if (diffSeconds < 60) return "just now"
  if (diffSeconds < 3600) {
    const mins = Math.floor(diffSeconds / 60)
    return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600)
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  }
  if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400)
    return `${days} ${days === 1 ? "day" : "days"} ago`
  }
  if (diffSeconds < 2592000) {
    const weeks = Math.floor(diffSeconds / 604800)
    return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`
  }
  const months = Math.floor(diffSeconds / 2592000)
  return `${months} ${months === 1 ? "month" : "months"} ago`
}

export function WinnerCard({ winner, variant }: WinnerCardProps) {
  const initial = (winner.name?.[0] || "?").toUpperCase()
  const isMain = variant === "main" || winner.kind === "main"

  // Main winner card - dark premium theme with gold accents
  if (isMain) {
    return (
      <div className="group relative overflow-hidden rounded-xl bg-[#1f0033]/80 backdrop-blur-md border border-white/10 shadow-[0_0_30px_rgba(255,215,0,0.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(255,215,0,0.12)]">
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Initial circle - gold gradient */}
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-xl font-bold text-black shadow-md"
              aria-hidden="true"
            >
              {initial}
            </div>

            <div className="min-w-0 flex-1">
              {/* Kind pill */}
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-yellow-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-300 border border-yellow-400/20">
                <Trophy className="h-3 w-3" aria-hidden="true" />
                Main Winner
              </span>

              {/* Name */}
              <h3 className="truncate text-lg font-bold text-white">{winner.name}</h3>

              {/* Prize title */}
              <p className="mt-1 truncate text-sm font-medium text-yellow-400">
                {winner.prizeTitle}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 h-px border-t border-white/10" />

          {/* Meta row */}
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-white/60">{winner.giveawayTitle}</span>
            <span className="shrink-0 text-yellow-400">{formatTimeAgo(winner.announcedAt)}</span>
          </div>

          {winner.giveawaySlug && (
            <a
              href={`/giveaways/${winner.giveawaySlug}`}
              className="mt-3 inline-block rounded text-sm font-semibold text-yellow-400 transition-colors hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-[#1f0033]"
            >
              View giveaway
            </a>
          )}
        </div>
      </div>
    )
  }

  // Instant win card - compact, dark theme
  return (
    <div className="overflow-hidden rounded-xl bg-[#1f0033]/60 backdrop-blur-md border border-white/10 shadow-sm transition-all duration-200 hover:border-white/20 hover:shadow-md">
      <div className="p-3">
        <div className="flex items-center gap-3">
          {/* Lightning icon */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 border border-violet-400/20"
            aria-hidden="true"
          >
            <Zap className="h-4 w-4 text-violet-400" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Name and prize inline */}
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-sm font-semibold text-white">{winner.name}</span>
              <span className="text-xs text-white/40">won</span>
            </div>
            <p className="truncate text-xs font-medium text-violet-400">{winner.prizeTitle}</p>
          </div>

          {/* Time ago */}
          <span className="shrink-0 text-xs text-white/40">{formatTimeAgo(winner.announcedAt)}</span>
        </div>
      </div>
    </div>
  )
}
