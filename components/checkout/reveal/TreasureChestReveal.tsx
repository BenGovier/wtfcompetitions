"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import Image from "next/image"

/**
 * TREASURE CHEST REVEAL — premium "open the treasure" reward moment.
 *
 * PRESENTATION ONLY. Every value shown comes directly from the `award` prop the
 * server already decided (via /api/checkout/confirm → confirmPaymentAndAward →
 * the confirm_payment_and_award RPC). This component NEVER decides win/loss,
 * NEVER picks a prize, NEVER allocates tickets, NEVER calls an API/Supabase and
 * NEVER mutates the award. The chest opening is pure theatre over an
 * already-final result.
 *
 * PERFORMANCE / ISOLATION:
 *  - Rendered only for reveal_type === 'treasure_chest', and only ever imported
 *    lazily (next/dynamic, ssr:false) from the success page, so it adds ZERO
 *    bytes to the Normal and Scratch Card reveals.
 *  - Every animation uses transform / opacity ONLY (GPU compositable). Nothing
 *    animates width/height/top/left/box-shadow/filter. No canvas, no WebGL, no
 *    physics, no video, no Lottie, no third-party animation library.
 *  - Fully honours prefers-reduced-motion: no camera move, no shake, opens
 *    instantly, keeps the premium look.
 *  - Assets degrade gracefully (onError) and the whole component is wrapped in a
 *    RevealErrorBoundary on the success page that falls back to the Normal
 *    reveal, so checkout success can never blank out or crash.
 */

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

type Phase = "idle" | "charging" | "bursting" | "revealed"

// Presentation-only reward colour tiers. Derived purely from the value the
// server already sent — this is styling, never prize logic.
type TierKey = "jackpot" | "emerald" | "sapphire" | "credit"

// Cosmetic timeline after the customer taps (ms from tap):
//   0            tap → charging (chest shakes, energy builds)
//   CHARGE_MS    → bursting (lock bursts, flash, lid opens, coins erupt)
//   REVEAL_MS    → revealed (reward plaque rises, celebration)
//   CTA_MS       → the Continue button fades in (never before the reveal ends)
const CHARGE_MS = 1000
const REVEAL_MS = 1550
const CTA_MS = 2750

function usePrefersReducedMotion() {
  const [reduced] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  })
  return reduced
}

/**
 * Map an already-decided prize to a presentation tier + whether it earns
 * confetti. Large cash → gold jackpot (confetti); mid → emerald; small → blue;
 * site credit → purple glow (no confetti). Unknown/physical wins default to the
 * celebratory gold tier.
 */
function getPrizeTier(prize: Prize | null): { key: TierKey; confetti: boolean } {
  if (!prize) return { key: "jackpot", confetti: false }
  const text = `${prize.value_text ?? ""} ${prize.title ?? ""}`.toLowerCase()
  if (text.includes("credit")) return { key: "credit", confetti: false }
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/)
  const amount = match ? Number.parseFloat(match[1]) : 0
  if (amount >= 250) return { key: "jackpot", confetti: true }
  if (amount >= 50) return { key: "emerald", confetti: false }
  if (amount > 0) return { key: "sapphire", confetti: false }
  return { key: "jackpot", confetti: true }
}

// Deterministic pseudo-random so particle layouts are stable between renders
// (no hydration mismatch, no per-frame recompute).
function seeded(count: number, salt: number) {
  return Array.from({ length: count }, (_, i) => {
    const r = (Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453) % 1
    return Math.abs(r)
  })
}

