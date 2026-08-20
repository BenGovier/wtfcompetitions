import 'server-only'

/* -------------------------------------------------------------------------- *
 * Host Dashboard data layer (Phase 3 + live patch — read-only, host-scoped).
 *
 * SECURITY MODEL
 *   The host is ALWAYS the authenticated user. This module never accepts a
 *   host_user_id from the caller/client — it derives identity from the session
 *   via getAdminContext(). A host therefore cannot request another host's
 *   assignments, commission, earnings or campaign list by tampering with a URL.
 *   Only 'admin' and 'ops' (Host) roles are allowed; everyone else gets null.
 *
 * PERFORMANCE MODEL (no N+1, no full admin RPC)
 *   A small FIXED set of host-scoped, set-based reads, independent of campaign
 *   count N:
 *     1. campaign_hosts .............. this host's rows only (ids + commission)
 *     2. campaigns ................... bounded PK lookup (title/status/cap)
 *     3. reporting_sales_daily ....... THIS host's ids, this UK month, EXCLUDING
 *                                      today (completed previous days only)
 *     4. reporting_sales_minute ...... THIS host's ids, TODAY (UK) only
 *     5. giveaway_ticket_counters .... THIS host's ids (one tiny int each)
 *     6. reporting_meta .............. one keyed row (freshness)
 *   Queries 2–6 run in parallel. No per-campaign loop, no raw checkout/entry
 *   scan, no unbounded lifetime reporting history, no Auth Admin lookups.
 *
 * HYBRID FRESHNESS MODEL (why daily + minute)
 *   Current-month external cash = completed previous days (daily rollup) + today
 *   so far (minute rollup). Daily rows are coarse and stable; today is taken
 *   from the finest-grained source so a host watching a Live sees today's cash
 *   at the granularity it is recorded. The two windows are DISJOINT on the UK
 *   day boundary so today is never counted twice.
 *
 * MONEY MODEL (unchanged)
 *   Commission is based ONLY on external cash (external_pence). Wallet/site
 *   credit contributes £0. All maths stays in integer pence and is divided by
 *   100 only at the display boundary in the UI.
 * -------------------------------------------------------------------------- */

import { getAdminContext } from '@/lib/admin/auth'
import { getServiceSupabase } from '@/lib/admin/live-board'
import type {
  HostCampaignSummary,
  HostDashboardPayload,
} from '@/lib/admin/host-dashboard-types'

export type GetHostDashboardResult =
  | { ok: true; data: HostDashboardPayload }
  | { ok: false; error: 'unauthorized' | 'service_unavailable' | 'query_failed' }

/** Derive a friendly greeting name from an email/label (no PII beyond own account). */
function friendlyName(email: string | null | undefined): string {
  if (!email) return 'there'
  const local = email.split('@')[0] ?? ''
  const first = local.split(/[.\-_+]/)[0] ?? local
  if (!first) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/** Integer-pence commission: external cash × pct / 100, rounded to whole pence. */
function earningsPence(externalPence: number, commissionPct: number): number {
  if (!Number.isFinite(externalPence) || externalPence <= 0) return 0
  if (!Number.isFinite(commissionPct) || commissionPct <= 0) return 0
  return Math.round((externalPence * commissionPct) / 100)
}

/* --------------------------- UK time boundaries --------------------------- *
 * reporting_sales_daily.bucket_date stores UK calendar dates; the admin RPC
 * defines 'this_month' as date_trunc('month', today) in Europe/London. So the
 * month/day boundaries MUST be computed in UK local time (correct under BST and
 * GMT), never the server's UTC midnight.
 * -------------------------------------------------------------------------- */

/** Europe/London Y-M-D parts for an instant. */
function ukDateParts(now: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return { year, month, day }
}

/** First day of the current UK month, as 'YYYY-MM-01' (for reporting_sales_daily). */
function ukMonthStartDate(now: Date): string {
  const { year, month } = ukDateParts(now)
  return `${year}-${month}-01`
}

/** Today's UK calendar date, as 'YYYY-MM-DD' (exclusive upper bound for daily). */
function ukTodayDate(now: Date): string {
  const { year, month, day } = ukDateParts(now)
  return `${year}-${month}-${day}`
}

/** Offset (ms) of a timezone at a given UTC instant: (localWallClockAsUTC - utc). */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(new Date(utcMs))) map[p.type] = p.value
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  )
  return asUTC - utcMs
}

