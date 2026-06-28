"use client"

import { useEffect, useRef, useState } from "react"
import { Crown } from "lucide-react"

/**
 * PUBLIC, customer-facing Live Balloon Board.
 *
 * Extremely lightweight: it polls a CDN-cached public endpoint
 * (`/api/giveaways/[campaignId]/live-board`) every 10s, pauses while the tab is
 * hidden, and shows only grouped prize values still left to pop. No Supabase
 * client, no Realtime, no admin APIs. It NEVER permanently stops polling — a
 * disabled board renders nothing but keeps polling so it can appear the moment
 * the host enables it mid-stream.
 */

const POLL_MS = 10000

type PublicItem = {
  id: string
  label: string
  type: "vip" | "standard"
  amountPence: number
  starting: number
  remaining: number
  featured: boolean
}

type BoardState = {
  enabled: boolean
  totals: { totalRemaining: number; standardRemaining: number; vipRemaining: number }
  items: PublicItem[]
}

function formatGBP(pence: number): string {
  const pounds = Math.round(pence) / 100
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pounds)
}

// VIP first, then featured, then highest value to lowest.
function sortItems(items: PublicItem[]): PublicItem[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === "vip" ? -1 : 1
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return b.amountPence - a.amountPence
  })
}

export function PublicLiveBalloonBoard({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<BoardState | null>(null)

  // Tracks the latest request so out-of-order responses are ignored.
  const requestSeq = useRef(0)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let activeController: AbortController | null = null
    let stopped = false

    const fetchBoard = async () => {
      // Don't fetch while hidden — the visibility handler refetches on resume.
      if (typeof document !== "undefined" && document.hidden) return

      activeController?.abort()
      const controller = new AbortController()
      activeController = controller
      const seq = ++requestSeq.current

      try {
        const res = await fetch(`/api/giveaways/${campaignId}/live-board`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = await res.json()

        // Ignore stale/superseded responses and post-unmount resolves.
        if (stopped || seq !== requestSeq.current) return

        if (data?.ok && data.enabled === true) {
          setState({
            enabled: true,
            totals: data.totals ?? { totalRemaining: 0, standardRemaining: 0, vipRemaining: 0 },
            items: Array.isArray(data.items) ? data.items : [],
          })
        } else {
          // Disabled/ineligible: render nothing, but keep polling.
          setState({ enabled: false, totals: { totalRemaining: 0, standardRemaining: 0, vipRemaining: 0 }, items: [] })
        }
      } catch {
        // Network error / abort: keep last known state, keep polling.
      }
    }

    const onVisibility = () => {
      if (!document.hidden) void fetchBoard()
    }

    // Initial fetch + steady 10s poll (single interval).
    void fetchBoard()
    intervalId = setInterval(() => void fetchBoard(), POLL_MS)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      stopped = true
      if (intervalId) clearInterval(intervalId)
      activeController?.abort()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [campaignId])

  // Render nothing until enabled (but polling continues in the background).
  if (!state || !state.enabled) return null

  const visibleItems = sortItems(state.items.filter((it) => it.remaining > 0))

  return (
    <section
      aria-label="Live Balloon Board"
      className="rounded-xl border border-purple-500/20 bg-white/5 p-5 backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Live Balloon Board</h2>
          <p className="text-sm text-purple-200">Prizes still left to pop</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          Live
        </span>
      </div>

      {/* Totals */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-purple-500/20 bg-white/5 p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{state.totals.totalRemaining}</div>
          <div className="mt-0.5 text-xs text-purple-200">Total left</div>
        </div>
        <div className="rounded-lg border border-purple-500/20 bg-white/5 p-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{state.totals.standardRemaining}</div>
          <div className="mt-0.5 text-xs text-purple-200">Standard</div>
        </div>
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums text-amber-300">
            <Crown className="size-4" aria-hidden="true" />
            {state.totals.vipRemaining}
          </div>
          <div className="mt-0.5 text-xs text-purple-200">VIP</div>
        </div>
      </div>

      {/* Grouped prize values */}
      {visibleItems.length > 0 ? (
        <ul className="mt-4 divide-y divide-purple-500/10">
          {visibleItems.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 font-medium">
                {it.type === "vip" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-300">
                    <Crown className="size-3" aria-hidden="true" />
                    VIP
                  </span>
                )}
                <span>{formatGBP(it.amountPence)}</span>
              </span>
              <span className="shrink-0 tabular-nums text-purple-200">
                {it.remaining} left
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-center text-sm text-purple-200">All prizes have been popped!</p>
      )}

      <p className="mt-4 text-center text-xs text-purple-300/70">Updates automatically during the live</p>
    </section>
  )
}
