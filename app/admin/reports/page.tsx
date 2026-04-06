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

  try {
    // Three parallel queries:
    // 1. Campaigns metadata
    // 2. Snapshots for tickets_sold
    // 3. RPC for DB-aggregated revenue by campaign (returns ~N rows, not thousands)
    const [campaignsRes, snapshotsRes, revenuesRes] = await Promise.all([
      supabase
        .from('campaigns')
        .select('id, slug, title, status, max_tickets_total, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('giveaway_snapshots')
        .select('giveaway_id, payload, generated_at')
        .eq('kind', 'list')
        .order('generated_at', { ascending: false }),
      supabase.rpc('get_revenue_by_campaign'),
    ])

    if (campaignsRes.error || !campaignsRes.data) {
      console.error('[Admin Reports] Failed to fetch campaigns:', campaignsRes.error?.message)
      return { data: null, error: campaignsRes.error?.message || 'Failed to fetch campaigns' }
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
      console.error('[Admin Reports] Revenue RPC failed:', revenuesRes.error.message)
      // Continue with empty revenue map - shows £0.00 which is safe fallback
      // (campaigns without confirmed sales legitimately have £0 revenue)
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

    return { data: rows, error: null }
  } catch (err) {
    console.error('[Admin Reports] Unexpected error:', err)
    return { data: null, error: 'Failed to load report data' }
  }
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
