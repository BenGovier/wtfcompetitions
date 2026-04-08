import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@supabase/supabase-js"

// Server-side sales stats via DB-aggregated RPCs
// No polling, no client fetch, no subscriptions, no raw row fetching
async function getSalesStats(): Promise<{ today: number | null; week: number | null; month: number | null; allTime: number | null }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Two parallel RPC calls:
  // 1. get_dashboard_sales_stats() returns { today_pence, week_pence, month_pence }
  // 2. get_all_time_sales_pence() returns total pence for all confirmed sales
  const [dashboardResult, allTimeResult] = await Promise.all([
    supabase.rpc('get_dashboard_sales_stats'),
    supabase.rpc('get_all_time_sales_pence'),
  ])

  // Handle dashboard stats RPC
  let todayPence: number | null = null
  let weekPence: number | null = null
  let monthPence: number | null = null

  if (dashboardResult.error) {
    console.error('[Admin Dashboard] Failed to fetch dashboard sales stats:', dashboardResult.error.message)
  } else if (dashboardResult.data) {
    const row = dashboardResult.data as { today_pence: number; week_pence: number; month_pence: number }
    todayPence = Number(row.today_pence ?? 0)
    weekPence = Number(row.week_pence ?? 0)
    monthPence = Number(row.month_pence ?? 0)
  }

  // Handle all-time RPC result
  let allTimePence: number | null = null
  if (allTimeResult.error) {
    console.error('[Admin Dashboard] Failed to fetch all-time sales:', allTimeResult.error.message)
  } else {
    allTimePence = Number(allTimeResult.data ?? 0)
  }

  return {
    today: todayPence !== null ? todayPence / 100 : null,
    week: weekPence !== null ? weekPence / 100 : null,
    month: monthPence !== null ? monthPence / 100 : null,
    allTime: allTimePence !== null ? allTimePence / 100 : null,
  }
}

function formatGBP(amount: number | null): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default async function AdminDashboard() {
  const sales = await getSalesStats()

  const stats = [
    { label: "Sales Today", value: formatGBP(sales.today) },
    { label: "Sales This Week", value: formatGBP(sales.week) },
    { label: "Sales This Month", value: formatGBP(sales.month) },
    { label: "All Time Sales", value: formatGBP(sales.allTime) },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Sales overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
