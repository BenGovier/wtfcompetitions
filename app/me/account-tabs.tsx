'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SignOutButton } from './sign-out-button'

type EntryRow = {
  id: string
  campaign_id: string
  qty: number
  created_at: string
}

type AllocationInfo = { start_ticket: number; end_ticket: number }
type CampaignInfo = { title: string; status: string }

interface AccountTabsProps {
  email: string
  entries: EntryRow[]
  entriesError: string | null
  allocationMap: Record<string, AllocationInfo>
  campaignMap: Record<string, CampaignInfo>
}

function formatDateUK(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function TicketDisplay({ start, end }: { start?: number | null; end?: number | null }) {
  if (typeof start !== 'number' || typeof end !== 'number') {
    return <span className="text-muted-foreground">Tickets: pending</span>
  }
  if (start === end) {
    return <span className="font-mono font-semibold">{'Ticket #' + start}</span>
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

export function AccountTabs({ email, entries, entriesError, allocationMap, campaignMap }: AccountTabsProps) {
  return (
    <Tabs defaultValue="tickets" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="tickets">My Tickets</TabsTrigger>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      {/* My Tickets */}
      <TabsContent value="tickets">
        <Card>
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
                  const campaign = campaignMap[entry.campaign_id]
                  const allocation = allocationMap[entry.id]
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
      </TabsContent>

      {/* Profile */}
      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm">{email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </TabsContent>

      {/* Settings */}
      <TabsContent value="settings">
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
      </TabsContent>
    </Tabs>
  )
}
