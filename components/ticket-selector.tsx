"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Clock, CalendarClock, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

function formatGBP(amount: number) {
  if (amount < 1) return `${Math.round(amount * 100)}p`
  return `£${amount.toFixed(2)}`
}

function getChanceStrength(qty: number): { label: string; className: string } {
  if (qty >= 7) return { label: "Hot streak", className: "bg-gradient-to-r from-purple-600/30 to-pink-500/30 text-pink-200 border-pink-400/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]" }
  if (qty >= 4) return { label: "High roller", className: "bg-gradient-to-r from-purple-600/30 to-pink-500/30 text-pink-200 border-pink-400/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]" }
  if (qty >= 2) return { label: "Double down", className: "bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-purple-200 border-purple-400/30" }
  return { label: "Lucky dip", className: "bg-white/5 text-purple-300 border-purple-500/20" }
}

interface Bundle {
  qty: number
  price: number
  label?: string
}

interface TicketSelectorProps {
  basePrice: number
  bundles?: Bundle[]
  campaignId: string
  soldCount?: number | null
  capTotal?: number | null
  startsAt?: string | null
  endsAt?: string | null
  ticketsSold?: number
  hardCapTotalTickets?: number
}

export function TicketSelector({ basePrice, bundles, campaignId, soldCount, capTotal, startsAt, endsAt, ticketsSold, hardCapTotalTickets }: TicketSelectorProps) {
  /* ---- All hooks called unconditionally ---- */
  const [now, setNow] = useState(() => Date.now())
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(
    bundles?.length ? null : { qty: 1, price: basePrice },
  )
  const [customQty, setCustomQty] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qtyBump, setQtyBump] = useState(false)
  const [mounted, setMounted] = useState(false)
  const prevSecondsRef = useRef<number | null>(null)
  const [secondPulse, setSecondPulse] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  /* ---- Live time gating ---- */
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null
  const startsAtMs = startsAt ? new Date(startsAt).getTime() : null
  const isEnded = endsAtMs !== null && !isNaN(endsAtMs) && now >= endsAtMs
  const isNotStarted = startsAtMs !== null && !isNaN(startsAtMs) && now < startsAtMs

  /* ---- Countdown values ---- */
  const msRemaining = endsAtMs ? Math.max(0, endsAtMs - now) : 0
  const totalSeconds = Math.floor(msRemaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // Pulse animation on seconds change
  useEffect(() => {
    if (prevSecondsRef.current !== null && prevSecondsRef.current !== seconds) {
      setSecondPulse(true)
      const t = setTimeout(() => setSecondPulse(false), 200)
      return () => clearTimeout(t)
    }
    prevSecondsRef.current = seconds
  }, [seconds])

  /* ---- Time progress ---- */
  const timeProgressPct =
    startsAtMs && endsAtMs && endsAtMs > startsAtMs && !isNaN(startsAtMs) && !isNaN(endsAtMs)
      ? Math.min(100, Math.max(0, ((now - startsAtMs) / (endsAtMs - startsAtMs)) * 100))
      : null

  /* ---- Ended state ---- */
  if (isEnded) {
    return (
      <Card className="border border-purple-500/20 bg-[#160a26] p-6 text-center shadow-[0_0_40px_rgba(168,85,247,0.15)]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-900/50">
            <Clock className="h-6 w-6 text-purple-300" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">This draw has ended</h3>
            <p className="mt-1 text-sm leading-relaxed text-purple-200">
              Entries are closed. Winner details will appear below.
            </p>
          </div>
          <Badge variant="secondary" className="mt-1 border-purple-500/30 bg-purple-900/50 text-purple-200">Draw closed</Badge>
        </div>
      </Card>
    )
  }

  /* ---- Not started state ---- */
  if (isNotStarted) {
    return (
      <Card className="border border-purple-500/20 bg-[#160a26] p-6 text-center shadow-[0_0_40px_rgba(168,85,247,0.15)]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-900/50">
            <CalendarClock className="h-6 w-6 text-pink-400" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">This draw hasn{"'"}t started yet</h3>
            <p className="mt-1 text-sm leading-relaxed text-purple-200">
              Check back soon — entries will open shortly.
            </p>
          </div>
          <Badge variant="outline" className="mt-1 border-purple-500/30 text-purple-200">Coming soon</Badge>
        </div>
      </Card>
    )
  }

  // Prefer snapshot-derived props, fall back to live counter
  const displaySold = ticketsSold ?? soldCount ?? 0
  const displayCap = (hardCapTotalTickets && hardCapTotalTickets > 0) ? hardCapTotalTickets : capTotal
  const hasCapInfo = typeof displaySold === 'number' && typeof displayCap === 'number' && displayCap > 0
  const remaining = hasCapInfo ? Math.max(0, displayCap - displaySold) : null
  const maxQty = remaining !== null ? Math.min(100, remaining) : 100

  const soldPct = hasCapInfo ? Math.min(100, (displaySold / displayCap!) * 100) : 0
  const isNearingCapacity = hasCapInfo && remaining !== null && remaining <= displayCap! * 0.25 && remaining > displayCap! * 0.10
  const isFinalTickets = hasCapInfo && remaining !== null && remaining <= displayCap! * 0.10

  const useCustomQty = !bundles || selectedBundle === null
  const currentQty = useCustomQty ? customQty : selectedBundle.qty
  const currentTotal = useCustomQty ? customQty * basePrice : selectedBundle.price

  const chanceStrength = getChanceStrength(currentQty)

  const handleQuantityChange = (delta: number) => {
    setCustomQty((prev) => Math.max(1, Math.min(maxQty, prev + delta)))
    setQtyBump(true)
    setTimeout(() => setQtyBump(false), 200)
  }

  const handleEnter = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, qty: currentQty }),
      })

      if (res.status === 401) {
        const returnTo = window.location.pathname + window.location.search
        window.location.href = `/auth/login?redirect=${encodeURIComponent(returnTo)}`
        return
      }

      let json: Record<string, unknown>
      try {
        json = await res.json()
      } catch {
        setError('Something went wrong. Please try again.')
        return
      }

      if (res.ok && json.ok && json.ref) {
        const sumupRes = await fetch('/api/payments/sumup/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: json.ref }),
        })

        if (sumupRes.status === 401) {
          const returnTo = window.location.pathname + window.location.search
          window.location.href = `/auth/login?redirect=${encodeURIComponent(returnTo)}`
          return
        }

        let sumupJson: Record<string, unknown>
        try {
          sumupJson = await sumupRes.json()
        } catch {
          setError('Something went wrong. Please try again.')
          return
        }

        if (sumupRes.ok && sumupJson.ok && sumupJson.checkoutUrl) {
          const checkoutUrl = sumupJson.checkoutUrl as string
          if (!checkoutUrl || typeof checkoutUrl !== 'string') {
            throw new Error('Missing checkoutUrl')
          }
          window.location.assign(checkoutUrl)
          return
        }

        setError((sumupJson.error as string) || 'Something went wrong. Please try again.')
        return
      }

      if (json.error === 'sold_out' && remaining !== null && remaining > 0) {
        setError(`Only ${remaining} ticket${remaining === 1 ? '' : 's'} left!`)
        setCustomQty(Math.min(customQty, remaining))
        setSelectedBundle(null)
      } else if (json.error === 'sold_out') {
        setError('This giveaway is sold out!')
      } else {
        setError((json.error as string) || 'Something went wrong. Please try again.')
      }
    } catch {
      setError("We couldn't start checkout. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ---- Countdown Module ---- */}
      {endsAtMs && msRemaining > 0 && (
        <div className="rounded-2xl bg-[#160a26] p-6 shadow-[0_0_40px_rgba(168,85,247,0.25)]">
          <div className="mb-3 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-purple-300">Draw ends in</span>
          </div>
          <div className="flex justify-center gap-2" role="timer" aria-label={`Draw ends in ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`}>
            {[
              { value: days, label: "Days" },
              { value: hours, label: "Hrs" },
              { value: minutes, label: "Min" },
              { value: seconds, label: "Sec" },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-lg border border-purple-600/30 bg-[#1f1033] shadow-inner transition-transform duration-150 sm:h-[4.5rem] sm:w-[4.5rem]",
                    label === "Sec" && secondPulse && "scale-105"
                  )}
                >
                  <span className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-3xl font-bold tabular-nums text-transparent sm:text-4xl">
                    {String(value).padStart(2, "0")}
                  </span>
                </div>
                <span className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-purple-300">{label}</span>
              </div>
            ))}
          </div>
          {/* Time progress bar */}
          {timeProgressPct !== null && (
            <div className="mx-auto mt-4 h-1 w-3/4 overflow-hidden rounded-full bg-purple-900/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
                style={{ width: `${timeProgressPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ---- Scarcity / Sold Messaging ---- */}
      {hasCapInfo && remaining !== null && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-white/80">
              <span className="font-semibold text-white">{displaySold}</span> tickets already secured
            </span>
            {remaining > 0 && (
              <span className={cn(
                "font-medium",
                isFinalTickets ? "text-red-400" : isNearingCapacity ? "text-amber-400" : "text-pink-300"
              )}>
                Only <span className="font-bold">{remaining}</span> remaining
              </span>
            )}
            {remaining === 0 && (
              <span className="font-bold text-red-400">Sold out</span>
            )}
          </div>
          <div
            className={cn(
              "w-full overflow-hidden rounded-full transition-all duration-300",
              isFinalTickets ? "h-4 shadow-[0_0_20px_rgba(255,0,80,0.7)]" : "h-3"
            )}
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            role="progressbar"
            aria-valuenow={displaySold}
            aria-valuemin={0}
            aria-valuemax={displayCap!}
            aria-label={`${displaySold} of ${displayCap} tickets sold`}
          >
            <div
              className={cn(
                "relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out",
                "bg-gradient-to-r from-purple-600 via-pink-500 to-red-500"
              )}
              style={{ width: mounted ? `${soldPct}%` : "0%" }}
            >
              <div className="absolute inset-0 animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ backgroundSize: "200% 100%" }} />
            </div>
          </div>
          {isFinalTickets && remaining > 0 && (
            <p className="text-center text-xs font-semibold text-red-400">Final tickets available</p>
          )}
          {isNearingCapacity && !isFinalTickets && (
            <p className="text-center text-xs font-semibold text-amber-400">Nearing capacity</p>
          )}
        </div>
      )}

      {/* ---- Bundle selector ---- */}
      {bundles && bundles.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-purple-200">Select entry bundle</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {bundles.map((bundle) => {
              const isSelected = selectedBundle?.qty === bundle.qty
              const savingsPercent =
                bundle.qty > 1 ? Math.round((1 - bundle.price / (bundle.qty * basePrice)) * 100) : 0

              return (
                <Card
                  key={bundle.qty}
                  className={cn(
                    "relative cursor-pointer border-2 border-purple-500/20 bg-white/5 p-4 backdrop-blur-sm transition-all hover:border-pink-400/50",
                    isSelected && "border-pink-400 bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.2)]",
                  )}
                  onClick={() => setSelectedBundle(bundle)}
                >
                  {bundle.label && (
                    <div className="absolute -top-2 right-2 rounded-full bg-gradient-to-r from-[#F7A600] to-[#FFD46A] px-2 py-0.5 text-xs font-bold text-black">
                      {bundle.label}
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{bundle.qty}</div>
                    <div className="text-xs text-purple-300">{bundle.qty === 1 ? "entry" : "entries"}</div>
                    <div className="mt-2 bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-lg font-semibold text-transparent">{formatGBP(bundle.price)}</div>
                    {savingsPercent > 0 && (
                      <div className="mt-1 text-xs font-medium text-green-400">Save {savingsPercent}%</div>
                    )}
                  </div>
                </Card>
              )
            })}

            <Card
              className={cn(
                "relative cursor-pointer border-2 border-purple-500/20 bg-white/5 p-4 backdrop-blur-sm transition-all hover:border-pink-400/50",
                selectedBundle === null && "border-pink-400 bg-pink-500/10 shadow-[0_0_15px_rgba(236,72,153,0.2)]",
              )}
              onClick={() => setSelectedBundle(null)}
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{customQty}</div>
                <div className="text-xs text-purple-300">Custom amount</div>
                <div className="mt-2 text-sm font-medium text-pink-300">Choose your own</div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ---- Custom quantity selector ---- */}
      {(!bundles || selectedBundle === null) && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-purple-200">Pick your luck</label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-xl border-purple-500/30 bg-white/5 text-white transition-transform duration-150 hover:bg-white/10 hover:text-white active:scale-90 sm:h-14 sm:w-14"
              onClick={() => handleQuantityChange(-1)}
              disabled={customQty <= 1}
            >
              <Minus className="h-6 w-6" />
              <span className="sr-only">Decrease quantity</span>
            </Button>
            <div className={cn(
              "flex-1 text-center transition-transform duration-150",
              qtyBump && "scale-110"
            )}>
              <div className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-5xl font-bold text-transparent">{customQty}</div>
              <div className="text-xs text-purple-300">{customQty === 1 ? "entry" : "entries"}</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-xl border-purple-500/30 bg-white/5 text-white transition-transform duration-150 hover:bg-white/10 hover:text-white active:scale-90 sm:h-14 sm:w-14"
              onClick={() => handleQuantityChange(1)}
              disabled={customQty >= maxQty}
            >
              <Plus className="h-6 w-6" />
              <span className="sr-only">Increase quantity</span>
            </Button>
          </div>
        </div>
      )}

      {/* ---- Chance strength pill ---- */}
      <div className="flex justify-center">
        <span className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200",
          chanceStrength.className,
        )}>
          {chanceStrength.label}
        </span>
      </div>

      {/* ---- Total and CTA ---- */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-lg">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-purple-200">Total</span>
          <div className="text-right">
            <div className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-3xl font-bold text-transparent">{formatGBP(currentTotal)}</div>
            <div className="text-xs text-purple-300">
              {currentQty} {currentQty === 1 ? "entry" : "entries"}
            </div>
          </div>
        </div>

        {error && <div className="rounded-md bg-red-500/20 p-3 text-sm text-red-300">{error}</div>}

        <Button
          size="lg"
          className="w-full rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] py-4 text-base font-bold text-black shadow-[0_10px_40px_rgba(255,180,0,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_15px_60px_rgba(255,180,0,0.6)] active:scale-[0.98]"
          disabled={isProcessing || currentQty < 1 || remaining === 0}
          onClick={handleEnter}
        >
          {isProcessing ? "Starting checkout..." : "Secure My Entries"}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-purple-200">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Secure checkout &bull; Instant confirmation
        </p>
      </div>
    </div>
  )
}
