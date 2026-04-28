"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Clock, CalendarClock, Lock, Flame, Zap, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { FreeEntryInfo } from "@/components/free-entry-info"

function formatGBP(amount: number | null | undefined) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return "\u2014"
  if (n < 1) return `${Math.round(n * 100)}p`
  return `£${n.toFixed(2)}`
}

interface BundleOption {
  quantity: number
  price_pence: number
  label?: string
}

interface LegacyBundle {
  qty: number
  price: number
  label?: string
}

interface TicketSelectorProps {
  basePrice: number
  bundles?: LegacyBundle[]
  campaignId: string
  soldCount?: number | null
  capTotal?: number | null
  startsAt?: string | null
  endsAt?: string | null
  ticketsSold?: number | null
  hardCapTotalTickets?: number | null
}

/**
 * Normalise bundles from either legacy format ({qty, price}) or
 * backend format ({quantity, price_pence}) into a consistent shape.
 */
function normaliseBundles(raw: any[] | undefined | null, basePricePence: number): BundleOption[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return []
  return raw.map((b: any) => {
    if (typeof b.quantity === "number" && typeof b.price_pence === "number") {
      return { quantity: b.quantity, price_pence: b.price_pence, label: b.label }
    }
    // Legacy format: { qty, price (in GBP) }
    return {
      quantity: Number(b.qty ?? b.quantity ?? 1),
      price_pence: Math.round(Number(b.price ?? 0) * 100) || (Number(b.qty ?? 1) * basePricePence),
      label: b.label,
    }
  }).sort((a, b) => a.quantity - b.quantity)
}

