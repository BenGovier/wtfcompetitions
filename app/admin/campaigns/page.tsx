import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CampaignsTable } from "@/components/admin/campaigns/CampaignsTable"
import { createClient } from "@/lib/supabase/server"
import type { Campaign } from "@/lib/types/campaign"

export default async function CampaignsPage() {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('campaigns')
    .select(
      'id, status, title, slug, summary, description, start_at, end_at, main_prize_title, main_prize_description, hero_image_url, ticket_price_pence, max_tickets_total, max_tickets_per_user'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-destructive">
            {'Failed to load campaigns: ' + error.message}
          </p>
        </div>
      </div>
    )
  }

  const campaigns: Campaign[] = (rows ?? []).map((r) => ({
    id: String(r.id),
    status: r.status ?? 'draft',
    title: r.title ?? '',
    slug: r.slug ?? '',
    summary: r.summary ?? '',
    description: r.description ?? '',
    startAt: r.start_at ?? '',
    endAt: r.end_at ?? '',
    mainPrizeTitle: r.main_prize_title ?? '',
    mainPrizeDescription: r.main_prize_description ?? '',
    heroImageUrl: r.hero_image_url ?? '',
    ticketPricePence: r.ticket_price_pence ?? 0,
    maxTicketsTotal: r.max_tickets_total ?? null,
    maxTicketsPerUser: r.max_tickets_per_user ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">
            Manage your giveaway campaigns
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/campaigns/new">Create Campaign</Link>
        </Button>
      </div>

      <CampaignsTable campaigns={campaigns} />
    </div>
  )
}
