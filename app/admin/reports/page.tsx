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

async function getReportsData(): Promise<{ data: ReportRow[] | null; error: string | null }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sql = `
    with latest_snapshots as (
      select distinct on (giveaway_id)
        giveaway_id,
        (payload->>'tickets_sold')::int as tickets_sold
      from public.giveaway_snapshots
      where kind = 'list'
      order by giveaway_id, generated_at desc
    )
    select
      c.id,
      c.slug,
      c.title,
      c.status,
      c.max_tickets_total,
      coalesce(s.tickets_sold, 0) as tickets_sold,
      coalesce(sum(ci.total_pence), 0) as revenue_pence,
      round(coalesce(sum(ci.total_pence), 0) / 100.0, 2) as revenue_gbp
    from public.campaigns c
    left join latest_snapshots s
      on s.giveaway_id = c.id
    left join public.checkout_intents ci
      on ci.campaign_id = c.id
     and ci.state = 'confirmed'
    group by c.id, c.slug, c.title, c.status, c.max_tickets_total, s.tickets_sold
    order by c.created_at desc;
  `

  const { data, error } = await supabase.rpc('exec_sql', { query: sql })

  if (error) {
    // Fallback: try direct query approach if RPC doesn't exist
    // This uses separate queries joined in memory as a safe fallback
    console.error('[Admin Reports] RPC failed, trying fallback:', error.message)
    
    try {
      // Get campaigns
      const { data: campaigns, error: campError } = await supabase
        .from('campaigns')
        .select('id, slug, title, status, max_tickets_total, created_at')
        .order('created_at', { ascending: false })

      if (campError || !campaigns) {
        return { data: null, error: campError?.message || 'Failed to fetch campaigns' }
      }

      // Get latest snapshots for all campaigns
      const { data: snapshots } = await supabase
        .from('giveaway_snapshots')
        .select('giveaway_id, payload, generated_at')
        .eq('kind', 'list')
        .order('generated_at', { ascending: false })

      // Get revenue per campaign
      const { data: revenues } = await supabase
        .from('checkout_intents')
        .select('campaign_id, total_pence')
        .eq('state', 'confirmed')

      // Build lookup maps
      const snapshotMap = new Map<string, number>()
      for (const snap of snapshots ?? []) {
        if (!snapshotMap.has(snap.giveaway_id)) {
          const payload = snap.payload as Record<string, unknown>
          snapshotMap.set(snap.giveaway_id, Number(payload?.tickets_sold ?? 0))
        }
      }

      const revenueMap = new Map<string, number>()
      for (const rev of revenues ?? []) {
        const current = revenueMap.get(rev.campaign_id) ?? 0
        revenueMap.set(rev.campaign_id, current + (rev.total_pence ?? 0))
      }

      // Combine
      const rows: ReportRow[] = campaigns.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        status: c.status,
        max_tickets_total: c.max_tickets_total,
        tickets_sold: snapshotMap.get(c.id) ?? 0,
        revenue_pence: revenueMap.get(c.id) ?? 0,
        revenue_gbp: (revenueMap.get(c.id) ?? 0) / 100,
      }))

      return { data: rows, error: null }
    } catch (fallbackError) {
      return { data: null, error: 'Failed to load report data' }
    }
  }

  return { data: data as ReportRow[], error: null }
}

function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
  }).format(amount)
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'live':
      return <Badge className="bg-green-600 hover:bg-green-600">Live</Badge>
    case 'draft':
      return <Badge variant="secondary">Draft</Badge>
    case 'ended':
      return <Badge variant="outline">Ended</Badge>
    case 'scheduled':
      return <Badge className="bg-blue-600 hover:bg-blue-600">Scheduled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default async function AdminReportsPage() {
  const { data: reports, error } = await getReportsData()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        <p className="text-muted-foreground">Campaign performance overview</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              Unable to load report data. Please try again later.
            </div>
          ) : !reports || reports.length === 0 ? (
            <p className="text-muted-foreground text-sm">No campaigns found.</p>
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
                      {row.max_tickets_total?.toLocaleString() ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.tickets_sold.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatGBP(row.revenue_gbp)}
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
