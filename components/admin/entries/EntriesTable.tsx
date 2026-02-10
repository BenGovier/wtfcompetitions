import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Entry } from "@/lib/types/entry"

type EntriesTableProps = {
  entries: Entry[]
  onView?: (entry: Entry) => void
}

export default function EntriesTable({ entries, onView }: EntriesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entries</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {new Date(entry.createdAt).toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>{entry.userLabel}</TableCell>
                <TableCell>{entry.emailMasked}</TableCell>
                <TableCell>
                  <Badge
                    variant={entry.source === 'paid' ? 'default' : 'secondary'}
                  >
                    {entry.source === 'paid' ? 'Paid' : 'Free'}
                  </Badge>
                </TableCell>
                <TableCell>{entry.quantity}</TableCell>
                <TableCell>
                  {entry.amountPaidPence > 0
                    ? `£${(entry.amountPaidPence / 100).toFixed(2)}`
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      entry.status === 'valid'
                        ? 'outline'
                        : entry.status === 'flagged'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {entry.status.charAt(0).toUpperCase() +
                      entry.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onView?.(entry)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
