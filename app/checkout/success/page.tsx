'use client'

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle2, Gift, AlertCircle, PartyPopper, Zap } from 'lucide-react'

// Lazy-loaded so normal campaigns never download/parse the scratch-card
// canvas + confetti bundle. The chunk is only fetched when a confirmed award
// identifies the campaign as scratch_card (see the reveal selector below).
const ScratchCardReveal = dynamic(
  () =>
    import('@/components/checkout/reveal/ScratchCardReveal').then(
      (module) => module.ScratchCardReveal,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Spinner className="h-6 w-6 text-amber-400" />
        <p className="text-sm text-zinc-300">Preparing your scratch card…</p>
      </div>
    ),
  },
)

type Prize = {
  title: string
  value_text?: string | null
  image_url?: string | null
}

type AwardPayload = {
  confirmed: boolean
  checkout_ref: string
  qty: number
  won: boolean
  prize: Prize | null
  /** Future: array of all prizes won in this checkout */
  prizes?: Prize[]
  ticket_start?: number | null
  ticket_end?: number | null
  campaign_slug?: string | null
  reveal_type?: 'normal' | 'scratch_card' | null
}

/**
 * Presentation-only selector. Any null/missing/unknown value falls back to
 * 'normal' so existing campaigns behave exactly as before.
 */
function normalizeRevealType(value: unknown): 'normal' | 'scratch_card' {
  return value === 'scratch_card' ? 'scratch_card' : 'normal'
}

function TicketNumbers({ award }: { award: AwardPayload }) {
  const start = award.ticket_start
  const end = award.ticket_end

  if (typeof start !== 'number' || typeof end !== 'number') return null

  return (
    <div className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
        {start === end ? 'Your Ticket Number' : 'Your Ticket Numbers'}
      </p>
      <p className="text-lg font-bold text-foreground font-mono">
        {start === end ? `#${start}` : `#${start}\u2013#${end}`}
      </p>
    </div>
  )
}

type PageState =
  | { kind: 'missing_ref' }
  | { kind: 'confirming'; attempt: number }
  | { kind: 'confirmed'; award: AwardPayload }
  | { kind: 'failed'; error: string }

const MAX_ATTEMPTS = 20
const POLL_INTERVAL = 2500

function LoadingCard() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Spinner className="size-8 text-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold text-foreground">Loading...</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Preparing your checkout confirmation.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <CheckoutSuccessClient />
    </Suspense>
  )
}

function CheckoutSuccessClient() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')
  const provider = searchParams.get('provider') || 'debug'
  const paymentIntent = searchParams.get('payment_intent') || undefined
  const paypalOrder = searchParams.get('paypal_order') || undefined

  const [state, setState] = useState<PageState>(
    ref ? { kind: 'confirming', attempt: 0 } : { kind: 'missing_ref' }
  )

  const attemptRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doneRef = useRef(false)

  const confirm = useCallback(async () => {
    if (!ref) return
    if (doneRef.current) return

    attemptRef.current += 1
    const currentAttempt = attemptRef.current
    setState({ kind: 'confirming', attempt: currentAttempt })

    try {
      abortRef.current = new AbortController()

      const body: Record<string, string> = { ref, provider }
      if (paymentIntent) body.stripePaymentIntentId = paymentIntent
      if (paypalOrder) body.paypalOrderId = paypalOrder

      const res = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      })

      if (res.status === 401) {
        const returnTo = window.location.pathname + window.location.search
        window.location.href = `/auth/login?redirect=${encodeURIComponent(returnTo)}`
        return
      }

      const json = await res.json()

      if (res.ok && json.ok) {
        doneRef.current = true
        setState({ kind: 'confirmed', award: json.award })
        return
      }

      if (res.status === 409 && json.error === 'awaiting_provider_confirmation') {
        if (currentAttempt >= MAX_ATTEMPTS) {
          doneRef.current = true
          setState({ kind: 'failed', error: 'Payment confirmation timed out. Please contact support.' })
          return
        }
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => confirm(), POLL_INTERVAL)
        return
      }

      doneRef.current = true
      setState({ kind: 'failed', error: json.error || 'Something went wrong. Please try again.' })
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      doneRef.current = true
      setState({ kind: 'failed', error: 'Network error. Please check your connection and try again.' })
    }
  }, [ref, provider, paymentIntent, paypalOrder])

  useEffect(() => {
    if (!ref) return
    doneRef.current = false
    attemptRef.current = 0
    confirm()

    return () => {
      abortRef.current?.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [ref, confirm])

  const handleRetry = () => {
    doneRef.current = false
    attemptRef.current = 0
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    confirm()
  }

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
          {state.kind === 'missing_ref' && <MissingRefState />}
          {state.kind === 'confirming' && <ConfirmingState attempt={state.attempt} />}
          {state.kind === 'confirmed' &&
            (normalizeRevealType(state.award.reveal_type) === 'scratch_card' ? (
              <ScratchCardReveal award={state.award} />
            ) : (
              <ConfirmedState award={state.award} />
            ))}
          {state.kind === 'failed' && <FailedState error={state.error} onRetry={handleRetry} />}
        </CardContent>
      </Card>
    </main>
  )
}

