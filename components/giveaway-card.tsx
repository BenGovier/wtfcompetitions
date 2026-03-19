import type { GiveawayPublic } from "@/lib/types"
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

  const sold =
    giveaway.ticketsSold ??
    (giveaway.nextTicket != null ? Math.max(0, giveaway.nextTicket - 1) : 0)
  const cap = giveaway.hardCapTotalTickets ?? 0
  const hasCapInfo = cap > 0
  const soldPct = hasCapInfo ? Math.min(100, (sold / cap) * 100) : 0
  const remaining = hasCapInfo ? Math.max(0, cap - sold) : null
  const isSoldOut = hasCapInfo && remaining === 0

  return (
    <div className="bg-gradient-to-b from-[#1a002b] to-[#0a0014] border border-white/10 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(255,215,0,0.08)] transition-all duration-300 hover:scale-[1.02] flex flex-col h-full">
      {/* Image Section */}
      <Link href={`/giveaways/${giveaway.slug}`} className="block">
        <div className="relative aspect-[3/2] overflow-hidden">
          <img
            src={giveaway.imageUrl || "/placeholder.svg"}
            alt={giveaway.prizeTitle}
            className="h-full w-full object-cover"
            crossOrigin="anonymous"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          {/* Status badge */}
          {effectiveStatus === "ended" ? (
            <div className="absolute right-3 top-3 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white shadow backdrop-blur-sm">
              Ended
            </div>
          ) : giveaway.status === "paused" ? (
            <div className="absolute right-3 top-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white/70 shadow backdrop-blur-sm">
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

      {/* Content Section */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <h3 className="text-white text-lg font-semibold">
          {giveaway.title}
        </h3>
        
        <p className="text-white/60 text-sm">
          {timeLabel}
        </p>

        {/* Progress Bar */}
        {hasCapInfo && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium tabular-nums text-white/60">{Math.round(soldPct)}% sold</span>
              {soldPct >= 90 ? (
                <span className="text-[11px] px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-400/20">
                  Almost Gone
                </span>
              ) : soldPct >= 70 ? (
                <span className="text-[11px] px-2 py-1 rounded-full bg-pink-500/15 text-pink-200 border border-pink-400/20">
                  Selling Fast
                </span>
              ) : null}
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${soldPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Price + CTA Section */}
        <div className="pt-2 space-y-2 mt-auto">
          <div className="text-sm text-white/60">Entry from</div>
          <div className="text-xl font-bold text-white">{formatPriceGBP(giveaway.ticketPrice)}</div>

          {effectiveStatus === "ended" ? (
            mode === "past" ? (
              <Link
                href={`/giveaways/${giveaway.slug}`}
                className="block w-full bg-white/10 text-white/70 font-semibold py-3 rounded-lg text-center hover:bg-white/20 transition-all"
              >
                View Results
              </Link>
            ) : (
              <button
                disabled
                className="w-full bg-white/10 text-white/40 py-3 rounded-lg cursor-not-allowed font-semibold"
              >
                Draw Closed
              </button>
            )
          ) : isSoldOut ? (
            <button
              disabled
              className="w-full bg-white/10 text-white/40 py-3 rounded-lg cursor-not-allowed font-semibold"
            >
              Sold Out
            </button>
          ) : giveaway.status !== "live" ? (
            <button
              disabled
              className="w-full bg-white/10 text-white/40 py-3 rounded-lg cursor-not-allowed font-semibold"
            >
              Paused
            </button>
          ) : (
            <Link
              href={`/giveaways/${giveaway.slug}`}
              className="block w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold py-3 rounded-lg shadow-lg hover:scale-[1.02] transition-all text-center"
            >
              Enter Now
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
