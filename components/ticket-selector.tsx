"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Sparkles, Clock, CalendarClock } from "lucide-react"
import { cn } from "@/lib/utils"

function formatGBP(amount: number) {
  if (amount < 1) return `${Math.round(amount * 100)}p`
  return `£${amount.toFixed(2)}`
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
}

export function TicketSelector({ basePrice, bundles, campaignId, soldCount, capTotal, startsAt, endsAt }: TicketSelectorProps) {
  /* ---- All hooks must be called unconditionally ---- */
  const [now, setNow] = useState(() => Date.now())
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(
    bundles?.length ? null : { qty: 1, price: basePrice },
  )
  const [customQty, setCustomQty] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000)
    return () => clearInterval(id)
  }, [])

  /* ---- Live time gating ---- */
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null
  const startsAtMs = startsAt ? new Date(startsAt).getTime() : null
  const isEnded = endsAtMs !== null && !isNaN(endsAtMs) && now >= endsAtMs
  const isNotStarted = startsAtMs !== null && !isNaN(startsAtMs) && now < startsAtMs

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

  const hasCapInfo = typeof soldCount === 'number' && typeof capTotal === 'number' && capTotal > 0
  const remaining = hasCapInfo ? Math.max(0, capTotal - soldCount) : null
  const maxQty = remaining !== null ? Math.min(100, remaining) : 100

  const useCustomQty = !bundles || selectedBundle === null
  const currentQty = useCustomQty ? customQty : selectedBundle.qty
  const currentTotal = useCustomQty ? customQty * basePrice : selectedBundle.price

  const handleQuantityChange = (delta: number) => {
    setCustomQty((prev) => Math.max(1, Math.min(maxQty, prev + delta)))
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
        // Create SumUp hosted checkout
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
          // IMPORTANT: top-level hard redirect (SumUp hosted checkout must not be embedded)
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
    <div className="space-y-4">
      {/* Bundle selector */}
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
                    isSelected && "border-brand bg-brand/5",
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
                selectedBundle === null && "border-brand bg-brand/5",
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

      {/* Custom quantity selector */}
      {(!bundles || selectedBundle === null) && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Number of entries</label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => handleQuantityChange(-1)} disabled={customQty <= 1}>
              <Minus className="h-4 w-4" />
              <span className="sr-only">Decrease quantity</span>
            </Button>
            <div className="flex-1 text-center">
              <div className="text-3xl font-bold">{customQty}</div>
              <div className="text-xs text-muted-foreground">{customQty === 1 ? "entry" : "entries"}</div>
            </div>
            <Button variant="outline" size="icon" onClick={() => handleQuantityChange(1)} disabled={customQty >= maxQty}>
              <Plus className="h-4 w-4" />
              <span className="sr-only">Increase quantity</span>
            </Button>
          </div>
        </div>
      )}

      {/* Upsell hint */}
      {currentQty < 10 && (
        <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <div className="text-sm">
              <span className="font-medium">Want a few extra chances?</span>
              <span className="text-muted-foreground">
                {" "}
                Add {10 - currentQty} more {10 - currentQty === 1 ? "entry" : "entries"} if you'd like.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {hasCapInfo && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{soldCount} / {capTotal} sold</span>
            {remaining !== null && remaining > 0 && (
              <span className="text-muted-foreground">Only {remaining} left!</span>
            )}
            {remaining === 0 && (
              <span className="font-semibold text-destructive">Sold out</span>
            )}
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.min(100, (soldCount / capTotal) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Total and CTA */}
      <div className="space-y-3 rounded-lg border-2 border-brand/20 bg-muted/30 p-4">
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
          className="w-full text-base font-semibold"
          disabled={isProcessing || currentQty < 1 || remaining === 0}
          onClick={handleEnter}
        >
          {isProcessing ? "Starting checkout..." : "Enter Now"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">Secure payment • Winner announced after draw</p>
      </div>
    </div>
  )
}
