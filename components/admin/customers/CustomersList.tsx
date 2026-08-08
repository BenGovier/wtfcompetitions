"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Search, Loader2, ChevronLeft, ChevronRight, ChevronRight as RowChevron, Ban, Copy } from "lucide-react"
import {
  formatPence,
  formatDate,
  formatUkMobile,
  resolveCustomerName,
  resolveSecondaryHandle,
} from "./format"

type Customer = {
  user_id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  real_name: string | null
  email: string | null
  mobile: string | null
  account_active: boolean
  is_self_excluded: boolean
  self_excluded_at: string | null
  account_created_at: string | null
  confirmed_order_count: number
  lifetime_external_pence: number
  last_confirmed_at: string | null
  wallet_available_pence: number
}

type Cursor = { createdAt: string; userId: string }
type StatusFilter = "all" | "active" | "self_excluded"
type PageSize = 25 | 50 | 100

const MIN_SEARCH_LEN = 3
const DEBOUNCE_MS = 300

function mapError(code: unknown): string {
  switch (code) {
    case "invalid_search":
      return "That search contains invalid characters. Please try again."
    case "invalid_status":
    case "invalid_limit":
    case "invalid_cursor":
      return "Something went wrong loading customers. Please refresh and try again."
    case "Not authenticated":
      return "Your session has expired. Please sign in again."
    default:
      return "Customers are temporarily unavailable. Please try again."
  }
}

