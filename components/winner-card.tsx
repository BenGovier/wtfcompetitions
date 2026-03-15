import type { WinnerSnapshot } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
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

  // Main winner card - larger, premium feel with gold accent
  if (isMain) {
    return (
      <Card className="group relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-amber-50/50 to-background shadow-md transition-all duration-300 ease-out hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl dark:from-amber-950/20">
        <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-amber-400/10" />
        <CardContent className="relative p-5">
          <div className="flex items-start gap-4">
            {/* Initial circle - larger for main */}
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-xl font-bold text-white shadow-md"
              aria-hidden="true"
            >
              {initial}
            </div>

            <div className="min-w-0 flex-1">
              {/* Kind pill */}
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                <Trophy className="h-3 w-3" aria-hidden="true" />
                Main Winner
              </span>

              {/* Name */}
              <h3 className="truncate text-lg font-bold text-foreground">{winner.name}</h3>

              {/* Prize title */}
              <p className="mt-1 truncate text-sm font-medium text-amber-700 dark:text-amber-400">
                {winner.prizeTitle}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 h-px bg-amber-200/60 dark:bg-amber-800/40" />

          {/* Meta row */}
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="truncate font-medium">{winner.giveawayTitle}</span>
            <span className="shrink-0 text-amber-600 dark:text-amber-400">{formatTimeAgo(winner.announcedAt)}</span>
          </div>

          {winner.giveawaySlug && (
            <a
              href={`/giveaways/${winner.giveawaySlug}`}
              className="mt-3 inline-block rounded text-sm font-semibold text-amber-600 transition-colors hover:text-amber-700 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:text-amber-400 dark:hover:text-amber-300"
            >
              View giveaway
            </a>
          )}
        </CardContent>
      </Card>
    )
  }

  // Instant win card - compact, activity-style
  return (
    <Card className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-all duration-200 hover:border-border hover:shadow-md">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Lightning icon instead of initial */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30"
            aria-hidden="true"
          >
            <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>

          <div className="min-w-0 flex-1">
            {/* Name and prize inline */}
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">{winner.name}</span>
              <span className="text-xs text-muted-foreground">won</span>
            </div>
            <p className="truncate text-xs font-medium text-violet-600 dark:text-violet-400">{winner.prizeTitle}</p>
          </div>

          {/* Time ago */}
          <span className="shrink-0 text-xs text-muted-foreground">{formatTimeAgo(winner.announcedAt)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
