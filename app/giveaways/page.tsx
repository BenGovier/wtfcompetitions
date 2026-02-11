import { SectionHeader } from "@/components/section-header"
import { GiveawayCard } from "@/components/giveaway-card"
import { SkeletonBlock } from "@/components/skeleton-block"
import { mockGiveaways } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/server"
import type { GiveawayPublic } from "@/lib/types"

export default async function GiveawaysPage() {
  let giveaways: GiveawayPublic[] = mockGiveaways

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, slug, title, status, ends_at, hero_image_url, prize_title, prize_value, ticket_price')
      .order('ends_at', { ascending: true })

    if (!error && data && data.length > 0) {
      giveaways = data.map((row) => ({
        slug: row.slug || `campaign-${row.id}`,
        title: row.title || 'Untitled Campaign',
        prizeTitle: row.prize_title || row.title || 'Prize',
        imageUrl: row.hero_image_url || '/placeholder.svg',
        ticketPrice: row.ticket_price || 0,
        endsAt: row.ends_at ? new Date(row.ends_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: row.status === 'live' || row.status === 'active' ? 'active' : 'completed',
        prizeValue: row.prize_value || undefined,
        rulesText: 'See full terms and conditions for complete rules.',
      }))
    }
  } catch (err) {
    console.error('[v0] Failed to fetch campaigns from Supabase:', err)
  }

  return (
    <div className="container px-4 py-8">
      <SectionHeader title="All Giveaways" subtitle="Browse all active giveaways and enter to win" />

      {/* Mock loading state (hidden by default) */}
      <div className="mt-8 hidden">
        <SkeletonBlock />
      </div>

      {/* Content */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {giveaways.map((giveaway) => (
          <GiveawayCard key={giveaway.slug} giveaway={giveaway} />
        ))}
      </div>
    </div>
  )
}
