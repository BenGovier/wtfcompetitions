import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@supabase/supabase-js"

// Server-side sales stats query using confirmed_at as reporting date
// Fetches confirmed intents for current month, sums in JS for today/week/month
// No polling, no client fetch, no subscriptions
async function getSalesStats(): Promise<{ today: number | null; week: number | null; month: number | null }> {
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

  // Single query fetching confirmed intents for this month (superset of week/today)
  // Uses confirmed_at for reporting dates, not created_at
  const { data: intents, error } = await supabase
    .from('checkout_intents')
    .select('total_pence, confirmed_at')
    .eq('state', 'confirmed')
    .gte('confirmed_at', monthStart.toISOString())

  if (error) {
    console.error('[Admin Dashboard] Failed to fetch sales stats:', error.message)
    return { today: null, week: null, month: null }
  }

  let todayPence = 0
  let weekPence = 0
  let monthPence = 0

  for (const intent of intents ?? []) {
    const pence = intent.total_pence ?? 0
    const confirmedAt = intent.confirmed_at ? new Date(intent.confirmed_at) : null
    if (!confirmedAt) continue
    
    monthPence += pence
    if (confirmedAt >= weekStart) weekPence += pence
    if (confirmedAt >= todayStart) todayPence += pence
  }

  return {
    today: todayPence / 100,
    week: weekPence / 100,
    month: monthPence / 100,
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
