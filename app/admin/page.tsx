import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@supabase/supabase-js"

async function getSalesStats(): Promise<{ today: number | null; week: number | null; month: number | null; allTime: number | null }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [dashboardResult, allTimeResult] = await Promise.all([
    supabase.rpc("get_dashboard_sales_stats"),
    supabase.rpc("get_all_time_sales_pence"),
  ])

  let today: number | null = null
  let week: number | null = null
  let month: number | null = null
  let allTime: number | null = null

  if (dashboardResult.error) {
    console.error("[Admin Dashboard] Failed to fetch dashboard sales stats:", dashboardResult.error.message)
  } else {
    const row = Array.isArray(dashboardResult.data) ? dashboardResult.data[0] : null
    today = row?.today_pence != null ? Number(row.today_pence) / 100 : 0
    week = row?.week_pence != null ? Number(row.week_pence) / 100 : 0
    month = row?.month_pence != null ? Number(row.month_pence) / 100 : 0
  }

  if (allTimeResult.error) {
    console.error("[Admin Dashboard] Failed to fetch all-time sales:", allTimeResult.error.message)
  } else {
    allTime = allTimeResult.data != null ? Number(allTimeResult.data) / 100 : 0
  }

  return { today, week, month, allTime }
}

function formatGBP(amount: number | null): string {
  if (amount === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
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
        <p className="text-muted-foreground">Sales overview</p>
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
