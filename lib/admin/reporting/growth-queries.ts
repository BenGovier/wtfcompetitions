import 'server-only'
import { getServiceSupabase } from '@/lib/admin/live-board'
import type { AdminRole } from '@/lib/admin/permissions'
import { parseReportFilters, ReportFilterError } from './filters'
import type { ReportFilters } from './types'
import type { GrowthDashboardPayload } from './growth'

export type FetchGrowthResult =
  | { ok: true; data: GrowthDashboardPayload; filters: ReportFilters }
  | { ok: false; error: string; status: number }

/** RPC arguments for get_admin_growth_dashboard (range/date/campaign/provider only). */
export function toGrowthRpcArgs(filters: ReportFilters) {
  return {
    p_range: filters.range,
    p_from: filters.from,
    p_to: filters.to,
    p_campaign: filters.campaign,
    p_provider: filters.provider,
  }
}

/**
 * Fetch the Growth Analytics payload from the single
 * `get_admin_growth_dashboard` RPC.
 *
 * IMPORTANT: authorization MUST already have happened before this is called.
 * The service-role client (bypassing RLS) is constructed here ONLY to run the
 * admin-only reporting RPC. The resolved admin role is passed purely so we can
 * fail loudly if this is ever wired up ahead of an auth guard. No raw database
 * error is ever forwarded to the client.
 */
export async function fetchGrowth(
  role: AdminRole | null,
  params: URLSearchParams,
): Promise<FetchGrowthResult> {
  if (!role) {
    return { ok: false, error: 'unauthorized', status: 401 }
  }

  let filters: ReportFilters
  try {
    filters = parseReportFilters(params)
  } catch (e) {
    const message = e instanceof ReportFilterError ? e.message : 'Invalid filters'
    return { ok: false, error: message, status: 400 }
  }

  let supabase
  try {
    supabase = getServiceSupabase()
  } catch {
    return { ok: false, error: 'service_unavailable', status: 500 }
  }

  const { data, error } = await supabase.rpc('get_admin_growth_dashboard', toGrowthRpcArgs(filters))

  if (error) {
    console.log('[v0] get_admin_growth_dashboard rpc error:', error.message)
    return { ok: false, error: 'query_failed', status: 500 }
  }
  if (!data) {
    return { ok: false, error: 'no_data', status: 500 }
  }

  return { ok: true, data: data as GrowthDashboardPayload, filters }
}
