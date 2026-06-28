"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

interface FeedItem {
  id: string
  createdAt: string
  displayName: string | null
  prizeTitle: string
}

const POLL_MS = 10000

function formatExactTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatRelativeTime(dateString: string): string {
  const diffSeconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
  return `${Math.floor(diffSeconds / 86400)}d ago`
}

export function CampaignActivityFeed({ campaignId }: { campaignId: string }) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchFeed() {
      try {
        const res = await fetch(`/api/admin/live-feed/${encodeURIComponent(campaignId)}`)
        const data = await res.json()
        if (!mounted) return
        if (data.ok) {
          setItems(data.items)
          setError(null)
        } else {
          setError(data.error || "Failed to load feed")
        }
      } catch {
        if (mounted) setError("Network error")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchFeed()
    // Single interval, admin/host page only. Cleaned up on unmount.
    const interval = setInterval(fetchFeed, POLL_MS)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [campaignId])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="h-5 w-5 rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/4 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-muted-foreground">Unable to load activity: {error}</div>
  }

  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">No instant wins yet for this campaign.</div>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">
              {formatExactTime(item.createdAt)} {"\u00B7"} {formatRelativeTime(item.createdAt)}
            </p>
            <p className="text-sm">
              <span className="font-medium">{item.displayName || "Player"}</span> won{" "}
              <span className="font-medium text-amber-600 dark:text-amber-400">{item.prizeTitle}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
