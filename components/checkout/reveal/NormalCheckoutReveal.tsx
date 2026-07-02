'use client'

/**
 * WTF RESULT REACTOR — the NORMAL checkout reveal experience.
 *
 * PRESENTATION ONLY. Every value shown comes directly from the `award` prop
 * that the server already decided (via /api/checkout/confirm →
 * confirmPaymentAndAward → the confirm_payment_and_award RPC). This component
 * never decides win/loss, never picks a prize, never allocates tickets, never
 * calls an API/Supabase, and never mutates the award. It only stages a
 * cosmetic ~5.6s reveal before showing the already-known result.
 *
 * The scratch-card path is handled elsewhere (ScratchCardReveal); this file is
 * only rendered for reveal_type === 'normal'.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

type Prize = {
  title: string
  value_text?: string | null
  image_url?: string | null
}

export type NormalRevealAward = {
  confirmed: boolean
  checkout_ref: string
  qty: number
  won: boolean
  prize: Prize | null
  prizes?: Prize[]
  ticket_start?: number | null
  ticket_end?: number | null
  campaign_slug?: string | null
  reveal_type?: 'normal' | 'scratch_card' | null
}

type Stage = 'locked' | 'surge' | 'opening' | 'result'

// Cosmetic reveal timeline. The animated "TICKETS ACTIVE" surge is the valuable
// part of the experience, so it runs a full 4 seconds. Final result appears at
// ~5.6s total:
//   Stage 1 ENTRY LOCKED    0ms   – 800ms
//   Stage 2 TICKETS ACTIVE  800ms – 4800ms  (4s surge)
//   Stage 3 RESULT OPENING  4800ms – 5600ms
//   Stage 4 FINAL RESULT    after 5600ms
const T_SURGE = 800
const T_OPENING = 4800
const T_RESULT = 5600

// Individual ticket numbers shown before the drawer collapses the rest.
const TICKET_PREVIEW_COUNT = 10
// Ticket "passes" that surge around the reactor during the reveal.
const ORBIT_COUNT = 6

// Controlled resting positions for the surging ticket passes (px offsets from
// the reactor centre). Kept within ~105px so nothing overflows on iPhone SE;
// the root is overflow-hidden as a hard guarantee against horizontal scroll.
const ORBIT_SLOTS = [
  { x: -104, y: -34, r: -8 },
  { x: 104, y: -46, r: 7 },
  { x: -96, y: 58, r: 6 },
  { x: 100, y: 44, r: -6 },
  { x: -34, y: -104, r: -10 },
  { x: 46, y: 104, r: 9 },
]

function usePrefersReducedMotion() {
  const [reduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  })
  return reduced
}

/** Build the individual ticket numbers for DISPLAY ONLY from the start/end range. */
function useTicketNumbers(award: NormalRevealAward): number[] {
  return useMemo(() => {
    const start = award.ticket_start
    const end = award.ticket_end
    if (typeof start !== 'number' || typeof end !== 'number') return []
    if (end < start) return []
    const MAX = 5000
    const count = Math.min(end - start + 1, MAX)
    return Array.from({ length: count }, (_, i) => start + i)
  }, [award.ticket_start, award.ticket_end])
}

