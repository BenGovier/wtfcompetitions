'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, ArrowLeft, Wallet } from 'lucide-react'

/**
 * Format an integer pence amount as GBP with two decimal places (e.g. 2000 ->
 * "£20.00"). Clamps malformed/negative values to £0.00 so nothing negative or
 * raw ever renders.
 */
function formatGBP(pence: number): string {
  const safe = Number.isFinite(pence) ? Math.max(pence, 0) : 0
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(safe / 100)
}

const isNonNegInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0

/**
 * Friendly, non-technical copy for every known failure code. Raw API/database/
 * provider error text is NEVER shown — anything not in this map falls back to a
 * single generic message.
 */
const FRIENDLY_ERRORS: Record<string, string> = {
  auth_required: 'Please log in to complete your entry.',
  sold_out: 'This giveaway just sold out. Please try a smaller quantity or another giveaway.',
  user_ticket_cap_exceeded: "You've reached the maximum number of tickets allowed for this giveaway.",
  wallet_prepare_failed: "We couldn't apply your WTF Credit. Your credit was not charged — please try again.",
  invalid_wallet_split: "We couldn't apply your WTF Credit. Your credit was not charged — please try again.",
  wallet_reservation_invalid:
    'Your WTF Credit hold expired before checkout completed. Your credit was not charged — please try again.',
  wallet_reservation_unavailable:
    'Your WTF Credit is temporarily unavailable. Your credit was not charged — please try again.',
  wallet_confirmation_invalid_state:
    "We couldn't confirm this order. Your credit was not charged — please start again.",
  provider_payment_not_required: 'Please try again to finish your entry.',
}

const GENERIC_ERROR = 'Something went wrong. Please try again.'

function friendlyError(code: unknown): string {
  if (typeof code === 'string' && code in FRIENDLY_ERRORS) return FRIENDLY_ERRORS[code]
  return GENERIC_ERROR
}

interface CheckoutReviewClientProps {
  campaignId: string
  slug: string | null
  title: string
  qty: number
  ticketPricePence: number
  /** Present ONLY when the requested bundle exactly matches a configured bundle. */
  validatedBundlePricePence: number | null
  displayTotalPence: number
  availableWalletPence: number
}

