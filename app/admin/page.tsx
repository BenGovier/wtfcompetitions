import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@supabase/supabase-js"

// Server-side sales stats query using confirmed_at as reporting date
// Fetches confirmed intents for current month, sums in JS for today/week/month
// Separate lightweight query for all-time total (only total_pence, no date filter)
// No polling, no client fetch, no subscriptions
async function getSalesStats(): Promise<{ today: number | null; week: number | null; month: number | null; allTime: number | null }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  
  // Today: start of current day (UTC)
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  
  // This week: Monday of current week (UTC)
  const dayOfWeek = now.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset))
  
  // This month: 1st of current month (UTC)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  // Two parallel queries:
  // 1. Month-bounded for today/week/month (needs confirmed_at for date filtering)
  // 2. All-time total (only total_pence, no date filter - minimal data)
  const [monthResult, allTimeResult] = await Promise.all([
    supabase
      .from('checkout_intents')
      .select('total_pence, confirmed_at')
      .eq('state', 'confirmed')
      .gte('confirmed_at', monthStart.toISOString()),
    supabase
      .from('checkout_intents')
      .select('total_pence')
      .eq('state', 'confirmed'),
  ])

  // Handle month query
  let todayPence = 0
  let weekPence = 0
  let monthPence = 0

  if (monthResult.error) {
    console.error('[Admin Dashboard] Failed to fetch month sales stats:', monthResult.error.message)
  } else {
    for (const intent of monthResult.data ?? []) {
      const pence = intent.total_pence ?? 0
      const confirmedAt = intent.confirmed_at ? new Date(intent.confirmed_at) : null
      if (!confirmedAt) continue
      
      monthPence += pence
      if (confirmedAt >= weekStart) weekPence += pence
      if (confirmedAt >= todayStart) todayPence += pence
    }
  }

  // Handle all-time query
  let allTimePence: number | null = null
  if (allTimeResult.error) {
    console.error('[Admin Dashboard] Failed to fetch all-time sales:', allTimeResult.error.message)
  } else {
    allTimePence = 0
    for (const intent of allTimeResult.data ?? []) {
      allTimePence += intent.total_pence ?? 0
    }
  }

  return {
    today: monthResult.error ? null : todayPence / 100,
    week: monthResult.error ? null : weekPence / 100,
    month: monthResult.error ? null : monthPence / 100,
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