export function NormalCheckoutReveal({ award }: { award: NormalRevealAward }) {
  const reducedMotion = usePrefersReducedMotion()
  const [stage, setStage] = useState<Stage>(reducedMotion ? 'result' : 'locked')

  useEffect(() => {
    if (reducedMotion) {
      setStage('result')
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setStage('surge'), T_SURGE),
      setTimeout(() => setStage('opening'), T_OPENING),
      setTimeout(() => setStage('result'), T_RESULT),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion])

  const prizes = award.prizes ?? (award.prize ? [award.prize] : [])
  const won = award.won && prizes.length > 0
  const tickets = useTicketNumbers(award)
  const ticketCount = tickets.length > 0 ? tickets.length : award.qty

  return (
    <div className="reactor-root relative min-h-screen w-full overflow-hidden bg-black text-white">
      <ReactorStyles />
      <ResultReactorBackground stage={stage} won={won} />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {stage !== 'result' ? (
          <>
            <ReactorHeader stage={stage} qty={award.qty} />
            <div className="relative flex flex-1 items-center justify-center py-8">
              <ReactorCore stage={stage} won={won} />
              <TicketOrbit stage={stage} tickets={tickets} />
            </div>
            <span className="sr-only" role="status">
              Confirming your entry and checking for instant wins.
            </span>
          </>
        ) : (
          <div className="reactor-result flex flex-1 flex-col gap-5 pt-2">
            <ResultImpactPanel won={won} prizes={prizes} qty={ticketCount} />
            <TicketDrawer tickets={tickets} qty={ticketCount} />
            <ReactorActions campaignSlug={award.campaign_slug} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header: phase copy (COPY LOCK)
// ---------------------------------------------------------------------------

function ReactorHeader({ stage, qty }: { stage: Stage; qty: number }) {
  const eyebrow =
    stage === 'locked' ? 'ENTRY LOCKED' : stage === 'surge' ? `${qty} TICKETS ACTIVE` : 'RESULT OPENING'
  const sub = stage === 'locked' ? 'Your tickets are in' : null

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p
        key={eyebrow}
        className="reactor-fade text-2xl font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_0_20px_rgba(245,158,11,0.55)] sm:text-3xl"
      >
        {eyebrow}
      </p>
      {sub && <p className="reactor-fade text-sm font-medium text-amber-200/80">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reactor core: the hero visual during the reveal
// ---------------------------------------------------------------------------

function ReactorCore({ stage, won }: { stage: Stage; won: boolean }) {
  const opening = stage === 'opening'
  const surging = stage === 'surge' || stage === 'opening'

  return (
    <div
      className={`reactor-core-wrap relative flex items-center justify-center transition-transform duration-500 ${
        opening ? 'scale-110' : 'scale-100'
      }`}
    >
      {/* Red energy glow behind the core */}
      <div
        className={`reactor-glow absolute rounded-full bg-red-600/40 blur-3xl transition-all duration-500 ${
          surging ? 'size-72 opacity-90' : 'size-56 opacity-60'
        }`}
      />
      {/* Gold halo */}
      <div className="absolute size-60 rounded-full bg-amber-400/15 blur-2xl" />

      {/* Rotating outer ring (conic sweep) */}
      <div
        className="reactor-ring absolute size-56 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(245,158,11,0.75) 60deg, transparent 150deg, transparent 210deg, rgba(239,68,68,0.7) 270deg, transparent 340deg)',
          maskImage: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
          WebkitMaskImage:
            'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
        }}
        aria-hidden="true"
      />
      {/* Counter-rotating thin ring */}
      <div
        className="reactor-ring-rev absolute size-44 rounded-full border border-amber-300/30"
        aria-hidden="true"
      />

      {/* Core disc */}
      <div className="relative flex size-36 items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_30%,#2a2a2e,#0a0a0b_70%)] shadow-[0_0_50px_rgba(239,68,68,0.45),inset_0_0_30px_rgba(0,0,0,0.9)] ring-2 ring-amber-400/60">
        {/* Glossy top highlight */}
        <div className="pointer-events-none absolute inset-x-4 top-3 h-10 rounded-full bg-white/10 blur-md" />
        <span className="reactor-pulse relative bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-4xl font-black tracking-tighter text-transparent drop-shadow-[0_0_14px_rgba(245,158,11,0.6)]">
          WTF
        </span>
      </div>

      {/* Result-opening light wipe */}
      {opening && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div
            className={`reactor-wipe h-1.5 w-[130%] rounded-full ${
              won
                ? 'bg-gradient-to-r from-transparent via-amber-300 to-transparent'
                : 'bg-gradient-to-r from-transparent via-red-400 to-transparent'
            }`}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ticket orbit: individual ticket "passes" surging around the reactor
// ---------------------------------------------------------------------------

function TicketOrbit({ stage, tickets }: { stage: Stage; tickets: number[] }) {
  if (stage !== 'surge' && stage !== 'opening') return null
  const passes = tickets.slice(0, ORBIT_COUNT)
  if (passes.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      {passes.map((n, i) => {
        const slot = ORBIT_SLOTS[i % ORBIT_SLOTS.length]
        const fading = stage === 'opening'
        return (
          // Wrapper holds the resting slot position (translate + rotate). The
          // inner element runs the entrance animation (fade + lift), so the
          // animation's transform never fights the slot transform.
          <div
            key={n}
            className="absolute"
            style={{
              transform: `translate(${slot.x}px, ${slot.y}px) rotate(${slot.r}deg)`,
              opacity: fading ? 0 : undefined,
              transition: fading ? 'opacity 0.4s ease-out' : undefined,
            }}
          >
            <div className="reactor-pass" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="flex flex-col items-center rounded-lg border border-amber-400/50 bg-black/70 px-2.5 py-1 shadow-[0_0_18px_rgba(239,68,68,0.4)] backdrop-blur-sm">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-400/70">Ticket</span>
                <span className="font-mono text-sm font-bold text-amber-200">#{n}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result impact panel: dominant win / no-win state
// ---------------------------------------------------------------------------

function ResultImpactPanel({ won, prizes, qty }: { won: boolean; prizes: Prize[]; qty: number }) {
  if (won) {
    const prize = prizes[0]
    const multiple = prizes.length > 1
    return (
      <div className="relative flex flex-col items-center gap-4 text-center">
        {/* Explosion glow behind the headline */}
        <div className="pointer-events-none absolute -top-6 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.5),rgba(239,68,68,0.25)_45%,transparent_70%)] blur-2xl" />

        <div className="relative flex flex-col items-center">
          <h1 className="reactor-headline text-5xl font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_0_28px_rgba(245,158,11,0.8)] sm:text-6xl">
            Instant Win
          </h1>
          <p className="mt-2 text-lg font-bold text-amber-300">You&apos;ve won</p>
        </div>

        {/* Primary prize — black glass card with gold edge */}
        <div className="relative w-full overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-zinc-900/90 to-black p-4 shadow-[0_0_40px_rgba(245,158,11,0.3)]">
          {multiple && (
            <span className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-black shadow-lg">
              x{prizes.length}
            </span>
          )}
          {prize.image_url && (
            <div className="mb-3 overflow-hidden rounded-xl border border-amber-400/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prize.image_url || '/placeholder.svg'}
                alt={prize.title}
                className="h-48 w-full bg-black object-contain"
              />
            </div>
          )}
          <h2 className="text-2xl font-extrabold text-white text-balance">{prize.title}</h2>
          {prize.value_text && (
            <p className="mt-1 text-lg font-bold text-amber-300">{prize.value_text}</p>
          )}
        </div>

        {/* Extra prizes (compact) */}
        {multiple && (
          <div className="w-full space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400/90">
              + {prizes.length - 1} more {prizes.length === 2 ? 'prize' : 'prizes'}
            </p>
            {prizes.slice(1).map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-amber-400/25 bg-zinc-900/70 px-3 py-2 text-left"
              >
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_url || '/placeholder.svg'}
                    alt={p.title}
                    className="size-10 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{p.title}</p>
                  {p.value_text && <p className="text-xs text-zinc-400">{p.value_text}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recorded-win reassurance */}
        <p className="text-sm font-medium text-amber-100/80">
          {multiple ? 'Your wins have' : 'Your win has'} been saved to your account.
        </p>
      </div>
    )
  }

  // No-win — still dominant, premium, never grey/dead.
  return (
    <div className="relative flex flex-col items-center gap-4 text-center">
      <div className="pointer-events-none absolute -top-6 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.35),transparent_70%)] blur-2xl" />

      <div className="relative flex flex-col items-center gap-3">
        <h1 className="reactor-headline text-4xl font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_0_26px_rgba(239,68,68,0.7)] sm:text-5xl">
          No Instant Win
        </h1>
        <p className="max-w-[20rem] text-base font-semibold text-zinc-200 text-balance">
          Your tickets are still entered for the main draw.
        </p>
      </div>

      <div className="mt-1 inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-b from-zinc-900/80 to-black px-5 py-3 shadow-[0_0_24px_rgba(245,158,11,0.2)]">
        <span className="text-sm font-bold text-amber-300">
          {qty} {qty === 1 ? 'ticket entered' : 'tickets entered'}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ticket drawer: individual numbers, collapsed by default for large orders
// ---------------------------------------------------------------------------

function TicketDrawer({ tickets, qty }: { tickets: number[]; qty: number }) {
  const [expanded, setExpanded] = useState(false)
  if (tickets.length === 0) return null

  const needsDrawer = tickets.length > TICKET_PREVIEW_COUNT
  const visible = expanded ? tickets : tickets.slice(0, TICKET_PREVIEW_COUNT)

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-amber-400/90">
        Your tickets ({qty})
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((n) => (
          <span
            key={n}
            className="inline-flex min-w-[54px] items-center justify-center rounded-lg border border-amber-400/25 bg-black/50 px-2.5 py-1.5 font-mono text-sm font-bold text-amber-100"
          >
            #{n}
          </span>
        ))}
      </div>

      {needsDrawer && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide tickets' : 'View all tickets'}
          <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Actions: exactly Buy More + My Account
// ---------------------------------------------------------------------------

function ReactorActions({ campaignSlug }: { campaignSlug?: string | null }) {
  const buyMoreHref = campaignSlug ? `/giveaways/${campaignSlug}` : '/giveaways'

  return (
    <div className="flex w-full flex-col gap-3 pt-2">
      <Link
        href={buyMoreHref}
        className="flex h-14 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 text-base font-black uppercase tracking-wide text-black shadow-[0_0_28px_rgba(245,158,11,0.4)] transition-transform active:scale-[0.98]"
      >
        Buy More
      </Link>
      <Link
        href="/me"
        className="flex h-14 w-full items-center justify-center rounded-xl border border-amber-400/40 bg-white/[0.05] text-base font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/10 active:scale-[0.98]"
      >
        My Account
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Background: layered black/red/gold arena (no images, no canvas, no particles)
// ---------------------------------------------------------------------------

function ResultReactorBackground({ stage, won }: { stage: Stage; won: boolean }) {
  const intense = stage === 'result' && won
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Black base */}
      <div className="absolute inset-0 bg-[#060607]" />
      {/* Deep red radial glow from top-right */}
      <div
        className={`absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.4),transparent_65%)] blur-2xl transition-opacity duration-700 ${
          intense ? 'opacity-100' : 'opacity-70'
        }`}
      />
      {/* Gold glow from bottom-centre */}
      <div
        className={`absolute -bottom-28 left-1/2 h-[24rem] w-[28rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.32),transparent_65%)] blur-2xl transition-opacity duration-700 ${
          intense ? 'opacity-100' : 'opacity-70'
        }`}
      />
      {/* Diagonal beams */}
      <div className="absolute -left-1/4 top-0 h-[140%] w-40 rotate-12 bg-gradient-to-b from-amber-300/10 to-transparent blur-xl" />
      <div className="absolute right-0 top-0 h-[140%] w-40 -rotate-12 bg-gradient-to-b from-red-500/10 to-transparent blur-xl" />
      {/* Dotted texture */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_140px_50px_rgba(0,0,0,0.9)]" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scoped animations (lightweight)
// ---------------------------------------------------------------------------

function ReactorStyles() {
  return (
    <style jsx>{`
      @keyframes reactor-fade {
        0% {
          opacity: 0;
          transform: translateY(8px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes reactor-spin {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes reactor-spin-rev {
        to {
          transform: rotate(-360deg);
        }
      }
      @keyframes reactor-pulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.08);
          opacity: 0.85;
        }
      }
      @keyframes reactor-pass-in {
        0% {
          opacity: 0;
          transform: translateY(26px) scale(0.85);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes reactor-wipe {
        0% {
          transform: translateX(-120%);
          opacity: 0;
        }
        30% {
          opacity: 1;
        }
        100% {
          transform: translateX(120%);
          opacity: 0;
        }
      }
      @keyframes reactor-result-in {
        0% {
          opacity: 0;
          transform: translateY(16px) scale(0.98);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes reactor-headline {
        0% {
          opacity: 0;
          transform: scale(0.8);
        }
        60% {
          transform: scale(1.06);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }
      .reactor-fade {
        animation: reactor-fade 0.4s ease-out both;
      }
      .reactor-ring {
        animation: reactor-spin 6s linear infinite;
      }
      .reactor-ring-rev {
        animation: reactor-spin-rev 9s linear infinite;
      }
      .reactor-pulse {
        animation: reactor-pulse 1.6s ease-in-out infinite;
      }
      /* Note: the pass wrapper carries the resting translate/rotate via inline
         style; this inner-free animation only fades + lifts, so the two do not
         fight (the wrapper transform is authoritative for position). */
      .reactor-pass {
        animation: reactor-pass-in 0.4s ease-out both;
      }
      .reactor-wipe {
        animation: reactor-wipe 0.8s ease-in-out both;
      }
      .reactor-result {
        animation: reactor-result-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .reactor-headline {
        animation: reactor-headline 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @media (prefers-reduced-motion: reduce) {
        .reactor-fade,
        .reactor-ring,
        .reactor-ring-rev,
        .reactor-pulse,
        .reactor-pass,
        .reactor-wipe,
        .reactor-result,
        .reactor-headline {
          animation: none !important;
        }
      }
    `}</style>
  )
}
