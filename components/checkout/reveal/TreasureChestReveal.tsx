"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Confetti } from "./Confetti"

type Prize = {
  award_id?: string | null
  title: string
  value_text?: string | null
  image_url?: string | null
}

type RevealAward = {
  confirmed: boolean
  checkout_ref: string
  qty: number
  won: boolean
  prize: Prize | null
  prizes?: Prize[]
  ticket_start?: number | null
  ticket_end?: number | null
  campaign_slug?: string | null
}

function usePrefersReducedMotion() {
  const [reduced] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  })
  return reduced
}

type Phase = "closed" | "unlocking" | "open"

// Length of the shake+glow sequence before the lid opens. Kept short so the
// customer reaches their confirmed result quickly.
const UNLOCK_MS = 1200

/**
 * Treasure Chest reveal. PRESENTATION ONLY: every value shown comes directly
 * from the `award` prop the server already decided. It never decides win/loss,
 * never picks a prize, never calls an API/Supabase, and never mutates the
 * award. The chest opening is pure theatre over an already-final result.
 */
export function TreasureChestReveal({ award }: { award: RevealAward }) {
  const reducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>("closed")
  const [confettiKey, setConfettiKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derive the prize list straight from the fixed award (no generation).
  const prizes = award.prizes ?? (award.prize ? [award.prize] : [])
  const isWin = award.won && prizes.length > 0
  const primaryPrize = prizes[0] ?? null

  const headingId = useMemo(() => "treasure-reveal-heading", [])

  // Clean up any pending unlock timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const openNow = () => {
    setPhase("open")
    if (isWin && !reducedMotion) setConfettiKey((k) => k + 1)
  }

  const handleUnlock = () => {
    if (phase !== "closed") return

    // Reduced motion: skip the shake sequence and open immediately.
    if (reducedMotion) {
      openNow()
      return
    }

    setPhase("unlocking")
    timerRef.current = setTimeout(() => {
      openNow()
    }, UNLOCK_MS)
  }

  const start = award.ticket_start
  const end = award.ticket_end
  const hasTickets = typeof start === "number" && typeof end === "number"
  const ticketLabel = hasTickets
    ? start === end
      ? `#${start}`
      : `#${start}\u2013#${end}`
    : null

  const isOpen = phase === "open"

  return (
    <main
      aria-labelledby={headingId}
      className="tcr-root relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-4 py-12"
    >
      <style>{treasureRevealCss}</style>

      <Confetti fireKey={confettiKey} disabled={reducedMotion} />

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Your tickets are confirmed
        </div>
        <h1
          id={headingId}
          className="mt-3 text-balance text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl"
        >
          {isOpen ? (isWin ? "You struck gold!" : "The chest is open") : "Open your treasure chest"}
        </h1>
        <p className="mt-1 text-pretty text-sm text-white/70">
          {isOpen
            ? "Your instant-win result is shown below"
            : "Tap the chest to reveal your instant-win result"}
        </p>
      </div>

      {/* Chest stage */}
      <div className="tcr-stage relative z-10 mt-8 flex aspect-square w-full max-w-[320px] items-center justify-center">
        {/* Glow pad behind the chest, intensifies while unlocking/open */}
        <div
          aria-hidden="true"
          className={`tcr-glow absolute inset-0 ${
            phase === "unlocking" ? "tcr-glow-rising" : ""
          } ${isOpen && isWin ? "tcr-glow-on" : ""}`}
        />

        <button
          type="button"
          onClick={handleUnlock}
          disabled={phase !== "closed"}
          aria-label={isOpen ? "Treasure chest opened" : "Tap to open your treasure chest"}
          className="tcr-chest-btn relative flex h-full w-full items-center justify-center rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-amber-400/50 disabled:cursor-default"
        >
          {/* Closed chest */}
          <Image
            src="/reveal/treasure-chest-closed.png"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="320px"
            className={`tcr-img object-contain transition-opacity duration-300 ${
              phase === "unlocking" ? "tcr-shake" : ""
            } ${isOpen ? "opacity-0" : "opacity-100"} ${
              phase === "closed" && !reducedMotion ? "tcr-bob" : ""
            }`}
          />
          {/* Open chest (cross-fades in) */}
          <Image
            src="/reveal/treasure-chest-open.png"
            alt="Open treasure chest"
            fill
            sizes="320px"
            className={`tcr-img object-contain transition-opacity duration-500 ${
              isOpen ? "tcr-open-in opacity-100" : "opacity-0"
            }`}
          />

          {/* Tap hint (closed only) */}
          {phase === "closed" && (
            <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
              {reducedMotion ? "Tap to open" : "Tap the chest"}
            </span>
          )}
        </button>
      </div>

      {/* Result (only after the chest is open) */}
      {isOpen && (
        <div className="tcr-result relative z-10 mt-8 flex w-full max-w-[340px] flex-col items-center text-center">
          {isWin ? (
            <>
              <span className="text-xs font-bold uppercase tracking-[0.35em] text-amber-300">
                You&apos;ve won
              </span>

              {primaryPrize?.image_url ? (
                <span className="my-3 block h-24 w-24 overflow-hidden rounded-2xl ring-2 ring-amber-300/60">
                  <Image
                    src={primaryPrize.image_url || "/placeholder.svg"}
                    alt={primaryPrize.title}
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                    crossOrigin="anonymous"
                  />
                </span>
              ) : null}

              <span className="my-1 text-3xl font-black leading-tight text-white">
                {primaryPrize?.value_text || primaryPrize?.title}
              </span>
              {primaryPrize?.value_text && (
                <span className="text-sm font-bold uppercase tracking-[0.25em] text-amber-400">
                  {primaryPrize?.title}
                </span>
              )}

              {prizes.length > 1 && (
                <ul className="mt-5 w-full space-y-2">
                  {prizes.map((p, i) => (
                    <li
                      key={p.award_id ?? `${p.title}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-black">
                        {i + 1}
                      </span>
                      {p.image_url ? (
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-amber-300/50">
                          <Image
                            src={p.image_url || "/placeholder.svg"}
                            alt={p.title}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                            crossOrigin="anonymous"
                          />
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {p.title}
                        </span>
                        {p.value_text ? (
                          <span className="block text-xs text-white/60">{p.value_text}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-lg font-extrabold text-white">No instant win this time</span>
              <span className="text-sm text-white/65">
                Your tickets are still entered into the final draw — good luck!
              </span>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                <CheckIcon /> Entry confirmed
              </span>
            </div>
          )}

          {/* Ticket numbers (from the fixed award) */}
          {ticketLabel && (
            <div className="mt-6 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/60">
                {start === end ? "Your Ticket Number" : "Your Ticket Numbers"}
              </p>
              <p className="font-mono text-lg font-bold text-white">{ticketLabel}</p>
            </div>
          )}

          {/* Routes onward */}
          <div className="mt-6 flex w-full flex-col gap-3">
            {award.campaign_slug ? (
              <Link
                href={`/giveaways/${award.campaign_slug}`}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 py-4 text-center text-base font-extrabold text-black transition-transform active:scale-[0.98]"
              >
                Buy More Tickets
              </Link>
            ) : (
              <Link
                href="/giveaways"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 py-4 text-center text-base font-extrabold text-black transition-transform active:scale-[0.98]"
              >
                Browse Competitions
              </Link>
            )}
            <Link
              href="/me"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/20 py-3 text-center text-sm font-semibold text-white/90 transition-colors hover:bg-white/5"
            >
              View my account
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// All animations use only transform/opacity (GPU-friendly, no layout thrash)
// and are fully disabled under prefers-reduced-motion.
const treasureRevealCss = `
.tcr-root {
  background:
    radial-gradient(circle at 50% 30%, rgba(60, 45, 10, 0.6), transparent 60%),
    linear-gradient(180deg, #0b0b0f 0%, #14110a 60%, #0b0b0f 100%);
}
.tcr-stage { filter: drop-shadow(0 30px 50px rgba(0,0,0,0.5)); }
.tcr-glow {
  border-radius: 9999px;
  background: radial-gradient(circle at 50% 55%, rgba(255, 200, 40, 0.35), transparent 62%);
  opacity: 0.35;
  transform: scale(0.9);
  transition: opacity 300ms ease, transform 300ms ease;
}
.tcr-glow-rising { animation: tcr-glow-rise 1.2s ease-in-out forwards; }
.tcr-glow-on { opacity: 1; transform: scale(1.05); animation: tcr-glow-pulse 2.4s ease-in-out infinite; }
@keyframes tcr-glow-rise {
  0% { opacity: 0.35; transform: scale(0.9); }
  100% { opacity: 0.9; transform: scale(1.05); }
}
@keyframes tcr-glow-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1.0); }
  50% { opacity: 1; transform: scale(1.08); }
}
.tcr-img { will-change: transform, opacity; }
.tcr-bob { animation: tcr-bob 3s ease-in-out infinite; }
@keyframes tcr-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.tcr-shake { animation: tcr-shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) 2; }
@keyframes tcr-shake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20% { transform: translate(-4px, 1px) rotate(-2deg); }
  40% { transform: translate(4px, -1px) rotate(2deg); }
  60% { transform: translate(-3px, 1px) rotate(-1.5deg); }
  80% { transform: translate(3px, -1px) rotate(1.5deg); }
}
.tcr-open-in { animation: tcr-open-pop 0.55s cubic-bezier(0.22, 1.4, 0.36, 1) both; }
@keyframes tcr-open-pop {
  0% { transform: scale(0.86); }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.tcr-result { animation: tcr-result-in 0.5s ease-out both; }
@keyframes tcr-result-in {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .tcr-bob, .tcr-shake, .tcr-open-in, .tcr-glow-rising, .tcr-glow-on, .tcr-result {
    animation: none !important;
  }
  .tcr-glow-on { opacity: 1; transform: scale(1.05); }
}
`
