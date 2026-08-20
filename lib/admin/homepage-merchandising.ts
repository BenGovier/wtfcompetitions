import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { classifyGiveaway, type GiveawayCategory } from '@/lib/giveaway-classification'
import {
  HOMEPAGE_RAILS,
  isManualRail,
  isValidRail,
  type HomepageRail,
  type MerchandisingItem,
} from '@/lib/admin/homepage-rails'

/**
 * Server-side data layer for the /admin/homepage merchandising screen.
 *
 * This module is the SINGLE read path for the admin merchandising UI. A whole
 * page load performs exactly TWO Supabase queries (run in parallel):
 *   1. eligible live `list` giveaway snapshots
 *   2. all rows from `campaign_homepage_placements`
 * Everything else (rail membership, ordering, the Add-picker source) is derived
 * in memory. There is NO query-per-rail and NO per-campaign detail fetch.
 *
 * It NEVER writes. It NEVER deletes stale placement rows. A placement row that
 * points at an ended/removed campaign is simply skipped when building a rail
 * (the campaign is absent from the eligible set), so the screen cannot crash on
 * stale data and never silently mutates the table on read.
 *
 * Membership semantics:
 *   - Derived rails (balloon_pop, instant_cash): membership comes ONLY from the
 *     shared `classifyGiveaway` classifier — the exact same source of truth the
 *     public homepage uses. A placement row for these rails is ORDERING ONLY and
 *     can never turn a campaign into a Balloon Pop / Instant Win.
 *   - Manual rails (featured, games, cash, luxury): membership IS the placement
 *     row. A campaign appears only if it has a row for that rail (and is still
 *     eligible).
 *
 * Client-safe constants/types/validators (HOMEPAGE_RAILS, isValidRail, etc.)
 * live in `./homepage-rails` and are re-exported here so existing server-side
 * importers keep working.
 */

export {
  HOMEPAGE_RAILS,
  MANUAL_RAILS,
  DERIVED_RAILS,
  isValidRail,
  isManualRail,
  isUuid,
  type HomepageRail,
  type MerchandisingItem,
} from '@/lib/admin/homepage-rails'

/** Maps each derived rail to the shared classifier category that defines it. */
const DERIVED_RAIL_CATEGORY: Record<'balloon_pop' | 'instant_cash', GiveawayCategory> = {
  balloon_pop: 'live_balloon',
  instant_cash: 'instant_cash',
}

export interface HomepageMerchandisingData {
  /** The six rails, each already ordered exactly as the homepage will render them. */
  rails: Record<HomepageRail, MerchandisingItem[]>
  /** All eligible live competitions — the source for the manual-rail Add picker. */
  eligible: MerchandisingItem[]
}

/** One competition inside an ordered rail, plus whether it has a placement row. */
export interface RailEntry {
  payload: any
  positioned: boolean
}

/** The six rails as ordered FULL snapshot payloads — the shared shape the admin
 *  screen and the public homepage both build from (so ordering cannot drift). */
export type RailPayloads = Record<HomepageRail, RailEntry[]>

type PlacementRow = { campaign_id: string; rail: string; position: number }

/** Percentage sold from snapshot fields only (mirrors the public sort). */
function percentSold(payload: any): number {
  const sold = Number(payload?.tickets_sold ?? 0)
  const cap = Number(payload?.hard_cap_total_tickets ?? 0)
  return cap > 0 ? Math.min(100, (sold / cap) * 100) : 0
}

