'use client'

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle2, Gift, AlertCircle, PartyPopper, Crown, Star, Trophy, Zap } from 'lucide-react'

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
          {state.kind === 'confirmed' && <ConfirmedState award={state.award} />}
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

// Slot machine symbols
const SLOT_SYMBOLS = [
  { icon: Gift, color: 'text-pink-400' },
  { icon: Crown, color: 'text-amber-400' },
  { icon: Star, color: 'text-fuchsia-400' },
  { icon: Trophy, color: 'text-yellow-400' },
  { icon: Zap, color: 'text-violet-400' },
]

function ConfirmedState({ award }: { award: AwardPayload }) {
  const [phase, setPhase] = useState<'intro' | 'spin' | 'stopping' | 'revealed'>('intro')
  const [stoppedReels, setStoppedReels] = useState([false, false, false])

  useEffect(() => {
    // Phase timings
    const introTimer = setTimeout(() => setPhase('spin'), 900)
    const spinTimer = setTimeout(() => setPhase('stopping'), 3500)
    
    // Stagger reel stops
    const reel1Timer = setTimeout(() => setStoppedReels(prev => [true, prev[1], prev[2]]), 2800)
    const reel2Timer = setTimeout(() => setStoppedReels(prev => [prev[0], true, prev[2]]), 3400)
    const reel3Timer = setTimeout(() => setStoppedReels(prev => [prev[0], prev[1], true]), 4100)
    
    // Final reveal
    const revealTimer = setTimeout(() => setPhase('revealed'), 4800)

    return () => {
      clearTimeout(introTimer)
      clearTimeout(spinTimer)
      clearTimeout(reel1Timer)
      clearTimeout(reel2Timer)
      clearTimeout(reel3Timer)
      clearTimeout(revealTimer)
    }
  }, [])

  if (phase === 'revealed') {
    // Derive prizes array for backward compatibility: use prizes[] if available, else wrap single prize
    const prizes = award.prizes ?? (award.prize ? [award.prize] : [])
    if (award.won && prizes.length > 0) {
      return <WonReveal award={award} prizes={prizes} />
    }
    return <NotWonReveal award={award} />
  }

  return (
    <SlotMachineReveal 
      phase={phase} 
      stoppedReels={stoppedReels} 
    />
  )
}