export function TicketSelector({ basePrice, bundles: rawBundles, campaignId, soldCount, capTotal, startsAt, endsAt, ticketsSold, hardCapTotalTickets }: TicketSelectorProps) {
  const basePricePence = Math.round(basePrice * 100)
  const normBundles = normaliseBundles(rawBundles, basePricePence)
  const hasBundles = normBundles.length > 0

  /* ---- Single source of truth state ---- */
  const [now, setNow] = useState(() => Date.now())
  const [qty, setQty] = useState<number>(1)
  const [selectedBundle, setSelectedBundle] = useState<BundleOption | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qtyBump, setQtyBump] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Live sold count from API polling
  const [liveSoldCount, setLiveSoldCount] = useState<number | null>(null)

  // Sticky CTA visibility
  const qtyRef = useRef<HTMLDivElement>(null)
  const [showStickyCta, setShowStickyCta] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { setMounted(true) }, [])

  // Poll live sold count every 15 seconds
  useEffect(() => {
    if (!campaignId) return

    const fetchLiveCount = async () => {
      try {
        const res = await fetch(`/api/giveaways/${campaignId}/live-count`)
        if (res.ok) {
          const json = await res.json()
          if (json.ok && typeof json.soldCount === 'number') {
            setLiveSoldCount(json.soldCount)
          }
        }
      } catch {
        // Silently keep last known count
      }
    }

    // Initial fetch
    fetchLiveCount()

    // Poll every 15 seconds
    const interval = setInterval(fetchLiveCount, 15000)
    return () => clearInterval(interval)
  }, [campaignId])

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

  // Auto-select default bundle (highest quantity) when bundles are available
  useEffect(() => {
    if (hasBundles && selectedBundle === null && normBundles.length > 0) {
      // Select the bundle with the highest quantity
      const defaultBundle = normBundles.reduce((max, b) => b.quantity > max.quantity ? b : max, normBundles[0])
      setSelectedBundle(defaultBundle)
      setQty(defaultBundle.quantity)
    }
  }, [hasBundles, normBundles.length]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Prefer live polled count, fall back to snapshot-derived props
  const displaySold = liveSoldCount ?? soldCount ?? ticketsSold ?? 0
  const displayCap = (hardCapTotalTickets && hardCapTotalTickets > 0) ? hardCapTotalTickets : capTotal
  const hasCapInfo = typeof displaySold === 'number' && typeof displayCap === 'number' && displayCap > 0
  const remaining = hasCapInfo ? Math.max(0, displayCap - displaySold) : null
  const maxQty = remaining !== null ? Math.min(100, remaining) : 100

  const soldPct = hasCapInfo ? Math.min(100, (displaySold / displayCap!) * 100) : 0

  /* ---- Correct total calculation ---- */
  const totalPence = selectedBundle ? selectedBundle.price_pence : qty * basePricePence
  const totalGBP = totalPence / 100

  /* ---- Icons for bundle tiles ---- */
  const bundleIcons = [
    { icon: Flame, color: "text-orange-400" },
    { icon: Zap, color: "text-yellow-300" },
    { icon: Crown, color: "text-amber-300" },
  ]

  /* ---- Handlers ---- */
  const handleSelectBundle = (bundle: BundleOption) => {
    setSelectedBundle(bundle)
    setQty(bundle.quantity)
    setQtyBump(true)
    setTimeout(() => setQtyBump(false), 200)
  }

  const handleQuantityChange = (delta: number) => {
    setQty((prev) => Math.max(1, Math.min(maxQty, prev + delta)))
    setSelectedBundle(null)
    setQtyBump(true)
    setTimeout(() => setQtyBump(false), 200)
  }

  const handleEnter = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const payload: { campaignId: string; qty: number; bundlePricePence?: number } = {
        campaignId,
        qty,
      }
      if (selectedBundle) {
        payload.bundlePricePence = selectedBundle.price_pence
      }

      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        setQty(Math.min(qty, remaining))
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

      {/* ---- Countdown Timer ---- */}
      {endsAtMs && msRemaining > 0 && (
        <>
          {/* Mobile: compressed grid */}
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

      {/* ---- Progress Bar (percentage only) ---- */}
      {hasCapInfo && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-amber-400">{Math.round(soldPct)}% sold</span>
            {remaining === 0 && (
              <span className="font-bold text-red-400">Sold out</span>
            )}
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            role="progressbar"
            aria-valuenow={Math.round(soldPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(soldPct)}% sold`}
          >
            <div
              className="relative h-full overflow-hidden rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: mounted ? `${soldPct}%` : "0%" }}
            >
              <div className="absolute inset-0 animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ backgroundSize: "200% 100%" }} />
            </div>
          </div>
        </div>
      )}

      {/* ---- Bundle tiles (only when bundles exist) ---- */}
      {hasBundles && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-purple-200">Choose your play</h3>
          <div className="flex flex-col gap-2.5">
            {normBundles.map((bundle, i) => {
              const isActive = selectedBundle?.quantity === bundle.quantity && selectedBundle?.price_pence === bundle.price_pence
              const fullPricePence = bundle.quantity * basePricePence
              const savingsPercent = bundle.quantity > 1
                ? Math.round((1 - (bundle.price_pence / fullPricePence)) * 100)
                : 0
              const iconDef = bundleIcons[i % bundleIcons.length]
              const Icon = iconDef.icon
              const isPopular = bundle.label?.toLowerCase().includes('popular') || (i === 1 && normBundles.length >= 2)

              return (
                <button
                  key={`${bundle.quantity}-${bundle.price_pence}`}
                  onClick={() => handleSelectBundle(bundle)}
                  className={cn(
                    "relative flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-200 active:scale-[0.98]",
                    isActive
                      ? "scale-[1.02] border-yellow-400 bg-yellow-500/10 shadow-[0_0_30px_rgba(255,215,0,0.25)]"
                      : "border-purple-500/25 bg-white/[0.04] hover:border-purple-400/50 hover:bg-white/[0.07]",
                    isPopular && !isActive && "border-amber-500/40"
                  )}
                >
                  {/* Left side: Icon + Quantity + Label */}
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      isActive ? "bg-yellow-500/20" : "bg-white/5"
                    )}>
                      <Icon className={cn("h-5 w-5", isActive ? "text-yellow-400" : iconDef.color)} aria-hidden="true" />
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-base font-bold text-white">{bundle.quantity} Tickets</span>
                      {isPopular && (
                        <span className="text-[11px] font-semibold bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-2 py-0.5 rounded-full">
                          Most Popular
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Price block */}
                  <div className="flex flex-col items-end gap-0.5">
                    {savingsPercent > 0 && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-xs font-bold text-emerald-300">
                        Save {savingsPercent}%
                      </span>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      {savingsPercent > 0 && (
                        <span className="text-xs text-white/40 line-through">{formatGBP(fullPricePence / 100)}</span>
                      )}
                      <span className="text-lg font-bold text-white">{formatGBP(bundle.price_pence / 100)}</span>
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {isActive && (
                    <div className="absolute -top-2 right-3 whitespace-nowrap rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold text-black shadow">
                      Selected
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ---- Quantity selector (+/-) ---- */}
      <div ref={qtyRef} className="space-y-2">
        <label className="text-sm font-medium text-purple-200">
          {hasBundles ? "Or choose your own" : "Pick your entries"}
        </label>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-xl border-purple-500/30 bg-white/5 text-white transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90"
            onClick={() => handleQuantityChange(-1)}
            disabled={qty <= 1}
          >
            <Minus className="h-6 w-6" />
            <span className="sr-only">Decrease quantity</span>
          </Button>
          <div className={cn(
            "flex-1 text-center transition-transform duration-200",
            qtyBump && "scale-125"
          )}>
            <div className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-5xl font-bold text-transparent drop-shadow-[0_0_10px_rgba(247,166,0,0.4)]">{qty}</div>
            <div className="text-xs text-purple-300">{qty === 1 ? "entry" : "entries"}</div>
            {selectedBundle && (
              <div className="mt-0.5 text-[10px] text-pink-300">Bundle selected</div>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-xl border-purple-500/30 bg-white/5 text-white transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90"
            onClick={() => handleQuantityChange(1)}
            disabled={qty >= maxQty}
          >
            <Plus className="h-6 w-6" />
            <span className="sr-only">Increase quantity</span>
          </Button>
        </div>
        <p className="text-center text-[11px] text-purple-400">More entries = more chances to win</p>
      </div>

      {/* ---- Total and CTA ---- */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-lg">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-purple-200">Total</span>
          <div className="text-right">
            <div className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-3xl font-bold text-transparent">{formatGBP(totalGBP)}</div>
            <div className="text-xs text-purple-300">
              {qty} {qty === 1 ? "entry" : "entries"}
            </div>
          </div>
        </div>

        {error && <div className="rounded-md bg-red-500/20 p-3 text-sm text-red-300">{error}</div>}

        <Button
          size="lg"
          className="w-full rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] py-4 text-base font-bold text-black shadow-[0_10px_40px_rgba(255,180,0,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_15px_60px_rgba(255,180,0,0.6)] active:scale-[0.98]"
          disabled={isProcessing || qty < 1 || remaining === 0}
          onClick={handleEnter}
        >
          {isProcessing ? "Starting checkout..." : "Enter Now"}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-purple-200">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Instant confirmation &bull; Secure checkout
        </p>

        <div className="text-center">
          <FreeEntryInfo />
        </div>
      </div>

      {/* ---- Sticky bottom CTA (mobile only, after scrolling past qty) ---- */}
      {showStickyCta && !isEnded && !isNotStarted && remaining !== 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-purple-500/30 bg-[#0e0618]/95 px-4 py-3 shadow-[0_-4px_30px_rgba(168,85,247,0.3)] backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <div className="text-[10px] font-medium uppercase text-purple-400">Total</div>
              <div className="bg-gradient-to-r from-[#FFD46A] to-[#F7A600] bg-clip-text text-xl font-bold text-transparent">{formatGBP(totalGBP)}</div>
            </div>
            <Button
              size="lg"
              className="flex-1 rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] py-3.5 text-sm font-bold text-black shadow-[0_8px_30px_rgba(255,180,0,0.4)] transition-all active:scale-[0.98]"
              disabled={isProcessing || qty < 1}
              onClick={handleEnter}
            >
              {isProcessing ? "Checking out..." : "Enter Now"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
