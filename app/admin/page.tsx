import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@supabase/supabase-js"

// Database-level aggregate queries - returns only 3 scalar values, no rows fetched
// Each query uses indexed filters (state, created_at) and SUM computed by Postgres
// No polling, no client fetch, no joins, no in-memory filtering
async function getSalesStats() {
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

  // Three parallel aggregate queries - database computes SUM, returns single value each
  const [todayRes, weekRes, monthRes] = await Promise.all([
    supabase
      .from('checkout_intents')
      .select('total_pence.sum()')
      .eq('state', 'confirmed')
      .gte('created_at', todayStart.toISOString())
      .single(),
    supabase
      .from('checkout_intents')
      .select('total_pence.sum()')
      .eq('state', 'confirmed')
      .gte('created_at', weekStart.toISOString())
      .single(),
    supabase
      .from('checkout_intents')
      .select('total_pence.sum()')
      .eq('state', 'confirmed')
      .gte('created_at', monthStart.toISOString())
      .single(),
  ])

  const todayPence = todayRes.data?.sum ?? 0
  const weekPence = weekRes.data?.sum ?? 0
  const monthPence = monthRes.data?.sum ?? 0

  return {
    today: todayPence / 100,
    week: weekPence / 100,
    month: monthPence / 100,
  }
}

function formatGBP(amount: number): string {
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
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Sales overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
