'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle2, Gift, AlertCircle, PartyPopper } from 'lucide-react'

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
}

type PageState =
  | { kind: 'missing_ref' }
  | { kind: 'confirming'; attempt: number }
  | { kind: 'confirmed'; award: AwardPayload }
  | { kind: 'failed'; error: string }

const MAX_ATTEMPTS = 20
const POLL_INTERVAL = 2500

export default function CheckoutSuccessPage() {
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
  if (award.won && award.prize) {
    return (
      <>
        <div className="flex size-20 items-center justify-center rounded-full bg-chart-4/20">
          <PartyPopper className="size-10 text-chart-4" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wider text-chart-4">
            Instant Win
          </p>
          <h1 className="text-2xl font-bold text-foreground text-balance">
            {award.prize.title}
          </h1>
          {award.prize.value_text && (
            <p className="text-sm text-muted-foreground">{award.prize.value_text}</p>
          )}
        </div>
        {award.prize.image_url && (
          <div className="w-full overflow-hidden rounded-lg">
            <img
              src={award.prize.image_url}
              alt={award.prize.title}
              className="h-48 w-full object-contain"
            />
          </div>
        )}
        <div className="flex flex-col gap-2 w-full">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {"You've also been entered into the main draw. We'll be in touch about your instant win prize."}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild className="w-full">
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

  return (
    <>
      <div className="flex size-16 items-center justify-center rounded-full bg-chart-2/15">
        <CheckCircle2 className="size-8 text-chart-2" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">{"You're In!"}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {"Your entry has been confirmed. You're now in the draw — good luck!"}
        </p>
      </div>
      {award.qty > 1 && (
        <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2">
          <Gift className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{award.qty} entries</span>
        </div>
      )}
      <div className="flex flex-col gap-2 w-full pt-2">
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
