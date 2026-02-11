import { SectionHeader } from "@/components/section-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login?redirect=/me')
  }

  // Mock entries data
  const mockEntries = [
    { campaign: 'Win a MacBook Pro', date: '2026-02-10', status: 'active' },
    { campaign: 'PlayStation 5 Giveaway', date: '2026-02-08', status: 'active' },
    { campaign: 'iPhone 15 Pro Competition', date: '2026-02-05', status: 'ended' },
  ]

  return (
    <div className="container px-4 py-8">
      <SectionHeader title="My Account" subtitle="Manage your entries and profile" />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Manage your preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates about your entries</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Toggle
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Marketing Emails</p>
                  <p className="text-sm text-muted-foreground">Get notified about new giveaways</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Toggle
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Entries Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>My Entries</CardTitle>
          <CardDescription>Your active and past giveaway entries</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockEntries.map((entry, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{entry.campaign}</TableCell>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>
                    <Badge variant={entry.status === 'active' ? 'default' : 'secondary'}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sign Out Button */}
      <div className="mt-6">
        <Button variant="outline" size="sm" disabled>
          Sign Out
        </Button>
      </div>
    </div>
  )
}
