import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizeAdminApi } from '@/lib/admin/auth'
import { fetchGrowth } from '@/lib/admin/reporting/growth-queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * Admin-only Growth Analytics JSON (Dashboard "Growth" tab).
 *
 * Same auth contract as /api/admin/reports: authorize with the user-scoped RLS
 * client FIRST (admin role only — operations_admin is NOT granted access, to
 * match the admin-only Dashboard), THEN the query lib constructs the
 * service-role client to run the aggregate-only reporting RPC. The RPC returns
 * no customer identities, so nothing here needs redaction.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { role, error } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (error || !role) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const result = await fetchGrowth(role, request.nextUrl.searchParams)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: NO_STORE },
    )
  }

  return NextResponse.json(
    { ok: true, filters: result.filters, data: result.data },
    { headers: NO_STORE },
  )
}
