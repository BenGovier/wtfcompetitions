import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CampaignsTable } from "@/components/admin/campaigns/CampaignsTable"
import type { Campaign } from "@/lib/types/campaign"

const mockCampaigns: Campaign[] = [
  {
    id: "1",
    status: "draft",
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
  },
  {
    id: "2",
    status: "live",
    title: "MacBook Pro M3 Giveaway",
    slug: "macbook-pro-m3-giveaway",
    summary: "Win a powerful MacBook Pro",
    description: "Enter to win the new MacBook Pro with M3 chip, perfect for creators.",
    startAt: "2024-01-15T00:00:00Z",
    endAt: "2024-02-28T23:59:59Z",
    mainPrizeTitle: "MacBook Pro 14-inch M3",
    mainPrizeDescription: "16GB RAM, 512GB SSD",
    heroImageUrl: "/macbook-pro-laptop.png",
    ticketPricePence: 299,
    maxTicketsTotal: 5000,
    maxTicketsPerUser: 50,
  },
  {
    id: "3",
    status: "ended",
    title: "PlayStation 5 Bundle",
    slug: "playstation-5-bundle",
    summary: "Win a PS5 with games",
    description: "Complete PlayStation 5 bundle with console and top games.",
    startAt: "2023-12-01T00:00:00Z",
    endAt: "2024-01-31T23:59:59Z",
    mainPrizeTitle: "PlayStation 5 Console Bundle",
    mainPrizeDescription: "Includes 3 AAA games",
    heroImageUrl: "/playstation-5-console.png",
    ticketPricePence: 149,
    maxTicketsTotal: null,
    maxTicketsPerUser: null,
  },
]

export default function CampaignsPage() {
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

      <CampaignsTable campaigns={mockCampaigns} />
    </div>
  )
}
