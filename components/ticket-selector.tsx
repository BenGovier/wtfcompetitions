"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CalendarClock, Lock, Flame, Zap, Crown } from "lucide-react"
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
  isFreeEntry?: boolean
  freeEntryLimitPerUser?: number
  wasPricePence?: number | null
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

export function TicketSelector({ basePrice, bundles: rawBundles, campaignId, soldCount, capTotal, startsAt, endsAt, ticketsSold, hardCapTotalTickets, isFreeEntry, freeEntryLimitPerUser, wasPricePence }: TicketSelectorProps) {
  const basePricePence = Math.round(basePrice * 100)
  const normBundles = normaliseBundles(rawBundles, basePricePence)
  const hasBundles = normBundles.length > 0
  const hasSalePrice = wasPricePence != null && wasPricePence > basePricePence

  /* ---- Single source of truth state ---- */
  const [now, setNow] = useState(() => Date.now())
  const [qty, setQty] = useState<number>(1)
  const [selectedBundle, setSelectedBundle] = useState<BundleOption | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
  const [qtyBump, setQtyBump] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Custom-amount slider is collapsed by default when bundles exist, so the
  // bundle cards + Enter Now button surface sooner on mobile.
  const [showCustom, setShowCustom] = useState(false)

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
  const maxQty = remaining !== null ? Math.min(500, remaining) : 500

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
    if (!hasAcceptedTerms) {
      setError("Please confirm you are 18+ and agree to the T&Cs before entering.")
      return
    }
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
      } else if (json.error === 'minimum_total_not_met') {
        setError('Minimum order is £1.00')
      } else {
        setError((json.error as string) || 'Something went wrong. Please try again.')
      }
    } catch {
      setError("We couldn't start checkout. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  /* ---- Custom-amount slider markup (reused inline when there are no bundles,
        or inside the collapsible "Choose custom amount" panel when there are) ---- */
  const customSlider = (
    <div className="space-y-3">
      <label className="text-sm font-medium text-purple-200">
        {hasBundles ? "Or choose your own" : "Pick your entries"}
      </label>

      {/* Central quantity display */}
      <div className={cn(
        "text-center transition-transform duration-200",
        qtyBump && "scale-110"
      )}>
        <div className="bg-gradient-to-b from-[#FFD46A] to-[#F7A600] bg-clip-text text-5xl font-bold text-transparent drop-shadow-[0_0_10px_rgba(247,166,0,0.4)]">{qty}</div>
        <div className="text-xs text-purple-300">{qty === 1 ? "entry" : "entries"}</div>
        {selectedBundle && (
          <div className="mt-0.5 text-[10px] text-pink-300">Bundle selected</div>
        )}
      </div>

      {/* Helper text with drag cue */}
      <p className="text-center text-sm font-medium text-purple-300">Slide me to choose your tickets</p>

      {/* ---- Mobile-friendly quantity slider with wiggle animation ---- */}
      <div className="space-y-3 py-4">
        {/* Animated drag hint */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-purple-400 animate-pulse">
          <span className="inline-block animate-[bounce_1s_ease-in-out_infinite]">&#8592;</span>
          <span>Drag or tap +/-</span>
          <span className="inline-block animate-[bounce_1s_ease-in-out_infinite_0.5s]">&#8594;</span>
        </div>

        <div className="relative flex items-center gap-3 px-2 py-2">
          {/* Minus button */}
          <button
            type="button"
            onClick={() => handleQuantityChange(-1)}
            disabled={qty <= 1}
            aria-label="Decrease tickets"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-900/60 text-2xl font-bold text-purple-200 transition-all hover:bg-purple-800/80 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-purple-900/60 disabled:hover:text-purple-200"
          >
            &minus;
          </button>

          {/* Slider */}
          <input
            type="range"
            min={1}
            max={maxQty}
            value={qty}
            onChange={(e) => {
              const newQty = Number(e.target.value)
              setQty(newQty)
              setSelectedBundle(null)
              setQtyBump(true)
              setTimeout(() => setQtyBump(false), 200)
            }}
            className={cn(
              "flex-1 h-4 appearance-none cursor-pointer rounded-full bg-purple-900/50",
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:h-12",
              "[&::-webkit-slider-thumb]:w-12",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-gradient-to-b",
              "[&::-webkit-slider-thumb]:from-[#FFD46A]",
              "[&::-webkit-slider-thumb]:to-[#F7A600]",
              "[&::-webkit-slider-thumb]:border-2",
              "[&::-webkit-slider-thumb]:border-white/40",
              "[&::-webkit-slider-thumb]:cursor-grab",
              "[&::-webkit-slider-thumb]:shadow-[0_0_20px_rgba(247,166,0,0.6)]",
              "[&::-webkit-slider-thumb]:transition-all",
              "[&::-webkit-slider-thumb]:duration-150",
              "[&::-webkit-slider-thumb]:active:scale-110",
              "[&::-webkit-slider-thumb]:active:cursor-grabbing",
              "[&::-webkit-slider-thumb]:animate-[wiggle_2s_ease-in-out_infinite]",
              "[&::-webkit-slider-thumb]:active:animate-none",
              "[&::-moz-range-thumb]:h-12",
              "[&::-moz-range-thumb]:w-12",
              "[&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:bg-gradient-to-b",
              "[&::-moz-range-thumb]:from-[#FFD46A]",
              "[&::-moz-range-thumb]:to-[#F7A600]",
              "[&::-moz-range-thumb]:border-2",
              "[&::-moz-range-thumb]:border-white/40",
              "[&::-moz-range-thumb]:cursor-grab",
              "[&::-moz-range-thumb]:shadow-[0_0_20px_rgba(247,166,0,0.6)]",
              "[&::-moz-range-thumb]:active:cursor-grabbing"
            )}
            aria-label={`Select quantity: ${qty} tickets`}
          />

          {/* Plus button */}
          <button
            type="button"
            onClick={() => handleQuantityChange(1)}
            disabled={qty >= maxQty}
            aria-label="Increase tickets"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-900/60 text-2xl font-bold text-purple-200 transition-all hover:bg-purple-800/80 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-purple-900/60 disabled:hover:text-purple-200"
          >
            +
          </button>
        </div>

        {/* Range labels */}
        <div className="flex justify-between px-4 text-xs text-purple-400">
          <span>1 ticket</span>
          <span>{maxQty} tickets</span>
        </div>
      </div>

      <p className="text-center text-[11px] text-purple-400">More entries = more chances to win</p>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* ---- Countdown Timer ---- */}
      {endsAtMs && msRemaining > 0 && (
        <>
          {/* Mobile: compact urgency row + thin progress bar (much shorter than
              the four-box grid, so the buying controls surface sooner). */}
          <div className="rounded-xl border border-purple-500/30 bg-[#160a26] px-3 py-2.5 shadow-[0_0_20px_rgba(168,85,247,0.2)] md:hidden" role="timer" aria-label={`Draw ends in ${days} days, ${hours} hours, ${minutes} minutes`}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-purple-100">
                Draw ends in{" "}
                <span className="tabular-nums text-amber-400">{days}d {hours}h</span>
              </span>
              {hasCapInfo && (
                <span className="font-semibold tabular-nums text-amber-400">{Math.round(soldPct)}% sold</span>
              )}
            </div>
            {hasCapInfo && (
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                role="progressbar"
                aria-valuenow={Math.round(soldPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${Math.round(soldPct)}% sold`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700 ease-out"
                  style={{ width: mounted ? `${soldPct}%` : "0%" }}
                />
              </div>
            )}
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

      {/* ---- Sale Price Banner ---- */}
      {hasSalePrice && (
        <div className="rounded-xl border-2 border-green-500/50 bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
          <div className="flex items-center justify-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-white/60 line-through">Was {wasPricePence}p</span>
              <span className="text-2xl font-extrabold text-green-400">{basePricePence}p</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-300 animate-pulse">Tonight only</span>
            </div>
          </div>
        </div>
      )}

      {/* ---- Progress Bar (percentage only) — desktop only; mobile shows the
              compact bar inside the urgency row above. ---- */}
      {hasCapInfo && (
        <div className="hidden space-y-2 md:block">
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
          <h3 className="text-sm font-semibold text-purple-200">Choose your tickets</h3>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
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
                    "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2.5 transition-all duration-200 active:scale-[0.98]",
                    "md:gap-2 md:px-4 md:py-4",
                    isActive
                      ? "scale-[1.02] border-yellow-400 bg-yellow-500/10 shadow-[0_0_30px_rgba(255,215,0,0.25)]"
                      : "border-purple-500/25 bg-white/[0.04] hover:border-purple-400/50 hover:bg-white/[0.07]",
                    isPopular && !isActive && "border-amber-500/50 animate-[bundle-popular-glow_2.5s_ease-in-out_infinite]"
                  )}
                >
                  {/* Icon - hidden on mobile, visible on desktop */}
                  <div className={cn(
                    "hidden md:flex h-10 w-10 items-center justify-center rounded-lg",
                    isActive ? "bg-yellow-500/20" : "bg-white/5"
                  )}>
                    <Icon className={cn("h-5 w-5", isActive ? "text-yellow-400" : iconDef.color)} aria-hidden="true" />
                  </div>

                  {/* Quantity + Popular badge - centered on both mobile and desktop */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-bold text-white md:text-base">{bundle.quantity} Tickets</span>
                    {isPopular && (
                      <span className="text-[9px] font-semibold bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-1.5 py-0.5 rounded-full md:text-[11px] md:px-2">
                        Most Popular
                      </span>
                    )}
                  </div>

                  {/* Save % + Price - centered on both mobile and desktop */}
                  <div className="flex flex-col items-center gap-0.5">
                    {savingsPercent > 0 && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-400/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 md:px-2 md:text-xs">
                        Save {savingsPercent}%
                      </span>
                    )}
                    <div className="flex items-baseline gap-1">
                      {savingsPercent > 0 && (
                        <span className="text-[9px] text-white/40 line-through md:text-xs">{formatGBP(fullPricePence / 100)}</span>
                      )}
                      <span className="text-xs font-bold text-white md:text-lg">{formatGBP(bundle.price_pence / 100)}</span>
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {isActive && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-yellow-500 px-1.5 py-0.5 text-[9px] font-bold text-black shadow md:px-2 md:text-[10px]">
                      Selected
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* When there are NO bundles, the slider is the primary picker and stays
          visible here, above the total. */}
      {!hasBundles && customSlider}

      {/* ---- Total and CTA ---- */}
      <div ref={qtyRef} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-lg">
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

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasAcceptedTerms}
            onChange={(e) => setHasAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-purple-500/50 bg-white/10 accent-amber-500 focus:ring-2 focus:ring-amber-400 focus:ring-offset-0"
          />
          <span className="text-sm text-purple-200">
            I am 18+ years old and agree to the{" "}
            <a
              href="/terms"
              className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
              onClick={(e) => e.stopPropagation()}
            >
              T&Cs
            </a>
          </span>
        </label>

        {totalPence < 100 && (
          <p className="text-sm text-amber-400 text-center font-medium">Minimum order is £1.00</p>
        )}

        <Button
          size="lg"
          className="w-full rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] py-4 text-base font-bold text-black shadow-[0_10px_40px_rgba(255,180,0,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_15px_60px_rgba(255,180,0,0.6)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isProcessing || qty < 1 || remaining === 0 || !hasAcceptedTerms || totalPence < 100}
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

      {/* ---- Optional custom amount (collapsed by default, bundles only) ----
          Keeps the slider available without pushing the Enter Now button down
          the page. Tapping reveals the full slider. */}
      {hasBundles && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowCustom((v) => !v)}
            aria-expanded={showCustom}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-purple-500/30 bg-white/5 py-3 text-sm font-medium text-purple-200 transition-colors hover:bg-white/10"
          >
            {showCustom ? "Hide custom amount" : "Choose custom amount"}
          </button>
          {showCustom && customSlider}
        </div>
      )}

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
              className="flex-1 rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] py-3.5 text-sm font-bold text-black shadow-[0_8px_30px_rgba(255,180,0,0.4)] transition-all active:scale-[0.98] disabled:opacity-60"
              disabled={isProcessing || qty < 1 || !hasAcceptedTerms || totalPence < 100}
              onClick={handleEnter}
            >
              {isProcessing ? "Checking out..." : totalPence < 100 ? "Minimum order £1" : hasAcceptedTerms ? "Enter Now" : "Accept T&Cs above"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
