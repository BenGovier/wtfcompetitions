"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Loader2, ChevronLeft, ChevronRight, Ban } from "lucide-react"
import { formatPence, formatDate } from "./format"

type Customer = {
  user_id: string
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

  // Debounce the search box. Applies only at >= 3 characters; 1–2 characters are
  // treated as "no filter" so we never fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchInput.trim()
      setAppliedSearch(trimmed.length >= MIN_SEARCH_LEN ? trimmed : "")
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // Any change to search / status / page size resets pagination to the first page.
  useEffect(() => {
    setCursor(null)
    setStack([])
  }, [appliedSearch, status, pageSize])

  // Latest-request guard: stale responses are ignored (belt-and-braces with the
  // AbortController, which cancels the previous in-flight request outright).
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

  const pageNumber = stack.length + 1
  const emptyMessage =
    appliedSearch
      ? "No customers match that search."
      : status === "self_excluded"
        ? "No self-excluded customers."
        : status === "active"
          ? "No active customers."
          : "No customers yet."

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="pl-9"
              placeholder="Search name, email or mobile"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search customers by name, email or mobile"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="self_excluded">Self-Excluded</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v) as PageSize)}
              >
                <SelectTrigger className="w-[84px]" aria-label="Results per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="py-12 text-center text-destructive">{error}</CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">{emptyMessage}</CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Cash Paid</TableHead>
                    <TableHead>Last Purchase</TableHead>
                    <TableHead className="text-right">Wallet</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.user_id}>
                      <TableCell>
                        <div className="font-medium">{c.real_name || "Unknown"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{c.user_id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{c.email || "—"}</div>
                        <div className="text-muted-foreground">{c.mobile || "No mobile"}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge selfExcluded={c.is_self_excluded} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.confirmed_order_count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPence(c.lifetime_external_pence)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(c.last_confirmed_at)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPence(c.wallet_available_pence)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(c.account_created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/customers/${c.user_id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile / tablet cards */}
          <div className="space-y-3 md:hidden">
            {customers.map((c) => (
              <Card key={c.user_id}>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{c.real_name || "Unknown"}</div>
                      <div className="text-sm text-muted-foreground">{c.email || "—"}</div>
                      <div className="text-sm text-muted-foreground">{c.mobile || "No mobile"}</div>
                    </div>
                    <StatusBadge selfExcluded={c.is_self_excluded} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Orders</dt>
                      <dd className="tabular-nums">{c.confirmed_order_count}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Cash Paid</dt>
                      <dd className="tabular-nums">{formatPence(c.lifetime_external_pence)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Wallet</dt>
                      <dd className="tabular-nums">{formatPence(c.wallet_available_pence)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Last Purchase</dt>
                      <dd>{formatDate(c.last_confirmed_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Joined</dt>
                      <dd>{formatDate(c.account_created_at)}</dd>
                    </div>
                  </dl>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/admin/customers/${c.user_id}`}>View customer</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
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

function StatusBadge({ selfExcluded }: { selfExcluded: boolean }) {
  if (selfExcluded) {
    return (
      <div className="space-y-1">
        <Badge variant="destructive" className="gap-1 uppercase tracking-wide">
          <Ban className="h-3 w-3" aria-hidden="true" />
          Self-Excluded
        </Badge>
        <p className="text-xs text-muted-foreground">Purchasing disabled</p>
      </div>
    )
  }
  return (
    <Badge variant="secondary" className="uppercase tracking-wide">
      Active
    </Badge>
  )
}
