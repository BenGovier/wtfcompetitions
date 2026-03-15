'use client'

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle2, Gift, AlertCircle, PartyPopper, Sparkles } from 'lucide-react'

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
  ticket_start?: number | null
  ticket_end?: number | null
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

function ConfirmedState({ award }: { award: AwardPayload }) {
  const [phase, setPhase] = useState<'suspense' | 'reveal'>('suspense')

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('reveal')
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  if (phase === 'suspense') {
    return <RevealSuspense />
  }

  if (award.won && award.prize) {
    return <WonReveal award={award} />
  }

  return <NotWonReveal award={award} />
}

function RevealSuspense() {
  return (
    <div className="flex flex-col items-center gap-6">
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px 0 rgba(251, 191, 36, 0.4); }
          50% { box-shadow: 0 0 40px 10px rgba(251, 191, 36, 0.6); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .suspense-orb {
          animation: pulse-glow 1s ease-in-out infinite;
        }
        .suspense-spin {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
      <div className="relative flex size-24 items-center justify-center">
        <div className="suspense-orb absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500" />
        <div className="suspense-spin absolute inset-0 flex items-center justify-center">
          <Sparkles className="size-10 text-white drop-shadow-lg" />
        </div>
      </div>
      <div className="flex flex-col gap-2 text-center">
        <p className="text-lg font-semibold text-foreground">Checking for prizes...</p>
        <p className="text-sm text-muted-foreground">This is your moment</p>
      </div>
    </div>
  )
}

function WonReveal({ award }: { award: AwardPayload }) {
  const prize = award.prize!
  
  return (
    <>
      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100px) rotate(720deg); opacity: 0; }
        }
        @keyframes scale-in {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slide-up {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          animation: confetti-fall 2s ease-out forwards;
        }
        .prize-icon { animation: scale-in 0.5s ease-out forwards; }
        .prize-title { animation: slide-up 0.4s ease-out 0.2s both; }
        .prize-details { animation: slide-up 0.4s ease-out 0.3s both; }
        .prize-image { animation: slide-up 0.4s ease-out 0.4s both; }
        .prize-actions { animation: slide-up 0.4s ease-out 0.5s both; }
        .shimmer-text {
          background: linear-gradient(90deg, #f59e0b 0%, #fcd34d 25%, #f59e0b 50%, #fcd34d 75%, #f59e0b 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2s linear infinite;
        }
      `}</style>
      
      {/* Confetti particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="confetti"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 30}%`,
              backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'][i % 5],
              animationDelay: `${Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="prize-icon relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 shadow-lg shadow-amber-500/30">
        <PartyPopper className="size-12 text-white drop-shadow-md" />
      </div>
      
      <div className="prize-title flex flex-col gap-1">
        <p className="shimmer-text text-sm font-bold uppercase tracking-widest">
          Instant Win!
        </p>
        <h1 className="text-2xl font-bold text-foreground text-balance">
          {prize.title}
        </h1>
        {prize.value_text && (
          <p className="text-sm text-muted-foreground">{prize.value_text}</p>
        )}
      </div>

      {prize.image_url && (
        <div className="prize-image w-full overflow-hidden rounded-xl border-2 border-amber-400/30 shadow-lg">
          <img
            src={prize.image_url}
            alt={prize.title}
            className="h-48 w-full object-contain bg-gradient-to-b from-amber-50/50 to-transparent"
          />
        </div>
      )}

      <div className="prize-details w-full">
        <TicketNumbers award={award} />
      </div>

      <div className="prize-actions flex flex-col gap-3 w-full">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {"You've also been entered into the main draw. We'll be in touch about your instant win prize."}
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Button asChild className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25">
            <Link href="/me">View My Entries</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/giveaways">Enter More Giveaways</Link>
          </Button>
        </div>
      </div>
    </>
  )
}

function NotWonReveal({ award }: { award: AwardPayload }) {
  return (
    <>
      <style jsx>{`
        @keyframes fade-scale-in {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slide-up-fade {
          0% { transform: translateY(15px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .success-icon { animation: fade-scale-in 0.4s ease-out forwards; }
        .success-title { animation: slide-up-fade 0.4s ease-out 0.15s both; }
        .success-entries { animation: slide-up-fade 0.4s ease-out 0.25s both; }
        .success-tickets { animation: slide-up-fade 0.4s ease-out 0.35s both; }
        .success-note { animation: slide-up-fade 0.4s ease-out 0.45s both; }
        .success-actions { animation: slide-up-fade 0.4s ease-out 0.55s both; }
      `}</style>

      <div className="success-icon flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/25">
        <CheckCircle2 className="size-10 text-white drop-shadow-md" />
      </div>
      
      <div className="success-title flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">{"You're In!"}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {"Your entry has been confirmed. You're now in the draw \u2014 good luck!"}
        </p>
      </div>

      <div className="success-entries flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/50 px-5 py-3">
        <Gift className="size-5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {award.qty} {award.qty === 1 ? 'entry confirmed' : 'entries confirmed'}
        </span>
      </div>

      <div className="success-tickets w-full">
        <TicketNumbers award={award} />
      </div>

      <p className="success-note text-sm text-muted-foreground leading-relaxed bg-muted/50 rounded-lg px-4 py-3">
        {"No instant win this time \u2014 but you're still in for the main prize draw!"}
      </p>

      <div className="success-actions flex flex-col gap-2 w-full pt-1">
        <Button asChild className="w-full">
          <Link href="/me">View My Entries</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/giveaways">Enter More Giveaways</Link>
        </Button>
      </div>
    </>
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
