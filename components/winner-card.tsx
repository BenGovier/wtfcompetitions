import type { WinnerSnapshot } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Zap } from "lucide-react"

interface WinnerCardProps {
  winner: WinnerSnapshot
}

export function WinnerCard({ winner }: WinnerCardProps) {
  const initial = (winner.name?.[0] || '?').toUpperCase()

  return (
    <Card className="overflow-hidden rounded-2xl border border-border shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Initial circle */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary" aria-hidden="true">
            {initial}
          </div>

          <div className="min-w-0 flex-1">
            {/* Name + kind pill */}
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-foreground">{winner.name}</h3>
              {winner.kind && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    winner.kind === "main"
                      ? "bg-primary/10 text-primary"
                      : "bg-[var(--gold-soft)] text-amber-600"
                  }`}
                >
                  {winner.kind === "main" ? (
                    <>
                      <Trophy className="h-2.5 w-2.5" aria-hidden="true" />
                      Main Winner
                    </>
                  ) : (
                    <>
                      <Zap className="h-2.5 w-2.5" aria-hidden="true" />
                      Instant Win
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Prize title */}
            <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{winner.prizeTitle}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3 h-px bg-border/60" />

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{winner.giveawayTitle}</span>
          <span className="shrink-0">
            {new Date(winner.announcedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {winner.giveawaySlug && (
          <a
            href={`/giveaways/${winner.giveawaySlug}`}
            className="mt-2 inline-block text-xs font-medium text-primary transition-colors hover:text-[#5B21B6] hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
          >
            View giveaway
          </a>
        )}
      </CardContent>
    </Card>
  )
}
