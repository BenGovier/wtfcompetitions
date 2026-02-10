import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const stats = [
  { label: "Active Campaigns", value: "12", sublabel: "3 ending soon" },
  { label: "Total Entries (24h)", value: "1,847", sublabel: "+23% vs yesterday" },
  { label: "Revenue (24h)", value: "£18,934", sublabel: "+15% vs yesterday" },
  { label: "Instant Win Status", value: "Active", sublabel: "94% inventory remaining" },
]

const recentActivity = [
  { time: "2 min ago", text: "New campaign created" },
  { time: "12 min ago", text: "Winner drawn" },
  { time: "1 hour ago", text: "Campaign ended" },
  { time: "2 hours ago", text: "Instant win claimed" },
  { time: "3 hours ago", text: "Campaign paused" },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of platform activity
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
              <p className="text-xs text-muted-foreground">{stat.sublabel}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-2 w-2 translate-y-1.5 rounded-full bg-primary" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{activity.text}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start bg-transparent" variant="outline">
              <Link href="/admin/campaigns">Create New Campaign</Link>
            </Button>
            <Button asChild className="w-full justify-start bg-transparent" variant="outline">
              <Link href="/admin/instant-wins">Configure Instant Wins</Link>
            </Button>
            <Button asChild className="w-full justify-start bg-transparent" variant="outline">
              <Link href="/admin/entries">View All Entries</Link>
            </Button>
            <Button asChild className="w-full justify-start bg-transparent" variant="outline">
              <Link href="/admin/audit-logs">Export Audit Log</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
