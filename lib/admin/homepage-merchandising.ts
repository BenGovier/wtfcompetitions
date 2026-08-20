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
 * Load everything the admin merchandising screen needs in TWO parallel queries.
 * Pure read: no writes, no deletes, no snapshot regeneration.
 */
export async function loadHomepageMerchandising(): Promise<HomepageMerchandisingData> {
  const supabase = await createClient()

  const [snapshotRes, placementRes] = await Promise.all([
    supabase
      .from('giveaway_snapshots')
      .select('payload')
      .eq('kind', 'list')
      .eq('payload->>status', 'live'),
    supabase.from('campaign_homepage_placements').select('campaign_id, rail, position'),
  ])

  const now = Date.now()

  // Eligibility — identical rules to the public homepage (app/page.tsx).
  const eligiblePayloads = (snapshotRes.data ?? [])
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

  const eligibleById = new Map<string, any>()
  for (const p of eligiblePayloads) {
    if (p?.id != null) eligibleById.set(String(p.id), p)
  }

  // Group placement rows by rail → Map<campaign_id, position>.
  const placementsByRail = new Map<HomepageRail, Map<string, number>>()
  for (const rail of HOMEPAGE_RAILS) placementsByRail.set(rail, new Map())
  for (const row of (placementRes.data ?? []) as PlacementRow[]) {
    if (!isValidRail(row.rail)) continue
    placementsByRail.get(row.rail)!.set(String(row.campaign_id), Number(row.position ?? 0))
  }

  const rails = {} as Record<HomepageRail, MerchandisingItem[]>

  for (const rail of HOMEPAGE_RAILS) {
    const posMap = placementsByRail.get(rail)!

    if (isManualRail(rail)) {
      // Membership = placement rows (still-eligible only). position ASC, id ASC.
      const placed = [...posMap.entries()]
        .map(([campaignId, position]) => ({ campaignId, position }))
        .filter((r) => eligibleById.has(r.campaignId))
        .sort((a, b) => a.position - b.position || (a.campaignId < b.campaignId ? -1 : a.campaignId > b.campaignId ? 1 : 0))
      rails[rail] = placed.map((r) => toItem(eligibleById.get(r.campaignId), true))
    } else {
      // Derived: membership from the shared classifier; placement = order only.
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
        ...positioned.map((p: any) => toItem(p, true)),
        ...unpositioned.map((p: any) => toItem(p, false)),
      ]
    }
  }

  // Add-picker source: every eligible competition, alphabetical by title.
  const eligible = eligiblePayloads
    .map((p: any) => toItem(p, false))
    .sort((a, b) => a.title.localeCompare(b.title) || byIdAsc(a, b))

  return { rails, eligible }
}