export function CheckoutReviewClient({
  campaignId,
  slug,
  title,
  qty,
  ticketPricePence,
  validatedBundlePricePence,
  displayTotalPence,
  availableWalletPence,
}: CheckoutReviewClientProps) {
  // The toggle is OFF by default on every page load and is NOT persisted.
  const [useCredit, setUseCredit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Synchronous latch: set BEFORE the first await so a rapid double-click can
  // never create two checkout intents. React state alone is not synchronous
  // enough to guarantee this.
  const submitLatch = useRef(false)

  const hasBundle = validatedBundlePricePence != null
  const walletDisabled = availableWalletPence <= 0

  // Display-only credit preview. This is NEVER treated as authoritative — the
  // create API (and the DB function) compute the real split. No API call and no
  // reservation happens when the toggle changes.
  const previewCreditPence = useCredit ? Math.min(availableWalletPence, displayTotalPence) : 0
  const previewExternalPence = displayTotalPence - previewCreditPence

  const backHref = slug ? `/giveaways/${slug}` : '/giveaways'

  /** Preserve campaignId, qty and bundlePricePence in the review URL. */
  function buildReviewUrl(): string {
    const params = new URLSearchParams()
    params.set('campaignId', campaignId)
    params.set('qty', String(qty))
    if (validatedBundlePricePence != null) {
      params.set('bundlePricePence', String(validatedBundlePricePence))
    }
    return `/checkout/review?${params.toString()}`
  }

  function redirectToLogin() {
    const redirect = encodeURIComponent(buildReviewUrl())
    window.location.href = `/auth/login?redirect=${redirect}`
  }

  /** Release the latch and clear the busy state so the user can retry. */
  function releaseForRetry(code?: unknown) {
    setError(friendlyError(code))
    setStatus(null)
    setSubmitting(false)
    submitLatch.current = false
  }

  async function handleConfirm() {
    // Synchronous guard — set the latch before any await.
    if (submitLatch.current) return
    submitLatch.current = true
    setSubmitting(true)
    setError(null)
    setStatus('Preparing checkout…')

    try {
      if (useCredit) setStatus('Applying WTF Credit…')

      const createRes = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          qty,
          ...(validatedBundlePricePence != null ? { bundlePricePence: validatedBundlePricePence } : {}),
          useCredit,
        }),
      })

      if (createRes.status === 401) {
        redirectToLogin()
        return
      }

      let createJson: Record<string, unknown>
      try {
        createJson = (await createRes.json()) as Record<string, unknown>
      } catch {
        releaseForRetry()
        return
      }

      if (!createRes.ok || createJson.ok !== true) {
        releaseForRetry(createJson.error)
        return
      }

      const ref = createJson.ref
      if (typeof ref !== 'string' || ref.length === 0 || ref.length > 128) {
        releaseForRetry()
        return
      }

      const wallet = createJson.wallet as Record<string, unknown> | undefined

      // Validate the wallet object when present. Bad counters/flags => malformed.
      if (wallet !== undefined) {
        const walletCreditPence = wallet.walletCreditPence
        const externalPaymentPence = wallet.externalPaymentPence
        const providerPaymentRequired = wallet.providerPaymentRequired
        const validWallet =
          wallet.useCredit === true &&
          isNonNegInt(walletCreditPence) &&
          isNonNegInt(externalPaymentPence) &&
          typeof providerPaymentRequired === 'boolean' &&
          walletCreditPence + externalPaymentPence === displayTotalPence
        if (!validWallet) {
          releaseForRetry()
          return
        }
      }

      // Branch A — no wallet in the response (useCredit was false): preserve the
      // existing provider behaviour exactly.
      if (wallet === undefined) {
        await goToProvider(ref)
        return
      }

      const externalPaymentPence = wallet.externalPaymentPence as number
      const providerPaymentRequired = wallet.providerPaymentRequired as boolean

      // Branch C — fully WTF Credit-funded: never call a PSP. Confirm directly.
      if (externalPaymentPence === 0 && providerPaymentRequired === false) {
        setStatus('Confirming your entry…')
        const confirmRes = await fetch('/api/checkout/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref, provider: 'wallet' }),
        })

        if (confirmRes.status === 401) {
          redirectToLogin()
          return
        }

        let confirmJson: Record<string, unknown>
        try {
          confirmJson = (await confirmRes.json()) as Record<string, unknown>
        } catch {
          releaseForRetry()
          return
        }

        if (!confirmRes.ok || confirmJson.ok !== true) {
          releaseForRetry(confirmJson.error)
          return
        }

        if (typeof confirmJson.award !== 'object' || confirmJson.award === null) {
          releaseForRetry()
          return
        }

        setStatus('Taking you to your entry…')
        window.location.assign(`/checkout/success?ref=${encodeURIComponent(ref)}&provider=wallet`)
        return
      }

      // Branch B — partial WTF Credit (external payment still due). Wallet
      // partial payments ALWAYS use the implemented Acquired route (never SumUp).
      setStatus('Taking you to secure payment…')
      await goToAcquired(ref)
    } catch {
      releaseForRetry()
    }
  }

  /** Non-wallet provider routing, mirroring the previous TicketSelector flow. */
  async function goToProvider(ref: string) {
    const useAcquired =
      (process.env.NEXT_PUBLIC_CHECKOUT_PROVIDER ?? '').trim().toLowerCase() === 'acquired'

    setStatus('Taking you to secure payment…')

    if (useAcquired) {
      await goToAcquired(ref)
      return
    }

    // SumUp fallback (rollback switch) — unchanged behaviour.
    const sumupRes = await fetch('/api/payments/sumup/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref }),
    })

    if (sumupRes.status === 401) {
      redirectToLogin()
      return
    }

    let sumupJson: Record<string, unknown>
    try {
      sumupJson = (await sumupRes.json()) as Record<string, unknown>
    } catch {
      releaseForRetry()
      return
    }

    const checkoutUrl = sumupJson.checkoutUrl
    if (sumupRes.ok && sumupJson.ok === true && typeof checkoutUrl === 'string' && checkoutUrl.length > 0) {
      window.location.assign(checkoutUrl)
      return
    }

    releaseForRetry(sumupJson.error)
  }

  /** Acquired Hosted Checkout — authoritative for the external amount. */
  async function goToAcquired(ref: string) {
    const acquiredRes = await fetch('/api/payments/acquired/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref }),
    })

    if (acquiredRes.status === 401) {
      redirectToLogin()
      return
    }

    let acquiredJson: Record<string, unknown>
    try {
      acquiredJson = (await acquiredRes.json()) as Record<string, unknown>
    } catch {
      releaseForRetry()
      return
    }

    const checkoutUrl = acquiredJson.checkout_url
    if (
      acquiredRes.ok &&
      acquiredJson.ok === true &&
      typeof checkoutUrl === 'string' &&
      checkoutUrl.length > 0
    ) {
      window.location.assign(checkoutUrl)
      return
    }

    releaseForRetry(acquiredJson.error)
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <Link
        href={backHref}
        aria-disabled={submitting}
        tabIndex={submitting ? -1 : undefined}
        onClick={(e) => {
          if (submitting) e.preventDefault()
        }}
        className={
          'mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-purple-200 transition-colors hover:text-white ' +
          (submitting ? 'pointer-events-none opacity-50' : '')
        }
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to giveaway
      </Link>

      <Card className="border border-purple-500/20 bg-[#160a26] p-5 text-white shadow-[0_0_40px_rgba(168,85,247,0.15)] sm:p-6">
        <h1 className="text-balance text-2xl font-extrabold leading-tight">Review your entry</h1>
        <p className="mt-1 text-sm text-purple-200">{title}</p>

        <Separator className="my-5 bg-purple-500/20" />

        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-purple-200">Tickets</dt>
            <dd className="font-semibold tabular-nums">{qty}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-purple-200">{hasBundle ? 'Bundle price' : 'Price per ticket'}</dt>
            <dd className="font-semibold tabular-nums">
              {hasBundle ? formatGBP(validatedBundlePricePence!) : formatGBP(ticketPricePence)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-base font-semibold">Order total</dt>
            <dd className="text-base font-bold tabular-nums">{formatGBP(displayTotalPence)}</dd>
          </div>
        </dl>

        <Separator className="my-5 bg-purple-500/20" />

        {/* WTF Credit — the whole block only renders because the server passed a
            balance for an authenticated user. */}
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <label htmlFor="use-credit" className="flex cursor-pointer items-center gap-2">
              <Wallet className="h-5 w-5 shrink-0 text-yellow-300" aria-hidden="true" />
              <span className="text-sm font-semibold text-yellow-100">
                Use WTF Credit
                <span className="block text-xs font-normal text-yellow-200/80">
                  Available: <span className="tabular-nums">{formatGBP(availableWalletPence)}</span>
                </span>
              </span>
            </label>
            <Switch
              id="use-credit"
              checked={useCredit}
              onCheckedChange={setUseCredit}
              disabled={walletDisabled || submitting}
              aria-label="Use WTF Credit for this order"
            />
          </div>

          {useCredit && (
            <div className="mt-4 space-y-2 border-t border-yellow-500/20 pt-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-yellow-200/90">WTF Credit applied</span>
                <span className="font-semibold tabular-nums text-yellow-100">
                  −{formatGBP(previewCreditPence)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-yellow-200/90">To pay by card</span>
                <span className="font-semibold tabular-nums text-yellow-100">
                  {formatGBP(previewExternalPence)}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-lg bg-red-500/15 p-3 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Button
          size="lg"
          onClick={handleConfirm}
          disabled={submitting}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] py-4 text-base font-bold text-black shadow-[0_10px_40px_rgba(255,180,0,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-5 w-5" />
              {status ?? 'Processing…'}
            </span>
          ) : (
            'Confirm and pay'
          )}
        </Button>

        <p aria-live="polite" className="sr-only">
          {status ?? ''}
        </p>
      </Card>
    </div>
  )
}
