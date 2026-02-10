import { CampaignForm } from "@/components/admin/campaigns/CampaignForm"
import type { Campaign } from "@/lib/types/campaign"

const mockDefaultCampaign: Campaign = {
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

const mockExistingCampaign: Campaign = {
  id: "1",
  status: "live",
  title: "iPhone 15 Pro Giveaway",
  slug: "iphone-15-pro-giveaway",
  summary: "Win the latest iPhone 15 Pro",
  description: "Enter for your chance to win the brand new iPhone 15 Pro with 256GB storage.",
  startAt: "2024-02-01T00:00:00Z",
  endAt: "2024-03-01T23:59:59Z",
  mainPrizeTitle: "iPhone 15 Pro 256GB",
  mainPrizeDescription: "Latest model in Titanium Blue",
  heroImageUrl: "/iphone-15-pro-smartphone.jpg",
  ticketPricePence: 199,
  maxTicketsTotal: 10000,
  maxTicketsPerUser: 100,
}

export default function CampaignFormPage({
  params,
}: {
  params: { id: string }
}) {
  const isNew = params.id === "new"
  const campaign = isNew ? mockDefaultCampaign : mockExistingCampaign

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {isNew ? "Create Campaign" : "Edit Campaign"}
        </h2>
        <p className="text-muted-foreground">
          {isNew
            ? "Set up a new giveaway campaign"
            : "Update campaign details"}
        </p>
      </div>

      <CampaignForm campaign={campaign} isNew={isNew} />
    </div>
  )
}
