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

  // Step 3: Fetch campaigns (extended with image and end date)
  const campaignMap: Record<string, { title: string; status: string; heroImageUrl: string | null; endAt: string | null }> = {}

  if (entries.length > 0) {
    const campaignIds = [...new Set(entries.map((e) => e.campaign_id))]
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, title, status, hero_image_url, end_at')
      .in('id', campaignIds)

    if (campaigns) {
      for (const c of campaigns) {
        campaignMap[c.id] = {
          title: c.title || 'Giveaway',
          status: c.status || 'unknown',
          heroImageUrl: c.hero_image_url || null,
          endAt: c.end_at || null,
        }
      }
    }
  }

  // Step 4: Fetch user's instant wins via checkout_intents
  const winsMap: Record<string, { prizeTitle: string; awardedAt: string }[]> = {}

  if (entries.length > 0) {
    // Get checkout_intent_ids for this user
    const { data: checkouts } = await supabase
      .from('checkout_intents')
      .select('id, campaign_id')
      .eq('user_id', user.id)

    if (checkouts && checkouts.length > 0) {
      const checkoutIds = checkouts.map((c) => c.id)
      const checkoutCampaignMap: Record<string, string> = {}
      for (const c of checkouts) {
        checkoutCampaignMap[c.id] = c.campaign_id
      }

      // Get instant_win_awards for those checkout_intents
      const { data: awards } = await supabase
        .from('instant_win_awards')
        .select('checkout_intent_id, prize_id, awarded_at, instant_win_prizes(prize_title)')
        .in('checkout_intent_id', checkoutIds)

      if (awards) {
        for (const a of awards) {
          const campaignId = checkoutCampaignMap[a.checkout_intent_id]
          if (campaignId) {
            if (!winsMap[campaignId]) {
              winsMap[campaignId] = []
            }
            const prizeTitle = (a.instant_win_prizes as any)?.prize_title || 'Prize'
            winsMap[campaignId].push({
              prizeTitle,
              awardedAt: a.awarded_at,
            })
          }
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">My Account</h1>
          <p className="mt-1 text-white/70">Manage your entries and profile</p>
        </div>

        <AccountTabs
          email={user.email || ''}
          entries={entries}
          entriesError={entriesError}
          allocationMap={allocationMap}
          campaignMap={campaignMap}
          winsMap={winsMap}
        />
      </div>
    </div>
  )
}
