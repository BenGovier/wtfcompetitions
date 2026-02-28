import type { GiveawayPublic } from "@/lib/types"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import Link from "next/link"

interface GiveawayCardProps {
  giveaway: GiveawayPublic
}

function formatPriceGBP(price: number) {
  if (price < 1) {
    return `${Math.round(price * 100)}p`
  }
  return `£${price.toFixed(2)}`
}

export function GiveawayCard({ giveaway }: GiveawayCardProps) {
  const msLeft = giveaway.endsAt.getTime() - Date.now()
  const isEnded = msLeft <= 0
  const daysLeft = msLeft > 0 ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : 0
  const effectiveStatus = isEnded ? "ended" : giveaway.status

  return (
    <Card className="group overflow-hidden rounded-2xl border border-border shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl">
      <Link href={`/giveaways/${giveaway.slug}`} className="block">
        <div className="relative aspect-[3/2] overflow-hidden rounded-t-2xl bg-muted">
          <img
            src={giveaway.imageUrl || "/placeholder.svg"}
            alt={giveaway.prizeTitle}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-103"
            crossOrigin="anonymous"
          />
          {/* Gradient overlay for text readability */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" aria-hidden="true" />
          {effectiveStatus === "ended" ? (
            <div className="absolute right-3 top-3 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white shadow-sm">
              Ended
            </div>
          ) : giveaway.status === "paused" ? (
            <div className="absolute right-3 top-3 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-sm">
              Paused
            </div>
          ) : null}
        </div>
      </Link>
      <CardContent className="p-4">
        <h3 className="text-balance text-lg font-semibold leading-snug text-foreground">{giveaway.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{giveaway.prizeTitle}</p>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>{isEnded ? "Ended" : daysLeft <= 1 ? "Less than 1 day left" : `${daysLeft} days left`}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 p-4">
        <div className="flex w-full items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Entry from</div>
            <div className="text-2xl font-bold text-primary">{formatPriceGBP(giveaway.ticketPrice)}</div>
          </div>
        </div>
        <Button
          asChild
          size="lg"
          className="w-full rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm transition-all duration-300 hover:bg-[#5B21B6] hover:shadow-md"
          disabled={isEnded || giveaway.status !== "live"}
        >
          <Link href={`/giveaways/${giveaway.slug}`}>Enter Now</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
