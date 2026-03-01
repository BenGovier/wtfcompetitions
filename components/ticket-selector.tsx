"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Clock, CalendarClock, Lock, Flame, Zap, Crown } from "lucide-react"
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

  // Sticky CTA visibility
  const qtyRef = useRef<HTMLDivElement>(null)
  const [showStickyCta, setShowStickyCta] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { setMounted(true) }, [])

  // IntersectionObserver for sticky CTA
  useEffect(() => {
    if (!qtyRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(qtyRef.current)
    return () => observer.disconnect()
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
  const isLowRemaining = remaining !== null && remaining <= 20 && remaining > 0

  const useCustomQty = !bundles || selectedBundle === null
  const currentQty = useCustomQty ? customQty : selectedBundle.qty
  const currentTotal = useCustomQty ? customQty * basePrice : selectedBundle.price

  /* ---- Bundle spend anchors (computed from basePrice) ---- */
  const ticketPriceGBP = basePrice
  const spendAnchors = [
    { target: 10, label: "Strong Play", icon: Flame, iconColor: "text-orange-400" },
    { target: 20, label: "Power Move", icon: Zap, iconColor: "text-yellow-300", popular: true },
    { target: 50, label: "High Roller", icon: Crown, iconColor: "text-amber-300" },
  ].map(a => ({
    ...a,
    qty: Math.max(1, Math.ceil(a.target / ticketPriceGBP)),
    spend: Math.max(1, Math.ceil(a.target / ticketPriceGBP)) * ticketPriceGBP,
  }))

  const handleQuantityChange = (delta: number) => {
    setCustomQty((prev) => Math.max(1, Math.min(maxQty, prev + delta)))
    setSelectedBundle(null)
    setQtyBump(true)
    setTimeout(() => setQtyBump(false), 200)
  }

  const handleSetQty = (qty: number) => {
    setCustomQty(Math.max(1, Math.min(maxQty, qty)))
    setSelectedBundle(null)
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
    <div className="space-y-4">

      {/* ---- A) Single Countdown Timer ---- */}
      {endsAtMs && msRemaining > 0 && (
        <>
          {/* Mobile: compressed 2-row grid */}
          <div className="rounded-xl border border-purple-500/30 bg-[#160a26] px-3 py-3 shadow-[0_0_20px_rgba(168,85,247,0.2)] md:hidden" role="timer" aria-label={`Draw ends in ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`}>
            <div className="mb-1.5 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-300">Draw ends in</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { value: days, label: "Days" },
                { value: hours, label: "Hrs" },
                { value: minutes, label: "Min" },
                { value: seconds, label: "Sec" },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center">
                  <div className="flex h-10 w-full items-center justify-center rounded-lg border border-purple-600/30 bg-[#1f1033] shadow-inner">
                    <span className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-xl font-bold tabular-nums text-transparent">
                      {String(value).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="mt-1 text-[9px] font-medium uppercase tracking-wider text-purple-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: 4-block countdown */}
          <div className="hidden rounded-2xl bg-[#160a26] p-5 shadow-[0_0_40px_rgba(168,85,247,0.25)] md:block">
            <div className="mb-2.5 text-center">
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
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-lg border border-purple-600/30 bg-[#1f1033] shadow-inner">
                    <span className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-4xl font-bold tabular-nums text-transparent">
                      {String(value).padStart(2, "0")}
                    </span>
                  </div>
                  <span className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-purple-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ---- Scarcity / Sold Messaging ---- */}
      {hasCapInfo && remaining !== null && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-white/80">
              <span className="font-semibold text-white">{displaySold}</span> tickets secured
            </span>
            {remaining > 0 && (
              <span className={cn(
                "font-medium transition-all duration-300",
                isFinalTickets ? "text-red-400" : isNearingCapacity ? "text-amber-400" : "text-pink-300",
                isLowRemaining && "animate-pulse"
              )}>
                Only <span className={cn("font-bold", isLowRemaining && "bg-gradient-to-r from-[#FFD46A] to-[#F7A600] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(247,166,0,0.6)]")}>{remaining}</span> remaining
              </span>
            )}
            {remaining === 0 && (
              <span className="font-bold text-red-400">Sold out</span>
            )}
          </div>
          <div
            className={cn(
              "w-full overflow-hidden rounded-full transition-all duration-300",
              isFinalTickets ? "h-3 shadow-[0_0_20px_rgba(255,0,80,0.7)]" : "h-2"
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

      {/* ---- D) Bundle Spend Anchor Cards ("Choose your play") ---- */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-semibold text-purple-200">Choose your play</h3>
        <div className="grid grid-cols-3 gap-2">
          {spendAnchors.map(({ label, icon: Icon, iconColor, popular, qty, spend }) => {
            const isActive = customQty === qty && selectedBundle === null
            return (
              <button
                key={label}
                onClick={() => handleSetQty(qty)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition-all duration-200 active:scale-95",
                  isActive
                    ? "border-pink-400 bg-pink-500/15 shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                    : "border-purple-500/25 bg-white/[0.04] hover:border-purple-400/50 hover:bg-white/[0.07]",
                  popular && !isActive && "border-amber-500/40"
                )}
              >
                {popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#F7A600] to-[#FFD46A] px-2 py-0.5 text-[10px] font-bold text-black shadow">
                    Most Popular
                  </div>
                )}
                <Icon className={cn("h-5 w-5", iconColor)} aria-hidden="true" />
                <span className="text-xs font-semibold text-white">{label}</span>
                <span className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-lg font-bold text-transparent">{qty}</span>
                <span className="text-[10px] text-purple-300">{qty === 1 ? "entry" : "entries"}</span>
                <span className="text-[11px] font-medium text-purple-200">{formatGBP(spend)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- Backend bundle selector (if bundles exist from admin) ---- */}
      {bundles && bundles.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-purple-200">Or select a bundle</label>
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

      {/* ---- G) Quantity selector (+/-) underneath bundles ---- */}
      {(!bundles || selectedBundle === null) && (
        <div ref={qtyRef} className="space-y-2">
          <label className="text-sm font-medium text-purple-200">Or choose your own</label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-xl border-purple-500/30 bg-white/5 text-white transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90"
              onClick={() => handleQuantityChange(-1)}
              disabled={customQty <= 1}
            >
              <Minus className="h-6 w-6" />
              <span className="sr-only">Decrease quantity</span>
            </Button>
            <div className={cn(
              "flex-1 text-center transition-transform duration-200",
              qtyBump && "scale-125"
            )}>
              <div className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-5xl font-bold text-transparent drop-shadow-[0_0_10px_rgba(247,166,0,0.4)]">{customQty}</div>
              <div className="text-xs text-purple-300">{customQty === 1 ? "entry" : "entries"}</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-xl border-purple-500/30 bg-white/5 text-white transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90"
              onClick={() => handleQuantityChange(1)}
              disabled={customQty >= maxQty}
            >
              <Plus className="h-6 w-6" />
              <span className="sr-only">Increase quantity</span>
            </Button>
          </div>
          <p className="text-center text-[11px] text-purple-400">More entries = more chances to win</p>
        </div>
      )}

      {/* ---- H) Total and CTA ---- */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-lg">
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
          {isProcessing ? "Starting checkout..." : `Secure ${currentQty} ${currentQty === 1 ? "Entry" : "Entries"}`}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-purple-200">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Instant confirmation &bull; Secure checkout
        </p>
      </div>

      {/* ---- Sticky bottom CTA (mobile only, after scrolling past qty) ---- */}
      {showStickyCta && !isEnded && !isNotStarted && remaining !== 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-purple-500/30 bg-[#0e0618]/95 px-4 py-3 shadow-[0_-4px_30px_rgba(168,85,247,0.3)] backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <div className="text-[10px] font-medium uppercase text-purple-400">Total</div>
              <div className="bg-gradient-to-r from-[#FFD46A] to-[#F7A600] bg-clip-text text-xl font-bold text-transparent">{formatGBP(currentTotal)}</div>
            </div>
            <Button
              size="lg"
              className="flex-1 rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] py-3.5 text-sm font-bold text-black shadow-[0_8px_30px_rgba(255,180,0,0.4)] transition-all active:scale-[0.98]"
              disabled={isProcessing || currentQty < 1}
              onClick={handleEnter}
            >
              {isProcessing ? "Checking out..." : `Secure ${currentQty} ${currentQty === 1 ? "Entry" : "Entries"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
