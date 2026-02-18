"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Minus, Plus, Sparkles } from "lucide-react"
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
  giveawayId: string
}

export function TicketSelector({ basePrice, bundles, campaignId, giveawayId }: TicketSelectorProps) {
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(
    bundles?.length ? null : { qty: 1, price: basePrice },
  )
  const [customQty, setCustomQty] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const useCustomQty = !bundles || selectedBundle === null
  const currentQty = useCustomQty ? customQty : selectedBundle.qty
  const currentTotal = useCustomQty ? customQty * basePrice : selectedBundle.price

  const handleQuantityChange = (delta: number) => {
    setCustomQty((prev) => Math.max(1, Math.min(100, prev + delta)))
  }

  const handleEnter = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, giveawayId, qty: currentQty }),
      })

      if (res.status === 401) {
        const returnTo = window.location.pathname + window.location.search + '#ticket-selector'
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
          const returnTo = window.location.pathname + window.location.search + '#ticket-selector'
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

      setError((json.error as string) || 'Something went wrong. Please try again.')
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
            <Button variant="outline" size="icon" onClick={() => handleQuantityChange(1)} disabled={customQty >= 100}>
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
          disabled={isProcessing || currentQty < 1}
          onClick={handleEnter}
        >
          {isProcessing ? "Starting checkout..." : "Enter Now"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">Secure payment • Winner announced after draw</p>
      </div>
    </div>
  )
}
