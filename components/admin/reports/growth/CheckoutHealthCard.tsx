'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCount } from '@/lib/admin/reporting/format'
import { formatRate, type GrowthDashboardPayload } from '@/lib/admin/reporting/growth'

type Health = GrowthDashboardPayload['checkoutHealth']

const COHORT_HINT =
  'Based on checkout attempts CREATED in this period. Success rate = confirmed \u00f7 (confirmed + failed + abandoned). ' +
  'Pending attempts under 30 minutes old are still "in progress" and are excluded from the success denominator.'

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'bad' | 'muted' }) {
  const valueTone =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'bad'
        ? 'text-red-600 dark:text-red-400'
        : tone === 'muted'
          ? 'text-muted-foreground'
          : 'text-foreground'
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-background p-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${valueTone}`}>{value}</span>
    </div>
  )
}

export function CheckoutHealthCard({ health, loading = false }: { health?: Health; loading?: boolean }) {
  if (loading || !health) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </section>
    )
  }

  const rate = health.successRate
  const rateTone = rate == null ? 'muted' : rate >= 0.6 ? 'good' : rate >= 0.35 ? 'default' : 'bad'

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Checkout health</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground"
              aria-label="How checkout health is calculated"
            >
              i
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-pretty">{COHORT_HINT}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums ${rate == null ? 'text-muted-foreground' : rateTone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : rateTone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
          {formatRate(rate)}
        </span>
        <span className="text-xs text-muted-foreground">success rate</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Created" value={formatCount(health.created)} tone="muted" />
        <Stat label="Confirmed" value={formatCount(health.confirmed)} tone="good" />
        <Stat label="Failed" value={formatCount(health.failed)} tone="bad" />
        <Stat label="Abandoned" value={formatCount(health.abandoned)} tone="bad" />
        <Stat label="In progress" value={formatCount(health.inProgress)} tone="muted" />
        <Stat label="Completed attempts" value={formatCount(health.completedAttempts)} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        In-progress attempts (pending &lt; 30 min) are excluded from the success-rate denominator.
      </p>
    </section>
  )
}
