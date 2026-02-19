import { SectionHeader } from "@/components/section-header"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AccountTabs } from "./account-tabs"

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
  const allocationMap: Record<string, { start_ticket: number; end_ticket: number }> = {}

  if (entries.length > 0) {
    const entryIds = entries.map((e) => e.id)
    const { data: allocations } = await supabase
      .from('ticket_allocations')
      .select('entry_id, start_ticket, end_ticket')
      .in('entry_id', entryIds)

    if (allocations) {
      for (const a of allocations) {
        allocationMap[a.entry_id] = {
          start_ticket: a.start_ticket,
          end_ticket: a.end_ticket,
        }
      }
    }
  }

  // Step 3: Fetch campaigns
  const campaignMap: Record<string, { title: string; status: string }> = {}

  if (entries.length > 0) {
    const campaignIds = [...new Set(entries.map((e) => e.campaign_id))]
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, title, status')
      .in('id', campaignIds)

    if (campaigns) {
      for (const c of campaigns) {
        campaignMap[c.id] = { title: c.title || 'Giveaway', status: c.status || 'unknown' }
      }
    }
  }

  return (
    <div className="container px-4 py-8">
      <SectionHeader title="My Account" subtitle="Manage your entries and profile" />

      <div className="mt-8">
        <AccountTabs
          email={user.email || ''}
          entries={entries}
          entriesError={entriesError}
          allocationMap={allocationMap}
          campaignMap={campaignMap}
        />
      </div>
    </div>
  )
}
