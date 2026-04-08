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

  // Get current date/time in UK timezone (handles GMT/BST automatically)
  const ukDateStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' })
  const [dayStr, monthStr, yearStr] = ukDateStr.split('/')
  const ukYear = parseInt(yearStr, 10)
  const ukMonth = parseInt(monthStr, 10) - 1 // JS months are 0-indexed
  const ukDay = parseInt(dayStr, 10)
  
  // Get UK day of week (0=Sunday)
  const ukDayOfWeek = new Date(
    new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })
  ).getDay()
  
  // Helper: create a Date representing UK midnight for a given UK date
  // We create the date in UK timezone then convert to UTC for comparison
  function ukMidnight(year: number, month: number, day: number): Date {
    // Create ISO string for the UK date at midnight, then parse with UK offset
    // UK is GMT (UTC+0) in winter, BST (UTC+1) in summer
    // Using toLocaleString trick to get the correct UTC equivalent
    const tempDate = new Date(Date.UTC(year, month, day, 12, 0, 0)) // noon UTC as safe starting point
    const ukStr = tempDate.toLocaleString('en-GB', { timeZone: 'Europe/London' })
    // Parse to get offset, but simpler: just create date and adjust
    // Actually, cleanest approach: use Intl.DateTimeFormat to get timezone offset
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    })
    // For UK midnight, we need to find what UTC time equals midnight UK
    // BST (Mar-Oct): UK midnight = 23:00 UTC previous day
    // GMT (Nov-Feb): UK midnight = 00:00 UTC same day
    // Create a date at midnight UK and check its UTC representation
    const testDate = new Date(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`)
    const parts = formatter.formatToParts(testDate)
    const ukHour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
    // If UK shows hour > 0 when we set 00:00 local, we need to adjust
    // Actually let's use a simpler reliable method:
    // Set time to noon UK, then subtract hours to get to midnight UK
    const noonUK = new Date(Date.UTC(year, month, day, 12, 0, 0))
    // Check what hour this is in UK
    const ukNoonHour = parseInt(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false })
        .format(noonUK), 10
    )
    // Offset from UTC: if UK shows 13 when UTC is 12, offset is +1 (BST)
    const ukOffset = ukNoonHour - 12 // hours ahead of UTC
    // UK midnight in UTC = 00:00 UK = 00:00 - offset in UTC terms
    // e.g., BST: 00:00 UK = 23:00 UTC previous day (offset +1, so subtract 1 hour from midnight)
    return new Date(Date.UTC(year, month, day, 0 - ukOffset, 0, 0))
  }

  // Today: start of current UK day
  const todayStart = ukMidnight(ukYear, ukMonth, ukDay)
  
  // This week: Monday of current UK week
  const mondayOffset = ukDayOfWeek === 0 ? 6 : ukDayOfWeek - 1
  const mondayDate = ukDay - mondayOffset
  const weekStart = ukMidnight(ukYear, ukMonth, mondayDate)
  
  // This month: 1st of current UK month
  const monthStart = ukMidnight(ukYear, ukMonth, 1)

  // Two parallel queries:
  // 1. Month-bounded for today/week/month (needs confirmed_at for date filtering)
  // 2. All-time total via RPC (single scalar, no row fetching)
  const [monthResult, allTimeResult] = await Promise.all([
    supabase
      .from('checkout_intents')
      .select('total_pence, confirmed_at')
      .eq('state', 'confirmed')
      .gte('confirmed_at', monthStart.toISOString()),
    supabase.rpc('get_all_time_sales_pence'),
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

  // Handle all-time RPC result (returns bigint as number)
  let allTimePence: number | null = null
  if (allTimeResult.error) {
    console.error('[Admin Dashboard] Failed to fetch all-time sales:', allTimeResult.error.message)
  } else {
    allTimePence = allTimeResult.data ?? 0
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
