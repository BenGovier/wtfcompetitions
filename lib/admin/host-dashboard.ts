import 'server-only'

/* -------------------------------------------------------------------------- *
 * Host Dashboard data layer (Phase 3 — read-only, host-scoped).
 *
 * SECURITY MODEL
 *   The host is ALWAYS the authenticated user. This module never accepts a
 *   host_user_id from the caller/client — it derives identity from the session
 *   via getAdminContext(). A host therefore cannot request another host's
 *   assignments, commission, earnings or campaign list by tampering with a URL.
 *   Only 'admin' and 'ops' (Host) roles are allowed; everyone else gets null.
 *
 * PERFORMANCE MODEL (no N+1)
 *   A host with N campaigns costs a FIXED number of operations, independent of N:
 *     1. one read of THIS host's campaign_hosts rows
 *     2. one bounded read of the campaigns table (by primary-key list)
 *     3. ONE get_admin_sales_dashboard('this_month') RPC for ALL campaigns
 *   We never loop the reporting RPC per campaign, never scan raw orders/entries,
 *   and never perform Auth Admin lookups (listHosts) — the host's name comes
 *   from the already-authenticated session user.
 *
 * MONEY MODEL
 *   Commission is based ONLY on external cash (external_pence). Wallet/site
 *   credit (credit_pence) contributes £0. All maths stays in integer pence and
 *   is divided by 100 only at the display boundary in the UI.
 * -------------------------------------------------------------------------- */

import { getAdminContext } from '@/lib/admin/auth'
import { getServiceSupabase } from '@/lib/admin/live-board'
import type { CampaignPerformanceRow, DashboardPayload } from '@/lib/admin/reporting/types'
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

  const generatedAt = new Date().toISOString()

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

  // 3) Authoritative campaign metadata (title/status) for exactly this host's
  //    campaigns — a bounded primary-key lookup, NOT a raw scan. This ensures
  //    campaigns with zero sales this month still appear with correct status.
  //    4) ONE reporting RPC for the whole account this month; we read only the
  //    per-campaign rows for this host from it. Both run in parallel.
  const [{ data: campaignRows, error: campaignErr }, rpcResult] = await Promise.all([
    svc.from('campaigns').select('id, title, status, max_tickets_total').in('id', campaignIds),
    svc.rpc('get_admin_sales_dashboard', {
      p_range: 'this_month',
      p_from: null,
      p_to: null,
      p_campaign: null,
      p_provider: null,
      p_campaign_sort: 'external',
      p_campaign_limit: 500,
      p_campaign_offset: 0,
    }),
  ])

  if (campaignErr) {
    console.log('[v0] host-dashboard campaigns error:', campaignErr.message)
    return { ok: false, error: 'query_failed' }
  }
  if (rpcResult.error) {
    console.log('[v0] host-dashboard rpc error:', rpcResult.error.message)
    return { ok: false, error: 'query_failed' }
  }

  const payload = (rpcResult.data ?? null) as DashboardPayload | null

  // Index the reporting rows by campaign id (period external cash + lifetime %).
  const perfByCampaign = new Map<string, CampaignPerformanceRow>()
  for (const row of payload?.campaigns ?? []) {
    if (row?.campaign_id) perfByCampaign.set(row.campaign_id, row)
  }

  // 5) Merge into host-scoped, costed summaries.
  const campaigns: HostCampaignSummary[] = []
  let hostedCashPence = 0
  let estimatedEarningsPence = 0

  for (const meta of campaignRows ?? []) {
    const campaignId = meta.id as string
    const commissionPct = commissionByCampaign.get(campaignId) ?? 0
    const perf = perfByCampaign.get(campaignId)

    const externalPenceMonth = Math.max(0, Number(perf?.external_pence ?? 0) || 0)
    const earnings = earningsPence(externalPenceMonth, commissionPct)

    const status = String(meta.status ?? 'unknown')
    const maxTicketsTotal =
      meta.max_tickets_total != null ? Number(meta.max_tickets_total) : perf?.max_tickets_total ?? null

    campaigns.push({
      campaignId,
      title: String(meta.title ?? '(untitled competition)'),
      status,
      isActive: status === 'live' || status === 'paused',
      isEnded: status === 'ended',
      commissionPct,
      externalPenceMonth,
      earningsPenceMonth: earnings,
      pctSold: perf?.pct_sold != null ? Number(perf.pct_sold) : null,
      maxTicketsTotal: Number.isFinite(maxTicketsTotal as number) ? (maxTicketsTotal as number) : null,
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
      meta: { lastRefreshAt: payload?.meta?.last_refresh_at ?? null, generatedAt },
    },
  }
}
