import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import InstantWinsOverview from "@/components/admin/instant-wins/InstantWinsOverview"
import InstantWinPrizesTable from "@/components/admin/instant-wins/InstantWinPrizesTable"
import ReleaseRulesEditor from "@/components/admin/instant-wins/ReleaseRulesEditor"
import InstantWinAuditLogTable from "@/components/admin/instant-wins/InstantWinAuditLogTable"
import type { 
  InstantWinsCampaignLite, 
  InstantWinsOverviewStats,
  InstantWinPrize,
  ReleaseRule,
  InstantWinAttemptLog
} from "@/lib/types/instantWins"

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

// Mock prizes data
const mockPrizes: InstantWinPrize[] = [
  {
    id: 'p1',
    campaignId: '1',
    name: '$10 Gift Card',
    tier: 'small',
    valueLabel: '$10',
    totalQty: 50,
    remainingQty: 42,
    weight: 100,
    isActive: true,
  },
  {
    id: 'p2',
    campaignId: '1',
    name: 'Free Coffee Voucher',
    tier: 'small',
    valueLabel: '$5',
    totalQty: 100,
    remainingQty: 87,
    weight: 150,
    isActive: true,
  },
  {
    id: 'p3',
    campaignId: '1',
    name: '$50 Store Credit',
    tier: 'medium',
    valueLabel: '$50',
    totalQty: 30,
    remainingQty: 28,
    weight: 50,
    isActive: true,
  },
  {
    id: 'p4',
    campaignId: '1',
    name: 'Wireless Earbuds',
    tier: 'medium',
    valueLabel: '$99',
    totalQty: 20,
    remainingQty: 18,
    weight: 30,
    isActive: true,
  },
  {
    id: 'p5',
    campaignId: '1',
    name: 'iPad Air',
    tier: 'big',
    valueLabel: '$599',
    totalQty: 5,
    remainingQty: 5,
    weight: 5,
    isActive: false,
  },
  {
    id: 'p6',
    campaignId: '1',
    name: 'Apple Watch',
    tier: 'big',
    valueLabel: '$399',
    totalQty: 8,
    remainingQty: 2,
    weight: 8,
    isActive: true,
  },
  {
    id: 'p7',
    campaignId: '1',
    name: '$100 Gift Card',
    tier: 'medium',
    valueLabel: '$100',
    totalQty: 15,
    remainingQty: 12,
    weight: 25,
    isActive: true,
  },
]

// Mock release rules data
const mockRules: ReleaseRule[] = [
  {
    id: 'r1',
    campaignId: '1',
    type: 'tickets_sold_percent',
    thresholdLabel: '20% sold',
    eligibleTiers: ['small'],
  },
  {
    id: 'r2',
    campaignId: '1',
    type: 'tickets_sold_percent',
    thresholdLabel: '50% sold',
    eligibleTiers: ['small', 'medium'],
  },
  {
    id: 'r3',
    campaignId: '1',
    type: 'time',
    thresholdLabel: 'Day 10',
    eligibleTiers: ['small', 'medium', 'big'],
  },
]

// Mock audit log data
const mockLogs: InstantWinAttemptLog[] = [
  {
    id: 'a1b2c3',
    campaignId: '1',
    createdAt: '2026-02-10T14:32:00Z',
    userLabel: 'user_***45',
    eligibleSetHashShort: 'e4f3a2',
    outcome: 'won',
    prizeName: '$10 Gift Card',
    tier: 'small',
  },
  {
    id: 'd4e5f6',
    campaignId: '1',
    createdAt: '2026-02-10T14:28:00Z',
    userLabel: 'user_***78',
    eligibleSetHashShort: 'b7c8d9',
    outcome: 'lost',
  },
  {
    id: 'g7h8i9',
    campaignId: '1',
    createdAt: '2026-02-10T14:15:00Z',
    userLabel: 'user_***12',
    eligibleSetHashShort: 'f1e2d3',
    outcome: 'won',
    prizeName: 'Free Coffee Voucher',
    tier: 'small',
  },
  {
    id: 'j1k2l3',
    campaignId: '1',
    createdAt: '2026-02-10T13:45:00Z',
    userLabel: 'user_***89',
    eligibleSetHashShort: 'a4b5c6',
    outcome: 'lost',
  },
  {
    id: 'm4n5o6',
    campaignId: '1',
    createdAt: '2026-02-10T13:22:00Z',
    userLabel: 'user_***34',
    eligibleSetHashShort: 'd7e8f9',
    outcome: 'won',
    prizeName: 'Wireless Earbuds',
    tier: 'medium',
  },
  {
    id: 'p7q8r9',
    campaignId: '1',
    createdAt: '2026-02-10T12:58:00Z',
    userLabel: 'user_***67',
    eligibleSetHashShort: 'g1h2i3',
    outcome: 'lost',
  },
  {
    id: 's1t2u3',
    campaignId: '1',
    createdAt: '2026-02-10T12:30:00Z',
    userLabel: 'user_***90',
    eligibleSetHashShort: 'j4k5l6',
    outcome: 'won',
    prizeName: '$50 Store Credit',
    tier: 'medium',
  },
  {
    id: 'v4w5x6',
    campaignId: '1',
    createdAt: '2026-02-10T12:15:00Z',
    userLabel: 'user_***23',
    eligibleSetHashShort: 'm7n8o9',
    outcome: 'lost',
  },
  {
    id: 'y7z8a9',
    campaignId: '1',
    createdAt: '2026-02-10T11:42:00Z',
    userLabel: 'user_***56',
    eligibleSetHashShort: 'p1q2r3',
    outcome: 'won',
    prizeName: 'Apple Watch',
    tier: 'big',
  },
  {
    id: 'b1c2d3',
    campaignId: '1',
    createdAt: '2026-02-10T11:20:00Z',
    userLabel: 'user_***01',
    eligibleSetHashShort: 's4t5u6',
    outcome: 'lost',
  },
]

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

      <InstantWinPrizesTable prizes={mockPrizes} />

      <div className="grid gap-4 md:grid-cols-2">
        <ReleaseRulesEditor rules={mockRules} />
        <InstantWinAuditLogTable logs={mockLogs} />
      </div>
    </div>
  )
}