export function CustomersList() {
  const router = useRouter()
  const { toast } = useToast()

  const [searchInput, setSearchInput] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [pageSize, setPageSize] = useState<PageSize>(50)

  // Forward-keyset pagination with a client-side cursor stack for "Previous".
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const [stack, setStack] = useState<(Cursor | null)[]>([])

  const [customers, setCustomers] = useState<Customer[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce the search box. Applies only at >= 3 characters; 1–2 characters
  // are held (NOT sent as an empty/unfiltered request) so the full directory
  // never flashes back mid-type.
  const trimmedInput = searchInput.trim()
  const pendingShortSearch = trimmedInput.length > 0 && trimmedInput.length < MIN_SEARCH_LEN

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchInput.trim()
      // Only two states ever reach the server: a >=3 char term, or "cleared".
      if (trimmed.length >= MIN_SEARCH_LEN) {
        setAppliedSearch(trimmed)
      } else if (trimmed.length === 0) {
        setAppliedSearch("")
      }
      // 1–2 chars: leave appliedSearch untouched (no new request).
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // Any change to search / status / page size resets pagination to page one.
  useEffect(() => {
    setCursor(null)
    setStack([])
  }, [appliedSearch, status, pageSize])

  // Latest-request guard, paired with an AbortController that cancels the
  // previous in-flight request outright.
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (appliedSearch) params.set("search", appliedSearch)
    params.set("status", status)
    params.set("limit", String(pageSize))
    if (cursor) {
      params.set("afterCreatedAt", cursor.createdAt)
      params.set("afterUserId", cursor.userId)
    }

    ;(async () => {
      try {
        const res = await fetch(`/api/admin/customers?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = await res.json()
        if (requestId !== requestIdRef.current) return

        if (!res.ok || !json.ok) {
          setError(mapError(json?.error))
          setCustomers([])
          setHasNext(false)
          setNextCursor(null)
          return
        }
        setCustomers(json.customers ?? [])
        setHasNext(json.hasNext === true)
        setNextCursor(json.nextCursor ?? null)
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        if (requestId !== requestIdRef.current) return
        setError("Customers are temporarily unavailable. Please try again.")
        setCustomers([])
        setHasNext(false)
        setNextCursor(null)
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [appliedSearch, status, pageSize, cursor])

  const goNext = () => {
    if (!hasNext || !nextCursor) return
    setStack((s) => [...s, cursor])
    setCursor(nextCursor)
  }

  const goPrev = () => {
    if (stack.length === 0) return
    const prev = stack[stack.length - 1]
    setStack((s) => s.slice(0, -1))
    setCursor(prev)
  }

  const openCustomer = (userId: string) => router.push(`/admin/customers/${userId}`)

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
      toast({ title: "Email copied", description: email })
    } catch {
      toast({ title: "Couldn't copy", description: "Copy is unavailable in this browser.", variant: "destructive" })
    }
  }

  const pageNumber = stack.length + 1
  const emptyMessage = appliedSearch
    ? "No customers match that search."
    : status === "self_excluded"
      ? "No self-excluded customers."
      : status === "active"
        ? "No active customers."
        : "No customers yet."

  return (
    <div className="space-y-4">
      {/* Compact toolbar — search dominates, segmented status, page size. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            className="h-11 pl-9 text-base"
            placeholder="Search name, email or mobile"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search customers by name, email or mobile"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <TabsList className="h-11">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger
                value="self_excluded"
                className="gap-1 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
              >
                <Ban className="size-3.5" aria-hidden="true" />
                Self-Excluded
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v) as PageSize)}>
            <SelectTrigger className="h-11 w-[130px]" aria-label="Results per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {pendingShortSearch && (
        <p className="text-sm text-muted-foreground" role="status">
          Type at least {MIN_SEARCH_LEN} characters to search.
        </p>
      )}

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 py-12 text-center text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-2 rounded-lg border p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border py-16 text-center text-muted-foreground">{emptyMessage}</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Contact</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Cash Paid</th>
                  <th className="px-4 py-3 text-left font-medium">Last Purchase</th>
                  <th className="px-4 py-3 text-right font-medium">Wallet</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="w-10 px-2 py-3" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const name = resolveCustomerName(c)
                  const secondary = resolveSecondaryHandle(c, name)
                  return (
                    <tr
                      key={c.user_id}
                      onClick={() => openCustomer(c.user_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          openCustomer(c.user_id)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open ${name}`}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-foreground">{name}</div>
                        {secondary && <div className="text-xs text-muted-foreground">{secondary}</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.email ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyEmail(c.email as string)
                            }}
                            className="group inline-flex max-w-[220px] items-center gap-1.5 truncate text-left text-foreground hover:text-primary"
                            title={`Copy ${c.email}`}
                          >
                            <span className="truncate">{c.email}</span>
                            <Copy className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground">No email</span>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {c.mobile ? formatUkMobile(c.mobile) : "No mobile"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge selfExcluded={c.is_self_excluded} />
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{c.confirmed_order_count}</td>
                      <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                        {formatPence(c.lifetime_external_pence)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">
                        {formatDate(c.last_confirmed_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatPence(c.wallet_available_pence)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">
                        {formatDate(c.account_created_at)}
                      </td>
                      <td className="px-2 py-3.5 text-right">
                        <RowChevron className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards */}
          <div className="space-y-3 md:hidden">
            {customers.map((c) => {
              const name = resolveCustomerName(c)
              return (
                <div
                  key={c.user_id}
                  onClick={() => openCustomer(c.user_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openCustomer(c.user_id)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${name}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{name}</div>
                      <StatusBadge selfExcluded={c.is_self_excluded} compact />
                    </div>
                    <div className="space-y-0.5 text-sm text-muted-foreground">
                      <div className="truncate">{c.email || "No email"}</div>
                      <div>{c.mobile ? formatUkMobile(c.mobile) : "No mobile"}</div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="tabular-nums">
                        {c.confirmed_order_count} {c.confirmed_order_count === 1 ? "order" : "orders"}
                      </span>
                      <span className="font-medium tabular-nums">{formatPence(c.lifetime_external_pence)} cash paid</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last purchase {formatDate(c.last_confirmed_at)} · Wallet {formatPence(c.wallet_available_pence)}
                    </div>
                  </div>
                  <RowChevron className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </span>
          ) : (
            <>Page {pageNumber}</>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={stack.length === 0 || loading}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={goNext} disabled={!hasNext || loading}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ selfExcluded, compact = false }: { selfExcluded: boolean; compact?: boolean }) {
  if (selfExcluded) {
    return (
      <div className={compact ? "" : "space-y-1"}>
        <Badge variant="destructive" className="gap-1 uppercase tracking-wide">
          <Ban className="h-3 w-3" aria-hidden="true" />
          Self-Excluded
        </Badge>
        {!compact && <p className="text-xs text-muted-foreground">Purchasing disabled</p>}
      </div>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/30 bg-emerald-500/10 uppercase tracking-wide text-emerald-700 dark:text-emerald-400"
    >
      Active
    </Badge>
  )
}
