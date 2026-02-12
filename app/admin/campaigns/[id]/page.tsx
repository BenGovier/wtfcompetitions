import { CampaignForm } from "@/components/admin/campaigns/CampaignForm"
import { createClient } from "@/lib/supabase/server"
import type { Campaign } from "@/lib/types/campaign"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const defaultCampaign: Campaign = {
  id: "",
  status: "draft",
  title: "",
  slug: "",
  summary: "",
  description: "",
  startAt: new Date().toISOString(),
  endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  mainPrizeTitle: "",
  mainPrizeDescription: "",
  heroImageUrl: "",
  ticketPricePence: 99,
  maxTicketsTotal: null,
  maxTicketsPerUser: null,
}

export default async function CampaignFormPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const isNew = id === "new"

  if (isNew) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Create Campaign</h2>
          <p className="text-muted-foreground">Set up a new giveaway campaign</p>
        </div>
        <CampaignForm campaign={defaultCampaign} isNew />
      </div>
    )
  }

  if (!UUID_RE.test(id)) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Campaign not found</h2>
        <p className="text-muted-foreground">The campaign ID is not valid.</p>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: r, error } = await supabase
    .from('campaigns')
    .select(
      'id, status, title, slug, summary, description, start_at, end_at, main_prize_title, main_prize_description, hero_image_url, ticket_price_pence, max_tickets_total, max_tickets_per_user'
    )
    .eq('id', id)
    .single()

  if (error || !r) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Campaign not found</h2>
        <p className="text-muted-foreground">
          {error ? error.message : 'No campaign with that ID exists.'}
        </p>
      </div>
    )
  }

  const campaign: Campaign = {
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
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Edit Campaign</h2>
        <p className="text-muted-foreground">Update campaign details</p>
      </div>
      <CampaignForm campaign={campaign} isNew={false} />
    </div>
  )
}
