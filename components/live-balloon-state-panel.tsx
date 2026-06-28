"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PartyPopper } from "lucide-react"

/**
 * Safe aggregate shape returned by GET /api/giveaways/[slug]/live-balloon-state.
 * Only non-sensitive fields are kept here — no winning tickets, no customer
 * names, no checkout IDs.
 */
interface BalloonState {
  remainingStandardBalloons: number
  remainingVipBalloons: number
  totalRemainingBalloons: number
  lastClaimedPrizeTitle: string | null
  lastClaimedBalloonType: "STANDARD" | "VIP" | null
  lastClaimedAt: string | null
  updatedAt: string
}

interface LiveBalloonStatePanelProps {
  slug: string
  status: string
  /** Optional initial values from the snapshot, if cleanly available. */
  initial?: Partial<BalloonState> | null
}

type ConnState = "connecting" | "live" | "paused"

// Poll every 10s. Combined with the endpoint's short CDN cache
// (s-maxage=3, stale-while-revalidate=5), this keeps origin/database
// pressure low even during high-traffic live events.
const POLL_MS = 10000

function buildInitial(initial?: Partial<BalloonState> | null): BalloonState | null {
  if (
    initial &&
    typeof initial.totalRemainingBalloons === "number" &&
    typeof initial.remainingStandardBalloons === "number" &&
    typeof initial.remainingVipBalloons === "number"
  ) {
    return {
      remainingStandardBalloons: initial.remainingStandardBalloons,
      remainingVipBalloons: initial.remainingVipBalloons,
      totalRemainingBalloons: initial.totalRemainingBalloons,
      lastClaimedPrizeTitle: initial.lastClaimedPrizeTitle ?? null,
      lastClaimedBalloonType: initial.lastClaimedBalloonType ?? null,
      lastClaimedAt: initial.lastClaimedAt ?? null,
      updatedAt: initial.updatedAt ?? new Date().toISOString(),
    }
  }
  return null
}

function formatUpdated(iso: string | null): string {
  if (!iso) return ""
  const diffMs = Date.now() - new Date(iso).getTime()
  const s = Math.max(0, Math.round(diffMs / 1000))
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return `${m}m ago`
}

export function LiveBalloonStatePanel({ slug, status, initial }: LiveBalloonStatePanelProps) {
  const [data, setData] = useState<BalloonState | null>(() => buildInitial(initial))
  const [conn, setConn] = useState<ConnState>(() => (buildInitial(initial) ? "live" : "connecting"))
  const [decreased, setDecreased] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevTotalRef = useRef<number | null>(null)
  const decreaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchState = useCallback(async () => {
    // Cancel any in-flight request before starting a new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // No `cache: "no-store"` here on purpose — the endpoint's response
      // headers (short CDN s-maxage + stale-while-revalidate) control caching.
      const res = await fetch(`/api/giveaways/${encodeURIComponent(slug)}/live-balloon-state`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const json = await res.json()
      if (!json?.ok) throw new Error("response not ok")

      const next: BalloonState = {
        remainingStandardBalloons: Number(json.remainingStandardBalloons ?? 0),
        remainingVipBalloons: Number(json.remainingVipBalloons ?? 0),
        totalRemainingBalloons: Number(json.totalRemainingBalloons ?? 0),
        lastClaimedPrizeTitle: json.lastClaimedPrizeTitle ?? null,
        lastClaimedBalloonType: json.lastClaimedBalloonType ?? null,
        lastClaimedAt: json.lastClaimedAt ?? null,
        updatedAt: json.updatedAt ?? new Date().toISOString(),
      }

      // Subtle highlight when the total drops (a balloon was popped).
      if (prevTotalRef.current != null && next.totalRemainingBalloons < prevTotalRef.current) {
        setDecreased(true)
        if (decreaseTimerRef.current) clearTimeout(decreaseTimerRef.current)
        decreaseTimerRef.current = setTimeout(() => setDecreased(false), 1200)
      }
      prevTotalRef.current = next.totalRemainingBalloons

      setData(next)
      setConn("live")
    } catch (err) {
      // Ignore deliberate aborts (new fetch / cleanup / tab hidden).
      if (err instanceof DOMException && err.name === "AbortError") return
      // Keep the last successful values; only soften the status text.
      setConn("paused")
    }
  }, [slug])

  useEffect(() => {
    // Only poll for live campaigns.
    if (status !== "live") return

    const startInterval = () => {
      if (intervalRef.current) return // never create duplicate intervals
      intervalRef.current = setInterval(() => {
        if (!document.hidden) fetchState()
      }, POLL_MS)
    }

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        // Pause polling and cancel any in-flight request while hidden.
        stopInterval()
        abortRef.current?.abort()
      } else {
        // Resume: immediately refetch, then restart the interval.
        fetchState()
        startInterval()
      }
    }

    if (!document.hidden) {
      fetchState()
      startInterval()
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      stopInterval()
      abortRef.current?.abort()
      if (decreaseTimerRef.current) clearTimeout(decreaseTimerRef.current)
    }
  }, [status, fetchState])

  const connecting = data === null

  return (
    <section
      aria-label="Live balloons remaining"
      className={`rounded-xl border bg-white/5 p-4 backdrop-blur-sm transition-shadow duration-500 ${
        decreased ? "border-pink-400/60 shadow-[0_0_18px_rgba(255,0,200,0.35)]" : "border-purple-500/20"
      }`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PartyPopper className="size-5 text-pink-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-white">Balloons left</h2>
        </div>
        <StatusBadge conn={conn} />
      </header>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Standard" value={data?.remainingStandardBalloons} loading={connecting} />
        <Stat label="VIP" value={data?.remainingVipBalloons} loading={connecting} accent />
        <Stat label="Total" value={data?.totalRemainingBalloons} loading={connecting} strong />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-purple-200">
        <span className="min-w-0 truncate">
          {data?.lastClaimedPrizeTitle ? (
            <>
              Last popped: <span className="font-medium text-white">{data.lastClaimedPrizeTitle}</span>
              {data.lastClaimedBalloonType === "VIP" && (
                <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                  VIP
                </span>
              )}
            </>
          ) : (
            <span className="text-purple-300">No balloons popped yet</span>
          )}
        </span>
        <span className="shrink-0 tabular-nums">
          {connecting ? "Connecting…" : `Updated ${formatUpdated(data?.updatedAt ?? null)}`}
        </span>
      </div>
    </section>
  )
}

function StatusBadge({ conn }: { conn: ConnState }) {
  if (conn === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_0_12px_rgba(255,0,0,0.5)]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Live
      </span>
    )
  }

  // Connecting or temporarily paused: calm, non-alarming text.
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-purple-100">
      <span className="h-2 w-2 rounded-full bg-purple-300/70" />
      {conn === "connecting" ? "Connecting…" : "Updating…"}
    </span>
  )
}

function Stat({
  label,
  value,
  loading,
  accent,
  strong,
}: {
  label: string
  value?: number
  loading: boolean
  accent?: boolean
  strong?: boolean
}) {
  return (
    <div className="rounded-lg border border-purple-500/20 bg-white/5 px-2 py-2.5 text-center">
      <div
        className={`tabular-nums leading-none ${strong ? "text-2xl font-extrabold" : "text-xl font-bold"} ${
          accent ? "text-amber-300" : "text-white"
        }`}
      >
        {loading || typeof value !== "number" ? "—" : value}
      </div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-purple-200">{label}</div>
    </div>
  )
}
