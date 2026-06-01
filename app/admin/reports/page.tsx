import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

// ============ TYPES ============

type ReportRow = {
  id: string
  slug: string
  title: string
  status: string
  max_tickets_total: number | null
  tickets_sold: number
  revenue_pence: number
  revenue_gbp: number
}

type RevenueDashboard = {
  today_pence: number
  today_orders: number
  yesterday_pence: number
  yesterday_orders: number
  this_week_pence: number
  this_week_orders: number
  this_month_pence: number
  this_month_orders: number
  last_30_days_pence: number
  last_30_days_orders: number
  all_time_pence: number
  all_time_orders: number
}

// ============ DATA FETCHING ============

async function getRevenueDashboard(): Promise<RevenueDashboard> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const defaultDashboard: RevenueDashboard = {
    today_pence: 0,
    today_orders: 0,
    yesterday_pence: 0,
    yesterday_orders: 0,
    this_week_pence: 0,
    this_week_orders: 0,
    this_month_pence: 0,
    this_month_orders: 0,
    last_30_days_pence: 0,
    last_30_days_orders: 0,
    all_time_pence: 0,
    all_time_orders: 0,
  }

  try {
    const { data, error } = await supabase.rpc("get_revenue_dashboard")

    if (error) {
      console.error("[Admin Reports] get_revenue_dashboard RPC failed:", error.message)
      return defaultDashboard
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return defaultDashboard
    }

    // RPC returns a single row (or array with one element)
    const row = Array.isArray(data) ? data[0] : data

    return {
      today_pence: Number(row.today_pence ?? 0),
      today_orders: Number(row.today_orders ?? 0),
      yesterday_pence: Number(row.yesterday_pence ?? 0),
      yesterday_orders: Number(row.yesterday_orders ?? 0),
      this_week_pence: Number(row.this_week_pence ?? 0),
      this_week_orders: Number(row.this_week_orders ?? 0),
      this_month_pence: Number(row.this_month_pence ?? 0),
      this_month_orders: Number(row.this_month_orders ?? 0),
      last_30_days_pence: Number(row.last_30_days_pence ?? 0),
      last_30_days_orders: Number(row.last_30_days_orders ?? 0),
      all_time_pence: Number(row.all_time_pence ?? 0),
      all_time_orders: Number(row.all_time_orders ?? 0),
    }
  } catch (err) {
    console.error("[Admin Reports] Unexpected error in get_revenue_dashboard:", err)
    return defaultDashboard
  }
}

async function getCampaignReports(): Promise<{ data: ReportRow[] | null; error: string | null }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Three parallel queries:
    // 1. Campaigns metadata
    // 2. Snapshots for tickets_sold
    // 3. RPC for DB-aggregated revenue by campaign (returns ~N rows, not thousands)
    const [campaignsRes, snapshotsRes, revenuesRes] = await Promise.all([
      supabase
        .from("campaigns")
        .select("id, slug, title, status, max_tickets_total, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("giveaway_snapshots")
        .select("giveaway_id, payload, generated_at")
        .eq("kind", "list")
        .order("generated_at", { ascending: false }),
      supabase.rpc("get_revenue_by_campaign"),
    ])

    if (campaignsRes.error || !campaignsRes.data) {
      console.error("[Admin Reports] Failed to fetch campaigns:", campaignsRes.error?.message)
      return { data: null, error: campaignsRes.error?.message || "Failed to fetch campaigns" }
    }

    // Build snapshot lookup (latest per campaign)
    const snapshotMap = new Map<string, number>()
    for (const snap of snapshotsRes.data ?? []) {
      if (!snapshotMap.has(snap.giveaway_id)) {
        const payload = snap.payload as Record<string, unknown>
        snapshotMap.set(snap.giveaway_id, Number(payload?.tickets_sold ?? 0))
      }
    }

    // Build revenue lookup from RPC result (already aggregated by campaign_id)
    const revenueMap = new Map<string, number>()
    if (!revenuesRes.error && revenuesRes.data) {
      for (const row of revenuesRes.data as { campaign_id: string; total_pence: number }[]) {
        revenueMap.set(row.campaign_id, Number(row.total_pence ?? 0))
      }
    } else if (revenuesRes.error) {
      console.error("[Admin Reports] Revenue RPC failed:", revenuesRes.error.message)
    }

    // Combine into report rows
    const rows: ReportRow[] = campaignsRes.data.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      status: c.status,
      max_tickets_total: c.max_tickets_total,
      tickets_sold: snapshotMap.get(c.id) ?? 0,
      revenue_pence: revenueMap.get(c.id) ?? 0,
      revenue_gbp: (revenueMap.get(c.id) ?? 0) / 100,
    }))

    // Filter: only show campaigns with revenue > 0 (hides old test campaigns)
    // Sort: live first, then by revenue descending
    const filtered = rows
      .filter((r) => r.revenue_pence > 0)
      .sort((a, b) => {
        if (a.status === "live" && b.status !== "live") return -1
        if (b.status === "live" && a.status !== "live") return 1
        return b.revenue_pence - a.revenue_pence
      })

    return { data: filtered, error: null }
  } catch (err) {
    console.error("[Admin Reports] Unexpected error:", err)
    return { data: null, error: "Failed to load report data" }
  }
}

