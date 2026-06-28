"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Crown, Minus, Plus, RotateCcw, Power, AlertTriangle, History } from "lucide-react"

type ItemType = "standard" | "vip"

interface BoardItem {
  id: string
  label: string
  type: ItemType
  amountPence: number
  starting: number
  remaining: number
  featured: boolean
  sort: number
}

interface BoardEvent {
  id: string
  actionType: string
  itemId: string | null
  label: string | null
  delta: number | null
  beforeRemaining: number | null
  afterRemaining: number | null
  createdAt: string
}

interface BoardData {
  id: string
  enabled: boolean
  items: BoardItem[]
  lastEventLabel: string | null
  lastEventAt: string | null
  updatedAt: string
}

interface CampaignSummary {
  id: string
  slug: string | null
  title: string | null
  status: string | null
  presentationType: string | null
}

interface ApiResponse {
  ok: boolean
  campaign?: CampaignSummary
  board?: BoardData | null
  recentEvents?: BoardEvent[]
  error?: string
}

type ActionBody =
  | { action: "enable" }
  | { action: "disable" }
  | { action: "decrement"; itemId: string }
  | { action: "increment"; itemId: string }
  | { action: "undo" }

function formatGBP(pence: number): string {
  if (!Number.isFinite(pence)) return "£0"
  const pounds = pence / 100
  return pounds % 1 === 0 ? `£${pounds.toLocaleString()}` : `£${pounds.toFixed(2)}`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch {
    return ""
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  campaign_not_found: "Campaign not found.",
  not_balloon_pop: "This campaign is not a Balloon Pop campaign.",
  board_not_found: "No live board has been set up for this campaign yet.",
  item_not_found: "That prize could not be found.",
  item_already_zero: "That prize is already at zero.",
  item_already_at_starting: "That prize is already at its starting amount.",
  nothing_to_undo: "There is nothing left to undo.",
  invalid_action: "That action is not allowed.",
  live_board_action_failed: "Something went wrong. Please try again.",
}

function errorText(code?: string): string {
  if (!code) return "Something went wrong. Please try again."
  return ERROR_MESSAGES[code] ?? code
}

/** VIP first, then highest amount to lowest, then by sort, then label. */
function sortItems(items: BoardItem[]): BoardItem[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === "vip" ? -1 : 1
    if (b.amountPence !== a.amountPence) return b.amountPence - a.amountPence
    if (a.sort !== b.sort) return a.sort - b.sort
    return a.label.localeCompare(b.label)
  })
}

