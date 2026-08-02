'use client'

import { formatCount, formatPence } from '@/lib/admin/reporting/format'
import {
  capCampaigns,
  toMobileCampaignCard,
  type GrowthCampaignRow,
} from '@/lib/admin/reporting/growth'

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'live' || status === 'active'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : status === 'ended' || status === 'closed'
        ? 'bg-muted text-muted-foreground'
        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
      {status}
    </span>
  )
}

function agoLabel(iso: string | null): string {
  if (!iso) return 'no sales yet'
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return '—'
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function soldLabel(pct: number | null): string {
  return pct == null ? '—' : `${pct.toFixed(1)}%`
}

export function CampaignMomentum({ rows }: { rows: GrowthCampaignRow[] }) {
  const capped = capCampaigns(rows)

  if (capped.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
          Campaign momentum
        </h2>
        <div className="flex h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          No live campaigns right now. Momentum appears here once a campaign is live.
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Campaign momentum</h2>
        <span className="text-[11px] text-muted-foreground">Live campaigns · top {capped.length}</span>
      </div>

      {/* Mobile: stacked cards prioritising the six phone-first fields. */}
      <ul className="divide-y divide-border md:hidden">
        {capped.map(toMobileCampaignCard).map((c) => (
          <li key={c.campaignId} className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-pretty text-sm font-semibold text-foreground">{c.title}</span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">
                {c.soldLabel} sold
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
              <div className="flex flex-col">
                <dt className="text-muted-foreground">24h tickets</dt>
                <dd className="font-semibold tabular-nums text-foreground">{formatCount(c.ticketsLast24Hours)}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-muted-foreground">24h cash</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {formatPence(c.externalRevenueLast24HoursPence)}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-muted-foreground">24h buyers</dt>
                <dd className="font-semibold tabular-nums text-foreground">{formatCount(c.uniqueBuyersLast24Hours)}</dd>
              </div>
            </dl>
            <p className="text-[11px] text-muted-foreground">Last sale {agoLabel(c.lastConfirmedAt)}</p>
          </li>
        ))}
      </ul>

      {/* Desktop: full table. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 font-medium">Campaign</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">% sold</th>
              <th className="px-4 py-2 text-right font-medium">Tickets (period)</th>
              <th className="px-4 py-2 text-right font-medium">Tickets 24h</th>
              <th className="px-4 py-2 text-right font-medium">Cash 24h</th>
              <th className="px-4 py-2 text-right font-medium">Buyers 24h</th>
              <th className="px-4 py-2 text-right font-medium">AOV</th>
              <th className="px-4 py-2 text-right font-medium">Last sale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {capped.map((r) => (
              <tr key={r.campaignId} className="hover:bg-muted/40">
                <td className="max-w-[220px] truncate px-4 py-2 font-medium text-foreground">{r.title}</td>
                <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">{soldLabel(r.soldPercentage)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatCount(r.ticketsInPeriod)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatCount(r.ticketsLast24Hours)}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-foreground">
                  {formatPence(r.externalRevenueLast24HoursPence)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{formatCount(r.uniqueBuyersLast24Hours)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {r.averageOrderValuePence == null ? '—' : formatPence(r.averageOrderValuePence)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{agoLabel(r.lastConfirmedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        {'AOV = external cash \u00f7 confirmed orders (period). Sold % is lifetime tickets vs capacity.'}
      </p>
    </section>
  )
}
