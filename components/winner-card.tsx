import type { WinnerSnapshot } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Trophy } from "lucide-react"

interface WinnerCardProps {
  winner: WinnerSnapshot
}

export function WinnerCard({ winner }: WinnerCardProps) {
  const timeAgo = Math.floor((Date.now() - Date.parse(winner.announcedAt)) / (1000 * 60 * 60 * 24))

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarImage src={winner.avatarUrl || "/placeholder.svg"} alt={winner.name} />
            <AvatarFallback>
              {winner.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{winner.name}</h3>
              <Trophy className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground truncate">{winner.prizeTitle}</p>
            <p className="text-xs text-muted-foreground truncate">{winner.giveawayTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(winner.announcedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        {winner.giveawaySlug && (
          <div className="mt-3 flex gap-2">
            <a
              href={`/giveaways/${winner.giveawaySlug}`}
              className="text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
            >
              View giveaway
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
