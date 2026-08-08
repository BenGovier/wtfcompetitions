"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Ban, ShieldCheck, Copy, Mail, Phone, CalendarDays } from "lucide-react"
import type { AdminRole } from "@/lib/admin/permissions"
import { AddCreditDialog, type CreditSuccess } from "@/components/admin/wallets/AddCreditDialog"
import { SelfExcludeDialog } from "@/components/admin/wallets/SelfExcludeDialog"
import { CustomerPurchaseHistory } from "./CustomerPurchaseHistory"
import { formatPence, formatDate, formatUkMobile, resolveCustomerName, resolveSecondaryHandle } from "./format"

type Customer = {
  user_id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  real_name: string | null
  email: string | null
  mobile: string | null
  joined: string | null
}
type Balances = { balance_pence: number; reserved_pence: number; available_pence: number }
type Summary = {
  confirmed_order_count: number
  total_order_value_pence: number
  lifetime_external_pence: number
  total_wallet_credit_pence: number
  total_tickets_purchased: number
  first_confirmed_at: string | null
  last_confirmed_at: string | null
}

export function CustomerDetail({ userId, role }: { userId: string; role: AdminRole }) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [restricted, setRestricted] = useState(false)
  const [balances, setBalances] = useState<Balances>({ balance_pence: 0, reserved_pence: 0, available_pence: 0 })

  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const fetchAccount = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${userId}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json?.error === "invalid_identifier" ? "Invalid customer reference." : "Failed to load this customer.")
        return
      }
      setCustomer(json.customer)
      setRestricted(json.restricted === true)
      setBalances(json.balances)
    } catch {
      setError("This customer is temporarily unavailable. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchSummary = useCallback(async () => {
    setSummaryError(null)
    try {
      const res = await fetch(`/api/admin/customers/${userId}/summary`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setSummaryError("Purchase summary is temporarily unavailable.")
        return
      }
      setSummary(json.summary)
    } catch {
      setSummaryError("Purchase summary is temporarily unavailable.")
    }
  }, [userId])

  useEffect(() => {
    fetchAccount()
    fetchSummary()
  }, [fetchAccount, fetchSummary])

  const handleCredited = useCallback((result: CreditSuccess) => {
    setBalances({
      balance_pence: result.balancePence,
      reserved_pence: result.reservedPence,
      available_pence: result.availablePence,
    })
  }, [])

  const handleExcluded = useCallback(() => {
    // Optimistically reflect, then re-confirm from the authoritative endpoint.
    setRestricted(true)
    fetchAccount()
  }, [fetchAccount])

  const copyUserId = async () => {
    try {
      await navigator.clipboard.writeText(userId)
      toast({ title: "User ID copied" })
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" })
    }
  }

  if (loading && !customer) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error && !customer) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 py-16 text-center text-destructive">
        {error}
      </div>
    )
  }

  const name = customer ? resolveCustomerName(customer) : "Unknown customer"
  const secondary = customer ? resolveSecondaryHandle(customer, name) : null

  return (
    <div className="space-y-6">
      {/* Identity hero */}
      <Card>
        <CardContent className="flex flex-col gap-5 py-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-balance">{name}</h1>
              {secondary && <p className="text-sm text-muted-foreground">{secondary}</p>}
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="inline-flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                {customer?.email || "No email on file"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                {customer?.mobile ? formatUkMobile(customer.mobile) : "No mobile on file"}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">User ID</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{userId}</code>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={copyUserId}
                aria-label="Copy user ID"
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="shrink-0">
            {restricted ? (
              <div className="flex flex-col items-start gap-1 lg:items-end">
                <Badge variant="destructive" className="gap-1 uppercase tracking-wide">
                  <Ban className="size-3.5" aria-hidden="true" />
                  Self-Excluded
                </Badge>
                <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                  Purchasing disabled
                </span>
              </div>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/30 bg-emerald-500/10 uppercase tracking-wide text-emerald-700 dark:text-emerald-400"
              >
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Active
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Purchase summary — the strongest visual block. */}
      {summaryError ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">{summaryError}</CardContent>
        </Card>
      ) : !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Total Order Value" value={formatPence(summary.total_order_value_pence)} emphasis />
            <SummaryCard label="Cash Paid" value={formatPence(summary.lifetime_external_pence)} />
            <SummaryCard label="Orders" value={String(summary.confirmed_order_count)} />
            <SummaryCard label="Tickets" value={summary.total_tickets_purchased.toLocaleString("en-GB")} />
          </div>
          <p className="text-sm text-muted-foreground">
            Site credit used:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatPence(summary.total_wallet_credit_pence)}
            </span>
            {summary.first_confirmed_at && <> · First purchase {formatDate(summary.first_confirmed_at)}</>}
            {summary.last_confirmed_at && <> · Last purchase {formatDate(summary.last_confirmed_at)}</>}
          </p>
        </div>
      )}

      {/* Purchase history — only loads on this detail view, never on the list. */}
      <CustomerPurchaseHistory userId={userId} />

      {/* Wallet — reuses the existing Add Credit dialog + endpoint. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Wallet</CardTitle>
          {customer && (
            <AddCreditDialog
              userId={customer.user_id}
              customerName={name}
              customerEmail={customer.email ?? ""}
              onCredited={handleCredited}
            />
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Metric label="Available balance" value={formatPence(balances.available_pence)} emphasis />
          <Metric label="Total balance" value={formatPence(balances.balance_pence)} />
          <Metric label="Reserved" value={formatPence(balances.reserved_pence)} />
        </CardContent>
      </Card>

      {/* Account & contact */}
      <Card>
        <CardHeader>
          <CardTitle>Account &amp; Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <Field icon={<Mail className="size-4" />} label="Email" value={customer?.email || "No email on file"} />
            <Field
              icon={<Phone className="size-4" />}
              label="Mobile"
              value={customer?.mobile ? formatUkMobile(customer.mobile) : "No mobile on file"}
            />
            <Field
              icon={<CalendarDays className="size-4" />}
              label="Joined"
              value={formatDate(customer?.joined ?? null)}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Account restrictions — self-exclusion lives here. Action is admin-only. */}
      <Card className={restricted ? "border-destructive/40 bg-destructive/5" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {restricted ? (
              <Ban className="size-5 text-destructive" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            )}
            Account Restrictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {restricted ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge variant="destructive" className="uppercase tracking-wide">
                  Self-Excluded
                </Badge>
                <span className="text-sm font-semibold uppercase tracking-wide text-destructive">
                  Purchasing disabled
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                This customer cannot make new purchases. Existing entries, winnings, purchase history and wallet balance
                are unaffected.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                This customer is active and can make purchases.
              </p>
              {/* Self-exclusion is a Super-Admin-only action. Operations Admins
                  see the status but no actionable control. */}
              {role === "admin" && customer && (
                <SelfExcludeDialog userId={customer.user_id} customerName={name} onExcluded={handleExcluded} />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${emphasis ? "border-primary/30 bg-primary/5" : "bg-card"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  )
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${emphasis ? "text-2xl font-bold" : "text-xl font-semibold"}`}>{value}</dd>
    </div>
  )
}
