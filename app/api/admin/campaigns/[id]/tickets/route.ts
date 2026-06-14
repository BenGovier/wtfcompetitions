import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { authorizeAdminApi } from '@/lib/admin/auth'

const NO_STORE = { headers: { 'Cache-Control': 'private, no-cache' } }
const PAGE_SIZE = 100

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Admin-only. Hosts (ops) and read_only are rejected.
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403, ...NO_STORE },
    )
  }

  const { id: campaignId } = await params
  if (!campaignId) {
    return NextResponse.json({ ok: false, error: 'Missing campaign id' }, { status: 400, ...NO_STORE })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[admin/campaign-tickets] Missing Supabase config')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500, ...NO_STORE })
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))

  try {
    // SINGLE data call: the existing RPC handles all joins/pagination server-side.
    const { data, error } = await svc.rpc('get_campaign_tickets_page', {
      p_campaign_id: campaignId,
      p_page: page,
      p_page_size: PAGE_SIZE,
    })

    if (error) {
      console.error('[admin/campaign-tickets] RPC error:', error.message)
      return NextResponse.json({ ok: false, error: 'Failed to fetch tickets' }, { status: 500, ...NO_STORE })
    }

    const rows = Array.isArray(data) ? data : []
    const totalTicketsSold = rows.length > 0 ? Number(rows[0].total_tickets_sold ?? 0) : 0

    const tickets = rows.map((r: any) => ({
      ticket_number: r.ticket_number,
      first_name: r.first_name ?? null,
      last_name: r.last_name ?? null,
      email: r.email ?? null,
      mobile: r.mobile ?? null,
      order_reference: r.order_reference ?? null,
      purchased_at: r.purchased_at ?? null,
    }))

    return NextResponse.json(
      {
        ok: true,
        tickets,
        page,
        pageSize: PAGE_SIZE,
        totalTicketsSold,
      },
      NO_STORE,
    )
  } catch (err: any) {
    console.error('[admin/campaign-tickets] Unexpected error:', err?.message || err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500, ...NO_STORE })
  }
}
