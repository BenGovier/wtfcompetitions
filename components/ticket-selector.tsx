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
  if (qty >= 7) return { label: "Serious contender", className: "bg-violet-100 text-violet-700 border-violet-200" }
  if (qty >= 4) return { label: "Strong position", className: "bg-amber-50 text-amber-700 border-amber-200" }
  if (qty >= 2) return { label: "Good position", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  return { label: "Basic chance", className: "bg-muted text-muted-foreground border-border" }
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
      <Card className="border-2 border-muted p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Clock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">This draw has ended</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Entries are closed. Winner details will appear below.
            </p>
          </div>
          <Badge variant="secondary" className="mt-1">Draw closed</Badge>
        </div>
      </Card>
    )
  }

  /* ---- Not started state ---- */
  if (isNotStarted) {
    return (
      <Card className="border-2 border-muted p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <CalendarClock className="h-6 w-6 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">This draw hasn{"'"}t started yet</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Check back soon — entries will open shortly.
            </p>
          </div>
          <Badge variant="outline" className="mt-1">Coming soon</Badge>
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
        <div className="space-y-2">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Draw ends in</span>
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
                    "flex h-14 w-14 items-center justify-center rounded-lg bg-foreground/[0.04] text-2xl font-bold tabular-nums transition-transform duration-150 sm:h-16 sm:w-16 sm:text-3xl",
                    label === "Sec" && secondPulse && "scale-105"
                  )}
                >
                  {String(value).padStart(2, "0")}
                </div>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          {/* Time progress bar */}
          {timeProgressPct !== null && (
            <div className="mx-auto h-1 w-3/4 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/20 transition-all duration-1000"
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
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{displaySold}</span> tickets already secured
            </span>
            {remaining > 0 && (
              <span className={cn(
                "font-medium",
                isFinalTickets ? "text-red-600" : isNearingCapacity ? "text-amber-600" : "text-muted-foreground"
              )}>
                Only <span className="font-bold">{remaining}</span> remaining
              </span>
            )}
            {remaining === 0 && (
              <span className="font-bold text-destructive">Sold out</span>
            )}
          </div>
          <div
            className={cn(
              "h-3 w-full overflow-hidden rounded-full",
              isFinalTickets ? "bg-red-100" : isNearingCapacity ? "bg-amber-100" : "bg-muted"
            )}
            role="progressbar"
            aria-valuenow={displaySold}
            aria-valuemin={0}
            aria-valuemax={displayCap!}
            aria-label={`${displaySold} of ${displayCap} tickets sold`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                isFinalTickets ? "bg-red-500" : isNearingCapacity ? "bg-amber-500" : "bg-brand"
              )}
              style={{ width: mounted ? `${soldPct}%` : "0%" }}
            />
          </div>
          {isFinalTickets && remaining > 0 && (
            <p className="text-center text-xs font-semibold text-red-600">Final tickets available</p>
          )}
          {isNearingCapacity && !isFinalTickets && (
            <p className="text-center text-xs font-semibold text-amber-600">Nearing capacity</p>
          )}
        </div>
      )}

      {/* ---- Bundle selector ---- */}
      {bundles && bundles.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Select entry bundle</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {bundles.map((bundle) => {
              const isSelected = selectedBundle?.qty === bundle.qty
              const savingsPercent =
                bundle.qty > 1 ? Math.round((1 - bundle.price / (bundle.qty * basePrice)) * 100) : 0

              return (
                <Card
                  key={bundle.qty}
                  className={cn(
                    "relative cursor-pointer border-2 p-4 transition-all hover:border-brand/50",
                    isSelected && "border-brand bg-brand/5 shadow-sm",
                  )}
                  onClick={() => setSelectedBundle(bundle)}
                >
                  {bundle.label && (
                    <div className="absolute -top-2 right-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                      {bundle.label}
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-2xl font-bold">{bundle.qty}</div>
                    <div className="text-xs text-muted-foreground">{bundle.qty === 1 ? "entry" : "entries"}</div>
                    <div className="mt-2 text-lg font-semibold text-brand">{formatGBP(bundle.price)}</div>
                    {savingsPercent > 0 && (
                      <div className="mt-1 text-xs font-medium text-green-600">Save {savingsPercent}%</div>
                    )}
                  </div>
                </Card>
              )
            })}

            <Card
              className={cn(
                "relative cursor-pointer border-2 p-4 transition-all hover:border-brand/50",
                selectedBundle === null && "border-brand bg-brand/5 shadow-sm",
              )}
              onClick={() => setSelectedBundle(null)}
            >
              <div className="text-center">
                <div className="text-2xl font-bold">{customQty}</div>
                <div className="text-xs text-muted-foreground">Custom amount</div>
                <div className="mt-2 text-sm font-medium text-brand">Choose your own</div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ---- Custom quantity selector ---- */}
      {(!bundles || selectedBundle === null) && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Choose your chances</label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl sm:h-12 sm:w-12"
              onClick={() => handleQuantityChange(-1)}
              disabled={customQty <= 1}
            >
              <Minus className="h-5 w-5" />
              <span className="sr-only">Decrease quantity</span>
            </Button>
            <div className={cn(
              "flex-1 text-center transition-transform duration-150",
              qtyBump && "scale-110"
            )}>
              <div className="text-3xl font-bold">{customQty}</div>
              <div className="text-xs text-muted-foreground">{customQty === 1 ? "entry" : "entries"}</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl sm:h-12 sm:w-12"
              onClick={() => handleQuantityChange(1)}
              disabled={customQty >= maxQty}
            >
              <Plus className="h-5 w-5" />
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
      <div className="space-y-3 rounded-xl border-2 border-brand/20 bg-muted/30 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <div className="text-right">
            <div className="text-3xl font-bold text-brand">{formatGBP(currentTotal)}</div>
            <div className="text-xs text-muted-foreground">
              {currentQty} {currentQty === 1 ? "entry" : "entries"}
            </div>
          </div>
        </div>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <Button
          size="lg"
          className="w-full text-base font-semibold shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm"
          disabled={isProcessing || currentQty < 1 || remaining === 0}
          onClick={handleEnter}
        >
          {isProcessing ? "Starting checkout..." : "Secure My Entries"}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Secure checkout &bull; Instant confirmation
        </p>
      </div>
    </div>
  )
}
