'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Megaphone } from 'lucide-react'
import {
  type MarketingAnalyticsResponse,
  formatPence,
  formatCount,
  isRevenueWinner,
} from '@/lib/admin/marketing/analytics'

/**
 * Compact Marketing performance summary for the Super-Admin dashboard.
 *
 * Read-only. Fetches the fixed 30-day window from the admin-gated analytics
 * endpoint and shows the three figures that matter at a glance: emails
 * delivered, click rate, and REAL attributed external revenue (never blended
 * with WTF Credit or gross ticket value). Deep-links into the full Marketing
 * Overview. Fails quietly — a summary card must never break the dashboard.
 */
export function MarketingDashboardCard() {
  const [data, setData] = useState<MarketingAnalyticsResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch('/api/admin/marketing/analytics?period=30d', {
          signal: ac.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as MarketingAnalyticsResponse
        if (active) {
          setData(json)
          setState('ready')
        }
      } catch (err) {
        if (active && !ac.signal.aborted) setState('error')
      }
    })()
    return () => {
      active = false
      ac.abort()
    }
  }, [])

  const totals = data?.totals
  const revenueWinner = isRevenueWinner(
    totals ? { externalCashPence: totals.attributedExternalCashPence } : null,
  )

  return (
    <section
      aria-labelledby="marketing-card-heading"
      className="rounded-xl border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Megaphone className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="marketing-card-heading" className="text-sm font-semibold text-foreground">
              Marketing performance
            </h2>
            <p className="text-xs text-muted-foreground">Lifecycle email · last 30 days</p>
          </div>
        </div>
        <Link
          href="/admin/marketing"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {state === 'loading' ? (
        <div className="mt-4 grid grid-cols-3 gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : state === 'error' ? (
        <p className="mt-4 text-sm text-muted-foreground">Performance data is unavailable right now.</p>
      ) : (
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-background p-3">
            <dt className="text-xs text-muted-foreground">Delivered</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatCount(totals?.delivered)}
            </dd>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <dt className="text-xs text-muted-foreground">Click rate</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {`${(totals?.clickRatePct ?? 0).toFixed(1)}%`}
            </dd>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <dt className="text-xs text-muted-foreground">Attributed revenue</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {revenueWinner ? formatPence(totals?.attributedExternalCashPence) : '—'}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
