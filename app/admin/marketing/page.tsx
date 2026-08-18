import Link from 'next/link'
import { Mail } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { getServiceSupabase, assembleOpsSummary } from '@/lib/admin/marketing/ops-queries'
import { OperationsConsole } from '@/components/admin/marketing/ops/OperationsConsole'
import type { OpsSummaryResponse } from '@/components/admin/marketing/ops/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Admin Marketing — Stage 034 operations control centre.
 *
 * Thin, ADMIN-ONLY server shell: it enforces authorization, then reads a single
 * bounded operational snapshot (authoritative config + aggregate/masked
 * operational data) and hydrates the interactive console. It has NO sending,
 * discovery, enqueue, claim or worker capability — those live only behind the
 * narrow, admin-gated /api/admin/marketing/ops/* mutation endpoints, and the
 * snapshot is only ever refreshed on a deliberate operator action (no polling).
 */
export default async function AdminMarketingPage() {
  await requireAdmin({ roles: ['admin'] })

  const svc = getServiceSupabase()
  const summary = await assembleOpsSummary(svc)
  const initial: OpsSummaryResponse = { ok: true, ...summary }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-4 flex justify-end">
        <Link
          href="/admin/marketing/preview"
          prefetch={false}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Email preview
        </Link>
      </div>
      <OperationsConsole initial={initial} />
    </div>
  )
}
