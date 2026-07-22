'use client'

import { useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Lock,
  Sparkles,
  Ticket,
  Trophy,
  Wallet,
  Zap,
} from 'lucide-react'

/**
 * A server-authoritative ticket option. Every monetary value originates on the
 * server (configured bundle price or qty × ticket price). The client only ever
 * SELECTS between these; it never invents a price.
 */
export interface ReviewOption {
  key: string
  qty: number
  /** null = per-ticket pricing (no bundle). */
  bundlePricePence: number | null
  totalPence: number
  savingsPence: number
}

/**
 * Format an integer pence amount as GBP with two decimal places (e.g. 2000 ->
 * "£20.00"). Clamps malformed/negative values to £0.00 so nothing negative or
 * raw ever renders.
 */
function formatGBP(pence: number): string {
  const safe = Number.isFinite(pence) ? Math.max(pence, 0) : 0
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(safe / 100)
}

// Non-negative SAFE integer guard (also rejects values above MAX_SAFE_INTEGER).
const isNonNegInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

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
  prizeTitle: string | null
  prizeValueText: string | null
  heroImageUrl: string | null
  ticketPricePence: number
  options: ReviewOption[]
  initialKey: string
  availableWalletPence: number
}

export function CheckoutReviewClient({
  campaignId,
  slug,
  title,
  prizeTitle,
  prizeValueText,
  heroImageUrl,
  ticketPricePence,
  options,
  initialKey,
  availableWalletPence,
}: CheckoutReviewClientProps) {
  // The toggle is OFF by default on every page load and is NOT persisted.
  const [useCredit, setUseCredit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Selected ticket option. Defaults to the option the customer arrived with.
  const [selectedKey, setSelectedKey] = useState(initialKey)
  const [showAllOptions, setShowAllOptions] = useState(false)

  // Synchronous latch: set BEFORE the first await so a rapid double-click can
  // never create two checkout intents. React state alone is not synchronous
  // enough to guarantee this.
  const submitLatch = useRef(false)

  // Resolve the current selection to a concrete, server-supplied option.
  const initialOption = useMemo(
    () => options.find((o) => o.key === initialKey) ?? options[0],
    [options, initialKey],
  )
  const selected = useMemo(
    () => options.find((o) => o.key === selectedKey) ?? initialOption,
    [options, selectedKey, initialOption],
  )

  // Authoritative-for-display selection values (all from the server option).
  const qty = selected.qty
  const validatedBundlePricePence = selected.bundlePricePence
  const displayTotalPence = selected.totalPence
  const hasBundle = validatedBundlePricePence != null

  const walletDisabled = availableWalletPence <= 0
  const walletVisible = availableWalletPence > 0

  // Display-only credit preview. This is NEVER treated as authoritative — the
  // create API (and the DB function) compute the real split. No API call and no
  // reservation happens when the toggle changes.
  const previewCreditPence = useCredit ? Math.min(availableWalletPence, displayTotalPence) : 0
  const previewExternalPence = displayTotalPence - previewCreditPence
  const fullyFunded = useCredit && previewExternalPence <= 0 && displayTotalPence > 0

  // Recommend the smallest configured option that offers MORE chances at a
  // higher total (so "just £X more" is always a real, positive difference).
  const recommended = useMemo(() => {
    const larger = options
      .filter((o) => o.qty > selected.qty && o.totalPence > selected.totalPence)
      .sort((a, b) => a.qty - b.qty || a.totalPence - b.totalPence)
    return larger[0] ?? null
  }, [options, selected])

  // Other valid options the customer could switch to (excludes the current one).
  const otherOptions = useMemo(
    () => options.filter((o) => o.key !== selected.key),
    [options, selected],
  )

  const backHref = slug ? `/giveaways/${slug}` : '/giveaways'
  const perUnitPence = hasBundle && qty > 0 ? Math.round(displayTotalPence / qty) : ticketPricePence

  /** Preserve campaignId, selected qty and bundlePricePence in the review URL. */
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

  function selectOption(key: string) {
    if (submitting) return
    setError(null)
    setSelectedKey(key)
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

      // The wallet object must be consistent with what the user actually
      // submitted (state captured at submit time):
      //   - useCredit === false -> a wallet object must NOT control routing;
      //   - useCredit === true  -> a valid wallet object is REQUIRED.
      const submittedUseCredit = useCredit

      if (!submittedUseCredit) {
        // A wallet object here is contradictory — never let it route payment.
        if (wallet !== undefined) {
          releaseForRetry()
          return
        }
        // Branch A — plain, non-wallet provider flow (unchanged behaviour).
        await goToProvider(ref)
        return
      }

      // submittedUseCredit === true from here.
      if (wallet === undefined) {
        releaseForRetry()
        return
      }

      // Validate the wallet split. Bad counters/flags, an unsafe sum, or a sum
      // that does not equal the server-rendered display total => malformed.
      const walletCreditPence = wallet.walletCreditPence
      const externalPaymentPence = wallet.externalPaymentPence
      const providerPaymentRequired = wallet.providerPaymentRequired
      const sum =
        isNonNegInt(walletCreditPence) && isNonNegInt(externalPaymentPence)
          ? walletCreditPence + externalPaymentPence
          : Number.NaN
      const validWallet =
        wallet.useCredit === true &&
        isNonNegInt(walletCreditPence) &&
        isNonNegInt(externalPaymentPence) &&
        typeof providerPaymentRequired === 'boolean' &&
        Number.isSafeInteger(sum) &&
        sum === displayTotalPence
      if (!validWallet) {
        releaseForRetry()
        return
      }

      const externalPence = externalPaymentPence as number
      const providerRequired = providerPaymentRequired as boolean

      // Only two consistent combinations are permitted; every other pairing is
      // contradictory and must call NO payment provider.
      const isFullyFunded = externalPence === 0 && providerRequired === false
      const isPartial = externalPence > 0 && providerRequired === true

      // Branch C — fully WTF Credit-funded: never call a PSP. Confirm directly.
      if (isFullyFunded) {
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

        // Award must be a NON-NULL, NON-ARRAY object. Arrays, primitives and
        // null are malformed and must NOT navigate to success.
        const award = confirmJson.award
        if (typeof award !== 'object' || award === null || Array.isArray(award)) {
          releaseForRetry()
          return
        }

        setStatus('Taking you to your entry…')
        window.location.assign(`/checkout/success?ref=${encodeURIComponent(ref)}&provider=wallet`)
        return
      }

      // Branch B — partial WTF Credit (external payment still due). Wallet
      // partial payments ALWAYS use the implemented Acquired route (never SumUp).
      if (isPartial) {
        setStatus('Taking you to secure payment…')
        await goToAcquired(ref)
        return
      }

      // Contradictory split (external 0 + providerPaymentRequired true, or
      // external > 0 + providerPaymentRequired false). Fail locally; call no PSP.
      releaseForRetry()
      return
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

  // ---- Dynamic CTA wording (display only — the backend stays authoritative) --
  let ctaLabel: string
  if (!useCredit || previewCreditPence <= 0) {
    ctaLabel = `Pay ${formatGBP(displayTotalPence)} securely`
  } else if (previewExternalPence > 0) {
    ctaLabel = `Use ${formatGBP(previewCreditPence)} credit & pay ${formatGBP(previewExternalPence)}`
  } else {
    ctaLabel = `Enter using ${formatGBP(previewCreditPence)} WTF Credit`
  }

  const primaryButton = (
    <Button
      size="lg"
      onClick={handleConfirm}
      disabled={submitting}
      className="w-full rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] py-4 text-base font-bold text-black shadow-[0_10px_40px_rgba(255,180,0,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner className="h-5 w-5" />
          {status ?? 'Processing…'}
        </span>
      ) : (
        ctaLabel
      )}
    </Button>
  )

  const trustRow = (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-purple-200">
      <span className="inline-flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
        Secure payment
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Ticket className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
        Tickets issued instantly
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-pink-400" aria-hidden="true" />
        Instant-win result revealed after entry
      </span>
    </div>
  )

  return (
    <div
      className="mx-auto w-full max-w-5xl px-4 py-5 pb-[var(--checkout-pad)] lg:py-10 lg:pb-10"
      style={{ '--checkout-pad': 'calc(17rem + env(safe-area-inset-bottom))' } as CSSProperties}
    >
      {/* Progress indicator — compact on mobile */}
      <ol className="mx-auto mb-5 flex max-w-md items-center justify-center gap-1.5 text-[11px] font-semibold sm:gap-2 sm:text-xs">
        {[
          { n: 1, label: 'Review', active: true },
          { n: 2, label: 'Secure payment', active: false },
          { n: 3, label: 'Reveal', active: false },
        ].map((step, i) => (
          <li key={step.n} className="flex items-center gap-2">
            <span
              className={
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 ' +
                (step.active
                  ? 'bg-gradient-to-r from-[#F7A600] to-[#FFD46A] text-black shadow-[0_0_16px_rgba(255,180,0,0.5)]'
                  : 'bg-white/5 text-purple-300')
              }
            >
              <span
                className={
                  'flex h-4 w-4 items-center justify-center rounded-full text-[10px] ' +
                  (step.active ? 'bg-black/20 text-black' : 'bg-white/10 text-purple-200')
                }
              >
                {step.n}
              </span>
              {step.label}
            </span>
            {i < 2 && <span className="h-px w-4 bg-purple-500/30" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <Link
        href={backHref}
        aria-disabled={submitting}
        tabIndex={submitting ? -1 : undefined}
        onClick={(e) => {
          if (submitting) e.preventDefault()
        }}
        className={
          'mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-purple-300 transition-colors hover:text-white ' +
          (submitting ? 'pointer-events-none opacity-50' : '')
        }
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to giveaway
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* LEFT — campaign excitement */}
        <section className="min-w-0 space-y-4 lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-purple-500/20 bg-[#160a26] shadow-[0_0_40px_rgba(168,85,247,0.15)]">
            {heroImageUrl && (
              <div className="aspect-[16/9] w-full overflow-hidden bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImageUrl || '/placeholder.svg'}
                  alt={prizeTitle ?? title}
                  className="h-full w-full object-contain"
                  loading="eager"
                  decoding="async"
                />
              </div>
            )}
            <div className="space-y-2 p-4 sm:p-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-pink-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                You&apos;re one step away from your tickets
              </span>
              <h1 className="text-balance break-words text-xl font-extrabold leading-tight sm:text-2xl">
                {title}
              </h1>
              {prizeTitle && prizeTitle !== title && (
                <p className="flex items-center gap-2 text-sm text-purple-200">
                  <Trophy className="h-4 w-4 shrink-0 text-yellow-300" aria-hidden="true" />
                  <span>
                    Win: <span className="font-semibold text-white">{prizeTitle}</span>
                  </span>
                </p>
              )}
              {prizeValueText && (
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-purple-300">Retail value</span>
                  <span className="text-lg font-bold text-yellow-300">{prizeValueText}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — checkout summary */}
        <section className="min-w-0 space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-purple-500/20 bg-[#160a26] p-5 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
            {/* Chances headline (moved in from the left column) */}
            <div className="text-center">
              <p className="text-xs font-medium text-purple-200">You&apos;re entering with</p>
              <p className="mt-0.5 text-balance break-words text-2xl font-extrabold leading-tight text-white drop-shadow-[0_0_18px_rgba(255,0,200,0.35)] sm:text-3xl">
                {qty} {qty === 1 ? 'chance' : 'chances'} to win
              </p>
              {selected.savingsPence > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  You&apos;re saving {formatGBP(selected.savingsPence)}
                </p>
              )}
            </div>

            <dl className="mt-4 space-y-2.5 border-t border-purple-500/15 pt-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-purple-200">{hasBundle ? 'Bundle price' : 'Price per ticket'}</dt>
                <dd className="font-semibold tabular-nums">
                  {hasBundle ? formatGBP(displayTotalPence) : formatGBP(perUnitPence)}
                </dd>
              </div>
              {selected.savingsPence > 0 && (
                <div className="flex items-center justify-between gap-4 text-emerald-300">
                  <dt>Bundle saving</dt>
                  <dd className="font-semibold tabular-nums">−{formatGBP(selected.savingsPence)}</dd>
                </div>
              )}
            </dl>

            <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-white/5 p-4">
              <span className="text-sm font-semibold text-purple-100">Order total</span>
              <span className="text-2xl font-extrabold tabular-nums text-yellow-300">
                {formatGBP(displayTotalPence)}
              </span>
            </div>

            {selectedKey !== initialKey && (
              <button
                type="button"
                onClick={() => selectOption(initialKey)}
                disabled={submitting}
                className="mt-3 text-xs font-medium text-purple-300 underline underline-offset-2 transition-colors hover:text-white disabled:opacity-50"
              >
                Back to {initialOption.qty} {initialOption.qty === 1 ? 'chance' : 'chances'}
              </button>
            )}

            {/* WTF Credit — ALWAYS rendered for authenticated users, directly
                below the order total. Premium panel when credit is available;
                a compact, disabled row when the balance is £0. */}
            <div className="mt-4 border-t border-purple-500/15 pt-4">
              {walletVisible ? (
                <div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/15 to-amber-500/5 p-4 shadow-[0_0_30px_rgba(247,166,0,0.15)]">
                  <div className="flex items-start justify-between gap-4">
                    <label htmlFor="use-credit" className="flex min-w-0 cursor-pointer items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/20">
                        <Wallet className="h-5 w-5 text-yellow-300" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 text-sm font-semibold text-yellow-100">
                        Use WTF Credit
                        <span className="block text-xs font-normal text-yellow-200/80">
                          Available:{' '}
                          <span className="font-bold tabular-nums text-yellow-200">
                            {formatGBP(availableWalletPence)}
                          </span>
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

                  <div
                    className={
                      'grid overflow-hidden transition-all duration-300 ease-out ' +
                      (useCredit ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')
                    }
                  >
                    <div className="min-h-0">
                      <div className="space-y-2 border-t border-yellow-500/20 pt-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-yellow-200/90">WTF Credit applied</span>
                          <span className="font-semibold tabular-nums text-yellow-100">
                            −{formatGBP(previewCreditPence)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-yellow-200/90">
                            {fullyFunded ? 'Nothing to pay by card' : 'To pay by card'}
                          </span>
                          <span className="font-semibold tabular-nums text-yellow-100">
                            {fullyFunded ? '£0.00' : formatGBP(previewExternalPence)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-white/5 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Wallet className="h-4 w-4 text-purple-200" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 text-sm font-semibold text-white">
                      WTF Credit
                      <span className="block truncate text-xs font-normal text-purple-300">
                        Balance <span className="font-bold tabular-nums">{formatGBP(0)}</span> · Win credit in
                        selected instant-win competitions
                      </span>
                    </span>
                  </div>
                  <Switch
                    id="use-credit"
                    checked={false}
                    disabled
                    aria-label="WTF Credit unavailable — no balance"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Smart upsell */}
          {recommended && (
            <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-pink-300" aria-hidden="true" />
                <p className="text-sm font-bold text-pink-100">Boost your chances</p>
              </div>
              <p className="mt-1 text-sm text-purple-100">
                Upgrade to <span className="font-bold text-white">{recommended.qty} chances</span> for just{' '}
                <span className="font-bold text-white">
                  {formatGBP(recommended.totalPence - displayTotalPence)}
                </span>{' '}
                more
                {recommended.savingsPence > 0 && (
                  <span className="text-emerald-300"> · save {formatGBP(recommended.savingsPence)}</span>
                )}
              </p>
              <Button
                type="button"
                onClick={() => selectOption(recommended.key)}
                disabled={submitting}
                className="mt-3 w-full rounded-xl bg-pink-500 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.01] hover:bg-pink-400 disabled:opacity-60"
              >
                Upgrade to {recommended.qty} chances
              </Button>
            </div>
          )}

          {/* Other ticket options — a small text link, not another large card */}
          {otherOptions.length > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowAllOptions((s) => !s)}
                aria-expanded={showAllOptions}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-300 underline underline-offset-2 transition-colors hover:text-white disabled:opacity-50"
              >
                See other ticket options
                <ChevronDown
                  className={'h-4 w-4 transition-transform ' + (showAllOptions ? 'rotate-180' : '')}
                  aria-hidden="true"
                />
              </button>
              {showAllOptions && (
                <ul className="mt-3 space-y-2 text-left">
                  {options.map((o) => {
                    const isSel = o.key === selected.key
                    return (
                      <li key={o.key}>
                        <button
                          type="button"
                          onClick={() => selectOption(o.key)}
                          disabled={submitting}
                          className={
                            'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-60 ' +
                            (isSel
                              ? 'border-yellow-400/60 bg-yellow-500/10'
                              : 'border-purple-500/20 bg-white/5 hover:border-purple-400/40')
                          }
                        >
                          <span className="flex items-center gap-2">
                            {isSel && <Check className="h-4 w-4 text-yellow-300" aria-hidden="true" />}
                            <span className="font-semibold text-white">
                              {o.qty} {o.qty === 1 ? 'chance' : 'chances'}
                            </span>
                            {o.savingsPence > 0 && (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                save {formatGBP(o.savingsPence)}
                              </span>
                            )}
                          </span>
                          <span className="font-bold tabular-nums text-yellow-300">
                            {formatGBP(o.totalPence)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-500/15 p-3 text-sm text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Desktop / inline CTA */}
          <div className="hidden space-y-3 lg:block">
            {primaryButton}
            {trustRow}
          </div>

          <p aria-live="polite" className="sr-only">
            {status ?? ''}
          </p>
        </section>
      </div>

      {/* Mobile sticky CTA — sits fully ABOVE the bottom nav (h-20 = 80px) and
          its elevated centre button (-mt-6 = 24px protrusion), plus the device
          safe-area inset. Never bottom:0. */}
      <div
        className="fixed inset-x-0 z-40 px-3 lg:hidden"
        style={{ bottom: 'calc(5rem + 2rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-5xl space-y-2 rounded-2xl border border-purple-500/30 bg-[#0e0618]/95 p-3 shadow-[0_-4px_30px_rgba(0,0,0,0.5)] backdrop-blur">
          {primaryButton}
          {trustRow}
        </div>
      </div>
    </div>
  )
}
