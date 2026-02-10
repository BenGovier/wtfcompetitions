"use client"

import { X } from "lucide-react"
import { useState } from "react"

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="relative bg-brand px-4 py-2 text-center text-sm font-medium text-white">
      <p>
        🎉 New Giveaway: Win a MacBook Pro M3 Max! <span className="underline">Enter now</span>
      </p>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        aria-label="Dismiss announcement"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
