"use client"

import useSWR from "swr"
import type { HostDashboardPayload } from "@/lib/admin/host-dashboard-types"

async function fetchHostDashboard(url: string): Promise<HostDashboardPayload> {
  const res = await fetch(url, { headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`host_dashboard_${res.status}`)
  return (await res.json()) as HostDashboardPayload
}

/**
 * Shared client data hook for the Host area.
 *
 * - Seeds SWR with the server-rendered `initialData` (instant first paint, no
 *   client fetch waterfall).
 * - Revalidates every ~45s while the tab is focused so figures stay useful
 *   without behaving like the winner feed.
 * - `keepPreviousData` keeps the last good values on screen during a refresh
 *   (no skeletons/blank flashes on every poll).
 */
export function useHostDashboard(initialData: HostDashboardPayload) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<HostDashboardPayload>(
    "/api/admin/host/dashboard",
    fetchHostDashboard,
    {
      fallbackData: initialData,
      refreshInterval: 45_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
      dedupingInterval: 10_000,
    },
  )

  return {
    data: data ?? initialData,
    isRefreshing: isValidating,
    // Only a hard error when we have no data at all to show.
    hasError: Boolean(error) && !data,
    isLoading,
    refresh: () => mutate(),
  }
}
