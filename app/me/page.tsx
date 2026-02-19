import { SectionHeader } from "@/components/section-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SignOutButton } from "./sign-out-button"

function formatDateUK(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function TicketDisplay({ start, end }: { start?: number | null; end?: number | null }) {
  if (typeof start !== 'number' || typeof end !== 'number') {
    return <span className="text-muted-foreground">Tickets: pending</span>
  }
  if (start === end) {
    return <span className="font-mono font-semibold">Ticket #{start}</span>
  }
  const count = end - start + 1
  return (
    <span className="font-mono font-semibold">
      {'Tickets #' + start + '\u2013#' + end}
      <span className="ml-1 text-xs font-normal text-muted-foreground">
        {'(' + count + ' ticket' + (count === 1 ? '' : 's') + ')'}
      </span>
    </span>
  )
}

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login?redirect=/me')
  }

  // Step 1: Fetch entries
  let entries: { id: string; campaign_id: string; qty: number; created_at: string }[] = []
  let entriesError: string | null = null

  const { data: entriesData, error: entriesErr } = await supabase
    .from('entries')
    .select('id, campaign_id, qty, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (entriesErr) {
    entriesError = entriesErr.message
  } else {
    entries = entriesData ?? []
  }

  // Step 2: Fetch ticket allocations
  const allocationMap = new Map<string, { start_ticket: number; end_ticket: number }>()

  if (entries.length > 0) {
    const entryIds = entries.map((e) => e.id)
    const { data: allocations } = await supabase
      .from('ticket_allocations')
      .select('entry_id, start_ticket, end_ticket')
      .in('entry_id', entryIds)

    if (allocations) {
      for (const a of allocations) {
        allocationMap.set(a.entry_id, {
          start_ticket: a.start_ticket,
          end_ticket: a.end_ticket,
        })
      }
    }
  }

  // Step 3: Fetch campaigns
  const campaignMap = new Map<string, { title: string; status: string }>()

  if (entries.length > 0) {
    const campaignIds = [...new Set(entries.map((e) => e.campaign_id))]
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, title, status')
      .in('id', campaignIds)

    if (campaigns) {
      for (const c of campaigns) {
        campaignMap.set(c.id, { title: c.title || 'Giveaway', status: c.status || 'unknown' })
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

      {/* My Entries */}
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
            <div className="grid gap-3 sm:grid-cols-2">
              {entries.map((entry) => {
                const campaign = campaignMap.get(entry.campaign_id)
                const allocation = allocationMap.get(entry.id)
                const status = campaign?.status || 'unknown'
                const isLive = status === 'live' || status === 'active'

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground leading-tight">
                        {campaign?.title || 'Giveaway'}
                      </h3>
                      <Badge
                        variant={isLive ? 'default' : status === 'unknown' ? 'outline' : 'secondary'}
                        className="shrink-0"
                      >
                        {isLive ? 'Live' : 'Ended'}
                      </Badge>
                    </div>

                    <div className="text-sm">
                      <TicketDisplay
                        start={allocation?.start_ticket}
                        end={allocation?.end_ticket}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{entry.qty === 1 ? '1 entry' : entry.qty + ' entries'}</span>
                      <span>{formatDateUK(entry.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
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
