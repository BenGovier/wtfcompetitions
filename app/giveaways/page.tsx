import { SectionHeader } from "@/components/section-header"
import { GiveawayCard } from "@/components/giveaway-card"
import { createClient } from "@/lib/supabase/server"
import type { GiveawayPublic } from "@/lib/types"

export default async function GiveawaysPage() {
  let giveaways: GiveawayPublic[] = []

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('giveaway_snapshots')
      .select('payload')
      .eq('kind', 'list')
      .order('generated_at', { ascending: false })

    if (!error && data && data.length > 0) {
      giveaways = data.map((row) => {
        const p = row.payload as Record<string, any>
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
        }
      })
      giveaways = giveaways.filter(g => g.status === "live")
    }
  } catch (err) {
    console.error('[giveaways] Failed to fetch snapshots from Supabase:', err)
  }

  return (
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
  )
}
