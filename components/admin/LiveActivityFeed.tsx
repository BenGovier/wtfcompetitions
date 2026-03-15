"use client"

import { useEffect, useState } from "react"

interface FeedItem {
  id: string
  qty: number
  created_at: string
  campaign_title: string
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffSeconds = Math.floor((now - then) / 1000)

  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
  return `${Math.floor(diffSeconds / 86400)}d ago`
}

export function LiveActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchFeed() {
      try {
        const res = await fetch("/api/admin/live-feed")
        const data = await res.json()

        if (!mounted) return

        if (data.ok) {
          setItems(data.items)
          setError(null)
        } else {
          setError(data.error || "Failed to load feed")
        }
      } catch (err) {
        if (mounted) {
          setError("Network error")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchFeed()

    const interval = setInterval(fetchFeed, 3000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
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
    return (
      <div className="text-sm text-muted-foreground">
        Unable to load activity: {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No recent activity
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3">
          <span className="text-base" aria-hidden="true">🎟</span>
          <div className="flex-1 space-y-1">
            <p className="text-sm">
              {item.qty} {item.qty === 1 ? "entry" : "entries"} — {item.campaign_title}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(item.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
