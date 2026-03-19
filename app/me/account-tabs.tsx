'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
    return <span className="text-white/50">Tickets: pending</span>
  }
  if (start === end) {
    return <span className="font-mono font-semibold text-white">{'Ticket #' + start}</span>
  }
  const count = end - start + 1
  return (
    <span className="font-mono font-semibold text-white">
      {'Tickets #' + start + '\u2013#' + end}
      <span className="ml-1 text-xs font-normal text-white/60">
        {'(' + count + ' ticket' + (count === 1 ? '' : 's') + ')'}
      </span>
    </span>
  )
}

export function AccountTabs({ email, entries, entriesError, allocationMap, campaignMap }: AccountTabsProps) {
  return (
    <Tabs defaultValue="tickets" className="w-full">
      <TabsList className="flex w-full gap-2 overflow-x-auto rounded-xl bg-white/5 p-1 backdrop-blur-md border border-white/10">
        <TabsTrigger value="tickets" className="flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-md">My Tickets</TabsTrigger>
        <TabsTrigger value="profile" className="flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-md">Profile</TabsTrigger>
        <TabsTrigger value="settings" className="flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-600 data-[state=active]:text-black data-[state=active]:shadow-md">Settings</TabsTrigger>
      </TabsList>

      {/* My Tickets */}
      <TabsContent value="tickets">
        <div className="rounded-2xl border border-white/10 bg-[#1f0033]/70 backdrop-blur-md shadow-[0_0_30px_rgba(255,215,0,0.06)] p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">My Entries</h2>
            <p className="text-sm text-white/70">Your active and past giveaway entries</p>
          </div>
          
          {entriesError ? (
            <p className="py-4 text-sm text-red-400">
              {'Failed to load entries: ' + entriesError}
            </p>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-sm text-white/60">No entries yet.</p>
              <Button asChild size="sm" className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-semibold hover:from-yellow-500 hover:to-yellow-700">
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
                    className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-300 hover:bg-white/[0.07]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white leading-tight">
                        {campaign?.title || 'Giveaway'}
                      </h3>
                      <span
                        className={
                          isLive
                            ? 'shrink-0 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-xs font-medium text-yellow-300'
                            : 'shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80'
                        }
                      >
                        {isLive ? 'Live' : 'Ended'}
                      </span>
                    </div>

                    <div className="text-sm">
                      <TicketDisplay
                        start={allocation?.start_ticket}
                        end={allocation?.end_ticket}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-white/65">
                      <span>{entry.qty === 1 ? '1 entry' : entry.qty + ' entries'}</span>
                      <span>{formatDateUK(entry.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Profile */}
      <TabsContent value="profile">
        <div className="rounded-2xl border border-white/10 bg-[#1f0033]/70 backdrop-blur-md shadow-[0_0_30px_rgba(255,215,0,0.06)] p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Profile</h2>
            <p className="text-sm text-white/70">Your account information</p>
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-white/60">Email</p>
              <p className="text-sm text-white">{email}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </TabsContent>

      {/* Settings */}
      <TabsContent value="settings">
        <div className="rounded-2xl border border-white/10 bg-[#1f0033]/70 backdrop-blur-md shadow-[0_0_30px_rgba(255,215,0,0.06)] p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <p className="text-sm text-white/70">Manage your preferences</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Email Notifications</p>
                <p className="text-sm text-white/60">Receive updates about your entries</p>
              </div>
              <Button variant="outline" size="sm" disabled className="border-white/20 bg-white/5 text-white/50">
                Toggle
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Marketing Emails</p>
                <p className="text-sm text-white/60">Get notified about new giveaways</p>
              </div>
              <Button variant="outline" size="sm" disabled className="border-white/20 bg-white/5 text-white/50">
                Toggle
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
