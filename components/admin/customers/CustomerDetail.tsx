"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Ban, ShieldCheck } from "lucide-react"
import type { AdminRole } from "@/lib/admin/permissions"
import { AddCreditDialog, type CreditSuccess } from "@/components/admin/wallets/AddCreditDialog"
import { SelfExcludeDialog } from "@/components/admin/wallets/SelfExcludeDialog"
import { CustomerPurchaseHistory } from "./CustomerPurchaseHistory"
import { formatPence, formatDate } from "./format"

type Customer = {
  user_id: string
  name: string
  email: string
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

  if (loading && !customer) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error && !customer) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-destructive">{error}</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <Field label="Name" value={customer?.name || "Unknown"} />
            <Field label="Email" value={customer?.email || "—"} />
            <Field label="Mobile" value={customer?.mobile || "No mobile on file"} />
            <Field label="Joined" value={formatDate(customer?.joined ?? null)} />
            <div className="sm:col-span-2 flex gap-2">
              <dt className="text-muted-foreground">User ID:</dt>
              <dd className="font-mono text-xs">{customer?.user_id}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Account status — self-exclusion. Action is admin-only. */}
      {restricted ? (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" aria-hidden="true" />
              Account status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Badge variant="destructive" className="uppercase tracking-wide">
              Self-excluded
            </Badge>
            <span className="text-sm font-semibold uppercase tracking-wide text-destructive">
              Purchasing disabled
            </span>
            <p className="w-full text-sm text-muted-foreground">
              This customer cannot make new purchases. Existing entries, winnings, purchase history and wallet balance
              are unaffected.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Account status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="uppercase tracking-wide">
                Active
              </Badge>
              <span className="text-sm text-muted-foreground">This customer can make purchases.</span>
            </div>
            {/* Self-exclusion is a Super-Admin-only action. Operations Admins see
                status but no actionable control. */}
            {role === "admin" && customer && (
              <SelfExcludeDialog userId={customer.user_id} customerName={customer.name} onExcluded={handleExcluded} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase summary */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryError ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{summaryError}</p>
          ) : !summary ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-3">
              <Metric label="Confirmed Orders" value={String(summary.confirmed_order_count)} />
              <Metric label="Total Order Value" value={formatPence(summary.total_order_value_pence)} />
              <Metric label="Cash Paid" value={formatPence(summary.lifetime_external_pence)} />
              <Metric label="Site Credit Used" value={formatPence(summary.total_wallet_credit_pence)} />
              <Metric label="Tickets Purchased" value={summary.total_tickets_purchased.toLocaleString("en-GB")} />
              <Metric label="First Purchase" value={formatDate(summary.first_confirmed_at)} />
              <Metric label="Last Purchase" value={formatDate(summary.last_confirmed_at)} />
            </dl>
          )}
        </CardContent>
      </Card>

      {/* WTF Credit (wallet) — reuses the existing Add Credit dialog + endpoint. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>WTF Credit</CardTitle>
          {customer && (
            <AddCreditDialog
              userId={customer.user_id}
              customerName={customer.name}
              customerEmail={customer.email}
              onCredited={handleCredited}
            />
          )}
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Metric label="Total balance" value={formatPence(balances.balance_pence)} />
          <Metric label="Reserved" value={formatPence(balances.reserved_pence)} />
          <Metric label="Available" value={formatPence(balances.available_pence)} />
        </CardContent>
      </Card>

      {/* Purchase history — only loads on this detail view, never on the list. */}
      <CustomerPurchaseHistory userId={userId} />
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
