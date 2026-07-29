"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { computeCountdown, type CountdownDisplay, type CountdownTone } from "@/lib/countdown"

interface DeadlineBadgeProps {
  /** Absolute end time in epoch milliseconds. */
  endsAtMs: number
  /**
   * Server-computed initial label/tone. Rendered verbatim on the server AND on
   * the first client render, guaranteeing identical markup (no hydration
   * mismatch). The live value only takes over inside useEffect after mount.
   */
  initialLabel: string
  initialTone: CountdownTone
  className?: string
}

// Opaque, high-contrast backgrounds so the badge never depends on the artwork
// behind it. Uses the WTF dark-purple / gold / red language.
const TONE_CLASSES: Record<CountdownTone, string> = {
  ended: "bg-neutral-900 text-white/85",
  urgent: "bg-red-600 text-white",
  soon: "bg-amber-500 text-black",
  normal: "bg-[#1a0533] text-white ring-1 ring-inset ring-amber-400/30",
}

export function DeadlineBadge({ endsAtMs, initialLabel, initialTone, className }: DeadlineBadgeProps) {
  // Initialise from the server-provided props only (deterministic → SSR-safe).
  const [display, setDisplay] = useState<CountdownDisplay>({
    label: initialLabel,
    tone: initialTone,
    sub24: false,
  })

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined

    const tick = () => {
      const next = computeCountdown(endsAtMs, Date.now())
      setDisplay(next)
      // Stop scheduling once ended; otherwise tick per-second under 24h and
      // per-minute when further away to avoid needless re-renders.
      if (next.tone === "ended") return
      timerId = setTimeout(tick, next.sub24 ? 1000 : 60_000)
    }

    tick()
    return () => {
      if (timerId) clearTimeout(timerId)
    }
  }, [endsAtMs])

  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide leading-none shadow-md tabular-nums md:text-xs " +
        TONE_CLASSES[display.tone] +
        (className ? " " + className : "")
      }
    >
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {/* No aria-live: the value is readable when encountered but is not
          announced on every tick. */}
      <span className="sr-only">Time remaining: </span>
      {display.label}
    </span>
  )
}
