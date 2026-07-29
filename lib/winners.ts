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

/**
 * Minimum numeric prize value (in pence) shown on the PUBLIC winners page.
 *
 * Enforced as a `>= 2000` predicate on `prize_value_pence` at the QUERY layer
 * in both the initial server load and the `/api/winners` route, applied before
 * ordering / limiting / the peek row / hasMore / nextCursor. Because SQL
 * comparisons against NULL evaluate to false, rows with a missing numeric value
 * fail closed and are excluded — we never infer a value from titles or text.
 */
export const MIN_PUBLIC_PRIZE_PENCE = 2000

/**
 * Approved Balloon competition campaign slugs.
 *
 * Confirmed balloon campaigns currently use MIXED `presentation_type` /
 * `reveal_type` values (some `balloon_pop`, some `instant_cash`), so those
 * columns cannot be trusted to detect balloons — and campaign TITLES must never
 * be used either. This explicit slug allow-list is the single source of truth
 * for balloon eligibility. Slug casing is exact and MUST be preserved (PostgREST
 * `in.(...)` matching is case-sensitive).
 */
export const BALLOON_WINNER_CAMPAIGN_SLUGS = [
  "salli3",
  "rosslizzy",
  "Salli2",
  "Salli",
  "ch8june",
  "grandballoon",
] as const

/**
 * The SINGLE shared PostgREST eligibility filter used by BOTH the initial server
 * load and the `/api/winners` route, so their rules can never drift.
 *
 * A winner is eligible when EITHER:
 *   1. `prize_value_pence >= 2000` (a proven, meaningful numeric value), OR
 *   2. `campaign_slug` is in the approved balloon list (any value, incl. NULL
 *      numeric value — balloon eligibility is proven by the slug itself).
 *
 * Non-balloon rows with a NULL numeric value fail branch 1 (NULL comparisons are
 * false) and are not in branch 2, so they remain excluded (fail-closed). Applied
 * BEFORE order/limit/peek so featured, grid, hasMore and the cursor all derive
 * from the eligible set. The slugs are plain alphanumerics, so no PostgREST
 * quoting/escaping is required inside `in.(...)`.
 */
export function winnersEligibilityOrFilter(): string {
  const slugList = BALLOON_WINNER_CAMPAIGN_SLUGS.join(",")
  return `prize_value_pence.gte.${MIN_PUBLIC_PRIZE_PENCE},campaign_slug.in.(${slugList})`
}

/**
 * Client-safe mirror of the query eligibility rule, used ONLY by the mock
 * fallback (never for live rows, which are filtered at the query layer). Keeps
 * the fallback from surfacing an ineligible winner.
 */
export function isWinnerEligible(w: WinnerSnapshot): boolean {
  const meetsValue =
    typeof w.prizeValuePence === "number" &&
    Number.isFinite(w.prizeValuePence) &&
    w.prizeValuePence >= MIN_PUBLIC_PRIZE_PENCE
  const isBalloon =
    typeof w.giveawaySlug === "string" &&
    (BALLOON_WINNER_CAMPAIGN_SLUGS as readonly string[]).includes(w.giveawaySlug)
  return meetsValue || isBalloon
}

/**
 * Explicit allow-list of PUBLIC columns selected from `winners_feed`.
 *
 * This is a hard privacy boundary at the QUERY layer: sensitive columns
 * (`winning_ticket`, `user_id`) are never fetched, so they can never appear in
 * the raw Supabase result envelope that Next.js serialises into the RSC/HTML
 * payload, nor in the `/api/winners` JSON. `happened_at` is the ordering /
 * cursor key and is safe. Only columns that actually exist on the view are
 * listed (verified against the live row shape) and every column here is read by
 * `mapWinnerRow` — keep the two in sync.
 */
export const PUBLIC_WINNER_COLUMNS =
  "kind, happened_at, display_name, prize_title, campaign_title, campaign_slug, fulfilment_type, prize_value_pence, prize_value_text"
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
 *
 * Private / machine-generated inputs are rejected outright (return the
 * fallback) so they can never be split into a "first name":
 *  - email addresses  ("ben@example.com")
 *  - URLs             ("https://example.com/ben", "www.example.com")
 *  - UUIDs            ("cd40948f-44f5-499e-bdd3-213e11ba07fe")
 * These checks are narrow and explicit; legitimate names containing an
 * apostrophe, hyphen or full stop (e.g. "Anne-Marie", "O’Neil", "Dr. Smith")
 * are NOT rejected.
 */
// Contains an "@" between non-space characters -> email address.
const EMAIL_LIKE = /\S@\S/u
// Explicit URL scheme or a leading "www." host -> URL.
const URL_LIKE = /^(?:https?:\/\/|www\.)/iu
// Canonical 8-4-4-4-12 hexadecimal UUID.
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
// A human first name: starts with a Unicode letter, followed only by Unicode
// letters, combining marks, internal apostrophes (' or ’) or hyphens. This
// rejects usernames/handles/numbers (e.g. "ben123", "@ben", "user/name",
// "07400123456") while preserving accents and names like "Anne-Marie" or "O’Neil".
const HUMAN_NAME = /^\p{L}[\p{L}\p{M}'’-]*$/u

export function formatWinnerFirstName(displayName: unknown): string {
  if (typeof displayName !== "string") return WINNER_FALLBACK_NAME

  // Trim, then collapse repeated internal whitespace to a single space.
  const normalised = displayName.trim().replace(/\s+/g, " ")
  if (normalised.length === 0) return WINNER_FALLBACK_NAME

  // Reject private / machine-generated values before any token extraction, so
  // an email/URL/UUID can never leak through as a "first name".
  if (EMAIL_LIKE.test(normalised) || URL_LIKE.test(normalised) || UUID_LIKE.test(normalised)) {
    return WINNER_FALLBACK_NAME
  }

  // Take only the first whitespace-separated token (drops the surname).
  const firstToken = normalised.split(" ")[0] ?? ""

  // Remove trailing separator punctuation (comma, full stop, colon, semicolon)
  // while preserving internal punctuation such as hyphens and apostrophes.
  const cleaned = firstToken.replace(/[.,:;]+$/u, "")
  if (cleaned.trim().length === 0) return WINNER_FALLBACK_NAME

  // Final shape check: the cleaned token must look like a human first name.
  // Rejects handles/usernames/numbers/paths that survived earlier steps.
  if (!HUMAN_NAME.test(cleaned)) return WINNER_FALLBACK_NAME

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
    campaignFormat,
    avatarUrl,
  }
}

/** Format a pence amount as GBP with thousands grouping, trimming ".00". */
export function formatGBP(pence: number): string {
  const value = pence / 100
  const formatted = value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `£${formatted.replace(/\.00$/, "")}`
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
