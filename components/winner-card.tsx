import type { WinnerSnapshot } from "@/lib/types"

interface WinnerCardProps {
  winner: WinnerSnapshot
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
  // If prize contains £, show the prize title
  if (prizeTitle.includes("£")) {
    return prizeTitle
  }
  // Otherwise show generic text
  return "a prize"
}

export function WinnerCard({ winner }: WinnerCardProps) {
  const initial = (winner.name?.[0] || "?").toUpperCase()

  // Compact horizontal feed item
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#1f0033]/60 px-3 py-2.5 transition-transform duration-150 active:scale-[0.98] hover:bg-[#1f0033]/80">
      {/* Avatar circle with initial */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white"
        aria-hidden="true"
      >
        {initial}
      </div>

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">
          <span className="font-semibold">{winner.name}</span>
          <span className="text-white/60"> just won</span>
        </p>
        <p className="truncate text-xs font-medium text-yellow-400">
          {formatPrize(winner.prizeTitle)}
        </p>
      </div>

      {/* Time ago */}
      <span className="shrink-0 text-xs text-white/40">{formatTimeAgo(winner.announcedAt)}</span>
    </div>
  )
}
