import { requireAdmin } from "@/lib/admin/auth"
import { LiveCampaignPicker } from "@/components/admin/live-feed/LiveCampaignPicker"

export default async function LiveFeedPage() {
  // Admins and Hosts (ops) can use the live control flow.
  await requireAdmin({ roles: ["admin", "ops"] })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Feed</h1>
          <p className="text-muted-foreground">
            Choose the campaign you&apos;re hosting to open its live control screen
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/0/09/TikTok_logo.svg"
          alt="TikTok"
          className="h-7 w-auto opacity-90"
        />
      </div>

      <LiveCampaignPicker />
    </div>
  )
}
