import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Entry } from "@/lib/types/entry"
import { X, Flag, DollarSign } from 'lucide-react'

type EntryDetailsDrawerProps = {
  entry: Entry | null
  isOpen: boolean
  onClose: () => void
}

export default function EntryDetailsDrawer({
  entry,
  isOpen,
  onClose,
}: EntryDetailsDrawerProps) {
  if (!entry) return null

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-lg z-50 transition-transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold">Entry Details</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="shrink-0"
            >
              <X />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Entry ID</div>
              <div className="font-mono text-sm">{entry.id}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Time</div>
              <div className="text-sm">
                {new Date(entry.createdAt).toLocaleString('en-GB', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">User</div>
              <div className="text-sm">{entry.userLabel}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Email</div>
              <div className="text-sm">{entry.emailMasked}</div>
            </div>

            <div className="flex gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Source</div>
                <Badge
                  variant={entry.source === 'paid' ? 'default' : 'secondary'}
                >
                  {entry.source === 'paid' ? 'Paid' : 'Free'}
                </Badge>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-1">Quantity</div>
                <div className="text-sm font-medium">{entry.quantity}</div>
              </div>
            </div>

            {entry.amountPaidPence > 0 && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Amount Paid
                </div>
                <div className="text-sm font-medium">
                  £{(entry.amountPaidPence / 100).toFixed(2)}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <Badge
                variant={
                  entry.status === 'valid'
                    ? 'outline'
                    : entry.status === 'flagged'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-6 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              disabled
            >
              <Flag />
              Mark Flagged
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled
            >
              <DollarSign />
              Refund
            </Button>
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
