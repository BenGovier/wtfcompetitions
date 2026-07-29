'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Banknote, CreditCard, Receipt, Ticket, TrendingUp, Wallet } from 'lucide-react'
import { KpiCard } from './KpiCard'
import { ReportFilterBar, type FilterState } from './ReportFilterBar'
import { RevenueChart } from './RevenueChart'
import { CampaignTable } from './CampaignTable'
import { formatCount, formatPence } from '@/lib/admin/reporting/format'
import type { DashboardPayload, ReportRange } from '@/lib/admin/reporting/types'

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

function buildQuery(f: FilterState): string {
  const p = new URLSearchParams()
  p.set('range', f.range)
  if (f.range === 'custom') {
    if (f.from) p.set('from', f.from)
    if (f.to) p.set('to', f.to)
  }
  if (f.campaign) p.set('campaign', f.campaign)
  if (f.provider) p.set('provider', f.provider)
  return p.toString()
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error ?? `request_failed_${res.status}`)
  }
  return json.data as DashboardPayload
}

export function ReportsDashboard({ initialRange = 'today' as ReportRange }: { initialRange?: ReportRange }) {
  const [filters, setFilters] = useState<FilterState>({
    range: initialRange,
    from: todayISO(),
    to: todayISO(),
    campaign: '',
    provider: '',
  })

  const query = useMemo(() => buildQuery(filters), [filters])
  // Custom range only fires once both dates are set.
  const ready = filters.range !== 'custom' || (Boolean(filters.from) && Boolean(filters.to))

  const { data, error, isLoading } = useSWR<DashboardPayload>(
    ready ? `/api/admin/reports?${query}` : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false },
  )

  const totals = data?.totals
  const changes = data?.changes
  const comparisonLabel = data?.comparison.label ?? 'previous period'
  const exportHref = `/api/admin/reports/export?${query}`

  return (
    <div className="flex flex-col gap-4">
      <ReportFilterBar
        value={filters}
        onChange={setFilters}
        campaigns={data?.available.campaigns ?? []}
        providers={data?.available.providers ?? []}
        exportHref={exportHref}
        disabled={isLoading && !data}
      />

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          Could not load reporting data. Please adjust the filters and try again.
        </div>
      ) : (
        <>
          {/* KPI grid — 2-up on mobile, 3-up on desktop. External revenue is primary. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard
              label="External revenue"
              value={formatPence(totals?.external_pence ?? 0)}
              pct={changes?.external_pct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Cash actually charged via a payment provider (card etc). Excludes WTF Credit — this is real money received."
              icon={CreditCard}
              primary
              loading={isLoading && !data}
            />
            <KpiCard
              label="Gross ticket sales"
              value={formatPence(totals?.gross_pence ?? 0)}
              pct={changes?.gross_pct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Total order value of confirmed tickets, including any amount paid with WTF Credit."
              icon={Banknote}
              loading={isLoading && !data}
            />
            <KpiCard
              label="WTF Credit redeemed"
              value={formatPence(totals?.credit_pence ?? 0)}
              pct={changes?.credit_pct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Portion of gross sales paid using existing WTF Credit. Not new external cash."
              icon={Wallet}
              loading={isLoading && !data}
            />
            <KpiCard
              label="Confirmed orders"
              value={formatCount(totals?.confirmed_orders ?? 0)}
              pct={changes?.orders_pct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Number of confirmed checkouts (excludes pending, failed, and test orders)."
              icon={Receipt}
              loading={isLoading && !data}
            />
            <KpiCard
              label="Tickets sold"
              value={formatCount(totals?.tickets_sold ?? 0)}
              pct={changes?.tickets_pct ?? null}
              comparisonLabel={comparisonLabel}
              hint="Total tickets across all confirmed orders in this period."
              icon={Ticket}
              loading={isLoading && !data}
            />
            <KpiCard
              label="Avg order value"
              value={formatPence(totals?.aov_pence ?? 0)}
              pct={null}
              comparisonLabel={comparisonLabel}
              hint="Gross ticket sales divided by confirmed orders."
              icon={TrendingUp}
              loading={isLoading && !data}
            />
          </div>

          {data ? (
            <>
              <RevenueChart points={data.chart.points} unit={data.chart.unit} />
              <CampaignTable rows={data.campaigns} />
              <p className="px-1 text-[11px] text-muted-foreground">
                Times shown in Europe/London.
                {data.meta.last_refresh_at
                  ? ` Rollup last refreshed ${new Date(data.meta.last_refresh_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}.`
                  : ''}
              </p>
            </>
          ) : (
            <div className="h-[240px] animate-pulse rounded-xl border border-border bg-card" />
          )}
        </>
      )}
    </div>
  )
}