export function TreasureChestReveal({ award }: { award: RevealAward }) {
  const reducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>("idle")
  const [ctaVisible, setCtaVisible] = useState(false)
  const [chestBroken, setChestBroken] = useState(false)
  const [bgBroken, setBgBroken] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const prizes = award.prizes ?? (award.prize ? [award.prize] : [])
  const isWin = award.won && prizes.length > 0
  const primaryPrize = prizes[0] ?? null
  const tier = useMemo(() => getPrizeTier(primaryPrize), [primaryPrize])
  const showConfetti = phase === "revealed" && isWin && tier.confetti && !reducedMotion
  const headingId = "treasure-reveal-heading"

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout)
  }, [])

  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (reducedMotion) return
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(pattern)
        } catch {
          /* ignore unsupported */
        }
      }
    },
    [reducedMotion],
  )

  const handleOpen = useCallback(() => {
    if (phase !== "idle") return

    // Reduced motion: skip the cinematic build-up and reveal instantly.
    if (reducedMotion) {
      setPhase("revealed")
      setCtaVisible(true)
      return
    }

    vibrate(20)
    setPhase("charging")
    timersRef.current.push(
      setTimeout(() => {
        vibrate([0, 40, 30, 60])
        setPhase("bursting")
      }, CHARGE_MS),
      setTimeout(() => setPhase("revealed"), REVEAL_MS),
      setTimeout(() => setCtaVisible(true), CTA_MS),
    )
  }, [phase, reducedMotion, vibrate])

  const start = award.ticket_start
  const end = award.ticket_end
  const hasTickets = typeof start === "number" && typeof end === "number"
  const ticketLabel = hasTickets ? (start === end ? `#${start}` : `#${start}\u2013#${end}`) : null

  const chestOpen = phase === "bursting" || phase === "revealed"
  const revealed = phase === "revealed"
  const cameraClass =
    phase === "idle"
      ? "tcr-cam-idle"
      : phase === "charging"
        ? "tcr-cam-charge"
        : phase === "bursting"
          ? "tcr-cam-burst"
          : "tcr-cam-reveal"

  const dust = useMemo(() => seeded(14, 1), [])
  const coins = useMemo(() => seeded(16, 2), [])
  const sparks = useMemo(() => seeded(12, 3), [])
  const embers = useMemo(() => seeded(10, 4), [])
  const confetti = useMemo(() => seeded(30, 5), [])

  return (
    <main
      aria-labelledby={headingId}
      // Neutral gold until revealed so the aura colour never hints the outcome
      // before the customer opens the chest.
      data-tier={revealed ? tier.key : "idle"}
      className="tcr-root relative flex min-h-[100dvh] w-full flex-col items-center justify-between overflow-hidden px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]"
    >
      <style>{treasureRevealCss}</style>

      {/* ---- Cinematic environment (behind everything) ---- */}
      <div aria-hidden="true" className="tcr-env pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {!bgBroken && (
          <Image
            src="/reveal/treasure-cavern-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="tcr-bg object-cover"
            onError={() => setBgBroken(true)}
          />
        )}
        {/* God-ray fan (opacity + slow rotate only) */}
        <div className="tcr-rays" />
        {/* Drifting fog layers */}
        <div className="tcr-fog tcr-fog-a" />
        <div className="tcr-fog tcr-fog-b" />
        {/* Floating dust motes */}
        {!reducedMotion &&
          dust.map((r, i) => (
            <span
              key={`dust-${i}`}
              className="tcr-dust"
              style={
                {
                  left: `${6 + r * 88}%`,
                  bottom: `${(dust[(i + 5) % dust.length] ?? 0.5) * 70}%`,
                  "--d": `${(r * 6).toFixed(2)}s`,
                  "--dur": `${(7 + r * 6).toFixed(2)}s`,
                  "--sc": (0.5 + r).toFixed(2),
                } as CSSProperties
              }
            />
          ))}
        {/* Vignette + warm floor glow (static) */}
        <div className="tcr-vignette" />
      </div>

      {/* Confetti (large wins only) — CSS particles, transform/opacity only */}
      {showConfetti && (
        <div aria-hidden="true" className="tcr-confetti pointer-events-none fixed inset-0 z-40">
          {confetti.map((r, i) => (
            <span
              key={`cf-${i}`}
              className="tcr-cf-piece"
              style={
                {
                  left: `${(r * 100).toFixed(2)}%`,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  "--d": `${(r * 0.9).toFixed(2)}s`,
                  "--x": `${((confetti[(i + 3) % confetti.length] ?? 0.5) * 60 - 30).toFixed(1)}px`,
                  "--r": `${(r * 720 - 360).toFixed(0)}deg`,
                  "--dur": `${(2.2 + r * 1.2).toFixed(2)}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* ---- Header ---- */}
      <header className="relative z-20 flex flex-shrink-0 flex-col items-center pt-2 text-center">
        <span className="tcr-eyebrow inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200 backdrop-blur-sm">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Tickets confirmed
        </span>
        <h1
          id={headingId}
          className="tcr-title mt-3 text-balance text-2xl font-black uppercase leading-tight tracking-[0.03em] sm:text-3xl"
        >
          {revealed ? (isWin ? "Jackpot unlocked" : "Into the draw") : "Your treasure has arrived"}
        </h1>
        <p className="tcr-sub mt-1 text-pretty text-sm font-medium text-amber-100/80">
          {revealed
            ? isWin
              ? "Your prize is confirmed and saved to your account"
              : "Your tickets are locked into the main draw"
            : "Tap the chest to reveal your prize"}
        </p>
      </header>

      {/* ---- Chest stage (the camera) ---- */}
      <div className="relative z-10 flex w-full flex-1 items-center justify-center">
        <div className={`tcr-cam relative flex items-center justify-center ${cameraClass}`}>
          {/* Aura pad behind the chest */}
          <div aria-hidden="true" className={`tcr-aura ${chestOpen ? "tcr-aura-on" : ""}`} />

          {/* Light burst rays that erupt on open */}
          {chestOpen && <div aria-hidden="true" className="tcr-burst-rays" />}

          <button
            type="button"
            onClick={handleOpen}
            disabled={phase !== "idle"}
            aria-label={revealed ? "Treasure chest opened" : "Tap to open your treasure chest"}
            className="tcr-chest-btn relative flex items-center justify-center rounded-[2rem] outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60 disabled:cursor-default"
          >
            <div
              className={`tcr-chest relative ${phase === "idle" ? "tcr-chest-idle" : ""} ${
                phase === "charging" ? "tcr-chest-shake" : ""
              } ${phase === "bursting" ? "tcr-chest-pop" : ""}`}
            >
              {chestBroken ? (
                // Graceful CSS fallback chest if the artwork fails to load.
                <div className="tcr-chest-fallback" aria-hidden="true">
                  <span className="tcr-chest-fallback-lid" />
                  <span className="tcr-chest-fallback-lock" />
                </div>
              ) : (
                <>
                  <Image
                    src="/reveal/treasure-chest-closed.png"
                    alt=""
                    aria-hidden="true"
                    width={340}
                    height={340}
                    priority
                    className={`tcr-chest-img ${chestOpen ? "tcr-fade-out" : ""}`}
                    onError={() => setChestBroken(true)}
                  />
                  <Image
                    src="/reveal/treasure-chest-open.png"
                    alt="Open treasure chest overflowing with gold"
                    width={340}
                    height={340}
                    className={`tcr-chest-img tcr-chest-img-open ${chestOpen ? "tcr-fade-in" : ""}`}
                  />
                </>
              )}

              {/* Lock glow — pulses idle, flares on charge, explodes on burst */}
              <span
                aria-hidden="true"
                className={`tcr-lock ${phase === "charging" ? "tcr-lock-charge" : ""} ${
                  phase === "bursting" ? "tcr-lock-burst" : ""
                }`}
              />

              {/* White flash that masks the closed→open swap */}
              {phase === "bursting" && <span aria-hidden="true" className="tcr-flash" />}

              {/* Coins + sparks erupting from the chest mouth */}
              {chestOpen && !reducedMotion && (
                <div aria-hidden="true" className="tcr-particles">
                  {coins.map((r, i) => (
                    <span
                      key={`coin-${i}`}
                      className="tcr-coin"
                      style={
                        {
                          "--tx": `${(r * 260 - 130).toFixed(0)}px`,
                          "--ty": `${(-90 - r * 150).toFixed(0)}px`,
                          "--r": `${(r * 720 - 360).toFixed(0)}deg`,
                          "--d": `${(r * 0.18).toFixed(2)}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                  {sparks.map((r, i) => (
                    <span
                      key={`spark-${i}`}
                      className="tcr-spark"
                      style={
                        {
                          "--tx": `${(r * 300 - 150).toFixed(0)}px`,
                          "--ty": `${(-70 - r * 170).toFixed(0)}px`,
                          "--d": `${(r * 0.2).toFixed(2)}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              )}

              {/* Gentle falling embers during the celebration */}
              {revealed && !reducedMotion && (
                <div aria-hidden="true" className="tcr-embers">
                  {embers.map((r, i) => (
                    <span
                      key={`ember-${i}`}
                      className="tcr-ember"
                      style={
                        {
                          left: `${(r * 100).toFixed(1)}%`,
                          "--d": `${(r * 2.2).toFixed(2)}s`,
                          "--dur": `${(2.6 + r * 2).toFixed(2)}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Tap hint (idle only) */}
            {phase === "idle" && (
              <span className="tcr-hint pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-100 backdrop-blur-sm">
                Tap to open
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ---- Reward plaque + actions (only once revealed) ---- */}
      <section
        className="relative z-20 flex w-full max-w-[420px] flex-shrink-0 flex-col items-center"
        aria-live="polite"
      >
        {revealed ? (
          isWin ? (
            <div className="tcr-plaque-rise flex w-full flex-col items-center">
              <div className="tcr-plaque" data-tier={tier.key}>
                <span className="tcr-plaque-eyebrow">
                  {prizes.length > 1 ? `You won ${prizes.length} prizes` : "You've won"}
                </span>

                {primaryPrize?.image_url ? (
                  <span className="tcr-plaque-img">
                    <Image
                      src={primaryPrize.image_url || "/placeholder.svg"}
                      alt={primaryPrize.title}
                      width={72}
                      height={72}
                      className="h-full w-full object-cover"
                      crossOrigin="anonymous"
                    />
                  </span>
                ) : null}

                <span className="tcr-plaque-value">
                  {primaryPrize?.value_text || primaryPrize?.title}
                </span>
                {primaryPrize?.value_text ? (
                  <span className="tcr-plaque-title">{primaryPrize?.title}</span>
                ) : null}
              </div>

              {prizes.length > 1 && (
                <ul className="mt-3 w-full space-y-2">
                  {prizes.slice(1).map((p, i) => (
                    <li
                      key={p.award_id ?? `${p.title}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-amber-300/20 bg-black/40 px-3 py-2 text-left backdrop-blur-sm"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[11px] font-black text-black">
                        {i + 2}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-amber-50">{p.title}</span>
                        {p.value_text ? (
                          <span className="block text-xs text-amber-200/70">{p.value_text}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="tcr-plaque-rise flex w-full flex-col items-center">
              <div className="tcr-plaque" data-tier="credit">
                <span className="tcr-plaque-eyebrow">No instant win this time</span>
                <span className="tcr-plaque-value tcr-plaque-value--sm">You&apos;re in the draw</span>
                <span className="tcr-plaque-title">Good luck in the main event</span>
              </div>
            </div>
          )
        ) : (
          <div className="h-[132px]" aria-hidden="true" />
        )}

        {/* Ticket numbers (from the fixed award) */}
        {revealed && ticketLabel && (
          <div className="tcr-tickets mt-3 w-full rounded-xl border border-amber-300/20 bg-black/40 px-4 py-2.5 text-center backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
              {start === end ? "Your ticket number" : "Your ticket numbers"}
            </p>
            <p className="font-mono text-base font-bold text-amber-50">{ticketLabel}</p>
          </div>
        )}

        {/* CTA — appears only after the reveal animation completes */}
        <div className={`tcr-cta mt-4 w-full ${ctaVisible ? "tcr-cta-in" : "tcr-cta-hidden"}`}>
          <Link
            href={award.campaign_slug ? `/giveaways/${award.campaign_slug}` : "/giveaways"}
            className="tcr-btn-primary flex w-full items-center justify-center rounded-2xl py-4 text-center text-base font-extrabold uppercase tracking-wide text-black transition-transform active:scale-[0.98]"
            tabIndex={ctaVisible ? 0 : -1}
          >
            {award.campaign_slug ? "Play again" : "Browse competitions"}
          </Link>
          <Link
            href="/me"
            className="mt-2 flex w-full items-center justify-center rounded-2xl border border-amber-200/25 py-3 text-center text-sm font-semibold text-amber-100/90 transition-colors hover:bg-white/5"
            tabIndex={ctaVisible ? 0 : -1}
          >
            View my account
          </Link>
        </div>
      </section>
    </main>
  )
}

const CONFETTI_COLORS = ["#FFD700", "#FFC400", "#FBBF24", "#FFE680", "#FFFFFF", "#F59E0B"]

// All animations use ONLY transform / opacity (GPU compositable). Static
// box-shadow / filter are used for depth but are never animated. Everything is
// disabled under prefers-reduced-motion.
const treasureRevealCss = `
.tcr-root {
  background: radial-gradient(circle at 50% 42%, #241a0b 0%, #120d07 55%, #08060a 100%);
  color: #fdf6e3;
  isolation: isolate;
}
.tcr-bg { opacity: 0.85; }
.tcr-env::after { content: ""; }

/* God rays */
.tcr-rays {
  position: absolute;
  left: 50%; top: -10%;
  width: 140%; height: 90%;
  transform: translateX(-50%);
  background: conic-gradient(from 180deg at 50% 0%,
    transparent 0deg, rgba(255,214,120,0.10) 8deg, transparent 16deg,
    transparent 26deg, rgba(255,214,120,0.08) 34deg, transparent 42deg,
    transparent 52deg, rgba(255,214,120,0.10) 60deg, transparent 68deg,
    transparent 300deg);
  mix-blend-mode: screen;
  opacity: 0.7;
  animation: tcr-rays-rot 26s linear infinite;
  transform-origin: 50% 0%;
  will-change: transform;
}
@keyframes tcr-rays-rot {
  from { transform: translateX(-50%) rotate(-6deg); }
  50%  { transform: translateX(-50%) rotate(6deg); }
  to   { transform: translateX(-50%) rotate(-6deg); }
}

/* Fog */
.tcr-fog {
  position: absolute; inset: -20% -30%;
  background: radial-gradient(ellipse 50% 40% at 30% 60%, rgba(255,220,150,0.10), transparent 60%),
              radial-gradient(ellipse 45% 35% at 72% 68%, rgba(255,200,120,0.08), transparent 60%);
  opacity: 0.8; will-change: transform;
}
.tcr-fog-a { animation: tcr-fog-a 22s ease-in-out infinite alternate; }
.tcr-fog-b { animation: tcr-fog-b 28s ease-in-out infinite alternate; }
@keyframes tcr-fog-a { from { transform: translate3d(-3%,0,0); } to { transform: translate3d(4%,-2%,0); } }
@keyframes tcr-fog-b { from { transform: translate3d(3%,1%,0); } to { transform: translate3d(-4%,-1%,0); } }

/* Dust motes */
.tcr-dust {
  position: absolute;
  width: 4px; height: 4px; border-radius: 9999px;
  background: radial-gradient(circle, rgba(255,236,180,0.9), rgba(255,210,120,0));
  opacity: 0; transform: scale(var(--sc, 1));
  animation: tcr-dust-rise var(--dur,9s) ease-in-out var(--d,0s) infinite;
  will-change: transform, opacity;
}
@keyframes tcr-dust-rise {
  0% { opacity: 0; transform: translateY(0) scale(var(--sc,1)); }
  20% { opacity: 0.9; }
  80% { opacity: 0.7; }
  100% { opacity: 0; transform: translateY(-120px) scale(var(--sc,1)); }
}

.tcr-vignette {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 55% at 50% 78%, rgba(255,170,60,0.16), transparent 60%),
    radial-gradient(ellipse 120% 90% at 50% 50%, transparent 45%, rgba(0,0,0,0.55) 100%);
}

/* Camera */
.tcr-cam {
  will-change: transform;
  transition: transform 650ms cubic-bezier(0.2,0.7,0.2,1);
  transform: scale(1);
}
.tcr-cam-idle { animation: tcr-cam-breathe 9s ease-in-out infinite alternate; }
@keyframes tcr-cam-breathe { from { transform: scale(1); } to { transform: scale(1.03); } }
.tcr-cam-charge { transform: scale(1.06); transition-duration: 900ms; }
.tcr-cam-burst { transform: scale(1.10); transition-duration: 220ms; }
.tcr-cam-reveal { transform: scale(1.04); }

/* Aura behind chest */
.tcr-aura {
  position: absolute; width: 320px; height: 320px; border-radius: 9999px;
  background: radial-gradient(circle, rgba(255,196,60,0.45), rgba(255,150,40,0.12) 45%, transparent 70%);
  opacity: 0.5; transform: scale(0.9);
  transition: opacity 400ms ease, transform 400ms ease;
  animation: tcr-aura-pulse 4s ease-in-out infinite;
  will-change: transform, opacity;
}
.tcr-aura-on { opacity: 1; transform: scale(1.15); }
@keyframes tcr-aura-pulse { 0%,100% { opacity: 0.42; } 50% { opacity: 0.62; } }

/* Burst rays that erupt on open */
.tcr-burst-rays {
  position: absolute; width: 460px; height: 460px; left: 50%; top: 46%;
  margin-left: -230px; margin-top: -230px;
  background: conic-gradient(from 0deg,
    rgba(255,220,120,0) 0deg, rgba(255,220,120,0.55) 4deg, rgba(255,220,120,0) 10deg,
    rgba(255,220,120,0) 24deg, rgba(255,220,120,0.5) 28deg, rgba(255,220,120,0) 34deg,
    rgba(255,220,120,0) 50deg, rgba(255,220,120,0.55) 54deg, rgba(255,220,120,0) 60deg,
    rgba(255,220,120,0) 78deg, rgba(255,220,120,0.5) 82deg, rgba(255,220,120,0) 88deg,
    rgba(255,220,120,0) 120deg, rgba(255,220,120,0.5) 124deg, rgba(255,220,120,0) 130deg,
    rgba(255,220,120,0) 300deg);
  mix-blend-mode: screen;
  opacity: 0; transform: scale(0.4) rotate(0deg);
  animation: tcr-burst-rays 1.6s ease-out forwards;
  will-change: transform, opacity;
}
@keyframes tcr-burst-rays {
  0% { opacity: 0; transform: scale(0.4) rotate(0deg); }
  25% { opacity: 0.9; }
  100% { opacity: 0.35; transform: scale(1.1) rotate(40deg); }
}

/* Chest */
.tcr-chest-btn { -webkit-tap-highlight-color: transparent; }
.tcr-chest { position: relative; width: 300px; height: 300px; will-change: transform; }
@media (min-width: 640px) { .tcr-chest { width: 340px; height: 340px; } }
.tcr-chest-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
  filter: drop-shadow(0 24px 40px rgba(0,0,0,0.55)); }
.tcr-chest-img-open { opacity: 0; }
.tcr-fade-out { opacity: 0; transition: opacity 220ms ease 120ms; }
.tcr-fade-in { opacity: 1; animation: tcr-open-pop 520ms cubic-bezier(0.22,1.3,0.36,1) both; }
@keyframes tcr-open-pop { 0% { transform: scale(0.9); } 55% { transform: scale(1.05); } 100% { transform: scale(1); } }

.tcr-chest-idle { animation: tcr-rock 3.4s ease-in-out infinite; }
@keyframes tcr-rock { 0%,100% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } }
.tcr-chest-shake { animation: tcr-shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97) infinite; }
@keyframes tcr-shake {
  0%,100% { transform: translate(0,0) rotate(0); }
  20% { transform: translate(-5px,1px) rotate(-2.4deg); }
  40% { transform: translate(5px,-1px) rotate(2.4deg); }
  60% { transform: translate(-4px,1px) rotate(-1.8deg); }
  80% { transform: translate(4px,-1px) rotate(1.8deg); }
}
.tcr-chest-pop { animation: tcr-chest-jolt 0.4s ease-out; }
@keyframes tcr-chest-jolt { 0% { transform: scale(1.04) translateY(-4px); } 100% { transform: scale(1) translateY(0); } }

/* Lock glow */
.tcr-lock {
  position: absolute; left: 50%; top: 52%; width: 60px; height: 60px;
  margin-left: -30px; margin-top: -30px; border-radius: 9999px;
  background: radial-gradient(circle, rgba(255,236,150,0.9), rgba(255,180,60,0.3) 45%, transparent 70%);
  opacity: 0.45; transform: scale(0.7);
  animation: tcr-lock-pulse 2.2s ease-in-out infinite;
  will-change: transform, opacity;
}
@keyframes tcr-lock-pulse { 0%,100% { opacity: 0.3; transform: scale(0.6); } 50% { opacity: 0.6; transform: scale(0.8); } }
.tcr-lock-charge { animation: tcr-lock-charge 1s ease-in forwards; }
@keyframes tcr-lock-charge { 0% { opacity: 0.4; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1.4); } }
.tcr-lock-burst { animation: tcr-lock-burst 0.5s ease-out forwards; }
@keyframes tcr-lock-burst { 0% { opacity: 1; transform: scale(1.4); } 60% { opacity: 1; transform: scale(2.4); } 100% { opacity: 0; transform: scale(3); } }

/* Flash */
.tcr-flash {
  position: absolute; inset: -40%;
  background: radial-gradient(circle, rgba(255,248,220,0.95), rgba(255,220,140,0.35) 40%, transparent 68%);
  opacity: 0; pointer-events: none;
  animation: tcr-flash 0.5s ease-out forwards; will-change: opacity;
}
@keyframes tcr-flash { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }

/* Coins + sparks */
.tcr-particles, .tcr-embers { position: absolute; inset: 0; pointer-events: none; }
.tcr-coin {
  position: absolute; left: 50%; top: 48%; width: 20px; height: 20px; margin: -10px 0 0 -10px;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, #fff4c2, #f6c945 45%, #a9760c 100%);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.28), inset 0 -3px 4px rgba(120,70,0,0.5);
  opacity: 0; transform: translate(0,0) scale(0.3);
  animation: tcr-coin-fly 1.25s cubic-bezier(0.2,0.7,0.3,1) var(--d,0s) forwards;
  will-change: transform, opacity;
}
@keyframes tcr-coin-fly {
  0% { opacity: 0; transform: translate(0,0) scale(0.3) rotate(0deg); }
  12% { opacity: 1; }
  55% { transform: translate(var(--tx,0), var(--ty,-120px)) scale(1) rotate(var(--r,180deg)); opacity: 1; }
  100% { opacity: 0; transform: translate(calc(var(--tx,0) * 1.15), 210px) scale(0.85) rotate(calc(var(--r,180deg) * 1.5)); }
}
.tcr-spark {
  position: absolute; left: 50%; top: 48%; width: 6px; height: 6px; margin: -3px 0 0 -3px;
  border-radius: 9999px; background: radial-gradient(circle, #fffbe8, rgba(255,220,140,0));
  opacity: 0; transform: translate(0,0) scale(0.5);
  animation: tcr-spark-fly 0.95s ease-out var(--d,0s) forwards; will-change: transform, opacity;
}
@keyframes tcr-spark-fly {
  0% { opacity: 0; transform: translate(0,0) scale(0.4); }
  20% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 0; transform: translate(var(--tx,0), var(--ty,-140px)) scale(0.2); }
}

/* Embers */
.tcr-ember {
  position: absolute; top: -6%; width: 5px; height: 5px; border-radius: 9999px;
  background: radial-gradient(circle, rgba(255,224,150,0.95), rgba(255,180,80,0));
  opacity: 0; animation: tcr-ember-fall var(--dur,3s) linear var(--d,0s) infinite;
  will-change: transform, opacity;
}
@keyframes tcr-ember-fall {
  0% { opacity: 0; transform: translateY(-10px) scale(1); }
  15% { opacity: 0.9; }
  100% { opacity: 0; transform: translateY(300px) scale(0.5); }
}

/* Confetti */
.tcr-cf-piece {
  position: absolute; top: -6vh; width: 10px; height: 14px; border-radius: 2px;
  opacity: 0; transform: translateY(0) rotate(0deg);
  animation: tcr-cf-fall var(--dur,2.6s) linear var(--d,0s) forwards;
  will-change: transform, opacity;
}
@keyframes tcr-cf-fall {
  0% { opacity: 0; transform: translate(0,-6vh) rotate(0deg); }
  10% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--x,0), 108vh) rotate(var(--r,360deg)); }
}

/* Headline */
.tcr-title {
  color: #ffe6a3;
  text-shadow: 0 2px 24px rgba(255,180,60,0.45);
}
.tcr-title, .tcr-sub, .tcr-eyebrow { animation: tcr-soft-in 0.5s ease-out both; }
@keyframes tcr-soft-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

/* Reward plaque */
.tcr-plaque-rise { animation: tcr-plaque-rise 0.65s cubic-bezier(0.22,1.2,0.36,1) both; }
@keyframes tcr-plaque-rise { 0% { opacity: 0; transform: translateY(40px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
.tcr-plaque {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px;
  width: 100%; padding: 16px 20px; border-radius: 20px; text-align: center;
  background: linear-gradient(180deg, rgba(60,45,15,0.92), rgba(24,17,7,0.96));
  border: 2px solid rgba(245,200,90,0.7);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 18px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,236,170,0.35);
}
.tcr-plaque::before {
  content: ""; position: absolute; inset: 4px; border-radius: 15px;
  border: 1px solid rgba(255,236,170,0.18); pointer-events: none;
}
.tcr-plaque-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(255,225,150,0.85); }
.tcr-plaque-img { display: block; height: 68px; width: 68px; overflow: hidden; border-radius: 14px; margin: 6px 0; box-shadow: 0 0 0 2px rgba(245,200,90,0.6); }
.tcr-plaque-value {
  font-size: 34px; line-height: 1.05; font-weight: 900; letter-spacing: -0.01em;
  background: linear-gradient(180deg, #fff6d8, #f6cf6a 55%, #d69a2b);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  text-shadow: 0 2px 18px rgba(255,190,70,0.3);
}
.tcr-plaque-value--sm { font-size: 26px; }
.tcr-plaque-title { margin-top: 2px; font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,232,170,0.8); }

/* Tier accents (colour treatment only — layout unchanged) */
.tcr-root[data-tier="jackpot"] .tcr-aura,
.tcr-plaque[data-tier="jackpot"] { --accent: 255,196,60; }
.tcr-plaque[data-tier="emerald"] { border-color: rgba(52,211,153,0.7); box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 18px 40px rgba(0,0,0,0.5), 0 0 30px rgba(16,185,129,0.25), inset 0 1px 0 rgba(255,236,170,0.35); }
.tcr-plaque[data-tier="sapphire"] { border-color: rgba(96,165,250,0.7); box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 18px 40px rgba(0,0,0,0.5), 0 0 30px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,236,170,0.35); }
.tcr-plaque[data-tier="credit"] { border-color: rgba(196,150,255,0.7); box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 18px 40px rgba(0,0,0,0.5), 0 0 30px rgba(168,85,247,0.28), inset 0 1px 0 rgba(255,236,170,0.35); }
.tcr-root[data-tier="emerald"] .tcr-aura { background: radial-gradient(circle, rgba(52,211,153,0.4), rgba(255,196,60,0.14) 45%, transparent 70%); }
.tcr-root[data-tier="sapphire"] .tcr-aura { background: radial-gradient(circle, rgba(96,165,250,0.4), rgba(255,196,60,0.14) 45%, transparent 70%); }
.tcr-root[data-tier="credit"] .tcr-aura { background: radial-gradient(circle, rgba(196,150,255,0.4), rgba(255,196,60,0.16) 45%, transparent 70%); }

/* Tickets + CTA */
.tcr-tickets { animation: tcr-soft-in 0.5s ease-out 0.15s both; }
.tcr-cta { transition: opacity 400ms ease, transform 400ms ease; }
.tcr-cta-hidden { opacity: 0; transform: translateY(12px); pointer-events: none; }
.tcr-cta-in { opacity: 1; transform: translateY(0); }
.tcr-btn-primary {
  background: linear-gradient(180deg, #ffe08a, #f5b829 55%, #e09a12);
  box-shadow: 0 8px 24px rgba(240,170,20,0.35), inset 0 1px 0 rgba(255,255,255,0.5);
}

/* Fallback chest */
.tcr-chest-fallback { position: relative; width: 240px; height: 200px; border-radius: 16px;
  background: linear-gradient(180deg, #6b4a26, #3c2814); border: 3px solid #caa14a;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.6); }
.tcr-chest-fallback-lid { position: absolute; left: -3px; right: -3px; top: -3px; height: 78px;
  border-radius: 16px 16px 40px 40px / 16px 16px 60px 60px; background: linear-gradient(180deg,#7a5730,#4a3116); border: 3px solid #caa14a; }
.tcr-chest-fallback-lock { position: absolute; left: 50%; top: 64px; width: 34px; height: 40px; margin-left: -17px;
  border-radius: 6px; background: linear-gradient(180deg,#f0cf7a,#b8892e); }

.tcr-hint { animation: tcr-hint 2.4s ease-in-out infinite; }
@keyframes tcr-hint { 0%,100% { opacity: 0.7; transform: translate(-50%,0); } 50% { opacity: 1; transform: translate(-50%,-3px); } }

@media (prefers-reduced-motion: reduce) {
  .tcr-cam-idle, .tcr-chest-idle, .tcr-chest-shake, .tcr-chest-pop, .tcr-rays, .tcr-fog-a, .tcr-fog-b,
  .tcr-dust, .tcr-aura, .tcr-lock, .tcr-hint, .tcr-fade-in, .tcr-plaque-rise, .tcr-tickets,
  .tcr-title, .tcr-sub, .tcr-eyebrow, .tcr-burst-rays, .tcr-coin, .tcr-spark, .tcr-ember, .tcr-cf-piece {
    animation: none !important;
  }
  .tcr-cam { transition: none !important; transform: scale(1) !important; }
  .tcr-cta { transition: none !important; }
  .tcr-chest-img-open.tcr-fade-in { opacity: 1; }
  .tcr-aura-on { opacity: 1; }
}
`
