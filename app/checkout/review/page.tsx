import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CheckoutReviewClient } from '@/components/checkout/checkout-review-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Review your entry',
  robots: { index: false, follow: false },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Strict decimal-integer syntax for query params. These reject whitespace
// padding, exponent notation (1e2), decimals, signs, empty strings and arrays
// because Number(...) is only ever applied AFTER a successful regex match.
const QTY_RE = /^[1-9]\d{0,2}$/ // 1–999 by syntax; range re-checked to 1–500
const BUNDLE_PENCE_RE = /^\d+$/ // non-negative integer, no sign/decimal/exponent

// Non-negative SAFE integer guard (also rejects values above MAX_SAFE_INTEGER).
const isNonNegInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

const PAGE_BG =
  'min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_#3a0f4f_0%,_#1b0b2b_40%,_#0e0618_100%)] text-white'

/** Clean, self-contained "invalid" state. Never creates an intent. */
function InvalidState() {
  return (
    <div className={PAGE_BG}>
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-purple-500/20 bg-[#160a26] p-8 text-center shadow-[0_0_40px_rgba(168,85,247,0.15)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-900/50">
            <AlertCircle className="h-6 w-6 text-pink-400" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold">Checkout details are invalid</h1>
          <p className="text-sm leading-relaxed text-purple-200">
            We couldn&apos;t start this checkout. Please head back and choose your tickets again.
          </p>
          <Link
            href="/giveaways"
            className="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#F7A600] via-[#FFD46A] to-[#F7A600] px-6 py-3 text-sm font-bold text-black transition-transform hover:scale-[1.02]"
          >
            Browse giveaways
          </Link>
        </div>
      </div>
    </div>
  )
}

interface ReviewPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CheckoutReviewPage({ searchParams }: ReviewPageProps) {
  const sp = await searchParams

  // ---- 1) Validate untrusted query parameters ----
  const campaignIdRaw = typeof sp.campaignId === 'string' ? sp.campaignId : ''
  const qtyRaw = typeof sp.qty === 'string' ? sp.qty : ''
  const bundleRaw = typeof sp.bundlePricePence === 'string' ? sp.bundlePricePence : undefined

  const campaignId = campaignIdRaw.trim()
  if (campaignId.length === 0 || campaignId.length > 64 || !UUID_RE.test(campaignId)) {
    return <InvalidState />
  }

  // qty must match strict integer syntax, THEN be within 1–500.
  if (!QTY_RE.test(qtyRaw)) {
    return <InvalidState />
  }
  const qty = Number(qtyRaw)
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 500) {
    return <InvalidState />
  }

  let requestedBundlePence: number | null = null
  if (bundleRaw !== undefined) {
    // Optional bundle price: strict non-negative integer syntax, THEN a finite
    // safe non-negative integer value.
    if (!BUNDLE_PENCE_RE.test(bundleRaw)) {
      return <InvalidState />
    }
    const parsed = Number(bundleRaw)
    if (!isNonNegInt(parsed)) {
      return <InvalidState />
    }
    requestedBundlePence = parsed
  }

  // ---- 2) Authenticate (redirect logged-out users, preserving the URL) ----
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const params = new URLSearchParams()
    params.set('campaignId', campaignId)
    params.set('qty', String(qty))
    if (requestedBundlePence != null) params.set('bundlePricePence', String(requestedBundlePence))
    const reviewUrl = `/checkout/review?${params.toString()}`
    redirect(`/auth/login?redirect=${encodeURIComponent(reviewUrl)}`)
  }

  // ---- 3) Load authoritative campaign data (RLS-scoped client) ----
  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, slug, title, status, ticket_price_pence, max_tickets_total, bundles')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign || campaign.status !== 'live') {
    return <InvalidState />
  }

  const ticketPricePence = isNonNegInt(campaign.ticket_price_pence) ? campaign.ticket_price_pence : null

  // ---- 4) Derive the authoritative display total (server-side) ----
  let validatedBundlePricePence: number | null = null
  let displayTotalPence: number

  if (requestedBundlePence != null) {
    // Accept the bundle ONLY when it exactly matches a configured bundle for the
    // selected quantity — the same rule the checkout-create route enforces.
    const bundles = Array.isArray(campaign.bundles) ? campaign.bundles : []
    const matched = (bundles as { quantity?: unknown; price_pence?: unknown }[]).find(
      (b) => Number(b.quantity) === qty && Number(b.price_pence) === requestedBundlePence,
    )
    if (!matched) {
      // Never display an unverified bundle price.
      return <InvalidState />
    }
    validatedBundlePricePence = requestedBundlePence
    displayTotalPence = requestedBundlePence
  } else {
    if (ticketPricePence == null) {
      return <InvalidState />
    }
    displayTotalPence = qty * ticketPricePence
  }

  if (!isNonNegInt(displayTotalPence)) {
    return <InvalidState />
  }

  // ---- 5) Wallet balance (authenticated, RLS-scoped, never service role) ----
  let availableWalletPence = 0
  const { data: walletRow, error: walletErr } = await supabase
    .from('wallet_accounts')
    .select('balance_pence, reserved_pence')
    .eq('user_id', user.id)
    .maybeSingle()

  if (walletErr) {
    console.error('[checkout/review] wallet_accounts lookup failed:', walletErr.message)
  } else if (walletRow) {
    const balancePence = isNonNegInt(walletRow.balance_pence) ? walletRow.balance_pence : 0
    const reservedPence = isNonNegInt(walletRow.reserved_pence) ? walletRow.reserved_pence : 0
    availableWalletPence = Math.max(balancePence - reservedPence, 0)
  }

  return (
    <div className={PAGE_BG}>
      <CheckoutReviewClient
        campaignId={campaign.id}
        slug={typeof campaign.slug === 'string' ? campaign.slug : null}
        title={typeof campaign.title === 'string' && campaign.title.length > 0 ? campaign.title : 'Your entry'}
        qty={qty}
        ticketPricePence={ticketPricePence ?? 0}
        validatedBundlePricePence={validatedBundlePricePence}
        displayTotalPence={displayTotalPence}
        availableWalletPence={availableWalletPence}
      />
    </div>
  )
}
