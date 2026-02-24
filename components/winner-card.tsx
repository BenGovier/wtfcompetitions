import type { WinnerSnapshot } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Zap } from "lucide-react"

interface WinnerCardProps {
  winner: WinnerSnapshot
}

export function WinnerCard({ winner }: WinnerCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-2">
        {/* Top row: name + kind pill */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold truncate">{winner.name}</h3>
          {winner.kind && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                winner.kind === "main"
                  ? "bg-primary/10 text-primary"
                  : "bg-amber-500/10 text-amber-600"
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
        <p className="text-sm font-medium truncate">{winner.prizeTitle}</p>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Meta row: giveaway title + date */}
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
            className="inline-block text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
          >
            View giveaway
          </a>
        )}
      </CardContent>
    </Card>
  )
}