/**
 * UTC instant (ISO) of the START of today's UK calendar day. Used as the
 * inclusive lower bound for reporting_sales_minute.bucket_start (a timestamptz
 * stored as the UTC instant of the local minute). UK midnight is never inside a
 * DST transition (transitions occur at 01:00/02:00), so it is unambiguous.
 */
function ukTodayStartUtcISO(now: Date): string {
  const { year, month, day } = ukDateParts(now)
  const guessUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0)
  const offset = tzOffsetMs(guessUtc, 'Europe/London')
  return new Date(guessUtc - offset).toISOString()
}

/**
 * Build the Host Dashboard payload for the AUTHENTICATED host.
 *
 * Returns an `unauthorized` result for non-admin/non-host sessions. Hosts with
 * no assignments get an ok result with an empty campaign list (useful empty
 * state), never an error.
 */
export async function getHostDashboard(): Promise<GetHostDashboardResult> {
  // 1) Identity + role strictly from the session.
  const ctx = await getAdminContext()
  if (!ctx || (ctx.role !== 'ops' && ctx.role !== 'admin')) {
    return { ok: false, error: 'unauthorized' }
  }
  const hostUserId = ctx.user.id
  const hostName = friendlyName(ctx.user.email)

  let svc
  try {
    svc = getServiceSupabase()
  } catch {
    return { ok: false, error: 'service_unavailable' }
  }

  // 2) This host's assignments (bounded to their own rows).
  const { data: assignmentRows, error: assignErr } = await svc
    .from('campaign_hosts')
    .select('campaign_id, commission_pct')
    .eq('host_user_id', hostUserId)

  if (assignErr) {
    console.log('[v0] host-dashboard assignments error:', assignErr.message)
    return { ok: false, error: 'query_failed' }
  }

  const commissionByCampaign = new Map<string, number>()
  for (const row of assignmentRows ?? []) {
    const id = row.campaign_id as string
    const pct = Number(row.commission_pct)
    if (id && Number.isFinite(pct)) commissionByCampaign.set(id, pct)
  }

  const now = new Date()
  const generatedAt = now.toISOString()

  // No assignments → useful empty state (no further queries).
  if (commissionByCampaign.size === 0) {
    return {
      ok: true,
      data: {
        hostName,
        month: { label: 'This month', hostedCashPence: 0, estimatedEarningsPence: 0 },
        campaigns: [],
        meta: { lastRefreshAt: null, generatedAt },
      },
    }
  }

  const campaignIds = [...commissionByCampaign.keys()]
  const monthStart = ukMonthStartDate(now)
  const todayDate = ukTodayDate(now)
  const todayStartUtc = ukTodayStartUtcISO(now)

  // 3–6) All host-scoped and bounded by campaignIds — run in parallel.
  //   - campaigns: authoritative title/status/cap (also surfaces zero-sales
  //     campaigns that would be absent from the reporting rollups).
  //   - reporting_sales_daily: completed PREVIOUS days this UK month
  //     (bucket_date >= monthStart AND < today). Uses (campaign_id, bucket_date).
  //   - reporting_sales_minute: TODAY so far (bucket_start >= UK midnight).
  //     Bounded by assigned campaigns × providers × today's minutes.
  //   - giveaway_ticket_counters: one tiny row per campaign for ticket progress.
  //   - reporting_meta: single keyed row for freshness.
  const [
    { data: campaignRows, error: campaignErr },
    { data: dailyRows, error: dailyErr },
    { data: minuteRows, error: minuteErr },
    { data: counterRows, error: counterErr },
    { data: metaRow, error: metaErr },
  ] = await Promise.all([
    svc.from('campaigns').select('id, title, status, max_tickets_total').in('id', campaignIds),
    svc
      .from('reporting_sales_daily')
      .select('campaign_id, external_pence')
      .in('campaign_id', campaignIds)
      .gte('bucket_date', monthStart)
      .lt('bucket_date', todayDate),
    svc
      .from('reporting_sales_minute')
      .select('campaign_id, external_pence')
      .in('campaign_id', campaignIds)
      .gte('bucket_start', todayStartUtc),
    svc.from('giveaway_ticket_counters').select('giveaway_id, next_ticket').in('giveaway_id', campaignIds),
    svc.from('reporting_meta').select('value').eq('key', 'last_refresh').maybeSingle(),
  ])

  if (campaignErr) {
    console.log('[v0] host-dashboard campaigns error:', campaignErr.message)
    return { ok: false, error: 'query_failed' }
  }
  if (dailyErr) {
    console.log('[v0] host-dashboard daily error:', dailyErr.message)
    return { ok: false, error: 'query_failed' }
  }
  if (minuteErr) {
    console.log('[v0] host-dashboard minute error:', minuteErr.message)
    return { ok: false, error: 'query_failed' }
  }
  if (counterErr) {
    console.log('[v0] host-dashboard counter error:', counterErr.message)
    return { ok: false, error: 'query_failed' }
  }
  // reporting_meta is non-critical: a freshness lookup failure must not 500 the
  // whole dashboard — we simply show no "updated" label.
  if (metaErr) {
    console.log('[v0] host-dashboard meta (non-fatal) error:', metaErr.message)
  }

  // Previous completed days this month (external cash) per campaign.
  const prevMonthByCampaign = new Map<string, number>()
  for (const row of dailyRows ?? []) {
    const id = row.campaign_id as string
    if (!id) continue
    const ext = Math.max(0, Number(row.external_pence ?? 0) || 0)
    prevMonthByCampaign.set(id, (prevMonthByCampaign.get(id) ?? 0) + ext)
  }

  // Today so far (external cash) per campaign, from minute rows.
  const todayByCampaign = new Map<string, number>()
  for (const row of minuteRows ?? []) {
    const id = row.campaign_id as string
    if (!id) continue
    const ext = Math.max(0, Number(row.external_pence ?? 0) || 0)
    todayByCampaign.set(id, (todayByCampaign.get(id) ?? 0) + ext)
  }

  // Tickets sold per campaign from the counter (next_ticket - 1, floored at 0).
  const ticketsSoldByCampaign = new Map<string, number>()
  for (const row of counterRows ?? []) {
    const id = row.giveaway_id as string
    if (!id) continue
    const sold = Math.max(0, (Number(row.next_ticket ?? 1) || 1) - 1)
    ticketsSoldByCampaign.set(id, sold)
  }

  const lastRefreshAt =
    (metaRow?.value as { refreshed_at?: string } | null | undefined)?.refreshed_at ?? null

  // 7) Merge into host-scoped, costed summaries.
  const campaigns: HostCampaignSummary[] = []
  let hostedCashPence = 0
  let estimatedEarningsPence = 0

  for (const meta of campaignRows ?? []) {
    const campaignId = meta.id as string
    const commissionPct = commissionByCampaign.get(campaignId) ?? 0

    const externalPenceToday = Math.max(0, todayByCampaign.get(campaignId) ?? 0)
    // Current month so far = completed previous days + today (disjoint windows).
    const externalPenceMonth = Math.max(0, prevMonthByCampaign.get(campaignId) ?? 0) + externalPenceToday
    const earnings = earningsPence(externalPenceMonth, commissionPct)

    const status = String(meta.status ?? 'unknown')
    const maxTicketsTotal =
      meta.max_tickets_total != null && Number.isFinite(Number(meta.max_tickets_total))
        ? Number(meta.max_tickets_total)
        : null

    // Lifetime tickets from the counter (matches the public progress bar).
    const ticketsSold = ticketsSoldByCampaign.get(campaignId) ?? 0
    const ticketsRemaining =
      maxTicketsTotal && maxTicketsTotal > 0 ? Math.max(0, maxTicketsTotal - ticketsSold) : null
    const pctSold =
      maxTicketsTotal && maxTicketsTotal > 0
        ? Math.round((ticketsSold / maxTicketsTotal) * 1000) / 10
        : null

    campaigns.push({
      campaignId,
      title: String(meta.title ?? '(untitled competition)'),
      status,
      isActive: status === 'live' || status === 'paused',
      isEnded: status === 'ended',
      commissionPct,
      externalPenceMonth,
      externalPenceToday,
      earningsPenceMonth: earnings,
      ticketsSold,
      ticketsRemaining,
      pctSold,
      maxTicketsTotal,
    })

    // Each campaign contributes ONCE to this host's totals. Revenue is NOT
    // divided across joint hosts — every host sees the full campaign cash and
    // their own commission slice.
    hostedCashPence += externalPenceMonth
    estimatedEarningsPence += earnings
  }

  // Stable, useful ordering: active first, then by external cash desc, then title.
  campaigns.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    if (b.externalPenceMonth !== a.externalPenceMonth) return b.externalPenceMonth - a.externalPenceMonth
    return a.title.localeCompare(b.title)
  })

  return {
    ok: true,
    data: {
      hostName,
      month: { label: 'This month', hostedCashPence, estimatedEarningsPence },
      campaigns,
      meta: { lastRefreshAt, generatedAt },
    },
  }
}