function SlotMachineReveal({ 
  phase, 
  stoppedReels 
}: { 
  phase: 'intro' | 'spin' | 'stopping'
  stoppedReels: boolean[]
}) {
  return (
    <div className="relative flex flex-col items-center gap-5 w-full -mx-4 -mt-4 -mb-4 px-4 py-6 overflow-hidden">
      <style jsx>{`
        @keyframes sparkle-drift {
          0% { transform: translateY(0) translateX(0) scale(0); opacity: 0; }
          20% { opacity: 1; transform: scale(1); }
          100% { transform: translateY(-60px) translateX(20px) scale(0); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes reel-spin {
          0% { transform: translateY(0); }
          100% { transform: translateY(-500%); }
        }
        @keyframes reel-stop-bounce {
          0% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
          60% { transform: translateY(4px); }
          100% { transform: translateY(0); }
        }
        @keyframes center-line-flash {
          0%, 100% { opacity: 0.3; box-shadow: 0 0 10px rgba(236, 72, 153, 0.3); }
          50% { opacity: 1; box-shadow: 0 0 30px rgba(236, 72, 153, 0.8); }
        }
        @keyframes progress-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .sparkle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: white;
          border-radius: 50%;
          animation: sparkle-drift 2s ease-out infinite;
        }
        .bg-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .reel-spinning {
          animation: reel-spin 0.15s linear infinite;
        }
        .reel-stopped {
          animation: reel-stop-bounce 0.3s ease-out forwards;
        }
        .center-line {
          animation: center-line-flash 1s ease-in-out infinite;
        }
        .progress-dot {
          animation: progress-pulse 0.6s ease-in-out infinite;
        }
        .fade-in {
          animation: fade-in-up 0.4s ease-out forwards;
        }
      `}</style>

      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950 via-purple-950 to-fuchsia-950 rounded-2xl" />
      
      {/* Radial pink glow */}
      <div className="bg-glow absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-pink-500/20 blur-3xl" />

      {/* Sparkle particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="sparkle"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${20 + Math.random() * 60}%`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 w-full">
        {/* Header text */}
        <div className="fade-in text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-400 mb-1">
            {phase === 'intro' ? 'Payment Confirmed' : 'Instant Win Check'}
          </p>
          <h2 className="text-xl font-bold text-white">
            {phase === 'intro' 
              ? 'Checking your instant win...' 
              : phase === 'stopping'
              ? 'Finalising result...'
              : 'Spinning your instant win...'}
          </h2>
          <p className="text-sm text-purple-200/70 mt-1">
            {phase === 'intro' 
              ? 'Your entry is locked in. Get ready for the reveal.'
              : 'This is your moment'}
          </p>
        </div>

        {/* Slot Machine */}
        <div className="relative mt-2">
          {/* Machine housing */}
          <div className="relative rounded-3xl bg-gradient-to-b from-purple-900/90 to-violet-950/90 p-1 shadow-2xl shadow-purple-900/50">
            {/* Inner glow border */}
            <div className="absolute inset-0 rounded-3xl border border-pink-500/30" />
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-pink-500/20 via-violet-500/20 to-pink-500/20 blur-sm" />
            
            {/* Glass panel */}
            <div className="relative rounded-2xl bg-gradient-to-b from-purple-900/60 to-violet-950/80 backdrop-blur-sm p-4 overflow-hidden">
              {/* Reels container */}
              <div className="flex gap-2 relative">
                {[0, 1, 2].map((reelIndex) => (
                  <div key={reelIndex} className="relative">
                    {/* Reel window */}
                    <div className="w-20 h-24 rounded-xl bg-gradient-to-b from-purple-950 to-violet-950 overflow-hidden relative border border-purple-700/50">
                      {/* Reel strip */}
                      <div 
                        className={`flex flex-col ${
                          stoppedReels[reelIndex] ? 'reel-stopped' : phase !== 'intro' ? 'reel-spinning' : ''
                        }`}
                        style={{
                          filter: !stoppedReels[reelIndex] && phase !== 'intro' ? 'blur(1px)' : 'none',
                        }}
                      >
                        {/* Repeat symbols for seamless spin */}
                        {[...SLOT_SYMBOLS, ...SLOT_SYMBOLS, ...SLOT_SYMBOLS].map((symbol, i) => {
                          const Icon = symbol.icon
                          return (
                            <div
                              key={i}
                              className="w-20 h-24 flex items-center justify-center shrink-0"
                            >
                              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-800/50 to-violet-900/50 flex items-center justify-center border border-purple-600/30">
                                <Icon className={`size-8 ${symbol.color} drop-shadow-lg`} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* Top/bottom fade */}
                      <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-purple-950 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-purple-950 to-transparent pointer-events-none" />
                    </div>
                    
                    {/* Stop flash */}
                    {stoppedReels[reelIndex] && (
                      <div className="absolute inset-0 rounded-xl bg-pink-400/20 animate-pulse pointer-events-none" />
                    )}
                  </div>
                ))}

                {/* Center win line */}
                <div className={`center-line absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-pink-500 to-transparent ${
                  stoppedReels.every(Boolean) ? 'opacity-100' : 'opacity-40'
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                stoppedReels[i] 
                  ? 'bg-pink-400 shadow-lg shadow-pink-400/50' 
                  : 'bg-purple-600 progress-dot'
              }`}
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function WonReveal({ award, prizes }: { award: AwardPayload; prizes: Prize[] }) {
  // For now, render first prize prominently (backward compatible with single-prize flow)
  // Future: can iterate over all prizes when multiple are common
  const prize = prizes[0]
  
  return (
    <div className="relative flex flex-col items-center gap-5 w-full -mx-4 -mt-4 -mb-4 px-4 py-6 overflow-hidden">
      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120px) rotate(720deg); opacity: 0; }
        }
        @keyframes scale-pop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
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
          0%, 100% { box-shadow: 0 0 30px rgba(251, 191, 36, 0.4); }
          50% { box-shadow: 0 0 60px rgba(251, 191, 36, 0.7); }
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
          animation: confetti-fall 2.5s ease-out forwards;
        }
        .icon-pop { animation: scale-pop 0.5s ease-out forwards; }
        .title-slide { animation: slide-up 0.4s ease-out 0.2s both; }
        .details-slide { animation: slide-up 0.4s ease-out 0.35s both; }
        .actions-slide { animation: slide-up 0.4s ease-out 0.5s both; }
        .shimmer-text {
          background: linear-gradient(90deg, #fbbf24 0%, #fef3c7 30%, #fbbf24 50%, #fef3c7 70%, #fbbf24 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2s linear infinite;
        }
        .glow-badge {
          animation: glow-pulse 2s ease-in-out infinite;
        }
        .rays {
          animation: ray-spin 20s linear infinite;
        }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950 via-purple-950 to-fuchsia-950 rounded-2xl" />
      
      {/* Spinning rays */}
      <div className="rays absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 opacity-20">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-1 h-48 bg-gradient-to-t from-amber-400 to-transparent origin-bottom"
            style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }}
          />
        ))}
      </div>

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="confetti"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 20}%`,
              backgroundColor: ['#fbbf24', '#ec4899', '#a855f7', '#f472b6', '#fef3c7'][i % 5],
              animationDelay: `${Math.random() * 0.8}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 w-full">
        {/* Win badge */}
        <div className="icon-pop glow-badge flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500">
          <PartyPopper className="size-12 text-white drop-shadow-lg" />
        </div>

        {/* Title */}
        <div className="title-slide text-center">
          <p className="shimmer-text text-sm font-bold uppercase tracking-[0.2em] mb-1">
            {prizes.length > 1 ? 'Instant Wins!' : 'Instant Win!'}
          </p>
          <h1 className="text-2xl font-bold text-white text-balance">
            {prize.title}
          </h1>
          {prize.value_text && (
            <p className="text-sm text-purple-200/80 mt-1">{prize.value_text}</p>
          )}
        </div>

        {/* Prize image */}
        {prize.image_url && (
          <div className="details-slide w-full overflow-hidden rounded-2xl border-2 border-amber-400/40 shadow-xl shadow-amber-500/20">
            <img
              src={prize.image_url}
              alt={prize.title}
              className="h-48 w-full object-contain bg-gradient-to-b from-purple-900/50 to-violet-950/50"
            />
          </div>
        )}

        {/* Additional prizes (if multiple won) */}
        {prizes.length > 1 && (
          <div className="details-slide w-full space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-400/80 text-center">
              + {prizes.length - 1} more {prizes.length === 2 ? 'prize' : 'prizes'}
            </p>
            <div className="space-y-2">
              {prizes.slice(1).map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-purple-900/40 px-3 py-2">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.title} className="h-10 w-10 rounded-lg object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                    {p.value_text && <p className="text-xs text-purple-200/70">{p.value_text}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Congratulations text */}
        <p className="details-slide text-sm text-purple-200/80 text-center leading-relaxed">
          {prizes.length > 1 
            ? 'Congratulations — your prizes have been locked in.'
            : 'Congratulations — your prize has been locked in.'}
        </p>

        {/* Ticket numbers */}
        <div className="details-slide w-full">
          <div className="rounded-xl border border-purple-500/30 bg-purple-900/40 px-4 py-3 text-center">
            {award.ticket_start !== null && award.ticket_end !== null && (
              <>
                <p className="text-xs font-medium uppercase tracking-wider text-purple-300/70 mb-1">
                  {award.ticket_start === award.ticket_end ? 'Your Ticket Number' : 'Your Ticket Numbers'}
                </p>
                <p className="text-lg font-bold text-white font-mono">
                  {award.ticket_start === award.ticket_end 
                    ? `#${award.ticket_start}` 
                    : `#${award.ticket_start}–#${award.ticket_end}`}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="actions-slide flex flex-col gap-3 w-full">
          <p className="text-xs text-purple-300/60 text-center">
            {"You've also been entered into the main draw. We'll be in touch about your prize."}
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25 border-0">
              <Link href="/me">View My Entries</Link>
            </Button>
            {award.campaign_slug && (
              <Button asChild className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-semibold shadow-lg shadow-purple-500/25 border-0">
                <Link href={`/giveaways/${award.campaign_slug}`}>Buy More Tickets</Link>
              </Button>
            )}
            <Button asChild className="w-full bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 hover:border-white/40">
              <Link href="/giveaways">Enter More Giveaways</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotWonReveal({ award }: { award: AwardPayload }) {
  return (
    <div className="relative flex flex-col items-center gap-5 w-full -mx-4 -mt-4 -mb-4 px-4 py-6 overflow-hidden">
      <style jsx>{`
        @keyframes scale-in {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slide-up {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes glow-soft {
          0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.3); }
          50% { box-shadow: 0 0 40px rgba(168, 85, 247, 0.5); }
        }
        .icon-scale { animation: scale-in 0.4s ease-out forwards; }
        .title-slide { animation: slide-up 0.4s ease-out 0.15s both; }
        .entries-slide { animation: slide-up 0.4s ease-out 0.25s both; }
        .tickets-slide { animation: slide-up 0.4s ease-out 0.35s both; }
        .note-slide { animation: slide-up 0.4s ease-out 0.45s both; }
        .actions-slide { animation: slide-up 0.4s ease-out 0.55s both; }
        .glow-badge {
          animation: glow-soft 2s ease-in-out infinite;
        }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950 via-purple-950 to-fuchsia-950 rounded-2xl" />
      
      {/* Subtle glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-purple-500/15 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-4 w-full">
        {/* Icon */}
        <div className="icon-scale glow-badge flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600">
          <CheckCircle2 className="size-10 text-white drop-shadow-lg" />
        </div>

        {/* Title */}
        <div className="title-slide text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-400 mb-1">
            Entry Confirmed
          </p>
          <h1 className="text-2xl font-bold text-white">{"You're In!"}</h1>
          <p className="text-sm text-purple-200/70 mt-1">
            No instant win this time
          </p>
        </div>

        {/* Entries badge */}
        <div className="entries-slide flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-900/60 to-violet-900/60 border border-purple-500/30 px-5 py-3">
          <Gift className="size-5 text-pink-400" />
          <span className="text-sm font-semibold text-white">
            {award.qty} {award.qty === 1 ? 'ticket entered' : 'tickets entered'}
          </span>
        </div>

        {/* Ticket numbers */}
        {award.ticket_start !== null && award.ticket_end !== null && (
          <div className="tickets-slide w-full">
            <div className="rounded-xl border border-purple-500/30 bg-purple-900/40 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-purple-300/70 mb-1">
                {award.ticket_start === award.ticket_end ? 'Your Ticket Number' : 'Your Ticket Numbers'}
              </p>
              <p className="text-lg font-bold text-white font-mono">
                {award.ticket_start === award.ticket_end 
                  ? `#${award.ticket_start}` 
                  : `#${award.ticket_start}–#${award.ticket_end}`}
              </p>
            </div>
          </div>
        )}

        {/* Reassurance */}
        <p className="note-slide text-sm text-purple-200/70 text-center leading-relaxed bg-purple-900/30 rounded-xl px-4 py-3">
          {"Your entry is secured for the main draw — good luck!"}
        </p>

        {/* Actions */}
        <div className="actions-slide flex flex-col gap-2 w-full">
          <Button asChild className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-purple-500/25 border-0">
            <Link href="/me">View My Entries</Link>
          </Button>
          {award.campaign_slug && (
            <Button asChild className="w-full bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-700 hover:to-fuchsia-700 text-white font-semibold shadow-lg shadow-pink-500/25 border-0">
              <Link href={`/giveaways/${award.campaign_slug}`}>Buy More Tickets</Link>
            </Button>
          )}
          <Button asChild className="w-full bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 hover:border-white/40">
            <Link href="/giveaways">Enter More Giveaways</Link>
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