/** ms of `ends_at`, or +Infinity when missing/invalid (sorted last). */
function endMs(payload: any): number {
  if (!payload?.ends_at) return Number.POSITIVE_INFINITY
  const t = new Date(payload.ends_at).getTime()
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

/** Stable ascending compare on campaign id (final deterministic tie-break). */
function byIdAsc(a: any, b: any): number {
  const ida = String(a?.id ?? '')
  const idb = String(b?.id ?? '')
  return ida < idb ? -1 : ida > idb ? 1 : 0
}

/**
 * Fallback ordering for UNPOSITIONED derived-rail members:
 *   ends_at ASC (missing last) → percent sold DESC → campaign_id ASC.
 * This matches the public sort and adds the explicit id tie-break the admin
 * display and future homepage both require.
 */
function fallbackCompare(a: any, b: any): number {
  const ea = endMs(a)
  const eb = endMs(b)
  if (ea !== eb) return ea - eb
  const pa = percentSold(a)
  const pb = percentSold(b)
  if (pa !== pb) return pb - pa
  return byIdAsc(a, b)
}

function toItem(payload: any, positioned: boolean): MerchandisingItem {
  return {
    id: String(payload.id),
    title: payload.title ?? '',
    slug: payload.slug ?? null,
    presentation_type: payload.presentation_type ?? null,
    ends_at: payload.ends_at ?? null,
    hero_image_url: payload.hero_image_url ?? null,
    category: classifyGiveaway(payload),
    positioned,
  }
}

/**
 * Eligibility filter — identical rules to the public homepage (app/page.tsx):
 * live raffles only, excluding ended/sold_out/closed and past `ends_at`.
 */
export function filterEligiblePayloads(rawRows: any[] | null | undefined, now: number): any[] {
  return (rawRows ?? [])
    .map((x: any) => x.payload)
    .filter((g: any) => {
      if (!g || g.status === 'ended' || g.status === 'sold_out' || g.status === 'closed') return false
      if (g.status !== 'live') return false
      if (g.ends_at) {
        const t = new Date(g.ends_at).getTime()
        if (Number.isFinite(t) && t <= now) return false
      }
      return true
    })
}

/**
 * THE SINGLE source of rail membership + ordering, shared by the admin screen
 * and the public homepage so the two surfaces can never drift. Pure function
 * (no I/O). Returns ordered FULL payloads per rail:
 *
 *   - Manual rails (featured, games, cash, luxury): membership = placement rows
 *     for still-eligible campaigns, ordered `position ASC, campaign_id ASC`.
 *   - Derived rails (balloon_pop, instant_cash): membership from the shared
 *     `classifyGiveaway` classifier ONLY; a placement row is ordering-only and
 *     can never create membership. Order = [positioned (position ASC, id ASC),
 *     then unpositioned (ends_at ASC NULLS LAST → % sold DESC → id ASC)].
 */
export function buildHomepageRailPayloads(
  eligiblePayloads: any[],
  placementRows: PlacementRow[],
): RailPayloads {
  const eligibleById = new Map<string, any>()
  for (const p of eligiblePayloads) {
    if (p?.id != null) eligibleById.set(String(p.id), p)
  }

  const placementsByRail = new Map<HomepageRail, Map<string, number>>()
  for (const rail of HOMEPAGE_RAILS) placementsByRail.set(rail, new Map())
  for (const row of placementRows) {
    if (!isValidRail(row.rail)) continue
    placementsByRail.get(row.rail)!.set(String(row.campaign_id), Number(row.position ?? 0))
  }

  const rails = {} as RailPayloads

  for (const rail of HOMEPAGE_RAILS) {
    const posMap = placementsByRail.get(rail)!

    if (isManualRail(rail)) {
      const placed = [...posMap.entries()]
        .map(([campaignId, position]) => ({ campaignId, position }))
        .filter((r) => eligibleById.has(r.campaignId))
        .sort((a, b) => a.position - b.position || (a.campaignId < b.campaignId ? -1 : a.campaignId > b.campaignId ? 1 : 0))
      rails[rail] = placed.map((r) => ({ payload: eligibleById.get(r.campaignId), positioned: true }))
    } else {
      const category = DERIVED_RAIL_CATEGORY[rail as 'balloon_pop' | 'instant_cash']
      const members = eligiblePayloads.filter((p: any) => classifyGiveaway(p) === category)

      const positioned = members
        .filter((p: any) => posMap.has(String(p.id)))
        .sort((a: any, b: any) => {
          const pa = posMap.get(String(a.id))!
          const pb = posMap.get(String(b.id))!
          return pa - pb || byIdAsc(a, b)
        })

      const unpositioned = members
        .filter((p: any) => !posMap.has(String(p.id)))
        .sort(fallbackCompare)

      rails[rail] = [
        ...positioned.map((p: any) => ({ payload: p, positioned: true })),
        ...unpositioned.map((p: any) => ({ payload: p, positioned: false })),
      ]
    }
  }

  return rails
}

/** Run the two shared queries and return eligible payloads + placement rows. */
async function fetchRailInputs(): Promise<{ eligiblePayloads: any[]; placementRows: PlacementRow[] }> {
  const supabase = await createClient()

  const [snapshotRes, placementRes] = await Promise.all([
    supabase
      .from('giveaway_snapshots')
      .select('payload')
      .eq('kind', 'list')
      .eq('payload->>status', 'live'),
    supabase.from('campaign_homepage_placements').select('campaign_id, rail, position'),
  ])

  const eligiblePayloads = filterEligiblePayloads(snapshotRes.data, Date.now())
  const placementRows = (placementRes.data ?? []) as PlacementRow[]
  return { eligiblePayloads, placementRows }
}

/**
 * PUBLIC homepage data path: exactly TWO Supabase queries, then in-memory
 * grouping/ordering via the shared {@link buildHomepageRailPayloads}. Returns
 * ordered FULL payloads so `PublicGiveawayCard` can render price / countdown /
 * progress without any per-card fetch.
 */
export async function loadHomepageRails(): Promise<{ rails: RailPayloads; eligiblePayloads: any[] }> {
  const { eligiblePayloads, placementRows } = await fetchRailInputs()
  return { rails: buildHomepageRailPayloads(eligiblePayloads, placementRows), eligiblePayloads }
}

/**
 * ADMIN merchandising data path — same two queries and the SAME shared builder,
 * then mapped to the thin {@link MerchandisingItem} shape the admin UI uses.
 * Pure read: no writes, no deletes, no snapshot regeneration.
 */
export async function loadHomepageMerchandising(): Promise<HomepageMerchandisingData> {
  const { eligiblePayloads, placementRows } = await fetchRailInputs()
  const railPayloads = buildHomepageRailPayloads(eligiblePayloads, placementRows)

  const rails = {} as Record<HomepageRail, MerchandisingItem[]>
  for (const rail of HOMEPAGE_RAILS) {
    rails[rail] = railPayloads[rail].map((e) => toItem(e.payload, e.positioned))
  }

  // Add-picker source: every eligible competition, alphabetical by title.
  const eligible = eligiblePayloads
    .map((p: any) => toItem(p, false))
    .sort((a, b) => a.title.localeCompare(b.title) || byIdAsc(a, b))

  return { rails, eligible }
}
