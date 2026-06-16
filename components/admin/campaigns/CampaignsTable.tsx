import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Campaign, CampaignStatus } from "@/lib/types/campaign"

interface CampaignsTableProps {
  campaigns: Campaign[]
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

function getStatusVariant(status: CampaignStatus) {
  switch (status) {
    case "live":
      return "default"
    case "draft":
      return "secondary"
    case "paused":
      return "outline"
    case "ended":
      return "destructive"
    default:
      return "outline"
  }
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Start</TableHead>
            <TableHead className="hidden md:table-cell">End</TableHead>
            <TableHead className="hidden sm:table-cell">Ticket Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="font-semibold text-foreground">{campaign.title}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(campaign.status)}>
                  {campaign.status}
                </Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell">{formatDate(campaign.startAt)}</TableCell>
              <TableCell className="hidden md:table-cell">{formatDate(campaign.endAt)}</TableCell>
              <TableCell className="hidden sm:table-cell">{formatPrice(campaign.ticketPricePence)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {campaign.presentation_type === "balloon_pop" && (
                    <Button asChild variant="outline" size="sm" className="bg-transparent">
                      <Link href={`/admin/campaigns/${campaign.id}/balloon-board`}>Manage Balloon Board</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm" className="bg-transparent">
                    <Link href={`/admin/campaigns/${campaign.id}/tickets`}>View Tickets</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="bg-transparent">
                    <Link href={`/admin/campaigns/${campaign.id}`}>Edit</Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
