"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatPence, formatDateTime, formatTicketRange } from "./format"

type Order = {
  checkout_intent_id: string | null
  checkout_ref: string | null
  created_at: string | null
  confirmed_at: string | null
  campaign_id: string | null
  campaign_title: string | null
  qty: number
  total_pence: number
  cash_paid_pence: number
  wallet_credit_pence: number
  currency: string | null
  provider: string | null
  provider_status: string | null
  checkout_state: string | null
  start_ticket: number | null
  end_ticket: number | null
}

const PAGE_SIZE = 25

function statusVariant(state: string | null): "default" | "secondary" | "outline" {
  if (state === "confirmed" || state === "completed") return "default"
  return "secondary"
}

/** Human label for the checkout state, e.g. "confirmed" -> "Confirmed". */
function formatState(state: string | null): string {
  if (!state) return "—"
  return state.charAt(0).toUpperCase() + state.slice(1).replace(/_/g, " ")
}

/**
 * Provider column for support diagnostics: the funding provider plus its raw
 * provider_status when present (e.g. "acquired · settled"). A fully wallet-paid
 * order has no external provider, so we show "Site credit" instead of a dash.
 */
function formatProvider(provider: string | null, providerStatus: string | null, cashPaidPence: number): string {
  if (!provider) return cashPaidPence <= 0 ? "Site credit" : "—"
  const label = provider.charAt(0).toUpperCase() + provider.slice(1)
  return providerStatus ? `${label} · ${providerStatus}` : label
}

export function CustomerPurchaseHistory({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [offset, setOffset] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/customers/${userId}/orders?limit=${PAGE_SIZE}&offset=${offset}`,
          { signal: controller.signal },
        )
        const json = await res.json()
        if (requestId !== requestIdRef.current) return
        if (!res.ok || !json.ok) {
          setError("Purchase history is temporarily unavailable.")
          setOrders([])
          setHasNext(false)
          return
        }
        setOrders(json.orders ?? [])
        setHasNext(json.hasNext === true)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        if (requestId !== requestIdRef.current) return
        setError("Purchase history is temporarily unavailable.")
        setOrders([])
        setHasNext(false)
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [userId, offset])

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase history</CardTitle>
        <p className="text-sm text-muted-foreground">Confirmed purchases only.</p>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <p className="py-12 text-center text-destructive">{error}</p>
        ) : loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.length === 0 && offset === 0 ? (
          <p className="py-12 text-center text-muted-foreground">This customer has not made any purchases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Competition</TableHead>
                  <TableHead>Order Ref</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Cash Paid</TableHead>
                  <TableHead className="text-right">Site Credit</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="whitespace-nowrap">Ticket Numbers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.checkout_intent_id ?? `${o.checkout_ref}-${o.created_at}`}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(o.confirmed_at ?? o.created_at)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-medium" title={o.campaign_title ?? undefined}>
                      {o.campaign_title ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {o.checkout_ref ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPence(o.total_pence)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPence(o.cash_paid_pence)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPence(o.wallet_credit_pence)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatProvider(o.provider, o.provider_status, o.cash_paid_pence)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(o.checkout_state)}>
                        {formatState(o.checkout_state)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatTicketRange(o.start_ticket, o.end_ticket)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {!error && (orders.length > 0 || offset > 0) && (
        <div className="flex items-center justify-between border-t px-6 py-3">
          <p className="text-sm text-muted-foreground">Page {pageNumber}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              disabled={offset === 0 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              disabled={!hasNext || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
