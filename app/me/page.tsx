import { SectionHeader } from "@/components/section-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SignOutButton } from "./sign-out-button"

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login?redirect=/me')
  }

  // Fetch user's entries
  let entries: { id: string; giveaway_id: string; qty: number; created_at: string }[] = []
  let entriesError: string | null = null

  const { data: entriesData, error: entriesErr } = await supabase
    .from('entries')
    .select('id, giveaway_id, qty, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (entriesErr) {
    entriesError = entriesErr.message
  } else {
    entries = entriesData ?? []
  }

  // Fetch giveaway titles from snapshots
  const titleMap = new Map<string, { title: string; status: string }>()
  const { data: snapshots } = await supabase
    .from('giveaway_snapshots')
    .select('payload')
    .eq('kind', 'list')

  if (snapshots) {
    for (const row of snapshots) {
      const p = row.payload as Record<string, any>
      if (p?.id) {
        titleMap.set(String(p.id), {
          title: p.title || 'Giveaway',
          status: p.status || 'unknown',
        })
      }
    }
  }

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
          {entriesError ? (
            <p className="py-4 text-sm text-destructive">
              {'Failed to load entries: ' + entriesError}
            </p>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No entries yet.</p>
              <Button asChild size="sm">
                <a href="/giveaways">Browse Giveaways</a>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const snap = titleMap.get(entry.giveaway_id)
                  const status = snap?.status || 'unknown'
                  const badgeVariant =
                    status === 'live' || status === 'active'
                      ? 'default' as const
                      : status === 'unknown'
                        ? 'outline' as const
                        : 'secondary' as const

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {snap?.title || 'Giveaway'}
                      </TableCell>
                      <TableCell>{entry.qty}</TableCell>
                      <TableCell>
                        {new Date(entry.created_at).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant}>{status}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sign Out Button */}
      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  )
}
