import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import EntriesTable from "@/components/admin/entries/EntriesTable"
import type { Entry, EntriesCampaignLite } from "@/lib/types/entry"

// Mock campaigns data
const mockCampaigns: EntriesCampaignLite[] = [
  {
    id: '1',
    title: 'Win a MacBook Pro',
    status: 'live',
  },
  {
    id: '2',
    title: 'PlayStation 5 Giveaway',
    status: 'live',
  },
  {
    id: '3',
    title: 'iPhone 15 Pro Competition',
    status: 'paused',
  },
]

// Mock entries data
const mockEntries: Entry[] = [
  {
    id: 'e1',
    campaignId: '1',
    createdAt: '2026-02-10T14:32:00Z',
    userLabel: 'user_***45',
    emailMasked: 'j***@g***.com',
    source: 'paid',
    quantity: 5,
    amountPaidPence: 2500,
    status: 'valid',
  },
  {
    id: 'e2',
    campaignId: '1',
    createdAt: '2026-02-10T14:28:00Z',
    userLabel: 'user_***78',
    emailMasked: 's***@o***.com',
    source: 'free',
    quantity: 1,
    amountPaidPence: 0,
    status: 'valid',
  },
  {
    id: 'e3',
    campaignId: '1',
    createdAt: '2026-02-10T14:15:00Z',
    userLabel: 'user_***12',
    emailMasked: 'a***@y***.com',
    source: 'paid',
    quantity: 10,
    amountPaidPence: 5000,
    status: 'valid',
  },
  {
    id: 'e4',
    campaignId: '1',
    createdAt: '2026-02-10T13:45:00Z',
    userLabel: 'user_***89',
    emailMasked: 'm***@h***.com',
    source: 'free',
    quantity: 1,
    amountPaidPence: 0,
    status: 'valid',
  },
  {
    id: 'e5',
    campaignId: '1',
    createdAt: '2026-02-10T13:22:00Z',
    userLabel: 'user_***34',
    emailMasked: 'e***@g***.com',
    source: 'paid',
    quantity: 3,
    amountPaidPence: 1500,
    status: 'flagged',
  },
  {
    id: 'e6',
    campaignId: '1',
    createdAt: '2026-02-10T12:58:00Z',
    userLabel: 'user_***67',
    emailMasked: 'k***@i***.com',
    source: 'paid',
    quantity: 20,
    amountPaidPence: 10000,
    status: 'valid',
  },
  {
    id: 'e7',
    campaignId: '1',
    createdAt: '2026-02-10T12:30:00Z',
    userLabel: 'user_***90',
    emailMasked: 'r***@p***.com',
    source: 'free',
    quantity: 1,
    amountPaidPence: 0,
    status: 'valid',
  },
  {
    id: 'e8',
    campaignId: '1',
    createdAt: '2026-02-10T12:15:00Z',
    userLabel: 'user_***23',
    emailMasked: 't***@l***.com',
    source: 'paid',
    quantity: 2,
    amountPaidPence: 1000,
    status: 'refunded',
  },
  {
    id: 'e9',
    campaignId: '1',
    createdAt: '2026-02-10T11:42:00Z',
    userLabel: 'user_***56',
    emailMasked: 'b***@m***.com',
    source: 'paid',
    quantity: 8,
    amountPaidPence: 4000,
    status: 'valid',
  },
  {
    id: 'e10',
    campaignId: '1',
    createdAt: '2026-02-10T11:20:00Z',
    userLabel: 'user_***01',
    emailMasked: 'f***@n***.com',
    source: 'free',
    quantity: 1,
    amountPaidPence: 0,
    status: 'valid',
  },
  {
    id: 'e11',
    campaignId: '1',
    createdAt: '2026-02-10T10:55:00Z',
    userLabel: 'user_***88',
    emailMasked: 'w***@d***.com',
    source: 'paid',
    quantity: 15,
    amountPaidPence: 7500,
    status: 'valid',
  },
  {
    id: 'e12',
    campaignId: '1',
    createdAt: '2026-02-10T10:30:00Z',
    userLabel: 'user_***42',
    emailMasked: 'q***@s***.com',
    source: 'free',
    quantity: 1,
    amountPaidPence: 0,
    status: 'valid',
  },
  {
    id: 'e13',
    campaignId: '1',
    createdAt: '2026-02-10T10:10:00Z',
    userLabel: 'user_***75',
    emailMasked: 'v***@t***.com',
    source: 'paid',
    quantity: 4,
    amountPaidPence: 2000,
    status: 'valid',
  },
  {
    id: 'e14',
    campaignId: '1',
    createdAt: '2026-02-10T09:45:00Z',
    userLabel: 'user_***19',
    emailMasked: 'n***@u***.com',
    source: 'paid',
    quantity: 7,
    amountPaidPence: 3500,
    status: 'flagged',
  },
  {
    id: 'e15',
    campaignId: '1',
    createdAt: '2026-02-10T09:20:00Z',
    userLabel: 'user_***63',
    emailMasked: 'h***@w***.com',
    source: 'free',
    quantity: 1,
    amountPaidPence: 0,
    status: 'valid',
  },
  {
    id: 'e16',
    campaignId: '1',
    createdAt: '2026-02-10T08:58:00Z',
    userLabel: 'user_***31',
    emailMasked: 'p***@x***.com',
    source: 'paid',
    quantity: 12,
    amountPaidPence: 6000,
    status: 'valid',
  },
  {
    id: 'e17',
    campaignId: '1',
    createdAt: '2026-02-10T08:30:00Z',
    userLabel: 'user_***54',
    emailMasked: 'c***@z***.com',
    source: 'paid',
    quantity: 1,
    amountPaidPence: 500,
    status: 'valid',
  },
  {
    id: 'e18',
    campaignId: '1',
    createdAt: '2026-02-10T08:05:00Z',
    userLabel: 'user_***97',
    emailMasked: 'l***@a***.com',
    source: 'free',
    quantity: 1,
    amountPaidPence: 0,
    status: 'valid',
  },
]

export default function EntriesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Entries</h2>
        <p className="text-muted-foreground">
          View and manage participant entries
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Entries (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Paid Tickets (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Revenue (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£435.00</div>
          </CardContent>
        </Card>
      </div>

      <EntriesTable entries={mockEntries} />
    </div>
  )
}
