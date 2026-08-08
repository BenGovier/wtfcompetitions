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

/** The fields any customer-shaped record may expose for name resolution. */
export type CustomerNameParts = {
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  real_name?: string | null
  email?: string | null
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * THE single source of truth for a customer's primary display name.
 *
 * Priority (per spec):
 *   1. first_name + last_name
 *   2. first_name
 *   3. last_name
 *   4. display_name
 *   5. real_name          (often username-style noise, so it ranks low)
 *   6. email local-part
 *   7. "Unknown customer"
 *
 * Genuine supplied names always win over `display_name` nicknames and
 * `real_name` handles. Used by BOTH the list and the detail view — never
 * duplicate this logic.
 */
export function resolveCustomerName(parts: CustomerNameParts): string {
  const first = clean(parts.first_name)
  const last = clean(parts.last_name)
  if (first && last) return `${first} ${last}`
  if (first) return first
  if (last) return last

  const display = clean(parts.display_name)
  if (display) return display

  const real = clean(parts.real_name)
  if (real) return real

  const email = clean(parts.email)
  if (email && email.includes("@")) {
    const local = email.split("@")[0]
    if (local) return local
  }

  return "Unknown customer"
}

/**
 * A secondary handle (real_name / display_name) is only worth showing beneath
 * the primary name when it adds information and is NOT username-style noise.
 *
 * "Noise" = handles like `elliemaythom2709`, `absfactor`, `kyemakd9`: no
 * whitespace and containing a digit, or an email-local shape. These clutter the
 * list, so we omit them entirely rather than print them under every row.
 */
export function isLikelyHandleNoise(value: string | null | undefined): boolean {
  const v = clean(value)
  if (!v) return true
  if (v.includes("@")) return true // email-ish
  const hasSpace = /\s/.test(v)
  const hasDigit = /\d/.test(v)
  // A single lowercase token with digits (or one long lowercase token) reads as
  // a username, not a person's name.
  if (!hasSpace && hasDigit) return true
  if (!hasSpace && v === v.toLowerCase() && v.length > 3) return true
  return false
}

/**
 * The optional secondary line for a customer row. Returns a non-noise handle
 * that differs from the already-shown primary name, else null (omit the line).
 */
export function resolveSecondaryHandle(parts: CustomerNameParts, primary: string): string | null {
  const candidates = [clean(parts.display_name), clean(parts.real_name)]
  for (const candidate of candidates) {
    if (!candidate) continue
    if (candidate === primary) continue
    if (isLikelyHandleNoise(candidate)) continue
    return candidate
  }
  return null
}

/**
 * DISPLAY-ONLY formatting of a stored UK mobile number for readability.
 * Never mutates or persists anything.
 *   07786144708  -> "07786 144708"
 * Anything that is not a plain 11-digit 07xxxxxxxxx number is returned
 * unchanged (international / unusual formats stay verbatim and safe).
 */
export function formatUkMobile(raw: string | null | undefined): string {
  const v = clean(raw)
  if (!v) return ""
  const digits = v.replace(/\s+/g, "")
  if (/^07\d{9}$/.test(digits)) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`
  }
  return v
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
