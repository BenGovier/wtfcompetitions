"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export interface DuplicateTarget {
  id: string
  title: string
}

interface DuplicateCampaignDialogProps {
  /** The campaign to duplicate. When null the dialog is closed. */
  target: DuplicateTarget | null
  onClose: () => void
}

export function DuplicateCampaignDialog({ target, onClose }: DuplicateCampaignDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [copyBundles, setCopyBundles] = useState(true)
  const [copyInstantPrizes, setCopyInstantPrizes] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Guards against a rapid double-click creating two drafts from one intent.
  const inFlightRef = useRef(false)

  const open = target !== null

  function handleOpenChange(next: boolean) {
    if (isSubmitting) return // never dismiss mid-request
    if (!next) {
      setError(null)
      onClose()
    }
  }

  async function handleDuplicate() {
    if (!target) return
    if (inFlightRef.current) return // double-submit guard
    inFlightRef.current = true
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/admin/campaigns/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: target.id,
          copyBundles,
          copyInstantPrizes,
        }),
      })
      const json = await res.json()

      if (!res.ok || !json.ok || !json.id) {
        setError(
          json?.error === "source_not_found"
            ? "That campaign could not be found."
            : "Could not create the draft copy. Please try again.",
        )
        return
      }

      toast({
        title: "Draft copy created",
        description:
          "Review the slug, dates, pricing, capacity, artwork and instant-prize positions before publishing.",
      })
      // Redirect straight to the new draft's edit page with a review flag.
      router.push(`/admin/campaigns/${json.id}?duplicated=1`)
      router.refresh()
    } catch {
      setError("Could not create the draft copy. Please try again.")
    } finally {
      setIsSubmitting(false)
      inFlightRef.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicate this campaign as a draft?</DialogTitle>
          <DialogDescription>
            This creates a new editable draft using the reusable campaign setup. It will not copy
            sales, customers, purchased tickets, historic winning positions, winners or payouts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3">
            <Checkbox
              id="copy-bundles"
              checked={copyBundles}
              onCheckedChange={(v) => setCopyBundles(v === true)}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <div className="grid gap-1 leading-none">
              <Label htmlFor="copy-bundles" className="font-medium">
                Copy ticket bundles
              </Label>
              <p className="text-sm text-muted-foreground">
                Copies bundle quantities and prices. Review them against the new ticket price and
                capacity before publishing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="copy-instant-prizes"
              checked={copyInstantPrizes}
              onCheckedChange={(v) => setCopyInstantPrizes(v === true)}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <div className="grid gap-1 leading-none">
              <Label htmlFor="copy-instant-prizes" className="font-medium">
                Copy instant-prize setup
              </Label>
              <p className="text-sm text-muted-foreground">
                Prize titles, values, fulfilment types and quantities will be copied. New unassigned
                prize slots will be created, but no historic ticket positions, claims or awards will
                be copied.
              </p>
            </div>
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create draft copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
