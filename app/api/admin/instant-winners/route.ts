import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { authorizeAdminApi } from '@/lib/admin/auth'

const NO_STORE = { headers: { 'Cache-Control': 'private, no-cache' } }

export async function GET(request: NextRequest) {
  // Admin-only. Hosts (ops) and read_only are rejected.
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403, ...NO_STORE }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[admin/instant-winners] Missing Supabase config')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500, ...NO_STORE })
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // Parse query params
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(25, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)))
  const campaignId = searchParams.get('campaignId') || null
  const paidStatus = searchParams.get('paidStatus') || 'all' // all | unpaid | paid
  const search = searchParams.get('search') || null

  const offset = (page - 1) * limit

  try {
    // === Calculate outstanding amount via DB aggregate RPC ===
    // Uses public.get_instant_win_outstanding_pence() which sums unpaid awards server-side
    let outstandingAmountPence = 0
    try {
      const { data: rpcResult, error: rpcError } = await svc.rpc('get_instant_win_outstanding_pence')

      if (rpcError) {
        console.error('[admin/instant-winners] Outstanding RPC error (non-fatal):', rpcError.message)
        // outstandingAmountPence remains 0
      } else {
        // RPC returns a single bigint value
        outstandingAmountPence = typeof rpcResult === 'number' ? rpcResult : parseInt(rpcResult ?? '0', 10) || 0
      }
    } catch (outstandingErr: any) {
      console.error('[admin/instant-winners] Outstanding RPC exception (non-fatal):', outstandingErr?.message)
      // outstandingAmountPence remains 0
    }

    // === Fetch instant_win_awards with pagination ===
    let awards: any[] = []
    let hasNext = false

    // Check if we need to filter by checkout ref (search)
    const hasSearchFilter = Boolean(search)

    if (hasSearchFilter) {
      // Search checkout_intents first, then filter awards by those checkout_intent_ids
      const { data: matchingCheckouts, error: checkoutSearchError } = await svc
        .from('checkout_intents')
        .select('id')
        .ilike('ref', `%${search}%`)
        .limit(500)

      if (checkoutSearchError) {
        console.error('[admin/instant-winners] Checkout search error:', checkoutSearchError.message)
        return NextResponse.json({ ok: false, error: 'Failed to search checkouts' }, { status: 500, ...NO_STORE })
      }

      if (!matchingCheckouts || matchingCheckouts.length === 0) {
        return NextResponse.json({
          ok: true,
          awards: [],
          hasNext: false,
          outstandingAmountPence,
          page,
          limit,
        }, NO_STORE)
      }

      const matchingCheckoutIds = matchingCheckouts.map((c) => c.id)

      // Query awards filtered by checkout_intent_ids
      let awardsQuery = svc
        .from('instant_win_awards')
        .select('id, awarded_at, campaign_id, giveaway_id, prize_id, checkout_intent_id, payout_amount_pence, is_paid, paid_at, payout_notes')
        .in('checkout_intent_id', matchingCheckoutIds)
        .order('awarded_at', { ascending: false })

      if (campaignId) {
        awardsQuery = awardsQuery.eq('campaign_id', campaignId)
      }

      if (paidStatus === 'unpaid') {
        awardsQuery = awardsQuery.eq('is_paid', false)
      } else if (paidStatus === 'paid') {
        awardsQuery = awardsQuery.eq('is_paid', true)
      }

      awardsQuery = awardsQuery.range(offset, offset + limit)

      const { data: awardsData, error: awardsError } = await awardsQuery

      if (awardsError) {
        console.error('[admin/instant-winners] Awards query error:', awardsError.message)
        return NextResponse.json({ ok: false, error: 'Failed to fetch awards' }, { status: 500, ...NO_STORE })
      }

      if (!awardsData || awardsData.length === 0) {
        return NextResponse.json({
          ok: true,
          awards: [],
          hasNext: false,
          outstandingAmountPence,
          page,
          limit,
        }, NO_STORE)
      }

      if (awardsData.length > limit) {
        hasNext = true
        awards = awardsData.slice(0, limit)
      } else {
        awards = awardsData
      }
    } else {
      // No search filter - direct awards query
      let awardsQuery = svc
        .from('instant_win_awards')
        .select('id, awarded_at, campaign_id, giveaway_id, prize_id, checkout_intent_id, payout_amount_pence, is_paid, paid_at, payout_notes')
        .order('awarded_at', { ascending: false })

      if (campaignId) {
        awardsQuery = awardsQuery.eq('campaign_id', campaignId)
      }

      if (paidStatus === 'unpaid') {
        awardsQuery = awardsQuery.eq('is_paid', false)
      } else if (paidStatus === 'paid') {
        awardsQuery = awardsQuery.eq('is_paid', true)
      }

      awardsQuery = awardsQuery.range(offset, offset + limit)

      const { data: awardsData, error: awardsError } = await awardsQuery

      if (awardsError) {
        console.error('[admin/instant-winners] Awards query error:', awardsError.message)
        return NextResponse.json({ ok: false, error: 'Failed to fetch awards' }, { status: 500, ...NO_STORE })
      }

      if (!awardsData || awardsData.length === 0) {
        return NextResponse.json({
          ok: true,
          awards: [],
          hasNext: false,
          outstandingAmountPence,
          page,
          limit,
        }, NO_STORE)
      }

      if (awardsData.length > limit) {
        hasNext = true
        awards = awardsData.slice(0, limit)
      } else {
        awards = awardsData
      }
    }

    // === Batch fetch related data ===
    const prizeIds = [...new Set(awards.map((a) => a.prize_id).filter(Boolean))]
    const checkoutIntentIds = [...new Set(awards.map((a) => a.checkout_intent_id).filter(Boolean))]

    // Fetch prizes
    let prizesData: Record<string, { prize_title: string }> = {}
    if (prizeIds.length > 0) {
      const { data: prizes, error: prizesError } = await svc
        .from('instant_win_prizes')
        .select('id, prize_title')
        .in('id', prizeIds)

      if (prizesError) {
        console.error('[admin/instant-winners] Prizes fetch error (non-fatal):', prizesError.message)
      } else {
        prizesData = Object.fromEntries(
          (prizes ?? []).map((p) => [p.id, { prize_title: p.prize_title }])
        )
      }
    }

    // Fetch checkout_intents for refs and user_ids
    let checkoutsData: Record<string, { ref: string; user_id: string }> = {}
    if (checkoutIntentIds.length > 0) {
      const { data: checkouts, error: checkoutsError } = await svc
        .from('checkout_intents')
        .select('id, ref, user_id')
        .in('id', checkoutIntentIds)

      if (checkoutsError) {
        console.error('[admin/instant-winners] Checkouts fetch error (non-fatal):', checkoutsError.message)
      } else {
        checkoutsData = Object.fromEntries(
          (checkouts ?? []).map((c) => [c.id, { ref: c.ref, user_id: c.user_id }])
        )
      }
    }

    // Fetch entries for ticket allocations - need entry_id from entries table
    let entriesData: Record<string, string> = {} // checkout_intent_id -> entry_id
    if (checkoutIntentIds.length > 0) {
      const { data: entries, error: entriesError } = await svc
        .from('entries')
        .select('id, checkout_intent_id')
        .in('checkout_intent_id', checkoutIntentIds)

      if (entriesError) {
        console.error('[admin/instant-winners] Entries fetch error (non-fatal):', entriesError.message)
      } else {
        entriesData = Object.fromEntries(
          (entries ?? []).map((e) => [e.checkout_intent_id, e.id])
        )
      }
    }

    // Fetch ticket_allocations
    const entryIds = Object.values(entriesData).filter(Boolean)
    let allocationsData: Record<string, { start_ticket: number; end_ticket: number }> = {}
    if (entryIds.length > 0) {
      const { data: allocations, error: allocError } = await svc
        .from('ticket_allocations')
        .select('entry_id, start_ticket, end_ticket')
        .in('entry_id', entryIds)

      if (allocError) {
        console.error('[admin/instant-winners] Allocations fetch error (non-fatal):', allocError.message)
      } else {
        allocationsData = Object.fromEntries(
          (allocations ?? []).map((a) => [a.entry_id, { start_ticket: a.start_ticket, end_ticket: a.end_ticket }])
        )
      }
    }

    // === Fetch customer contact details (FAIL-SOFT, max 25 users) ===
    const userIds = [...new Set(
      Object.values(checkoutsData).map((c) => c.user_id).filter(Boolean)
    )].slice(0, 25)

    let profilesData: Record<string, { real_name: string | null; mobile: string | null }> = {}
    let emailsData: Record<string, string | null> = {}

    if (userIds.length > 0) {
      // Fetch profiles_private
      try {
        const { data: profiles, error: profilesError } = await svc
          .from('profiles_private')
          .select('user_id, real_name, mobile')
          .in('user_id', userIds)

        if (profilesError) {
          console.error('[admin/instant-winners] Profiles fetch error (non-fatal):', profilesError.message)
        } else {
          profilesData = Object.fromEntries(
            (profiles ?? []).map((p) => [p.user_id, { real_name: p.real_name, mobile: p.mobile }])
          )
        }
      } catch (profileErr: any) {
        console.error('[admin/instant-winners] Profiles exception (non-fatal):', profileErr?.message)
      }

      // Fetch auth emails
      try {
        const emailResults = await Promise.allSettled(
          userIds.map(async (userId) => {
            try {
              const { data, error } = await svc.auth.admin.getUserById(userId)
              if (error) {
                console.error(`[admin/instant-winners] Auth lookup failed for ${userId} (non-fatal):`, error.message)
                return { userId, email: null }
              }
              return { userId, email: data?.user?.email ?? null }
            } catch (innerErr: any) {
              console.error(`[admin/instant-winners] Auth exception for ${userId} (non-fatal):`, innerErr?.message)
              return { userId, email: null }
            }
          })
        )

        for (const result of emailResults) {
          if (result.status === 'fulfilled') {
            emailsData[result.value.userId] = result.value.email
          }
        }
      } catch (emailErr: any) {
        console.error('[admin/instant-winners] Email lookup exception (non-fatal):', emailErr?.message)
      }
    }

    // === Build response ===
    const responseAwards = awards.map((award) => {
      const prize = prizesData[award.prize_id]
      const checkout = checkoutsData[award.checkout_intent_id]
      const entryId = entriesData[award.checkout_intent_id]
      const allocation = entryId ? allocationsData[entryId] : null
      const userId = checkout?.user_id
      const profile = userId ? profilesData[userId] : null
      const email = userId ? emailsData[userId] : null

      return {
        award_id: award.id,
        awarded_at: award.awarded_at,
        campaign_id: award.campaign_id,
        giveaway_id: award.giveaway_id,
        prize_id: award.prize_id,
        prize_title: prize?.prize_title ?? 'Unknown Prize',
        checkout_intent_id: award.checkout_intent_id,
        checkout_ref: checkout?.ref ?? '-',
        user_id: userId ?? null,
        customer_name: profile?.real_name || 'Unknown',
        customer_email: email || '-',
        customer_mobile: profile?.mobile || '-',
        start_ticket: allocation?.start_ticket ?? null,
        end_ticket: allocation?.end_ticket ?? null,
        payout_amount_pence: award.payout_amount_pence,
        is_paid: award.is_paid ?? false,
        paid_at: award.paid_at,
        payout_notes: award.payout_notes,
      }
    })

    return NextResponse.json({
      ok: true,
      awards: responseAwards,
      hasNext,
      outstandingAmountPence,
      page,
      limit,
    }, NO_STORE)
  } catch (err: any) {
    console.error('[admin/instant-winners] Unexpected error:', err?.message || err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500, ...NO_STORE })
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { user, error: authError } = await authorizeAdminApi(supabase, { roles: ['admin'] })
  if (!user) {
    return NextResponse.json(
      { ok: false, error: authError },
      { status: authError === 'Not authenticated' ? 401 : 403, ...NO_STORE }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[admin/instant-winners] Missing Supabase config')
    return NextResponse.json({ ok: false, error: 'Server configuration error' }, { status: 500, ...NO_STORE })
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  try {
    const body = await request.json()
    const { award_id, payout_amount_pence, is_paid, payout_notes } = body

    if (!award_id || typeof award_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing or invalid award_id' }, { status: 400, ...NO_STORE })
    }

    // Build update object - only payout tracking fields
    const updateData: Record<string, any> = {}

    if (payout_amount_pence !== undefined) {
      // Allow null to clear, or number to set
      if (payout_amount_pence === null || typeof payout_amount_pence === 'number') {
        updateData.payout_amount_pence = payout_amount_pence
      }
    }

    if (payout_notes !== undefined) {
      // Allow null to clear, or string to set
      if (payout_notes === null || typeof payout_notes === 'string') {
        updateData.payout_notes = payout_notes
      }
    }

    if (is_paid !== undefined && typeof is_paid === 'boolean') {
      updateData.is_paid = is_paid
      if (is_paid) {
        updateData.paid_at = new Date().toISOString()
        updateData.paid_by_user_id = user.id
      } else {
        updateData.paid_at = null
        updateData.paid_by_user_id = null
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400, ...NO_STORE })
    }

    const { data: updatedRows, error: updateError } = await svc
      .from('instant_win_awards')
      .update(updateData)
      .eq('id', award_id)
      .select('id, payout_amount_pence, is_paid, paid_at, paid_by_user_id, payout_notes')

    if (updateError) {
      console.error('[admin/instant-winners] Update error:', updateError.message)
      return NextResponse.json({ ok: false, error: 'Failed to update award' }, { status: 500, ...NO_STORE })
    }

    const updatedRow = updatedRows?.[0]
    if (!updatedRow) {
      return NextResponse.json({ ok: false, error: 'Award not found' }, { status: 404, ...NO_STORE })
    }

    // Fetch updated outstanding total via RPC
    let outstandingAmountPence = 0
    try {
      const { data: rpcResult, error: rpcError } = await svc.rpc('get_instant_win_outstanding_pence')
      if (rpcError) {
        console.error('[admin/instant-winners] Outstanding RPC error after PATCH (non-fatal):', rpcError.message)
      } else {
        outstandingAmountPence = typeof rpcResult === 'number' ? rpcResult : parseInt(rpcResult ?? '0', 10) || 0
      }
    } catch (rpcErr: any) {
      console.error('[admin/instant-winners] Outstanding RPC exception after PATCH (non-fatal):', rpcErr?.message)
    }

    return NextResponse.json({
      ok: true,
      updated: {
        award_id: updatedRow.id,
        payout_amount_pence: updatedRow.payout_amount_pence,
        is_paid: updatedRow.is_paid ?? false,
        paid_at: updatedRow.paid_at,
        paid_by_user_id: updatedRow.paid_by_user_id,
        payout_notes: updatedRow.payout_notes,
      },
      outstandingAmountPence,
    }, NO_STORE)
  } catch (err: any) {
    console.error('[admin/instant-winners] PATCH error:', err?.message || err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500, ...NO_STORE })
  }
}
