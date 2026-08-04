import { requireAdmin } from '@/lib/admin/auth'
import { MarketingDashboard } from '@/components/admin/marketing/MarketingDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Admin Marketing — Stage 2 audience intelligence.
 *
 * Thin, ADMIN-ONLY server shell: it enforces authorization and renders the
 * interactive dashboard, which fetches aggregate audience counts from the
 * admin-only /api/admin/marketing/audiences endpoint (one service-role RPC
 * behind auth). No sending capability exists at this stage.
 */
export default async function AdminMarketingPage() {
  await requireAdmin({ roles: ['admin'] })

  return <MarketingDashboard />
}
