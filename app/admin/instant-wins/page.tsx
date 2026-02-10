import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import InstantWinsOverview from "@/components/admin/instant-wins/InstantWinsOverview"
import type { InstantWinsCampaignLite, InstantWinsOverviewStats } from "@/lib/types/instantWins"

// Mock campaigns data
const mockCampaigns: InstantWinsCampaignLite[] = [
  {
    id: '1',
    title: 'Win a MacBook Pro',
    endAt: '2026-03-15',
    status: 'live',
  },
  {
    id: '2',
    title: 'PlayStation 5 Giveaway',
    endAt: '2026-04-01',
    status: 'live',
  },
  {
    id: '3',
    title: 'iPhone 15 Pro Competition',
    endAt: '2026-02-28',
    status: 'paused',
  },
]

// Mock stats for the selected campaign
const mockStats: InstantWinsOverviewStats = {
  inventoryRemaining: 94,
  topTierStatus: 'locked',
  nextUnlock: '50 entries',
  mainPrizeDrawAt: 'Mar 15, 2026',
}

export default function InstantWinsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Instant Wins</h2>
        <p className="text-muted-foreground">
          Configure instant-win prizes and pacing. Main prize is drawn at campaign end.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <label htmlFor="campaign-select" className="text-sm font-medium">
          Campaign:
        </label>
        <Select defaultValue={mockCampaigns[0].id}>
          <SelectTrigger id="campaign-select" className="w-[300px]">
            <SelectValue placeholder="Select a campaign" />
          </SelectTrigger>
          <SelectContent>
            {mockCampaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <InstantWinsOverview stats={mockStats} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Instant Win Prizes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">(coming next)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pacing Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">(coming next)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">(coming next)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
