export const dynamic = "force-dynamic"
export const revalidate = 0

import { SectionHeader } from "@/components/section-header"
import { GiveawayCard } from "@/components/giveaway-card"
import { createClient } from "@supabase/supabase-js"
import type { GiveawayPublic } from "@/lib/types"

export default async function GiveawaysPage() {
  let giveaways: GiveawayPublic[] = []

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
    const { data, error } = await supabase
      .from('giveaway_snapshots')
      .select('payload')
      .eq('kind', 'list')
      .order('generated_at', { ascending: false })

    if (!error && data && data.length > 0) {
      // Extract campaign IDs from snapshot payloads
      const campaignIds = data
        .map((row) => (row.payload as Record<string, any>).id)
        .filter((id): id is string => typeof id === 'string')

      // Batch query live ticket counters
      let counterMap: Record<string, number> = {}
      if (campaignIds.length > 0) {
        const { data: counters } = await supabase
          .from('giveaway_ticket_counters')
          .select('giveaway_id, next_ticket')
          .in('giveaway_id', campaignIds)

        if (counters) {
          counterMap = Object.fromEntries(
            counters.map((c: { giveaway_id: string; next_ticket: number }) => [c.giveaway_id, c.next_ticket])
          )
        }
      }

      // Batch query live cap values from campaigns
      let capMap: Record<string, number> = {}
      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id, max_tickets_total')
          .in('id', campaignIds)

        if (campaigns) {
          capMap = Object.fromEntries(
            campaigns
              .filter((c: { id: string; max_tickets_total: number | null }) => c.max_tickets_total != null)
              .map((c: { id: string; max_tickets_total: number }) => [c.id, c.max_tickets_total])
          )
        }
      }

      giveaways = data.map((row) => {
        const p = row.payload as Record<string, any>
        const campaignId = p.id as string | undefined
        const liveNextTicket = campaignId ? counterMap[campaignId] : undefined
        const ticketsSold = Math.max(0, (liveNextTicket ?? 1) - 1)
        const liveCapTotal = campaignId ? capMap[campaignId] : undefined

        return {
          slug: p.slug || 'unknown',
          title: p.title || 'Untitled',
          prizeTitle: p.prize_title || p.title || 'Prize',
          imageUrl: p.hero_image_url || '/placeholder.svg',
          ticketPrice: (p.base_ticket_price_pence ?? 0) / 100,
          endsAt: new Date(p.ends_at),
          status: p.status,
          prizeValue: p.prize_value_text || undefined,
          bundles: p.bundles || undefined,
          rulesText: 'See full terms and conditions for complete rules.',
          ticketsSold,
          nextTicket: liveNextTicket ?? 1,
          hardCapTotalTickets: liveCapTotal ?? Number(p.hard_cap_total_tickets ?? p.max_tickets_total ?? 0),
        }
      })
      giveaways = giveaways.filter(g => g.endsAt.getTime() > Date.now() && g.status === "live")
    }
  } catch (err) {
    console.error('[giveaways] Failed to fetch snapshots from Supabase:', err)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a002b] via-[#2d0050] to-[#0a0014]">
      <div className="container px-4 py-8">
        <SectionHeader title="All Giveaways" subtitle="Browse all active giveaways and enter to win" />

        {/* Content */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {giveaways.length > 0 ? (
            giveaways.map((giveaway) => (
              <GiveawayCard key={giveaway.slug} giveaway={giveaway} />
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              No live giveaways yet. Check back soon.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