// ============ HELPERS ============

function formatGBP(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(pence / 100)
}

function formatGBPFromPounds(pounds: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(pounds)
}

function getStatusBadge(status: string) {
  switch (status) {
    case "live":
      return <Badge className="bg-green-600 hover:bg-green-600">Live</Badge>
    case "draft":
      return <Badge variant="secondary">Draft</Badge>
    case "ended":
      return <Badge variant="outline">Ended</Badge>
    case "scheduled":
      return <Badge className="bg-blue-600 hover:bg-blue-600">Scheduled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ============ COMPONENTS ============

function RevenueCard({
  title,
  pence,
  orders,
}: {
  title: string
  pence: number
  orders: number
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatGBP(pence)}</div>
        <p className="text-xs text-muted-foreground">
          {orders.toLocaleString()} {orders === 1 ? "order" : "orders"}
        </p>
      </CardContent>
    </Card>
  )
}

function AverageOrderCard({ totalPence, totalOrders }: { totalPence: number; totalOrders: number }) {
  const averagePence = totalOrders > 0 ? Math.round(totalPence / totalOrders) : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatGBP(averagePence)}</div>
        <p className="text-xs text-muted-foreground">per order</p>
      </CardContent>
    </Card>
  )
}

// ============ PAGE ============

export default async function AdminReportsPage() {
  // Fetch dashboard metrics and campaign reports in parallel
  const [dashboard, { data: reports, error: reportsError }] = await Promise.all([
    getRevenueDashboard(),
    getCampaignReports(),
  ])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">Revenue and campaign performance</p>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RevenueCard title="Today" pence={dashboard.today_pence} orders={dashboard.today_orders} />
        <RevenueCard
          title="Yesterday"
          pence={dashboard.yesterday_pence}
          orders={dashboard.yesterday_orders}
        />
        <RevenueCard
          title="This Week"
          pence={dashboard.this_week_pence}
          orders={dashboard.this_week_orders}
        />
        <RevenueCard
          title="This Month"
          pence={dashboard.this_month_pence}
          orders={dashboard.this_month_orders}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RevenueCard
          title="Last 30 Days"
          pence={dashboard.last_30_days_pence}
          orders={dashboard.last_30_days_orders}
        />
        <RevenueCard
          title="All Time"
          pence={dashboard.all_time_pence}
          orders={dashboard.all_time_orders}
        />
        <AverageOrderCard
          totalPence={dashboard.all_time_pence}
          totalOrders={dashboard.all_time_orders}
        />
      </div>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {reportsError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Unable to load campaign data. Please try again later.
            </div>
          ) : !reports || reports.length === 0 ? (
            <p className="text-muted-foreground text-sm">No campaigns with revenue found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raffle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Tickets</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{getStatusBadge(row.status)}</TableCell>
                    <TableCell className="text-right">
                      {row.max_tickets_total?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{row.tickets_sold.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatGBPFromPounds(row.revenue_gbp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
