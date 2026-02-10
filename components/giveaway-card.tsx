import type { GiveawayPublic } from "@/lib/types"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock } from "lucide-react"
import Link from "next/link"

interface GiveawayCardProps {
  giveaway: GiveawayPublic
}

export function GiveawayCard({ giveaway }: GiveawayCardProps) {
  const timeRemaining = Math.floor((giveaway.endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <Link href={`/giveaways/${giveaway.slug}`} className="block">
        <div className="relative aspect-[3/2] overflow-hidden bg-muted">
          <img
            src={giveaway.imageUrl || "/placeholder.svg"}
            alt={giveaway.prizeTitle}
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
          {giveaway.status === "ending-soon" && (
            <div className="absolute right-2 top-2 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white">
              Ending Soon
            </div>
          )}
        </div>
      </Link>
      <CardContent className="p-4">
        <h3 className="text-balance text-lg font-semibold leading-snug">{giveaway.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{giveaway.prizeTitle}</p>
        <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>{timeRemaining > 1 ? `${timeRemaining} days left` : "Less than 1 day left"}</span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3 border-t bg-muted/30 p-4">
        <div>
          <div className="text-xs text-muted-foreground">Entry from</div>
          <div className="text-xl font-bold text-brand">${giveaway.ticketPrice.toFixed(2)}</div>
        </div>
        <Button size="lg" className="font-semibold">
          Enter Now
        </Button>
      </CardFooter>
    </Card>
  )
}
