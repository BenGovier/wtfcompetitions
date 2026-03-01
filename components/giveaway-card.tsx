import type { GiveawayPublic } from "@/lib/types"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import Link from "next/link"

interface GiveawayCardProps {
  giveaway: GiveawayPublic
  mode?: "live" | "past"
}

function formatPriceGBP(price: number | null | undefined) {
  const n = Number(price)
  if (!Number.isFinite(n)) return "\u2014"
  if (n < 1) return `${Math.round(n * 100)}p`
  return `£${n.toFixed(2)}`
}

function getTimeLabel(msLeft: number, isEnded: boolean): string {
  if (isEnded) return "Ended"
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
  if (daysLeft <= 1) return "Ends today"
  return `Ends in ${daysLeft} days`
}

export function GiveawayCard({ giveaway, mode = "live" }: GiveawayCardProps) {
  const msLeft = giveaway.endsAt.getTime() - Date.now()
  const isEnded = msLeft <= 0
  const effectiveStatus = isEnded ? "ended" : giveaway.status
  const timeLabel = getTimeLabel(msLeft, isEnded)

  const sold = giveaway.ticketsSold ?? 0
  const cap = giveaway.hardCapTotalTickets ?? 0

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/giveaways/${giveaway.slug}`} className="block">
        <div className="relative aspect-[3/2] overflow-hidden bg-muted">
          <img
            src={giveaway.imageUrl || "/placeholder.svg"}
            alt={giveaway.prizeTitle}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            crossOrigin="anonymous"
          />
          {/* Bottom gradient for text readability */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent"
            aria-hidden="true"
          />
          {/* Status badge */}
          {effectiveStatus === "ended" ? (
            <div className="absolute right-3 top-3 rounded-full bg-destructive/90 px-3 py-1 text-xs font-semibold text-white shadow backdrop-blur-sm">
              Ended
            </div>
          ) : giveaway.status === "paused" ? (
            <div className="absolute right-3 top-3 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-muted-foreground shadow backdrop-blur-sm">
              Paused
            </div>
          ) : giveaway.status === "live" ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_0_10px_rgba(255,0,0,0.45)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              LIVE
            </span>
          ) : null}
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-balance text-lg font-semibold leading-snug tracking-tight text-foreground">
          {giveaway.title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{giveaway.prizeTitle}</p>

        <div className="mt-auto flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span className={isEnded ? "font-medium text-destructive" : ""}>{timeLabel}</span>
          </div>
          {sold > 0 && cap > 0 ? (
            <span className="text-xs font-medium tabular-nums">{sold} / {cap} sold</span>
          ) : sold > 0 ? (
            <span className="text-xs font-medium tabular-nums">{sold} sold</span>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t border-border/50 bg-muted/20 p-4">
        <div className="flex w-full items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Entry from</div>
            <div className="text-2xl font-bold tracking-tight text-primary">{formatPriceGBP(giveaway.ticketPrice)}</div>
          </div>
        </div>

        {effectiveStatus === "ended" ? (
          mode === "past" ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-xl font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <Link href={`/giveaways/${giveaway.slug}`}>View Results</Link>
            </Button>
          ) : (
            <Button
              size="lg"
              className="w-full rounded-xl font-semibold"
              disabled
            >
              Draw Closed
            </Button>
          )
        ) : giveaway.status !== "live" ? (
          <Button
            size="lg"
            className="w-full rounded-xl font-semibold"
            disabled
          >
            Paused
          </Button>
        ) : (
          <Button
            asChild
            size="lg"
            className="w-full rounded-xl bg-primary font-semibold text-primary-foreground shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5B21B6] hover:shadow-lg active:translate-y-0 active:shadow-sm"
          >
            <Link href={`/giveaways/${giveaway.slug}`}>Enter Now</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
