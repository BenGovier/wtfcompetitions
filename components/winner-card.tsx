import type { WinnerSnapshot } from "@/lib/types"
import { cn } from "@/lib/utils"

interface WinnerCardProps {
  winner: WinnerSnapshot
  isHot?: boolean
}

function formatTimeAgo(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffSeconds = Math.floor((now - then) / 1000)

  if (diffSeconds < 60) return "just now"
  if (diffSeconds < 3600) {
    const mins = Math.floor(diffSeconds / 60)
    return `${mins}m`
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600)
    return `${hours}h`
  }
  if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400)
    return `${days}d`
  }
  const weeks = Math.floor(diffSeconds / 604800)
  return `${weeks}w`
}

function formatPrize(prizeTitle: string): string {
  if (prizeTitle.includes("£")) {
    return prizeTitle
  }
  return "Balloon Pop 🎈"
}

function isCashPrize(prizeTitle: string): boolean {
  return prizeTitle.includes("£")
}

export function WinnerCard({ winner, isHot = false }: WinnerCardProps) {
  const initial = (winner.name?.[0] || "?").toUpperCase()
  const hasCash = isCashPrize(winner.prizeTitle)

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200",
        "hover:scale-[1.01] active:scale-[0.99]",
        isHot
          ? "border-yellow-500/40 bg-gradient-to-r from-[#2a0845] to-[#1f0033] shadow-[0_0_20px_rgba(255,215,0,0.15)]"
          : "border-white/5 bg-[#1a0a2e]/80 hover:border-white/10 hover:bg-[#1a0a2e]"
      )}
    >
      {/* Avatar circle with initial */}
      <div
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg",
          isHot
            ? "bg-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600 animate-pulse"
            : "bg-gradient-to-br from-fuchsia-500 to-purple-600"
        )}
        aria-hidden="true"
      >
        {initial}
        {isHot && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
        )}
      </div>

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{winner.name}</p>
        <p
          className={cn(
            "truncate text-sm font-semibold",
            hasCash
              ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]"
              : "text-purple-300"
          )}
        >
          {formatPrize(winner.prizeTitle)}
        </p>
      </div>

      {/* Time ago */}
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
          isHot
            ? "bg-yellow-500/20 text-yellow-300"
            : "bg-white/5 text-white/40"
        )}
      >
        {formatTimeAgo(winner.announcedAt)}
      </span>
    </div>
  )
}
