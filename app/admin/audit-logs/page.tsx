import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AuditLogsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
        <p className="text-muted-foreground">
          Track administrative actions and system events
        </p>
      </div>

      <Card>
        <CardHeader className="text-center">
          <CardTitle>No audit logs yet</CardTitle>
          <CardDescription>
            System activity and admin actions will be logged here
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/admin/audit-logs">Export Logs</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
