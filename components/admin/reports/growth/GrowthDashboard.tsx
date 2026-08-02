'use client'

import { useCallback, useRef, useState } from 'react'
import useSWR from 'swr'
import { CreditCard, RefreshCw, ShoppingBag, TrendingUp, Users } from 'lucide-react'
import { KpiCard } from '../KpiCard'
import { CheckoutHealthCard } from './CheckoutHealthCard'
import { WalletImpactCard } from './WalletImpactCard'
import { CampaignMomentum } from './CampaignMomentum'
import { formatCount, formatPence } from '@/lib/admin/reporting/format'
import {
  comparisonLabelForRange,
  formatRatio,
  growthSwrKey,
  type GrowthDashboardPayload,
} from '@/lib/admin/reporting/growth'
import type { ReportRange } from '@/lib/admin/reporting/types'

const REFRESH_INTERVAL_MS = 60_000

interface GrowthDashboardProps {
  active: boolean
  ready: boolean
  query: string
  range: ReportRange
}

/**
 * Growth Analytics view. Entirely self-contained SWR: the key is null while the
 * tab is inactive, so NO request (and no polling) happens until Growth is open.
 * Uses the same reporting polling contract as Overview and aborts stale
 * in-flight requests so a slow response can never overwrite a newer one.
 */
export function GrowthDashboard({ active, ready, query, range }: GrowthDashboardProps) {
  const abortRef = useRef<AbortController | null>(null)

  const fetcher = useCallback(async (url: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error ?? `request_failed_${res.status}`)
    }
    return json.data as GrowthDashboardPayload
  }, [])

  const { data, error, isLoading, isValidating, mutate } = useSWR<GrowthDashboardPayload>(
    growthSwrKey(active, ready, query),
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      refreshInterval: REFRESH_INTERVAL_MS,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      dedupingInterval: REFRESH_INTERVAL_MS,
    },
  )

  const [, forceTick] = useState(0)
  const refreshing = isValidating && Boolean(data)
  const loading = isLoading && !data
  const comparisonLabel = comparisonLabelForRange(range)
  const c = data?.customers

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-live="polite">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${refreshing ? 'animate-pulse bg-primary' : 'bg-muted-foreground/40'}`}
            aria-hidden="true"
          />
          {error && data ? 'Showing last good data · retry failed' : 'Growth analytics · updated live'}
        </p>
        <button
          type="button"
          onClick={() => {
            forceTick((n) => n + 1)
            void mutate()
          }}
          disabled={isValidating}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && !data ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          <p>Could not load Growth analytics. Your other Dashboard data is unaffected.</p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-2.5 py-1 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* KPI grid — 2-up on mobile, 4-up on desktop. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Unique buyers"
              value={formatCount(c?.uniqueBuyers.current ?? 0)}
              pct={c?.uniqueBuyers.changePct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Distinct confirmed buyers in this period (deduplicated across orders). No identities are shown."
              icon={Users}
              primary
              loading={loading}
            />
            <KpiCard
              label="Orders per buyer"
              value={formatRatio(c?.ordersPerBuyer.current)}
              pct={c?.ordersPerBuyer.changePct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Confirmed orders divided by unique buyers. Higher means buyers are placing repeat orders."
              icon={ShoppingBag}
              loading={loading}
            />
            <KpiCard
              label="External rev / buyer"
              value={formatPence(c?.externalRevenuePerBuyerPence.current ?? 0)}
              pct={c?.externalRevenuePerBuyerPence.changePct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Real external cash divided by unique buyers. Uses the external-payment fallback for older orders."
              icon={CreditCard}
              loading={loading}
            />
            <KpiCard
              label="Avg order value"
              value={formatPence(c?.averageOrderValuePence.current ?? 0)}
              pct={c?.averageOrderValuePence.changePct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Growth AOV = external cash ÷ confirmed orders. (The Overview AOV uses gross ticket sales and is unchanged.)"
              icon={TrendingUp}
              loading={loading}
            />
          </div>

          {/* Checkout health + WTF Credit, side by side on desktop. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CheckoutHealthCard health={data?.checkoutHealth} loading={loading} />
            <WalletImpactCard wallet={data?.walletImpact} loading={loading} />
          </div>

          {data ? (
            <CampaignMomentum rows={data.campaignMomentum} />
          ) : (
            <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
          )}

          {data ? (
            <p className="px-1 text-[11px] text-muted-foreground">
              Times shown in Europe/London. Buyer &amp; revenue metrics use confirmed time; checkout health uses
              creation time.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
