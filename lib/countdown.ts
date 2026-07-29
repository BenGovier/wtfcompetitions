// Pure, framework-agnostic deadline formatting shared by the giveaway cards.
// Produces concise, human-readable wording (never a long live countdown):
//   "Ended", "Ends Today", "Ends Tomorrow", "Ends in 6 days".
// Keeping it deterministic and free of `Date.now()` lets callers pass an
// explicit `nowMs` when they need to.

export interface DeadlineDisplay {
  /** Human label, e.g. "Ends in 6 days", "Ends Tomorrow", or "Ended". */
  label: string
  /** True when the giveaway has finished. */
  ended: boolean
}

// Calendar day (Y-M-D) for a timestamp evaluated in Europe/London.
function londonYMD(ms: number): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get("year"), m: get("month"), d: get("day") }
}

// Whole-calendar-day difference (end - now) using Europe/London dates.
function londonCalendarDayDiff(nowMs: number, endMs: number): number {
  const a = londonYMD(nowMs)
  const b = londonYMD(endMs)
  const aUTC = Date.UTC(a.y, a.m - 1, a.d)
  const bUTC = Date.UTC(b.y, b.m - 1, b.d)
  return Math.round((bUTC - aUTC) / (1000 * 60 * 60 * 24))
}

/**
 * Concise deadline wording.
 *  - invalid / <= now  -> "Ended"
 *  - same calendar day  -> "Ends Today"
 *  - next calendar day  -> "Ends Tomorrow"
 *  - otherwise          -> "Ends in N days"
 */
export function deadlineLabel(endsAtMs: number, nowMs: number): DeadlineDisplay {
  if (!Number.isFinite(endsAtMs) || endsAtMs - nowMs <= 0) {
    return { label: "Ended", ended: true }
  }
  const days = londonCalendarDayDiff(nowMs, endsAtMs)
  if (days <= 0) return { label: "Ends Today", ended: false }
  if (days === 1) return { label: "Ends Tomorrow", ended: false }
  return { label: `Ends in ${days} days`, ended: false }
}
