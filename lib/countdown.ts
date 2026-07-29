// Pure, framework-agnostic countdown formatting shared by the server
// (initial render) and the client DeadlineBadge (live updates). Keeping this
// deterministic and free of `Date.now()` lets the caller pass an explicit
// `nowMs`, which is what makes the badge hydration-safe.

export type CountdownTone = "ended" | "urgent" | "soon" | "normal"

export interface CountdownDisplay {
  /** Human label, e.g. "12D 04H 31M", "04H 31M 22S", or "ENDED". */
  label: string
  tone: CountdownTone
  /** True when under 24h remaining — signals the caller to tick per second. */
  sub24: boolean
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/**
 * Format the time between `nowMs` and `endsAtMs`.
 *  - <= 0 or invalid         -> "ENDED"
 *  - < 24h                   -> "04H 31M 22S" (urgent, per-second)
 *  - < 48h                   -> "01D 04H 31M" (soon)
 *  - otherwise               -> "12D 04H 31M" (normal)
 */
export function computeCountdown(endsAtMs: number, nowMs: number): CountdownDisplay {
  const diff = endsAtMs - nowMs
  if (!Number.isFinite(endsAtMs) || diff <= 0) {
    return { label: "ENDED", tone: "ended", sub24: false }
  }

  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (diff < DAY) {
    return { label: `${pad(hours)}H ${pad(minutes)}M ${pad(seconds)}S`, tone: "urgent", sub24: true }
  }

  const tone: CountdownTone = diff < 2 * DAY ? "soon" : "normal"
  return { label: `${pad(days)}D ${pad(hours)}H ${pad(minutes)}M`, tone, sub24: false }
}
