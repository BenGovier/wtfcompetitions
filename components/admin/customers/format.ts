/**
 * Small, shared presentation helpers for the admin Customers area.
 *
 * These are pure formatting utilities (money in pence -> GBP, ISO timestamps ->
 * localised strings). They contain no business logic and never mutate data.
 */

/** £x.xx from an integer number of pence. */
export function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Short date, e.g. "8 Aug 2026". Returns "—" for missing/invalid input. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/** Date + time, e.g. "8 Aug 2026, 14:30". Returns "—" for missing/invalid input. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Renders an allocated ticket range as a compact label:
 *  - single ticket:  "17996"
 *  - range:          "14984–14989"
 *  - unknown:        "—"
 * Never expands the range into individual numbers.
 */
export function formatTicketRange(start: number | null, end: number | null): string {
  if (start === null && end === null) return "—"
  if (start !== null && end !== null) {
    return start === end ? `${start}` : `${start}–${end}`
  }
  const only = start ?? end
  return only === null ? "—" : `${only}`
}