function MissingRefState() {
  return (
    <>
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-8 text-destructive" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">Missing Reference</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {"We couldn't find a payment reference. If you just completed a purchase, please check your email for confirmation."}
        </p>
      </div>
      <Button asChild className="w-full">
        <Link href="/giveaways">Browse Giveaways</Link>
      </Button>
    </>
  )
}

function ConfirmingState({ attempt }: { attempt: number }) {
  return (
    <>
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Spinner className="size-8 text-primary" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">Confirming Your Entry</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {"We're verifying your payment and entering you into the draw. This usually takes just a moment."}
        </p>
      </div>
      {attempt > 3 && (
        <p className="text-xs text-muted-foreground">Still working... please hold tight.</p>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Instant Win Vault — premium, presentation-only reveal experience.
// All visuals below are cosmetic. The win/not-won outcome is decided entirely
// by the backend `award.won` value and is only read AFTER confirmation.
// ---------------------------------------------------------------------------

type VaultStage = 'locked' | 'tickets' | 'scan' | 'final' | 'revealed'

// Scan-phase messages (cosmetic). Never imply a win or a near-miss.
const SCAN_MESSAGES = [
  'Checking for instant wins…',
  'Scanning your ticket numbers…',
  'Matching against live instant win slots…',
]

function ticketRangeLabel(award: AwardPayload): string | null {
  const start = award.ticket_start
  const end = award.ticket_end
  if (typeof start !== 'number' || typeof end !== 'number') return null
  return start === end ? `#${start}` : `#${start}\u2013#${end}`
}

function ConfirmedState({ award }: { award: AwardPayload }) {
  const [stage, setStage] = useState<VaultStage>('locked')
  const [scanStep, setScanStep] = useState(0)

  useEffect(() => {
    // Respect users who prefer reduced motion: skip the suspense
    // animation entirely and reveal the (already-known) backend result.
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setStage('revealed')
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = [
      // Stage 1: Payment Locked (~700ms)
      setTimeout(() => setStage('tickets'), 700),
      // Stage 2: Tickets Load In (~1000ms)
      setTimeout(() => setStage('scan'), 1700),
      // Stage 3: Reactor Scan messages (~1800ms window)
      setTimeout(() => setScanStep(1), 2300),
      setTimeout(() => setScanStep(2), 2900),
      // Stage 4: Final Lock (~900ms)
      setTimeout(() => setStage('final'), 3500),
      // Stage 5: Reveal
      setTimeout(() => setStage('revealed'), 4400),
    ]

    return () => timers.forEach(clearTimeout)
  }, [])

  if (stage === 'revealed') {
    // Derive prizes array for backward compatibility: use prizes[] if available, else wrap single prize
    const prizes = award.prizes ?? (award.prize ? [award.prize] : [])
    if (award.won && prizes.length > 0) {
      return <WonReveal award={award} prizes={prizes} />
    }
    return <NotWonReveal award={award} />
  }

  return <VaultReveal stage={stage} scanStep={scanStep} award={award} />
}

// Shared animated backdrop: charcoal base, WTF-red glow (top-right),
// gold glow (bottom-center), drifting blobs and a dark vignette.
function VaultBackdrop({ intense = false }: { intense?: boolean }) {
  return (
    <>
      <div className="absolute inset-0 rounded-2xl bg-[#0a0a0b]" />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-zinc-950 via-[#120708] to-black" />
      {/* WTF red glow top-right */}
      <div className={`vault-blob absolute -top-10 -right-10 w-64 h-64 rounded-full bg-red-600/30 blur-3xl ${intense ? 'opacity-90' : 'opacity-70'}`} />
      {/* Gold glow bottom-center */}
      <div className="vault-blob-slow absolute -bottom-16 left-1/2 -translate-x-1/2 w-72 h-56 rounded-full bg-amber-400/20 blur-3xl" />
      {/* Secondary red wash */}
      <div className="vault-blob-alt absolute top-1/3 left-0 w-48 h-48 rounded-full bg-red-500/15 blur-3xl" />
      {/* Dark vignette */}
      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_90px_30px_rgba(0,0,0,0.85)] pointer-events-none" />
    </>
  )
}

// Lightweight CSS-only cash/spark particles drifting upward.
function CashParticles({ count = 14 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="spark"
          style={{
            left: `${5 + ((i * 37) % 90)}%`,
            bottom: `${(i * 17) % 40}%`,
            animationDelay: `${(i % 7) * 0.35}s`,
            background: i % 3 === 0 ? '#f59e0b' : i % 3 === 1 ? '#fbbf24' : '#ef4444',
          }}
        />
      ))}
    </div>
  )
}

function VaultReveal({
  stage,
  scanStep,
  award,
}: {
  stage: Exclude<VaultStage, 'revealed'>
  scanStep: number
  award: AwardPayload
}) {
  const range = ticketRangeLabel(award)

  const eyebrow =
    stage === 'locked'
      ? 'Payment Confirmed'
      : stage === 'tickets'
      ? 'Allocating'
      : 'Instant Win Check'

  const title =
    stage === 'locked'
      ? 'Your tickets are locked in'
      : stage === 'tickets'
      ? 'Allocating your tickets…'
      : stage === 'final'
      ? 'Final instant win check…'
      : SCAN_MESSAGES[Math.min(scanStep, SCAN_MESSAGES.length - 1)]

  const reacting = stage === 'scan' || stage === 'final'

  return (
    <div className={`vault-root relative flex flex-col items-center gap-5 w-full -mx-4 -mt-4 -mb-4 px-4 py-7 overflow-hidden ${stage === 'final' ? 'vault-darken' : ''}`}>
      <style jsx>{`
        @keyframes reactor-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes reactor-spin-fast { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0% { transform: scale(0.7); opacity: 0.7; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes scan-sweep {
          0% { transform: translateY(-130%); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(130%); opacity: 0; }
        }
        @keyframes spark-rise {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          20% { opacity: 1; transform: scale(1); }
          100% { transform: translateY(-90px) scale(0); opacity: 0; }
        }
        @keyframes blob-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(10px, -12px) scale(1.08); }
        }
        @keyframes blob-drift-alt {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-12px, 10px) scale(1.1); }
        }
        @keyframes flash-in {
          0% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.8); }
        }
        @keyframes check-pop {
          0% { transform: scale(0); }
          60% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes card-in {
          0% { transform: translateY(26px) scale(0.92); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes card-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          60% { transform: translateX(-1.5px); }
          80% { transform: translateX(1.5px); }
        }
        @keyframes num-flicker {
          0%, 100% { opacity: 1; }
          45% { opacity: 0.55; }
          70% { opacity: 0.85; }
        }
        @keyframes fade-up {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .vault-root { background: #060607; }
        .vault-darken::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.4);
          animation: fade-up 0.3s ease-out;
          pointer-events: none;
          z-index: 20;
        }
        .vault-blob { animation: blob-drift 4.5s ease-in-out infinite; }
        .vault-blob-slow { animation: blob-drift-alt 6s ease-in-out infinite; }
        .vault-blob-alt { animation: blob-drift 5.2s ease-in-out infinite; }
        .reactor-ring { animation: reactor-spin 6s linear infinite; }
        .reactor-ring-fast { animation: reactor-spin-fast 1.6s linear infinite; }
        .reactor-ring-rev { animation: reactor-spin 9s linear infinite reverse; }
        .pulse-ring { animation: pulse-ring 1.8s ease-out infinite; }
        .pulse-ring-fast { animation: pulse-ring 1s ease-out infinite; }
        .scan-beam { animation: scan-sweep 1.1s ease-in-out infinite; }
        .spark {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          animation: spark-rise 2.4s ease-out infinite;
        }
        .flash-burst { animation: flash-in 0.7s ease-out forwards; }
        .check-pop { animation: check-pop 0.5s ease-out forwards; }
        .card-in { animation: card-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .card-shake { animation: card-shake 0.4s ease-in-out infinite; }
        .num-flicker { animation: num-flicker 0.5s ease-in-out infinite; }
        .fade-up { animation: fade-up 0.4s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .reactor-ring, .reactor-ring-fast, .reactor-ring-rev, .pulse-ring, .pulse-ring-fast,
          .scan-beam, .spark, .vault-blob, .vault-blob-slow, .vault-blob-alt, .card-shake, .num-flicker {
            animation: none !important;
          }
        }
      `}</style>

      <VaultBackdrop intense={reacting} />
      {reacting && <CashParticles count={14} />}

      {/* Stage 1 gold/green flash on payment-locked */}
      {stage === 'locked' && (
        <div className="flash-burst pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-gradient-to-br from-amber-300/60 to-emerald-400/40 blur-2xl z-30" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-5 w-full">
        {/* Header text */}
        <div className="text-center min-h-[78px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-400 mb-1">
            {eyebrow}
          </p>
          <h2 key={`${stage}-${scanStep}`} className="fade-up text-xl font-bold text-white text-balance leading-snug">
            {title}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {stage === 'locked' ? 'Your entry is secured.' : 'Hang tight — almost there'}
          </p>
        </div>

        {/* Reactor + ticket card centrepiece */}
        <div className="relative flex items-center justify-center w-[260px] h-[260px]">
          {/* Expanding pulse rings */}
          <div className={`pointer-events-none absolute inset-6 rounded-full border-2 border-red-500/40 ${stage === 'final' ? 'pulse-ring-fast' : 'pulse-ring'}`} />
          <div className={`pointer-events-none absolute inset-6 rounded-full border-2 border-amber-400/30 ${stage === 'final' ? 'pulse-ring-fast' : 'pulse-ring'}`} style={{ animationDelay: '0.6s' }} />

          {/* Outer rotating segmented reactor ring */}
          <div
            className={`absolute inset-0 rounded-full ${stage === 'final' ? 'reactor-ring-fast' : 'reactor-ring'}`}
            style={{
              background: 'conic-gradient(from 0deg, rgba(239,68,68,0) 0deg, rgba(239,68,68,0.9) 40deg, rgba(245,158,11,0) 90deg, rgba(245,158,11,0.9) 160deg, rgba(239,68,68,0) 210deg, rgba(245,158,11,0.8) 300deg, rgba(239,68,68,0) 360deg)',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px))',
            }}
          />
          {/* Inner counter-rotating ring */}
          <div
            className="reactor-ring-rev absolute inset-4 rounded-full opacity-70"
            style={{
              background: 'conic-gradient(from 180deg, rgba(245,158,11,0) 0deg, rgba(245,158,11,0.8) 60deg, rgba(239,68,68,0) 120deg, rgba(239,68,68,0.7) 220deg, rgba(245,158,11,0) 320deg)',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
            }}
          />

          {/* Gold ring tightening on final stage */}
          <div className={`absolute rounded-full border border-amber-400/60 transition-all duration-500 ${stage === 'final' ? 'inset-8 shadow-[0_0_30px_rgba(245,158,11,0.5)]' : 'inset-5 shadow-[0_0_18px_rgba(245,158,11,0.25)]'}`} />

          {/* Ticket card */}
          <div
            className={`card-in ${stage === 'final' ? 'card-shake' : ''} relative w-[150px] rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-zinc-900 to-black p-4 shadow-[0_0_35px_rgba(239,68,68,0.45)] overflow-hidden`}
          >
            {/* Scan beam */}
            {reacting && (
              <div className="scan-beam pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-amber-300/70 to-transparent" />
            )}
            <div className="relative flex flex-col items-center gap-1.5 text-center">
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500">
                {stage === 'locked' ? (
                  <CheckCircle2 className="check-pop size-5 text-black" />
                ) : (
                  <Zap className="size-5 text-black" />
                )}
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">
                {range ? 'Your Tickets' : 'Entry'}
              </p>
              <p className={`font-mono text-base font-bold text-white ${reacting ? 'num-flicker' : ''}`}>
                {range ?? `${award.qty} ${award.qty === 1 ? 'ticket' : 'tickets'}`}
              </p>
            </div>
          </div>
        </div>

        {/* Stage progress dots */}
        <div className="flex items-center gap-2">
          {(['locked', 'tickets', 'scan', 'final'] as const).map((s, i) => {
            const order = { locked: 0, tickets: 1, scan: 2, final: 3 }
            const active = order[stage] >= i
            return (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active ? 'w-6 bg-gradient-to-r from-red-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'w-1.5 bg-zinc-700'
                }`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WonReveal({ award, prizes }: { award: AwardPayload; prizes: Prize[] }) {
  // For now, render first prize prominently (backward compatible with single-prize flow)
  // Future: can iterate over all prizes when multiple are common
  const prize = prizes[0]
  const range = ticketRangeLabel(award)

  return (
    <div className="relative flex flex-col items-center gap-5 w-full -mx-4 -mt-4 -mb-4 px-4 py-7 overflow-hidden bg-[#060607]">
      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(140px) rotate(720deg); opacity: 0; }
        }
        @keyframes cash-rise {
          0% { transform: translateY(0) scale(0); opacity: 0; }
          20% { opacity: 1; transform: scale(1); }
          100% { transform: translateY(-110px) scale(0.4); opacity: 0; }
        }
        @keyframes slam-in {
          0% { transform: scale(2.2); opacity: 0; }
          55% { transform: scale(0.92); opacity: 1; }
          75% { transform: scale(1.04); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes big-flash {
          0% { opacity: 0; transform: scale(0.5); }
          40% { opacity: 1; }
          100% { opacity: 0; transform: scale(2); }
        }
        @keyframes slide-up {
          0% { transform: translateY(30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.5), 0 0 50px rgba(245, 158, 11, 0.25); }
          50% { box-shadow: 0 0 55px rgba(239, 68, 68, 0.8), 0 0 80px rgba(245, 158, 11, 0.5); }
        }
        @keyframes ray-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .confetti {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation: confetti-fall 2.6s ease-out forwards;
        }
        .cash {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          animation: cash-rise 2.2s ease-out infinite;
        }
        .icon-slam { animation: slam-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .big-flash { animation: big-flash 0.7s ease-out forwards; }
        .title-slide { animation: slide-up 0.4s ease-out 0.25s both; }
        .details-slide { animation: slide-up 0.4s ease-out 0.4s both; }
        .actions-slide { animation: slide-up 0.4s ease-out 0.55s both; }
        .shimmer-text {
          background: linear-gradient(90deg, #fbbf24 0%, #fff7ed 30%, #fbbf24 50%, #fff7ed 70%, #fbbf24 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2s linear infinite;
        }
        .glow-badge { animation: glow-pulse 2s ease-in-out infinite; }
        .rays { animation: ray-spin 22s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .confetti, .cash, .big-flash, .rays, .glow-badge, .shimmer-text { animation: none !important; }
          .shimmer-text { -webkit-text-fill-color: #fbbf24; color: #fbbf24; }
        }
      `}</style>

      {/* Backdrop: charcoal + red/gold */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-zinc-950 via-[#160809] to-black" />
      <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-red-600/30 blur-3xl" />
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-72 h-56 rounded-full bg-amber-400/25 blur-3xl" />
      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_90px_30px_rgba(0,0,0,0.8)] pointer-events-none" />

      {/* Spinning gold rays */}
      <div className="rays absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 opacity-25">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-1 h-48 bg-gradient-to-t from-amber-400 to-transparent origin-bottom"
            style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }}
          />
        ))}
      </div>

      {/* Big gold flash */}
      <div className="big-flash pointer-events-none absolute top-[18%] left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-gradient-to-br from-amber-300/70 to-red-500/40 blur-2xl z-20" />

      {/* Confetti + cash burst */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={`c${i}`}
            className="confetti"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 20}%`,
              backgroundColor: ['#fbbf24', '#ef4444', '#f59e0b', '#fff7ed', '#dc2626'][i % 5],
              animationDelay: `${Math.random() * 0.8}s`,
            }}
          />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={`cash${i}`}
            className="cash"
            style={{
              left: `${8 + ((i * 41) % 84)}%`,
              bottom: `${(i * 13) % 30}%`,
              background: i % 2 === 0 ? '#f59e0b' : '#ef4444',
              animationDelay: `${(i % 6) * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 w-full">
        {/* Win badge */}
        <div className="icon-slam glow-badge relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-600">
          <PartyPopper className="size-12 text-black drop-shadow-lg" />
          {prizes.length > 1 && (
            <span className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-white text-sm font-bold text-red-600 shadow-lg ring-2 ring-amber-400">
              x{prizes.length}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="title-slide text-center">
          <p className={`shimmer-text font-extrabold uppercase tracking-[0.18em] mb-1 ${prizes.length > 1 ? 'text-xl' : 'text-base'}`}>
            {prizes.length > 1 ? `${prizes.length} Instant Wins!` : 'You Hit An Instant Win'}
          </p>
          <h1 className="text-3xl font-extrabold text-white text-balance drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">
            {prize.title}
          </h1>
          {prize.value_text && (
            <p className="text-base font-semibold text-amber-300 mt-1">{prize.value_text}</p>
          )}
        </div>

        {/* Prize image */}
        {prize.image_url && (
          <div className="details-slide w-full overflow-hidden rounded-2xl border-2 border-amber-400/60 shadow-xl shadow-red-500/30">
            <img
              src={prize.image_url || "/placeholder.svg"}
              alt={prize.title}
              className="h-48 w-full object-contain bg-gradient-to-b from-zinc-900 to-black"
            />
          </div>
        )}

        {/* Additional prizes (if multiple won) */}
        {prizes.length > 1 && (
          <div className="details-slide w-full space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-400/90 text-center">
              + {prizes.length - 1} more {prizes.length === 2 ? 'prize' : 'prizes'}
            </p>
            <div className="space-y-2">
              {prizes.slice(1).map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-zinc-900/70 px-3 py-2">
                  {p.image_url && (
                    <img src={p.image_url || "/placeholder.svg"} alt={p.title} className="h-10 w-10 rounded-lg object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    {p.value_text && <p className="text-xs text-zinc-400">{p.value_text}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Congratulations text */}
        <p className="details-slide text-sm text-zinc-300 text-center leading-relaxed">
          {prizes.length > 1 
            ? 'Congratulations — your prizes have been locked in.'
            : 'Congratulations — your prize has been locked in.'}
        </p>

        {/* Ticket numbers */}
        {range && (
          <div className="details-slide w-full">
            <div className="rounded-xl border border-amber-400/30 bg-zinc-900/70 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-400/80 mb-1">
                {award.ticket_start === award.ticket_end ? 'Your Ticket Number' : 'Your Ticket Numbers'}
              </p>
              <p className="text-lg font-bold text-white font-mono">{range}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="actions-slide flex flex-col gap-3 w-full">
          <p className="text-xs text-zinc-500 text-center">
            {prizes.length > 1
              ? "You've also been entered into the main draw. We'll be in touch about your prizes."
              : "You've also been entered into the main draw. We'll be in touch about your prize."}
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-bold shadow-lg shadow-red-500/30 border-0">
              <Link href="/me">Claim Your Winnings</Link>
            </Button>
            {award.campaign_slug && (
              <Button asChild className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold border border-amber-400/30 hover:border-amber-400/50">
                <Link href={`/giveaways/${award.campaign_slug}`}>Buy More Tickets</Link>
              </Button>
            )}
            <Button asChild className="w-full bg-white/5 hover:bg-white/10 text-white font-medium border border-white/15 hover:border-white/30">
              <Link href="/giveaways">Enter More Giveaways</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotWonReveal({ award }: { award: AwardPayload }) {
  const range = ticketRangeLabel(award)

  return (
    <div className="relative flex flex-col items-center gap-5 w-full -mx-4 -mt-4 -mb-4 px-4 py-7 overflow-hidden bg-[#060607]">
      <style jsx>{`
        @keyframes flip-in {
          0% { transform: rotateY(90deg) scale(0.9); opacity: 0; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes slide-up {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes glow-soft {
          0%, 100% { box-shadow: 0 0 22px rgba(245, 158, 11, 0.25); }
          50% { box-shadow: 0 0 42px rgba(245, 158, 11, 0.45); }
        }
        .card-flip { animation: flip-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards; transform-style: preserve-3d; }
        .title-slide { animation: slide-up 0.4s ease-out 0.15s both; }
        .entries-slide { animation: slide-up 0.4s ease-out 0.25s both; }
        .tickets-slide { animation: slide-up 0.4s ease-out 0.35s both; }
        .note-slide { animation: slide-up 0.4s ease-out 0.45s both; }
        .actions-slide { animation: slide-up 0.4s ease-out 0.55s both; }
        .glow-badge { animation: glow-soft 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .card-flip, .glow-badge { animation: none !important; }
        }
      `}</style>

      {/* Backdrop: charcoal with retained soft gold glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-zinc-950 via-[#100a06] to-black" />
      <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-red-600/15 blur-3xl" />
      <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-64 h-48 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_90px_30px_rgba(0,0,0,0.8)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 w-full">
        {/* Draw entry card (flips in from the "ticket") */}
        <div className="card-flip glow-badge flex size-20 items-center justify-center rounded-2xl border border-amber-400/40 bg-gradient-to-br from-zinc-900 to-black">
          <Gift className="size-10 text-amber-400 drop-shadow-lg" />
        </div>

        {/* Title */}
        <div className="title-slide text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400 mb-1">
            Entry Confirmed
          </p>
          <h1 className="text-2xl font-bold text-white">{"You're In The Draw!"}</h1>
          <p className="text-sm text-zinc-400 mt-1">
            No instant win this time
          </p>
        </div>

        {/* Entries badge */}
        <div className="entries-slide flex items-center gap-2 rounded-xl bg-zinc-900/70 border border-amber-400/25 px-5 py-3">
          <Gift className="size-5 text-amber-400" />
          <span className="text-sm font-semibold text-white">
            {award.qty} {award.qty === 1 ? 'ticket entered' : 'tickets entered'}
          </span>
        </div>

        {/* Ticket numbers */}
        {range && (
          <div className="tickets-slide w-full">
            <div className="rounded-xl border border-amber-400/25 bg-zinc-900/70 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-400/80 mb-1">
                {award.ticket_start === award.ticket_end ? 'Your Ticket Number' : 'Your Ticket Numbers'}
              </p>
              <p className="text-lg font-bold text-white font-mono">{range}</p>
            </div>
          </div>
        )}

        {/* Reassurance */}
        <p className="note-slide text-sm text-zinc-300 text-center leading-relaxed bg-zinc-900/50 rounded-xl px-4 py-3 border border-white/5">
          {"Your tickets are still entered into the main draw — good luck!"}
        </p>

        {/* Actions */}
        <div className="actions-slide flex flex-col gap-2 w-full">
          {award.campaign_slug && (
            <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-bold shadow-lg shadow-red-500/25 border-0">
              <Link href={`/giveaways/${award.campaign_slug}`}>Try Another Competition</Link>
            </Button>
          )}
          <Button asChild className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold border border-amber-400/25 hover:border-amber-400/50">
            <Link href="/giveaways">View More Giveaways</Link>
          </Button>
          <Button asChild className="w-full bg-white/5 hover:bg-white/10 text-white font-medium border border-white/15 hover:border-white/30">
            <Link href="/me">View My Entries</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function FailedState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <>
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-8 text-destructive" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">Something Went Wrong</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <Button onClick={onRetry} className="w-full">
          Try Again
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/giveaways">Back to Giveaways</Link>
        </Button>
      </div>
    </>
  )
}
