'use client'

/**
 * WTF Prize Arena — the NORMAL checkout reveal experience.
 *
 * PRESENTATION ONLY. Every value shown comes directly from the `award` prop
 * that the server already decided (via /api/checkout/confirm →
 * confirmPaymentAndAward → the confirm_payment_and_award RPC). This component
 * never decides win/loss, never picks a prize, never allocates tickets, never
 * calls an API/Supabase, and never mutates the award. It only stages a short,
 * cosmetic ~2.5s reveal before showing the already-known result.
 *
 * The scratch-card path is handled elsewhere (ScratchCardReveal); this file is
 * only rendered for reveal_type === 'normal'.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Trophy, Ticket, ChevronDown, ScanLine } from 'lucide-react'

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

type Phase = 'locked' | 'tickets' | 'scan' | 'result'

// Reveal timeline (cosmetic). Final result appears at ~2.5s.
const PHASE_TICKETS_MS = 600
const PHASE_SCAN_MS = 1400
const PHASE_RESULT_MS = 2500

// Number of ticket chips shown before the drawer collapses the rest.
const TICKET_PREVIEW_COUNT = 10

const SCAN_MESSAGES = ['Checking your tickets…', 'Scanning for instant wins…']

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
    // Guard against pathological ranges; the backend allocates a bounded qty.
    const MAX = 5000
    const count = Math.min(end - start + 1, MAX)
    return Array.from({ length: count }, (_, i) => start + i)
  }, [award.ticket_start, award.ticket_end])
}

export function NormalCheckoutReveal({ award }: { award: NormalRevealAward }) {
  const reducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'result' : 'locked')
  const [scanStep, setScanStep] = useState(0)

  useEffect(() => {
    if (reducedMotion) {
      setPhase('result')
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setPhase('tickets'), PHASE_TICKETS_MS),
      setTimeout(() => setPhase('scan'), PHASE_SCAN_MS),
      setTimeout(() => setScanStep(1), (PHASE_SCAN_MS + PHASE_RESULT_MS) / 2),
      setTimeout(() => setPhase('result'), PHASE_RESULT_MS),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion])

  const prizes = award.prizes ?? (award.prize ? [award.prize] : [])
  const won = award.won && prizes.length > 0

  return (
    <div className="arena-root relative -mx-4 -my-4 w-[calc(100%+2rem)] overflow-hidden rounded-2xl bg-[#070708] px-5 py-8">
      <ArenaStyles />
      <ArenaBackdrop won={won} phase={phase} />

      <div className="relative z-10 mx-auto flex w-full max-w-[430px] flex-col items-center gap-6">
        {phase !== 'result' ? (
          <ArenaRevealSequence phase={phase} scanStep={scanStep} award={award} />
        ) : (
          <>
            <ResultPanel award={award} won={won} prizes={prizes} />
            <TicketDrawer award={award} />
            <CheckoutRevealActions award={award} />
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reveal sequence (Phases 1–3): locked → tickets → scan
// ---------------------------------------------------------------------------

function RevealStageHeader({ phase }: { phase: Phase }) {
  const pill =
    phase === 'locked' ? 'PAYMENT CONFIRMED' : phase === 'tickets' ? 'TICKETS LOADED' : 'INSTANT WIN CHECK'

  const headline =
    phase === 'locked' ? "You're in." : phase === 'tickets' ? 'Tickets loaded' : 'Scanning the arena'

  const sub =
    phase === 'locked'
      ? 'Your tickets have been secured.'
      : phase === 'tickets'
        ? 'Preparing your reveal…'
        : 'Hold tight — results incoming.'

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
        <CheckCircle2 className="size-3.5" />
        {pill}
      </span>
      <h1 key={headline} className="arena-fade text-3xl font-extrabold tracking-tight text-white text-balance">
        {headline}
      </h1>
      <p className="text-sm text-zinc-400">{sub}</p>
    </div>
  )
}

function ArenaRevealSequence({
  phase,
  scanStep,
  award,
}: {
  phase: Phase
  scanStep: number
  award: NormalRevealAward
}) {
  const tickets = useTicketNumbers(award)
  const previewTickets = tickets.slice(0, 6)
  const scanning = phase === 'scan'

  return (
    <div className="flex w-full flex-col items-center gap-6 py-2">
      <RevealStageHeader phase={phase} />

      {/* Arena panel: ticket tiles loading in, with a scanner beam during scan */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/60 p-5 shadow-[0_0_40px_rgba(239,68,68,0.15)]">
        {scanning && <div className="arena-scan-beam pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-amber-300/50 to-transparent" />}

        <div className="relative flex flex-col items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-600 shadow-[0_0_25px_rgba(239,68,68,0.5)]">
            {scanning ? (
              <ScanLine className="arena-pulse size-7 text-black" />
            ) : (
              <Ticket className="size-7 text-black" />
            )}
          </div>

          {/* Ticket chips animating in */}
          {previewTickets.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {previewTickets.map((n, i) => (
                <span
                  key={n}
                  className="arena-chip-in inline-flex min-w-[52px] items-center justify-center rounded-lg border border-amber-400/30 bg-black/50 px-2.5 py-1.5 font-mono text-sm font-bold text-amber-200"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  #{n}
                </span>
              ))}
              {tickets.length > previewTickets.length && (
                <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm font-semibold text-zinc-400">
                  +{tickets.length - previewTickets.length}
                </span>
              )}
            </div>
          ) : (
            <p className="font-mono text-lg font-bold text-white">
              {award.qty} {award.qty === 1 ? 'ticket' : 'tickets'}
            </p>
          )}

          {scanning && (
            <p key={scanStep} className="arena-fade text-sm font-medium text-amber-300">
              {SCAN_MESSAGES[Math.min(scanStep, SCAN_MESSAGES.length - 1)]}
            </p>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2" aria-hidden="true">
        {(['locked', 'tickets', 'scan'] as const).map((p, i) => {
          const order = { locked: 0, tickets: 1, scan: 2, result: 3 } as const
          const active = order[phase] >= i
          return (
            <div
              key={p}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                active
                  ? 'w-6 bg-gradient-to-r from-red-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : 'w-1.5 bg-zinc-700'
              }`}
            />
          )
        })}
      </div>

      <span className="sr-only" role="status">
        Confirming your entry and checking for instant wins.
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Phase 4: final result
// ---------------------------------------------------------------------------

function ResultPanel({
  award,
  won,
  prizes,
}: {
  award: NormalRevealAward
  won: boolean
  prizes: Prize[]
}) {
  if (won) {
    const prize = prizes[0]
    return (
      <div className="arena-result flex w-full flex-col items-center gap-4 text-center">
        <div className="arena-burst relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-orange-500 to-red-600 shadow-[0_0_45px_rgba(245,158,11,0.6)]">
          <Trophy className="size-12 text-black drop-shadow" />
          {prizes.length > 1 && (
            <span className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-white text-sm font-bold text-red-600 ring-2 ring-amber-400">
              x{prizes.length}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="arena-shimmer text-sm font-extrabold uppercase tracking-[0.3em]">INSTANT WIN</p>
          <p className="text-base font-semibold text-white">
            You&apos;ve won an instant prize!
          </p>
        </div>

        <div className="w-full rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-zinc-900 to-black p-4 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
          {prize.image_url && (
            <div className="mb-3 overflow-hidden rounded-xl border border-amber-400/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prize.image_url || '/placeholder.svg'}
                alt={prize.title}
                className="h-44 w-full bg-black object-contain"
              />
            </div>
          )}
          <h2 className="text-2xl font-extrabold text-white text-balance drop-shadow-[0_0_18px_rgba(239,68,68,0.4)]">
            {prize.title}
          </h2>
          {prize.value_text && (
            <p className="mt-1 text-base font-semibold text-amber-300">{prize.value_text}</p>
          )}
        </div>

        {/* Reassurance: the win is recorded and where to find it. */}
        <div className="flex w-full items-start gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-left">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-100">
            {prizes.length > 1 ? 'Your wins have' : 'Your win has'} been saved to your account. View{' '}
            {prizes.length > 1 ? 'them' : 'it'} anytime in{' '}
            <span className="font-bold text-white">My Account</span>.
          </p>
        </div>

        {prizes.length > 1 && (
          <div className="w-full space-y-2">
            <p className="text-center text-xs font-medium uppercase tracking-wider text-amber-400/90">
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
                    className="size-10 rounded-lg object-cover"
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
      </div>
    )
  }

  // No-win final state
  return (
    <div className="arena-result flex w-full flex-col items-center gap-4 text-center">
      <div className="flex size-20 items-center justify-center rounded-2xl border border-amber-400/40 bg-gradient-to-br from-zinc-900 to-black shadow-[0_0_28px_rgba(245,158,11,0.25)]">
        <Ticket className="size-10 text-amber-400" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-amber-300">NO INSTANT WIN</p>
        <h2 className="text-2xl font-bold text-white text-balance">
          Your tickets are still entered for the main draw.
        </h2>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-zinc-900/70 px-5 py-3">
        <Ticket className="size-5 text-amber-400" />
        <span className="text-sm font-semibold text-white">
          {award.qty} {award.qty === 1 ? 'ticket entered' : 'tickets entered'}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ticket drawer: individual numbers, collapsed for large orders
// ---------------------------------------------------------------------------

function TicketDrawer({ award }: { award: NormalRevealAward }) {
  const tickets = useTicketNumbers(award)
  const [expanded, setExpanded] = useState(false)

  if (tickets.length === 0) return null

  const needsDrawer = tickets.length > TICKET_PREVIEW_COUNT
  const visible = expanded ? tickets : tickets.slice(0, TICKET_PREVIEW_COUNT)

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-400/90">
        Your tickets ({tickets.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((n) => (
          <span
            key={n}
            className="inline-flex min-w-[52px] items-center justify-center rounded-lg border border-amber-400/25 bg-black/50 px-2.5 py-1.5 font-mono text-sm font-bold text-amber-100"
          >
            #{n}
          </span>
        ))}
      </div>

      {needsDrawer && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
// CTAs: exactly Buy More + My Account
// ---------------------------------------------------------------------------

function CheckoutRevealActions({ award }: { award: NormalRevealAward }) {
  const buyMoreHref = award.campaign_slug ? `/giveaways/${award.campaign_slug}` : '/giveaways'

  return (
    <div className="flex w-full flex-col gap-3">
      <Button
        asChild
        className="w-full border-0 bg-gradient-to-r from-amber-500 to-red-600 py-6 text-base font-bold text-white shadow-lg shadow-red-500/30 hover:from-amber-600 hover:to-red-700"
      >
        <Link href={buyMoreHref}>Buy More</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        className="w-full border-white/15 bg-white/5 py-6 text-base font-semibold text-white hover:bg-white/10 hover:text-white"
      >
        <Link href="/me">My Account</Link>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Backdrop + scoped styles (lightweight; no particle arrays)
// ---------------------------------------------------------------------------

function ArenaBackdrop({ won, phase }: { won: boolean; phase: Phase }) {
  const intense = phase === 'result' && won
  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-[#140809] to-black" />
      <div
        className={`absolute -right-12 -top-12 size-64 rounded-full bg-red-600/25 blur-3xl transition-opacity duration-500 ${intense ? 'opacity-90' : 'opacity-60'}`}
      />
      <div
        className={`absolute -bottom-16 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl transition-opacity duration-500 ${intense ? 'opacity-90' : 'opacity-60'}`}
      />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_30px_rgba(0,0,0,0.85)]" />
    </>
  )
}

function ArenaStyles() {
  return (
    <style jsx>{`
      @keyframes arena-fade-up {
        0% {
          opacity: 0;
          transform: translateY(8px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes arena-chip {
        0% {
          opacity: 0;
          transform: translateY(10px) scale(0.9);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes arena-scan {
        0% {
          transform: translateY(-100%);
          opacity: 0;
        }
        20% {
          opacity: 1;
        }
        80% {
          opacity: 1;
        }
        100% {
          transform: translateY(320%);
          opacity: 0;
        }
      }
      @keyframes arena-pulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.15);
          opacity: 0.7;
        }
      }
      @keyframes arena-result-in {
        0% {
          opacity: 0;
          transform: translateY(14px) scale(0.97);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes arena-burst {
        0% {
          transform: scale(0.5);
          opacity: 0;
        }
        60% {
          transform: scale(1.08);
          opacity: 1;
        }
        100% {
          transform: scale(1);
        }
      }
      @keyframes arena-shimmer {
        0% {
          background-position: -200% center;
        }
        100% {
          background-position: 200% center;
        }
      }
      .arena-fade {
        animation: arena-fade-up 0.4s ease-out both;
      }
      .arena-chip-in {
        animation: arena-chip 0.35s ease-out both;
      }
      .arena-scan-beam {
        animation: arena-scan 1.1s ease-in-out infinite;
      }
      .arena-pulse {
        animation: arena-pulse 0.9s ease-in-out infinite;
      }
      .arena-result {
        animation: arena-result-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .arena-burst {
        animation: arena-burst 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .arena-shimmer {
        background: linear-gradient(90deg, #fbbf24 0%, #fff7ed 30%, #fbbf24 50%, #fff7ed 70%, #fbbf24 100%);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: arena-shimmer 2s linear infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .arena-fade,
        .arena-chip-in,
        .arena-scan-beam,
        .arena-pulse,
        .arena-result,
        .arena-burst,
        .arena-shimmer {
          animation: none !important;
        }
        .arena-shimmer {
          -webkit-text-fill-color: #fbbf24;
          color: #fbbf24;
        }
      }
    `}</style>
  )
}