export function LiveBoardPanel({ campaignId }: { campaignId: string }) {
  const { toast } = useToast()

  const [campaign, setCampaign] = useState<CampaignSummary | null>(null)
  const [board, setBoard] = useState<BoardData | null>(null)
  const [events, setEvents] = useState<BoardEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Track which specific control is busy so only that button shows a spinner.
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const [confirmUndo, setConfirmUndo] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/live-board`, { cache: "no-store" })
      const json: ApiResponse = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "live_board_action_failed")
      setCampaign(json.campaign ?? null)
      setBoard(json.board ?? null)
      setEvents(json.recentEvents ?? [])
      setLoadError(null)
    } catch (err: any) {
      setLoadError(errorText(err?.message))
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  const runAction = useCallback(
    async (body: ActionBody, key: string) => {
      setBusyKey(key)
      try {
        const res = await fetch(`/api/admin/campaigns/${campaignId}/live-board/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json: ApiResponse = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || "live_board_action_failed")

        // Soft success feedback (kept short for live use).
        const successText: Record<string, string> = {
          enable: "Public board enabled",
          disable: "Public board disabled",
          decrement: "Marked as popped",
          increment: "Correction applied",
          undo: "Last action undone",
        }
        toast({ title: successText[body.action] ?? "Done" })

        // Refetch the canonical board state after every action.
        await fetchBoard()
      } catch (err: any) {
        toast({ variant: "destructive", title: "Action failed", description: errorText(err?.message) })
      } finally {
        setBusyKey(null)
      }
    },
    [campaignId, fetchBoard, toast],
  )

  const sortedItems = useMemo(() => (board ? sortItems(board.items) : []), [board])

  const totals = useMemo(() => {
    const items = board?.items ?? []
    let standard = 0
    let vip = 0
    for (const it of items) {
      if (it.type === "vip") vip += it.remaining
      else standard += it.remaining
    }
    return { standard, vip, total: standard + vip }
  }, [board])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (loadError) {
    return (
      <Card className="border-destructive/40 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-destructive" />
          <div className="space-y-3">
            <p className="font-medium text-destructive">{loadError}</p>
            <Button variant="outline" onClick={fetchBoard}>
              Try again
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (!board) {
    return (
      <Card className="p-6">
        <p className="font-medium">No live board set up yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This campaign does not have a Balloon Pop board configured. Set one up before the live event.
        </p>
      </Card>
    )
  }

  const enabled = board.enabled

  return (
    <div className="space-y-6">
      {/* Status + global controls */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={campaign?.status === "live" ? "default" : "secondary"}>
              {campaign?.status ?? "unknown"}
            </Badge>
            <Badge
              className={cn(
                enabled
                  ? "bg-green-600 text-white hover:bg-green-600"
                  : "bg-muted text-muted-foreground hover:bg-muted",
              )}
            >
              {enabled ? "Public board ON" : "Public board OFF"}
            </Badge>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-3xl font-bold tabular-nums sm:text-4xl">{totals.total}</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">Total left</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <div className="text-3xl font-bold tabular-nums sm:text-4xl">{totals.standard}</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">Standard</div>
            </div>
            <div className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-center dark:bg-amber-950/30">
              <div className="flex items-center justify-center gap-1 text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-400 sm:text-4xl">
                <Crown className="size-5" />
                {totals.vip}
              </div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">VIP</div>
            </div>
          </div>

          {/* Enable / Disable */}
          {enabled ? (
            <Button
              size="lg"
              variant="outline"
              className="h-14 w-full text-base font-semibold"
              disabled={busyKey === "toggle"}
              onClick={() => setConfirmDisable(true)}
            >
              {busyKey === "toggle" ? <Spinner className="mr-2 size-5" /> : <Power className="mr-2 size-5" />}
              Disable Public Board
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-14 w-full bg-green-600 text-base font-semibold text-white hover:bg-green-700"
              disabled={busyKey === "toggle"}
              onClick={() => runAction({ action: "enable" }, "toggle")}
            >
              {busyKey === "toggle" ? <Spinner className="mr-2 size-5" /> : <Power className="mr-2 size-5" />}
              Enable Public Board
            </Button>
          )}

          {/* Undo */}
          <Button
            size="lg"
            variant="secondary"
            className="h-14 w-full text-base font-semibold"
            disabled={busyKey === "undo"}
            onClick={() => setConfirmUndo(true)}
          >
            {busyKey === "undo" ? <Spinner className="mr-2 size-5" /> : <RotateCcw className="mr-2 size-5" />}
            UNDO LAST ACTION
          </Button>

          {board.lastEventLabel ? (
            <p className="text-center text-sm text-muted-foreground">
              Last: {board.lastEventLabel}
              {board.lastEventAt ? ` · ${formatTime(board.lastEventAt)}` : ""}
            </p>
          ) : null}
        </div>
      </Card>

      {/* Prize items */}
      <div className="space-y-3">
        {sortedItems.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">This board has no prizes configured.</p>
          </Card>
        ) : (
          sortedItems.map((item) => {
            const isVip = item.type === "vip"
            const prominent = isVip || item.featured
            const popKey = `pop:${item.id}`
            const incKey = `inc:${item.id}`
            const atZero = item.remaining <= 0
            const atStart = item.remaining >= item.starting

            return (
              <Card
                key={item.id}
                className={cn(
                  "p-4",
                  prominent && "border-2",
                  isVip && "border-amber-400/70 bg-amber-50/60 dark:bg-amber-950/20",
                  !isVip && item.featured && "border-primary/50",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isVip ? (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                          <Crown className="mr-1 size-3" />
                          VIP
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Standard</Badge>
                      )}
                      <span
                        className={cn(
                          "truncate font-semibold",
                          prominent ? "text-lg sm:text-xl" : "text-base",
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{formatGBP(item.amountPence)}</span>
                      <span className="tabular-nums">
                        {item.remaining} / {item.starting} left
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="lg"
                      className="h-16 flex-1 text-base font-bold sm:w-32 sm:flex-none"
                      disabled={atZero || busyKey === popKey}
                      onClick={() => runAction({ action: "decrement", itemId: item.id }, popKey)}
                    >
                      {busyKey === popKey ? (
                        <Spinner className="mr-2 size-5" />
                      ) : (
                        <Minus className="mr-2 size-5" />
                      )}
                      POPPED
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-16 w-12 shrink-0"
                      aria-label={`Add one back to ${item.label}`}
                      disabled={atStart || busyKey === incKey}
                      onClick={() => runAction({ action: "increment", itemId: item.id }, incKey)}
                    >
                      {busyKey === incKey ? <Spinner className="size-5" /> : <Plus className="size-5" />}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Recent events */}
      <Card className="p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h3 className="font-semibold">Recent activity</h3>
        </div>
        <Separator className="mb-3" />
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium capitalize">{e.actionType}</span>
                  {e.label ? <span className="text-muted-foreground"> · {e.label}</span> : null}
                  {e.beforeRemaining != null && e.afterRemaining != null ? (
                    <span className="text-muted-foreground tabular-nums">
                      {" "}
                      ({e.beforeRemaining} → {e.afterRemaining})
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Undo confirmation */}
      <AlertDialog open={confirmUndo} onOpenChange={setConfirmUndo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo last action?</AlertDialogTitle>
            <AlertDialogDescription>
              This reverses the most recent pop or correction that has not already been undone. The original
              event is kept in the activity log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => runAction({ action: "undo" }, "undo")}>
              Undo last action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable confirmation */}
      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable the public board?</AlertDialogTitle>
            <AlertDialogDescription>
              Customers will no longer see the live Balloon Pop board until you enable it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => runAction({ action: "disable" }, "toggle")}>
              Disable board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
