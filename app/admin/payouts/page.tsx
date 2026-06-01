import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { PayoutActionButtons } from "./PayoutActionButtons"

const ITEMS_PER_PAGE = 100

type StatusFilter = "unpaid" | "new" | "problem" | "paid" | "all"
type SortOrder = "newest" | "oldest"

interface PageProps {
  searchParams: Promise<{ status?: string; sort?: string; page?: string }>
}

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const statusFilter = (params.status as StatusFilter) || "unpaid"
  const sortOrder = (params.sort as SortOrder) || "newest"
  const currentPage = Math.max(1, parseInt(params.page || "1", 10))
  const offset = (currentPage - 1) * ITEMS_PER_PAGE

  // Use service role client to bypass RLS - server-side only
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ========== UNPAID TOTALS QUERY (separate, efficient) ==========
  // Query only unpaid records for the summary
  const { data: unpaidSummary } = await supabase
    .from("contact_enquiries")
    .select("amount_claimed_pence")
    .eq("enquiry_type", "winner_payout")
    .or("status.is.null,status.eq.new")

  let unpaidTotalPence = 0
  let unpaidCount = 0
  if (unpaidSummary) {
    unpaidCount = unpaidSummary.length
    unpaidTotalPence = unpaidSummary.reduce((sum, row) => sum + (row.amount_claimed_pence || 0), 0)
  }

  // ========== MAIN TABLE QUERY ==========
  let query = supabase
    .from("contact_enquiries")
    .select(`
      id,
      created_at,
      first_name,
      last_name,
      full_name,
      tiktok_username,
      order_reference,
      phone,
      email,
      amount_claimed_pence,
      payout_account_holder_name,
      payout_sort_code,
      payout_account_number,
      status,
      message
    `, { count: "exact" })
    .eq("enquiry_type", "winner_payout")
    .order("created_at", { ascending: sortOrder === "oldest" })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  // Apply status filter
  switch (statusFilter) {
    case "unpaid":
    case "new":
      query = query.or("status.is.null,status.eq.new")
      break
    case "problem":
      query = query.eq("status", "problem")
      break
    case "paid":
      query = query.eq("status", "paid")
      break
    // "all" - no additional filter
  }

  const { data: payouts, error, count } = await query

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  function formatPence(pence: number | null): string {
    if (pence == null) return "—"
    return `£${(pence / 100).toFixed(2)}`
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function getDisplayName(row: {
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
  }): string {
    if (row.first_name && row.last_name) {
      return `${row.first_name} ${row.last_name}`
    }
    return row.full_name || "—"
  }

  function getTikTokUsername(row: {
    tiktok_username?: string | null
    order_reference?: string | null
  }): string {
    return row.tiktok_username || row.order_reference || "—"
  }

  function getStatusBadgeClass(status: string | null): string {
    switch (status) {
      case "new":
        return "bg-yellow-100 text-yellow-800"
      case "paid":
        return "bg-green-100 text-green-800"
      case "problem":
        return "bg-red-100 text-red-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  function getStatusLabel(status: string | null): string {
    switch (status) {
      case "new":
        return "New"
      case "paid":
        return "Paid"
      case "problem":
        return "Problem"
      default:
        return "New"
    }
  }

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "unpaid", label: "Unpaid" },
    { key: "new", label: "New" },
    { key: "problem", label: "Problem" },
    { key: "paid", label: "Paid" },
    { key: "all", label: "All" },
  ]

  function buildUrl(filter: StatusFilter, sort: SortOrder, page: number = 1): string {
    const params = new URLSearchParams()
    params.set("status", filter)
    params.set("sort", sort)
    if (page > 1) params.set("page", String(page))
    return `/admin/payouts?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Winner Payouts</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()} record{totalCount !== 1 ? "s" : ""} in current view
          </p>
        </div>

        {/* Unpaid Summary Card */}
        <div className="flex gap-4 rounded-lg border bg-amber-50 px-4 py-2">
          <div className="text-center">
            <div className="text-xs font-medium uppercase text-amber-600">Unpaid Total</div>
            <div className="text-lg font-bold text-amber-700">{formatPence(unpaidTotalPence)}</div>
          </div>
          <div className="border-l border-amber-200" />
          <div className="text-center">
            <div className="text-xs font-medium uppercase text-amber-600">Unpaid Records</div>
            <div className="text-lg font-bold text-amber-700">{unpaidCount.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Filter tabs and sort */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <Link
              key={tab.key}
              href={buildUrl(tab.key, sortOrder)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <Link
            href={buildUrl(statusFilter, "newest")}
            className={`rounded-md px-2 py-1 text-sm font-medium transition-colors ${
              sortOrder === "newest"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Newest
          </Link>
          <Link
            href={buildUrl(statusFilter, "oldest")}
            className={`rounded-md px-2 py-1 text-sm font-medium transition-colors ${
              sortOrder === "oldest"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Oldest
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-600">
          Failed to load payouts. Please refresh the page.
        </div>
      )}

      {!error && (!payouts || payouts.length === 0) && (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No payouts found for this filter.
        </div>
      )}

      {payouts && payouts.length > 0 && (
        <div className="w-full overflow-hidden rounded-lg border bg-white">
          <div className="overflow-x-auto" style={{ maxWidth: 'calc(100vw - 18rem)' }}>
            <table className="min-w-[1600px] w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="whitespace-nowrap px-3 py-2">Date</th>
                  <th className="whitespace-nowrap px-3 py-2">Status</th>
                  <th className="whitespace-nowrap px-3 py-2">Name</th>
                  <th className="whitespace-nowrap px-3 py-2">TikTok</th>
                  <th className="whitespace-nowrap px-3 py-2">Claimed</th>
                  <th className="whitespace-nowrap px-3 py-2">Mobile</th>
                  <th className="whitespace-nowrap px-3 py-2">Email</th>
                  <th className="whitespace-nowrap px-3 py-2">Acc Holder</th>
                  <th className="whitespace-nowrap px-3 py-2">Sort Code</th>
                  <th className="whitespace-nowrap px-3 py-2">Acc No</th>
                  <th className="whitespace-nowrap px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payouts.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(row.status)}`}
                      >
                        {getStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                      {getDisplayName(row)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {getTikTokUsername(row)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-amber-600">
                      {formatPence(row.amount_claimed_pence)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {row.phone || "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-gray-600" title={row.email || ""}>
                      {row.email || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {row.payout_account_holder_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">
                      {row.payout_sort_code || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">
                      {row.payout_account_number || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <PayoutActionButtons id={row.id} currentStatus={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            {hasPrevPage ? (
              <Link
                href={buildUrl(statusFilter, sortOrder, currentPage - 1)}
                className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium hover:bg-muted/80"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                Previous
              </span>
            )}
            {hasNextPage ? (
              <Link
                href={buildUrl(statusFilter, sortOrder, currentPage + 1)}
                className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium hover:bg-muted/80"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
