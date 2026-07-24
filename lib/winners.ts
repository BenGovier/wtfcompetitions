import type { WinnerSnapshot } from "@/lib/types"

/**
 * Shared winners feed configuration and prize-classification helpers.
 *
 * IMPORTANT: prize classification is driven ONLY by the `fulfilmentType` field
 * supplied by the existing `winners_feed` response. We never infer the prize
 * type from whether a title contains a "£" symbol, and we never replace a real
 * prize title with a campaign-format label such as "Balloon Pop".
 */

// Matches the filters used by the initial server load so pagination stays consistent.
export const WINNERS_KIND = "instant" as const
export const WINNERS_CUTOFF = "2026-03-20T00:00:00+00:00"

// Bounded page sizes. The initial request loads the featured winners plus one
// grid page; each "Load more" click loads one further bounded grid page.
export const FEATURED_COUNT = 4
export const GRID_PAGE_SIZE = 24

export type FulfilmentType = "cash" | "wallet_credit" | "manual"
export type FulfilmentCategory = "cash" | "wallet_credit" | "other"

/** Public fallback used whenever a usable first name cannot be derived. */
export const WINNER_FALLBACK_NAME = "Verified winner"

/**
 * Reduce any supplied display name to a privacy-safe FIRST NAME ONLY.
 *
 * This is the single guard that stops a winner's surname from ever being
 * serialised to the browser or rendered on the public winners page. It only
 * ever sees the name string — it never derives a name from an email, user id,
 * or any other field.
 *
 * Behaviour:
 *  - non-string / empty / whitespace / invalid  -> "Verified winner"
 *  - "Ben Govier"        -> "Ben"
 *  - "  Grace   Quigley" -> "Grace"
 *  - "Naomi H"           -> "Naomi"
 *  - "Anne-Marie Smith"  -> "Anne-Marie"   (internal punctuation preserved)
 *  - "O’Neil Jones"      -> "O’Neil"       (curly + straight apostrophes kept)
 *  - "Pamela"            -> "Pamela"
 *  - bounded to 24 Unicode code points; Unicode-safe (no ASCII-only assumptions)
 */
export function formatWinnerFirstName(displayName: unknown): string {
  if (typeof displayName !== "string") return WINNER_FALLBACK_NAME

  // Trim, then collapse repeated internal whitespace to a single space.
  const normalised = displayName.trim().replace(/\s+/g, " ")
  if (normalised.length === 0) return WINNER_FALLBACK_NAME

  // Take only the first whitespace-separated token (drops the surname).
  const firstToken = normalised.split(" ")[0] ?? ""

  // Remove trailing separator punctuation (comma, full stop, colon, semicolon)
  // while preserving internal punctuation such as hyphens and apostrophes.
  const cleaned = firstToken.replace(/[.,:;]+$/u, "")
  if (cleaned.trim().length === 0) return WINNER_FALLBACK_NAME

  // Enforce a maximum visible length using Unicode code points, not UTF-16 units.
  const chars = Array.from(cleaned)
  const bounded = chars.length > 24 ? chars.slice(0, 24).join("") : cleaned
  if (bounded.trim().length === 0) return WINNER_FALLBACK_NAME

  return bounded
}

/**
 * Defensively map a raw `winners_feed` row to a WinnerSnapshot.
 * Optional fields are only populated when the response already supplies a
 * recognised value with the correct type; otherwise they are null/undefined.
 * No values are invented.
 */
export function mapWinnerRow(row: any): WinnerSnapshot {
  const fulfilmentRaw = row?.fulfilment_type
  const fulfilmentType: FulfilmentType | null =
    fulfilmentRaw === "cash" || fulfilmentRaw === "wallet_credit" || fulfilmentRaw === "manual"
      ? fulfilmentRaw
      : null

  const prizeValuePence =
    typeof row?.prize_value_pence === "number" && Number.isFinite(row.prize_value_pence)
      ? row.prize_value_pence
      : null

  const prizeValueText =
    typeof row?.prize_value_text === "string" && row.prize_value_text.trim().length > 0
      ? row.prize_value_text.trim()
      : null

  const winningTicket =
    typeof row?.winning_ticket === "number" && Number.isFinite(row.winning_ticket)
      ? row.winning_ticket
      : null

  const campaignFormat =
    typeof row?.campaign_format === "string" && row.campaign_format.trim().length > 0
      ? row.campaign_format.trim()
      : null

  const avatarUrl =
    typeof row?.avatar_url === "string" && row.avatar_url.trim().length > 0 ? row.avatar_url.trim() : undefined

  return {
    name: formatWinnerFirstName(row?.display_name),
    prizeTitle: row?.prize_title || "Prize",
    giveawayTitle: row?.campaign_title || "",
    giveawaySlug: row?.campaign_slug || undefined,
    announcedAt: row?.happened_at || new Date().toISOString(),
    kind: row?.kind === "main" ? "main" : "instant",
    fulfilmentType,
    prizeValuePence,
    prizeValueText,
    winningTicket,
    campaignFormat,
    avatarUrl,
  }
}

/** Format a pence amount as GBP, trimming a trailing ".00". */
export function formatGBP(pence: number): string {
  const value = pence / 100
  return `£${value.toFixed(2).replace(/\.00$/, "")}`
}

/**
 * A valid formatted prize amount when one is supplied, otherwise null.
 * Prefers a numeric pence value; falls back to a supplied text value.
 */
export function formatPrizeAmount(w: WinnerSnapshot): string | null {
  if (typeof w.prizeValuePence === "number" && Number.isFinite(w.prizeValuePence) && w.prizeValuePence > 0) {
    return formatGBP(w.prizeValuePence)
  }
  if (w.prizeValueText && w.prizeValueText.trim().length > 0) {
    return w.prizeValueText.trim()
  }
  return null
}

/** Broad category used for filtering and styling. Unknown/manual → "other". */
export function classifyFulfilment(w: WinnerSnapshot): FulfilmentCategory {
  if (w.fulfilmentType === "cash") return "cash"
  if (w.fulfilmentType === "wallet_credit") return "wallet_credit"
  return "other"
}

/**
 * The main (largest) prize label.
 * Fallback order: valid formatted amount → real prizeTitle → "Prize".
 */
export function getPrizeDisplayTitle(w: WinnerSnapshot): string {
  const amount = formatPrizeAmount(w)

  if (w.fulfilmentType === "wallet_credit") {
    return amount ? `${amount} WTF Credit` : realTitleOrFallback(w)
  }
  if (w.fulfilmentType === "cash") {
    return amount ?? realTitleOrFallback(w)
  }
  // manual / unknown / missing → never guess; show the real title.
  return realTitleOrFallback(w)
}

function realTitleOrFallback(w: WinnerSnapshot): string {
  return w.prizeTitle && w.prizeTitle.trim().length > 0 ? w.prizeTitle.trim() : "Prize"
}

/** The neutral, human-readable fulfilment badge. */
export function getFulfilmentBadge(w: WinnerSnapshot): { label: string; category: FulfilmentCategory } {
  const category = classifyFulfilment(w)
  if (category === "wallet_credit") return { label: "WTF Credit", category }
  if (category === "cash") return { label: "Cash Prize", category }
  return { label: "Prize", category }
}

/** A stable, deterministic key used to de-duplicate rows across pages. */
export function winnerKey(w: WinnerSnapshot): string {
  return `${w.announcedAt}|${w.name}|${w.prizeTitle}`
}
