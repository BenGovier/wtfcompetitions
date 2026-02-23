import type { WinnerSnapshot } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Quote } from "lucide-react"

interface WinnerSpotlightProps {
  winner: WinnerSnapshot
}

export function WinnerSpotlight({ winner }: WinnerSpotlightProps) {
  return (
    <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:gap-8 md:text-left">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/30 bg-primary/10 text-3xl font-bold text-primary md:h-32 md:w-32 md:text-4xl" aria-hidden="true">
              {(winner.name?.[0] || '?').toUpperCase()}
            </div>
            <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-lg">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-balance text-xl font-bold md:text-2xl">{winner.name}</h3>
              <p className="text-pretty text-sm text-muted-foreground md:text-base">
                Won <span className="font-semibold text-foreground">{winner.prizeTitle}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {winner.giveawayTitle} •{" "}
                {new Date(winner.announcedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            {winner.quote && (
              <blockquote className="relative mt-4 border-l-4 border-primary/30 bg-background/50 p-4 italic">
                <Quote className="absolute right-2 top-2 h-6 w-6 text-primary/20" aria-hidden="true" />
                <p className="text-pretty text-sm md:text-base">{winner.quote}</p>
              </blockquote>
            )}

            {winner.giveawaySlug && (
              <a
                href={`/giveaways/${winner.giveawaySlug}`}
                className="inline-block text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              >
                View this giveaway
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
