'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCount, formatPence } from '@/lib/admin/reporting/format'
import { formatRate, formatRatio, type GrowthDashboardPayload } from '@/lib/admin/reporting/growth'

type Wallet = GrowthDashboardPayload['walletImpact']

const HINT =
  'WTF Credit impact across confirmed orders in this period. "External cash per £1 credit" divides external cash ' +
  'from wallet-assisted orders by the total credit redeemed — how much real cash each £1 of credit helps unlock.'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

export function WalletImpactCard({ wallet, loading = false }: { wallet?: Wallet; loading?: boolean }) {
  if (loading || !wallet) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </section>
    )
  }

  const noConfirmed = wallet.confirmedOrders <= 0
  const noWallet = wallet.walletOrders <= 0

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">WTF Credit impact</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-bold text-muted-foreground"
              aria-label="How WTF Credit impact is calculated"
            >
              i
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-pretty">{HINT}</TooltipContent>
        </Tooltip>
      </div>

      {noConfirmed ? (
        <p className="flex h-24 items-center justify-center text-center text-sm text-muted-foreground">
          No confirmed orders in this period, so there is no WTF Credit activity to report.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-foreground">{formatRate(wallet.walletUsageRate)}</span>
            <span className="text-xs text-muted-foreground">of orders used WTF Credit</span>
          </div>

          {noWallet ? (
            <p className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
              No orders used WTF Credit in this period. {formatCount(wallet.confirmedOrders)} confirmed orders were
              fully external cash.
            </p>
          ) : (
            <div className="flex flex-col">
              <Row label="Wallet-assisted orders" value={formatCount(wallet.walletOrders)} />
              <Row label="Credit redeemed" value={formatPence(wallet.walletCreditRedeemedPence)} />
              <Row
                label="External cash (wallet orders)"
                value={formatPence(wallet.externalCashFromWalletOrdersPence)}
              />
              <Row label="Fully credit-funded orders" value={formatCount(wallet.fullyWalletFundedOrders)} />
              <Row
                label="Avg credit / wallet order"
                value={
                  wallet.averageCreditPerWalletOrderPence == null
                    ? '—'
                    : formatPence(wallet.averageCreditPerWalletOrderPence)
                }
              />
              <Row
                label="External cash per £1 credit"
                value={
                  wallet.externalCashPerCreditPound == null
                    ? '—'
                    : `£${formatRatio(wallet.externalCashPerCreditPound)}`
                }
              />
            </div>
          )}
        </>
      )}
    </section>
  )
}
