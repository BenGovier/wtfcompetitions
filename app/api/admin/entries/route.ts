import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const NO_STORE = { headers: { 'Cache-Control': 'private, no-cache' } }

async function authorize(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { user: null, error: 'Not authenticated' }

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('role,is_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow || adminRow.is_enabled !== true) return { user: null, error: 'Not authorized' }

  return { user, error: null }
}

export async function GET(request: NextRequest) {
  const allowStagingBypass = process.env.VERCEL_ENV !== 'production'

  if (!allowStagingBypass) {
    const supabase = await createClient()
    const { user, error: authError } = await authorize(supabase)
    if (!user) {
      return NextResponse.json(
        { ok: false, error: authError },
        { status: authError === 'Not authenticated' ? 401 : 403, ...NO_STORE }
      )
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: 'Missing Supabase config' }, { status: 500, ...NO_STORE })
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // Parse query params
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)))
  const campaignId = searchParams.get('campaignId') || null
  const state = searchParams.get('state') || null
  const search = searchParams.get('search') || null

  const offset = (page - 1) * limit

  // Build entries query
  let entriesQuery = svc
    .from('entries')
    .select('id, user_id, campaign_id, giveaway_id, qty, created_at, checkout_intent_id', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (campaignId) {
    entriesQuery = entriesQuery.eq('campaign_id', campaignId)
  }

  // Apply pagination
  entriesQuery = entriesQuery.range(offset, offset + limit - 1)

  const { data: entries, error: entriesError, count } = await entriesQuery

  if (entriesError) {
    return NextResponse.json({ ok: false, error: entriesError.message }, { status: 500, ...NO_STORE })
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: true, entries: [], total: 0, page, limit }, NO_STORE)
  }

  // Get checkout_intent_ids for joining
  const checkoutIntentIds = entries.map((e) => e.checkout_intent_id).filter(Boolean)
  const entryIds = entries.map((e) => e.id)

  // Fetch checkout_intents
  let checkoutIntentsData: Record<string, any> = {}
  if (checkoutIntentIds.length > 0) {
    let checkoutQuery = svc
      .from('checkout_intents')
      .select('id, ref, state, total_pence, currency, provider, confirmed_at')
      .in('id', checkoutIntentIds)

    // Filter by state if provided
    if (state) {
      checkoutQuery = checkoutQuery.eq('state', state)
    }

    // Search by checkout ref if provided
    if (search) {
      checkoutQuery = checkoutQuery.ilike('ref', `%${search}%`)
    }

    const { data: checkoutIntents } = await checkoutQuery

    checkoutIntentsData = Object.fromEntries(
      (checkoutIntents ?? []).map((ci) => [ci.id, ci])
    )
  }

  // Fetch ticket_allocations
  let allocationsData: Record<string, { start_ticket: number; end_ticket: number }> = {}
  if (entryIds.length > 0) {
    const { data: allocations } = await svc
      .from('ticket_allocations')
      .select('entry_id, start_ticket, end_ticket')
      .in('entry_id', entryIds)

    allocationsData = Object.fromEntries(
      (allocations ?? []).map((a) => [a.entry_id, { start_ticket: a.start_ticket, end_ticket: a.end_ticket }])
    )
  }

  // Build response entries - filter out entries that don't match state/search filters
  const responseEntries = entries
    .map((entry) => {
      const checkout = checkoutIntentsData[entry.checkout_intent_id]
      const allocation = allocationsData[entry.id]

      // If state or search filter is applied and checkout doesn't match, skip
      if ((state || search) && !checkout) {
        return null
      }

      return {
        id: entry.id,
        created_at: entry.created_at,
        user_id: entry.user_id,
        campaign_id: entry.campaign_id,
        giveaway_id: entry.giveaway_id,
        qty: entry.qty,
        checkout_ref: checkout?.ref ?? null,
        checkout_state: checkout?.state ?? null,
        total_pence: checkout?.total_pence ?? null,
        currency: checkout?.currency ?? null,
        provider: checkout?.provider ?? null,
        confirmed_at: checkout?.confirmed_at ?? null,
        start_ticket: allocation?.start_ticket ?? null,
        end_ticket: allocation?.end_ticket ?? null,
      }
    })
    .filter(Boolean)

  return NextResponse.json(
    {
      ok: true,
      entries: responseEntries,
      total: count ?? 0,
      page,
      limit,
    },
    NO_STORE
  )
}
